import express from 'express';
import { fetchAndLoad, resolveUrlFactory } from '../service/scraperService.js';
import scrapeRecentlyUpdated from '../scrapeanime/homepage/recently_updated/recentlyUpdated.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const start = Date.now();
  try {
    const url = 'https://123animehub.cc/home';
    const $ = await fetchAndLoad(url);
    const resolveUrl = resolveUrlFactory('https://123animehub.cc');

  const items = await scrapeRecentlyUpdated($, resolveUrl, '123animehub');

    const extraction_time_seconds = parseFloat(((Date.now() - start) / 1000).toFixed(3));
    res.json({ success: true, data: items, extraction_time_seconds });
  } catch (e) {
    res.status(500).json({ success: false, error: String(e), extraction_time_seconds: 0 });
  }
});

export default router;
