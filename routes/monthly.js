import express from 'express';
import { scrapeHiAnimeMonthlyTop10 } from '../scrapeanime/Leaderboard/Monthly/scrapeHiAnimeMonthlyTop10.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const start = Date.now();
    console.log('📅 Starting HiAnime Monthly Top 10 scraping...');
    
    const result = await scrapeHiAnimeMonthlyTop10();
    const duration = (Date.now() - start) / 1000;

    console.log(`✅ Monthly Top 10 scraping completed in ${duration}s`);

    res.json({
      success: true,
      data: result,
      extraction_time_seconds: duration,
      message: "Top 10 monthly viewed anime from HiAnime",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = (Date.now() - start) / 1000;
    console.error('❌ Error scraping monthly top 10:', error.message);
    
    res.status(500).json({ 
      success: false, 
      error: error.message,
      extraction_time_seconds: duration,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;