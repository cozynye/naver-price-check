// 상품 페이지에서 네이버 검색어를 만든다. 클래식 스크립트: 페이지에 주입되고(executeScript) 테스트에서는 require로 읽는다.
(function (root) {
  'use strict';

  const PROMO = /무료배송|당일|핫딜|특가|단독|공식몰|돌파|세일|SALE|MADE|옵션|베스트|시리즈|국내제작|최저가|비노출|코디|ONLY|일일|중고|사은품|증정|기획|한정|이벤트|쿠폰|할인|신상|NEW|HOT|BEST|추천|인기|주문폭주|리오더|재입고|예약|선착순|%|만장|만켤레|천장|기장|S~|~X|FREE|택1|SET/i;
  const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B55}\u{203C}\u{2049}\u{FE0F}\u{200D}\u{2300}-\u{23FF}\u{2190}-\u{21FF}\u{2900}-\u{297F}\u{3030}\u{303D}\u{3297}\u{3299}\u{00A9}\u{00AE}\u{2122}\u{2139}\u{E000}-\u{F8FF}]/gu;
  const GENERIC_SEG = /공식|온라인|스토어|쇼핑몰|쇼핑|사이즈|후기|리뷰|소비자평점|내돈내산|안심|거래|정품|새 창|네이버|모든 취향|감성|데일리룩|한국어/i;
  const SEG_SPLIT = /\s+[|\-–—:]+\s+|\s*::\s*|\s+by\s+/;
  const EDGE = /^[ \-_,/|·:]+|[ \-_,/|·:]+$/g;
  const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

  function decodeEntities(s) {
    return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') {
        const code = /^#x/i.test(e) ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
      }
      const key = e.toLowerCase();
      return Object.prototype.hasOwnProperty.call(ENTITIES, key) ? ENTITIES[key] : m;
    });
  }

  function stripTags(s) {
    return decodeEntities(String(s ?? '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  }

  function hasHangul(s) {
    return /[가-힣]/.test(s || '');
  }

  function tokens(s) {
    return new Set(String(s ?? '').toLowerCase().split(/[\s\[\]()|/,\-_:·]+/).filter((t) => t.length >= 2));
  }

  function overlap(a, b) {
    const ta = tokens(a);
    const tb = tokens(b);
    let n = 0;
    for (const t of ta) if (tb.has(t)) n += 1;
    return n / Math.max(1, Math.min(ta.size, tb.size));
  }

  function count(s, ch) {
    let n = 0;
    for (const c of s) if (c === ch) n += 1;
    return n;
  }

  function trimEdges(s) {
    return s.replace(EDGE, '');
  }

  // 코드 포인트 단위 절단: 이모지 같은 서로게이트 쌍을 가르지 않는다.
  function cut(s, n) {
    return Array.from(s).slice(0, n).join('');
  }

  function commonPrefix(names) {
    if (!names.length) return '';
    let p = Array.from(names[0]);
    for (const name of names.slice(1)) {
      const n = Array.from(name);
      let i = 0;
      while (i < Math.min(p.length, n.length) && p[i] === n[i]) i += 1;
      p = p.slice(0, i);
    }
    p = p.join('').replace(/\s+$/, '');
    if (!names.includes(p) && p.includes(' ')) p = p.slice(0, p.lastIndexOf(' '));
    return p.replace(/^[ \-_,/]+|[ \-_,/(\[]+$/g, '');
  }

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // siteNames: 문자열(부분 문자열로 비교, og:site_name) 또는 { token }(단어 단위로 비교, 호스트 라벨)
  function mentionsSite(seg, siteNames) {
    const sl = seg.toLowerCase().trim();
    const words = sl.split(/[^0-9a-z가-힣]+/).filter(Boolean);
    return siteNames.some((n) => {
      if (!n) return false;
      if (typeof n === 'string') return sl.includes(n) || n.includes(sl);
      return words.includes(n.token) || n.token.includes(sl);
    });
  }

  function stripSiteEdges(text, siteNames) {
    let s = text;
    for (const n of siteNames) {
      const name = typeof n === 'string' ? n : n && n.token;
      if (!name) continue;
      const re = escapeRe(name);
      s = s.replace(new RegExp(`^${re}\\s*[-\u2013\u2014|:]+\\s*`, 'i'), '').replace(new RegExp(`\\s*[-\u2013\u2014|:]+\\s*${re}$`, 'i'), '');
    }
    return s.trim();
  }

  function stripSiteName(text, siteNames) {
    const segs = stripSiteEdges(text, siteNames).split(SEG_SPLIT);
    if (segs.length === 1) return segs[0].trim();
    const keep = [];
    for (const seg of segs) {
      const sl = seg.toLowerCase().trim();
      if (!sl) continue;
      if (mentionsSite(seg, siteNames)) continue;
      if (GENERIC_SEG.test(sl) && sl.length < 25) continue;
      keep.push(seg.trim());
    }
    if (!keep.length) return segs[0].trim();
    return keep.reduce((best, s) => (s.length > best.length ? s : best), keep[0]);
  }

  function cleanTitle(name) {
    let s = String(name ?? '').replace(EMOJI, ' ');
    s = s.replace(/\[([^\[\]]*)\]/g, (m, inner) => (PROMO.test(inner) || (/\d/.test(inner) && /[/~]/.test(inner)) ? ' ' : m));
    s = s.replace(/\(([^()]*)\)/g, (m, inner) => (PROMO.test(inner) && /[/~]/.test(inner) ? ' ' : m));
    s = s.replace(/\([^()]*(?:[/,\-·][^()]*){3,}\)/g, ' ');
    // 옵션 꼬리: 색상 수, FREE, 알파벳 사이즈, 한국 신발 사이즈(220~300). 두 자리 숫자는 '9-95' 같은 모델명과 겹쳐 떼지 않는다.
    s = s.replace(/\s*[-_]\s*(\d*colors?|FREE|free|S|M|L|XL|XXL|2XL|3XL|2[2-9][05]|300)\s*$/, ' ');
    s = trimEdges(s.replace(/\s+/g, ' '));
    if (Array.from(s).length > 60) {
      const head = cut(s, 60);
      s = head.slice(30).includes(' ') ? head.slice(0, head.lastIndexOf(' ')) : head;
    }
    s = trimEdges(s);
    if (count(s, '(') > count(s, ')')) s = s.replace(/\([^()]*$/, '');
    if (count(s, '[') > count(s, ']')) s = s.replace(/\[[^\[\]]*$/, '');
    s = trimEdges(s);
    if (s.startsWith(')') || s.startsWith(']')) s = s.slice(1).trim();
    return s.trim();
  }

  function pickJsonLd(products, ref) {
    const names = products.map((p) => p.name).filter((n) => n && n.length >= 3);
    if (names.length === 1) return { name: names[0], brand: products[0].brand, source: 'jsonld' };
    if (names.length > 1) {
      const cp = commonPrefix(names);
      const shortest = Math.min(...names.map((n) => n.length));
      if (cp.length >= 8 && cp.length >= 0.5 * shortest) return { name: cp, brand: products[0].brand, source: 'jsonld-variants' };
      let best = null;
      let bestScore = -1;
      for (const p of products) {
        const sc = overlap(p.name, ref);
        if (sc > bestScore) { best = p; bestScore = sc; }
      }
      if (best && best.name && bestScore >= 0.5) return { name: best.name, brand: best.brand, source: 'jsonld-pick' };
    }
    return null;
  }

  function siteNamesOf(signals) {
    const host = String(signals.host || '').toLowerCase();
    const label = host.replace(/^(www|m|shop|store|mall|web|item|items|product|products|goods|detail|prod|pc|mobile|front|brand)\./, '').split('.')[0];
    const names = [];
    if (signals.ogSiteName) names.push(String(signals.ogSiteName).toLowerCase());
    if (label.length >= 3) names.push({ token: label });
    return names;
  }

  function buildQuery(signals) {
    const siteNames = siteNamesOf(signals);
    const og = signals.ogTitle ? stripTags(signals.ogTitle) : '';
    const title = signals.title ? stripTags(signals.title) : '';
    const h1 = signals.h1 ? stripTags(signals.h1) : '';
    const products = (signals.jsonld || []).map((p) => ({ name: p && p.name ? stripTags(p.name) : null, brand: p && p.brand ? stripTags(p.brand) : null }));
    const ref = [og, title, h1].filter(Boolean).join(' ');

    let cand = '';
    let source = 'none';
    let brand = null;

    if (products.length) {
      const picked = pickJsonLd(products, ref);
      if (picked) {
        cand = picked.name;
        brand = picked.brand || null;
        source = picked.source;
        if (!hasHangul(cand)) {
          const altSrc = [og, h1, title].find((x) => x && hasHangul(x));
          if (altSrc) {
            const alt = stripSiteName(altSrc, siteNames);
            if (alt && !(overlap(alt, cand) < 0.3 && alt.length >= 4)) {
              cand = alt;
              source = source + '+korean';
            }
          }
        }
      }
    }

    function fromTitleLike(text, name) {
      if (!cand && text) {
        const c = stripSiteName(text, siteNames);
        if (c && c.length >= 4 && !siteNames.includes(c.toLowerCase())) { cand = c; source = name; }
      }
    }
    fromTitleLike(og, 'og:title');
    fromTitleLike(title, 'title');
    if (!cand && h1 && h1.length >= 4) { cand = h1; source = 'h1'; }
    if (cand && !products.length && h1 && h1.length >= 4 && (source === 'og:title' || source === 'title') && cand.startsWith(h1)) {
      cand = h1;
      source = 'h1';
    }

    if (!cand) return { query: '', source: 'none', brand: null };
    let q = cleanTitle(cand);
    if (brand && brand.length >= 2 && !q.toLowerCase().includes(brand.toLowerCase()) && q.length + brand.length < 70) {
      q = `${cleanTitle(brand)} ${q}`.trim();
    }
    return { query: q, source, brand };
  }

  function parseJsonLd(text) {
    try { return JSON.parse(text); } catch (e) { /* 끝 쉼표를 지우고 한 번 더 */ }
    try { return JSON.parse(text.replace(/,\s*([}\]])/g, '$1')); } catch (e) { return null; }
  }

  function collectSignals(doc) {
    const meta = (p) => {
      const el = doc.querySelector(`meta[property="${p}"], meta[name="${p}"]`);
      const v = el ? el.getAttribute('content') : null;
      return v == null || v === '' ? null : v;
    };
    const jsonld = [];
    for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
      const data = parseJsonLd(s.textContent || '');
      if (data == null) continue;
      const stack = [data];
      while (stack.length) {
        const d = stack.pop();
        if (Array.isArray(d)) { stack.push(...d); continue; }
        if (!d || typeof d !== 'object') continue;
        const t = d['@type'];
        if (t === 'Product' || (Array.isArray(t) && t.includes('Product'))) {
          const b = d.brand && typeof d.brand === 'object' ? d.brand.name : d.brand;
          if (typeof d.name === 'string') jsonld.push({ name: d.name, brand: typeof b === 'string' ? b : null });
        }
        for (const v of Object.values(d)) if (v && typeof v === 'object') stack.push(v);
      }
    }
    const h1El = doc.querySelector('h1');
    const h1Text = h1El ? String(h1El.textContent || '').replace(/\s+/g, ' ').trim() : '';
    return {
      host: doc.location && doc.location.hostname ? doc.location.hostname : '',
      ogTitle: meta('og:title'),
      ogSiteName: meta('og:site_name'),
      ogType: meta('og:type'),
      title: doc.title ? String(doc.title) : null,
      h1: h1Text || null,
      jsonld,
    };
  }

  function extractFromPage(doc, selection) {
    try {
      const sel = String(selection ?? '').replace(/\s+/g, ' ').trim();
      if (sel) return { query: cut(sel, 100).trim(), source: 'selection', brand: null };
      return buildQuery(collectSignals(doc));
    } catch (e) {
      return { query: '', source: 'none', brand: null };
    }
  }

  const api = { stripTags, hasHangul, tokens, overlap, commonPrefix, stripSiteName, cleanTitle, pickJsonLd, buildQuery, collectSignals, extractFromPage };
  root.NaverPriceCheck = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
