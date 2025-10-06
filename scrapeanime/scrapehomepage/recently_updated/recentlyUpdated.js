export default function scrapeRecentlyUpdated($, resolveUrl, source) {
  const items = [];

  // look for widgets with title 'Recently Updated' or similar
  $('div.widget').each((i, widget) => {
    const w$ = $(widget);
    const title = w$.find('.widget-title .title, .widget-title h1.title').text() || w$.find('.widget-title').text() || '';
    if (!/recently\s*updated/i.test(title)) return;

    // items live under .film-list > .item
    w$.find('.film-list .item').each((j, item) => {
      const el$ = $(item);
      const posterA = el$.find('a.poster').first();
      const nameA = el$.find('a.name').first();

      let href = posterA.attr('href') || nameA.attr('href') || '';
      href = href ? resolveUrl(href) : null;

      let titleText = nameA.attr('data-title') || nameA.attr('data-jtitle') || nameA.text() || posterA.attr('data-title') || null;
      if (titleText) titleText = titleText.trim();

      let img = null;
      // poster may be an <img> inside; or background-image style on anchor
      const imgEl = posterA.find('img').first();
      if (imgEl && imgEl.length) img = imgEl.attr('data-src') || imgEl.attr('src') || imgEl.attr('data-lazy') || null;
      if (!img) {
        const style = posterA.attr('style') || posterA.find('div').attr('style') || '';
        const m = /url\(['"]?(.*?)['"]?\)/.exec(style);
        if (m && m[1]) img = m[1];
      }
      if (img) img = resolveUrl(img);

      // extract episode number and audio (sub/dub) if present in status block
      let episode = null;
      let audio = null; // 'sub' | 'dub' | null
      const status = el$.find('.status').first();
      if (status && status.length) {
        const epText = status.find('.ep').text() || status.find('.epi').text() || '';
        const epMatch = (epText || '').toString().match(/(\d+)/);
        if (epMatch) episode = parseInt(epMatch[1], 10);

        // detect SUB / DUB markers
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
        items.push({ title: titleText || null, href: href || null, image: img || null, episode: episode, source, section: 'recently_updated' });
      }
    });
  });

  return items;
}
