# 새 버전 내는 법 (Claude Code 없이) — Vector Man

## 한 번에: zip 하나 올리기
1. Claude 채팅에서 고친 파일을 **zip 하나**로 받습니다 (저장소와 같은 폴더 구조 · 이름 `vman-update-v<버전>.zip` · 배포하려면 `VERSION` 도 올려 달라고 하기).
2. GitHub 저장소(vman) → `update` 폴더 → **Add file → Upload files** → zip 을 끌어다 놓기 → **Commit changes**.
3. 끝. Actions 가 알아서:
   - zip 을 풀어 제자리에 넣고(`_delete.txt` 에 적힌 파일은 지움) `python build.py` 로 웹 화면(`web/vectorman.html`)을 다시 만든 뒤 zip 은 지우고 커밋,
   - 같은 실행 안에서 Windows exe 빌드 → 실행 확인,
   - **버전(`VERSION`)이 지금 릴리스된 것(가장 최근 `pc-v…` 릴리스)보다 높으면** 릴리스 `pc-v<버전>` 을 만들고 `VectorMan-PC-v<버전>-win64.zip` 을 올림 (최신 표시).
   - 버전이 그대로면 빌드 · 확인만 (릴리스 안 함).
4. 확인: 저장소 → **Actions** → 맨 위 'PC 엔진 빌드'. 초록 ✓ = 끝. 빨강 ✗ = 실패 (릴리스 안 됨 — GitHub 가 메일로도 알림).
5. 받기: https://github.com/kangsaem/vman/releases/latest

## zip 규칙 (DTMC 와 같음)
- zip 안 = 저장소와 같은 폴더 구조 (`src/…`, `pc/…`, `docs/…`, `VERSION`). 맨 위가 폴더 하나로 싸여 있어도 됨 (껍데기는 벗김).
- 지울 파일 = zip 맨 위 `_delete.txt` 에 한 줄씩 (예: `docs/old.md`).
- 거부 (아무것도 안 바뀜): 저장소 밖 경로 (`..` · 절대 경로) · `.github/` (워크플로) · `.git/` · `update/`.
- 워크플로 (`.github/workflows/pc-build.yml`) 를 고쳐야 하면 GitHub 웹에서 그 파일을 열어 직접 고침 (드묾).

## 실패했을 때
- Actions → 실패한 실행 → 빨간 단계를 열면 까닭이 보입니다.
  - 'zip 하나로 고치기' 단계 = zip 안에 막힌 경로 (요약 화면에 목록).
  - 'exe 만들기' · '실행 확인' 단계 = 그 글을 Claude 에 붙여 넣고 고친 zip 을 다시 받기.
- 같은 버전으로 다시 올리고 싶으면: Actions → PC 엔진 빌드 → **Run workflow** → 'release' 체크.
- 실제 사진 한 장 처리까지 확인하려면 (빌드 서버는 GPU 가 없어 CPU 로 수십 분): **Run workflow** → 'smoke' 체크.
