import express from 'express';
import { scrapeFilmList } from '../scrapeanime/A-Z/all.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const start = Date.now();
    const page = parseInt(req.query.page) || 1;
    
    console.log(`📚 Starting anime list scraping for page ${page}...`);
    
    // Build URL with pagination
    let baseUrl = 'https://w1.123animes.ru/az-all-anime/all/';
    if (page > 1) {
      baseUrl += `?page=${page}`;
    }
    
    console.log(`🌐 Scraping URL: ${baseUrl}`);
    
    const result = await scrapeFilmList(baseUrl);
    const duration = (Date.now() - start) / 1000;

    console.log(`✅ Anime list scraping completed in ${duration}s`);
    console.log(`📊 Found ${result.length} anime for page ${page}`);

    // Calculate pagination info
    const totalFound = result.length;
    const hasNextPage = totalFound > 0; // If we found anime, there might be more
    const hasPrevPage = page > 1;

    res.json({
      success: true,
      data: result,
      pagination: {
        current_page: page,
        total_found: totalFound,
        has_next_page: hasNextPage,
        has_previous_page: hasPrevPage,
        next_page: hasNextPage ? page + 1 : null,
        previous_page: hasPrevPage ? page - 1 : null
      },
      extraction_time_seconds: duration,
      message: `Anime list from 123animes.ru - Page ${page}`,
      timestamp: new Date().toISOString(),
      source_url: baseUrl
    });

  } catch (error) {
    const duration = (Date.now() - start) / 1000;
    console.error('❌ Error scraping anime list:', error.message);
    
    res.status(500).json({ 
      success: false, 
      error: error.message,
      extraction_time_seconds: duration,
      timestamp: new Date().toISOString(),
      pagination: {
        current_page: parseInt(req.query.page) || 1,
        total_found: 0,
        has_next_page: false,
        has_previous_page: false,
        next_page: null,
        previous_page: null
      }
    });
  }
});

export default router;