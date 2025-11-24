import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';

async function scrapeSchedule() {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-background-timer-throttling',
                '--disable-renderer-backgrounding',
                '--disable-backgrounding-occluded-windows',
                '--disable-features=TranslateUI',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--disable-extensions',
                '--memory-pressure-off',
                '--max_old_space_size=4096',
                '--disable-background-networking',
                '--disable-sync',
                '--disable-translate',
                '--disable-ipc-flooding-protection'
            ]
        });

        const page = await browser.newPage();

        async function navigateWithRetries(url, opts = {}, attempts = 3) {
            let lastErr;
            for (let i = 0; i < attempts; i++) {
                try {
                    const options = Object.assign({ waitUntil: 'networkidle2', timeout: 30000 }, opts);
                    await page.goto(url, options);
                    return;
                } catch (err) {
                    lastErr = err;
                    console.log(`navigate attempt ${i + 1} failed: ${err.message}`);
                    await new Promise(r => setTimeout(r, 500 * (i + 1)));
                }
            }
            throw lastErr;
        }

        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const resourceType = req.resourceType();
            if(['stylesheet', 'image', 'font', 'media', 'texttrack', 'websocket', 'manifest', 'other'].includes(resourceType)) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.setViewport({ width: 1024, height: 576 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

        // Use navigation with retries to reduce chance of transient navigation timeouts
        await navigateWithRetries('https://123anime.la', { waitUntil: 'networkidle2', timeout: 30000 }, 3);

        let bodyFound = false;
        for (let i = 0; i < 2 && !bodyFound; i++) {
            try {
                await page.waitForSelector('body', { timeout: 3000 });
                bodyFound = true;
            } catch (e) {
                console.log(`Body selector attempt ${i + 1} failed, retrying...`);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        try {
            await page.evaluate(() => {
                if (typeof showschedulemenu === 'function') {
                    showschedulemenu();
                }

                const scheduleBtn = document.querySelector('#recomendedclosebtn, button[onclick*="schedule"]');
                if (scheduleBtn) {
                    scheduleBtn.click();
                }
            });
        } catch (evalError) {
            console.log('Schedule trigger failed, continuing with static content...');
        }

        await new Promise(resolve => setTimeout(resolve, 1000));

        const content = await page.content();
        const $ = cheerio.load(content);

        const schedule = [];

        $('.scheduletitle').each((i, titleElem) => {
            const day = $(titleElem).text().trim();

            let current = $(titleElem).next();

            while (current.length && !current.hasClass('scheduletitle')) {
                if (current.hasClass('schedulelist')) {
                    const animeLink = current.find('a');
                    const anime = animeLink.text().trim();

                    let timeElem = current.next();
                    let time = '';

                    if (timeElem.hasClass('airtime')) {
                        time = timeElem.text().trim();
                    }

                    if (anime) {
                        schedule.push({
                            day,
                            anime,
                            time: time || 'No time specified'
                        });
                    }
                }
                current = current.next();
            }
        });

        if (schedule.length === 0) {
            try {
                const scheduleData = await page.$$eval('.scheduletitle, .schedulelist, .airtime', elements => {
                    const result = [];
                    let currentDay = '';

                    elements.forEach(el => {
                        if (el.classList.contains('scheduletitle')) {
                            currentDay = el.textContent.trim();
                        } else if (el.classList.contains('schedulelist')) {
                            const link = el.querySelector('a');
                            const anime = link ? link.textContent.trim() : el.textContent.trim();

                            let nextEl = el.nextElementSibling;
                            let time = 'No time specified';

                            while (nextEl && !nextEl.classList.contains('scheduletitle') && !nextEl.classList.contains('schedulelist')) {
                                if (nextEl.classList.contains('airtime')) {
                                    time = nextEl.textContent.trim();
                                    break;
                                }
                                nextEl = nextEl.nextElementSibling;
                            }

                            if (anime && currentDay) {
                                result.push({
                                    day: currentDay,
                                    anime,
                                    time
                                });
                            }
                        }
                    });

                    return result;
                });

                schedule.push(...scheduleData);
            } catch (altError) {
                console.log('Alternative parsing method failed:', altError.message);
            }
        }

            console.log(JSON.stringify(schedule, null, 2));
            return schedule;

    } catch (error) {
        console.error('Error scraping schedule with Puppeteer:', error.message);
        return [{
            day: "Error",
            anime: `Failed to scrape: ${error.message}`,
            time: "Error occurred"
        }];
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

export default scrapeSchedule;

if (typeof process !== 'undefined') {
    try {
        const { fileURLToPath } = await import('url');
        const __filename = fileURLToPath(import.meta.url);

        if (process.argv[1] === __filename) {
            (async () => {
                try {
                    const result = await scrapeSchedule();
                    console.log(JSON.stringify(result, null, 2));
                } catch (err) {
                    console.error('Scraper failed:', err);
                    process.exit(1);
                }
            })();
        }
    } catch (e) {
    }
}
