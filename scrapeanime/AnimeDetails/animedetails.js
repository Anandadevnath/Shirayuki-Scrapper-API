import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
puppeteer.use(StealthPlugin());
const router = express.Router();

import { toKatakana } from '@koozaki/romaji-conv';

function japanese_lang(engTitle) {
  // Convert English title to Romaji (if needed), then to Katakana
  // For best results, titles should be in Romaji, but this will work for most anime titles
  return toKatakana(engTitle);
}

router.get('/anime/:slug', async (req, res) => {
  const { slug } = req.params;
  const animeUrl = `https://123animehub.cc/anime/${slug}`;
  const startTime = Date.now();
  try {
    const [cheerioResult, puppeteerResult] = await Promise.all([
      (async () => {
        const { data: html } = await axios.get(animeUrl);
        const $ = cheerio.load(html);

        // Title
        const title = $('h2.title').text().trim() || $('h1').first().text().trim();

        // Image
        let image = $('.thumb img').attr('src') || $('img').first().attr('src');
        if (image && image.startsWith('/')) {
          image = `https://123animehub.cc${image}`;
        }

        // Description
        let description = '';
        if ($('.desc .long').length) {
          description = $('.desc .long').text().replace(/\s+/g, ' ').trim();
        } else if ($('.desc').length) {
          description = $('.desc').text().replace(/\s+/g, ' ').trim();
        }

        // Metadata
        let type = '', country = '', genres = [], status = '', released = '', quality = '';
        $('.meta').each((i, el) => {
          const meta = $(el);
          meta.find('dt').each((j, dt) => {
            const key = $(dt).text().trim().toLowerCase();
            const value = $(dt).next('dd');
            if (key === 'type:') type = value.text().trim();
            if (key === 'country:') country = value.text().trim();
            if (key === 'genre:') {
              genres = value.find('a').map((i, a) => $(a).text().trim()).get();
            }
            if (key === 'status:') status = value.text().trim();
            if (key === 'released:') released = value.text().trim();
          });
        });

        // Quality
        const qualityDiv = $("div:contains('Quality:')");
        if (qualityDiv.length) {
          const qualitySpan = qualityDiv.find('span.quality').first();
          if (qualitySpan.length) {
            quality = qualitySpan.text().trim();
          } else {
            const text = qualityDiv.text();
            const match = text.match(/Quality:\s*(\w+)/i);
            if (match) quality = match[1];
          }
        }
        return { title, image, description, type, country, genres, status, released, quality };
      })(),

      // Range
      (async () => {
        let ranges = [];
        try {
          const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
          const page = await browser.newPage();
          await page.setRequestInterception(true);
          page.on('request', req => {
            const type = req.resourceType();
            if (["image", "stylesheet", "font"].includes(type)) {
              req.abort();
            } else {
              req.continue();
            }
          });
          await page.goto(animeUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

          let rangeSpans = [];
          try {
            await page.waitForSelector('.server.mass .range span', { timeout: 5000 });
            rangeSpans = await page.$$eval('.server.mass .range span', spans =>
              spans.map(span => ({
                rangeId: span.getAttribute('data-range-id'),
                label: span.textContent.trim()
              }))
            );
          } catch (e) {
            rangeSpans = [];
          }
          if (rangeSpans.length) {
            for (const range of rangeSpans) {
              try {
                await page.waitForSelector(`.server.mass ul.episodes.range[data-range-id="${range.rangeId}"] li`, { timeout: 5000 });
                const episodes = await page.$$eval(`.server.mass ul.episodes.range[data-range-id="${range.rangeId}"] li`, lis =>
                  lis.map(li => {
                    const txt = li.textContent.trim();
                    return /^\d+$/.test(txt) ? Number(txt) : null;
                  }).filter(x => x !== null)
                );
                if (!episodes.length) {
                  console.error(`No episodes found for range ${range.label}`);
                }
                ranges.push({ label: range.label, episodes });
              } catch (err) {
                console.error(`Error scraping episodes for range ${range.label}:`, err.message);
              }
            }
          } else {
            try {
              await page.waitForSelector('.server.mass ul.episodes.range li', { timeout: 5000 });
              const episodes = await page.$$eval('.server.mass ul.episodes.range li', lis =>
                lis.map(li => {
                  const txt = li.textContent.trim();
                  return /^\d+$/.test(txt) ? Number(txt) : null;
                }).filter(x => x !== null)
              );
              if (episodes.length) {
                const label = episodes.length > 0 ? `${episodes[0]} - ${episodes[episodes.length - 1]}` : "";
                ranges.push({ label, episodes });
              } else {
                console.error('No episodes found in flat list!');
              }
            } catch (err) {
              console.error('Error scraping flat episode list:', err.message);
            }
          }
          await browser.close();
        } catch (e) {
          console.error('Puppeteer episode scrape failed:', e.message);
          ranges = [];
        }
        return { ranges };
      })()
    ]);
    const execution_time_ms = Date.now() - startTime;
    const execution_time_sec = (execution_time_ms / 1000).toFixed(3);

    // Calculate 
    let counts = 0;
    if (puppeteerResult && Array.isArray(puppeteerResult.ranges)) {
      const episodeSet = new Set();
      puppeteerResult.ranges.forEach(range => {
        if (Array.isArray(range.episodes)) {
          range.episodes.forEach(ep => episodeSet.add(ep));
        }
      });
      counts = episodeSet.size;
    }

    res.json({
      ...cheerioResult,
      ...puppeteerResult,
      counts,
      execution_time_sec,
      japanese_lang: japanese_lang(cheerioResult.title)
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch anime details',
      details: error.message
    });
  }
});

export default router;
