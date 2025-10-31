import axios from 'axios';

async function fetchUnderratedAnime() {
    const url = 'https://kitsu.io/api/edge/anime?page[limit]=20&sort=-averageRating';
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

        const candidates = data.map(item => {
            const attrs = item.attributes || {};
            const title = attrs.canonicalTitle || (attrs.titles && (attrs.titles.en || attrs.titles.en_jp || attrs.titles.ja_jp)) || 'Unknown';
            const image = (attrs.posterImage && (attrs.posterImage.original || attrs.posterImage.large || attrs.posterImage.medium || attrs.posterImage.small)) || '';
            const rawScore = attrs.averageRating ? Number(attrs.averageRating) : null;
            const score = rawScore !== null ? Math.round((rawScore / 10) * 100) / 100 : null;
            const episodes = attrs.episodeCount || null;
            const type = attrs.subtype ? attrs.subtype.toLowerCase() : 'unknown';
            const popularityRank = attrs.popularityRank ?? attrs.popularity ?? null;
            const popRankForMetric = (typeof popularityRank === 'number' && popularityRank > 0) ? popularityRank : 1000;
            const metric = (score || 0) * Math.log10(popRankForMetric + 10);

            return { title, image, score, episodes, type, popularityRank, metric };
        });

        const scoredCandidates = candidates.filter(c => c.score !== null && c.score >= 6.5);

        scoredCandidates.sort((a, b) => (b.metric || 0) - (a.metric || 0));

        const results = [];
        const existingTitles = new Set();
        for (let i = 0; i < scoredCandidates.length && results.length < 5; i++) {
            const c = scoredCandidates[i];
            if (existingTitles.has(c.title.toLowerCase())) continue;
            const available = await checkAvailability(c.title);
            if (available === 'available') {
                results.push({
                    index: results.length + 1,
                    title: c.title,
                    image: c.image,
                    score: c.score,
                    episodes: c.episodes,
                    type: c.type,
                    available
                });
                existingTitles.add(c.title.toLowerCase());
            }
        }

        if (results.length < 5) {
            try {
                const jikanUrl = 'https://api.jikan.moe/v4/anime?order_by=score&sort=desc&limit=100';
                const jikanResp = await axios.get(jikanUrl);
                const jikanData = (jikanResp.data && jikanResp.data.data) || [];

                for (let i = 0; i < jikanData.length && results.length < 5; i++) {
                    const anime = jikanData[i];
                    const title = anime.title || anime.title_english || 'Unknown';
                    if (existingTitles.has(title.toLowerCase())) continue;

                    const score = anime.score || null;
                    const members = anime.members || 0;
                    const metric = (score || 0) * Math.log10((members || 10) + 10);

                    if (score && score >= 6.5 && metric > 20) {
                        const available = await checkAvailability(title);
                        if (available === 'available') {
                            const image = anime.images?.jpg?.image_url || anime.images?.webp?.image_url || '';
                            const episodes = anime.episodes || null;
                            const type = anime.title_english ? 'sub' : 'original';
                            results.push({ index: results.length + 1, title, image, score, episodes, type, available });
                            existingTitles.add(title.toLowerCase());
                        }
                    }
                }
            } catch (e) {
                console.warn('Jikan fallback failed:', e && e.message ? e.message : e);
            }
        }

        return results.slice(0, 5).map((a, i) => ({ ...a, index: i + 1 }));
    } catch (error) {
        console.error('Error fetching underrated anime:', error && error.message ? error.message : error);
        return [];
    }
}

export default fetchUnderratedAnime;
