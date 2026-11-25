#!/bin/sh
# 테스트용 라이브러리 내려받기(npm) + 가짜 모델 생성 → tests/.vend/
set -e; cd "$(dirname "$0")"; mkdir -p .vend && cd .vend
npm pack -q onnxruntime-web@1.31.1 jszip@3.10.1 >/dev/null
for f in *.tgz; do tar xzf "$f" && cp package/dist/* . 2>/dev/null; rm -rf package "$f"; done
cd .. && python3 make_fake_model.py && echo "vend ready"
