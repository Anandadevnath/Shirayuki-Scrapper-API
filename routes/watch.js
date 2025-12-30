import express from 'express';
import axios from 'axios';
import { load } from 'cheerio';
import simpleCache from '../service/simpleCache.js';

const router = express.Router();
const watchCache = simpleCache.createNamespace('watch', 1000 * 60 * 30);

// Base URLs
const ANIME_BASE_URL = 'https://hianime.to';
const AJAX_URL = 'https://hianime.to/ajax';

router.get('/api/v2/anime/:animeId/episodes', async (req, res) => {
  const start = Date.now();
  
  try {
    const { animeId } = req.params;

    if (!animeId || animeId.trim() === '') {
      return res.status(400).json({
        status: 400,
        success: false,
        error: 'Anime ID parameter is required'
      });
    }

    if (animeId.indexOf('-') === -1) {
      return res.status(400).json({
        status: 400,
        success: false,
        error: 'Invalid anime ID format'
      });
    }

    // Check cache first
    const cached = watchCache.get(animeId);
    if (cached) {
      console.log(`📦 Cache hit for ${animeId}`);
      return res.json({
        status: 200,
        data: cached,
        extraction_time_seconds: (Date.now() - start) / 1000,
        cached: true,
        timestamp: new Date().toISOString()
      });
    }

    // Extract the numeric ID from anime slug (e.g., "one-piece-100" -> "100")
    const numericId = animeId.split('-').pop();

    // Make AJAX request to get episodes HTML
    const episodesAjax = await axios.get(
      `${AJAX_URL}/v2/episode/list/${numericId}`,
      {
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': `${ANIME_BASE_URL}/watch/${animeId}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      }
    );

    // Load the HTML response with Cheerio
    const $ = load(episodesAjax.data.html);

    // Extract episodes
    const episodes = [];
    $('.detail-infor-content .ss-list a').each((_, el) => {
      const $el = $(el);
      episodes.push({
        title: $el.attr('title')?.trim() || null,
        episodeId: $el.attr('href')?.split('/')?.pop() || null,
        number: Number($el.attr('data-number')),
        isFiller: $el.hasClass('ssl-item-filler')
      });
    });

    const result = {
      totalEpisodes: episodes.length,
      episodes: episodes
    };

    // Cache the result
    watchCache.set(animeId, result);
    
    const duration = (Date.now() - start) / 1000;

    res.json({
      status: 200,
      data: result,
      extraction_time_seconds: duration,
      cached: false,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = (Date.now() - start) / 1000;
    console.error('Watch error:', error.message);
    
    // Handle specific error cases
    let statusCode = 500;
    let errorMessage = error.message;
    
    if (error.response) {
      statusCode = error.response.status;
      errorMessage = `Failed to fetch episodes: ${error.response.statusText}`;
    }
    
    res.status(statusCode).json({
      status: statusCode,
      success: false,
      error: errorMessage,
      extraction_time_seconds: duration,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /watch/:animetitle (Legacy endpoint - kept for backward compatibility)
 * Note: This uses the old AnimeFrenzy scraping approach
 */
router.get('/:animetitle', async (req, res) => {
  const start = Date.now();
  
  try {
    const { animetitle } = req.params;

    if (!animetitle || animetitle.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Anime title parameter is required'
      });
    }

    // Redirect to new endpoint with deprecation notice
    return res.status(301).json({
      success: false,
      message: 'This endpoint is deprecated. Please use /api/v2/anime/:animeId/episodes instead',
      new_endpoint: `/api/v2/anime/${animetitle}/episodes`,
      example: '/api/v2/anime/one-piece-100/episodes'
    });

  } catch (error) {
    const duration = (Date.now() - start) / 1000;
    console.error('Watch error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      extraction_time_seconds: duration,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;