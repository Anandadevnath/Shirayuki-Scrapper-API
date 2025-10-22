import express from 'express';
import { getHomepageCached } from '../scrapeanime/homepage/scrapeservice.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const start = Date.now();
    const includeDetails = req.query.details === '1' || req.query.details === 'true';
    const fresh = req.query.fresh === '1' || req.query.fresh === 'true';

    const { value: result, lastUpdated, rateLimited, error } = await getHomepageCached(includeDetails, fresh);
    const duration = (Date.now() - start) / 1000;

    const meta = {
      cache: {
        last_updated: lastUpdated || null,
        age_ms: lastUpdated ? (Date.now() - lastUpdated) : null,
        include_details: includeDetails,
        rate_limited: !!rateLimited
      }
    };

    if (error) {
      res.status(502).json({ success: false, error: String(error), extraction_time_seconds: duration, ...meta });
      return;
    }

    res.json({ success: true, data: result.data, extraction_time_seconds: duration, ...meta });
  } catch (err) {
    const duration = (Date.now() - (req._startTime || Date.now())) / 1000;
    res.status(500).json({ success: false, error: err.message, extraction_time_seconds: duration });
  }
});

export default router;
