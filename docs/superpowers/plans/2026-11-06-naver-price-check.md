# naver-price-check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 보고 있는 상품 페이지에서 상품명을 뽑아 네이버 쇼핑 검색 탭을 여는 Chrome 익스텐션(Manifest V3)을 만든다.

**Architecture:** 추출 논리는 `extractor.js` 한 파일의 순수 함수(`buildQuery`)에 두고, DOM 접근은 같은 파일의 `collectSignals`로 격리한다. 팝업은 `chrome.scripting.executeScript`로 `extractor.js`를 현재 탭에 주입해 결과를 받고, `naver.js`가 만든 URL로 새 탭을 연다. 서비스 워커는 우클릭 메뉴만 담당한다.

**Tech Stack:** Chrome Extension Manifest V3, 바닐라 JavaScript(빌드 도구 없음), Node 22 내장 `node --test`, Python 3 표준 라이브러리(아이콘 생성).

**Spec:** `docs/superpowers/specs/2026-11-06-naver-price-check-design.md`

## Global Constraints

- 런타임 의존성 없음. devDependencies도 없음. 테스트는 `node --test tests/`로만 돈다(Node 22).
- 권한은 `activeTab`, `scripting`, `contextMenus` 세 개만. `host_permissions` 없음. 네트워크 요청 없음. 저장소(storage) 사용 없음.
- `extractor.js`와 `naver.js`는 클래식 스크립트다. ES `import`/`export`를 쓰지 않고 `globalThis.NaverPriceCheck`, `globalThis.NaverSearch`에 API를 올린 뒤 `module.exports`에도 올린다.
- 쇼핑 검색 URL은 `https://search.shopping.naver.com/search/all?query=`, 통합검색은 `https://search.naver.com/search.naver?query=`. 검색어는 `encodeURIComponent`로 인코딩한다.
- 익스텐션 표시 이름은 "네이버 쇼핑 바로검색". 아이콘에 네이버 로고나 네이버 색을 쓰지 않는다.
- 검색어 정리 상한은 60자(추출), 선택 텍스트는 100자.
- 커밋과 푸시는 사용자가 요청할 때만 한다. 이 계획의 태스크에는 커밋 단계가 없다.
- 문서(README, CLAUDE.md)는 플레이그라운드 문서 규칙(평서체, em dash 금지, 이모지 금지, 불릿 최소화)을 따른다. README는 초안을 사용자에게 보여 준 뒤 커밋한다.

## Review Focus

1. 메타도 제목도 h1도 없는 빈 페이지에서 아이콘을 누르면 팝업이 빈 입력란과 안내 문구를 보여야 하고 예외가 나면 안 된다. (Task 3 `buildQuery` 빈 신호 테스트, Task 4 `extractFromPage` 테스트)
2. JSON-LD가 깨진 JSON(끝 쉼표)이거나 아예 쓰레기일 때 전체 추출이 죽지 않고 다른 블록과 og:title로 넘어가야 한다. (Task 4 `collectSignals` 테스트)
3. 공백만 드래그한 상태에서 아이콘을 누르면 선택 텍스트가 아니라 페이지 추출 결과가 채워져야 한다. (Task 4 `extractFromPage` 테스트)
4. og:title이 사이트명뿐인 페이지(임블리 "임블리")에서 사이트명이 검색어로 들어가면 안 되고 JSON-LD나 title로 넘어가야 한다. (Task 3 단위 테스트와 임블리 픽스처)
5. `&`, `#`, `+`, `/`, 한글이 든 검색어가 URL에서 깨지면 안 되고, 100자를 넘는 선택 텍스트는 잘려야 한다. (Task 5 URL 테스트, Task 4 선택 텍스트 절단 테스트)

---

### Task 1: 프로젝트 골격

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `CLAUDE.md`
- Test: 없음(설정만)

**Interfaces:**
- Produces: `npm test`가 `node --test tests/`를 실행한다.

- [ ] **Step 1: package.json 작성**

```json
{
  "name": "naver-price-check",
  "version": "0.1.0",
  "private": true,
  "description": "보고 있는 상품을 네이버 쇼핑에서 바로 검색하는 Chrome 익스텐션",
  "type": "commonjs",
  "scripts": {
    "test": "node --test tests/"
  },
  "engines": {
    "node": ">=22"
  }
}
```

- [ ] **Step 2: .gitignore 작성**

```
node_modules/
.DS_Store
.playwright-mcp/
*.zip
```

- [ ] **Step 3: CLAUDE.md 작성**

```markdown
# naver-price-check

보고 있는 상품 페이지의 상품명을 뽑아 네이버 쇼핑 검색 탭을 여는 Chrome 익스텐션(Manifest V3).

## 언어와 런타임

바닐라 JavaScript, 빌드 도구 없음. 테스트는 Node 22 내장 `node --test`로 돈다. 런타임·개발 의존성 모두 없다.

## 실행

- 테스트: `npm test`
- 익스텐션 로드: `chrome://extensions` → 개발자 모드 → "압축해제된 확장 프로그램을 로드합니다" → 이 폴더 선택
- 아이콘 재생성: `python3 scripts/make-icons.py`

## 구조

- `extractor.js`: 상품명 추출. `collectSignals(document)`가 DOM에서 신호를 모으고 `buildQuery(signals)`가 검색어를 만든다. 페이지에 주입되고 테스트에서도 그대로 `require`한다.
- `naver.js`: 네이버 검색 URL 조립.
- `popup.*`: 툴바 팝업. `extractor.js`를 현재 탭에 주입해 결과를 받는다.
- `background.js`: 우클릭 메뉴.
- `tests/fixtures/sites.json`: 2026-11-06 조사에서 저장한 127곳 상품 페이지의 신호와 기대 검색어. 회귀 기준선이며 기대값을 바꿀 때는 바뀐 항목을 눈으로 확인한다.
- `docs/survey/`: 213곳 조사 보고서. `docs/superpowers/specs/`: 설계 문서.

## 규칙

