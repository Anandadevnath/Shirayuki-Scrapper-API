import express from 'express';
import fetchUnderratedAnime from '../scrapeanime/homepage/Underrated/underrated.js';

const router = express.Router();

router.get('/', async (req, res) => {
    const data = await fetchUnderratedAnime();
    if (data && typeof data === 'object' && Array.isArray(data.results)) {
        res.json({ results: data.results, extractionTimeSec: data.extractionTimeSec });
    } else {
        res.json({ results: Array.isArray(data) ? data : [], extractionTimeSec: null });
    }
});

export default router;