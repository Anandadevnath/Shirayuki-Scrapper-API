import express from 'express';
import { scrapeAnimeByLetter } from '../scrapeanime/A-Z/filter.js';

const router = express.Router();

router.get('/:letter', async (req, res) => {
  try {
    const start = Date.now();
    const letter = req.params.letter;
    const page = parseInt(req.query.page) || 1;
    const result = await scrapeAnimeByLetter(letter, page);
    const duration = (Date.now() - start) / 1000;
    const indexedResult = result.map((anime, idx) => ({
      index: idx + 1,
      ...anime
    }));
    res.json({
      success: true,
      data: indexedResult,
      pagination: {
        current_page: page,
        total_found: indexedResult.length,
        has_next_page: indexedResult.length > 0,
        has_previous_page: page > 1,
        next_page: indexedResult.length > 0 ? page + 1 : null,
        previous_page: page > 1 ? page - 1 : null
      },
      extraction_time_seconds: duration,
      message: `Anime list for letter '${letter}' - Page ${page}`,
      timestamp: new Date().toISOString(),
      source_url: `https://123animehub.cc/az-all-anime/${letter}/?page=${page}`
    });
  } catch (error) {
    const duration = (Date.now() - start) / 1000;
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