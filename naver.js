// 네이버 검색 URL 조립. 클래식 스크립트: 팝업과 서비스 워커(importScripts)에서 쓰고 테스트에서는 require한다.
(function (root) {
  'use strict';
  const SHOPPING = 'https://search.shopping.naver.com/search/all?query=';
  const WEB = 'https://search.naver.com/search.naver?query=';

  // 홀로 남은 서로게이트는 encodeURIComponent가 URIError를 던지므로 지운다.
  const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

  function normalizeQuery(q) {
    return String(q ?? '').replace(LONE_SURROGATE, '').replace(/\s+/g, ' ').trim();
  }
  // 코드 포인트 단위 절단: 이모지 같은 서로게이트 쌍을 가르지 않는다.
  function truncate(q, n) {
    return Array.from(String(q ?? '')).slice(0, n).join('');
  }
  function shoppingSearchUrl(q) {
    return SHOPPING + encodeURIComponent(normalizeQuery(q));
  }
  function webSearchUrl(q) {
    return WEB + encodeURIComponent(normalizeQuery(q));
  }

  const api = { normalizeQuery, truncate, shoppingSearchUrl, webSearchUrl };
  root.NaverSearch = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
