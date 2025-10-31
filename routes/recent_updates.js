import express from 'express';
import { fetchAndLoad, resolveUrlFactory } from '../service/scraperService.js';
import scrapeRecentlyUpdated from '../scrapeanime/homepage/recently_updated/recentlyUpdated.js';
import scrapeRecentlyUpdatedDub from '../scrapeanime/homepage/recently_updated/recentlyUpdated_dub.js';
import simpleCache from '../service/simpleCache.js';

const router = express.Router();

function deduplicate(items) {
  const seen = new Set();
  return items.filter(it => {
    const key = ((it.href || '') + '::' + (it.title || '')).toLowerCase();
    if (!it.title && !it.href) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

router.get('/', async (req, res) => {
  const start = Date.now();
  try {
    const cacheNs = simpleCache.createNamespace('routes');
    const cacheKey = 'recent_updates_v1';
    // If cached within TTL, return cached payload
    const cached = cacheNs.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    const url = 'https://123animehub.cc/home';
    const $ = await fetchAndLoad(url);
    const resolveUrl = resolveUrlFactory('https://123animehub.cc');

    // Fetch both sub and dub
    const [subItems, dubItems] = await Promise.all([
      scrapeRecentlyUpdated($, resolveUrl, '123animehub'),
      scrapeRecentlyUpdatedDub($, resolveUrl, '123animehub')
    ]);

    // Merge and deduplicate
    let combined = deduplicate([...subItems, ...dubItems]);

    // Add index number to each item
    combined = combined.map((item, idx) => ({ index: idx + 1, ...item }));

    const extraction_time_seconds = parseFloat(((Date.now() - start) / 1000).toFixed(3));
    const payload = { success: true, data: combined, extraction_time_seconds };

    // Cache the response for 5 minutes to avoid frequent scrapes (reduces 429s)
    cacheNs.set(cacheKey, payload, 5 * 60 * 1000);

    res.json(payload);
  } catch (e) {
    res.status(500).json({ success: false, error: String(e), extraction_time_seconds: 0 });
  }
});

export default router;
