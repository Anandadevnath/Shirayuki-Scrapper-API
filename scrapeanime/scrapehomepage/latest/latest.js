export default function scrapeLatest($, resolveUrl, source) {
  const items = [];

  const selectors = ['.flw-item', '.film-list .item', '.block_area-content .flw-item', '.film_list-wrap .flw-item'];

  for (const sel of selectors) {
    const found = $(sel);
    if (!found || !found.length) continue;

    found.slice(0, 15).each((i, el) => {
      const el$ = $(el);
      
      let title = el$.find('.film-name a').attr('title') || 
                 el$.find('.film-name a').text() || 
                 el$.find('.dynamic-name').attr('data-jname') ||
                 el$.find('h3 a').text() ||
                 el$.find('.film-detail .film-name a').text() ||
                 el$.find('a').attr('title') || null;
      if (title) title = title.trim();

      let href = el$.find('.film-name a').attr('href') || 
                el$.find('.film-detail .film-name a').attr('href') ||
                el$.find('a').first().attr('href') || '';
      href = href ? resolveUrl(href) : null;

      let image = null;
      const imgEl = el$.find('.film-poster img, img').first();
      if (imgEl && imgEl.length) {
        image = imgEl.attr('data-src') || 
               imgEl.attr('data-lazy') || 
               imgEl.attr('src') || 
               imgEl.attr('data-original') || null;
      }
      if (image) image = resolveUrl(image);

      let subtitles = null;
      const subEl = el$.find('.tick-item.tick-sub').first();
      if (subEl.length) {
        const subText = subEl.text().trim();
        const subMatch = subText.match(/(\d+)/);
        subtitles = subMatch ? subMatch[1] : null;
      }

      let dubbed = null;
      const dubEl = el$.find('.tick-item.tick-dub').first();
      if (dubEl.length) {
        const dubText = dubEl.text().trim();
        const dubMatch = dubText.match(/(\d+)/);
        dubbed = dubMatch ? dubMatch[1] : null;
      }

      let episodes = null;
      
      let episodeEl = el$.find('.fdb-type').first();
      
      if (!episodeEl.length) {
        episodeEl = el$.find('.fd-bar .fdb-type').first();
      }
      if (!episodeEl.length) {
        episodeEl = el$.find('.film-detail .fd-bar .fdb-type').first();
      }
      if (!episodeEl.length) {
        episodeEl = el$.find('*').filter((i, elem) => {
          const text = $(elem).text().trim().toLowerCase();
          return text.match(/ep\s*\d+/i) && $(elem).children().length === 0;
        }).first();
      }
      
      if (episodeEl.length) {
        const episodeText = episodeEl.text().trim();
        const epMatch = episodeText.match(/EP\s*(\d+)/i);
        
        if (epMatch) {
          episodes = epMatch[1];
        } else if (episodeText.toLowerCase().includes('movie')) {
          episodes = "Movie";
        } else if (episodeText.toLowerCase().includes('ova')) {
          episodes = "OVA";
        } else if (episodeText.toLowerCase().includes('special')) {
          episodes = "Special";
        } else {
          const numMatch = episodeText.match(/(\d+)/);
          if (numMatch) {
            episodes = numMatch[1];
          }
        }
      }
      
      if (!episodes && (subtitles || dubbed)) {
        if (subtitles && dubbed && subtitles === dubbed) {
          episodes = subtitles;
        } else if (subtitles) {
          episodes = subtitles;
        } else if (dubbed) {
          episodes = dubbed;
        }
      }

      if (title || href) {
        const item = {
          title: title || null,
          href: href || null,
          image: image || null,
          subtitles: subtitles || null,
          dubbed: dubbed || null,
          episodes: episodes || null,
          source,
          section: 'latest'
        };
        items.push(item);
      }
    });

    if (items.length) break;
  }

  return items;
}