import axios from 'axios';
import * as cheerio from 'cheerio';

export async function scrapeAnimeSearch(query) {
    const url = `https://123animehub.cc/search?keyword=${encodeURIComponent(query)}`;

    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        const results = [];

        const selectors = [
            '.film-list .item',
            '.film_list-wrap .item',
            '.flw-item',
            '.anime-list .item',
            '.items .item'
        ];

        let itemsFound = false;

        for (const selector of selectors) {
            const items = $(selector);
            if (items.length > 0) {
                itemsFound = true;

                items.each((i, el) => {
                    const $el = $(el);

                    // Extract title
                    let title = $el.find('.name a, .film-name a, .dynamic-name, .title a, h3 a').first().text().trim() ||
                        $el.find('a[data-jtitle]').attr('data-jtitle') ||
                        $el.find('img').attr('alt') || '';

                    // Move 'Dub' to the end if present in title
                    if (/\(Dub\)/i.test(title)) {
                        title = title.replace(/\s*\(Dub\)/i, '').trim() + ' (Dub)';
                    }

                    // Extract image 
                    const imgElement = $el.find('.film-poster img, .poster img, img').first();
                    let image = imgElement.attr('data-src') ||
                        imgElement.attr('src') ||
                        imgElement.attr('data-lazy') || '';

                    if (image && !image.startsWith('http')) {
                        image = image.startsWith('/') ? 'https://123animehub.cc' + image : 'https://123animehub.cc/' + image;
                    }

                    if (!image || image.includes('no_poster.jpg')) {
                        image = '';
                    }

                    const episodeSelectors = [
                        '.fa-tv',
                        '.ep-num',
                        '.episode',
                        '[class*="ep"]',
                        '.item-head .is-sub'
                    ];

                    let episodeText = '';
                    for (const epSelector of episodeSelectors) {
                        const epElement = $el.find(epSelector);
                        if (epElement.length > 0) {
                            episodeText = epElement.parent().text().trim() || epElement.text().trim();
                            break;
                        }
                    }

                    const episode = episodeText.replace(/[^\d]/g, '') || '';

                    const statusSelectors = [
                        '.dot',
                        '.status',
                        '.film-infor .fdi-item',
                        '.is-sub',
                        '.is-dub'
                    ];

                    let statusText = '';
                    for (const statusSelector of statusSelectors) {
                        const statusElement = $el.find(statusSelector);
                        if (statusElement.length > 0) {
                            statusText = statusElement.parent().text().trim() || statusElement.text().trim();
                            break;
                        }
                    }

                    // Extract sub/dub 
                    const hasSub = statusText.toLowerCase().includes('sub') ||
                        $el.find('.is-sub').length > 0 ||
                        $el.find('[class*="sub"]').length > 0;

                    const hasDub = statusText.toLowerCase().includes('dub') ||
                        $el.find('.is-dub').length > 0 ||
                        $el.find('[class*="dub"]').length > 0;

                    if (title && title.length > 0) {
                        let japanese_title = '';
                        if (image) {
                            try {
                                const urlParts = image.split('/');
                                let fileName = urlParts[urlParts.length - 1];
                                const isDub = /-dub\.(jpg|jpeg|png|webp)$/i.test(fileName);
                                fileName = fileName.replace(/\.(jpg|jpeg|png|webp)$/i, '');
                                fileName = fileName.replace(/-(dub|sub)$/i, '');
                                japanese_title = fileName.replace(/-/g, ' ')
                                    .replace(/\b\w/g, c => c.toUpperCase());
                                if (isDub) {
                                    japanese_title = japanese_title + ' Dub';
                                }
                            } catch (e) {
                                japanese_title = '';
                            }
                        }
                        let type = '';
                        if (hasDub && !hasSub) {
                            type = 'dub';
                        } else if (hasSub && !hasDub) {
                            type = 'sub';
                        } else if (hasDub && hasSub) {
                            type = 'sub/dub';
                        } else {
                            type = '';
                        }
                        results.push({
                            title,
                            japanese_title,
                            type,
                            image,
                            episode: episode || null
                        });
                    }
                });

                break;
            }
        }

        if (!itemsFound) {
            console.log('No anime items found with any selector');
        }

        return results;

    } catch (error) {
        console.error('Error scraping anime search:', error);
        throw new Error(`Failed to scrape search results: ${error.message}`);
    }
}
