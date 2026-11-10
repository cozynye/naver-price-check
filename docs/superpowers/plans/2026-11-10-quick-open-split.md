# 바로 열기와 분할 창 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 팝업 없이 바로 여는 단축키(Alt+Shift+S)와, 검색 결과를 현재 창 오른쪽에 나란히 띄우는 옆 창 기능을 추가한다.

**Architecture:** 창 배치 로직은 `split.js`(NaverSplit), 검색어 읽기와 열기는 `opener.js`(NaverOpener)에 둔다. 둘 다 `naver.js`처럼 클래식 스크립트이고 `chrome` 객체를 인자로 받아 가짜 객체로 단위 테스트한다. 옆 창 상태는 `chrome.storage.session`에 둔다. 팝업은 옆 창을 직접 열지 않고 서비스 워커에 메시지를 보낸다. 새 창이 포커스를 가져가는 순간 팝업이 닫혀서 비동기 작업이 끊기기 때문이다.

**Tech Stack:** Manifest V3, 바닐라 JavaScript, Node 22 `node --test`

**Spec:** `docs/superpowers/specs/2026-11-10-quick-open-split-design.md`

## Global Constraints

- 권한은 activeTab, scripting, contextMenus, storage. storage는 `chrome.storage.session`만 쓴다. tabs, 호스트 권한, system.display를 추가하지 않는다.
- 새 단축키 명령 이름 `search-split`, 기본 키 `Alt+Shift+S`(mac 동일).
- 우클릭 메뉴 제목: `'%s' 네이버 쇼핑에서 검색`(기존), `'%s' 옆 창에서 검색`(신규).
- 사이트별 선택자를 추가하지 않는다. 런타임·개발 의존성을 추가하지 않는다.
- 커밋은 사용자 요청이 있을 때만 한다.

## Review Focus

- 옆 창을 사용자가 닫은 뒤 다시 실행: 저장된 ID의 창이 없으므로 새로 나눠야 한다(`openBeside` 재사용 실패 경로 테스트).
- 최대화된 창에서 실행: 최대화 상태의 영역을 기준으로 나누고, 옆 창을 닫으면 다시 최대화해야 한다.
- 옆 창 생성 실패: 줄인 현재 창을 원래 영역으로 되돌리고 새 탭으로 연다.
- 옆 창이 열린 동안 사용자가 현재 창 크기를 바꾼 뒤 옆 창을 닫음: 복원하지 않는다.
- `chrome://` 페이지에서 Alt+Shift+S: 스크립트 주입이 막히므로 팝업을 띄우거나 배지로 알린다.

---

### Task 1: split.js

**Files:** Create `split.js`, `tests/split.test.js`

**Interfaces (Produces):**
- `NaverSplit.splitBounds({left, top, width, height}) → {left: Bounds, right: Bounds}`. 남는 1px은 왼쪽.
- `NaverSplit.openBeside(url, sourceWindowId, api = chrome) → Promise<'reused' | 'split' | 'tab'>`
- `NaverSplit.handleWindowRemoved(windowId, api = chrome) → Promise<void>`
- storage.session 키 `split`: `{ splitWindowId, sourceWindowId, original: {left, top, width, height, state}, shrunk: {left, top, width, height} }`

- [ ] 테스트 작성: splitBounds 짝수/홀수/음수 left, openBeside 재사용·없어진 창·최대화 창 분할·생성 실패 복원, handleWindowRemoved 복원·사용자 크기 변경 시 무시·최대화 복원·현재 창이 닫힌 경우
- [ ] `npm test`로 실패 확인
- [ ] 구현
- [ ] `npm test` 통과 확인

### Task 2: opener.js와 popup.js 정리

**Files:** Create `opener.js`, `tests/opener.test.js`. Modify `popup.js`, `popup.html`, `popup.css`

**Interfaces:**
- Consumes: `NaverSplit.openBeside`, `NaverSearch.normalizeQuery`, `NaverSearch.truncate`
- Produces: `NaverOpener.readQueryFromTab(tab, api = chrome) → Promise<{query, source, brand}>`(popup.js의 readProductFromActiveTab을 옮긴 것), `NaverOpener.prepareQuery(text) → string`(normalize 후 100자 절단), `NaverOpener.open(url, mode, windowId, api = chrome)`(mode는 `'tab'` 또는 `'split'`)
- 메시지 `{ type: 'open-split', url, windowId }`. 서비스 워커는 바로 `{ ok: true }`로 응답하고 그다음 열기를 처리한다.

- [ ] 테스트 작성: http가 아닌 탭은 unavailable, executeScript 예외는 unavailable, 정상 결과 전달, prepareQuery 절단, open이 tab이면 tabs.create, split이면 openBeside 호출
- [ ] 실패 확인, 구현, 통과 확인
- [ ] 팝업에 "옆에 열기" 버튼을 추가하고 클릭하면 메시지를 보낸 뒤 닫는다

### Task 3: background.js와 manifest

**Files:** Modify `background.js`, `manifest.json`

- [ ] manifest: `storage` 권한, `search-split` 명령, version 0.2.0
- [ ] background: importScripts에 split.js와 opener.js 추가, 우클릭 메뉴 2개, onCommand(`search-split`), onMessage(`open-split`), windows.onRemoved → handleWindowRemoved
- [ ] 검색어가 비면 `chrome.action.openPopup()`, 실패하면 배지 "?" 3초
- [ ] `npm test` 통과, Playwright로 확장을 로드해 서비스 워커에서 옆 창 배치 확인

### Task 4: 문서

**Files:** Modify `CLAUDE.md`, `PRIVACY.md`, `docs/store/listing.md`, `README.md`, `package.json`(version)

- [ ] 권한 설명과 사용 방법 갱신. README는 초안을 사용자에게 보여주고 승인받은 뒤 확정한다.
