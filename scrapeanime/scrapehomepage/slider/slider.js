export default function scrapeSlider($, resolveUrl, source) {
  const items = [];

  const selectors = ['.slider .item', '.home-slider .slide', '.featured-slider .item', '.swiper-slide.item-qtip', '.film-poster', '.swiper-slide'];

  for (const sel of selectors) {
    const found = $(sel);
    if (!found || !found.length) continue;

    found.each((i, el) => {
      const el$ = $(el);
      const a = el$.find('a').first();
      let href = a.attr('href') || el$.attr('href') || '';
      href = href ? resolveUrl(href) : null;

      let title = a.attr('title') || el$.find('.film-title').attr('data-iname') || el$.find('img').attr('alt') || el$.find('.title').text() || el$.find('h3').text() || null;
      if (title) title = title.trim();

      let img = null;
      const imgEl = el$.find('img').first();
      if (imgEl && imgEl.length) img = imgEl.attr('data-src') || imgEl.attr('data-lazy') || imgEl.attr('src') || imgEl.attr('data-original') || null;
      if (!img) img = el$.attr('data-background') || el$.attr('data-image') || null;
      if (img) img = resolveUrl(img);

      if (href || title) items.push({ title: title || null, href: href || null, image: img || null, source, section: 'slider' });
    });

    if (items.length) break;
  }

  return items;
}
