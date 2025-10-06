
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
// Database saving disabled: removed saveSingleStreamingLink import

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

puppeteer.use(StealthPlugin());

// Simple in-memory cache to avoid re-scraping the same episode repeatedly (useful on free tiers)
const scrapeCache = new Map(); // key: episodeUrl, value: { expiresAt, result }
const CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes

// Retry wrapper for frame detachment and navigation errors
async function withRetries(fn, maxRetries = 3, delayMs = 3000) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            if (err.message && /detached|navigation|timeout|net::ERR|crash|closed/i.test(err.message)) {
                console.warn(`Retry ${attempt}/${maxRetries} after error: ${err.message}`);
                await delay(delayMs * attempt);
            } else {
                throw err;
            }
        }
    }
    throw lastError;
}

export const scrapeSingleEpisode = async (episodeUrl) => {
    // return cached result quickly when available
    const cached = scrapeCache.get(episodeUrl);
    if (cached && cached.expiresAt > Date.now()) {
        return {
            ...cached.result,
            extraction_time_seconds: 0.001, // near-instant from cache
            cached: true
        };
    }
    const { executablePath } = await import('puppeteer');
    const browser = await puppeteer.launch({
        headless: 'new',
        executablePath: executablePath(),
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-features=VizDisplayCompositor',
            '--disable-gpu',
            '--no-first-run',
            '--window-size=1920,1080',
            '--disable-blink-features=AutomationControlled',
            '--disable-infobars',
            '--disable-extensions',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding'
        ]
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    // shorten default timeouts to fail faster on the free tier
    page.setDefaultNavigationTimeout(10000);
    page.setDefaultTimeout(10000);
    
    try {
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const resourceType = req.resourceType();
            const url = req.url();

            // Abort heavy or third-party resources to speed up page load on free tiers
            if (['font', 'media', 'websocket', 'manifest', 'stylesheet', 'image'].includes(resourceType) ||
                url.includes('.mp4') ||
                url.includes('.mp3') ||
                url.includes('google-analytics') ||
                url.includes('googletagmanager') ||
                url.includes('facebook.com') ||
                url.includes('twitter.com') ||
                url.includes('dtscout.com') ||
                url.includes('ads') ||
                url.includes('doubleclick') ||
                url.includes('adsystem') ||
                url.includes('googlesyndication')) {
                try { req.abort(); } catch (e) { try { req.continue(); } catch(_) {} }
            } else {
                try { req.continue(); } catch (e) {}
            }
        });
        
        console.log(`🔍 Loading episode: ${episodeUrl}`);
        
        const startTime = Date.now();

        // Navigate and fail fast if page takes too long
        await page.goto(episodeUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 10000 
        });

        // NOTE: we intentionally avoid waiting for images to fully load. 
        // The poster/image src attributes exist in the HTML and can be extracted
        // without downloading the image bytes. This saves several seconds on slow/free tiers.

        const animeImage = await page.evaluate(() => {
            const findAnimeImage = () => {
                console.log('🔍 Starting enhanced image extraction...');
                
                // Enhanced image selectors based on scrapeFilmList.js
                const imageSelectors = [
                    '.anime-poster img',
                    '.poster img',
                    '.anime-image img',
                    '.anime-cover img',
                    '.show-poster img',
                    '.thumbnail img',
                    '.anime-info img',
                    '.series-poster img',
                    '.film-poster img',
                    '.movie-poster img',
                    'img[alt*="poster"]',
                    'img[alt*="cover"]',
                    'img[class*="poster"]',
                    'img[class*="cover"]',
                    'img[src*="poster"]',
                    'img[src*="cover"]',
                    '.anime-details img',
                    '.anime-meta img',
                    '.series-info img',
                    '.inner img', // Common in 123animes structure
                    '.item img'   // Common in 123animes structure
                ];
                
                // Strategy 1: Try specific selectors first
                for (const selector of imageSelectors) {
                    const img = document.querySelector(selector);
                    if (img) {
                        console.log(`Found img element with selector: ${selector}`);
                        
                        // Extract image source using multiple attributes
                        let imageSrc = img.getAttribute('data-src') ||
                                     img.getAttribute('data-original') ||
                                     img.getAttribute('data-lazy') ||
                                     img.getAttribute('src') ||
                                     img.src;
                        
                        console.log(`Extracted image source: ${imageSrc}`);
                        
                        if (imageSrc && imageSrc.startsWith('http')) {
                            // Check if it's not a placeholder/no_poster image
                            if (!imageSrc.includes('no_poster.png') &&
                                !imageSrc.includes('no_poster.jpg') &&
                                !imageSrc.includes('placeholder.') &&
                                !imageSrc.includes('default.jpg') &&
                                !imageSrc.includes('no-image.') &&
                                !imageSrc.includes('loading.') &&
                                !imageSrc.includes('lazy.') &&
                                imageSrc !== 'about:blank' &&
                                imageSrc.length > 10) {
                                
                                console.log(`✅ Found valid anime image: ${imageSrc}`);
                                return imageSrc;
                            } else {
                                console.log(`❌ Filtered placeholder image: ${imageSrc}`);
                            }
                        }
                    }
                }
                
                // Strategy 2: Look for all images and find the best one
                console.log('🔍 Strategy 2: Scanning all images...');
                const allImages = document.querySelectorAll('img');
                console.log(`Found ${allImages.length} total images`);
                
                for (const img of allImages) {
                    // Extract image source using multiple attributes
                    let imageSrc = img.getAttribute('data-src') ||
                                 img.getAttribute('data-original') ||
                                 img.getAttribute('data-lazy') ||
                                 img.getAttribute('src') ||
                                 img.src;
                    
                    if (imageSrc) {
                        console.log(`Checking image: ${imageSrc.substring(0, 80)}...`);
                        
                        // Make relative URLs absolute
                        if (imageSrc.startsWith('/')) {
                            imageSrc = 'https://w1.123animes.ru' + imageSrc;
                        }
                        
                        // Check if it's a valid anime poster
                        if (imageSrc.startsWith('http') && 
                            (imageSrc.includes('/poster/') || 
                             imageSrc.includes('.jpg') || 
                             imageSrc.includes('.png') ||
                             imageSrc.includes('.jpeg')) &&
                            !imageSrc.includes('no_poster.png') &&
                            !imageSrc.includes('no_poster.jpg') &&
                            !imageSrc.includes('placeholder.') &&
                            !imageSrc.includes('default.jpg') &&
                            !imageSrc.includes('no-image.') &&
                            !imageSrc.includes('loading.') &&
                            !imageSrc.includes('lazy.') &&
                            !imageSrc.includes('logo') &&
                            !imageSrc.includes('icon') &&
                            !imageSrc.includes('banner') &&
                            !imageSrc.includes('ad') &&
                            imageSrc !== 'about:blank' &&
                            imageSrc.length > 10 &&
                            img.width > 80 && 
                            img.height > 80) {
                            
                            console.log(`✅ Found valid fallback image: ${imageSrc}`);
                            return imageSrc;
                        }
                    }
                }
                
                // Strategy 3: Look for background images
                console.log('🔍 Strategy 3: Scanning background images...');
                const elementsWithPotentialBg = document.querySelectorAll('div, span, a, section');
                for (const element of elementsWithPotentialBg) {
                    const style = element.getAttribute('style') || '';
                    const computedStyle = window.getComputedStyle(element);
                    const bgImage = computedStyle.backgroundImage || style;

                    if (bgImage && bgImage.includes('url(')) {
                        const match = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/);
                        if (match) {
                            let imageSrc = match[1];
                            console.log(`Found background image: ${imageSrc}`);
                            
                            // Make relative URLs absolute
                            if (imageSrc.startsWith('/')) {
                                imageSrc = 'https://w1.123animes.ru' + imageSrc;
                            }
                            
                            // Check if it's a valid anime poster
                            if (imageSrc.startsWith('http') && 
                                !imageSrc.includes('no_poster.png') &&
                                !imageSrc.includes('no_poster.jpg') &&
                                !imageSrc.includes('placeholder.') &&
                                !imageSrc.includes('default.jpg') &&
                                !imageSrc.includes('no-image.') &&
                                !imageSrc.includes('loading.') &&
                                !imageSrc.includes('lazy.') &&
                                !imageSrc.includes('logo') &&
                                !imageSrc.includes('icon') &&
                                !imageSrc.includes('banner') &&
                                !imageSrc.includes('ad') &&
                                imageSrc !== 'about:blank' &&
                                imageSrc.length > 10) {
                                
                                console.log(`✅ Found valid background image: ${imageSrc}`);
                                return imageSrc;
                            }
                        }
                    }
                }
                
                // Strategy 4: Look for data attributes
                console.log('🔍 Strategy 4: Scanning data attributes...');
                const elementsWithData = document.querySelectorAll('[data-src], [data-image], [data-poster], [data-thumb]');
                for (const element of elementsWithData) {
                    const dataAttrs = ['data-src', 'data-image', 'data-poster', 'data-thumb'];
                    for (const attr of dataAttrs) {
                        let imageSrc = element.getAttribute(attr);
                        if (imageSrc && (imageSrc.includes('.jpg') || imageSrc.includes('.png') || imageSrc.includes('.jpeg'))) {
                            console.log(`Found data attribute image: ${imageSrc}`);
                            
                            // Make relative URLs absolute
                            if (imageSrc.startsWith('/')) {
                                imageSrc = 'https://w1.123animes.ru' + imageSrc;
                            }
                            
                            // Check if it's a valid anime poster
                            if (imageSrc.startsWith('http') && 
                                !imageSrc.includes('no_poster.png') &&
                                !imageSrc.includes('no_poster.jpg') &&
                                !imageSrc.includes('placeholder.') &&
                                !imageSrc.includes('default.jpg') &&
                                !imageSrc.includes('no-image.') &&
                                !imageSrc.includes('loading.') &&
                                !imageSrc.includes('lazy.') &&
                                !imageSrc.includes('logo') &&
                                !imageSrc.includes('icon') &&
                                !imageSrc.includes('banner') &&
                                !imageSrc.includes('ad') &&
                                imageSrc !== 'about:blank' &&
                                imageSrc.length > 10) {
                                
                                console.log(`✅ Found valid data attribute image: ${imageSrc}`);
                                return imageSrc;
                            }
                        }
                    }
                }
                
                console.log('❌ No valid anime image found with any strategy');
                return null;
            };
            
            return findAnimeImage();
        });
        
        let streamingLink = null;
        let attempts = 0;
        const maxAttempts = 2; // fewer attempts to reduce runtime

        while (!streamingLink && attempts < maxAttempts) {
            attempts++;
            console.log(`🔍 Attempt ${attempts}/${maxAttempts} to find iframe...`);

            // Try to find iframe sources without interacting/clicking first
            streamingLink = await page.evaluate(() => {
                const findValidIframeSource = () => {
                    const blockedDomains = [
                        'dtscout.com',
                        'google.com',
                        'googletagmanager.com',
                        'doubleclick.net',
                        'googlesyndication.com',
                        'googleadservices.com',
                        'adsystem.com',
                        'recaptcha',
                        'facebook.com',
                        'twitter.com',
                        'instagram.com',
                        'tiktok.com',
                        'ads',
                        'ad-',
                        'analytics',
                        'tracking',
                        'metric',
                        'about:blank'
                    ];
                    
                    const validStreamingPatterns = [
                        'bunnycdn',
                        'embed',
                        'play',
                        'stream',
                        'video',
                        'player',
                        'vidsrc',
                        'vidplay',
                        'filemoon',
                        'doodstream',
                        'streamtape',
                        'mp4upload',
                        'mixdrop',
                        'upstream',
                        'streamwish',
                        'vid',
                        'watch'
                    ];
                    
                    const isValidStreamingLink = (src) => {
                        if (!src || src === 'about:blank' || !src.startsWith('http') || src.length < 25) {
                            return false;
                        }
                        
                        const isBlocked = blockedDomains.some(domain => 
                            src.toLowerCase().includes(domain.toLowerCase())
                        );
                        
                        if (isBlocked) {
                            return false;
                        }
                        
                        const isValidStreaming = validStreamingPatterns.some(pattern => 
                            src.toLowerCase().includes(pattern.toLowerCase())
                        );
                        
                        return isValidStreaming;
                    };
                    
                    const prioritySelectors = [
                        '#iframe_ext82377 iframe',
                        'iframe[src*="bunnycdn"]',
                        'iframe[src*="embed"]',
                        'iframe[src*="play"]',
                        'iframe[src*="stream"]',
                        'iframe[src*="video"]',
                        'iframe[src*="player"]',
                        'iframe[src*="vid"]'
                    ];
                    
                    for (const selector of prioritySelectors) {
                        const iframe = document.querySelector(selector);
                        if (iframe && iframe.src && isValidStreamingLink(iframe.src)) {
                            console.log(`Found valid iframe with priority selector: ${selector}`);
                            return iframe.src;
                        }
                    }
                    
                    const iframes = document.querySelectorAll('iframe');
                    console.log(`Scanning ${iframes.length} total iframes`);
                    
                    for (const iframe of iframes) {
                        const src = iframe.src || 
                                  iframe.getAttribute('src') || 
                                  iframe.getAttribute('data-src') ||
                                  iframe.getAttribute('data-lazy') ||
                                  iframe.getAttribute('data-original');
                        
                        if (src) {
                            console.log(`Checking iframe: ${src.substring(0, 60)}...`);
                            
                            if (isValidStreamingLink(src)) {
                                console.log(`✅ Valid streaming iframe found: ${src.substring(0, 60)}...`);
                                return src;
                            } else {
                                console.log(`❌ Blocked/invalid iframe: ${src.substring(0, 60)}...`);
                            }
                        }
                    }
                    
                    return null;
                };
                
                return findValidIframeSource();
            });
            
            if (!streamingLink && attempts < maxAttempts) {
                // minimal interaction: try clicking one likely button and wait briefly
                await page.evaluate(() => {
                    const buttons = document.querySelectorAll('button, .play-btn, .load-btn, [onclick], .btn');
                    for (const btn of buttons) {
                        const text = btn.textContent?.toLowerCase() || '';
                        if (text.includes('play') || text.includes('load') || text.includes('watch')) {
                            try { btn.click(); } catch(e) {}
                            break;
                        }
                    }
                });

                await delay(1000 + (attempts * 500));
                // try to find iframe again in next loop
            }
        }
        
        if (streamingLink) {
            console.log(`✅ Found valid streaming link: ${streamingLink.substring(0, 60)}...`);
            
            if (animeImage) {
                console.log(`🖼️ Found anime poster image: ${animeImage.substring(0, 60)}...`);
            } else {
                console.log(`❌ No anime poster image found`);
            }
            
            const episodePatterns = [
                /episode[\/\-]?(\d+)/i,
                /ep[\/\-]?(\d+)/i,
                /\/(\d+)\/?$/,
                /\-(\d+)\/?$/
            ];
            
            let episodeNumber = 'Unknown';
            for (const pattern of episodePatterns) {
                const match = episodeUrl.match(pattern);
                if (match) {
                    episodeNumber = match[1];
                    break;
                }
            }
            
            let animeTitle = 'Unknown Anime';
            const urlParts = episodeUrl.split('/');
            const animeIndex = urlParts.findIndex(part => part === 'anime');
            
            if (animeIndex !== -1 && urlParts[animeIndex + 1]) {
                animeTitle = urlParts[animeIndex + 1]
                    .replace(/-/g, ' ')
                    .replace(/\b\w/g, l => l.toUpperCase());
            }
            
            const streamingData = {
                title: animeTitle,
                episode_number: episodeNumber,
                episode_url: episodeUrl,
                streaming_link: streamingLink,
                image: animeImage, // Enhanced image extraction
                range_id: 'single-episode',
                strategy: 'single-episode',
                source: '123animes'
            };

            // cache short-term
            try {
                scrapeCache.set(episodeUrl, {
                    expiresAt: Date.now() + CACHE_TTL_MS,
                    result: { success: true, data: streamingData }
                });
            } catch (e) {}
            
            // Database saving is disabled in this environment.
            // Previously this code saved results using saveSingleStreamingLink.
            console.log(`💾 Skipping database save (disabled): ${animeTitle} - Episode ${episodeNumber}`);
            
            return {
                success: true,
                data: streamingData,
                extraction_time_seconds: parseFloat(((Date.now() - startTime) / 1000).toFixed(3))
            };
        } else {
            console.log(`❌ No valid streaming link found for episode after ${maxAttempts} attempts`);
            
            const debugInfo = await page.evaluate(() => {
                const iframes = document.querySelectorAll('iframe');
                const found = [];
                
                for (const iframe of iframes) {
                    const src = iframe.src || 
                              iframe.getAttribute('src') || 
                              iframe.getAttribute('data-src') ||
                              iframe.getAttribute('data-lazy');
                    if (src) {
                        found.push({
                            src: src.substring(0, 100),
                            id: iframe.id || 'no-id',
                            class: iframe.className || 'no-class'
                        });
                    }
                }
                
                return {
                    totalIframes: iframes.length,
                    iframeSources: found,
                    pageTitle: document.title,
                    hasPlayButtons: document.querySelectorAll('button, .play-btn, .load-btn').length
                };
            });
            
            console.log(`Debug info:`, debugInfo);
            
            return {
                success: false,
                error: 'No valid streaming iframe found after multiple attempts',
                episode_url: episodeUrl,
                debug: debugInfo,
                extraction_time_seconds: parseFloat(((Date.now() - startTime) / 1000).toFixed(3))
            };
        }
        
    } catch (error) {
        console.error('❌ Error scraping single episode:', error && error.message ? error.message : error);
        return {
            success: false,
            error: error && error.message ? error.message : String(error),
            episode_url: episodeUrl,
            extraction_time_seconds: typeof startTime === 'number' ? parseFloat(((Date.now() - startTime) / 1000).toFixed(3)) : null
        };
    } finally {
        try { await browser.close(); } catch (e) {}
    }
};