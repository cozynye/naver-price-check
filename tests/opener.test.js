'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readQueryFromTab, prepareQuery, open } = require('../opener.js');

function fakeScripting(result, { throws = false } = {}) {
  const calls = [];
  return {
    calls,
    scripting: {
      async executeScript(opts) {
        calls.push(opts);
        if (throws) throw new Error('Cannot access contents of the page.');
        return opts.files ? [{ result: undefined }] : [{ result }];
      },
    },
  };
}

test('readQueryFromTab: http(s)가 아닌 탭은 주입하지 않고 unavailable', async () => {
  const api = fakeScripting(null);
  assert.deepEqual(await readQueryFromTab({ id: 1, url: 'chrome://extensions/' }, api), { query: '', source: 'unavailable', brand: null });
  assert.deepEqual(await readQueryFromTab({ id: 1 }, api), { query: '', source: 'unavailable', brand: null });
  assert.equal(api.calls.length, 0);
});

test('readQueryFromTab: 주입이 막히면 unavailable', async () => {
  const api = fakeScripting(null, { throws: true });
  assert.equal((await readQueryFromTab({ id: 1, url: 'https://chromewebstore.google.com/' }, api)).source, 'unavailable');
});

test('readQueryFromTab: extractor.js를 넣고 추출 결과를 돌려준다', async () => {
  const r = { query: '아디다스 저지', source: 'jsonld', brand: '아디다스' };
  const api = fakeScripting(r);
  assert.deepEqual(await readQueryFromTab({ id: 3, url: 'https://shop.example.com/p/1' }, api), r);
  assert.deepEqual(api.calls[0], { target: { tabId: 3 }, files: ['extractor.js'] });
  assert.equal(typeof api.calls[1].func, 'function');
});

test('readQueryFromTab: 결과 모양이 이상하면 none', async () => {
  const api = fakeScripting(undefined);
  assert.deepEqual(await readQueryFromTab({ id: 3, url: 'https://shop.example.com/' }, api), { query: '', source: 'none', brand: null });
});

test('prepareQuery: 공백을 정리하고 100자에서 자른다', () => {
  assert.equal(prepareQuery('  가  나 '), '가 나');
  assert.equal(prepareQuery('가'.repeat(150)).length, 100);
  assert.equal(prepareQuery('a'.repeat(99) + ' b'), 'a'.repeat(99));
  assert.equal(prepareQuery(null), '');
});

test('open: tab은 새 탭, split은 옆 창으로 연다', async () => {
  const calls = [];
  const api = { tabs: { async create(info) { calls.push(['tabs.create', info]); } } };
  const split = { async openBeside(url, windowId) { calls.push(['openBeside', url, windowId]); return 'split'; } };
  await open('https://a/', 'tab', 5, api, split);
  await open('https://b/', 'split', 5, api, split);
  assert.deepEqual(calls, [['tabs.create', { url: 'https://a/' }], ['openBeside', 'https://b/', 5]]);
});
