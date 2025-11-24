import express from 'express';
import { scrapeAnimeByGenre } from '../scrapeanime/A-Z/Genre/genre.js';

const router = express.Router();

router.get('/:genre', async (req, res) => {
  try {
    const start = Date.now();
    const genre = req.params.genre;
    const page = parseInt(req.query.page) || 1;
    const axios = (await import('axios')).default;
    const cheerio = await import('cheerio');
    const url = `https://123anime.la/genere/${genre}?page=${page}`;
    let total_counts = null;
    try {
      const { data: html } = await axios.get(url);
      const $ = cheerio.load(html);
      const totalText = $('.paging-wrapper .total').first().text().replace(/[^\d]/g, '');
      if (totalText) total_counts = parseInt(totalText, 10);
    } catch (e) {
      total_counts = null;
    }

    const result = await scrapeAnimeByGenre(genre, page);
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
        total_counts: total_counts,
        has_next_page: indexedResult.length > 0,
        has_previous_page: page > 1,
        next_page: indexedResult.length > 0 ? page + 1 : null,
        previous_page: page > 1 ? page - 1 : null
      },
      extraction_time_seconds: duration,
      message: `Anime list for genre '${genre}' - Page ${page}`,
      timestamp: new Date().toISOString(),
      source_url: url
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
        total_counts: 0,
        has_next_page: false,
        has_previous_page: false,
        next_page: null,
        previous_page: null
      }
    });
  }
});

export default router;