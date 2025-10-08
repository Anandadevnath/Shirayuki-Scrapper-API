import axios from 'axios';
import * as cheerio from 'cheerio';

async function scrapeAnimeByLetter(letter, page = 1) {
    const url = `https://123animehub.cc/az-all-anime/${letter}/?page=${page}`;
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
            title,
            image,
            sub,
            dub,
            episodes
        });
    });

    return animeList;
}


export { scrapeAnimeByLetter };