- 사이트별 선택자(어댑터)를 추가하지 않는다. 범용 규칙으로 해결하거나 팝업에서 사용자가 고치게 둔다.
- 권한은 activeTab, scripting, contextMenus만. 네트워크 요청과 storage를 쓰지 않는다.
- 커밋은 사용자가 요청할 때만 하고 Co-Authored-By 등 Claude 표시를 넣지 않는다.
```

- [ ] **Step 4: 테스트 러너 동작 확인**

Run: `mkdir -p tests && npm test`
Expected: 테스트 파일이 없어 `node --test`가 0개 실행으로 종료(exit 0) 또는 "no test files" 안내. 오류 없이 끝나면 된다.

---

### Task 2: 정리 함수들 (`cleanTitle`, `stripSiteName`, `commonPrefix`, `overlap`)

**Files:**
- Create: `extractor.js`
- Test: `tests/extractor.test.js`

**Interfaces:**
- Produces:
  - `stripTags(s: string): string` 태그 제거, 엔티티 디코딩, 공백 축약, trim
  - `cleanTitle(name: string): string` 설계 문서 5절의 정리 규칙
  - `stripSiteName(text: string, siteNames: string[]): string` 구분자로 나눠 사이트명·상용구 구간 제거 후 가장 긴 구간
  - `commonPrefix(names: string[]): string`
  - `overlap(a: string, b: string): number` 0~1

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/extractor.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { stripTags, cleanTitle, stripSiteName, commonPrefix, overlap } = require('../extractor.js');

test('stripTags: 태그 제거, 엔티티 디코딩, 공백 축약', () => {
  assert.equal(stripTags('<b>[3옵션]</b> 슬랙스<br>(25~36)<i style="font-size:0">x</i>'), '[3옵션] 슬랙스 (25~36) x');
  assert.equal(stripTags('rom&amp;nd  틴트'), 'rom&nd 틴트');
  assert.equal(stripTags(null), '');
});

test('cleanTitle: 광고성 대괄호는 지우고 브랜드 대괄호는 남긴다', () => {
  assert.equal(cleanTitle('[무료배송] 케이던 롱 부츠'), '케이던 롱 부츠');
  assert.equal(cleanTitle('[3옵션][비타민슬랙스][MADE] 칼로리컷트2 슬랙스'), '칼로리컷트2 슬랙스');
  assert.equal(cleanTitle('[11월 올영픽/저자극레티놀앰플] 이니스프리 레티놀 앰플 30ml'), '이니스프리 레티놀 앰플 30ml');
  assert.equal(cleanTitle('[Black Diamond]밤쉘터 텐트 (BD810010)'), '[Black Diamond]밤쉘터 텐트 (BD810010)');
  assert.equal(cleanTitle('[ThalaSpa] 딸라슬리밍 배쓰 1L'), '[ThalaSpa] 딸라슬리밍 배쓰 1L');
});

test('cleanTitle: 숫자와 슬래시가 함께 든 소괄호 광고 태그를 지운다', () => {
  assert.equal(cleanTitle('(국내제작)(MADE/3기장/S~XL/탑셀러!) 3기장 H라인 베이직 스커트'), '(국내제작) 3기장 H라인 베이직 스커트');
});

test('cleanTitle: 구분자 3개 이상인 소괄호(검색어 나열)를 지운다', () => {
  assert.equal(cleanTitle('칼로리컷트2 슬랙스 (빅사이즈팬츠-스판슬랙스-스판팬츠-하객룩-출근룩)'), '칼로리컷트2 슬랙스');
  assert.equal(cleanTitle('워싱워크포켓야상패딩JP (누빔,한겨울 쭉)'), '워싱워크포켓야상패딩JP (누빔,한겨울 쭉)');
});

test('cleanTitle: 이모지와 장식 기호, 옵션 꼬리를 지운다', () => {
  assert.equal(cleanTitle('🏷️단독진행 에코 앙고라 브이넥니트 ❄️'), '단독진행 에코 앙고라 브이넥니트');
  assert.equal(cleanTitle('시크릿 레이스바디수트-♥핫핑♥'), '시크릿 레이스바디수트-핫핑');
  assert.equal(cleanTitle('Poppy 0070. Embroidered Boots - 2colors'), 'Poppy 0070. Embroidered Boots');
  assert.equal(cleanTitle('우트 내추럴 코튼원피스 베이지-FREE'), '우트 내추럴 코튼원피스 베이지');
});

test('cleanTitle: 60자를 넘으면 단어 경계에서 자르고 짝 안 맞는 괄호를 정리한다', () => {
  const long = '[마인드브릿지]본사 여성 그랜드십일절 FW 인기 BEST 아이템 최대특가 캐시미어 울 코트/다운 패딩/가죽 스웨이드 점퍼/니트/가디건//자켓/슬랙스 외 BEST 100종~85%OFF';
  const out = cleanTitle(long);
  assert.ok(out.length <= 60, out);
  assert.ok(!out.endsWith('/'), out);
  assert.equal(cleanTitle('테팔 커피메이커 CM-3618 (1.25L) 아주아주아주아주아주아주아주아주아주아주아주아주 긴 이름 (추가설명'), '테팔 커피메이커 CM-3618 (1.25L) 아주아주아주아주아주아주아주아주아주아주아주아주 긴 이름');
});

test('stripSiteName: 사이트명 구간과 짧은 상용구 구간을 버리고 가장 긴 구간을 남긴다', () => {
  assert.equal(stripSiteName('아디다스(ADIDAS) 레알 마드리드 써드 저지 14/15 KF4243 - 사이즈 & 후기 | 무신사', ['무신사', 'musinsa']), '아디다스(ADIDAS) 레알 마드리드 써드 저지 14/15 KF4243');
  assert.equal(stripSiteName('바디필로우 Body Pillow - 모든 취향 곁에, 29CM', ['29cm']), '바디필로우 Body Pillow');
  assert.equal(stripSiteName('루나미 소프트 오버나이트 - 일반 오버나이트 | 쿠팡', ['쿠팡', 'coupang']), '루나미 소프트 오버나이트');
  assert.equal(stripSiteName('퀸잇 - 펜디 [중고명품] FF 몬트레조 버킷백 8BT298 5493', ['queenit']), '펜디 [중고명품] FF 몬트레조 버킷백 8BT298 5493');
  assert.equal(stripSiteName('블랙 CORAL C3 53mm 안경테 :: 라운즈(ROUNZ) - 세상에 없던 안경쇼핑', ['rounz']), '블랙 CORAL C3 53mm 안경테');
  assert.equal(stripSiteName('구분자 없는 제목', ['x']), '구분자 없는 제목');
  assert.equal(stripSiteName('임블리 | 임블리', ['임블리', 'imvely']), '임블리');
});

test('commonPrefix: 옵션 변형 이름들의 공통 접두사를 단어 경계로 돌려준다', () => {
  assert.equal(commonPrefix(['워싱워크포켓야상패딩JP (누빔,한겨울 쭉) 퍼플-FREE', '워싱워크포켓야상패딩JP (누빔,한겨울 쭉) 카키-FREE']), '워싱워크포켓야상패딩JP (누빔,한겨울 쭉)');
  assert.equal(commonPrefix(['롬앤 더 쥬시 래스팅 틴트 #두유 42 소이 피그', '롬앤 더 쥬시 래스팅 틴트 #두유 43 피치']), '롬앤 더 쥬시 래스팅 틴트 #두유');
  assert.equal(commonPrefix(['같은 이름', '같은 이름']), '같은 이름');
  assert.equal(commonPrefix([]), '');
});

test('overlap: 공통 토큰 수를 짧은 쪽 토큰 수로 나눈다', () => {
  assert.equal(overlap('세라마이드 아토 로션 350ml', '[일리윤]세라마이드 아토 로션 | 아모레몰 세라마이드 아토 로션 350ml'), 1);
  assert.equal(overlap('Ceramide Ato Lotion 350ml', '[일리윤]세라마이드 아토 로션'), 0);
  assert.equal(overlap('', 'abc'), 0);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test`
