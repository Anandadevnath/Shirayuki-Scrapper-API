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
                headless: 'new',
                executablePath: executablePath(),
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
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
    page.setDefaultNavigationTimeout(6000);
    page.setDefaultTimeout(6000);

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

        const startTime = Date.now();

        await page.goto(episodeUrl, { waitUntil: 'domcontentloaded', timeout: 6000 });



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

            const episodeRanges = await page.evaluate(() => {
                const ranges = [];

                const rangeSpans = document.querySelectorAll('span[data-range-id]');

                for (const span of rangeSpans) {
                    const rangeText = span.textContent?.trim();
                    const rangeId = span.getAttribute('data-range-id');

                    if (rangeText && /^\d+\s*[-–]\s*\d+$/.test(rangeText)) {
                        ranges.push({
                            range_id: rangeId,
                            range_text: rangeText.replace(/\s+/g, '').replace('–', '-')
                        });
                    }
                }

                if (ranges.length === 0) {
                    const episodeRangeLists = document.querySelectorAll('ul.episodes_range, .episodes_range');

                    for (const element of episodeRangeLists) {
                        const rangeId = element.getAttribute('data-range-id');
                        if (rangeId) {
                            const textContent = element.textContent || '';
                            const rangeMatch = textContent.match(/(\d+)\s*[-–]\s*(\d+)/);
                            if (rangeMatch) {
                                ranges.push({
                                    range_id: rangeId,
                                    range_text: `${rangeMatch[1]}-${rangeMatch[2]}`
                                });
                            }
                        }
                    }
                }

                if (ranges.length === 0) {
                    const rangeElements = document.querySelectorAll('[class*="range"], [class*="episode"]');

                    for (const element of rangeElements) {
                        const textContent = element.textContent || '';
                        const rangeMatch = textContent.match(/(\d+)\s*[-–]\s*(\d+)/);
                        if (rangeMatch) {
                            const rangeText = `${rangeMatch[1]}-${rangeMatch[2]}`;
                            ranges.push({
                                range_id: element.getAttribute('data-range-id') || rangeText,
                                range_text: rangeText
                            });
                        }
                    }
                }

                return ranges;
            });

            let currentRange = 'single-episode';
            if (episodeRanges.length > 0 && episodeNumber !== 'Unknown') {
                const currentEpNum = parseInt(episodeNumber);

                for (const range of episodeRanges) {
                    const [start, end] = range.range_text.split('-').map(n => parseInt(n.trim()));
                    if (currentEpNum >= start && currentEpNum <= end) {
                        currentRange = range.range_text;
                        break;
                    }
                }
            }

            const allRanges = episodeRanges.map(range => range.range_text).sort((a, b) => {
                const aStart = parseInt(a.split('-')[0]);
                const bStart = parseInt(b.split('-')[0]);
                return aStart - bStart;
            });

            const streamingData = {
                title: animeTitle,
                episode_number: episodeNumber,
                streaming_link: streamingLink,
                range_id: currentRange,
                all_ranges: allRanges.length > 0 ? allRanges : ['single-episode']
            };

            try {
                scrapeCache.set(episodeUrl, {
                    expiresAt: Date.now() + CACHE_TTL_MS,
                    result: {
                        success: true,
                        anime_id: animeId,
                        episode: episodeNumber,
                        data: streamingData
                    }
                });
            } catch (e) { }

            console.log(`💾 Skipping database save (disabled): ${animeTitle} - Episode ${episodeNumber}`);

            return {
                success: true,
                anime_id: animeId,
                episode: episodeNumber,
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
            try { await page.close(); } catch (e) { }
        } catch (e) { }
    }
};

export async function closeSharedBrowser() {
    if (browserSingleton) {
        try { await browserSingleton.close(); } catch (e) { }
        browserSingleton = null;
        browserLaunchPromise = null;
    }
}