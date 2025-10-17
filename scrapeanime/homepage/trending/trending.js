import romanizeJapanese from '../../../util/romanizeJapanese.js';

export default function scrapeTrending($, resolveUrl, source) {
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
  
  return items;
}