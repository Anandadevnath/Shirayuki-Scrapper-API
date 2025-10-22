import romanizeJapanese from '../../../util/romanizeJapanese.js';
import axios from 'axios';

import { fetchAndLoad } from '../../../service/scraperService.js';

export default async function scrapeTrending($, resolveUrl, source) {
  const items = [];

  const japaneseCharRE = /[\u3000-\u303F\u3040-\u30FF\u4E00-\u9FFF]/;

  const selectors = [
    '#trending-home .swiper-slide.item-qtip',
    '.trending-list .swiper-slide.item-qtip',
    '.swiper-slide.item-qtip.loaded',
    '.swiper-slide.item-qtip'
  ];

  for (const sel of selectors) {
    const found = $(sel);
    if (!found || !found.length) continue;

    found.each((i, el) => {
      const el$ = $(el);
      let title = el$.find('.film-title.dynamic-name').text() ||
        el$.find('.film-title').text() ||
        el$.find('a').attr('title') ||
        el$.find('.title').text() ||
        el$.find('.film-title.dynamic-name').attr('data-jname') ||
        el$.find('[data-jname]').attr('data-jname') || null;
      if (title) title = title.trim();

      let href = el$.find('a.film-poster').attr('href') ||
        el$.find('a').first().attr('href') || '';
      href = href ? resolveUrl(href) : null;

      let image = null;
      const imgEl = el$.find('.film-poster-img').first();
      if (imgEl && imgEl.length) {
        image = imgEl.attr('data-src') ||
          imgEl.attr('data-lazy') ||
          imgEl.attr('src') ||
          imgEl.attr('data-original') || null;
      }
      if (image) image = resolveUrl(image);

      let number = null;
      const numberEl = el$.find('.number').first();
      if (numberEl.length) {
        const numberText = numberEl.text().trim();
        const numberMatch = numberText.match(/(\d+)/);
        number = numberMatch ? parseInt(numberMatch[1]) : null;
      }

      if (title && href) {
        const item = {
          index: i + 1,
          title: title || null,
          japanese: null,
          href: href || null,
          image: image || null,
          number: number || null,
          source,
          section: 'trending'
        };
        const candidates = [
          el$.find('.film-title.dynamic-name').attr('data-jname'),
          el$.find('.film-title').attr('data-jname'),
          el$.find('[data-jname]').attr('data-jname'),
          el$.find('a').attr('data-iname'),
          el$.find('a').attr('title')
        ];
        for (const c of candidates) {
          if (c && typeof c === 'string') { item.japanese = romanizeJapanese(c.trim()); break; }
        }
        if (!item.japanese && title && japaneseCharRE.test(title)) {
          item.japanese = romanizeJapanese(title);
        }
        items.push(item);
      }
    });
    if (items.length >= 8) break;
  }

  await Promise.all(items.map(async (item) => {
    if (item.href) {
      try {
        const detail$ = await fetchAndLoad(item.href);

        function extractFromElement(elem$) {
          if (!elem$ || !elem$.length) return null;
          const contents = elem$.contents().toArray();
          for (const node of contents) {
            if (node.type === 'text') {
              const txt = (node.data || '').trim();
              const m = txt.match(/\d+/);
              if (m) return Number(m[0]);
            }
          }
          const full = elem$.text().trim();
          if (!full) return null;
          const all = full.match(/\d+/g);
          if (!all || !all.length) return null;
          for (const s of all) {
            if (s.length <= 5) return Number(s);
          }
          return Number(all[0].slice(0, 5));
        }

        // Prefer selecting tick items from the main info/detail container
        // to avoid accidentally matching unrelated elements (e.g. sidebar)
        const infoContainer = detail$('.anisc-content, .anisc-detail, .film-detail, .film-infor, .film-stats, .film-content').first();
        let subEl = null;
        let dubEl = null;
        if (infoContainer && infoContainer.length) {
          subEl = infoContainer.find('.tick-item.tick-sub').first();
          dubEl = infoContainer.find('.tick-item.tick-dub').first();
        } else {
          // fallback to global selector if expected containers not found
          subEl = detail$('.tick-item.tick-sub').first();
          dubEl = detail$('.tick-item.tick-dub').first();
        }

        item.sub = extractFromElement(subEl);
        item.dub = extractFromElement(dubEl);
      } catch (e) {
        item.sub = null;
        item.dub = null;
      }
    }
  }));

  // --- IMDb rating enrichment (same approach as recentlyUpdated)
  async function mapWithConcurrency(list, mapper, limit) {
    const results = new Array(list.length);
    let idx = 0;
    async function worker() {
      while (true) {
        const i = idx++;
        if (i >= list.length) return;
        try {
          results[i] = await mapper(list[i], i);
        } catch (e) {
          results[i] = null;
        }
      }
    }
    const workers = [];
    for (let i = 0; i < Math.min(limit, list.length); i++) workers.push(worker());
    await Promise.all(workers);
    return results;
  }

  function normalizeForCompare(s) {
    if (!s) return '';
    return s.toString().toLowerCase()
      .replace(/\b(dub|sub|season|part|\(|\)|\:|\.|,|'|"|\[|\]|\{|\}|\b2nd\b|\b3rd\b|\b4th\b)\b/g, '')
      .replace(/[^a-z0-9]+/g, '')
      .trim();
  }

  const imdbCache = new Map();
  async function fetchImdbRating(title, altTitle) {
    if (!title && !altTitle) return null;
    const key = (title || altTitle).toString().toLowerCase();
    if (imdbCache.has(key)) return imdbCache.get(key);

    const queriesSet = new Set();
    try {
      if (title) {
        const cleaned = title.toString().replace(/\b(dub|sub)\b/gi, '').replace(/\s+/g, ' ').trim();
        if (cleaned && cleaned.toLowerCase() !== title.toString().toLowerCase()) queriesSet.add(cleaned);
        queriesSet.add(title);
      }
      if (altTitle) {
        queriesSet.add(altTitle);
      }
    } catch (e) {
      // fallback to title only
      if (title) queriesSet.add(title);
    }
    const queries = Array.from(queriesSet);

    try {
      let results = [];
      for (const q of queries) {
        const resp = await axios.get('https://api.imdbapi.dev/search/titles', {
          params: { query: q, limit: 8 },
          timeout: 4000
        });
        results = resp.data && resp.data.titles ? resp.data.titles : [];
        if (results && results.length) break;
      }

      if (!results.length) {
        imdbCache.set(key, null);
        return null;
      }

      const norm = normalizeForCompare(title);

      let pick = results.find(r => r && r.title && normalizeForCompare(r.title) === norm && r.rating && typeof r.rating.aggregateRating !== 'undefined');
      if (pick && pick.rating) {
        imdbCache.set(key, pick.rating.aggregateRating);
        return pick.rating.aggregateRating;
      }

      pick = results.find(r => r && r.rating && typeof r.rating.aggregateRating !== 'undefined');
      if (pick && pick.rating) {
        imdbCache.set(key, pick.rating.aggregateRating);
        return pick.rating.aggregateRating;
      }

      for (const r of results) {
        if (r && r.id) {
          try {
            const byId = await axios.get(`https://api.imdbapi.dev/titles/${encodeURIComponent(r.id)}`, { timeout: 3000 });
            if (byId.data && byId.data.rating && typeof byId.data.rating.aggregateRating !== 'undefined') {
              imdbCache.set(key, byId.data.rating.aggregateRating);
              return byId.data.rating.aggregateRating;
            }
          } catch (e) {
            // ignore per-item failure
          }
        }
      }

      imdbCache.set(key, null);
      return null;
    } catch (e) {
      imdbCache.set(key, null);
      return null;
    }
  }

  const CONCURRENCY = 6;
  const enriched = await mapWithConcurrency(items, async (it) => {
    const rating = await fetchImdbRating(it.title || '', it.japanese || '');
    return { ...it, rating };
  }, CONCURRENCY);

  return enriched.filter(Boolean);
}