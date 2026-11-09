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
  assert.equal(cleanTitle('[3옵션][비타민슬랙스][MADE] 칼로리컷트2 슬랙스'), '[비타민슬랙스] 칼로리컷트2 슬랙스');
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
  assert.equal(cleanTitle('시크릿 레이스바디수트-♥핫핑♥'), '시크릿 레이스바디수트- 핫핑');
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

test('commonPrefix: 접두사가 이름 중 하나가 아니면 마지막 공통 단어(색상·옵션)까지 떼어낸다', () => {
  assert.equal(commonPrefix(['척테일러 올스타 클래식 화이트 300', '척테일러 올스타 클래식 화이트 295']), '척테일러 올스타 클래식');
  assert.equal(commonPrefix(['CORP TEE[BLACK] 블랙-XL', 'CORP TEE[BLACK] 블랙-L']), 'CORP TEE[BLACK]');
  assert.equal(commonPrefix(['롬앤 더 쥬시 래스팅 틴트 #두유 42 소이 피그', '롬앤 더 쥬시 래스팅 틴트 #두유 43 피치']), '롬앤 더 쥬시 래스팅 틴트 #두유');
  assert.equal(commonPrefix(['같은 이름', '같은 이름']), '같은 이름');
  assert.equal(commonPrefix([]), '');
});

test('commonPrefix: 접두사가 이름 중 하나면 그대로 두고, 여는 괄호를 앞에서 떼지 않는다', () => {
  assert.equal(commonPrefix(['[11/27 예약발송] 여성 에어플로우 후드 경량 다운 - WM(W90)', '[11/27 예약발송] 여성 에어플로우 후드 경량 다운']), '[11/27 예약발송] 여성 에어플로우 후드 경량 다운');
  assert.equal(commonPrefix(['에어 조던 1 로우 SE 남성 신발', '에어 조던 1 로우 SE 남성 신발 - 블랙 - Size 13']), '에어 조던 1 로우 SE 남성 신발');
});

test('overlap: 공통 토큰 수를 짧은 쪽 토큰 수로 나눈다', () => {
  assert.equal(overlap('세라마이드 아토 로션 350ml', '[일리윤]세라마이드 아토 로션 | 아모레몰 세라마이드 아토 로션 350ml'), 1);
  assert.equal(overlap('Ceramide Ato Lotion 350ml', '[일리윤]세라마이드 아토 로션'), 0);
  assert.equal(overlap('', 'abc'), 0);
});

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
  assert.equal(r.query, '육육걸즈 워싱워크포켓야상패딩JP');
  assert.equal(r.source, 'jsonld-variants');
});

test('buildQuery: 영문 JSON-LD 이름은 코드·숫자가 겹치는 한글 og:title로 바꾸고, 겹치지 않으면 영문을 유지한다', () => {
  const r = buildQuery(sig({ host: 'www.musinsa.com', ogSiteName: '무신사', ogTitle: '미즈노 웨이브 라이더 28 D1GA2401 - 사이즈 & 후기 | 무신사', jsonld: [{ name: 'Wave Rider 28 D1GA2401', brand: 'Mizuno' }] }));
  assert.equal(r.query, 'Mizuno 미즈노 웨이브 라이더 28 D1GA2401');
  assert.equal(r.source, 'jsonld+korean');
  const r2 = buildQuery(sig({ host: 'www.amoremall.com', ogTitle: '세라마이드 아토 로션 | 아모레몰', jsonld: [{ name: 'Ceramide Ato Lotion', brand: null }] }));
  assert.equal(r2.query, 'Ceramide Ato Lotion');
  assert.equal(r2.source, 'jsonld');
});

test('buildQuery: 목록형 JSON-LD가 og/title과 겹치지 않으면 버리고 og:title로 간다', () => {
  const r = buildQuery(sig({ host: 'shop.example.com', ogTitle: '진짜 상품명 ABC100 | 예시몰', jsonld: [{ name: '엉뚱한 추천 상품 1', brand: null }, { name: '엉뚱한 추천 상품 2', brand: null }] }));
  assert.equal(r.query, '진짜 상품명 ABC100');
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

test('extractFromPage: 100자 절단이 이모지(서로게이트 쌍)를 가르지 않는다', () => {
  const doc = makeDocument({});
  const r = extractFromPage(doc, '가'.repeat(99) + '😀나다');
  assert.equal(r.query.isWellFormed(), true);
  assert.equal(Array.from(r.query).length, 100);
  assert.ok(r.query.endsWith('😀'));
});

test('cleanTitle: 60자 절단이 이모지를 가르지 않는다', () => {
  const out = cleanTitle('가'.repeat(59) + '😀' + '나'.repeat(10));
  assert.equal(out.isWellFormed(), true);
});

test('commonPrefix: 이모지가 다른 이름들의 접두사가 반쪽 서로게이트로 끝나지 않는다', () => {
  const out = commonPrefix(['상품 이름 😀 레드', '상품 이름 😁 블루']);
  assert.equal(out.isWellFormed(), true);
  assert.equal(out, '상품');
  assert.equal(commonPrefix(['상품😀', '상품😁']), '상품');
});

test('cleanTitle: 하이픈 뒤 숫자 모델 접미사는 남긴다', () => {
  assert.equal(cleanTitle('레노버 아이디어패드 슬림 3-15'), '레노버 아이디어패드 슬림 3-15');
  assert.equal(cleanTitle('브라운 시리즈 9 전기면도기 9-95'), '브라운 시리즈 9 전기면도기 9-95');
  assert.equal(cleanTitle('진짜 상품명 ABC-100'), '진짜 상품명 ABC-100');
  assert.equal(cleanTitle('케이던 롱 부츠 빈티지블랙-250'), '케이던 롱 부츠 빈티지블랙');
  assert.equal(cleanTitle('브이넥 니트 아이보리-95'), '브이넥 니트 아이보리-95');
});

test('buildQuery: 호스트 라벨이 상품명 단어의 일부와 겹쳐도 구간을 버리지 않는다', () => {
  const r = buildQuery(sig({ host: 'www.lg.com', ogSiteName: 'LG전자', ogTitle: 'LG 올레드 evo TV 65인치 - 블랙 | LG전자' }));
  assert.equal(r.query, 'LG 올레드 evo TV 65인치');
  const r2 = buildQuery(sig({ host: 'item.gmarket.co.kr', ogSiteName: 'G마켓', ogTitle: 'G마켓-Limited Item Hoodie 후드티' }));
  assert.equal(r2.query, 'Limited Item Hoodie 후드티');
});
