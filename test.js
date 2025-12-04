import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function scrapeEpisodeUrls(animeUrl) {
    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-zygote',
                '--window-size=1280,720',
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars'
            ]
        });

        const page = await browser.newPage();
        
        // Set user agent to avoid detection
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        console.log(`Navigating to: ${animeUrl}`);
        await page.goto(animeUrl, { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });

        await delay(2000);

        // Wait for episode list to load
        await page.waitForSelector('.ss-list, .episode-list, .ssl-item', { timeout: 10000 }).catch(() => {
            console.log('Episode list selector not found, trying alternative selectors...');
        });

        // Extract episode URLs from the episode list
        const episodeData = await page.evaluate(() => {
            const episodes = [];
            
            // Multiple selector strategies
            const selectors = [
                '.ssl-item a',
                '.ss-list .ssl-item a',
                '.episode-list a',
                'a[href*="?ep="]',
                'a[data-number]',
                '.ep-item a',
                '.episode a'
            ];
            
            let episodeLinks = [];
            
            // Try each selector until we find episode links
            for (const selector of selectors) {
                episodeLinks = document.querySelectorAll(selector);
                if (episodeLinks.length > 0) {
                    console.log(`Found ${episodeLinks.length} episodes using selector: ${selector}`);
                    break;
                }
            }
            
            // If no specific selectors work, try to find all links with episode patterns
            if (episodeLinks.length === 0) {
                const allLinks = document.querySelectorAll('a[href]');
                episodeLinks = Array.from(allLinks).filter(link => {
                    const href = link.getAttribute('href');
                    return href && (href.includes('?ep=') || href.includes('/episode') || href.includes('data-number'));
                });
                console.log(`Found ${episodeLinks.length} episodes using pattern matching`);
            }
            
            episodeLinks.forEach((link, index) => {
                const href = link.getAttribute('href');
                const title = link.getAttribute('title') || link.textContent.trim() || `Episode ${index + 1}`;
                const episodeNumber = link.getAttribute('data-number') || link.getAttribute('data-id') || (index + 1);
                
                if (href) {
                    episodes.push({
                        episodeNumber: episodeNumber,
                        title: title,
                        url: href.startsWith('http') ? href : `https://animefrenzy.cc${href}`,
                        relativeUrl: href
                    });
                }
            });
            
            // Debug: return page structure if no episodes found
            if (episodes.length === 0) {
                const pageStructure = {
                    episodes: episodes,
                    allLinks: Array.from(document.querySelectorAll('a[href]')).slice(0, 10).map(a => ({
                        href: a.getAttribute('href'),
                        text: a.textContent.trim(),
                        classes: a.className
                    })),
                    possibleEpisodeSections: Array.from(document.querySelectorAll('[class*="episode"], [class*="ep-"], [class*="ssl"]')).map(el => ({
                        tagName: el.tagName,
                        className: el.className,
                        innerHTML: el.innerHTML.substring(0, 200)
                    }))
                };
                console.log('Debug info:', JSON.stringify(pageStructure, null, 2));
            }
            
            return episodes;
        });

        console.log(`Found ${episodeData.length} episodes:`);
        episodeData.forEach((episode, index) => {
            console.log(`${index + 1}. Episode ${episode.episodeNumber}: ${episode.title}`);
            console.log(`   URL: ${episode.url}`);
        });

        return episodeData;

    } catch (error) {
        console.error('Error scraping episode URLs:', error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Function to scrape a specific episode page
async function scrapeEpisodeDetails(episodeUrl) {
    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        console.log(`Scraping episode: ${episodeUrl}`);
        await page.goto(episodeUrl, { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });

        await delay(2000);

        // Extract episode details and streaming links
        const episodeDetails = await page.evaluate(() => {
            const details = {
                title: '',
                streamingLinks: [],
                downloadLinks: []
            };

            // Get episode title
            const titleElement = document.querySelector('h1, .title, .episode-title');
            if (titleElement) {
                details.title = titleElement.textContent.trim();
            }

            // Look for video sources/streaming links
            const videoElements = document.querySelectorAll('video source, iframe');
            videoElements.forEach(element => {
                const src = element.getAttribute('src');
                if (src) {
                    details.streamingLinks.push(src);
                }
            });

            // Look for download links
            const downloadElements = document.querySelectorAll('a[href*="download"], a[download]');
            downloadElements.forEach(element => {
                const href = element.getAttribute('href');
                if (href) {
                    details.downloadLinks.push({
                        url: href,
                        text: element.textContent.trim()
                    });
                }
            });

            return details;
        });

        return episodeDetails;

    } catch (error) {
        console.error('Error scraping episode details:', error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Main execution
async function main() {
    try {
        // Example URL from your screenshot
        const animeUrl = 'https://animefrenzy.cc/watch/one-punch-man-season-3-19932';
        
        console.log('Starting episode URL scraping...\n');
        
        // Scrape all episode URLs
        const episodes = await scrapeEpisodeUrls(animeUrl);
        
        if (episodes.length > 0) {
            console.log('\n--- Episode URLs scraped successfully ---');
            console.log(`Total episodes found: ${episodes.length}`);
            
            // Example: Scrape details for the first episode
            console.log('\n--- Scraping first episode details ---');
            const firstEpisode = episodes[0];
            const episodeDetails = await scrapeEpisodeDetails(firstEpisode.url);
            
            console.log('Episode Details:');
            console.log(`Title: ${episodeDetails.title}`);
            console.log(`Streaming Links: ${episodeDetails.streamingLinks.length}`);
            console.log(`Download Links: ${episodeDetails.downloadLinks.length}`);
            
            if (episodeDetails.streamingLinks.length > 0) {
                console.log('Streaming URLs:');
                episodeDetails.streamingLinks.forEach((link, index) => {
                    console.log(`  ${index + 1}. ${link}`);
                });
            }
        }
        
    } catch (error) {
        console.error('Main execution error:', error);
    }
}

// Export functions for use in other modules
export { scrapeEpisodeUrls, scrapeEpisodeDetails };

// Run if this file is executed directly
if (process.argv[1] && import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
    main();
}

// Also run main if this is the main module
if (import.meta.url.endsWith('test.js')) {
    main();
}
