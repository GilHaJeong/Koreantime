# 서체 라이선스

이 폴더의 `.woff2` 파일은 아래 서체의 **부분집합(subset)** 입니다.
원본 서체와 동일하게 **SIL Open Font License 1.1** 을 따릅니다.

| 서체 | 저작권 | 라이선스 | 원본 |
| --- | --- | --- | --- |
| Noto Serif KR | Copyright The Noto Project Authors | SIL OFL 1.1 | https://github.com/notofonts/noto-cjk |
| Noto Sans KR | Copyright The Noto Project Authors | SIL OFL 1.1 | https://github.com/notofonts/noto-cjk |
| DM Mono | Copyright Colophon Foundry, Jonathan Pinhorn | SIL OFL 1.1 | https://github.com/googlefonts/dm-mono |

OFL 1.1은 서체의 자유로운 사용·연구·수정·재배포를 허용하며, 부분집합 생성도
허용된 수정에 해당합니다. 다만 다음 조건이 붙습니다.

- 서체 자체를 유료로 단독 판매할 수 없습니다. 이 저장소는 서체를 판매하지 않습니다.
- 수정본은 원본의 예약 서체 이름(Reserved Font Name)을 쓸 수 없습니다.
  이 부분집합은 글리프만 추려낸 것이고 자형을 수정하지 않았으므로 원 이름을 유지합니다.
- 이 라이선스 고지를 함께 배포해야 합니다. 이 파일이 그 고지입니다.

라이선스 전문: https://openfontlicense.org

## 부분집합 범위

`scripts/build-fonts.mjs` 가 `index.html` · `assets/app.js` · `data/snapshot/*.json`
에서 쓰이는 문자를 모아 서브셋을 만듭니다. 스냅샷 문구가 바뀌면
`npm run fonts` 로 다시 만들어야 합니다.

한글 전체를 담은 서브셋은 Noto Serif KR 3굵기만 약 22MB라 저장소에 넣지 않습니다.
서브셋에 없는 글자는 웹폰트 대신 시스템의 바탕·돋움·고정폭 계열로 표시되며,
계약 4장이 요구하는 **층위 구분(원문 serif / 정규화 sans / 수치 mono)은 유지됩니다.**
