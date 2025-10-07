import express from 'express';
import { scrapeHiAnimeTop10 } from '../scrapeanime/Leaderboard/Top/scrapeHiAnimeTop10.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const start = Date.now();
    console.log('🔥 Starting HiAnime Top 10 scraping...');
    
    const result = await scrapeHiAnimeTop10();
    const duration = (Date.now() - start) / 1000;

    console.log(`✅ Top 10 scraping completed in ${duration}s`);

    res.json({
      success: true,
      data: result,
      extraction_time_seconds: duration,
      message: "Top 10 trending anime from HiAnime",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = (Date.now() - start) / 1000;
    console.error('❌ Error scraping top 10:', error.message);
    
    res.status(500).json({ 
      success: false, 
      error: error.message,
      extraction_time_seconds: duration,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;