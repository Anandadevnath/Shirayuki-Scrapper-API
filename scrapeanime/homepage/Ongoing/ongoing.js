import axios from 'axios';
import { fetchAndLoad, resolveUrlFactory } from '../../../service/scraperService.js';

function slugifyTitle(title) {
  if (!title) return null;
  try {
    const s = title.normalize('NFKD').replace(/\p{Diacritic}/gu, '');
    return s.toLowerCase()
      .replace(/[:"'()\[\]{}]/g, '')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '');
  } catch (e) {
    return title.toString().toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
  }
}

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

export default async function scrapeOnging() {
  const start = Date.now();
  const url = 'https://123animehub.cc/home';
  const $ = await fetchAndLoad(url);
  const resolveUrl = resolveUrlFactory('https://123animehub.cc');

  const items = [];
  $('div.widget').each((i, widget) => {
    const w$ = $(widget);
    const titleText = (w$.find('.widget-title').text() || '').toLowerCase();
    if (!/ongoing|ongoing|has-page|hotnew/.test(titleText) && !w$.hasClass('ongoing')) return;

    w$.find('.link-list .item, .link-list a.name, .link-list .item a').each((j, it) => {
      const el$ = $(it).closest('.item');
      const a = el$.find('a.name, a.name.tooltipstered, a').first();
      if (!a || !a.length) return;
      let title = a.attr('data-jtitle') || a.attr('data-title') || a.attr('title') || a.text() || null;
      if (title) title = title.toString().trim();
      const href = a.attr('href') ? resolveUrl(a.attr('href')) : null;

      let episode = null;
      const watch = a.find('span.watch').first();
      if (watch && watch.length) {
        const text = watch.text() || '';
        const m = text.match(/(\d{1,4})/);
        if (m) episode = m[1];
      } else {
        const status = el$.find('.status').first();
        if (status && status.length) {
          const st = status.text() || '';
          const mm = st.match(/(\d{1,4})/);
          if (mm) episode = mm[1];
        }
      }

      let image = null;
      const imgEl = el$.find('img').first();
      if (imgEl && imgEl.length) {
        image = imgEl.attr('data-src') || imgEl.attr('data-lazy') || imgEl.attr('src') || imgEl.attr('data-original') || null;
        if (image) image = resolveUrl(image);
      }

      items.push({ title: title || null, href: href || null, episode: episode || null, image: image || null });
    });
  });

  const imdbCache = new Map();

  function normalizeForCompare(s) {
    if (!s) return '';
    return s.toString().toLowerCase()
      .replace(/\b(dub|sub|season|part|\(|\)|\:|\.|,|\'|\"|\[|\]|\{|\}|\b2nd\b|\b3rd\b|\b4th\b)\b/g, '')
      .replace(/[^a-z0-9]+/g, '')
      .trim();
  }

  async function fetchImdbRating(title) {
    if (!title) return null;
    const key = title.toString().toLowerCase();
    if (imdbCache.has(key)) return imdbCache.get(key);

    try {
      const resp = await axios.get('https://api.imdbapi.dev/search/titles', {
        params: { query: title, limit: 5 },
        timeout: 4000
      });
      const results = resp.data && resp.data.titles ? resp.data.titles : [];

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

  const seen = new Set();
  const dedup = items.filter(it => {
    const key = ((it.href || '') + '::' + (it.title || '')).toLowerCase();
    if (!it.title && !it.href) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 60);

  const CONCURRENCY = 6;
  const enriched = await mapWithConcurrency(dedup, async (it) => {
    const slug = slugifyTitle(it.title || '');
    const image = slug ? `https://123animehub.cc/imgs/poster/${slug}.jpg` : it.image || null;
    return { title: it.title, image: image, episode: it.episode };
  }, CONCURRENCY);

  const extraction_time_seconds = parseFloat(((Date.now() - start) / 1000).toFixed(3));
  return { success: true, data: enriched, extraction_time_seconds };
}

