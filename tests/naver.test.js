'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeQuery, shoppingSearchUrl, webSearchUrl } = require('../naver.js');

test('normalizeQuery: 공백 축약과 trim', () => {
  assert.equal(normalizeQuery('  아디다스   저지 \n'), '아디다스 저지');
  assert.equal(normalizeQuery(null), '');
});

test('shoppingSearchUrl: 한글과 특수문자를 인코딩한다', () => {
  assert.equal(shoppingSearchUrl('rom&nd 틴트 #두유 1+1 14/15'), 'https://search.shopping.naver.com/search/all?query=rom%26nd%20%ED%8B%B4%ED%8A%B8%20%23%EB%91%90%EC%9C%A0%201%2B1%2014%2F15');
});

test('webSearchUrl: 통합검색 주소', () => {
  assert.equal(webSearchUrl('갤럭시 버즈3'), 'https://search.naver.com/search.naver?query=%EA%B0%A4%EB%9F%AD%EC%8B%9C%20%EB%B2%84%EC%A6%883');
});

test('normalizeQuery: 홀로 남은 서로게이트를 지워 URL 조립이 던지지 않는다', () => {
  assert.equal(normalizeQuery('가\uD83D 나'), '가 나');
  assert.doesNotThrow(() => shoppingSearchUrl('가\uD83D'));
});

test('truncate: 코드 포인트 단위로 자른다', () => {
  const { truncate } = require('../naver.js');
  assert.equal(truncate('가'.repeat(99) + '😀나', 100), '가'.repeat(99) + '😀');
  assert.equal(truncate('짧다', 100), '짧다');
});
