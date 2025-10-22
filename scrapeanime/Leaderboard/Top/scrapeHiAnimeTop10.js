import axios from 'axios';
import * as cheerio from 'cheerio';
import romanizeJapanese from '../../../util/romanizeJapanese.js';

export const scrapeHiAnimeTop10 = async () => {
    try {
        const response = await axios.get('https://hianime.to/home', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 30000
        });

        const $ = cheerio.load(response.data);
        const results = [];
        const processedTitles = new Set();

        let trendingSection = $('.anif-block-ul.anif-block-chart.tab-pane.active');
        if (!trendingSection.length) {
            trendingSection = $('.anif-block-ul.anif-block-chart.tab-pane');
        }

        if (trendingSection.length) {
            const topItems = trendingSection.find('.item-top');
            topItems.each((index, item) => {
                if (results.length >= 10) return false;
                try {
                    const titleElement = $(item).find('.film-name a');
                    const title = titleElement.text().trim();
                    const imageElement = $(item).find('.film-poster img');
                    const image = imageElement.attr('data-src') || imageElement.attr('src') || null;
                    
                    const subEpisodes = [];
                    const dubEpisodes = [];
                    $(item).find('.tick-item').each((_, tick) => {
                        if ($(tick).hasClass('tick-sub')) {
                            const ep = $(tick).text().trim();
                            if (ep) subEpisodes.push(ep);
                        }
                        if ($(tick).hasClass('tick-dub')) {
                            const ep = $(tick).text().trim();
                            if (ep) dubEpisodes.push(ep);
                        }
                    });
                    
                    if (title && !processedTitles.has(title)) {
                        processedTitles.add(title);
                        results.push({
                            title: title,
                            image: image,
                            rank: index + 1,
                            sub: subEpisodes,
                            dub: dubEpisodes
                        });
                    }
                } catch (error) {
                }
            });

            const listItems = trendingSection.find('li:not(.item-top)');
            listItems.each((index, item) => {
                if (results.length >= 10) return false;
                try {
                    const titleElement = $(item).find('.film-name a, .dynamic-name, a[title], a');
                    const title = titleElement.text().trim() || titleElement.attr('title');
                    const imageElement = $(item).find('.film-poster img');
                    const image = imageElement.attr('data-src') || imageElement.attr('src') || null;
                    
                    const subEpisodes = [];
                    const dubEpisodes = [];
                    $(item).find('.tick-item').each((_, tick) => {
                        if ($(tick).hasClass('tick-sub')) {
                            const ep = $(tick).text().trim();
                            if (ep) subEpisodes.push(ep);
                        }
                        if ($(tick).hasClass('tick-dub')) {
                            const ep = $(tick).text().trim();
                            if (ep) dubEpisodes.push(ep);
                        }
                    });
                    
                    if (title && title.length > 3 && !processedTitles.has(title)) {
                        processedTitles.add(title);
                        results.push({
                            title: title,
                            image: image,
                            rank: results.length + 1,
                            sub: subEpisodes,
                            dub: dubEpisodes
                        });
                    }
                } catch (error) {
                }
            });
        }

        const finalResults = results.slice(0, 10).map((anime, idx) => ({
            index: idx + 1,
            rank: anime.rank,
            title: anime.title,
            japanese: romanizeJapanese(anime.title) || anime.title,
            img: anime.image ? `${anime.image}?title=${encodeURIComponent(anime.title)}` : '',
            dub: anime.dub,
            sub: anime.sub
        }));

        const resultObj = {};
        finalResults.forEach(anime => {
            resultObj[anime.index] = anime;
        });
        return resultObj;

    } catch (error) {
        console.error('Error scraping HiAnime:', error.message);
        return {
            1: {
                index: 1,
                rank: 1,
                title: "Scraping Error",
                img: null,
                dub: [],
                sub: []
            }
        };
    }
};

