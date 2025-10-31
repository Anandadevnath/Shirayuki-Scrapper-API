// Endpoint to serve 5 overrated anime
import express from 'express';
import fetchOverratedAnime from '../scrapeanime/homepage/Overrated/overrated.js';

const router = express.Router();

router.get('/', async (req, res) => {
    const data = await fetchOverratedAnime();
    if (data && typeof data === 'object' && Array.isArray(data.results)) {
        res.json({ results: data.results, extractionTimeSec: data.extractionTimeSec });
    } else {
        res.json({ results: Array.isArray(data) ? data : [], extractionTimeSec: null });
    }
});

export default router;
