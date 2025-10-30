// Endpoint to serve 5 underrated anime
import express from 'express';
import fetchUnderratedAnime from '../scrapeanime/homepage/Underrated/underrated.js';

const router = express.Router();

router.get('/', async (req, res) => {
    const animes = await fetchUnderratedAnime();
    res.json(animes);
});

export default router;