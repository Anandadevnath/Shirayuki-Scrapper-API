import express from 'express';
import { scrapeSearchSuggestions } from '../scrapeanime/Browse/Suggestion/suggestion.js';
import { scrapeAnimeSearch } from '../scrapeanime/Browse/Search/search.js';

const router = express.Router();

// GET /search?keyword=one%20piece
router.get('/', async (req, res) => {
  const start = Date.now();
  try {
    const keyword = req.query.keyword || '';
    
    if (!keyword) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "keyword" is required'
      });
    }

    const result = await scrapeAnimeSearch(keyword);
    const duration = (Date.now() - start) / 1000;
    
    res.json({
      success: true,
      total_results: result.length,
      data: result,
      extraction_time_seconds: duration,
      message: `Search results for "${keyword}"`,
      timestamp: new Date().toISOString(),
      source_url: `https://123anime.la/search?keyword=${encodeURIComponent(keyword)}`
    });
  } catch (error) {
    const duration = (Date.now() - start) / 1000;
    res.status(500).json({
      success: false,
      error: error.message,
      extraction_time_seconds: duration,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /search/suggestions?q=demon%20slayer
router.get('/suggestions', async (req, res) => {
  const start = Date.now();
  try {
    const query = req.query.q || req.query.query || '';
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required'
      });
    }

    const result = await scrapeSearchSuggestions(query);
    const duration = (Date.now() - start) / 1000;
    
    res.json({
      success: true,
      total_suggestions: result.length,
      data: result,
      extraction_time_seconds: duration,
      message: `Search suggestions for "${query}"`,
      timestamp: new Date().toISOString(),
      source_url: `https://123anime.la/search?keyword=${encodeURIComponent(query)}`
    });
  } catch (error) {
    const duration = (Date.now() - start) / 1000;
    res.status(500).json({
      success: false,
      error: error.message,
      extraction_time_seconds: duration,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;