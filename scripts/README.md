# scripts

## verify-snapshot.mjs

빌드 전에 실행하는 스냅샷 검증 게이트입니다. 파생 화면이 표시해서는 안 되는
상태를 차단합니다. 하나라도 어긋나면 종료 코드 1을 반환합니다. 경고가 아니라
중단입니다.

```sh
node scripts/verify-snapshot.mjs              # 기본 경로 data/snapshot
SNAPSHOT_DIR=other/dir node scripts/verify-snapshot.mjs
```

검사 항목

- 기준 개수 — 모델·주장·벡터·경로·지표
- 모델별 비중 합계 1.0 ± 0.001
- 관심 영역 9종 외 값 거부
- sourceStatus · vectorState · currentJudgment · valueKind 허용값
- 주장에 원문과 출처 필수
- 값이 없으면 상태가 미확보여야 함
- 값 자리에 0 · 하이픈 · 빈 문자열을 넣는 것 금지
- 메타 표지에 자동 계산·사람 미검토 상태 포함

이 스크립트는 값을 생성하거나 보정하지 않습니다. 판정만 합니다. 검증이 실패하면
값을 맞추지 말고 기준본을 확인해야 합니다.

## verify-snapshot.test.mjs

게이트 자체 시험입니다. 임시 디렉터리에 구조만 맞춘 합성 데이터를 만들어
통과·차단 동작을 확인합니다. 합성 데이터는 저장소에 남지 않으며 분석 값이
아닙니다.

```sh
node scripts/verify-snapshot.test.mjs
```
