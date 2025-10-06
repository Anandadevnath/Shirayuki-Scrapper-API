import scrapeTopAiring from './top_airing/topAiring.js';
import scrapeMostPopular from './most_popular/mostPopular.js';
import scrapeMostFavorite from './most_favorite/mostFavorite.js';
import scrapeRecentlyUpdated from './recently_updated/recentlyUpdated.js';
import scrapeSlider from './slider/slider.js';
import { fetchAndLoad, resolveUrlFactory } from '../../service/scraperService.js';

async function scrapeSite(url, base, source) {
	const $ = await fetchAndLoad(url);
	const resolveUrl = resolveUrlFactory(base);

	const items = [];

	try {
		const top = scrapeTopAiring($, resolveUrl, source);
		if (top && top.length) items.push(...top);
	} catch (e) {

	}

	try {
		const popular = scrapeMostPopular($, resolveUrl, source);
		if (popular && popular.length) items.push(...popular);
	} catch (e) {
	}

	try {
		const fav = scrapeMostFavorite($, resolveUrl, source);
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

	const seen = new Set();
	const deduped = [];
	for (const it of items) {
		const key = (it.href || it.title || it.image || '').toString().toLowerCase();
		if (!key) continue;
		if (!seen.has(key)) {
			seen.add(key);
			deduped.push(it);
		}
	}

	return deduped;
}

export async function scrapeHomepage() {
	const tasks = [
		scrapeSite('https://hianime.to/home', 'https://hianime.to', 'hianime'),
		scrapeSite('https://123animehub.cc/home', 'https://123animehub.cc', '123animehub'),
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
		const key = (it.href || it.title || it.image || '').toString().toLowerCase();
		if (!key) continue;
		if (!seen.has(key)) {
			seen.add(key);
			deduped.push(it);
		}
	}

	// compute per-section totals and assign 1-based index per section
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

