'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { splitBounds, openBeside, handleWindowRemoved } = require('../split.js');

// chrome.windows / tabs / storage.session 중 split.js가 쓰는 부분만 흉내 낸다.
function fakeChrome({ windows = {}, session = {}, failCreate = false } = {}) {
  const calls = [];
  let nextId = 100;
  const api = {
    calls,
    wins: windows,
    store: session,
    storage: {
      session: {
        async get(key) { return key in api.store ? { [key]: api.store[key] } : {}; },
        async set(obj) { Object.assign(api.store, obj); },
        async remove(key) { delete api.store[key]; },
      },
    },
    windows: {
      async get(id, opts) {
        const w = api.wins[id];
        if (!w) throw new Error(`No window with id: ${id}.`);
        return opts && opts.populate ? { ...w, tabs: [{ id: id * 10 }] } : { ...w };
      },
      async update(id, info) {
        calls.push(['windows.update', id, info]);
        const w = api.wins[id];
        if (!w) throw new Error(`No window with id: ${id}.`);
        Object.assign(w, info);
        return { ...w };
      },
      async create(info) {
        calls.push(['windows.create', info]);
        if (failCreate) throw new Error('create failed');
        const id = nextId++;
        api.wins[id] = { id, state: 'normal', left: info.left, top: info.top, width: info.width, height: info.height };
        return { ...api.wins[id] };
      },
    },
    tabs: {
      async update(tabId, info) { calls.push(['tabs.update', tabId, info]); return { id: tabId }; },
      async create(info) { calls.push(['tabs.create', info]); return { id: 999 }; },
    },
  };
  return api;
}

const URL = 'https://search.shopping.naver.com/search/all?query=x';

test('splitBounds: 짝수 너비는 반씩 나눈다', () => {
  assert.deepEqual(splitBounds({ left: 0, top: 25, width: 1440, height: 875 }), {
    left: { left: 0, top: 25, width: 720, height: 875 },
    right: { left: 720, top: 25, width: 720, height: 875 },
  });
});

test('splitBounds: 홀수 너비의 남는 1px은 왼쪽에 준다', () => {
  const { left, right } = splitBounds({ left: 10, top: 0, width: 1001, height: 700 });
  assert.equal(left.width, 501);
  assert.equal(right.left, 511);
  assert.equal(right.width, 500);
});

test('splitBounds: 왼쪽 보조 모니터(음수 left)에서도 이어 붙인다', () => {
  const { left, right } = splitBounds({ left: -1920, top: 0, width: 1920, height: 1080 });
  assert.equal(left.left, -1920);
  assert.equal(right.left, -960);
});

test('openBeside: 옆 창이 없으면 현재 창을 줄이고 오른쪽에 popup 창을 만든다', async () => {
  const api = fakeChrome({ windows: { 1: { id: 1, state: 'normal', left: 0, top: 0, width: 1400, height: 900 } } });
  assert.equal(await openBeside(URL, 1, api), 'split');
  assert.deepEqual(api.calls[0], ['windows.update', 1, { left: 0, top: 0, width: 700, height: 900 }]);
  assert.deepEqual(api.calls[1], ['windows.create', { url: URL, type: 'popup', focused: true, left: 700, top: 0, width: 700, height: 900 }]);
  assert.deepEqual(api.store.split, {
    splitWindowId: 100,
    sourceWindowId: 1,
    original: { left: 0, top: 0, width: 1400, height: 900, state: 'normal' },
    shrunk: { left: 0, top: 0, width: 700, height: 900 },
  });
});

test('openBeside: 최대화된 창은 최대화 영역을 기준으로 나누고 normal로 바꾼다', async () => {
  const api = fakeChrome({ windows: { 1: { id: 1, state: 'maximized', left: 0, top: 25, width: 1440, height: 875 } } });
  assert.equal(await openBeside(URL, 1, api), 'split');
  assert.deepEqual(api.calls[0], ['windows.update', 1, { state: 'normal', left: 0, top: 25, width: 720, height: 875 }]);
  assert.equal(api.store.split.original.state, 'maximized');
});

test('openBeside: 열려 있는 옆 창은 주소만 바꾸고 현재 창은 건드리지 않는다', async () => {
  const api = fakeChrome({
    windows: { 1: { id: 1, state: 'normal', left: 0, top: 0, width: 700, height: 900 }, 7: { id: 7, state: 'normal' } },
    session: { split: { splitWindowId: 7, sourceWindowId: 1, original: {}, shrunk: {} } },
  });
  assert.equal(await openBeside(URL, 1, api), 'reused');
  assert.deepEqual(api.calls, [
    ['tabs.update', 70, { url: URL }],
    ['windows.update', 7, { focused: true }],
  ]);
});

