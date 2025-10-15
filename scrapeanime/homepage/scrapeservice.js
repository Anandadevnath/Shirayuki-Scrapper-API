import scrapeTopAiring from './top_airing/topAiring.js';
import scrapeMostPopular from './most_popular/mostPopular.js';
import scrapeMostFavorite from './most_favorite/mostFavorite.js';
import scrapeRecentlyUpdated from './recently_updated/recentlyUpdated.js';
import scrapeSlider from './slider/slider.js';
import scrapeLatest from './latest/latest.js';
import scrapeTrending from './trending/trending.js';
import { fetchAndLoad, resolveUrlFactory } from '../../service/scraperService.js';

const cache = new Map();
const CACHE_TTL = 2 * 60 * 1000; 

function getCacheKey(url, includeDetails) {
  return `${url}_${includeDetails}`;
}

function getFromCache(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCache(key, data) {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
  
  if (cache.size > 10) {
    const oldestKeys = Array.from(cache.keys()).slice(0, 5);
    oldestKeys.forEach(key => cache.delete(key));
  }
}

async function scrapeSite(url, base, source, includeDetails = false) {
	const cacheKey = getCacheKey(url, includeDetails);
	const cached = getFromCache(cacheKey);
	
	if (cached) {
		return cached;
	}

	const $ = await fetchAndLoad(url);
	const resolveUrl = resolveUrlFactory(base);

	const items = [];

	try {
		const top = await scrapeTopAiring($, resolveUrl, source, includeDetails);
		if (top && top.length) items.push(...top);
	} catch (e) {
	}

	try {
		const popular = await scrapeMostPopular($, resolveUrl, source, includeDetails);
		if (popular && popular.length) items.push(...popular);
	} catch (e) {
	}

	try {
		const fav = await scrapeMostFavorite($, resolveUrl, source, includeDetails);
		if (fav && fav.length) items.push(...fav);
	} catch (e) {
	}

	try {
		if (source === '123animehub') {
			const recent = scrapeRecentlyUpdated($, resolveUrl, source);
			if (recent && recent.length) items.push(...recent);
		}
	} catch (e) {
	}

	try {
		if (source !== '123animehub') {
			const slider = scrapeSlider($, resolveUrl, source);
			if (slider && slider.length) items.push(...slider);
		}
	} catch (e) {
	}

	try {
		const latest = scrapeLatest($, resolveUrl, source);
		if (latest && latest.length) items.push(...latest);
	} catch (e) {
	}

	try {
		const trending = await scrapeTrending($, resolveUrl, source, includeDetails);
		if (trending && trending.length) items.push(...trending);
	} catch (e) {
	}

	const seen = new Set();
	const deduped = [];
	for (const it of items) {
		const contentKey = (it.href || it.title || it.image || '').toString().toLowerCase();
		const sectionKey = `${contentKey}::${it.section || 'unknown'}`;
		
		if (!contentKey) continue;
		if (!seen.has(sectionKey)) {
			seen.add(sectionKey);
			deduped.push(it);
		}
	}

	setCache(cacheKey, deduped);
	
	return deduped;
}

export async function scrapeHomepage(includeDetails = false) {
	const tasks = [
		scrapeSite('https://hianime.to/home', 'https://hianime.to', 'hianime', includeDetails),
		scrapeSite('https://123animehub.cc/home', 'https://123animehub.cc', '123animehub', includeDetails),
	];

	const results = await Promise.allSettled(tasks);

	const combined = [];
	const errors = [];

	if (results[0].status === 'fulfilled') combined.push(...results[0].value);
	else errors.push({ source: 'hianime', error: String(results[0].reason) });

	if (results[1].status === 'fulfilled') combined.push(...results[1].value);
	else errors.push({ source: '123animehub', error: String(results[1].reason) });

	const seen = new Set();
	const deduped = [];
	for (const it of combined) {
		const contentKey = (it.href || it.title || it.image || '').toString().toLowerCase();
		const sectionKey = `${contentKey}::${it.section || 'unknown'}`;
		
		if (!contentKey) continue;
		if (!seen.has(sectionKey)) {
			seen.add(sectionKey);
			deduped.push(it);
		}
	}

	const sectionTotals = {};
	for (const it of deduped) {
		const sec = it.section || 'unknown';
		sectionTotals[sec] = (sectionTotals[sec] || 0) + 1;
	}

	const sectionCounters = {};
	const indexed = deduped.map((item) => {
		const sec = item.section || 'unknown';
		sectionCounters[sec] = (sectionCounters[sec] || 0) + 1;
		return { index: sectionCounters[sec], ...item };
	});

	const result = { success: true, data: indexed, total: indexed.length, sectionTotals };
	if (errors.length) result.errors = errors;
	return result;
}

export default scrapeHomepage;