import axios from 'axios';
import * as cheerio from 'cheerio';
import romanizeJapanese from '../../../util/romanizeJapanese.js';

export const scrapeHiAnimeMonthlyTop10 = async () => {
    try {
        console.log('🌐 Loading HiAnime home page...');
        const response = await axios.get('https://hianime.to/home', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 30000
        });

        const $ = cheerio.load(response.data);
        const results = [];
        const processedTitles = new Set();

        let monthlySection = $('#top-viewed-month.anif-block-ul.anif-block-chart.tab-pane');
        if (!monthlySection.length) {
            monthlySection = $('.anif-block-ul.anif-block-chart.tab-pane').eq(2); 
        }

        if (monthlySection.length) {
            console.log('✅ Found monthly section');
            
            const topItems = monthlySection.find('.item-top');
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
                        console.log(`📊 Monthly Top ${index + 1}: ${title}`);
                    }
                } catch (error) {
                    console.log(`⚠️ Error processing top item ${index + 1}:`, error.message);
                }
            });

            const listItems = monthlySection.find('li:not(.item-top)');
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
                        console.log(`📊 Monthly #${results.length}: ${title}`);
                    }
                } catch (error) {
                    console.log(`⚠️ Error processing list item ${index + 1}:`, error.message);
                }
            });
        } else {
            console.log('❌ Monthly section not found');
        }

        console.log(`✅ Found ${results.length} monthly anime titles`);

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
        
        console.log(`📋 Returning ${Object.keys(resultObj).length} monthly top anime`);
        return resultObj;

    } catch (error) {
        console.error('❌ Error scraping HiAnime Monthly:', error.message);
        return {
            1: {
                index: 1,
                rank: 1,
                title: "Monthly Scraping Error",
                img: null,
                dub: [],
                sub: []
            }
        };
    }
};