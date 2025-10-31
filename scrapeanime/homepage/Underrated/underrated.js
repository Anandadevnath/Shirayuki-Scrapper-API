import axios from 'axios';

async function fetchUnderratedAnime() {
    const url = 'https://kitsu.io/api/edge/anime?page[limit]=20&sort=-averageRating';
    const axiosInstance = axios.create({
        timeout: 3500,
        headers: { 'Accept': 'application/vnd.api+json', 'User-Agent': 'Mozilla/5.0 (compatible; ShirayukiScraper/1.0)'}
    });
    let startTime = Date.now();
    try {
        const response = await axiosInstance.get(url);
        const data = response.data.data || [];

        const checkAvailability = async (title) => {
            try {
                const searchUrl = `https://123animehub.cc/search?keyword=${encodeURIComponent(title)}`;
                const res = await axiosInstance.get(searchUrl);
                return typeof res.data === 'string' && res.data.toLowerCase().includes(title.toLowerCase()) ? 'available' : 'not available';
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
        const availabilityPromises = scoredCandidates.map(c => checkAvailability(c.title));
        const availabilityResults = await Promise.all(availabilityPromises);

        for (let i = 0; i < scoredCandidates.length && results.length < 5; i++) {
            const c = scoredCandidates[i];
            if (existingTitles.has(c.title.toLowerCase())) continue;
            const available = availabilityResults[i];
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
                const jikanResp = await axiosInstance.get(jikanUrl);
                const jikanData = (jikanResp.data && jikanResp.data.data) || [];

                const jikanCandidates = jikanData.map(anime => {
                    const title = anime.title || anime.title_english || 'Unknown';
                    const score = anime.score || null;
                    const members = anime.members || 0;
                    const metric = (score || 0) * Math.log10((members || 10) + 10);
                    const image = anime.images?.jpg?.image_url || anime.images?.webp?.image_url || '';
                    const episodes = anime.episodes || null;
                    const type = anime.title_english ? 'sub' : 'original';
                    return { title, score, metric, image, episodes, type };
                }).filter(a => a.score && a.score >= 6.5 && a.metric > 20);

                const jikanAvailPromises = jikanCandidates.map(c => checkAvailability(c.title));
                const jikanAvailResults = await Promise.all(jikanAvailPromises);

                for (let i = 0; i < jikanCandidates.length && results.length < 5; i++) {
                    const c = jikanCandidates[i];
                    const title = c.title || 'Unknown';
                    if (existingTitles.has(title.toLowerCase())) continue;
                    if (jikanAvailResults[i] === 'available') {
                        results.push({ index: results.length + 1, title, image: c.image, score: c.score, episodes: c.episodes, type: c.type, available: 'available' });
                        existingTitles.add(title.toLowerCase());
                    }
                }
            } catch (e) {
                console.warn('Jikan fallback failed:', e && e.message ? e.message : e);
            }
        }

        const finalResults = results.slice(0, 5).map((a, i) => ({ ...a, index: i + 1 }));
        const elapsed = (Date.now() - startTime) / 1000;
        return { results: finalResults, extractionTimeSec: Number(elapsed.toFixed(2)) };
    } catch (error) {
        const elapsed = (Date.now() - startTime) / 1000;
        console.error('Error fetching underrated anime:', error && error.message ? error.message : error);
        return { results: [], extractionTimeSec: Number(elapsed.toFixed(2)) };
    }
}

export default fetchUnderratedAnime;
