#!/usr/bin/env node
/**
 * 스냅샷 → 화면 번들 생성
 *
 * data/snapshot/*.json 을 읽어 assets/snapshot.js 한 파일로 묶는다.
 * 이 단계는 값을 바꾸지 않는다. 복사와 표지 부착만 한다.
 * 반드시 verify-snapshot.mjs 통과 뒤에 실행한다 (npm run build 가 순서를 강제한다).
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const SNAPSHOT_DIR = process.env.SNAPSHOT_DIR ?? 'data/snapshot';
const OUT = process.env.SITE_BUNDLE ?? 'assets/snapshot.js';
const FILES = ['meta', 'models', 'claims', 'vectors', 'paths', 'indicators'];

const snapshot = {};
for (const name of FILES) {
  snapshot[name] = JSON.parse(await readFile(path.join(SNAPSHOT_DIR, `${name}.json`), 'utf8'));
}

/* 빌드 시각을 넣지 않는다. 같은 스냅샷이면 언제 돌려도 같은 파일이 나와야
   CI 에서 "커밋된 번들이 스냅샷과 일치하는가"를 검사할 수 있다.
   화면에 필요한 시각은 meta.snapshotDate 이지 빌드 시각이 아니다. */
snapshot.buildInfo = {
  snapshotDir: SNAPSHOT_DIR,
  gate: 'scripts/verify-snapshot.mjs 통과본',
};

const banner = `/* 자동 생성 파일. 직접 고치지 말고 data/snapshot 을 고친 뒤 npm run build 를 실행하십시오. */\n`;
const body = `window.__SNAPSHOT__ = Object.freeze(${JSON.stringify(snapshot)});\n`;

await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, banner + body, 'utf8');

const rows = FILES.filter((f) => Array.isArray(snapshot[f])).map((f) => `${f} ${snapshot[f].length}`);
console.log(`화면 번들 생성 · ${OUT}`);
console.log(`포함: ${rows.join(' · ')}`);
