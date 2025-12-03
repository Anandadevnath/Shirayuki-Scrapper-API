import express from 'express';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const router = express.Router();
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function extractVariables(url) {
    let browser = null;
    let page = null;
    
    try {
        browser = await puppeteer.launch({
            headless: true, 
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
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

        page = await browser.newPage();
        
        // Set user agent to avoid bot detection
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Set viewport
        await page.setViewport({ width: 1280, height: 720 });
        
        await page.goto(url, { 
            waitUntil: 'networkidle0',
            timeout: 30000 
        });
        
        // Wait a bit for any dynamic content to load
        await delay(3000);
        
        // Extract important variables from the page
        const pageVariables = await page.evaluate(() => {
            return {
                session: typeof session !== 'undefined' ? session : null,
                provider: typeof provider !== 'undefined' ? provider : null,
                url: typeof url !== 'undefined' ? url : null
            };
        });
        
        return pageVariables;
        
    } catch (error) {
        console.error('Error extracting variables:', error);
        throw error;
    } finally {
        if (page) await page.close().catch(() => {});
        if (browser) await browser.close().catch(() => {});
    }
}

router.get('/', async (req, res) => {
    const startTime = Date.now();
    
    try {
        let testUrl;
        
        if (!req.query.url) {
            return res.status(400).json({
                success: false,
                error: 'URL parameter is required',
                message: 'Please provide a URL parameter',
                examples: [
                    '/test?url=f8d3cb59e5dd69ffd4a37ae61732c7b369afeb18fe9adf7af04e9d9505c833b1',
                    '/test?url=93d389c8-1dbb-3b3e-3962-28abbfdd5567/f8d3cb59e5dd69ffd4a37ae61732c7b369afeb18fe9adf7af04e9d9505c833b1'
                ],
                timestamp: new Date().toISOString()
            });
        }
        
        if (req.query.url.startsWith('http')) {
            // Full URL provided
            testUrl = req.query.url;
        } else if (req.query.url.includes('/')) {
            // Episode ID format: anime-id/session-id
            testUrl = `https://animepahe.si/play/${req.query.url}`;
            console.log('Constructed URL from episode ID:', testUrl);
        } else {
            // Single session ID, use default anime ID
            testUrl = `https://animepahe.si/play/93d389c8-1dbb-3b3e-3962-28abbfdd5567/${req.query.url}`;
            console.log('Constructed URL with single session ID:', testUrl);
        }
        
        console.log('Extracting variables from:', testUrl);
        const extractedVariables = await extractVariables(testUrl);
        
        const endTime = Date.now();
        const extractionTime = endTime - startTime;
        
        res.json({
            success: true,
            message: 'Extracted variables',
            data: extractedVariables,
            extractionTime: `${extractionTime}ms`,
            extractionTimeSeconds: `${(extractionTime / 1000).toFixed(2)}s`,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Test endpoint error:', error);
        const endTime = Date.now();
        const extractionTime = endTime - startTime;
        
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Failed to extract variables',
            extractionTime: `${extractionTime}ms`,
            extractionTimeSeconds: `${(extractionTime / 1000).toFixed(2)}s`,
            timestamp: new Date().toISOString()
        });
    }
});

export default router;