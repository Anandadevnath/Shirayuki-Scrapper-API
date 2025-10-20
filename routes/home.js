import express from 'express';
import scrapeHomepage from '../scrapeanime/homepage/scrapehomepage.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const start = Date.now();
    const result = await scrapeHomepage(true); 
    const duration = (Date.now() - start) / 1000;

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        extraction_time_seconds: duration,
      });
    } else {
      res.status(502).json({
        success: false,
        error: result.error || 'Unknown error',
        extraction_time_seconds: duration,
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
