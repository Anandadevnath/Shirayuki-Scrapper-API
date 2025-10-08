import axios from 'axios';
import * as cheerio from 'cheerio';


function formatStatus(statusText) {
    if (!statusText) return null;

    const lowerStatus = statusText.toLowerCase();

    if (lowerStatus.includes('airing') || lowerStatus.includes('ongoing') || lowerStatus.includes('releasing')) {
        return 'airing';
    } else if (lowerStatus.includes('completed') || lowerStatus.includes('finished') || lowerStatus.includes('ended')) {
        return 'completed';
    }

    return null;
}

function formatCalendarDate(calendarText) {
    if (!calendarText) return null;

    const cleanText = calendarText.trim();

    const datePatterns = [
        /(\d{4})/,
        /(\d{1,2}\/\d{1,2}\/\d{4})/,
        /(\d{4}-\d{1,2}-\d{1,2})/,
        /(\d{1,2}-\d{1,2}-\d{4})/,
        /(\d{1,2}\.\d{1,2}\.\d{4})/,
    ];

    for (const pattern of datePatterns) {
        const match = cleanText.match(pattern);
        if (match) {
            return match[1];
        }
    }

    return null;
}

export async function scrapeSearchSuggestions(query) {
    const url = `https://123animehub.cc/search?keyword=${encodeURIComponent(query)}`;
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const suggestions = [];

    $('.suggestions .item, .film-list .item').each((i, el) => {
        const title = $(el).find('.name, a[data-jtitle]').first().text().trim() ||
            $(el).find('a[data-jtitle]').attr('data-jtitle') || '';

        // Extract image with multiple selectors and attributes
        const imgElement = $(el).find('.film-poster img, .poster img, img').first();
        let image = imgElement.attr('data-src') || 
                   imgElement.attr('src') || 
                   imgElement.attr('data-lazy') || '';
        
        // Convert relative URLs to absolute URLs
        if (image && !image.startsWith('http')) {
            image = image.startsWith('/') ? 'https://123animehub.cc' + image : 'https://123animehub.cc/' + image;
        }
        
        // Default to empty string if no valid image found
        if (!image || image.includes('no_poster.jpg')) {
            image = '';
        }

        // Extract episode info
        const episodeText = $(el).find('.fa-tv').parent().text().trim() ||
            $(el).find('[class*="ep"]').text().trim() || '';
        const episode = episodeText.replace(/[^\d]/g, '') || '';

        // Extract calendar date 
        const calendarText = $(el).find('.fa-calendar').parent().text().trim() ||
            $(el).find('[class*="year"], [class*="date"]').text().trim() || '';
        const calendar_date = formatCalendarDate(calendarText);

        // Extract status
        const statusText = $(el).find('.dot').parent().text().trim() ||
            $(el).find('[class*="status"]').text().trim() || '';

        // Apply status formatting using the dedicated formatting function
        const status = formatStatus(statusText);

        // Extract sub/dub type from the original status text
        const type = statusText.toLowerCase().includes('sub') ? 'sub' :
            statusText.toLowerCase().includes('dub') ? 'dub' : null;

        if (title) {
            suggestions.push({
                index: i + 1,
                title,
                image,
                episode,
                calendar_date,
                status,
                type
            });
        }
    });

    return suggestions;
}
