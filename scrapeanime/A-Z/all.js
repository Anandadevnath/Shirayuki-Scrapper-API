import axios from 'axios';
import * as cheerio from 'cheerio';

// Simplified retry function for single HTTP request
async function withRetries(fn, maxRetries = 2, delayMs = 1000) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            
            if (attempt < maxRetries) {
                console.warn(`Attempt ${attempt}/${maxRetries} failed, retrying in ${delayMs}ms...`);
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

        // Find the film list container
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

                const title = secondLink.attr('data-jititle') || 
                    secondLink.text().trim() || 
                    `Anime ${index + 1}`;

                const redirectLink = secondLink.attr('href');

                // Extract image with better fallback
                let imageSrc = null;
                const imgElement = firstLink.find('img');

                if (imgElement.length > 0) {
                    imageSrc = imgElement.attr('data-src') ||
                        imgElement.attr('data-original') ||
                        imgElement.attr('data-lazy') ||
                        imgElement.attr('src');
                }

                // Try background image if no img tag found
                if (!imageSrc) {
                    const style = firstLink.attr('style') || '';
                    const bgMatch = style.match(/background-image:\s*url\(['"]?([^'"]+)['"]?\)/);
                    if (bgMatch) {
                        imageSrc = bgMatch[1];
                    }
                }

                // Make image URL absolute
                if (imageSrc && imageSrc.startsWith('/')) {
                    imageSrc = 'https://w1.123animes.ru' + imageSrc;
                }

                // Filter out placeholder images
                if (imageSrc && (
                    imageSrc.includes('no_poster.jpg') ||
                    imageSrc.includes('placeholder.') ||
                    imageSrc.includes('default.jpg') ||
                    imageSrc.includes('no-image.') ||
                    imageSrc === 'about:blank' ||
                    imageSrc.length < 10
                )) {
                    imageSrc = null;
                }

                // Extract basic metadata from the listing page
                const statusDiv = firstLink.find('.status');
                let episodes = null;
                let audioType = 'SUB'; // Default to SUB

                if (statusDiv.length > 0) {
                    const epDiv = statusDiv.find('.ep');
                    const subSpan = statusDiv.find('.sub');

                    episodes = epDiv.text().trim() || null;

                    if (subSpan.length > 0) {
                        const audioText = subSpan.text().trim().toUpperCase();
                        audioType = audioText.includes('DUB') ? 'DUB' : 'SUB';
                    }
                }

                // Determine audio type from title if not found in status
                if (title.toLowerCase().includes('dub')) {
                    audioType = 'DUB';
                }

                // Extract basic metadata from title and other available info
                let type = 'TV Series'; // Default type
                let status = 'Unknown';
                let released = '2025'; // Default to current year
                let genres = 'General';
                let country = 'Japan';

                // Try to extract more info from the item's data attributes or text
                const dataTitle = $item.attr('data-title') || '';

                // Determine type from various indicators
                if (title.toLowerCase().includes('movie') || dataTitle.toLowerCase().includes('movie')) {
                    type = 'Movie';
                } else if (title.toLowerCase().includes('ova') || dataTitle.toLowerCase().includes('ova')) {
                    type = 'OVA';
                } else if (title.toLowerCase().includes('special') || dataTitle.toLowerCase().includes('special')) {
                    type = 'Special';
                } else if (episodes && episodes.toLowerCase().includes('movie')) {
                    type = 'Movie';
                }

                // Basic genre classification based on title
                const titleLower = title.toLowerCase();
                const genreKeywords = {
                    'Action': ['fight', 'battle', 'war', 'combat', 'hero', 'warrior'],
                    'Romance': ['love', 'heart', 'kiss', 'romance', 'wedding'],
                    'Comedy': ['funny', 'laugh', 'comedy', 'gag', 'humor'],
                    'Drama': ['life', 'story', 'drama', 'tear', 'family'],
                    'Fantasy': ['magic', 'fantasy', 'dragon', 'sword', 'wizard'],
                    'Sci-Fi': ['space', 'robot', 'future', 'cyber', 'mecha'],
                    'Horror': ['horror', 'ghost', 'scary', 'fear', 'death'],
                    'Sports': ['sport', 'game', 'play', 'team', 'match'],
                    'Slice of Life': ['daily', 'school', 'student', 'friend', 'everyday']
                };

                const detectedGenres = [];
                for (const [genre, keywords] of Object.entries(genreKeywords)) {
                    if (keywords.some(keyword => titleLower.includes(keyword))) {
                        detectedGenres.push(genre);
                    }
                }

                if (detectedGenres.length > 0) {
                    genres = detectedGenres.join(', ');
                }

                // Determine status from episodes or title patterns
                if (episodes) {
                    const epNum = episodes.toLowerCase();
                    if (epNum.includes('ongoing') || epNum.includes('continue')) {
                        status = 'Ongoing';
                    } else if (epNum.includes('complete') || epNum.includes('end')) {
                        status = 'Finished';
                    } else {
                        // Try to extract episode number
                        const epMatch = epNum.match(/(\d+)/);
                        if (epMatch) {
                            const num = parseInt(epMatch[1]);
                            status = num > 12 ? 'Finished' : 'Ongoing';
                        }
                    }
                } else {
                    status = 'Unknown';
                }

                // Try to extract year from title
                const yearMatch = title.match(/(20\d{2})/);
                if (yearMatch) {
                    released = yearMatch[1];
                }

                // Generate a basic description based on available info
                let description = `${title} is a ${type.toLowerCase()} series`;
                if (audioType === 'DUB') {
                    description += ' with English dubbing';
                }
                if (episodes) {
                    description += ` with ${episodes.toLowerCase()}`;
                }
                if (genres !== 'General') {
                    description += ` in the ${genres.toLowerCase()} genre${detectedGenres.length > 1 ? 's' : ''}`;
                }
                description += '. More details available on the anime page.';

                if (redirectLink && redirectLink.includes('/anime/')) {
                    animeList.push({
                        index: index + 1,
                        title: title,
                        anime_redirect_link: redirectLink,
                        episodes: episodes,
                        image: imageSrc,
                        audio_type: audioType,
                        type: type,
                        genres: genres,
                        country: country,
                        status: status,
                        released: released,
                        description: description,
                        category: 'general',
                        source: '123animes'
                    });
                }
            }
        });

        // Remove duplicates
        const uniqueAnimeList = animeList.filter((anime, index, self) =>
            index === self.findIndex(a => a.anime_redirect_link === anime.anime_redirect_link)
        );

        console.log(`✅ Found ${uniqueAnimeList.length} unique anime`);
        console.log(`🖼️ Found ${uniqueAnimeList.filter(a => a.image).length} anime with poster images`);

        return uniqueAnimeList;

    } catch (error) {
        console.error('❌ Error scraping film list:', error.message);
        return [];
    }
};