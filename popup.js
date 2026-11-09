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
