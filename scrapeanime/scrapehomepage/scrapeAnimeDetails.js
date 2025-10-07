import { fetchAndLoad } from '../../service/scraperService.js';

/**
 * Scrapes detailed anime information from an individual anime page
 * @param {string} animeUrl - The URL of the anime detail page
 * @returns {Object} - Object containing detailed anime information
 */
export async function scrapeAnimeDetails(animeUrl) {
  if (!animeUrl) return null;

  try {
    const $ = await fetchAndLoad(animeUrl);
    
    const details = {
      description: null,
      synonyms: null,
      aired: null,
      premiered: null,
      duration: null,
      status: null,
      malScore: null,
      genres: [],
      studios: [],
      producers: []
    };

    // Extract details from the anime info section
    $('.anisc-info .item').each((i, item) => {
      const $item = $(item);
      const label = $item.find('.item-head').text().trim().toLowerCase();
      const content = $item.find('.name, .text').text().trim();

      switch (label) {
        case 'synonyms:':
        case 'japanese:':
          if (content && content !== 'N/A') {
            details.synonyms = content;
          }
          break;
        case 'aired:':
          if (content && content !== 'N/A') {
            details.aired = content;
          }
          break;
        case 'premiered:':
          if (content && content !== 'N/A') {
            details.premiered = content;
          }
          break;
        case 'duration:':
          if (content && content !== 'N/A') {
            details.duration = content;
          }
          break;
        case 'status:':
          if (content && content !== 'N/A') {
            details.status = content;
          }
          break;
        case 'mal score:':
        case 'score:':
          if (content && content !== 'N/A' && !isNaN(parseFloat(content))) {
            details.malScore = parseFloat(content);
          }
          break;
        case 'genres:':
          $item.find('a').each((j, genreLink) => {
            const genre = $(genreLink).text().trim();
            if (genre) details.genres.push(genre);
          });
          break;
        case 'studios:':
          $item.find('a').each((j, studioLink) => {
            const studio = $(studioLink).text().trim();
            if (studio) details.studios.push(studio);
          });
          break;
        case 'producers:':
          $item.find('a').each((j, producerLink) => {
            const producer = $(producerLink).text().trim();
            if (producer) details.producers.push(producer);
          });
          break;
      }
    });

    // Extract description/synopsis
    const descriptionSelectors = [
      '.film-description .text',
      '.anisc-detail .film-description .text',
      '.anime-synopsis .text',
      '.description .text',
      '.overview .text',
      '[data-content="description"]',
      '.anisc-info .item .text'
    ];

    for (const selector of descriptionSelectors) {
      const descElement = $(selector);
      if (descElement.length && descElement.text().trim()) {
        let desc = descElement.text().trim();
        // Clean up common unwanted text
        desc = desc.replace(/^(Description|Synopsis|Overview):\s*/i, '');
        if (desc && desc.length > 50) { // Only use if it's substantial content
          details.description = desc;
          break;
        }
      }
    }

    // Alternative selectors if the above doesn't work
    if (!details.malScore) {
      const scoreText = $('.film-stats .tick .tick-pg, .score').text();
      const scoreMatch = scoreText.match(/(\d+\.?\d*)/);
      if (scoreMatch) {
        details.malScore = parseFloat(scoreMatch[1]);
      }
    }

    // Try alternative genre extraction
    if (details.genres.length === 0) {
      $('.film-stats .item .name a, .genres a').each((i, genreEl) => {
        const genre = $(genreEl).text().trim();
        if (genre && !details.genres.includes(genre)) {
          details.genres.push(genre);
        }
      });
    }

    return details;
  } catch (error) {
    console.error(`Error scraping anime details from ${animeUrl}:`, error.message);
    return null;
  }
}

export default { scrapeAnimeDetails };