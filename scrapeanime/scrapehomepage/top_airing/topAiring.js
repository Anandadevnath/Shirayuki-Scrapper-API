import { scrapeAnimeDetails } from '../scrapeAnimeDetails.js';

export default async function scrapeTopAiring($, resolveUrl, source, includeDetails = true) {
  const items = [];

  $('div.anif-block').each((i, block) => {
    const block$ = $(block);
    const header = block$.find('.anif-block-header').text() || '';
    if (!/top\s*airing/i.test(header)) return;

    block$.find('.anif-block-ul ul.ulclear > li').each((j, li) => {
      const el$ = $(li);
      const a = el$.find('h3.film-name a').first();
      let href = a.attr('href') || el$.find('a').first().attr('href') || '';
      href = href ? resolveUrl(href) : null;

      let title = a.attr('title') || a.attr('data-jname') || a.text() || null;
      if (title) title = title.trim();

      let img = null;
      const poster = el$.find('.film-poster').first();
      if (poster && poster.length) {
        const imgEl = poster.find('img').first();
        if (imgEl && imgEl.length) {
          img = imgEl.attr('data-src') || imgEl.attr('data-lazy') || imgEl.attr('src') || imgEl.attr('data-original') || null;
        }
        if (!img) {
          const style = poster.attr('style') || poster.find('a').attr('style') || '';
          const m = /url\(['"]?(.*?)['"]?\)/.exec(style);
          if (m && m[1]) img = m[1];
        }
      }
      if (img) img = resolveUrl(img);

      const dubText = el$.find('.tick .tick-item.tick-dub').text() || el$.find('.tick-item.tick-dub').text() || '';
      const subText = el$.find('.tick .tick-item.tick-sub').text() || el$.find('.tick-item.tick-sub').text() || '';
      const dub = (dubText || '').toString().replace(/[,\s"']/g, '').match(/(\d+)/);
      const sub = (subText || '').toString().replace(/[,\s"']/g, '').match(/(\d+)/);

      const fdi = el$.find('.fdi-item').text() || el$.find('.fd-infor .fdi-item').text() || '';
      const tv = /\bTV\b/i.test(fdi);

      items.push({
        title: title || null,
        href: href || null,
        image: img || null,
        dub: dub ? parseInt(dub[1], 10) : null,
        sub: sub ? parseInt(sub[1], 10) : null,
        tv: !!tv,
        source,
        section: 'top_airing',
      });
    });
  });

  // If includeDetails is true, fetch detailed information for each anime
  if (includeDetails) {
    const detailedItems = await Promise.allSettled(
      items.map(async (item) => {
        if (item.href) {
          const details = await scrapeAnimeDetails(item.href);
          return {
            ...item,
            details: {
              description: details?.description || null,
              synonyms: details?.synonyms || null,
              aired: details?.aired || null,
              premiered: details?.premiered || null,
              duration: details?.duration || null,
              status: details?.status || null,
              malScore: details?.malScore || null,
              genres: details?.genres || [],
              studios: details?.studios || [],
              producers: details?.producers || []
            }
          };
        }
        return item;
      })
    );

    // Return only fulfilled promises, filter out rejected ones
    return detailedItems
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value);
  }

  return items;
}
