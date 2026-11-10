'use strict';
// 서비스 워커: 우클릭 메뉴(새 탭 / 옆 창), 팝업 없이 옆 창으로 여는 단축키, 옆 창 정리.
importScripts('naver.js', 'split.js', 'opener.js');

const MENU_TAB = 'naver-price-check-selection';
const MENU_SPLIT = 'naver-price-check-selection-split';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: MENU_TAB, title: "'%s' 네이버 쇼핑에서 검색", contexts: ['selection'] });
    chrome.contextMenus.create({ id: MENU_SPLIT, title: "'%s' 옆 창에서 검색", contexts: ['selection'] });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_TAB && info.menuItemId !== MENU_SPLIT) return;
  const q = NaverOpener.prepareQuery(info.selectionText);
  if (!q) return;
  const mode = info.menuItemId === MENU_SPLIT ? 'split' : 'tab';
  NaverOpener.open(NaverSearch.shoppingSearchUrl(q), mode, tab && tab.windowId);
});

// 검색어를 못 찾으면 팝업을 띄워 직접 입력하게 하고, 그것도 안 되면 배지로 알린다.
async function askForQuery(tab) {
  try {
    await chrome.action.openPopup();
  } catch (e) {
    const tabId = tab && tab.id;
    await chrome.action.setBadgeText({ text: '?', tabId });
    setTimeout(() => chrome.action.setBadgeText({ text: '', tabId }), 3000);
  }
}

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'search-split') return;
  const result = await NaverOpener.readQueryFromTab(tab);
  const q = NaverOpener.prepareQuery(result.query);
  if (!q) return askForQuery(tab);
  await NaverOpener.open(NaverSearch.shoppingSearchUrl(q), 'split', tab.windowId);
});

// 팝업의 "옆에 열기". 팝업은 곧 닫히므로 먼저 응답하고 나서 연다.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !message || message.type !== 'open-split') return;
  if (typeof message.url !== 'string' || !message.url.startsWith(NaverSearch.shoppingSearchUrl(''))) return;
  sendResponse({ ok: true });
  NaverOpener.open(message.url, 'split', message.windowId);
});

chrome.windows.onRemoved.addListener((windowId) => {
  NaverSplit.handleWindowRemoved(windowId);
});
