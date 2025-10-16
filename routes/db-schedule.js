import express from 'express';
import { fetchScheduleFromDB } from '../scrapeanime/Schedule/db-schedule.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const data = await fetchScheduleFromDB();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
