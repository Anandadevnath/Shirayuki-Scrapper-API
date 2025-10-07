import express from 'express';
import { scrapeHiAnimeWeeklyTop10 } from '../scrapeanime/Leaderboard/Weekly/scrapeHiAnimeWeeklyTop10.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const start = Date.now();
    console.log('📅 Starting HiAnime Weekly Top 10 scraping...');
    
    const result = await scrapeHiAnimeWeeklyTop10();
    const duration = (Date.now() - start) / 1000;

    console.log(`✅ Weekly Top 10 scraping completed in ${duration}s`);

    res.json({
      success: true,
      data: result,
      extraction_time_seconds: duration,
      message: "Top 10 weekly viewed anime from HiAnime",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = (Date.now() - start) / 1000;
    console.error('❌ Error scraping weekly top 10:', error.message);
    
    res.status(500).json({ 
      success: false, 
      error: error.message,
      extraction_time_seconds: duration,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;