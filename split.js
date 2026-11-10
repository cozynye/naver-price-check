// 옆 창: 현재 창을 왼쪽 절반으로 줄이고 오른쪽 절반에 네이버 popup 창을 띄운다.
// 클래식 스크립트: 서비스 워커(importScripts)에서 쓰고 테스트에서는 require한다.
// 서비스 워커는 쉬면 종료되므로 옆 창 ID와 원래 영역은 storage.session에 둔다.
(function (root) {
  'use strict';
  const KEY = 'split';

  function bounds(w) {
    return { left: w.left, top: w.top, width: w.width, height: w.height };
  }

  // 남는 1px은 왼쪽 창에 준다.
  function splitBounds(b) {
    const leftWidth = Math.ceil(b.width / 2);
    return {
      left: { left: b.left, top: b.top, width: leftWidth, height: b.height },
      right: { left: b.left + leftWidth, top: b.top, width: b.width - leftWidth, height: b.height },
    };
  }

  // 최대화·전체화면이었던 창은 영역 대신 상태로 되돌린다.
  function restoreInfo(original) {
    const { state, ...rest } = original;
    return state === 'normal' ? rest : { state };
  }

  async function readState(api) {
    const got = await api.storage.session.get(KEY);
    return got[KEY] || null;
  }

  async function reuse(state, url, api) {
    try {
      const win = await api.windows.get(state.splitWindowId, { populate: true });
      await api.tabs.update(win.tabs[0].id, { url });
      await api.windows.update(win.id, { focused: true });
      return true;
    } catch (e) {
      return false;
    }
  }

  // 결과: 'reused'(기존 옆 창 재사용), 'split'(새로 나눔), 'tab'(실패해서 새 탭으로 엶)
  async function openBeside(url, sourceWindowId, api = root.chrome) {
    const state = await readState(api);
    if (state && (await reuse(state, url, api))) return 'reused';
    await api.storage.session.remove(KEY);

    let source = null;
    let original = null;
    try {
      source = await api.windows.get(sourceWindowId);
      original = { ...bounds(source), state: source.state };
      const { left, right } = splitBounds(original);
      // 최대화·전체화면 창은 bounds와 함께 normal로 바꿔야 크기가 바뀐다.
      const shrinkInfo = source.state === 'normal' ? left : { state: 'normal', ...left };
      const shrunk = await api.windows.update(source.id, shrinkInfo);
      const created = await api.windows.create({ url, type: 'popup', focused: true, ...right });
      await api.storage.session.set({
        [KEY]: { splitWindowId: created.id, sourceWindowId: source.id, original, shrunk: bounds(shrunk) },
      });
      return 'split';
    } catch (e) {
      if (source) {
        try { await api.windows.update(source.id, restoreInfo(original)); } catch (ignored) { /* 창이 이미 닫혔다 */ }
      }
      await api.storage.session.remove(KEY);
      await api.tabs.create({ url });
      return 'tab';
    }
  }

  // 옆 창이 닫히면 현재 창을 원래대로 되돌린다. 사용자가 그사이 크기를 바꿨으면 손대지 않는다.
  async function handleWindowRemoved(windowId, api = root.chrome) {
    const state = await readState(api);
    if (!state) return;
    if (windowId === state.sourceWindowId) {
      await api.storage.session.remove(KEY);
      return;
    }
    if (windowId !== state.splitWindowId) return;
    await api.storage.session.remove(KEY);
    try {
      const source = await api.windows.get(state.sourceWindowId);
      const now = bounds(source);
      const untouched = source.state === 'normal' && Object.keys(now).every((k) => now[k] === state.shrunk[k]);
      if (!untouched) return;
      await api.windows.update(source.id, restoreInfo(state.original));
    } catch (e) {
      // 현재 창도 이미 닫혔다.
    }
  }

  const api = { splitBounds, openBeside, handleWindowRemoved };
  root.NaverSplit = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
