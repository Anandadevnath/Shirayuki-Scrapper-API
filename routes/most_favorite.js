import express from 'express';
import { scrapeMostFavoriteAcrossSites } from '../scrapeanime/homepage/scrapeservice.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const includeDetails = req.query.details === '1' || req.query.details === 'true';
    const start = Date.now();
    const { data, errors } = await scrapeMostFavoriteAcrossSites(includeDetails);
    const duration = (Date.now() - start) / 1000;
    const meta = { extraction_time_seconds: duration };
    if (errors && errors.length) meta.errors = errors;
    res.json({ success: true, data: data || [], ...meta });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

export default router;
