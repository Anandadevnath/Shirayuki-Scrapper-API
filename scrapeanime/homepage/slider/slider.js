import romanizeJapanese from '../../../util/romanizeJapanese.js';

const romanizeCache = new Map();
const japaneseCharRE = /[\u3000-\u303F\u3040-\u30FF\u4E00-\u9FFF]/;

function cachedRomanize(text) {
  if (!text) return null;
  if (romanizeCache.has(text)) return romanizeCache.get(text);
  const result = romanizeJapanese(text);
  romanizeCache.set(text, result);
  return result;
}

export default function scrapeSlider($, resolveUrl, source) {
  const items = [];
  const maxItems = 8;

  const selectors = ['.swiper-slide', '.swiper-slide.item-qtip', '.slider .item', '.home-slider .slide', '.featured-slider .item', '.film-poster'];

  for (const sel of selectors) {
    const found = $(sel);
    if (!found?.length) continue;

    const elementsToProcess = found.slice(0, maxItems * 2);

    elementsToProcess.each((i, el) => {
      if (items.length >= maxItems) return false;

      const el$ = $(el);
      const aElement = el$.find('a').first();
      const imgElement = el$.find('img').first();
      const filmTitle = el$.find('.film-title');
      const scdItems = el$.find('.scd-item');
      const tickItems = el$.find('.tick-item');
      const parentSlide = el$.closest('.swiper-slide');

      // Extract href
      let href = aElement.attr('href') || el$.attr('href') || '';
      href = href ? resolveUrl(href) : null;

      if (!href || (!href.includes('hianime.to') && !href.includes('/watch/'))) {
        return true;
      }

      // Extract title 
      let title = el$.find('.desi-head-title').text() ||
        filmTitle.text() ||
        el$.find('.title, h3').first().text() ||
        aElement.attr('title') ||
        imgElement.attr('alt') ||
        filmTitle.attr('data-iname') || null;
      title = title?.trim() || null;

      // Extract image
      let img = null;
      if (imgElement.length) {
        img = imgElement.attr('data-src') || imgElement.attr('data-lazy') ||
          imgElement.attr('src') || imgElement.attr('data-original');
      }
      if (!img) {
        img = el$.attr('data-background') || el$.attr('data-image');
      }
      img = img ? resolveUrl(img) : null;

      // Extract description
      let description = el$.find('.desi-description').text() ||
        parentSlide.find('.desi-description').text() ||
        el$.find('.description, .synopsis, .summary').first().text() ||
        el$.find('[class*="desc"]').first().text() || null;
      description = description?.trim() || null;

      let duration = null;
      let releaseDate = null;
      let quality = null;
      let subtitles = null;
      let dubbed = false;
      let isTV = false;

      scdItems.each((_, item) => {
        const $item = $(item);
        const itemText = $item.text();

        if ($item.find('.fas.fa-clock').length) {
          const match = itemText.match(/(\d+)m/i);
          duration = match ? match[1] : null;
        } else if ($item.find('.fas.fa-calendar').length) {
          releaseDate = itemText.trim() || null;
        } else if ($item.find('.fas.fa-play-circle').length && itemText.includes('TV')) {
          isTV = true;
        }

        const qualityText = $item.find('.quality').text().trim();
        if (qualityText) quality = qualityText;
      });

      if (!quality) {
        quality = parentSlide.find('.scd-item .quality').text() ||
          el$.find('.quality, [class*="quality"], .film-poster-quality, .badge, .resolution').first().text() || null;
        quality = quality?.trim() || null;
      }

      if (!isTV) {
        isTV = el$.find('[class*="tv"]').length > 0 ||
          el$.find('.film-detail .fd-infor .fdi-item').filter((_, elem) =>
            $(elem).text().toLowerCase().includes('tv')).length > 0 ||
          (title && title.toLowerCase().includes('season'));
      }

      const allTickItems = tickItems.add(parentSlide.find('.tick-item'));
      allTickItems.each((_, item) => {
        const $item = $(item);
        const itemText = $item.text();

        if ($item.find('.fas.fa-closed-captioning').length) {
          const subMatch = itemText.match(/(\d+)/);
          subtitles = subMatch ? subMatch[1] : null;
        }

        const lowerText = itemText.toLowerCase();
        if (lowerText.includes('dub') || lowerText.includes('english') || $item.hasClass('dub')) {
          dubbed = true;
        }
      });

      const item = {
        title,
        japanese: null,
        href,
        image: img,
        description,
        isTV,
        duration,
        releaseDate,
        quality,
        subtitles,
        dubbed,
        source,
        section: 'slider'
      };

      const candidates = [
        aElement.attr('data-jname'),
        aElement.attr('data-iname'),
        aElement.attr('title'),
        filmTitle.attr('data-jname'),
        filmTitle.attr('data-iname'),
        imgElement.attr('data-jname'),
        imgElement.attr('data-iname'),
        imgElement.attr('alt')
      ].filter(Boolean);

      for (const candidate of candidates) {
        if (candidate && typeof candidate === 'string') {
          item.japanese = cachedRomanize(candidate.trim());
          break;
        }
      }

      if (!item.japanese && title && japaneseCharRE.test(title)) {
        item.japanese = cachedRomanize(title);
      }

      items.push(item);
    });

    if (items.length) break;
  }

  return items.slice(0, maxItems);
}
