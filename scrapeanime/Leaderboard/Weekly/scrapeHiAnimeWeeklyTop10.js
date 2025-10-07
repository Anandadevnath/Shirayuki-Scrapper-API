import axios from 'axios';
import * as cheerio from 'cheerio';

export const scrapeHiAnimeWeeklyTop10 = async () => {
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

        // Get weekly top anime section
        let weeklySection = $('#top-viewed-week.anif-block-ul.anif-block-chart.tab-pane');
        if (!weeklySection.length) {
            weeklySection = $('.anif-block-ul.anif-block-chart.tab-pane').eq(1); // Weekly is usually the 2nd tab
        }

        if (weeklySection.length) {
            console.log('✅ Found weekly section');
            
            // Get top items (rank 1-3)
            const topItems = weeklySection.find('.item-top');
            topItems.each((index, item) => {
                if (results.length >= 10) return false;
                try {
                    const titleElement = $(item).find('.film-name a');
                    const title = titleElement.text().trim();
                    const imageElement = $(item).find('.film-poster img');
                    const image = imageElement.attr('data-src') || imageElement.attr('src') || null;
                    
                    // Extract sub/dub episode numbers as arrays
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
                            dub: dubEpisodes,
                            category: 'top'
                        });
                        console.log(`📅 Weekly Top ${index + 1}: ${title}`);
                    }
                } catch (error) {
                    console.log(`⚠️ Error processing weekly top item ${index + 1}:`, error.message);
                }
            });

            // Get regular list items (rank 4-10)
            const listItems = weeklySection.find('li:not(.item-top)');
            listItems.each((index, item) => {
                if (results.length >= 10) return false;
                try {
                    const titleElement = $(item).find('.film-name a, .dynamic-name, a[title], a');
                    const title = titleElement.text().trim() || titleElement.attr('title');
                    const imageElement = $(item).find('.film-poster img');
                    const image = imageElement.attr('data-src') || imageElement.attr('src') || null;
                    
                    // Extract sub/dub episode numbers as arrays
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
                            dub: dubEpisodes,
                            category: 'regular'
                        });
                        console.log(`📅 Weekly #${results.length}: ${title}`);
                    }
                } catch (error) {
                    console.log(`⚠️ Error processing weekly list item ${index + 1}:`, error.message);
                }
            });
        }

        // Try alternative selector if no results found
        if (results.length === 0) {
            console.log('🔍 Trying alternative weekly selector...');
            const alternativeWeeklySection = $('[id*="top-viewed-week"]');
            if (alternativeWeeklySection.length) {
                console.log('✅ Found alternative weekly section');
                const allItems = alternativeWeeklySection.find('li');
                allItems.each((index, item) => {
                    if (results.length >= 10) return false;
                    try {
                        const titleElement = $(item).find('.film-name a, a[title], a');
                        const title = titleElement.text().trim() || titleElement.attr('title');
                        const imageElement = $(item).find('.film-poster img, img');
                        const image = imageElement.attr('data-src') || imageElement.attr('src') || null;
                        
                        // Extract sub/dub episode numbers as arrays
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
                                dub: dubEpisodes,
                                category: 'alternative'
                            });
                            console.log(`📅 Weekly Alt #${results.length}: ${title}`);
                        }
                    } catch (error) {
                        console.log(`⚠️ Error processing alternative weekly item ${index + 1}:`, error.message);
                    }
                });
            } else {
                console.log('❌ No weekly section found with alternative selector');
            }
        }

        console.log(`✅ Found ${results.length} weekly anime titles`);

        // Only return top 10
        const finalResults = results.slice(0, 10).map((anime, idx) => ({
            index: idx + 1,
            rank: anime.rank,
            title: anime.title,
            img: anime.image ? `${anime.image}?title=${encodeURIComponent(anime.title)}` : '',
            dub: anime.dub,
            sub: anime.sub,
            category: anime.category
        }));

        // Return as object with index as key
        const resultObj = {};
        finalResults.forEach(anime => {
            resultObj[anime.index] = anime;
        });
        
        console.log(`📋 Returning ${Object.keys(resultObj).length} weekly top anime`);
        return resultObj;

    } catch (error) {
        console.error('❌ Error scraping HiAnime Weekly:', error.message);
        // Return fallback data if scraping fails
        return {
            1: {
                index: 1,
                rank: 1,
                title: "Weekly Scraping Error",
                img: null,
                dub: [],
                sub: [],
                category: 'error'
            }
        };
    }
};