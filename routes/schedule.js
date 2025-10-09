import express from 'express';
import scrapeSchedule from '../scrapeanime/Schedule/schedule.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const start = Date.now();
  try {
    const schedule = await scrapeSchedule();
    const duration = (Date.now() - start) / 1000;
    res.json({
      success: true,
      data: schedule,
      extraction_time_seconds: duration,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      extraction_time_seconds: (Date.now() - start) / 1000
    });
  }
});

export default router;