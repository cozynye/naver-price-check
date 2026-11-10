# naver-price-check

보고 있는 상품 페이지의 상품명을 뽑아 네이버 쇼핑 검색 탭을 여는 Chrome 익스텐션(Manifest V3).

## 언어와 런타임

바닐라 JavaScript, 빌드 도구 없음. 테스트는 Node 22 내장 `node --test`로 돈다. 런타임·개발 의존성 모두 없다.

## 실행

- 테스트: `npm test`
- 익스텐션 로드: `chrome://extensions` → 개발자 모드 → "압축해제된 확장 프로그램을 로드합니다" → 이 폴더 선택
- 아이콘 재생성: `python3 scripts/make-icons.py`
- 웹 스토어 업로드용 zip: `scripts/package.sh` → `dist/`. 등록 칸별 문구와 이미지는 `docs/store/`

## 구조

- `extractor.js`: 상품명 추출. `collectSignals(document)`가 DOM에서 신호를 모으고 `buildQuery(signals)`가 검색어를 만든다. 페이지에 주입되고 테스트에서도 그대로 `require`한다.
- `naver.js`: 네이버 검색 URL 조립.
- `opener.js`: 현재 탭에 `extractor.js`를 주입해 검색어를 받고(`readQueryFromTab`), 새 탭이나 옆 창으로 연다. 팝업과 서비스 워커가 함께 쓴다.
- `split.js`: 옆 창. 현재 창을 왼쪽 절반으로 줄이고 오른쪽에 popup 창을 띄운다. 옆 창 ID와 원래 영역은 `chrome.storage.session`에 둔다.
- `popup.*`: 툴바 팝업. "옆에 열기"는 서비스 워커에 메시지로 맡긴다(새 창이 포커스를 가져가면 팝업이 닫히기 때문).
- `background.js`: 우클릭 메뉴 2개, `search-split` 단축키(Alt+Shift+S), 옆 창 닫힘 처리.
- `tests/fixtures/sites.json`: 2026-11-06 조사에서 저장한 127곳 상품 페이지의 신호와 기대 검색어. 회귀 기준선이며 기대값을 바꿀 때는 바뀐 항목을 눈으로 확인한다.
- `docs/survey/`: 213곳 조사 보고서. `docs/superpowers/specs/`: 설계 문서.

## 규칙

- 사이트별 선택자(어댑터)를 추가하지 않는다. 범용 규칙으로 해결하거나 팝업에서 사용자가 고치게 둔다.
- 권한은 activeTab, scripting, contextMenus, storage만. storage는 옆 창 상태를 위한 `chrome.storage.session`에만 쓰고 페이지 내용이나 검색어는 저장하지 않는다. 네트워크 요청을 하지 않는다.
- 새 런타임 파일을 추가하면 `scripts/package.sh`의 zip 목록에도 넣는다.
- 커밋은 사용자가 요청할 때만 하고 Co-Authored-By 등 Claude 표시를 넣지 않는다.
