'use strict';
// 서비스 워커: 선택 텍스트 우클릭 메뉴 "'…' 네이버 쇼핑에서 검색".
importScripts('naver.js');

const MENU_ID = 'naver-price-check-selection';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: MENU_ID, title: "'%s' 네이버 쇼핑에서 검색", contexts: ['selection'] });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== MENU_ID) return;
  const q = NaverSearch.truncate(NaverSearch.normalizeQuery(info.selectionText), 100).trim();
  if (!q) return;
  chrome.tabs.create({ url: NaverSearch.shoppingSearchUrl(q) });
});
