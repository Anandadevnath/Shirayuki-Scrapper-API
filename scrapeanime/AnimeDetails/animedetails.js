import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
puppeteer.use(StealthPlugin());

const router = express.Router();

const episodeCache = new Map();
const CACHE_TTL = 2 * 60 * 60 * 1000;

function getCache(key) {
  const entry = episodeCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.time > CACHE_TTL) {
    episodeCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  episodeCache.set(key, { data, time: Date.now() });
}

import { toKatakana } from '@koozaki/romaji-conv';

function japanese_lang(engTitle) {
  return toKatakana(engTitle);
}


router.get('/anime/:slug', async (req, res) => {
  const { slug } = req.params;
  const animeUrl = `https://123animehub.cc/anime/${slug}`;
  const startTime = Date.now();
  try {
    const cacheKey = `episodes:${slug}`;
    let cachedRanges = getCache(cacheKey);

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

    let ranges = [];
    if (cachedRanges) {
      ranges = cachedRanges;
    } else {
      const episodeLis = $('.server.mass ul.episodes.range li');
      if (episodeLis.length) {
        const episodes = episodeLis.map((i, li) => {
          const txt = $(li).text().trim();
          return /^\d+$/.test(txt) ? Number(txt) : null;
        }).get().filter(x => x !== null);
        if (episodes.length) {
          const label = episodes.length > 0 ? `${episodes[0]} - ${episodes[episodes.length - 1]}` : "";
          ranges.push({ label, episodes });
        }
      }
      if (!ranges.length) {
        try {
          const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
          const page = await browser.newPage();
          await page.setRequestInterception(true);
          page.on('request', req => {
            const type = req.resourceType();
            const url = req.url();
            if (["image", "stylesheet", "font", "media"].includes(type)) { req.abort(); return; }
            if (url.includes('ads') || url.includes('doubleclick') || url.includes('googlesyndication') || url.includes('googletagmanager')) { req.abort(); return; }
            req.continue();
          });
          await page.goto(animeUrl, { waitUntil: 'domcontentloaded', timeout: 6000 });
          let rangeSpans = [];
          try {
            await page.waitForSelector('.server.mass .range span', { timeout: 1500 });
            rangeSpans = await page.$$eval('.server.mass .range span', spans =>
              spans.map(span => ({
                rangeId: span.getAttribute('data-range-id'),
                label: span.textContent.trim()
              }))
            );
          } catch (e) { rangeSpans = []; }
          if (rangeSpans.length) {
            for (const range of rangeSpans) {
              try {
                await page.waitForSelector(`.server.mass ul.episodes.range[data-range-id="${range.rangeId}"] li`, { timeout: 1500 });
                const episodes = await page.$$eval(`.server.mass ul.episodes.range[data-range-id="${range.rangeId}"] li`, lis =>
                  lis.map(li => {
                    const txt = li.textContent.trim();
                    return /^\d+$/.test(txt) ? Number(txt) : null;
                  }).filter(x => x !== null)
                );
                if (episodes.length) ranges.push({ label: range.label, episodes });
              } catch (err) {}
            }
          } else {
            try {
              await page.waitForSelector('.server.mass ul.episodes.range li', { timeout: 1500 });
              const episodes = await page.$$eval('.server.mass ul.episodes.range li', lis =>
                lis.map(li => {
                  const txt = li.textContent.trim();
                  return /^\d+$/.test(txt) ? Number(txt) : null;
                }).filter(x => x !== null)
              );
              if (episodes.length) {
                const label = episodes.length > 0 ? `${episodes[0]} - ${episodes[episodes.length - 1]}` : "";
                ranges.push({ label, episodes });
              }
            } catch (err) {}
          }
          await browser.close();
        } catch (e) {
          ranges = [];
        }
      }
      if (ranges.length) setCache(cacheKey, ranges);
    }
    const MAX_EPISODES = 500;
    ranges = ranges.map(r => ({
      label: r.label,
      episodes: r.episodes.length > MAX_EPISODES ? r.episodes.slice(0, MAX_EPISODES) : r.episodes
    }));

    const execution_time_ms = Date.now() - startTime;
    const execution_time_sec = (execution_time_ms / 1000).toFixed(3);
    let counts = 0;
    if (ranges && Array.isArray(ranges)) {
      const episodeSet = new Set();
      ranges.forEach(range => {
        if (Array.isArray(range.episodes)) {
          range.episodes.forEach(ep => episodeSet.add(ep));
        }
      });
      counts = episodeSet.size;
    }

    res.json({
      title, image, description, type, country, genres, status, released, quality,
      ranges,
      counts,
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
