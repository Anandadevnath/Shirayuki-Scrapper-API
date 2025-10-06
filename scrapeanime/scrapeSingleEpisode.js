import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Use stealth plugin (keeps behavior unchanged). Launch cost is amortized by reusing a browser.
puppeteer.use(StealthPlugin());

const scrapeCache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 5;

// Reuse a single browser instance across scrapes to avoid repeated cold-starts.
let browserSingleton = null;
let browserLaunchPromise = null;

async function getBrowser() {
    if (browserSingleton) return browserSingleton;
    if (!browserLaunchPromise) {
        browserLaunchPromise = (async () => {
            const { executablePath } = await import('puppeteer');
            const b = await puppeteer.launch({
                headless: 'new',
                executablePath: executablePath(),
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--no-first-run',
                    '--window-size=1920,1080',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-infobars'
                ]
            });
            // on process exit try to close the browser
            try {
                if (typeof process !== 'undefined' && process && process.on) {
                    process.on('exit', () => { try { b.close(); } catch (e) {} });
                }
            } catch (e) {}
            browserSingleton = b;
            return browserSingleton;
        })();
    }
    return browserLaunchPromise;
}

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
    const cached = scrapeCache.get(episodeUrl);
    if (cached && cached.expiresAt > Date.now()) {
        return {
            ...cached.result,
            extraction_time_seconds: 0.001,
            cached: true
        };
    }
    const browser = await getBrowser();
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    // shorter timeouts to fail-fast on slow pages on free-tier hosts (Render)
    page.setDefaultNavigationTimeout(8000);
    page.setDefaultTimeout(8000);

    try {
        // Intercept and block heavy resources to speed page load. Keep it simple to reduce overhead.
        try {
            await page.setRequestInterception(true);
            page.on('request', (req) => {
                const resourceType = req.resourceType();
                const url = req.url();
                if (resourceType === 'image' || resourceType === 'stylesheet' || resourceType === 'font' || resourceType === 'media') {
                    try { req.abort(); } catch (e) { try { req.continue(); } catch (_) { } }
                    return;
                }
                // quick ad heuristics
                if (url.includes('ads') || url.includes('doubleclick') || url.includes('googlesyndication') || url.includes('googletagmanager')) {
                    try { req.abort(); } catch (e) { try { req.continue(); } catch (_) { } }
                    return;
                }
                try { req.continue(); } catch (e) { }
            });
        } catch (e) {
            // some environments disallow request interception on reused pages. ignore and continue.
        }

        const startTime = Date.now();

        await page.goto(episodeUrl, { waitUntil: 'domcontentloaded', timeout: 8000 });

        // Extract image with a compact client function (no console logging inside evaluate)
        const animeImage = await page.evaluate(() => {
            const findAnimeImage = () => {

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
                    '.inner img',
                    '.item img'
                ];

                for (const selector of imageSelectors) {
                    const img = document.querySelector(selector);
                    if (img) {
                        let imageSrc = img.getAttribute('data-src') || img.getAttribute('data-original') || img.getAttribute('data-lazy') || img.getAttribute('src') || img.src;
                        if (imageSrc && imageSrc.startsWith('/')) imageSrc = 'https://w1.123animes.ru' + imageSrc;
                        if (imageSrc && imageSrc.startsWith('http') && imageSrc.length > 10 && !/no_poster|placeholder|default|no-image|loading|lazy|logo|icon|banner|ad/i.test(imageSrc)) {
                            return imageSrc;
                        }
                    }
                }

                // Fallback: scan only reasonably sized images, but cap to first 40 images to avoid long loops
                const allImages = Array.from(document.querySelectorAll('img')).slice(0, 40);
                for (const img of allImages) {
                    let imageSrc = img.getAttribute('data-src') || img.getAttribute('data-original') || img.getAttribute('data-lazy') || img.getAttribute('src') || img.src;
                    if (!imageSrc) continue;
                    if (imageSrc.startsWith('/')) imageSrc = 'https://w1.123animes.ru' + imageSrc;
                    if (imageSrc.startsWith('http') && /\.(jpe?g|png)/i.test(imageSrc) && !/no_poster|placeholder|default|no-image|loading|lazy|logo|icon|banner|ad/i.test(imageSrc) && img.naturalWidth > 80 && img.naturalHeight > 80) {
                        return imageSrc;
                    }
                }

                // Check inline-styled elements for background images (only inline style to avoid scanning all computed styles)
                const styled = Array.from(document.querySelectorAll('[style]')).slice(0, 60);
                for (const el of styled) {
                    const style = el.getAttribute('style') || '';
                    const match = style.match(/background-image:\s*url\(['"]?([^'"\)]+)['"]?\)/i);
                    if (match && match[1]) {
                        let imageSrc = match[1];
                        if (imageSrc.startsWith('/')) imageSrc = 'https://w1.123animes.ru' + imageSrc;
                        if (imageSrc.startsWith('http') && !/no_poster|placeholder|default|no-image|loading|lazy|logo|icon|banner|ad/i.test(imageSrc)) return imageSrc;
                    }
                }

                return null;
            };

            return findAnimeImage();
        });

        let streamingLink = null;
        let attempts = 0;
        const maxAttempts = 2;

        while (!streamingLink && attempts < maxAttempts) {
            attempts++;
            streamingLink = await page.evaluate(() => {
                const findValidIframeSource = () => {
                    // Explicitly whitelist known video hosts to avoid mistaking comment embeds (e.g., Disqus)
                    const whitelistHosts = [
                        'bunnycdn.to',
                        'bunnycdn',
                        'bunnycdn.com',
                        'play.bunnycdn',
                        'play.bunnycdn.to',
                        'filemoon',
                        'doodstream',
                        'streamtape',
                        'mp4upload',
                        'mixdrop',
                        'upstream',
                        'streamwish',
                        'vids\.to',
                        'vidstream',
                        'fastcdn',
                        'embed',
                        'player',
                        'vid',
                        'video'
                    ];

                    // domains to explicitly reject
                    const blacklist = [
                        'disqus.com',
                        'dtscout.com',
                        'google-analytics',
                        'googletagmanager',
                        'doubleclick.net',
                        'googlesyndication',
                        'googleadservices',
                        'adsystem',
                        'facebook.com',
                        'twitter.com',
                        'instagram.com',
                        'tiktok.com'
                    ];

                    const isValidStreamingLink = (src) => {
                        if (!src || src === 'about:blank' || !src.startsWith('http') || src.length < 30) return false;
                        const s = src.toLowerCase();
                        if (blacklist.some(b => s.includes(b))) return false;
                        // require at least one whitelist host/pattern
                        return whitelistHosts.some(w => {
                            try {
                                if (w.includes('.') || w.includes('\\')) return s.includes(w);
                                return s.includes(w);
                            } catch (e) { return false; }
                        });
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
                        const src = iframe && (iframe.src || iframe.getAttribute('src'));
                        if (src && isValidStreamingLink(src)) return src;
                    }

                    const iframes = Array.from(document.querySelectorAll('iframe')).slice(0, 40);
                    for (const iframe of iframes) {
                        const src = iframe.src || iframe.getAttribute('src') || iframe.getAttribute('data-src') || iframe.getAttribute('data-lazy') || iframe.getAttribute('data-original');
                        if (!src) continue;
                        if (isValidStreamingLink(src)) return src;
                    }

                    return null;
                };

                return findValidIframeSource();
            });

            if (!streamingLink && attempts < maxAttempts) {
                // Click a likely play button to reveal lazy-loaded iframe (if present)
                try {
                    await page.evaluate(() => {
                        const buttons = document.querySelectorAll('button, .play-btn, .load-btn, [onclick], .btn');
                        for (const btn of buttons) {
                            const text = btn.textContent?.toLowerCase() || '';
                            if (text.includes('play') || text.includes('load') || text.includes('watch')) {
                                try { btn.click(); } catch (e) { }
                                break;
                            }
                        }
                    });
                } catch (e) {}

                // After clicking, poll for up to 3s to allow lazy-loaded players to appear.
                const pollStart = Date.now();
                const pollTimeout = 3000; // ms total waiting
                const pollInterval = 300; // ms between checks
                while (Date.now() - pollStart < pollTimeout && !streamingLink) {
                    try {
                        // lightweight check for an iframe or anchor with known hosts
                        streamingLink = await page.evaluate(() => {
                            const whitelist = ['bunnycdn', 'filemoon', 'doodstream', 'streamtape', 'mp4upload', 'mixdrop', 'upstream', 'streamwish'];
                            const isCandidate = (s) => s && typeof s === 'string' && s.startsWith('http') && s.length > 30 && whitelist.some(w => s.toLowerCase().includes(w));
                            // check priority iframe
                            const p = document.querySelector('iframe');
                            if (p) {
                                const s = p.src || p.getAttribute('src') || p.getAttribute('data-src');
                                if (isCandidate(s)) return s;
                            }
                            const iframes = Array.from(document.querySelectorAll('iframe')).slice(0, 40);
                            for (const iframe of iframes) {
                                const s = iframe.src || iframe.getAttribute('src') || iframe.getAttribute('data-src');
                                if (isCandidate(s)) return s;
                            }
                            const anchors = Array.from(document.querySelectorAll('a[href]')).slice(0, 60);
                            for (const a of anchors) {
                                const s = a.href;
                                if (isCandidate(s)) return s;
                            }
                            return null;
                        });
                    } catch (e) { }

                    if (streamingLink) break;
                    await delay(pollInterval);
                }
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
                image: animeImage,
                range_id: 'single-episode',
                strategy: 'single-episode',
                source: '123animes'
            };

            try {
                scrapeCache.set(episodeUrl, {
                    expiresAt: Date.now() + CACHE_TTL_MS,
                    result: { success: true, data: streamingData }
                });
            } catch (e) { }

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
        try {
            // Close page only; keep shared browser running to amortize cold-start cost
            try { await page.close(); } catch (e) { }
        } catch (e) { }
    }
};

// Expose a helper to close the shared browser when the host wants to shut down.
export async function closeSharedBrowser() {
    if (browserSingleton) {
        try { await browserSingleton.close(); } catch (e) { }
        browserSingleton = null;
        browserLaunchPromise = null;
    }
}