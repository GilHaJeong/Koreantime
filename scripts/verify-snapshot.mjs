#!/usr/bin/env node
/**
 * 스냅샷 검증 게이트
 *
 * 빌드 전에 실행하여, 파생 화면이 표시해서는 안 되는 상태를 차단한다.
 * 하나라도 실패하면 종료 코드 1을 반환한다. 경고가 아니라 중단이다.
 *
 * 규칙 근거: 구현 스펙·데이터 계약 v0.2 · 4장 검증 게이트
 * 이 스크립트는 값을 생성하거나 보정하지 않는다. 판정만 한다.
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const SNAPSHOT_DIR = process.env.SNAPSHOT_DIR ?? 'data/snapshot';

const EXPECTED_COUNTS = {
  models: 6,
  claims: 33,
  vectors: 29,
  paths: 4,
  indicators: 12,
};

const SHARE_TOLERANCE = 0.001;

const AREAS = [
  '시간·노동',
  '소득·불평등',
  '조직·경영',
  '경제·산업',
  '교육·인재',
  '국가·행정',
  '공동체·관계',
  '윤리·철학·의미',
  '가족·돌봄',
];

const SOURCE_STATUS = ['full', 'partial', 'missing'];
const VECTOR_STATE = ['계산 대기', '예비 계산', '교차 보정', '확정 벡터', '홈페이지 반영'];
const CURRENT_JUDGMENT = ['관찰', '주의', '경보', '판정 보류'];
const VALUE_KIND = ['직접값', '대체값', '간접 단서', '미확보'];
const MODEL_ID = /^M0[1-6]$/;

const results = [];
const record = (name, ok, detail) => results.push({ name, ok, detail });

async function load(file) {
  const full = path.join(SNAPSHOT_DIR, file);
  if (!existsSync(full)) return null;
  return JSON.parse(await readFile(full, 'utf8'));
}

function checkCounts(data) {
  for (const [key, expected] of Object.entries(EXPECTED_COUNTS)) {
    const rows = data[key];
    if (!Array.isArray(rows)) {
      record(`개수 · ${key}`, false, '스냅샷 없음 또는 배열 아님');
      continue;
    }
    record(`개수 · ${key}`, rows.length === expected, `${rows.length} / 기대 ${expected}`);
  }
}

function checkShareSums(vectors) {
  if (!Array.isArray(vectors)) return;
  const sums = new Map();
  for (const v of vectors) {
    const share = v.shareWeighted ?? v.shareProvisional;
    sums.set(v.modelId, (sums.get(v.modelId) ?? 0) + (typeof share === 'number' ? share : NaN));
  }
  for (const [modelId, sum] of [...sums].sort()) {
    const ok = Number.isFinite(sum) && Math.abs(sum - 1) <= SHARE_TOLERANCE;
    record(`비중 합계 · ${modelId}`, ok, Number.isFinite(sum) ? sum.toFixed(4) : '숫자 아님');
  }
}

function checkEnum(label, rows, field, allowed) {
  if (!Array.isArray(rows)) return;
  const bad = rows
    .filter((r) => r[field] !== undefined && r[field] !== null && !allowed.includes(r[field]))
    .map((r) => `${r.id ?? r.modelId ?? r.claimId ?? r.pathId ?? r.indicatorId ?? '?'}=${r[field]}`);
  record(`열거값 · ${label}.${field}`, bad.length === 0, bad.length ? bad.join(', ') : '위반 없음');
}

function checkAreas(rows, label) {
  if (!Array.isArray(rows)) return;
  const bad = rows.filter((r) => r.area && !AREAS.includes(r.area)).map((r) => r.area);
  record(`관심 영역 9종 · ${label}`, bad.length === 0, bad.length ? [...new Set(bad)].join(', ') : '위반 없음');
}

function checkClaimSources(claims) {
  if (!Array.isArray(claims)) return;
  const missing = claims
    .filter((c) => !c.originalText || !c.sourceUrl)
    .map((c) => c.claimId ?? '?');
  record('주장 원문·출처 필수', missing.length === 0, missing.length ? missing.join(', ') : '결측 없음');
}

function checkModelIds(rows, label) {
  if (!Array.isArray(rows)) return;
  const bad = rows.filter((r) => r.modelId && !MODEL_ID.test(r.modelId)).map((r) => r.modelId);
  record(`모델 ID 형식 · ${label}`, bad.length === 0, bad.length ? [...new Set(bad)].join(', ') : '위반 없음');
}

function checkIndicatorValues(indicators) {
  if (!Array.isArray(indicators)) return;

  const nullMismatch = indicators
    .filter((i) => (i.currentValue === null || i.currentValue === undefined) && i.valueKind !== '미확보')
    .map((i) => `${i.indicatorId}:${i.valueKind}`);
  record('값 없음이면 미확보', nullMismatch.length === 0, nullMismatch.length ? nullMismatch.join(', ') : '위반 없음');

  const clueMismatch = indicators
    .filter((i) => i.valueKind === '미확보' && i.currentValue !== null && i.currentValue !== undefined)
    .map((i) => i.indicatorId);
  record('미확보는 현재값 칸 금지', clueMismatch.length === 0, clueMismatch.length ? clueMismatch.join(', ') : '위반 없음');

  const clueMissing = indicators
    .filter((i) => i.valueKind === '미확보' && !i.referenceClue)
    .map((i) => i.indicatorId);
  record('미확보는 참고 단서 필수', clueMissing.length === 0, clueMissing.length ? clueMissing.join(', ') : '결측 없음');

  const placeholder = indicators
    .filter((i) => i.currentValue === 0 || i.currentValue === '' || i.currentValue === '-')
    .map((i) => i.indicatorId);
  record('0·하이픈·빈문자 대체 금지', placeholder.length === 0, placeholder.length ? placeholder.join(', ') : '위반 없음');
}

function checkPathJudgment(paths, indicators) {
  if (!Array.isArray(paths) || !Array.isArray(indicators)) return;
  const direct = indicators.filter((i) => i.valueKind === '직접값').length;
  if (direct > 0) {
    record('직접값 없으면 판정 보류', true, `직접값 ${direct}건 · 규칙 미적용`);
    return;
  }
  const decided = paths.filter((p) => p.currentJudgment !== '판정 보류').map((p) => p.pathId);
  record('직접값 없으면 판정 보류', decided.length === 0, decided.length ? decided.join(', ') : '위반 없음');
}

function checkMeta(meta) {
  if (!meta) {
    record('메타 표지', false, 'meta.json 없음');
    return;
  }
  const text = String(meta.disclaimer ?? '');
  const ok = text.includes('자동 계산') && text.includes('사람 미검토');
  record('메타 표지', ok, ok ? text : `현재값: ${text || '비어 있음'}`);
}

const data = {
  meta: await load('meta.json'),
  models: await load('models.json'),
  claims: await load('claims.json'),
  vectors: await load('vectors.json'),
  paths: await load('paths.json'),
  indicators: await load('indicators.json'),
};

checkCounts(data);
checkShareSums(data.vectors);
checkAreas(data.vectors, 'vectors');
checkAreas(data.claims, 'claims');
checkEnum('models', data.models, 'sourceStatus', SOURCE_STATUS);
checkEnum('vectors', data.vectors, 'sourceStatus', SOURCE_STATUS);
checkEnum('vectors', data.vectors, 'vectorState', VECTOR_STATE);
checkEnum('paths', data.paths, 'currentJudgment', CURRENT_JUDGMENT);
checkEnum('indicators', data.indicators, 'valueKind', VALUE_KIND);
checkModelIds(data.models, 'models');
checkModelIds(data.vectors, 'vectors');
checkModelIds(data.claims, 'claims');
checkClaimSources(data.claims);
checkIndicatorValues(data.indicators);
checkPathJudgment(data.paths, data.indicators);
checkMeta(data.meta);

const failed = results.filter((r) => !r.ok);
const width = Math.max(...results.map((r) => r.name.length));

console.log(`스냅샷 검증 게이트 · ${SNAPSHOT_DIR}\n`);
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(width)}  ${r.detail}`);
}
console.log(`\n합계 ${results.length}건 · 실패 ${failed.length}건`);

if (failed.length > 0) {
  console.error('\n검증 실패. 빌드를 중단합니다. 값을 보정하지 말고 기준본을 확인하십시오.');
  process.exit(1);
}
