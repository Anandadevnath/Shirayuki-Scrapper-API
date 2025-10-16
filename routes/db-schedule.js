import express from 'express';
import { fetchScheduleFromDB } from '../scrapeanime/Schedule/db-schedule.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const data = await fetchScheduleFromDB();
    const dayCounters = {};
    const cleaned = data.map(item => {
      if (!dayCounters[item.day]) dayCounters[item.day] = 1;
      const id = dayCounters[item.day];
      dayCounters[item.day]++;
      return {
        id,
        day: item.day,
        anime: item.anime,
        time: item.time
      };
    });
    res.json({ success: true, data: cleaned });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
