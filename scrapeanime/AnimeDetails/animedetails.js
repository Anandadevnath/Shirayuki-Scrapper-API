import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
puppeteer.use(StealthPlugin());

const router = express.Router();



import { toKatakana } from '@koozaki/romaji-conv';

function japanese_lang(engTitle) {
  return toKatakana(engTitle);
}


router.get('/anime/:slug', async (req, res) => {
  const { slug } = req.params;
  const animeUrl = `https://123animehub.cc/anime/${slug}`;
  const startTime = Date.now();
  try {
    const { data: html } = await axios.get(animeUrl);
    const $ = cheerio.load(html);
    const title = $('h2.title').text().trim() || $('h1').first().text().trim();
    let image = $('.thumb img').attr('src') || $('img').first().attr('src');
    if (image && image.startsWith('/')) image = `https://123animehub.cc${image}`;
    let description = '';
    if ($('.desc .long').length) description = $('.desc .long').text().replace(/\s+/g, ' ').trim();
    else if ($('.desc').length) description = $('.desc').text().replace(/\s+/g, ' ').trim();
    let type = '', country = '', genres = [], status = '', released = '', quality = '';
    $('.meta').each((i, el) => {
      const meta = $(el);
      meta.find('dt').each((j, dt) => {
        const key = $(dt).text().trim().toLowerCase();
        const value = $(dt).next('dd');
        if (key === 'type:') type = value.text().trim();
        if (key === 'country:') country = value.text().trim();
        if (key === 'genre:') genres = value.find('a').map((i, a) => $(a).text().trim()).get();
        if (key === 'status:') status = value.text().trim();
        if (key === 'released:') released = value.text().trim();
      });
    });
    const qualityDiv = $("div:contains('Quality:')");
    if (qualityDiv.length) {
      const qualitySpan = qualityDiv.find('span.quality').first();
      if (qualitySpan.length) quality = qualitySpan.text().trim();
      else {
        const text = qualityDiv.text();
        const match = text.match(/Quality:\s*(\w+)/i);
        if (match) quality = match[1];
      }
    }

    const execution_time_ms = Date.now() - startTime;
    const execution_time_sec = (execution_time_ms / 1000).toFixed(3);

    res.json({
      title, image, description, type, country, genres, status, released, quality,
      execution_time_sec,
      japanese_lang: japanese_lang(title)
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch anime details',
      details: error.message
    });
  }
});

export default router;
