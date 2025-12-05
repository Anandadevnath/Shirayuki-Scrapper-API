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
        headless: true,
        executablePath: executablePath(),
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-zygote',
          '--window-size=1280,720',
          '--disable-blink-features=AutomationControlled',
          '--disable-infobars',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows',
          '--disable-features=TranslateUI'
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

    // Check cache first
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
    
    // Block unnecessary resources
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      const url = req.url();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType) || url.includes('ads') || url.includes('doubleclick') || url.includes('googlesyndication')) {
        req.abort().catch(() => {});
      } else {
        req.continue().catch(() => {});
      }
    });
    
    await page.goto(animeUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 20000 
    });

    // Wait for episode list to load
    await page.waitForSelector('.ssl-item a, a[href*="?ep="], .episode-list a', { timeout: 8000 }).catch(() => {
      console.log('Episode list selector timeout, continuing with available content...');
    });

    // Extract episode URLs from the episode list
    const episodeData = await page.evaluate(() => {
      const episodes = [];
      
      // Optimized selector - use the most common one first
      let episodeLinks = document.querySelectorAll('.ssl-item a');
      if (episodeLinks.length === 0) {
        episodeLinks = document.querySelectorAll('a[href*="?ep="]');
      }
      if (episodeLinks.length === 0) {
        episodeLinks = document.querySelectorAll('.episode-list a');
      }
      
      episodeLinks.forEach((link, index) => {
        const href = link.getAttribute('href');
        const title = link.getAttribute('title') || link.textContent.trim() || `Episode ${index + 1}`;
        const episodeNumber = link.getAttribute('data-number') || (index + 1);
        
        if (href) {
          episodes.push({
            episodeNumber: episodeNumber,
            title: title,
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

    // Cache the result
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
