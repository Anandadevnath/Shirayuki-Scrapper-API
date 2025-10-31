import axios from 'axios';

async function fetchOverratedAnime() {
    const url = 'https://kitsu.io/api/edge/anime?page[limit]=10&sort=-averageRating';
    try {
        const response = await axios.get(url, { headers: { 'Accept': 'application/vnd.api+json' } });
        const data = response.data.data || [];

        const checkAvailability = async (title) => {
            try {
                const searchUrl = `https://123animehub.cc/search?keyword=${encodeURIComponent(title)}`;
                const res = await axios.get(searchUrl);
                return res.data.toLowerCase().includes(title.toLowerCase()) ? 'available' : 'not available';
            } catch {
                return 'not available';
            }
        };

        const results = [];
        for (let idx = 0; idx < data.length; idx++) {
            const item = data[idx];
            const attrs = item.attributes || {};
            const title = attrs.canonicalTitle || (attrs.titles && (attrs.titles.en || attrs.titles.en_jp || attrs.titles.ja_jp)) || 'Unknown';
            const image = (attrs.posterImage && (attrs.posterImage.original || attrs.posterImage.large || attrs.posterImage.medium || attrs.posterImage.small)) || '';
            const rawScore = attrs.averageRating ? Number(attrs.averageRating) : null; 
            const score = rawScore !== null ? Math.round((rawScore / 10) * 100) / 100 : null; 
            const episodes = attrs.episodeCount || null;
            const type = attrs.subtype ? attrs.subtype.toLowerCase() : 'unknown';

            const available = await checkAvailability(title);

            results.push({
                index: idx + 1,
                title,
                image,
                score,
                episodes,
                type,
                available
            });
        }

        let availableResults = results
            .filter(anime => anime.available === 'available')
            .map((a, i) => ({ ...a, index: i + 1 }));

        if (availableResults.length <= 5) {
            try {
                const jikanUrl = 'https://api.jikan.moe/v4/anime?order_by=score&sort=desc&limit=25';
                const jikanResp = await axios.get(jikanUrl);
                const jikanData = (jikanResp.data && jikanResp.data.data) || [];

                const existingTitles = new Set(availableResults.map(a => a.title.toLowerCase()));

                for (let i = 0; i < jikanData.length && availableResults.length < 5; i++) {
                    const anime = jikanData[i];
                    const title = anime.title || anime.title_english || 'Unknown';
                    if (existingTitles.has(title.toLowerCase())) continue;

                    const available = await checkAvailability(title);
                    if (available === 'available') {
                        const image = anime.images?.jpg?.image_url || anime.images?.webp?.image_url || '';
                        const score = anime.score || null;
                        const episodes = anime.episodes || null;
                        const type = anime.title_english ? 'sub' : 'original';

                        availableResults.push({
                            index: availableResults.length + 1,
                            title,
                            image,
                            score,
                            episodes,
                            type,
                            available
                        });
                        existingTitles.add(title.toLowerCase());
                    }
                }
            } catch (e) {
                console.warn('Jikan fallback failed:', e && e.message ? e.message : e);
            }
        }

    availableResults = availableResults.slice(0, 5).map((a, i) => ({ ...a, index: i + 1 }));
    return availableResults;
    } catch (error) {
        console.error('Error fetching overrated anime:', error);
        return [];
    }
}

export default fetchOverratedAnime;