Expected: FAIL. `Cannot find module '../extractor.js'`

- [ ] **Step 3: 구현**

`extractor.js`:

```js
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

  function commonPrefix(names) {
    if (!names.length) return '';
    let p = names[0];
    for (const n of names.slice(1)) {
      let i = 0;
      while (i < Math.min(p.length, n.length) && p[i] === n[i]) i += 1;
      p = p.slice(0, i);
    }
    p = p.replace(/\s+$/, '');
    if (!names.includes(p) && p.includes(' ')) p = p.slice(0, p.lastIndexOf(' '));
    return p.replace(/^[ \-_,/(\[]+|[ \-_,/(\[]+$/g, '');
  }

  function stripSiteName(text, siteNames) {
    const segs = text.split(SEG_SPLIT);
    if (segs.length === 1) return text.trim();
    const keep = [];
    for (const seg of segs) {
      const sl = seg.toLowerCase().trim();
      if (!sl) continue;
      if (siteNames.some((n) => n && (sl.includes(n) || n.includes(sl)))) continue;
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
    s = s.replace(/\s*[-_]\s*(\d*colors?|FREE|free|S|M|L|XL|XXL|2XL|3XL|\d{2,3}(?:-\d{2,3})?)\s*$/, ' ');
    s = trimEdges(s.replace(/\s+/g, ' '));
    if (s.length > 60) {
      const cut = s.slice(0, 60);
      s = cut.slice(30).includes(' ') ? cut.slice(0, cut.lastIndexOf(' ')) : cut;
    }
    s = trimEdges(s);
    if (count(s, '(') > count(s, ')')) s = s.replace(/\([^()]*$/, '');
    if (count(s, '[') > count(s, ']')) s = s.replace(/\[[^\[\]]*$/, '');
    s = trimEdges(s);
    if (s.startsWith(')') || s.startsWith(']')) s = s.slice(1).trim();
    return s.trim();
  }

  const api = { stripTags, hasHangul, tokens, overlap, commonPrefix, stripSiteName, cleanTitle };
  root.NaverPriceCheck = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
```

- [ ] **Step 4: 통과 확인**

Run: `npm test`
Expected: PASS. 실패하는 단언이 있으면 기대값이 아니라 규칙 구현을 먼저 의심한다. 기대값은 설계 문서 5절의 예시에서 왔다.

---

### Task 3: `buildQuery` (후보 선택과 브랜드 결합) + 127곳 픽스처 회귀

**Files:**
- Modify: `extractor.js` (api 객체 앞에 함수 추가, api에 `pickJsonLd`, `buildQuery` 추가)
- Test: `tests/extractor.test.js` (추가), `tests/fixtures/sites.json` (이미 있음)

**Interfaces:**
- Consumes: Task 2의 `stripTags`, `hasHangul`, `overlap`, `commonPrefix`, `stripSiteName`, `cleanTitle`
- Produces:
  - 신호 객체 형태: `{ host: string, ogTitle: string|null, ogSiteName: string|null, ogType: string|null, title: string|null, h1: string|null, jsonld: Array<{ name: string|null, brand: string|null }> }`
  - `pickJsonLd(products, ref: string): { name, brand, source } | null` (`source`는 `'jsonld' | 'jsonld-variants' | 'jsonld-pick'`)
  - `buildQuery(signals): { query: string, source: string, brand: string|null }` (`source`는 `'jsonld' | 'jsonld-variants' | 'jsonld-pick' | 'jsonld+korean' | 'jsonld-variants+korean' | 'jsonld-pick+korean' | 'og:title' | 'title' | 'h1' | 'none'`)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/extractor.test.js`에 추가:

```js
const fs = require('node:fs');
const path = require('node:path');
const { pickJsonLd, buildQuery } = require('../extractor.js');

function sig(over) {
  return { host: 'www.example.com', ogTitle: null, ogSiteName: null, ogType: null, title: null, h1: null, jsonld: [], ...over };
}

test('buildQuery: 신호가 없으면 빈 검색어와 none', () => {
  assert.deepEqual(buildQuery(sig({})), { query: '', source: 'none', brand: null });
});

test('buildQuery: JSON-LD 하나면 그 이름을 쓰고 브랜드를 앞에 붙인다', () => {
  const r = buildQuery(sig({ host: 'www.musinsa.com', ogSiteName: '무신사', ogTitle: '아디다스(ADIDAS) 레알 마드리드 써드 저지 14/15 KF4243 - 사이즈 & 후기 | 무신사', jsonld: [{ name: '레알 마드리드 써드 저지 14/15 KF4243', brand: '아디다스' }] }));
  assert.equal(r.query, '아디다스 레알 마드리드 써드 저지 14/15 KF4243');
  assert.equal(r.source, 'jsonld');
});

test('buildQuery: 이름에 브랜드가 이미 있으면 붙이지 않는다', () => {
  const r = buildQuery(sig({ jsonld: [{ name: '쿠쿠 커피머신 더크레마', brand: '쿠쿠' }] }));
  assert.equal(r.query, '쿠쿠 커피머신 더크레마');
});

test('buildQuery: 옵션 변형 JSON-LD는 공통 접두사를 쓴다', () => {
  const r = buildQuery(sig({ jsonld: [{ name: '워싱워크포켓야상패딩JP (누빔,한겨울 쭉) 퍼플-FREE', brand: '육육걸즈' }, { name: '워싱워크포켓야상패딩JP (누빔,한겨울 쭉) 카키-FREE', brand: '육육걸즈' }] }));
  assert.equal(r.query, '육육걸즈 워싱워크포켓야상패딩JP (누빔,한겨울 쭉)');
  assert.equal(r.source, 'jsonld-variants');
});

