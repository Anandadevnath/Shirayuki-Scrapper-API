export default function scrapeTrending($, resolveUrl, source) {
  const items = [];

  const selectors = ['.swiper-slide.item-qtip', '.trending-list .swiper-slide', '.block_area-content .swiper-slide'];

  for (const sel of selectors) {
    const found = $(sel);
    if (!found || !found.length) continue;

    found.slice(0, 6).each((i, el) => {
      const el$ = $(el);
      
      let title = el$.find('.film-title.dynamic-name').attr('data-jname') || 
                 el$.find('.film-title').text() || 
                 el$.find('[data-jname]').attr('data-jname') ||
                 el$.find('a').attr('title') || 
                 el$.find('.title').text() || null;
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
          title: title || null,
          href: href || null,
          image: image || null,
          number: number || null,
          source,
          section: 'trending'
        };
        items.push(item);
      }
    });

    if (items.length) break;
  }

  return items;
}