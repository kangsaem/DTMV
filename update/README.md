# update/ — zip 하나로 고치기

Claude 가 준 zip(저장소와 같은 폴더 구조, 이름 예: `vman-update-v0.7.3.zip`)을 **이 폴더에 그대로 끌어다 놓고 Commit** 하면 됩니다.
GitHub Actions 가 풀어서 제자리에 넣고, 버전(`VERSION`)이 올랐으면 빌드 · 확인 · 릴리스까지 합니다. 자세한 것 = `docs/RELEASE_GUIDE.md`.
