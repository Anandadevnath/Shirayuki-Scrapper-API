import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Scrape anime list by genre from 123animehub.cc
 * @param {string} genre - The genre name (e.g., Action, Comedy)
 * @param {number} page - The page number (default 1)
 * @returns {Promise<Array>} List of anime objects
 */
export async function scrapeAnimeByGenre(genre, page = 1) {
	const url = `https://123animehub.cc/genere/${genre}?page=${page}`;
	const { data } = await axios.get(url);
	const $ = cheerio.load(data);
	const animeList = [];

	$('.film-list .item').each((i, el) => {
		const title = $(el).find('.name').text().trim();
		let image = $(el).find('.poster img').attr('src');
		if (image && !image.startsWith('http')) {
			image = 'https://123animehub.cc' + image;
		}
		const sub = $(el).find('.status .sub').length > 0;
		const dub = $(el).find('.status .dub').length > 0;
		const episodes = $(el).find('.ep').text().replace('Ep ', '').trim();

		animeList.push({
			index: i + 1,
			title,
			image,
			sub,
			dub,
			episodes
		});
	});

	return animeList;
}
