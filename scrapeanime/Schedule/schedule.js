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
                '--disable-extensions'
            ]
        });

        const page = await browser.newPage();

        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if(['stylesheet', 'image', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.setViewport({ width: 1366, height: 768 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

        await page.goto('https://123animehub.cc', {
            waitUntil: 'domcontentloaded',
            timeout: 8000
        });

        await page.waitForSelector('body', { timeout: 2000 });

        await page.evaluate(() => {
            if (typeof showschedulemenu === 'function') {
                showschedulemenu();
            }

            const scheduleBtn = document.querySelector('#recomendedclosebtn, button[onclick*="schedule"]');
            if (scheduleBtn) {
                scheduleBtn.click();
            }
        });

        await new Promise(resolve => setTimeout(resolve, 900));

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

        // If still no schedule found, try alternative approach
        if (schedule.length === 0) {
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
        }

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
