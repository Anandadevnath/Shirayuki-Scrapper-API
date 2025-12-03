import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function scrapeAnimePaheIframe(url) {
    let browser = null;
    let page = null;
    
    try {
        console.log('Launching browser...');
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
        
        console.log('Navigating to:', url);
        await page.goto(url, { 
            waitUntil: 'networkidle0',
            timeout: 30000 
        });
        
        // Wait a bit for any dynamic content to load
        await delay(3000);
        
        console.log('Looking for iframe and extracting page variables...');
        
        // Wait for iframe to be present
        await page.waitForSelector('iframe', { timeout: 10000 });
        
        // Extract important variables from the page
        const pageVariables = await page.evaluate(() => {
            return {
                session: typeof session !== 'undefined' ? session : null,
                provider: typeof provider !== 'undefined' ? provider : null,
                url: typeof url !== 'undefined' ? url : null
            };
        });
        
        console.log('Extracted variables:', pageVariables);
        
        // Wait for potential dynamic loading of iframe src
        await delay(5000);
        
        // Check if iframe src gets populated after JavaScript execution
        let iframeData = await page.evaluate(() => {
            const iframes = Array.from(document.querySelectorAll('iframe'));
            return iframes.map((iframe, index) => ({
                index,
                src: iframe.src,
                width: iframe.width || iframe.offsetWidth,
                height: iframe.height || iframe.offsetHeight,
                id: iframe.id,
                className: iframe.className,
                title: iframe.title,
                allowfullscreen: iframe.allowFullscreen,
                scrolling: iframe.scrolling
            }));
        });
        
        // If still no src, try to trigger any click events that might load the iframe
        if (!iframeData.some(iframe => iframe.src)) {
            console.log('Iframe src still empty, trying to interact with page elements...');
            
            // Look for play buttons or similar elements
            const playElements = await page.$$('button, .play, .btn, [data-play]');
            if (playElements.length > 0) {
                try {
                    await playElements[0].click();
                    await delay(3000);
                    
                    // Re-check iframe data
                    iframeData = await page.evaluate(() => {
                        const iframes = Array.from(document.querySelectorAll('iframe'));
                        return iframes.map((iframe, index) => ({
                            index,
                            src: iframe.src,
                            width: iframe.width || iframe.offsetWidth,
                            height: iframe.height || iframe.offsetHeight,
                            id: iframe.id,
                            className: iframe.className,
                            title: iframe.title,
                            allowfullscreen: iframe.allowFullscreen,
                            scrolling: iframe.scrolling
                        }));
                    });
                } catch (clickError) {
                    console.log('Could not click play element:', clickError.message);
                }
            }
        }
        
        console.log('Found iframes:', JSON.stringify(iframeData, null, 2));
        
        if (iframeData.length === 0) {
            throw new Error('No iframes found on the page');
        }
        
        // Try to access the main video iframe (usually the largest or first one)
        const videoIframe = iframeData.find(iframe => 
            iframe.src && 
            (iframe.src.includes('kwik') || 
             iframe.src.includes('video') || 
             iframe.allowfullscreen ||
             iframe.width > 500)
        ) || iframeData[0];
        
        console.log('Selected iframe:', videoIframe);
        
        // Get page content and iframe details
        const pageContent = await page.evaluate(() => {
            return {
                title: document.title,
                url: window.location.href,
                html: document.documentElement.outerHTML.substring(0, 5000) // First 5000 chars
            };
        });
        
        // Try to access iframe content if possible, or use the extracted URL
        let iframeContent = null;
        const targetUrl = videoIframe.src || pageVariables.url;
        
        if (targetUrl) {
            try {
                console.log('Attempting to access video content from:', targetUrl);
                const iframePage = await browser.newPage();
                await iframePage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                
                // Set additional headers for kwik.cx
                await iframePage.setExtraHTTPHeaders({
                    'Referer': url,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
                });
                
                await iframePage.goto(targetUrl, { 
                    waitUntil: 'networkidle0',
                    timeout: 15000 
                });
                
                await delay(3000);
                
                // Look for video players and streaming data
                iframeContent = await iframePage.evaluate(() => {
                    const videoElements = Array.from(document.querySelectorAll('video')).map(video => ({
                        src: video.src,
                        currentSrc: video.currentSrc,
                        poster: video.poster,
                        width: video.videoWidth,
                        height: video.videoHeight,
                        duration: video.duration,
                        controls: video.controls,
                        autoplay: video.autoplay,
                        sources: Array.from(video.querySelectorAll('source')).map(source => ({
                            src: source.src,
                            type: source.type
                        }))
                    }));
                    
                    const sourceElements = Array.from(document.querySelectorAll('source')).map(source => ({
                        src: source.src,
                        type: source.type,
                        media: source.media
                    }));
                    
                    // Look for Plyr or other video player instances
                    const plyrElements = Array.from(document.querySelectorAll('[data-plyr-provider], .plyr, #plyr')).map(el => ({
                        id: el.id,
                        className: el.className,
                        dataProvider: el.getAttribute('data-plyr-provider'),
                        dataPlyrConfig: el.getAttribute('data-plyr-config')
                    }));
                    
                    // Extract any streaming URLs from script tags
                    const scripts = Array.from(document.querySelectorAll('script')).map(script => ({
                        src: script.src,
                        content: script.innerHTML
                    })).filter(script => script.content && (
                        script.content.includes('.mp4') || 
                        script.content.includes('.m3u8') || 
                        script.content.includes('source') ||
                        script.content.includes('video')
                    ));
                    
                    // Look for any blob URLs or streaming links
                    const allLinks = Array.from(document.querySelectorAll('a[href*=".mp4"], a[href*=".m3u8"]')).map(a => a.href);
                    
                    return {
                        title: document.title,
                        url: window.location.href,
                        videoElements,
                        sourceElements,
                        plyrElements,
                        streamingScripts: scripts,
                        mediaLinks: allLinks,
                        html: document.documentElement.outerHTML.substring(0, 5000)
                    };
                });
                
                await iframePage.close();
            } catch (iframeError) {
                console.log('Could not access iframe/video content:', iframeError.message);
            }
        }
        
        return {
            success: true,
            pageData: pageContent,
            pageVariables: pageVariables,
            iframes: iframeData,
            selectedIframe: videoIframe,
            iframeContent: iframeContent,
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        console.error('Error scraping iframe:', error);
        return {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    } finally {
        if (page) await page.close().catch(() => {});
        if (browser) await browser.close().catch(() => {});
    }
}

// Check if episode ID is provided as command line argument
const args = process.argv.slice(2);
if (args.length === 0) {
    console.error('Please provide an episode ID as argument');
    console.log('Usage examples:');
    console.log('  node test.js f8d3cb59e5dd69ffd4a37ae61732c7b369afeb18fe9adf7af04e9d9505c833b1');
    console.log('  node test.js 93d389c8-1dbb-3b3e-3962-28abbfdd5567/f8d3cb59e5dd69ffd4a37ae61732c7b369afeb18fe9adf7af04e9d9505c833b1');
    process.exit(1);
}

let testUrl;
const episodeId = args[0];

if (episodeId.startsWith('http')) {
    // Full URL provided
    testUrl = episodeId;
    console.log('Using full URL:', episodeId);
} else if (episodeId.includes('/')) {
    // Episode ID format: anime-id/session-id
    testUrl = `https://animepahe.si/play/${episodeId}`;
    console.log('Using episode ID:', episodeId);
} else {
    // Single session ID, use default anime ID
    testUrl = `https://animepahe.si/play/93d389c8-1dbb-3b3e-3962-28abbfdd5567/${episodeId}`;
    console.log('Using single session ID:', episodeId);
}

console.log('Starting iframe scraper test...');
console.log('Target URL:', testUrl);
scrapeAnimePaheIframe(testUrl)
    .then(result => {
        console.log('\n=== SCRAPING RESULTS ===');
        console.log(JSON.stringify(result, null, 2));
    })
    .catch(error => {
        console.error('Test failed:', error);
    });
