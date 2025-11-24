import axios from 'axios';
import cacheFactory from '../../../service/simpleCache.js';

async function fetchOverratedAnime() {
    const url = 'https://kitsu.io/api/edge/anime?page[limit]=12&sort=-averageRating';
    const axiosInstance = axios.create({
        timeout: 1500,
        headers: { 'Accept': 'application/vnd.api+json', 'User-Agent': 'Mozilla/5.0 (compatible; ShirayukiScraper/1.0)'}
    });
    const availabilityCache = cacheFactory.createNamespace('availability', 10 * 60 * 1000); // 10 minutes
    let startTime = Date.now();
    try {
        const response = await axiosInstance.get(url);
        const data = response.data.data || [];

        const checkAvailability = async (title) => {
            const key = `availability:${(title || '').toLowerCase()}`;
            const cached = availabilityCache.get(key);
            if (cached) return cached;
            try {
                const searchUrl = `https://123anime.la/search?keyword=${encodeURIComponent(title)}`;
                const res = await axiosInstance.get(searchUrl);
                const available = typeof res.data === 'string' && res.data.toLowerCase().includes(title.toLowerCase()) ? 'available' : 'not available';
                availabilityCache.set(key, available, 10 * 60 * 1000);
                return available;
            } catch {
                availabilityCache.set(key, 'not available', 60 * 1000);
                return 'not available';
            }
        };

        const items = data.map((item, idx) => {
            const attrs = item.attributes || {};
            const title = attrs.canonicalTitle || (attrs.titles && (attrs.titles.en || attrs.titles.en_jp || attrs.titles.ja_jp)) || 'Unknown';
            const image = (attrs.posterImage && (attrs.posterImage.original || attrs.posterImage.large || attrs.posterImage.medium || attrs.posterImage.small)) || '';
            const rawScore = attrs.averageRating ? Number(attrs.averageRating) : null;
            const score = rawScore !== null ? Math.round((rawScore / 10) * 100) / 100 : null;
            const episodes = attrs.episodeCount || null;
            const type = attrs.subtype ? attrs.subtype.toLowerCase() : 'unknown';
            return { index: idx + 1, title, image, score, episodes, type };
        });

        const batchSize = 3;
        let availableResults = [];
        for (let start = 0; start < items.length && availableResults.length < 5; start += batchSize) {
            const batch = items.slice(start, start + batchSize);
            const batchPromises = batch.map(it => checkAvailability(it.title));
            const batchResults = await Promise.all(batchPromises);
            batch.forEach((it, idx) => {
                it.available = batchResults[idx];
                if (it.available === 'available' && availableResults.length < 5) {
                    availableResults.push({ ...it, index: availableResults.length + 1 });
                }
            });
        }

    if (availableResults.length < 5) {
            try {
                const jikanUrl = 'https://api.jikan.moe/v4/anime?order_by=score&sort=desc&limit=25';
                const jikanResp = await axiosInstance.get(jikanUrl);
                const jikanData = (jikanResp.data && jikanResp.data.data) || [];

                const existingTitles = new Set(availableResults.map(a => a.title.toLowerCase()));

                const jikanCandidates = jikanData.slice(0, 8).map(anime => {
                    const title = anime.title || anime.title_english || 'Unknown';
                    const image = anime.images?.jpg?.image_url || anime.images?.webp?.image_url || '';
                    const score = anime.score || null;
                    const episodes = anime.episodes || null;
                    const type = anime.title_english ? 'sub' : 'original';
                    return { title, image, score, episodes, type };
                });

                for (let start = 0; start < jikanCandidates.length && availableResults.length < 5; start += batchSize) {
                    const batch = jikanCandidates.slice(start, start + batchSize);
                    const batchPromises = batch.map(c => checkAvailability(c.title));
                    const batchResults = await Promise.all(batchPromises);
                    for (let i = 0; i < batch.length && availableResults.length < 5; i++) {
                        const c = batch[i];
                        const titleLower = (c.title || '').toLowerCase();
                        if (existingTitles.has(titleLower)) continue;
                        if (batchResults[i] === 'available') {
                            availableResults.push({
                                index: availableResults.length + 1,
                                title: c.title,
                                image: c.image,
                                score: c.score,
                                episodes: c.episodes,
                                type: c.type,
                                available: 'available'
                            });
                            existingTitles.add(titleLower);
                        }
                    }
                }
            } catch (e) {
                console.warn('Jikan fallback failed:', e && e.message ? e.message : e);
            }
        }

        availableResults = availableResults.slice(0, 5).map((a, i) => ({ ...a, index: i + 1 }));
        const elapsed = (Date.now() - startTime) / 1000;
        return { results: availableResults, extractionTimeSec: Number(elapsed.toFixed(2)) };
    } catch (error) {
        const elapsed = (Date.now() - startTime) / 1000;
        console.error('Error fetching overrated anime:', error && error.message ? error.message : error);
        return { results: [], extractionTimeSec: Number(elapsed.toFixed(2)) };
    }
}

export default fetchOverratedAnime;
