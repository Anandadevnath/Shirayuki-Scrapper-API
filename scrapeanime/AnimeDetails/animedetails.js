import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
puppeteer.use(StealthPlugin());
import { toKatakana } from '@koozaki/romaji-conv';

const router = express.Router();

function japanese_lang(engTitle) {
  return toKatakana(engTitle);
}

const epCache = new Map();
function getCachedEp(url) {
  const e = epCache.get(url);
  if (!e) return null;
  if (Date.now() > e.expiresAt) { epCache.delete(url); return null; }
  return e.count;
}
function setCachedEp(url, count, ttlMs = 60 * 60 * 1000) {
  epCache.set(url, { count, expiresAt: Date.now() + ttlMs });
}

export async function warmBrowser() {
  try {
    if (!global.__puppeteer_browser) {
      global.__puppeteer_browser = await puppeteer.launch({
        headless: true, args:
          [
            '--no-sandbox',
            '--disable-setuid-sandbox'
          ]
      });
      process.once('exit', async () => {
        try { await global.__puppeteer_browser.close(); } catch (e) { }
      });
    }
  } catch (e) {
  }
}

async function fetchEpisodeCount(pageUrl) {
  const cached = getCachedEp(pageUrl);
  if (cached !== null) return cached;

  try {
    if (!global.__puppeteer_browser) {
      global.__puppeteer_browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
      process.once('exit', async () => {
        try {
          await global.__puppeteer_browser.close();
        } catch (e) { }
      });
    }
    const browser = global.__puppeteer_browser;
    const page = await browser.newPage();
    try {
      await page.setRequestInterception(true);
      page.on('request', req => {
        const rtype = req.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(rtype)) return req.abort();
        const url = req.url();
        if (/doubleclick|google-analytics|analytics|adservice|ads|tracker/.test(url)) return req.abort();
        req.continue();
      });

      await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      try {
        await page.waitForSelector('li#end a', { timeout: 4000 });
      } catch (e) {
      }
      const txt = await page.evaluate(() => {
        const el = document.querySelector('li#end a');
        return el ? el.textContent.trim() : null;
      });
      if (txt) {
        const n = parseInt(txt.replace(/\D/g, ''), 10);
        if (!isNaN(n)) { setCachedEp(pageUrl, n); return n; }
      }
    } finally {
      try { await page.close(); } catch (e) { }
    }
  } catch (e) {
  }

  try {
    const { data: html } = await axios.get(pageUrl, { timeout: 7000 });
    const $ = cheerio.load(html);
    const txt = $('li#end a').first().text().trim();
    if (txt) {
      const n = parseInt(txt.replace(/\D/g, ''), 10);
      if (!isNaN(n)) { setCachedEp(pageUrl, n); return n; }
    }
  } catch (e) {
  }

  return null;
}

router.get('/anime/:slug', async (req, res) => {
  const { slug } = req.params;
  const animeUrl = `https://123animehub.cc/anime/${slug}`;
  const startTime = Date.now();
  let baseSlugForEp = slug;
  if (baseSlugForEp && baseSlugForEp.toLowerCase().endsWith('-dub')) baseSlugForEp = baseSlugForEp.slice(0, -4);
  const subEpisodeUrlEarly = `https://123animehub.cc/anime/${baseSlugForEp}/episode/1`;
  const dubEpisodeUrlEarly = `https://123animehub.cc/anime/${baseSlugForEp}-dub/episode/1`;
  const subPromise = fetchEpisodeCount(subEpisodeUrlEarly).catch(() => null);
  const dubPromise = fetchEpisodeCount(dubEpisodeUrlEarly).catch(() => null);
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

    let rating = null;
    try {
      const imdbResp = await axios.get('https://api.imdbapi.dev/search/titles', {
        params: { query: title, limit: 5 },
        timeout: 3000
      });
      const results = imdbResp.data && imdbResp.data.titles ? imdbResp.data.titles : [];
      if (results.length) {
        const exact = results.find(r => r.title && r.title.toLowerCase() === title.toLowerCase());
        const pick = exact || results[0];
        if (pick && pick.rating && typeof pick.rating.aggregateRating !== 'undefined') {
          rating = {
            score: pick.rating.aggregateRating,
            votes: pick.rating.voteCount || null
          };
        } else if (pick && pick.id) {
          try {
            const byId = await axios.get(`https://api.imdbapi.dev/titles/${encodeURIComponent(pick.id)}`, { timeout: 3000 });
            if (byId.data && byId.data.rating && typeof byId.data.rating.aggregateRating !== 'undefined') {
              rating = {
                score: byId.data.rating.aggregateRating,
                votes: byId.data.rating.voteCount || null
              };
            }
          } catch (e) { }
        }
      }
    } catch (e) {
      rating = null;
    }

    let sub = null;
    let dub = null;
    try {
      const [s, d] = await Promise.all([subPromise, dubPromise]);
      sub = s;
      dub = d;
    } catch (e) {
    }

    const execution_time_ms = Date.now() - startTime;
    const execution_time_sec = (execution_time_ms / 1000).toFixed(3);

    res.json({
      title, image, description, type, country, genres, status, released, quality,
      rating,
      japanese_lang: japanese_lang(title),
      sub,
      dub,
      execution_time_sec
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch anime details',
      details: error.message
    });
  }
});

export default router;
