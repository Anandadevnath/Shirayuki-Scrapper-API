import express from 'express';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import simpleCache from '../service/simpleCache.js';

puppeteer.use(StealthPlugin());

const router = express.Router();
const watchCache = simpleCache.createNamespace('watch', 1000 * 60 * 30);

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let browserSingleton = null;
let browserLaunchPromise = null;

async function getBrowser() {
    if (browserSingleton && browserSingleton.isConnected?.()) {
        return browserSingleton;
    }
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
                    '--disable-extensions',
                    '--disable-sync',
                    '--metrics-recording-only',
                    '--mute-audio',
                    '--disable-web-resources',
                    '--disable-preconnect',
                    '--disable-component-extensions-with-background-pages',
                    '--disable-default-apps',
                    '--disable-hang-monitor',
                    '--disable-ipc-flooding-protection',
                    '--disable-popup-blocking',
                    '--disable-prompt-on-repost',
                    '--disable-breakpad',
                    '--disable-client-side-phishing-detection',
                    '--disable-component-update',
                    '--disable-default-apps',
                    '--disable-device-discovery-notifications',
                    '--disable-dialogs-on-abort',
                    '--disable-domain-reliability',
                    '--disable-background-networking',
                    '--disable-backgrounding-occluded-windows',
                    '--no-service-autorun',
                    '--disable-image-animation-resync'
                ]
            });
            browserSingleton = b;
            return browserSingleton;
        })();
    }
    return browserLaunchPromise;
}

// GET /watch/:animetitle
router.get('/:animetitle', async (req, res) => {
    const start = Date.now();
    let page = null;

    try {
        const { animetitle } = req.params;

        if (!animetitle || animetitle.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Anime title parameter is required'
            });
        }

        // Check cache 
        const cached = watchCache.get(animetitle);
        if (cached) {
            console.log(`📦 Cache hit for ${animetitle}`);
            return res.json({
                ...cached,
                extraction_time_seconds: (Date.now() - start) / 1000,
                cached: true,
                timestamp: new Date().toISOString()
            });
        }

        const animeUrl = `https://animefrenzy.cc/watch/${animetitle}`;
        const browser = await getBrowser();

        page = await browser.newPage();

        // Set user agent to avoid detection
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Block unnecessary resources for faster loading
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const resourceType = req.resourceType();
            if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                req.abort().catch(() => { });
            } else {
                req.continue().catch(() => { });
            }
        });

        await page.setJavaScriptEnabled(true);
        await page.goto(animeUrl, {
            waitUntil: 'networkidle2',
            timeout: 15000
        });

        const selectorFound = await page.waitForSelector('.ssl-item a, a[href*="?ep="], .episode-list a', { timeout: 2000 }).catch(() => false);

        if (!selectorFound) {
            console.log(`⚠️ Episode selector timeout for ${animetitle}, attempting extraction anyway...`);
        }

        const episodeData = await page.evaluate(() => {
            const episodes = [];

            let episodeLinks = document.querySelectorAll('.ssl-item a');
            if (episodeLinks.length === 0) {
                episodeLinks = document.querySelectorAll('a[href*="?ep="]');
            }
            if (episodeLinks.length === 0) {
                episodeLinks = document.querySelectorAll('.episode-list a');
            }

            episodeLinks.forEach((link, index) => {
                const href = link.getAttribute('href');
                if (href) {
                    episodes.push({
                        episodeNumber: link.getAttribute('data-number') || (index + 1),
                        title: link.getAttribute('title') || link.textContent?.trim() || `Episode ${index + 1}`,
                        url: href.startsWith('http') ? href : `https://animefrenzy.cc${href}`,
                        relativeUrl: href
                    });
                }
            });

            return episodes;
        });

        const result = {
            success: true,
            animetitle: animetitle,
            sourceUrl: animeUrl,
            totalEpisodes: episodeData.length,
            episodes: episodeData
        };

        watchCache.set(animetitle, result);

        const duration = (Date.now() - start) / 1000;

        res.json({
            ...result,
            extraction_time_seconds: duration,
            cached: false,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        const duration = (Date.now() - start) / 1000;
        console.error('Watch error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            extraction_time_seconds: duration,
            timestamp: new Date().toISOString()
        });
    } finally {
        if (page) {
            try {
                await page.close();
            } catch (e) {
                console.error('Error closing page:', e);
            }
        }
    }
});

export default router;
