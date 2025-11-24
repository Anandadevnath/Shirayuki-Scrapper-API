import axios from 'axios';
import * as cheerio from 'cheerio';

export async function scrapeSearchSuggestions(query) {
    const url = `https://123anime.la/search?keyword=${encodeURIComponent(query)}`;
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const suggestions = [];

    $('.suggestions .item, .film-list .item').each((i, el) => {
        const title = $(el).find('.name, a[data-jtitle]').first().text().trim() ||
            $(el).find('a[data-jtitle]').attr('data-jtitle') || '';

        // Extract image 
        const imgElement = $(el).find('.film-poster img, .poster img, img').first();
        let image = imgElement.attr('data-src') ||
            imgElement.attr('src') ||
            imgElement.attr('data-lazy') || '';

        if (image && !image.startsWith('http')) {
            image = image.startsWith('/') ? 'https://123anime.la' + image : 'https://123anime.la/' + image;
        }

        if (!image || image.includes('no_poster.jpg')) {
            image = '';
        }

        // Extract episode 
        const episodeText = $(el).find('.fa-tv').parent().text().trim() ||
            $(el).find('[class*="ep"]').text().trim() || '';
        const episode = episodeText.replace(/[^\d]/g, '') || '';

        // Extract sub/dub 
        const isSubbed = $(el).find('.sub').length > 0;
        const isDubbed = $(el).find('.dub').length > 0;
        const type = isDubbed ? 'dub' : (isSubbed ? 'sub' : 'sub');

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
        if (title) {
            suggestions.push({
                index: i + 1,
                title,
                japanese_title,
                image,
                episode,
                type
            });
        }
    });

    return suggestions;
}
