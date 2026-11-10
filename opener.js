// 현재 탭에서 검색어 읽기와 검색 결과 열기. 팝업과 서비스 워커가 함께 쓴다.
// 클래식 스크립트: naver.js를 먼저 불러야 하고, 테스트에서는 require한다.
(function (root) {
  'use strict';
  const Search = root.NaverSearch || require('./naver.js');
  const MAX_QUERY = 100;

  // extractor.js를 탭에 넣어 선택 텍스트 또는 추출한 상품명을 받는다.
  async function readQueryFromTab(tab, api = root.chrome) {
    if (!tab || tab.id == null || !/^https?:/i.test(tab.url || '')) {
      return { query: '', source: 'unavailable', brand: null };
    }
    try {
      await api.scripting.executeScript({ target: { tabId: tab.id }, files: ['extractor.js'] });
      const results = await api.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => globalThis.NaverPriceCheck.extractFromPage(document, String(window.getSelection ? window.getSelection() : '')),
      });
      const r = results && results[0] && results[0].result;
      return r && typeof r.query === 'string' ? r : { query: '', source: 'none', brand: null };
    } catch (e) {
      return { query: '', source: 'unavailable', brand: null };
    }
  }

  function prepareQuery(text) {
    return Search.truncate(Search.normalizeQuery(text), MAX_QUERY).trim();
  }

  // mode: 'tab'은 새 탭, 'split'은 옆 창(NaverSplit은 서비스 워커에서만 불러온다).
  function open(url, mode, windowId, api = root.chrome, split = root.NaverSplit) {
    if (mode === 'split') return split.openBeside(url, windowId, api);
    return api.tabs.create({ url });
  }

  const api = { readQueryFromTab, prepareQuery, open };
  root.NaverOpener = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
