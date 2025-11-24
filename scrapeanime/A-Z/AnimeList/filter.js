import axios from 'axios';
import * as cheerio from 'cheerio';

async function scrapeAnimeByLetter(letter, page = 1) {
    const url = `https://123anime.la/az-all-anime/${letter}/?page=${page}`;
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
            image = image.startsWith('/') ? 'https://123anime.la' + image : 'https://123anime.la/' + image;
        }
        
        if (!image || image.includes('no_poster.jpg')) {
            image = '';
        }
        
        const episodes = $(el).find('.ep').text().replace('Ep ', '').trim();
        const isDubTitle = /\bDub$/i.test(title.trim());

        const sub = isDubTitle ? false : episodes || false;
        const dub = isDubTitle ? episodes || false : false;

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