test('buildQuery: 추천 목록형 JSON-LD는 og/title과 겹치는 항목을 고르고, 영문이면 한글 h1을 우선한다', () => {
  const list = [{ name: 'Ceramide Ato Lotion 350ml', brand: null }, { name: 'Green Tea Seed Serum 80ml', brand: null }, { name: 'Time Response Cream', brand: null }];
  const r = buildQuery(sig({ host: 'www.amoremall.com', ogTitle: '[일리윤]세라마이드 아토 로션 | 아모레몰', title: '[일리윤]세라마이드 아토 로션 | 아모레몰', h1: '세라마이드 아토 로션 350ml', jsonld: list }));
  assert.equal(r.query, '세라마이드 아토 로션 350ml');
  assert.equal(r.source, 'jsonld-pick+korean');
});

test('buildQuery: 목록형 JSON-LD가 og/title과 겹치지 않으면 버리고 og:title로 간다', () => {
  const r = buildQuery(sig({ host: 'shop.example.com', ogTitle: '진짜 상품명 ABC-100 | 예시몰', jsonld: [{ name: '엉뚱한 추천 상품 1', brand: null }, { name: '엉뚱한 추천 상품 2', brand: null }] }));
  assert.equal(r.query, '진짜 상품명 ABC-100');
  assert.equal(r.source, 'og:title');
});

test('buildQuery: og:title이 사이트명뿐이면 건너뛴다 (임블리)', () => {
  const r = buildQuery(sig({ host: 'imvely.com', ogSiteName: '임블리', ogTitle: '임블리', title: 'LOVE ME MORE :: 임블리-imvely', jsonld: [{ name: '블리블리 바쿠치올 앰플 100ml', brand: '임블리' }] }));
  assert.equal(r.query, '임블리 블리블리 바쿠치올 앰플 100ml');
  const r2 = buildQuery(sig({ host: 'imvely.com', ogSiteName: '임블리', ogTitle: '임블리', title: '진짜 상품명 | 임블리' }));
  assert.equal(r2.query, '진짜 상품명');
  assert.equal(r2.source, 'title');
});

test('buildQuery: og:title이 없으면 title, 그다음 h1', () => {
  assert.equal(buildQuery(sig({ host: 'www.coupang.com', title: '루나미 소프트 오버나이트 - 일반 오버나이트 | 쿠팡' })).query, '루나미 소프트 오버나이트');
  assert.deepEqual(buildQuery(sig({ h1: '그리프X GTX' })), { query: '그리프X GTX', source: 'h1', brand: null });
  assert.equal(buildQuery(sig({ h1: '짧음' })).source, 'none');
});

test('buildQuery: 카카오톡 선물하기처럼 title에 상품명이 없고 og:title에만 있는 경우', () => {
  const r = buildQuery(sig({ host: 'gift.kakao.com', ogSiteName: '선물하기', ogTitle: '[1+1][탐라왕] 달콤한 과즙이 가득, 제주 황금향 2kg 2박스 (총 4kg)', title: '상품 : 선물하기' }));
  assert.equal(r.query, '[1+1][탐라왕] 달콤한 과즙이 가득, 제주 황금향 2kg 2박스 (총 4kg)');
  assert.equal(r.source, 'og:title');
});

test('pickJsonLd: 이름이 3자 미만인 항목은 무시한다', () => {
  assert.equal(pickJsonLd([{ name: 'ab', brand: null }, { name: '진짜 상품명', brand: 'B' }], '').name, '진짜 상품명');
  assert.equal(pickJsonLd([{ name: 'ab', brand: null }], ''), null);
});

const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'sites.json'), 'utf8'));
for (const f of fixtures) {
  test(`fixture ${f.category}/${f.name}: ${f.expected_query}`, () => {
    const r = buildQuery({ host: f.host, ogTitle: f.og_title, ogSiteName: f.og_site_name, ogType: f.og_type, title: f.title, h1: f.h1, jsonld: f.jsonld });
    assert.equal(r.query, f.expected_query);
  });
}
```

- [ ] **Step 2: 실패 확인**

Run: `npm test`
Expected: FAIL. `buildQuery is not a function` 류의 오류로 새 테스트가 전부 실패한다.

- [ ] **Step 3: 구현**

`extractor.js`의 `cleanTitle` 뒤, `const api = ...` 앞에 추가하고 api에 `pickJsonLd, buildQuery`를 넣는다:

```js
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
    const label = host.replace(/^(www|m|shop|store|mall|web)\./, '').split('.')[0];
    return [signals.ogSiteName, label].filter(Boolean).map((s) => String(s).toLowerCase());
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

    if (!cand) return { query: '', source: 'none', brand: null };
    let q = cleanTitle(cand);
    if (brand && brand.length >= 2 && !q.toLowerCase().includes(brand.toLowerCase()) && q.length + brand.length < 70) {
      q = `${cleanTitle(brand)} ${q}`.trim();
    }
    return { query: q, source, brand };
  }
```

api 줄을 다음으로 바꾼다:

```js
  const api = { stripTags, hasHangul, tokens, overlap, commonPrefix, stripSiteName, cleanTitle, pickJsonLd, buildQuery };
```

- [ ] **Step 4: 통과 확인과 픽스처 불일치 검토**

Run: `npm test 2>&1 | tail -40`
Expected: 단위 테스트는 전부 PASS. 픽스처 127개 중 실패가 있으면 각 항목을 눈으로 본다. 파이썬 프로토타입과 정규식 동작이 달라서 생긴 차이(유니코드 공백, `\d` 범위)는 구현을 고쳐 맞추고, JS 결과가 사람이 봐도 더 나은 경우에만 `tests/fixtures/sites.json`의 `expected_query`를 바꾼다. 바꾼 항목은 이름과 전후 값을 작업 기록에 남긴다.

---

### Task 4: `collectSignals`, `extractFromPage`, h1 우선 규칙

**Files:**
- Modify: `extractor.js` (`buildQuery` 수정, 함수 추가, api 확장)
- Test: `tests/extractor.test.js` (추가), `tests/helpers/fake-document.js` (새로 만듦)

**Interfaces:**
- Consumes: Task 3의 `buildQuery`, 신호 객체 형태
- Produces:
  - `collectSignals(doc): signals` (`doc`는 `querySelector`, `querySelectorAll`, `title`, `location.hostname`만 쓴다)
  - `extractFromPage(doc, selection: string): { query, source, brand }` (`source`에 `'selection'` 추가, 예외는 모두 잡아 `'none'`)

- [ ] **Step 1: 가짜 document 헬퍼 작성**

`tests/helpers/fake-document.js`:

```js
'use strict';
// querySelector / querySelectorAll 중 이 프로젝트가 쓰는 선택자만 지원하는 가짜 document.
// 지원: `tag`, `tag[attr="value"]`, 그리고 쉼표로 이어진 선택자 목록.
function makeDocument({ hostname = 'www.example.com', title = '', elements = [] } = {}) {
  function matches(el, selector) {
    const m = /^([a-z0-9]+)(?:\[([a-z:-]+)="([^"]*)"\])?$/i.exec(selector.trim());
    if (!m) throw new Error(`unsupported selector in fake document: ${selector}`);
    if (el.tag !== m[1].toLowerCase()) return false;
    if (m[2] && (el.attrs || {})[m[2]] !== m[3]) return false;
    return true;
  }
  function all(selector) {
    const parts = selector.split(',');
    return elements.filter((el) => parts.some((p) => matches(el, p)));
  }
  return {
    title,
    location: { hostname },
    querySelector(selector) { return all(selector)[0] || null; },
    querySelectorAll(selector) { return all(selector); },
  };
}

