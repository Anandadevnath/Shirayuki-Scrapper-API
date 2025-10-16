export default function scrapeTrending($, resolveUrl, source) {
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
        // attempt to set japanese from multiple attribute locations
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
        // fallback: if title contains Japanese characters, romanize the title
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