import axios from 'axios';

async function fetchUnderratedAnime() {
    const url = 'https://api.jikan.moe/v4/anime?order_by=score&sort=desc&limit=25';
    try {
        const response = await axios.get(url);
        const filtered = response.data.data.filter(anime => anime.popularity > 1000 && anime.score > 7.5);
        return filtered.slice(0, 5).map((anime, idx) => ({
            index: idx + 1,
            title: anime.title,
            image: anime.images?.jpg?.image_url || anime.images?.webp?.image_url || '',
            score: anime.score,
            episodes: anime.episodes,
            type: anime.title_english ? 'sub' : 'original',
        }));
    } catch (error) {
        console.error('Error fetching underrated anime:', error);
        return [];
    }
}

export default fetchUnderratedAnime;
