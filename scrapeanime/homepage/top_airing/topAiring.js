export default function scrapeTopAiring($, resolveUrl, source) {
  const items = [];
  function romanizeJapanese(input) {
    if (!input || typeof input !== 'string') return null;
    if (/[A-Za-z0-9]/.test(input)) return input.trim();

    const s = input.trim();
    const hiraganaMap = {
      'あ':'a','い':'i','う':'u','え':'e','お':'o',
      'か':'ka','き':'ki','く':'ku','け':'ke','こ':'ko',
      'さ':'sa','し':'shi','す':'su','せ':'se','そ':'so',
      'た':'ta','ち':'chi','つ':'tsu','て':'te','と':'to',
      'な':'na','に':'ni','ぬ':'nu','ね':'ne','の':'no',
      'は':'ha','ひ':'hi','ふ':'fu','へ':'he','ほ':'ho',
      'ま':'ma','み':'mi','む':'mu','め':'me','も':'mo',
      'や':'ya','ゆ':'yu','よ':'yo',
      'ら':'ra','り':'ri','る':'ru','れ':'re','ろ':'ro',
      'わ':'wa','ゐ':'wi','ゑ':'we','を':'wo','ん':'n',
      'が':'ga','ぎ':'gi','ぐ':'gu','げ':'ge','ご':'go',
      'ざ':'za','じ':'ji','ず':'zu','ぜ':'ze','ぞ':'zo',
      'だ':'da','ぢ':'ji','づ':'zu','で':'de','ど':'do',
      'ば':'ba','び':'bi','ぶ':'bu','べ':'be','ぼ':'bo',
      'ぱ':'pa','ぴ':'pi','ぷ':'pu','ぺ':'pe','ぽ':'po',
      'ぁ':'a','ぃ':'i','ぅ':'u','ぇ':'e','ぉ':'o',
      'っ':'','ゃ':'ya','ゅ':'yu','ょ':'yo','ー':'-'
    };
    const katakanaMap = {};
    Object.keys(hiraganaMap).forEach(h => {
      const code = h.charCodeAt(0);
      let k = null;
      if (code >= 0x3041 && code <= 0x3096) k = String.fromCharCode(code + 0x60);
      if (k) katakanaMap[k] = hiraganaMap[h];
    });

    const digraphs = {
      'きゃ':'kya','きゅ':'kyu','きょ':'kyo',
      'しゃ':'sha','しゅ':'shu','しょ':'sho',
      'ちゃ':'cha','ちゅ':'chu','ちょ':'cho',
      'にゃ':'nya','にゅ':'nyu','にょ':'nyo',
      'ひゃ':'hya','ひゅ':'hyu','ひょ':'hyo',
      'みゃ':'mya','みゅ':'myu','みょ':'myo',
      'りゃ':'rya','りゅ':'ryu','りょ':'ryo',
      'ぎゃ':'gya','ぎゅ':'gyu','ぎょ':'gyo',
      'じゃ':'ja','じゅ':'ju','じょ':'jo',
      'びゃ':'bya','びゅ':'byu','びょ':'byo',
      'ぴゃ':'pya','ぴゅ':'pyu','ぴょ':'pyo'
    };

    Object.keys(digraphs).forEach(h => {
      const k = h.split('').map(ch => {
        const code = ch.charCodeAt(0);
        return (code >= 0x3041 && code <= 0x3096) ? String.fromCharCode(code + 0x60) : ch;
      }).join('');
      digraphs[k] = digraphs[h];
    });

    let out = '';
    for (let i = 0; i < s.length; i++) {
      const two = s.substr(i, 2);
      if (digraphs[two]) { out += digraphs[two]; i += 1; continue; }

      const ch = s[i];
      if (ch === 'っ' || ch === String.fromCharCode('ッ'.charCodeAt(0))) {
        const next = s[i+1] || '';
        const nextRomaji = (hiraganaMap[next] || katakanaMap[next] || '').replace(/[^a-z-].*/i, '');
        if (nextRomaji) out += nextRomaji.charAt(0);
        continue;
      }

      if (hiraganaMap[ch]) { out += hiraganaMap[ch]; continue; }
      if (katakanaMap[ch]) { out += katakanaMap[ch]; continue; }
      out += ch;
    }

    out = out.replace(/ー/g, '-').replace(/\s+/g, ' ').replace(/-+/g, '-').trim();
    return out || null;
  }

  $('div.anif-block').each((i, block) => {
    const block$ = $(block);
    const header = block$.find('.anif-block-header').text() || '';
    if (!/top\s*airing/i.test(header)) return;

    block$.find('.anif-block-ul ul.ulclear > li').slice(0, 6).each((j, li) => {
      const el$ = $(li);
      const a = el$.find('h3.film-name a').first();
      let href = a.attr('href') || el$.find('a').first().attr('href') || '';
      href = href ? resolveUrl(href) : null;

      let title = a.attr('title') || a.attr('data-jname') || a.text() || null;
      if (title) title = title.trim();

  // attempt to get the Japanese raw name (data-jname often contains native title)
  let japaneseRaw = a.attr('data-jname') || a.attr('data-jtitle') || el$.find('h3.film-name').attr('data-jname') || null;
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
      const dub = (dubText || '').toString().replace(/[,\s"']/g, '').match(/(\d+)/);
      const sub = (subText || '').toString().replace(/[,\s"']/g, '').match(/(\d+)/);

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
        section: 'top_airing',
      });
    });
  });

  return items;
}
