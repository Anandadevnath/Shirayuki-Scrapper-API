// Endpoint to serve 5 overrated anime
import express from 'express';
import fetchOverratedAnime from '../scrapeanime/homepage/Overrated/overrated.js';

const router = express.Router();

router.get('/', async (req, res) => {
    const animes = await fetchOverratedAnime();
    res.json(animes);
});

export default router;