function meta(attrName, name, content) {
  return { tag: 'meta', attrs: { [attrName]: name, content }, getAttribute(a) { return this.attrs[a] ?? null; } };
}
function script(json) {
  return { tag: 'script', attrs: { type: 'application/ld+json' }, textContent: json, getAttribute(a) { return this.attrs[a] ?? null; } };
}
function h1(text) {
  return { tag: 'h1', attrs: {}, textContent: text, getAttribute(a) { return this.attrs[a] ?? null; } };
}

module.exports = { makeDocument, meta, script, h1 };
```

- [ ] **Step 2: 실패하는 테스트 작성**

`tests/extractor.test.js`에 추가:

```js
const { collectSignals, extractFromPage } = require('../extractor.js');
const { makeDocument, meta, script, h1 } = require('./helpers/fake-document.js');

test('collectSignals: 메타, 제목, h1, JSON-LD Product(name/brand)를 모은다', () => {
  const doc = makeDocument({
    hostname: 'www.musinsa.com',
    title: '아디다스(ADIDAS) 레알 마드리드 써드 저지 - 사이즈 & 후기 | 무신사',
    elements: [
      meta('property', 'og:title', '아디다스(ADIDAS) 레알 마드리드 써드 저지 - 사이즈 & 후기 | 무신사'),
      meta('property', 'og:site_name', '무신사'),
      meta('property', 'og:type', 'product'),
      script(JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', name: '레알 마드리드 써드 저지 14/15 KF4243', brand: { '@type': 'Brand', name: '아디다스' }, offers: { price: 139000 } })),
      h1('레알 마드리드 써드 저지 14'),
    ],
  });
  const s = collectSignals(doc);
  assert.equal(s.host, 'www.musinsa.com');
  assert.equal(s.ogTitle, '아디다스(ADIDAS) 레알 마드리드 써드 저지 - 사이즈 & 후기 | 무신사');
  assert.equal(s.ogSiteName, '무신사');
  assert.equal(s.ogType, 'product');
  assert.equal(s.h1, '레알 마드리드 써드 저지 14');
  assert.deepEqual(s.jsonld, [{ name: '레알 마드리드 써드 저지 14/15 KF4243', brand: '아디다스' }]);
});

test('collectSignals: name 속성 메타, @graph 안의 Product, 문자열 brand도 읽는다', () => {
  const doc = makeDocument({
    elements: [
      meta('name', 'og:title', '이름 속성 제목'),
      script(JSON.stringify({ '@context': 'https://schema.org', '@graph': [{ '@type': 'WebPage' }, { '@type': ['Product', 'Thing'], name: '그래프 상품', brand: '브랜드명' }] })),
    ],
  });
  const s = collectSignals(doc);
  assert.equal(s.ogTitle, '이름 속성 제목');
  assert.deepEqual(s.jsonld, [{ name: '그래프 상품', brand: '브랜드명' }]);
});

test('collectSignals: 끝 쉼표가 있는 JSON-LD는 고쳐서 읽고, 쓰레기 블록은 건너뛴다', () => {
  const doc = makeDocument({
    elements: [
      script('{"@type": "Product", "name": "끝쉼표 상품",}'),
      script('<<< not json >>>'),
      script(JSON.stringify({ '@type': 'Product', brand: 'X' })),
    ],
  });
  assert.deepEqual(collectSignals(doc).jsonld, [{ name: '끝쉼표 상품', brand: null }]);
});

test('collectSignals: 빈 문서', () => {
  const s = collectSignals(makeDocument({ hostname: '' }));
  assert.deepEqual(s, { host: '', ogTitle: null, ogSiteName: null, ogType: null, title: null, h1: null, jsonld: [] });
});

test('extractFromPage: 선택 텍스트가 있으면 그것을 100자로 잘라 쓴다', () => {
  const doc = makeDocument({ title: '무시될 제목 | 사이트' });
  assert.deepEqual(extractFromPage(doc, '  드래그한   상품명 '), { query: '드래그한 상품명', source: 'selection', brand: null });
  const long = '가'.repeat(150);
  assert.equal(extractFromPage(doc, long).query.length, 100);
});

test('extractFromPage: 공백만 선택했으면 페이지 추출로 넘어간다', () => {
  const doc = makeDocument({ hostname: 'www.coupang.com', title: '루나미 소프트 오버나이트 - 일반 오버나이트 | 쿠팡', elements: [meta('property', 'og:title', '루나미 소프트 오버나이트 - 일반 오버나이트 | 쿠팡'), h1('루나미 소프트 오버나이트')] });
  const r = extractFromPage(doc, '   \n ');
  assert.equal(r.query, '루나미 소프트 오버나이트');
  assert.equal(r.source, 'h1');
});

test('extractFromPage: document가 던져도 none을 돌려준다', () => {
  const broken = { title: 'x', location: {}, querySelector() { throw new Error('boom'); }, querySelectorAll() { throw new Error('boom'); } };
  assert.deepEqual(extractFromPage(broken, ''), { query: '', source: 'none', brand: null });
});

test('buildQuery: JSON-LD가 없고 h1이 og:title 결과의 앞부분이면 h1을 쓴다', () => {
  const r = buildQuery(sig({ host: 'www.coupang.com', ogSiteName: '쿠팡', ogTitle: '삼성전자 갤럭시 버즈3 프로 - 실버, 1개 | 쿠팡', h1: '삼성전자 갤럭시 버즈3 프로' }));
  assert.equal(r.query, '삼성전자 갤럭시 버즈3 프로');
  assert.equal(r.source, 'h1');
  const r2 = buildQuery(sig({ ogTitle: '전혀 다른 제목 | 몰', h1: '짧은 h1 텍스트' }));
  assert.equal(r2.source, 'og:title');
});
```

- [ ] **Step 3: 실패 확인**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)|not ok" | head`
Expected: `collectSignals is not a function` 등으로 새 테스트 실패.

- [ ] **Step 4: 구현**

`extractor.js`의 `buildQuery` 안에서 `if (!cand && h1 && h1.length >= 4) { cand = h1; source = 'h1'; }` 바로 뒤에 추가:

```js
    if (cand && !products.length && h1 && h1.length >= 4 && (source === 'og:title' || source === 'title') && cand !== h1 && cand.startsWith(h1)) {
      cand = h1;
      source = 'h1';
    }
```

`buildQuery` 뒤, `const api` 앞에 추가:

```js
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
      if (sel) return { query: sel.slice(0, 100).trim(), source: 'selection', brand: null };
      return buildQuery(collectSignals(doc));
    } catch (e) {
      return { query: '', source: 'none', brand: null };
    }
  }
```

api 줄:

```js
  const api = { stripTags, hasHangul, tokens, overlap, commonPrefix, stripSiteName, cleanTitle, pickJsonLd, buildQuery, collectSignals, extractFromPage };
```

- [ ] **Step 5: 통과 확인**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: fail 0. h1 우선 규칙 때문에 픽스처가 바뀌는 사이트가 있으면 Task 3 Step 4와 같은 기준으로 눈으로 보고 기대값을 갱신한다.

---

### Task 5: `naver.js` URL 조립

**Files:**
- Create: `naver.js`
- Test: `tests/naver.test.js`

**Interfaces:**
- Produces: `NaverSearch.normalizeQuery(q): string`, `NaverSearch.shoppingSearchUrl(q): string`, `NaverSearch.webSearchUrl(q): string`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/naver.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeQuery, shoppingSearchUrl, webSearchUrl } = require('../naver.js');

