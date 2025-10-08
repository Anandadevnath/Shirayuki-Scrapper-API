import axios from 'axios';
import * as cheerio from 'cheerio';

async function withRetries(fn, maxRetries = 2, delayMs = 1000) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    }
    throw lastError;
}

export const scrapeFilmList = async (baseUrl = 'https://w1.123animes.ru/az-all-anime/all/') => {
    try {
        console.log('🌐 Loading film list page...');

        const response = await withRetries(async () => {
            return await axios.get(baseUrl, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate',
                    'Connection': 'keep-alive'
                }
            });
        });

        const $ = cheerio.load(response.data);
        console.log('✅ Page loaded successfully');

        let items = $('.film-list .item');
        if (items.length === 0) {
            items = $('.item');
        }

        console.log(`🔍 Found ${items.length} anime items`);

        const animeList = [];

        items.each((index, item) => {
            const $item = $(item);
            const inner = $item.find('.inner');
            if (inner.length === 0) return;
            const anchors = inner.find('a[href]');
            if (anchors.length >= 2) {
                const firstLink = $(anchors[0]);
                const secondLink = $(anchors[1]);
                const title = secondLink.attr('data-jititle') || secondLink.text().trim() || `Anime ${index + 1}`;
                // Image
                let imageSrc = null;
                const imgElement = firstLink.find('img');
                if (imgElement.length > 0) {
                    imageSrc = imgElement.attr('data-src') ||
                        imgElement.attr('data-original') ||
                        imgElement.attr('data-lazy') ||
                        imgElement.attr('src');
                }
                if (!imageSrc) {
                    const style = firstLink.attr('style') || '';
                    const bgMatch = style.match(/background-image:\s*url\(['"]?([^'"]+)['"]?\)/);
                    if (bgMatch) {
                        imageSrc = bgMatch[1];
                    }
                }
                if (imageSrc && imageSrc.startsWith('/')) {
                    imageSrc = 'https://w1.123animes.ru' + imageSrc;
                }
                // SUB/DUB and episodes
                const statusDiv = firstLink.find('.status');
                let episodes = null;
                let sub = false;
                let dub = false;
                if (statusDiv.length > 0) {
                    const epDiv = statusDiv.find('.ep');
                    const subSpan = statusDiv.find('.sub');
                    episodes = epDiv.text().trim() || null;
                    if (subSpan.length > 0) {
                        const audioText = subSpan.text().trim().toUpperCase();
                        if (audioText.includes('DUB')) dub = true;
                        if (audioText.includes('SUB')) sub = true;
                    }
                }
                // Also check title for dub/sub
                const titleLower = title.toLowerCase();
                if (titleLower.includes('dub')) dub = true;
                if (titleLower.includes('sub')) sub = true;
                animeList.push({
                    title,
                    image: imageSrc,
                    sub,
                    dub,
                    episodes
                });
            }
        });
        // Remove duplicates by title and image
        const uniqueAnimeList = animeList.filter((anime, index, self) =>
            index === self.findIndex(a => a.title === anime.title && a.image === anime.image)
        );
        return uniqueAnimeList;
    } catch (error) {
        return [];
    }
};