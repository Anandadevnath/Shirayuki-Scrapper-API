// This is testing endpoint donot use it unless you need it
// GET /totalepisode?id=one-piece-dub

import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
puppeteer.use(StealthPlugin());

let browserSingleton = null;
let browserLaunchPromise = null;

async function getBrowser() {
  if (browserSingleton) return browserSingleton;
  if (!browserLaunchPromise) {
    browserLaunchPromise = (async () => {
      const { executablePath } = await import('puppeteer');
      const b = await puppeteer.launch({
        headless: 'new',
        executablePath: executablePath(),
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--no-first-run',
          '--window-size=1280,720',
          '--disable-blink-features=AutomationControlled',
          '--disable-infobars',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows',
          '--disable-features=TranslateUI',
          '--disable-extensions'
        ]
      });
      try {
        if (typeof process !== 'undefined' && process && process.on) {
          process.once('exit', () => { try { b.close(); } catch (e) { } });
        }
      } catch (e) { }
      browserSingleton = b;
      return browserSingleton;
    })();
  }
  return browserLaunchPromise;
}

const router = express.Router();


router.get('/', async (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'Missing id query parameter' });

  const start = Date.now();
  try {
    let baseSlug = id;
    if (baseSlug.toLowerCase().endsWith('-dub')) baseSlug = baseSlug.slice(0, -4);
    const subUrl = `https://123animehub.cc/anime/${baseSlug}/episode/1`;
    const dubUrl = `https://123animehub.cc/anime/${baseSlug}-dub/episode/1`;

    const epCache = new Map();
    const EP_CACHE_TTL_MS = 1000 * 60 * 60; 

    function getCachedEp(url) {
      const e = epCache.get(url);
      if (!e) return null;
      if (Date.now() > e.expiresAt) { epCache.delete(url); return null; }
      return e.count;
    }
    function setCachedEp(url, count, ttlMs = EP_CACHE_TTL_MS) {
      try { epCache.set(url, { count, expiresAt: Date.now() + ttlMs }); } catch (e) { }
    }

    async function fetchEpisodeCount(pageUrl) {
      const cached = getCachedEp(pageUrl);
      if (cached !== null) return cached;
      try {
        const { data: html } = await axios.get(pageUrl, { timeout: 5000 });
        const $ = cheerio.load(html);
        const txt = $('li#end a').first().text().trim();
        if (txt) {
          const n = parseInt(txt.replace(/\D/g, ''), 10);
          if (!isNaN(n)) { setCachedEp(pageUrl, n); return n; }
        }
      } catch (e) {
      }

      try {
        const browser = await getBrowser();
        const page = await browser.newPage();
        try {
          await page.setRequestInterception(true);
          page.on('request', req => {
            const rtype = req.resourceType();
            if (['image', 'stylesheet', 'font', 'media'].includes(rtype)) return req.abort();
            const url = req.url();
            if (/doubleclick|google-analytics|analytics|adservice|ads|tracker/.test(url)) return req.abort();
            try { req.continue(); } catch (e) { }
          });

          await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
          try { await page.waitForSelector('li#end a', { timeout: 8000 }); } catch (e) { }
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

      return null;
    }

    const [sub, dub] = await Promise.all([
      fetchEpisodeCount(subUrl).catch(() => null),
      fetchEpisodeCount(dubUrl).catch(() => null)
    ]);

    const execution_time_ms = Date.now() - start;
    const execution_time_sec = (execution_time_ms / 1000).toFixed(3);

    res.json({ id, sub, dub, execution_time_sec });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch total episodes', details: e && e.message ? e.message : String(e) });
  }
});

export default router;
