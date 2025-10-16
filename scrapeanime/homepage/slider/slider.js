export default function scrapeSlider($, resolveUrl, source) {
  const items = [];

  function romanizeJapanese(input) {
    if (!input || typeof input !== 'string') return null;
    if (/[A-Za-z0-9]/.test(input)) return input.trim();
    const s = input.trim();
    const hiraganaMap = {'あ':'a','い':'i','う':'u','え':'e','お':'o','か':'ka','き':'ki','く':'ku','け':'ke','こ':'ko','さ':'sa','し':'shi','す':'su','せ':'se','そ':'so','た':'ta','ち':'chi','つ':'tsu','て':'te','と':'to','な':'na','に':'ni','ぬ':'nu','ね':'ne','の':'no','は':'ha','ひ':'hi','ふ':'fu','へ':'he','ほ':'ho','ま':'ma','み':'mi','む':'mu','め':'me','も':'mo','や':'ya','ゆ':'yu','よ':'yo','ら':'ra','り':'ri','る':'ru','れ':'re','ろ':'ro','わ':'wa','ん':'n','が':'ga','ぎ':'gi','ぐ':'gu','げ':'ge','ご':'go','ざ':'za','じ':'ji','ず':'zu','ぜ':'ze','ぞ':'zo','だ':'da','ぢ':'ji','づ':'zu','で':'de','ど':'do','ば':'ba','び':'bi','ぶ':'bu','べ':'be','ぼ':'bo','ぱ':'pa','ぴ':'pi','ぷ':'pu','ぺ':'pe','ぽ':'po','ぁ':'a','ぃ':'i','ぅ':'u','ぇ':'e','ぉ':'o','っ':'','ゃ':'ya','ゅ':'yu','ょ':'yo','ー':'-'};
    const katakanaMap = {};
    Object.keys(hiraganaMap).forEach(h => { const code = h.charCodeAt(0); if (code >= 0x3041 && code <= 0x3096) katakanaMap[String.fromCharCode(code + 0x60)] = hiraganaMap[h]; });
    const digraphs = {'きゃ':'kya','きゅ':'kyu','きょ':'kyo','しゃ':'sha','しゅ':'shu','しょ':'sho','ちゃ':'cha','ちゅ':'chu','ちょ':'cho','にゃ':'nya','にゅ':'nyu','にょ':'nyo','ひゃ':'hya','ひゅ':'hyu','ひょ':'hyo','みゃ':'mya','みゅ':'myu','みょ':'myo','りゃ':'rya','りゅ':'ryu','りょ':'ryo','ぎゃ':'gya','ぎゅ':'gyu','ぎょ':'gyo','じゃ':'ja','じゅ':'ju','じょ':'jo','びゃ':'bya','びゅ':'byu','びょ':'byo','ぴゃ':'pya','ぴゅ':'pyu','ぴょ':'pyo'};
    Object.keys(digraphs).forEach(h => { const k = h.split('').map(ch => { const code = ch.charCodeAt(0); return (code >= 0x3041 && code <= 0x3096) ? String.fromCharCode(code + 0x60) : ch; }).join(''); digraphs[k] = digraphs[h]; });
    let out = '';
    for (let i = 0; i < s.length; i++) {
      const two = s.substr(i, 2);
      if (digraphs[two]) { out += digraphs[two]; i += 1; continue; }
      const ch = s[i];
      if (ch === 'っ' || ch === String.fromCharCode('ッ'.charCodeAt(0))) { const next = s[i+1] || ''; const nextRomaji = (hiraganaMap[next] || katakanaMap[next] || '').replace(/[^a-z-].*/i, ''); if (nextRomaji) out += nextRomaji.charAt(0); continue; }
      if (hiraganaMap[ch]) { out += hiraganaMap[ch]; continue; }
      if (katakanaMap[ch]) { out += katakanaMap[ch]; continue; }
      out += ch;
    }
    out = out.replace(/ー/g, '-').replace(/\s+/g, ' ').replace(/-+/g, '-').trim();
    return out || null;
  }

  const japaneseCharRE = /[\u3000-\u303F\u3040-\u30FF\u4E00-\u9FFF]/;

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
              japanese: null,
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
          // try to get native title from multiple attribute locations
          const candidates = [
            a.attr('data-jname'), a.attr('data-iname'), a.attr('title'),
            el$.find('.film-title').attr('data-jname'), el$.find('.film-title').attr('data-iname'),
            el$.find('img').attr('data-jname'), el$.find('img').attr('data-iname'), el$.find('img').attr('alt')
          ];
          for (const c of candidates) {
            if (c && typeof c === 'string') { item.japanese = romanizeJapanese(c.trim()); break; }
          }
          // fallback: if title contains Japanese characters, romanize the title
          if (!item.japanese && title && japaneseCharRE.test(title)) {
            item.japanese = romanizeJapanese(title);
          }
          items.push(item);
        }
      }
    });

    if (items.length) break;
  }

  return items;
}