test('normalizeQuery: 공백 축약과 trim', () => {
  assert.equal(normalizeQuery('  아디다스   저지 \n'), '아디다스 저지');
  assert.equal(normalizeQuery(null), '');
});

test('shoppingSearchUrl: 한글과 특수문자를 인코딩한다', () => {
  assert.equal(shoppingSearchUrl('rom&nd 틴트 #두유 1+1 14/15'), 'https://search.shopping.naver.com/search/all?query=rom%26nd%20%ED%8B%B4%ED%8A%B8%20%23%EB%91%90%EC%9C%A0%201%2B1%2014%2F15');
});

test('webSearchUrl: 통합검색 주소', () => {
  assert.equal(webSearchUrl('갤럭시 버즈3'), 'https://search.naver.com/search.naver?query=%EA%B0%A4%EB%9F%AD%EC%8B%9C%20%EB%B2%84%EC%A6%883');
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/naver.test.js`
Expected: FAIL. `Cannot find module '../naver.js'`

- [ ] **Step 3: 구현**

`naver.js`:

```js
// 네이버 검색 URL 조립. 클래식 스크립트: 팝업과 서비스 워커(importScripts)에서 쓰고 테스트에서는 require한다.
(function (root) {
  'use strict';
  const SHOPPING = 'https://search.shopping.naver.com/search/all?query=';
  const WEB = 'https://search.naver.com/search.naver?query=';

  function normalizeQuery(q) {
    return String(q ?? '').replace(/\s+/g, ' ').trim();
  }
  function shoppingSearchUrl(q) {
    return SHOPPING + encodeURIComponent(normalizeQuery(q));
  }
  function webSearchUrl(q) {
    return WEB + encodeURIComponent(normalizeQuery(q));
  }

  const api = { normalizeQuery, shoppingSearchUrl, webSearchUrl };
  root.NaverSearch = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
```

- [ ] **Step 4: 통과 확인**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: fail 0.

---

### Task 6: 익스텐션 조립 (manifest, popup, background)

**Files:**
- Create: `manifest.json`, `popup.html`, `popup.css`, `popup.js`, `background.js`
- Test: 자동 테스트 없음. Step 6의 수동 확인과 Task 8의 실제 페이지 확인으로 검증한다.

**Interfaces:**
- Consumes: `extractor.js`의 `globalThis.NaverPriceCheck.extractFromPage(document, selection)`, `naver.js`의 `globalThis.NaverSearch`
- Produces: 설치 가능한 익스텐션

- [ ] **Step 1: manifest.json**

```json
{
  "manifest_version": 3,
  "name": "네이버 쇼핑 바로검색",
  "version": "0.1.0",
  "description": "보고 있는 상품을 네이버 쇼핑에서 바로 검색해 가격을 비교한다.",
  "permissions": ["activeTab", "scripting", "contextMenus"],
  "action": {
    "default_popup": "popup.html",
    "default_title": "네이버 쇼핑에서 검색 (Alt+Shift+N)",
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "background": {
    "service_worker": "background.js"
  },
  "commands": {
    "_execute_action": {
      "suggested_key": {
        "default": "Alt+Shift+N",
        "mac": "Alt+Shift+N"
      },
      "description": "네이버 쇼핑 검색 팝업 열기"
    }
  }
}
```

아이콘 파일은 Task 7에서 만든다. 그 전에 로드하면 Chrome이 아이콘 누락 오류를 내므로 Step 6의 수동 확인은 Task 7 뒤에 한다.

- [ ] **Step 2: popup.html**

```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>네이버 쇼핑 바로검색</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <form id="form" autocomplete="off">
    <label for="query" class="label">네이버 쇼핑에서 검색</label>
    <input id="query" type="text" placeholder="상품명" spellcheck="false">
    <div class="row">
      <button id="search" type="submit" disabled>네이버 쇼핑에서 검색</button>
      <a id="web-search" href="#">통합검색으로</a>
    </div>
    <p id="status" class="status" aria-live="polite"></p>
  </form>
  <script src="naver.js"></script>
  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 3: popup.css**

```css
:root { color-scheme: light dark; font-family: -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif; }
body { width: 360px; margin: 0; padding: 14px 14px 10px; font-size: 14px; }
.label { display: block; font-size: 12px; opacity: 0.7; margin-bottom: 6px; }
#query { box-sizing: border-box; width: 100%; padding: 9px 10px; font-size: 14px; border: 1px solid rgba(127, 127, 127, 0.5); border-radius: 6px; background: transparent; color: inherit; }
#query:focus { outline: 2px solid #2f7f6f; outline-offset: 0; border-color: transparent; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 10px; }
#search { flex: 1; padding: 9px 12px; font-size: 14px; font-weight: 600; border: 0; border-radius: 6px; background: #2f7f6f; color: #fff; cursor: pointer; }
#search:disabled { opacity: 0.45; cursor: default; }
#web-search { font-size: 12px; color: inherit; opacity: 0.7; white-space: nowrap; }
.status { min-height: 1.2em; margin: 8px 0 0; font-size: 12px; opacity: 0.75; }
```

- [ ] **Step 4: popup.js**

```js
'use strict';
// 팝업: 현재 탭에 extractor.js를 주입해 상품명을 받고, Enter 또는 버튼으로 네이버 쇼핑 탭을 연다.

const input = document.getElementById('query');
const button = document.getElementById('search');
const webLink = document.getElementById('web-search');
const status = document.getElementById('status');
const form = document.getElementById('form');

function currentQuery() {
  return NaverSearch.normalizeQuery(input.value);
}

function syncState() {
  const q = currentQuery();
  button.disabled = !q;
  webLink.href = q ? NaverSearch.webSearchUrl(q) : '#';
}

function openSearch(url) {
  chrome.tabs.create({ url });
  window.close();
}

async function readProductFromActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id == null || !/^https?:/i.test(tab.url || '')) {
    return { query: '', source: 'unavailable', brand: null };
  }
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['extractor.js'] });
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => globalThis.NaverPriceCheck.extractFromPage(document, String(window.getSelection ? window.getSelection() : '')),
    });
    const r = results && results[0] && results[0].result;
    return r && typeof r.query === 'string' ? r : { query: '', source: 'none', brand: null };
  } catch (e) {
    return { query: '', source: 'unavailable', brand: null };
  }
}

function statusFor(result) {
  if (result.source === 'selection') return '선택한 텍스트로 검색합니다.';
  if (result.source === 'unavailable') return '이 페이지에서는 상품명을 읽을 수 없습니다.';
  if (!result.query) return '상품명을 찾지 못했습니다. 직접 입력하세요.';
  return '';
}

input.addEventListener('input', syncState);
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const q = currentQuery();
  if (q) openSearch(NaverSearch.shoppingSearchUrl(q));
});
webLink.addEventListener('click', (event) => {
  event.preventDefault();
  const q = currentQuery();
  if (q) openSearch(NaverSearch.webSearchUrl(q));
});

(async () => {
  const result = await readProductFromActiveTab();
  input.value = result.query;
  status.textContent = statusFor(result);
  syncState();
  input.focus();
  input.select();
})();
```

- [ ] **Step 5: background.js**

```js
'use strict';
// 서비스 워커: 선택 텍스트 우클릭 메뉴 "'…' 네이버 쇼핑에서 검색".
importScripts('naver.js');

const MENU_ID = 'naver-price-check-selection';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: MENU_ID, title: "'%s' 네이버 쇼핑에서 검색", contexts: ['selection'] });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== MENU_ID) return;
  const q = NaverSearch.normalizeQuery(info.selectionText).slice(0, 100).trim();
  if (!q) return;
  chrome.tabs.create({ url: NaverSearch.shoppingSearchUrl(q) });
});
```

- [ ] **Step 6: 수동 확인 (Task 7의 아이콘 생성 뒤)**

1. `chrome://extensions`에서 개발자 모드를 켜고 "압축해제된 확장 프로그램을 로드합니다"로 이 폴더를 고른다. 오류 배지가 없어야 한다.
2. 무신사 상품 페이지에서 아이콘을 누른다. 입력란에 "브랜드 상품명" 형태가 채워져 있고, Enter를 누르면 네이버 쇼핑 탭이 열려야 한다. 418 안내 페이지가 뜨면 설계 문서 6절대로 기본 버튼을 통합검색으로 바꾼다.
3. 쿠팡, G마켓, 11번가, 올리브영에서 2를 반복한다.
4. 아무 페이지에서 텍스트를 드래그하고 우클릭 → 메뉴 항목이 보이고 누르면 새 탭이 열린다.
5. `chrome://extensions` 탭에서 아이콘을 누르면 "이 페이지에서는 상품명을 읽을 수 없습니다"가 보이고 입력은 가능해야 한다.
6. Alt+Shift+N으로 팝업이 열린다.

---

### Task 7: 아이콘 생성 스크립트, README

**Files:**
- Create: `scripts/make-icons.py`, `icons/icon16.png`, `icons/icon32.png`, `icons/icon48.png`, `icons/icon128.png`
- Create: `README.md`
- Test: 없음(스크립트 실행 결과 파일 존재와 Chrome 로드로 확인)

- [ ] **Step 1: 아이콘 스크립트**

`scripts/make-icons.py` (표준 라이브러리만. 4배 슈퍼샘플링으로 그려 축소한다):

```python
#!/usr/bin/env python3
"""둥근 사각형 배경 위에 돋보기를 그린 익스텐션 아이콘(PNG)을 만든다. 표준 라이브러리만 쓴다."""
import math, os, struct, zlib

BG = (0x2F, 0x7F, 0x6F)      # 짙은 청록. 네이버 색(초록 #03C75A)이 아니다.
FG = (0xFF, 0xFF, 0xFF)
SIZES = (16, 32, 48, 128)
SS = 4                        # 슈퍼샘플링 배수

def coverage(x, y, size):
    """픽셀 중심 (x, y)가 배경 안인지(1), 전경(돋보기) 안인지(2), 밖인지(0)."""
    s = size
    r = s * 0.22
    # 둥근 사각형
    cx = min(max(x, r), s - r); cy = min(max(y, r), s - r)
    if (x - cx) ** 2 + (y - cy) ** 2 > r * r:
        return 0
    # 렌즈: 중심 (0.42s, 0.42s), 바깥 반지름 0.26s, 두께 0.085s
    lx, ly, lr, lw = s * 0.42, s * 0.42, s * 0.26, s * 0.085
    d = math.hypot(x - lx, y - ly)
    if lr - lw <= d <= lr:
        return 2
    # 손잡이: 렌즈 오른아래 방향 선분, 두께 0.11s
    hx0, hy0 = lx + lr * 0.72, ly + lr * 0.72
    hx1, hy1 = s * 0.80, s * 0.80
    vx, vy = hx1 - hx0, hy1 - hy0
    t = max(0.0, min(1.0, ((x - hx0) * vx + (y - hy0) * vy) / (vx * vx + vy * vy)))
    if math.hypot(x - (hx0 + t * vx), y - (hy0 + t * vy)) <= s * 0.055:
        return 2
    return 1

def render(size):
    big = size * SS
    rows = []
    for py in range(size):
        row = bytearray()
        for px in range(size):
            acc = [0, 0, 0, 0]
            for sy in range(SS):
                for sx in range(SS):
                    x = (px * SS + sx + 0.5) / SS
                    y = (py * SS + sy + 0.5) / SS
                    c = coverage(x, y, size)
                    if c == 0:
                        continue
                    col = FG if c == 2 else BG
                    acc[0] += col[0]; acc[1] += col[1]; acc[2] += col[2]; acc[3] += 255
            n = SS * SS
            a = acc[3] // n
            if a == 0:
                row += bytes((0, 0, 0, 0))
            else:
                k = acc[3] / 255.0
                row += bytes((int(acc[0] / k), int(acc[1] / k), int(acc[2] / k), a))
        rows.append(bytes(row))
    return rows

def png(size, rows):
    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    raw = b"".join(b"\x00" + r for r in rows)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))

def main():
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "icons")
    os.makedirs(out, exist_ok=True)
    for s in SIZES:
        path = os.path.join(out, f"icon{s}.png")
        with open(path, "wb") as f:
            f.write(png(s, render(s)))
        print("wrote", os.path.relpath(path))

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 아이콘 생성과 확인**

Run: `python3 scripts/make-icons.py && file icons/*.png`
Expected: 네 파일 모두 `PNG image data, N x N, 8-bit/color RGBA`. 128px 파일을 열어 돋보기 모양이 보이는지 눈으로 확인한다.

- [ ] **Step 3: README 초안**

플레이그라운드 문서 규칙대로 쓴다. 다음 내용을 담는다: 무엇을 하는지(한 문단), 설치(압축해제 로드 절차), 사용법(아이콘 클릭·Enter, 드래그 우선, 우클릭 메뉴, 단축키), 어떻게 상품명을 찾는지(JSON-LD → og:title → title → h1과 정리 규칙을 문단으로), 조사 결과 요약(213곳 중 127곳 확인, 전부 추출, `docs/survey/README.md` 링크), 손으로 하는 확인 목록(쿠팡, G마켓, 옥션, 11번가, SSG, 무신사, 29CM, 올리브영, 오늘의집, 에이블리에서 아이콘 클릭 → 채워진 검색어와 네이버 탭 정상 여부), 테스트 방법(`npm test`), 한계(자체제작 여성몰, 협업명 대괄호, SPA 메타 갱신, 네이버 차단 가능성, 미확인 86곳).

- [ ] **Step 4: README를 사용자에게 보여 주고 허락을 받는다**

커밋은 하지 않는다(사용자 요청 시에만).

---

### Task 8: 실제 페이지에서 추출 확인 (저장소 밖, 일회성)

**Files:**
- Create (scratchpad, 커밋하지 않음): `<scratchpad>/verify/real-pages.mjs`
- Test: 이 스크립트 실행 결과가 검증 증거다.

**Interfaces:**
- Consumes: `extractor.js` 파일 전체(`page.addScriptTag({ path })`로 실제 페이지에 주입)

- [ ] **Step 1: 스크립트 작성**

`<scratchpad>/verify/real-pages.mjs` (playwright-core는 이 머신의 npx 캐시 `/Users/sinsunyeong/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core`에서 읽는다. 자동화 탐지 우회 플래그나 UA 위장을 넣지 않는다):

```js
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire('/Users/sinsunyeong/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core/package.json');
const { chromium } = require('playwright-core');
const EXTRACTOR = '/Users/sinsunyeong/Desktop/playground/projects/naver-price-check/extractor.js';
const PAGES = [
  ['무신사', 'https://www.musinsa.com/products/7669078'],
  ['29CM', 'https://www.29cm.co.kr/products/4314496'],
  ['G마켓', 'https://item.gmarket.co.kr/Item?goodsCode=4814731104'],
  ['옥션', 'https://itempage3.auction.co.kr/DetailView.aspx?itemno=C337580252'],
  ['11번가', 'https://www.11st.co.kr/products/6441858178'],
  ['쿠팡', 'https://www.coupang.com/vp/products/7225189423?itemId=954937993&vendorItemId=5351802654'],
  ['SSG닷컴', 'https://www.ssg.com/item/itemView.ssg?itemId=1000894523409'],
  ['올리브영', 'https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000269535'],
  ['오늘의집', 'https://store.ohou.se/goods/2254548'],
  ['에이블리', 'https://m.a-bly.com/goods/77038628'],
  ['카카오톡 선물하기', 'https://gift.kakao.com/product/13990226'],
  ['핫핑', 'https://hotping.co.kr/product/detail.html?product_no=47594'],
];
const browser = await chromium.launch({ channel: 'chrome', headless: false });
const context = await browser.newContext({ locale: 'ko-KR' });
for (const [name, url] of PAGES) {
  const page = await context.newPage();
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(3000);
    await page.addScriptTag({ path: EXTRACTOR });
    const r = await page.evaluate(() => globalThis.NaverPriceCheck.extractFromPage(document, ''));
    console.log(`${name} [${resp?.status()}] (${r.source}) => ${r.query}`);
  } catch (e) {
    console.log(`${name} ERROR ${String(e).slice(0, 100)}`);
  } finally {
    await page.close();
  }
}
await browser.close();
```

- [ ] **Step 2: 실행**

Run: `node <scratchpad>/verify/real-pages.mjs`
Expected: 각 줄에 상태 200과 비어 있지 않은 검색어. 차단(403/418)된 사이트는 그대로 적어 두고 README의 수동 확인 목록으로 넘긴다. 결과가 픽스처 기대값과 다른 사이트는 페이지가 바뀐 것인지 구현 문제인지 확인한다.

---

## Self-Review

**Spec coverage:** 3절 사용 흐름 → Task 6(팝업, 메뉴, 단축키). 4절 구조 → Task 1~6. 5절 추출 규칙 1~7단계와 정리 규칙, 브랜드 결합, `extractFromPage` → Task 2~4. 6절 URL → Task 5. 7절 팝업 UI와 상태 문구 → Task 6. 8절 메뉴 → Task 6. 9절 권한 → Task 6 manifest. 10절 오류 처리 → Task 4(try)와 Task 6(unavailable). 11절 테스트 → Task 2~5, 수동 목록은 Task 7 README. 13절 한계 → README. 14절 저장소 체크리스트 → Task 1(CLAUDE.md, .gitignore), Task 7(아이콘, README). 빠진 항목 없음.

**Placeholder scan:** 없음. 모든 코드 단계에 실제 코드가 있다.

**Type consistency:** 신호 객체 키(`host, ogTitle, ogSiteName, ogType, title, h1, jsonld`)가 Task 3 테스트 헬퍼 `sig`, Task 3 `buildQuery`, Task 4 `collectSignals` 반환값에서 같다. `extractFromPage(doc, selection)`의 시그니처가 Task 4 구현과 Task 6 `popup.js`, Task 8 스크립트에서 같다. `NaverSearch.normalizeQuery/shoppingSearchUrl/webSearchUrl`가 Task 5, Task 6에서 같다. `source` 값 집합은 Task 3 Interfaces에 정의하고 Task 4에서 `'selection'`을 더한다.

**Review Focus:** 다섯 항목이 각각 Task 3·4·5의 테스트에 들어가 있다.
