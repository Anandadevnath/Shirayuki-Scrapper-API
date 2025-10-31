import axios from 'axios';
import simpleCache from '../../../service/simpleCache.js';

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

export default async function scrapeRecentlyUpdatedDub($, resolveUrl, source) {
  const items = [];

  $('div.widget').each((i, widget) => {
    const w$ = $(widget);
    const dubContent = w$.find('.content[data-name="dub"]').first();
    if (!dubContent || !dubContent.length) return;

    dubContent.find('.film-list .item').slice(0, 15).each((j, item) => {
      const el$ = $(item);
      const posterA = el$.find('a.poster').first();
      const nameA = el$.find('a.name').first();

      let href = posterA.attr('href') || nameA.attr('href') || '';
      href = href ? resolveUrl(href) : null;

      let titleText = nameA.attr('data-title') || nameA.attr('data-jtitle') || nameA.text() || posterA.attr('data-title') || null;
      if (titleText) titleText = titleText.trim();

      let img = null;
      const imgEl = posterA.find('img').first();
      if (imgEl && imgEl.length) img = imgEl.attr('data-src') || imgEl.attr('src') || imgEl.attr('data-lazy') || null;
      if (!img) {
        const style = posterA.attr('style') || posterA.find('div').attr('style') || '';
        const m = /url\(['"]?(.*?)['"]?\)/.exec(style);
        if (m && m[1]) img = m[1];
      }
      if (img) img = resolveUrl(img);

      let episode = null;
      let audio = null;
      const status = el$.find('.status').first();
      if (status && status.length) {
        const epText = status.find('.ep').text() || status.find('.epi').text() || '';
        const epMatch = (epText || '').toString().match(/(\d+)/);
        if (epMatch) episode = parseInt(epMatch[1], 10);

        const subEl = status.find('.sub').first();
        const dubEl = status.find('.dub').first();
        if (subEl && subEl.length) audio = 'sub';
        else if (dubEl && dubEl.length) audio = 'dub';
        else {
          const sText = status.text() || '';
          if (/\bSUB\b/i.test(sText)) audio = 'sub';
          else if (/\bDUB\b/i.test(sText)) audio = 'dub';
        }
      }

      if (href || titleText) {
        items.push({
          title: titleText || null,
          href: href || null,
          image: img || null,
          episode: episode,
          source,
          section: 'recently_updated',
          type: 'dub'
        });
      }
    });
  });

  // persistent caches (shared across requests)
  const imdbCache = simpleCache.createNamespace('imdb', 24 * 60 * 60 * 1000);
  const kitsuCache = simpleCache.createNamespace('kitsu', 24 * 60 * 60 * 1000);

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
          } catch (e) { }
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

  async function fetchEnglishTitle(title, type) {
    if (!title) return null;
    const searchTitle = title.replace(/\bDub\b/i, '').trim();
    try {
      const cacheKey = searchTitle.toString().toLowerCase();
      if (kitsuCache.has(cacheKey)) return kitsuCache.get(cacheKey);
      const resp = await axios.get('https://kitsu.io/api/edge/anime', {
        params: { 'filter[text]': searchTitle, 'page[limit]': 5 },
        timeout: 4000
      });
      const data = resp.data && resp.data.data ? resp.data.data : [];
      if (data.length) {
        let best = data.find(r => normalizeForCompare(r.attributes.canonicalTitle) === normalizeForCompare(searchTitle));
        if (!best) best = data[0];
        const titles = best.attributes.titles || {};
        const english = titles.en || titles.en_jp || best.attributes.canonicalTitle;
        if (english) {
          const val = type === 'dub' ? english + ' (Dub)' : english;
          kitsuCache.set(cacheKey, val);
          return val;
        }
      }
    } catch (e) {
    }
    return null;
  }

  const enriched = await mapWithConcurrency(dedup, async (it) => {
    const rating = await fetchImdbRating(it.title || '');
    const englishTitle = await fetchEnglishTitle(it.title || '', it.type);
    const image = it.image || null;
    return {
      title: it.title,
      englishTitle,
      href: it.href,
      image: image,
      Dub: it.episode,
      source: it.source,
      section: it.section,
      type: it.type,
      rating
    };
  }, CONCURRENCY);

  return enriched;
}
