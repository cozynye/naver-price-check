'use strict';
// 팝업: 현재 탭에 extractor.js를 주입해 상품명을 받고, Enter 또는 버튼으로 네이버 쇼핑 탭을 연다.
// "옆에 열기"는 서비스 워커에 맡긴다. 새 창이 포커스를 가져가면 팝업이 닫혀 작업이 끊기기 때문이다.

const input = document.getElementById('query');
const button = document.getElementById('search');
const splitButton = document.getElementById('split');
const webLink = document.getElementById('web-search');
const status = document.getElementById('status');
const form = document.getElementById('form');
let activeWindowId = null;

function currentQuery() {
  return NaverSearch.normalizeQuery(input.value);
}

function syncState() {
  const q = currentQuery();
  button.disabled = !q;
  splitButton.disabled = !q;
  webLink.href = q ? NaverSearch.webSearchUrl(q) : '#';
}

function openSearch(url) {
  chrome.tabs.create({ url });
  window.close();
}

async function openSplit(url) {
  await chrome.runtime.sendMessage({ type: 'open-split', url, windowId: activeWindowId });
  window.close();
}

async function readProductFromActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeWindowId = tab ? tab.windowId : null;
  return NaverOpener.readQueryFromTab(tab);
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
splitButton.addEventListener('click', () => {
  const q = currentQuery();
  if (q) openSplit(NaverSearch.shoppingSearchUrl(q));
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
