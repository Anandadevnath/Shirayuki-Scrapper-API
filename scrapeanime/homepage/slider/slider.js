export default function scrapeSlider($, resolveUrl, source) {
  const items = [];

  const selectors = ['.swiper-slide', '.slider .item', '.home-slider .slide', '.featured-slider .item', '.swiper-slide.item-qtip', '.film-poster'];

  for (const sel of selectors) {
    const found = $(sel);
    if (!found || !found.length) continue;

    found.each((i, el) => {
      const el$ = $(el);
      const a = el$.find('a').first();
      let href = a.attr('href') || el$.attr('href') || '';
      href = href ? resolveUrl(href) : null;

      let title = el$.find('.desi-head-title').text() ||
        el$.find('.film-title').text() ||
        el$.find('.title').text() ||
        el$.find('h3').text() ||
        a.attr('title') ||
        el$.find('img').attr('alt') ||
        el$.find('.film-title').attr('data-iname') || null;
      if (title) title = title.trim();

      let img = null;
      const imgEl = el$.find('img').first();
      if (imgEl && imgEl.length) img = imgEl.attr('data-src') || imgEl.attr('data-lazy') || imgEl.attr('src') || imgEl.attr('data-original') || null;
      if (!img) img = el$.attr('data-background') || el$.attr('data-image') || null;
      if (img) img = resolveUrl(img);

      let description = el$.find('.desi-description').text() ||
        el$.closest('.swiper-slide').find('.desi-description').text() ||
        el$.parent().find('.desi-description').text() ||
        el$.find('.description').text() ||
        el$.find('.synopsis').text() ||
        el$.find('.summary').text() ||
        el$.find('[class*="desc"]').text() || null;
      if (description) description = description.trim();

      let isTV = el$.find('.scd-item').filter((i, elem) => {
        const $elem = $(elem);
        return $elem.find('.fas.fa-play-circle').length > 0 && $elem.text().includes('TV');
      }).length > 0 ||
        el$.closest('.swiper-slide').find('.scd-item').filter((i, elem) => {
          const $elem = $(elem);
          return $elem.find('.fas.fa-play-circle').length > 0 && $elem.text().includes('TV');
        }).length > 0 ||
        el$.find('[class*="tv"]').length > 0 ||
        el$.find('.film-detail .fd-infor .fdi-item').filter((i, elem) => {
          return $(elem).text().toLowerCase().includes('tv');
        }).length > 0 ||
        (title && title.toLowerCase().includes('season'));

      let duration = null;
      let durationEl = el$.find('.scd-item').filter((i, elem) => {
        return $(elem).find('.fas.fa-clock').length > 0;
      });
      if (!durationEl.length) {
        durationEl = el$.closest('.swiper-slide').find('.scd-item').filter((i, elem) => {
          return $(elem).find('.fas.fa-clock').length > 0;
        });
      }
      if (durationEl.length) {
        const durationText = durationEl.text().trim();
        const match = durationText.match(/(\d+)m/i);
        duration = match ? match[1] : null;
      }

      let releaseDate = null;
      let dateEl = el$.find('.scd-item').filter((i, elem) => {
        return $(elem).find('.fas.fa-calendar').length > 0;
      });
      if (!dateEl.length) {
        dateEl = el$.closest('.swiper-slide').find('.scd-item').filter((i, elem) => {
          return $(elem).find('.fas.fa-calendar').length > 0;
        });
      }
      if (dateEl.length) {
        const dateText = dateEl.text().trim();
        releaseDate = dateText || null;
      }

      let quality = el$.find('.scd-item .quality').text() ||
        el$.closest('.swiper-slide').find('.scd-item .quality').text() ||
        el$.find('.quality').text() ||
        el$.find('[class*="quality"]').text() ||
        el$.find('.film-poster-quality').text() ||
        el$.find('.badge').text() ||
        el$.find('.resolution').text() || null;
      if (quality) quality = quality.trim();

      let subtitles = null;
      let dubbed = false;

      let subEl = el$.find('.tick-item').filter((i, elem) => {
        return $(elem).find('.fas.fa-closed-captioning').length > 0;
      });
      if (!subEl.length) {
        subEl = el$.closest('.swiper-slide').find('.tick-item').filter((i, elem) => {
          return $(elem).find('.fas.fa-closed-captioning').length > 0;
        });
      }
      if (subEl.length) {
        const subText = subEl.text().trim();
        const subMatch = subText.match(/(\d+)/);
        subtitles = subMatch ? subMatch[1] : null;
      }

      let dubEl = el$.find('.tick-item').filter((i, elem) => {
        const $elem = $(elem);
        const text = $elem.text().toLowerCase();
        return text.includes('dub') || text.includes('english') || $elem.hasClass('dub');
      });
      if (!dubEl.length) {
        dubEl = el$.closest('.swiper-slide').find('.tick-item').filter((i, elem) => {
          const $elem = $(elem);
          const text = $elem.text().toLowerCase();
          return text.includes('dub') || text.includes('english') || $elem.hasClass('dub');
        });
      }
      if (dubEl.length) {
        dubbed = true;
      }

      if (href || title) {
        // Only include items from hianime source or with hianime URLs and limit to first 8 items
        if (href && (href.includes('hianime.to') || href.includes('/watch/')) && items.length < 8) {
          const item = {
            title: title || null,
            href: href || null,
            image: img || null,
            description: description || null,
            isTV: isTV || false,
            duration: duration || null,
            releaseDate: releaseDate || null,
            quality: quality || null,
            subtitles: subtitles || null,
            dubbed: dubbed || false,
            source,
            section: 'slider'
          };
          items.push(item);
        }
      }
    });

    if (items.length) break;
  }

  return items;
}
