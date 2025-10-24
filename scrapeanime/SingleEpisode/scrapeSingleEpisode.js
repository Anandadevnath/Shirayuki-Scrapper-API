import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
puppeteer.use(StealthPlugin());

const scrapeCache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 5;

let browserSingleton = null;
let browserLaunchPromise = null;

async function getBrowser() {
    if (browserSingleton) return browserSingleton;
    if (!browserLaunchPromise) {
        browserLaunchPromise = (async () => {
            const { executablePath } = await import('puppeteer');
            const b = await puppeteer.launch({
                // use portable headless mode; 'new' can cause issues on some hosts
                headless: true,
                executablePath: executablePath(),
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--no-zygote',
                    '--single-process',
                    '--no-first-run',
                    '--window-size=1280,720',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-infobars',
                    '--disable-background-timer-throttling',
                    '--disable-renderer-backgrounding',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-features=TranslateUI',
                    '--disable-extensions'
                ]
            });
            try {
                if (typeof process !== 'undefined' && process && process.on) {
                    process.on('exit', () => { try { b.close(); } catch (e) { } });
                }
            } catch (e) { }
            browserSingleton = b;
            return browserSingleton;
        })();
    }
    return browserLaunchPromise;
}

export const scrapeSingleEpisode = async (episodeUrl) => {
    const startTime = Date.now();
    console.log(`🔄 Scraping episode data for ${episodeUrl}`);
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
    // increase timeouts slightly and allow a retry on navigation failures
    page.setDefaultNavigationTimeout(15000);
    page.setDefaultTimeout(15000);

    async function safeGoto(url, options = {}) {
        const maxAttempts = 2;
        let attempt = 0;
        while (attempt < maxAttempts) {
            try {
                attempt++;
                return await page.goto(url, options);
            } catch (e) {
                if (attempt >= maxAttempts) throw e;
                // small backoff before retrying
                await new Promise(r => setTimeout(r, 500));
            }
        }
    }

    try {
        try {
            await page.setRequestInterception(true);
            page.on('request', (req) => {
                const resourceType = req.resourceType();
                const url = req.url();
                if (resourceType === 'image' || resourceType === 'stylesheet' || resourceType === 'font' || resourceType === 'media') {
                    try { req.abort(); } catch (e) { try { req.continue(); } catch (_) { } }
                    return;
                }
                if (url.includes('ads') || url.includes('doubleclick') || url.includes('googlesyndication') || url.includes('googletagmanager')) {
                    try { req.abort(); } catch (e) { try { req.continue(); } catch (_) { } }
                    return;
                }
                try { req.continue(); } catch (e) { }
            });
        } catch (e) {
        }

        const scrapingStartTime = Date.now();

    // navigate with a safe retry wrapper to reduce transient navigation timeouts
    await safeGoto(episodeUrl, { waitUntil: 'domcontentloaded', timeout: 12000 });

        let streamingLink = null;
        let attempts = 0;
        const maxAttempts = 2;

        while (!streamingLink && attempts < maxAttempts) {
            attempts++;
            streamingLink = await page.evaluate(() => {
                const findValidIframeSource = () => {
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

                    const iframes = Array.from(document.querySelectorAll('iframe')).slice(0, 20);
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
                } catch (e) { }

                const pollStart = Date.now();
                const pollTimeout = 2000;
                const pollInterval = 200;
                while (Date.now() - pollStart < pollTimeout && !streamingLink) {
                    try {

                        streamingLink = await page.evaluate(() => {
                            const whitelist = ['bunnycdn', 'filemoon', 'doodstream', 'streamtape', 'mp4upload', 'mixdrop', 'upstream', 'streamwish'];
                            const isCandidate = (s) => s && typeof s === 'string' && s.startsWith('http') && s.length > 30 && whitelist.some(w => s.toLowerCase().includes(w));
                            const p = document.querySelector('iframe');
                            if (p) {
                                const s = p.src || p.getAttribute('src') || p.getAttribute('data-src');
                                if (isCandidate(s)) return s;
                            }
                            const iframes = Array.from(document.querySelectorAll('iframe')).slice(0, 20);
                            for (const iframe of iframes) {
                                const s = iframe.src || iframe.getAttribute('src') || iframe.getAttribute('data-src');
                                if (isCandidate(s)) return s;
                            }
                            const anchors = Array.from(document.querySelectorAll('a[href]')).slice(0, 30);
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
            let animeId = 'unknown';
            const urlParts = episodeUrl.split('/');
            const animeIndex = urlParts.findIndex(part => part === 'anime');

            if (animeIndex !== -1 && urlParts[animeIndex + 1]) {
                animeId = urlParts[animeIndex + 1];
                animeTitle = animeId
                    .replace(/-/g, ' ')
                    .replace(/\b\w/g, l => l.toUpperCase());
            }
            const streamingData = {
                title: animeTitle,
                episode_number: episodeNumber,
                streaming_link: streamingLink
            };

            const result = {
                success: true,
                anime_id: animeId,
                episode: episodeNumber,
                data: streamingData
            };

            try {
                scrapeCache.set(episodeUrl, {
                    expiresAt: Date.now() + CACHE_TTL_MS,
                    result: result
                });
            } catch (e) { }

            return {
                ...result,
                extraction_time_seconds: parseFloat(((Date.now() - scrapingStartTime) / 1000).toFixed(3)),
                cached: false
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
                extraction_time_seconds: parseFloat(((Date.now() - scrapingStartTime) / 1000).toFixed(3))
            };
        }

    } catch (error) {
        console.error('❌ Error scraping single episode:', error && error.message ? error.message : error);
        return {
            success: false,
            error: error && error.message ? error.message : String(error),
            episode_url: episodeUrl,
            extraction_time_seconds: parseFloat(((Date.now() - startTime) / 1000).toFixed(3))
        };
    } finally {
        try {
            try { await page.close(); } catch (e) { }
        } catch (e) { }
    }
}

export async function closeSharedBrowser() {
    if (browserSingleton) {
        try { await browserSingleton.close(); } catch (e) { }
        browserSingleton = null;
        browserLaunchPromise = null;
    }
}