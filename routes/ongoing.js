import express from 'express';
import scrapeOnging from '../scrapeanime/homepage/Ongoing/ongoing.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await scrapeOnging();
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, error: String(e) });
  }
});

export default router;
