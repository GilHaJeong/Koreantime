#!/usr/bin/env node
/**
 * 검증 게이트 자체 시험.
 *
 * 임시 디렉터리에 구조만 맞춘 합성 스냅샷을 만들어 게이트를 실행한다.
 * 합성 데이터는 저장소에 커밋하지 않으며, 분석 값이 아니다.
 */

import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const GATE = new URL('./verify-snapshot.mjs', import.meta.url).pathname;

const AREAS = ['시간·노동', '소득·불평등', '조직·경영', '경제·산업', '교육·인재',
  '국가·행정', '공동체·관계', '윤리·철학·의미', '가족·돌봄'];

function buildSnapshot() {
  const models = Array.from({ length: 6 }, (_, i) => ({
    id: `M0${i + 1}`, sourceStatus: 'full', claimCount: 1,
  }));

  // 실제 행 분포 M01 3 · M02 4 · M03 8 · M04 4 · M05 4 · M06 6 = 29행
  // 모델별 합계는 정확히 1.0이 되도록 마지막 행에서 잔차를 맞춘다
  const ROWS_PER_MODEL = [3, 4, 8, 4, 4, 6];
  const vectors = [];
  models.forEach((m, mi) => {
    const n = ROWS_PER_MODEL[mi];
    const unit = Math.round((1 / n) * 10000) / 10000;
    for (let k = 0; k < n; k += 1) {
      const share = k === n - 1 ? Number((1 - unit * (n - 1)).toFixed(4)) : unit;
      vectors.push({
        vectorId: `${m.id}-${k}`, modelId: m.id, area: AREAS[k % AREAS.length],
        shareProvisional: share,
        shareWeighted: null, sourceStatus: 'full', vectorState: '예비 계산',
      });
    }
  });

  const claims = Array.from({ length: 33 }, (_, i) => ({
    claimId: `C-${i}`, modelId: `M0${(i % 6) + 1}`, area: AREAS[i % 9],
    originalText: '원문 자리', sourceUrl: 'https://example.invalid/x',
  }));

  const paths = Array.from({ length: 4 }, (_, i) => ({
    pathId: `P0${i + 1}`, currentJudgment: '판정 보류',
  }));

  const indicators = Array.from({ length: 12 }, (_, i) => ({
    indicatorId: `I${String(i + 1).padStart(2, '0')}`,
    currentValue: null, valueKind: '미확보',
  }));

  const meta = { disclaimer: '자동 계산·사람 미검토·외부 검증 전' };

  return { meta, models, claims, vectors, paths, indicators };
}

async function writeSnapshot(dir, snapshot) {
  await mkdir(dir, { recursive: true });
  for (const [key, value] of Object.entries(snapshot)) {
    await writeFile(path.join(dir, `${key}.json`), JSON.stringify(value, null, 2));
  }
}

function run(dir) {
  const r = spawnSync(process.execPath, [GATE], {
    env: { ...process.env, SNAPSHOT_DIR: dir }, encoding: 'utf8',
  });
  return { code: r.status, out: r.stdout + r.stderr };
}

const failures = [];
const expect = (label, cond, detail) => {
  console.log(`${cond ? 'ok  ' : 'FAIL'}  ${label}${cond ? '' : ` — ${detail}`}`);
  if (!cond) failures.push(label);
};

const root = await mkdtemp(path.join(tmpdir(), 'gate-'));

try {
  // 1. 스냅샷이 없으면 차단
  const empty = path.join(root, 'empty');
  await mkdir(empty, { recursive: true });
  const none = run(empty);
  expect('스냅샷 없음 → 차단', none.code === 1, `종료 코드 ${none.code}`);

  // 2. 정상 스냅샷은 통과
  const good = path.join(root, 'good');
  await writeSnapshot(good, buildSnapshot());
  const pass = run(good);
  expect('정상 스냅샷 → 통과', pass.code === 0, pass.out);

  // 3. 합계가 어긋나면 차단
  const badSum = buildSnapshot();
  badSum.vectors[0].shareProvisional += 0.05;
  const sumDir = path.join(root, 'bad-sum');
  await writeSnapshot(sumDir, badSum);
  const sum = run(sumDir);
  expect('비중 합계 위반 → 차단', sum.code === 1 && /비중 합계/.test(sum.out), `종료 코드 ${sum.code}`);

  // 4. 영역 열거값 위반이면 차단
  const badArea = buildSnapshot();
  badArea.vectors[0].area = '기술·자동화';
  const areaDir = path.join(root, 'bad-area');
  await writeSnapshot(areaDir, badArea);
  const area = run(areaDir);
  expect('영역 9종 위반 → 차단', area.code === 1 && /관심 영역/.test(area.out), `종료 코드 ${area.code}`);

  // 5. 값 없음인데 미확보가 아니면 차단
  const badKind = buildSnapshot();
  badKind.indicators[0].valueKind = '직접값';
  const kindDir = path.join(root, 'bad-kind');
  await writeSnapshot(kindDir, badKind);
  const kind = run(kindDir);
  expect('값 없음·상태 불일치 → 차단', kind.code === 1 && /미확보/.test(kind.out), `종료 코드 ${kind.code}`);

  // 6. 0으로 대체하면 차단
  const badZero = buildSnapshot();
  badZero.indicators[1].currentValue = 0;
  badZero.indicators[1].valueKind = '직접값';
  const zeroDir = path.join(root, 'bad-zero');
  await writeSnapshot(zeroDir, badZero);
  const zero = run(zeroDir);
  expect('0 대체 → 차단', zero.code === 1 && /0·하이픈/.test(zero.out), `종료 코드 ${zero.code}`);

  // 7. 원문·출처가 없으면 차단
  const badSrc = buildSnapshot();
  delete badSrc.claims[0].sourceUrl;
  const srcDir = path.join(root, 'bad-src');
  await writeSnapshot(srcDir, badSrc);
  const src = run(srcDir);
  expect('원문·출처 결측 → 차단', src.code === 1 && /원문·출처/.test(src.out), `종료 코드 ${src.code}`);

  // 8. 메타 표지가 없으면 차단
  const badMeta = buildSnapshot();
  badMeta.meta.disclaimer = '검증 완료';
  const metaDir = path.join(root, 'bad-meta');
  await writeSnapshot(metaDir, badMeta);
  const meta = run(metaDir);
  expect('메타 표지 누락 → 차단', meta.code === 1 && /메타 표지/.test(meta.out), `종료 코드 ${meta.code}`);
} finally {
  await rm(root, { recursive: true, force: true });
}

console.log(`\n시험 ${failures.length === 0 ? '전부 통과' : `실패 ${failures.length}건`}`);
process.exit(failures.length === 0 ? 0 : 1);
