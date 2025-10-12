import axios from 'axios';
import * as cheerio from 'cheerio';


export async function scrapeAnimeByGenre(genre, page = 1) {
	const url = `https://123animehub.cc/genere/${genre}?page=${page}`;
	const { data } = await axios.get(url);
	const $ = cheerio.load(data);
	const animeList = [];

	$('.film-list .item').each((i, el) => {
		const title = $(el).find('.name').text().trim();
		
		const imgElement = $(el).find('.film-poster img, .poster img, img').first();
		let image = imgElement.attr('data-src') || 
				   imgElement.attr('src') || 
				   imgElement.attr('data-lazy') || '';
		
		if (image && !image.startsWith('http')) {
			image = image.startsWith('/') ? 'https://123animehub.cc' + image : 'https://123animehub.cc/' + image;
		}
		
		if (!image || image.includes('no_poster.jpg')) {
			image = '';
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
