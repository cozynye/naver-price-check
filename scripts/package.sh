#!/usr/bin/env bash
# 웹 스토어 업로드용 zip을 dist/에 만든다. 런타임 파일만 담고 테스트와 문서는 뺀다.
set -euo pipefail
cd "$(dirname "$0")/.."

version=$(node -p "require('./manifest.json').version")
out="dist/naver-price-check-${version}.zip"

npm test --silent > /dev/null
mkdir -p dist
rm -f "$out"
zip -q -X "$out" manifest.json background.js extractor.js naver.js opener.js split.js popup.html popup.css popup.js icons/*.png
unzip -l "$out"
