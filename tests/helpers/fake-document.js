'use strict';
// querySelector / querySelectorAll 중 이 프로젝트가 쓰는 선택자만 지원하는 가짜 document.
// 지원: `tag`, `tag[attr="value"]`, 그리고 쉼표로 이어진 선택자 목록.
function makeDocument({ hostname = 'www.example.com', title = '', elements = [] } = {}) {
  function matches(el, selector) {
    const m = /^([a-z0-9]+)(?:\[([a-z:-]+)="([^"]*)"\])?$/i.exec(selector.trim());
    if (!m) throw new Error(`unsupported selector in fake document: ${selector}`);
    if (el.tag !== m[1].toLowerCase()) return false;
    if (m[2] && (el.attrs || {})[m[2]] !== m[3]) return false;
    return true;
  }
  function all(selector) {
    const parts = selector.split(',');
    return elements.filter((el) => parts.some((p) => matches(el, p)));
  }
  return {
    title,
    location: { hostname },
    querySelector(selector) { return all(selector)[0] || null; },
    querySelectorAll(selector) { return all(selector); },
  };
}

function meta(attrName, name, content) {
  return { tag: 'meta', attrs: { [attrName]: name, content }, getAttribute(a) { return this.attrs[a] ?? null; } };
}
function script(json) {
  return { tag: 'script', attrs: { type: 'application/ld+json' }, textContent: json, getAttribute(a) { return this.attrs[a] ?? null; } };
}
function h1(text) {
  return { tag: 'h1', attrs: {}, textContent: text, getAttribute(a) { return this.attrs[a] ?? null; } };
}

module.exports = { makeDocument, meta, script, h1 };
