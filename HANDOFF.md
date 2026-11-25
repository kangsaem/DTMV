# HANDOFF — Vector Man (벡터맨)

스틸 사진에서 인물(상반신·전신, 머리카락·모자·안경·옷 포함) 외곽선을 **벡터(SVG 패스)**로 따는 도구.
다음 대화는 이 문서를 기준으로 이어서 작업한다.

## 0. 현재 상태
- 버전: `VERSION` 파일. 결과물: `web/vectorman.html` (한 파일, 크롬에서 열기)
- 엔진: 브라우저 안 BiRefNet-lite 1024 (ONNX Runtime Web, WebGPU → 안 되면 CPU)
  - 모델: `jiabins0303/birefnet-lite-1024-webgpu` (`onnx/model_fp16.onnx`, WebGPU용으로 고친 개인 변환본, MIT)
  - 주의: 원본 학습 데이터 DIS5K 는 상업 사용 제한 → 상업 용도는 별도 검토
- 실제 모델로는 미검증(작업 환경에서 huggingface 차단). 가짜 모델로 전 과정 검증.

## 1. 작업 규칙 (사용자 선호)
- 한국어, 간결·객관적, 근거와 한계를 같이.
- 구체적 작업은 선택지+추천 먼저 상의 → "ㄱㄱ" 때 진행.
- UI = DTME(kangsaem/DTME) 스타일: 진회색 바탕, 사각 입체 버튼(그림자 없음), 켜짐 파랑 `#2f4f78`/`#4a8fe0`, 실행 빨강 `#c0392b`. 화면에 설명 문구 없이 툴팁으로.
- 한국식 색(빨강=상승·매수, 파랑=하락·매도).
- 변경 시 `VERSION` 올리고, 아래 변경 이력 최신순 한 줄, 커밋·push.

## 2. 파일 지도
| 파일 | 역할 |
|---|---|
| `src/core.js` | 마스크 → 정리 → 윤곽 추적 → 단순화 → 베지어 SVG (브라우저·node 공용) |
| `src/template.html` | 화면·모델 로딩·추론·저장 |
| `build.py` | src → `web/vectorman.html` 한 파일로 합치기 |
| `tests/test_core.js` | 엔진 단위 테스트 (`node tests/test_core.js`) |
| `tests/e2e.py` | 크롬 자동 테스트(가짜 모델). 먼저 `tests/setup_vend.sh` |

## 3. 계획
1. ~~웹: DTME 스타일 UI, 설정 묶음, 프리셋~~ (v0.2.0 완료) → 사용자 실사진 테스트 대기
2. PC 엔진: BiRefNet_HR-matting(2048) + RTX 4090. 같은 화면에서 엔진만 선택. Windows exe 는 GitHub Actions 빌드(DTME 방식 참고)

## 4. 설정·프리셋 구조 (v0.2.0~)
- 설정 정의는 `src/template.html` 의 `GROUPS` 배열 한 곳 → 화면·기본값·프리셋이 모두 여기서 나옴. 새 설정 = 배열에 한 줄 + `opts()`/출력 코드에 반영.
- 기본 제공 프리셋 `BUILTIN`(기본·머리카락 살리기·칼선용·일러 편집용). 사용자 프리셋 = localStorage `vman.presets`, 마지막 설정 `vman.last`, 접은 묶음 `vman.closed`.
- 내보내기 JSON: `{app:"vectorman", version, presets:[{name, values}]}`. 가져오기는 알려진 키·같은 자료형만 받음.
- 엔진 선택 자리(`#engine`)에 "PC 엔진" 항목이 비활성으로 있음 → 2단계에서 연결.

## 5. 변경 이력 (최신순)
- v0.2.0 (2026-11-25) DTME 스타일 UI(진회색·사각 입체 버튼·접는 묶음·DTME 팝업), 설정 확장(확장·축소, 가장자리, 모서리 보존, 직선/베지어, 조각·구멍 크기, 인물 수, SVG 채움/선/칼선, PNG 크기·마스크 반전, 파일명, 미리보기 선·배경), 프리셋 저장·삭제·내보내기·가져오기, 키보드 1·2·3 보기 전환·↑↓ 사진 이동
- v0.1.0 (2026-11-25) 첫 버전: 웹 한 파일, BiRefNet-lite, SVG·투명 PNG·마스크, 일괄 ZIP