test('openBeside: 저장된 옆 창이 이미 닫혔으면 새로 나눈다', async () => {
  const api = fakeChrome({
    windows: { 1: { id: 1, state: 'normal', left: 0, top: 0, width: 1000, height: 800 } },
    session: { split: { splitWindowId: 7, sourceWindowId: 1, original: {}, shrunk: {} } },
  });
  assert.equal(await openBeside(URL, 1, api), 'split');
  assert.equal(api.store.split.splitWindowId, 100);
});

test('openBeside: 옆 창 생성이 실패하면 현재 창을 되돌리고 새 탭으로 연다', async () => {
  const api = fakeChrome({ windows: { 1: { id: 1, state: 'normal', left: 0, top: 0, width: 1400, height: 900 } }, failCreate: true });
  assert.equal(await openBeside(URL, 1, api), 'tab');
  assert.deepEqual(api.calls.at(-2), ['windows.update', 1, { left: 0, top: 0, width: 1400, height: 900 }]);
  assert.deepEqual(api.calls.at(-1), ['tabs.create', { url: URL }]);
  assert.equal(api.store.split, undefined);
});

test('openBeside: 최대화 창에서 생성이 실패하면 다시 최대화한다', async () => {
  const api = fakeChrome({ windows: { 1: { id: 1, state: 'maximized', left: 0, top: 25, width: 1440, height: 875 } }, failCreate: true });
  assert.equal(await openBeside(URL, 1, api), 'tab');
  assert.deepEqual(api.calls.at(-2), ['windows.update', 1, { state: 'maximized' }]);
});

test('openBeside: 현재 창 정보를 못 읽으면 새 탭으로 연다', async () => {
  const api = fakeChrome();
  assert.equal(await openBeside(URL, 1, api), 'tab');
  assert.deepEqual(api.calls, [['tabs.create', { url: URL }]]);
});

function splitState(extra = {}) {
  return {
    split: {
      splitWindowId: 7,
      sourceWindowId: 1,
      original: { left: 0, top: 0, width: 1400, height: 900, state: 'normal' },
      shrunk: { left: 0, top: 0, width: 700, height: 900 },
      ...extra,
    },
  };
}

test('handleWindowRemoved: 옆 창이 닫히면 현재 창을 원래 영역으로 되돌린다', async () => {
  const api = fakeChrome({ windows: { 1: { id: 1, state: 'normal', left: 0, top: 0, width: 700, height: 900 } }, session: splitState() });
  await handleWindowRemoved(7, api);
  assert.deepEqual(api.calls, [['windows.update', 1, { left: 0, top: 0, width: 1400, height: 900 }]]);
  assert.equal(api.store.split, undefined);
});

test('handleWindowRemoved: 원래 최대화 상태였으면 다시 최대화한다', async () => {
  const api = fakeChrome({
    windows: { 1: { id: 1, state: 'normal', left: 0, top: 0, width: 700, height: 900 } },
    session: splitState({ original: { left: 0, top: 0, width: 1400, height: 900, state: 'maximized' } }),
  });
  await handleWindowRemoved(7, api);
  assert.deepEqual(api.calls, [['windows.update', 1, { state: 'maximized' }]]);
});

test('handleWindowRemoved: 사용자가 그사이 창 크기를 바꿨으면 되돌리지 않는다', async () => {
  const api = fakeChrome({ windows: { 1: { id: 1, state: 'normal', left: 0, top: 0, width: 900, height: 900 } }, session: splitState() });
  await handleWindowRemoved(7, api);
  assert.deepEqual(api.calls, []);
  assert.equal(api.store.split, undefined);
});

test('handleWindowRemoved: 현재 창이 먼저 닫히면 저장값만 지운다', async () => {
  const api = fakeChrome({ windows: { 7: { id: 7, state: 'normal' } }, session: splitState() });
  await handleWindowRemoved(1, api);
  assert.deepEqual(api.calls, []);
  assert.equal(api.store.split, undefined);
});

test('handleWindowRemoved: 관계없는 창이 닫히면 아무것도 하지 않는다', async () => {
  const api = fakeChrome({ session: splitState() });
  await handleWindowRemoved(42, api);
  assert.deepEqual(api.calls, []);
  assert.ok(api.store.split);
});
