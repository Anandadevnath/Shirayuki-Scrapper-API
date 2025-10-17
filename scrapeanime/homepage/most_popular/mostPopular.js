import romanizeJapanese from '../../../util/romanizeJapanese.js';

export default function scrapeMostPopular($, resolveUrl, source) {
  const items = [];
  $('div.anif-block').each((i, block) => {
    const block$ = $(block);
    const header = block$.find('.anif-block-header').text() || '';
    if (!/most\s*popular/i.test(header)) return;

    block$.find('.anif-block-ul ul.ulclear > li').slice(0, 6).each((j, li) => {
      const el$ = $(li);
      const a = el$.find('h3.film-name a').first();
      let href = a.attr('href') || el$.find('a').first().attr('href') || '';
      href = href ? resolveUrl(href) : null;

      let title = a.attr('title') || a.attr('data-jname') || a.text() || null;
      if (title) title = title.trim();

      let japaneseRaw = a.attr('data-jname') || el$.find('h3.film-name').attr('data-jname') || null;
      if (japaneseRaw && typeof japaneseRaw === 'string') japaneseRaw = japaneseRaw.trim();
      const japanese = japaneseRaw ? romanizeJapanese(japaneseRaw) : null;

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
      const dub = (dubText || '').toString().replace(/[,"]'/g, '').match(/(\d+)/);
      const sub = (subText || '').toString().replace(/[,"]'/g, '').match(/(\d+)/);

      const fdi = el$.find('.fdi-item').text() || el$.find('.fd-infor .fdi-item').text() || '';
      const tv = /\bTV\b/i.test(fdi);

      items.push({
        title: title || null,
        japanese: japanese || null,
        href: href || null,
        image: img || null,
        dub: dub ? parseInt(dub[1], 10) : null,
        sub: sub ? parseInt(sub[1], 10) : null,
        tv: !!tv,
        source,
        section: 'most_popular',
      });
    });
  });

  return items;
}
