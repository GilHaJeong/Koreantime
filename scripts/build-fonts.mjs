#!/usr/bin/env node
/**
 * 서체 자체 호스팅 번들 생성
 *
 * 결정 기록: 폰트 로딩 = 자체 호스팅 (2026-09-27, 설계자 지정)
 * 외부 CDN을 런타임에 호출하지 않는다. 화면은 저장소 안의 파일만 읽는다.
 *
 * 한글 전체 자족(自足) 서브셋은 Noto Serif KR 3굵기만 22MB라 저장소에 넣지 않는다.
 * 대신 이 화면이 실제로 쓰는 글자만 추려 굵기당 한 파일로 만든다.
 * 스냅샷이 바뀌면 이 스크립트를 다시 돌려야 한다 (npm run fonts).
 * 빌드 시점에만 네트워크가 필요하고, 화면을 여는 시점에는 필요 없다.
 *
 * 서체 라이선스: SIL Open Font License 1.1 (Noto Serif KR, Noto Sans KR, DM Mono)
 */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const OUT_DIR = 'assets/fonts';
const OUT_CSS = 'assets/fonts.css';

/* 계약 4장 · 서체 3종과 역할별 굵기 */
const FAMILIES = [
  { name: 'Noto Serif KR', slug: 'noto-serif-kr', weights: [400, 500, 600], subsetByText: true },
  { name: 'Noto Sans KR',  slug: 'noto-sans-kr',  weights: [400, 500],      subsetByText: true },
  { name: 'DM Mono',       slug: 'dm-mono',       weights: [400],           subsetByText: false },
];

/* ── 화면이 실제로 쓰는 글자 모으기 ───────────────── */
async function collectChars() {
  const sources = ['index.html', 'assets/app.js'];
  for (const f of await readdir('data/snapshot')) {
    if (f.endsWith('.json')) sources.push(path.join('data/snapshot', f));
  }

  let text = '';
  for (const f of sources) text += await readFile(f, 'utf8');

  const set = new Set();
  for (const ch of text) if (ch.codePointAt(0) > 31) set.add(ch);

  /* 여유분: 기본 라틴 전체와 자주 쓰는 한글 기호.
     화면 문구가 조금 바뀌어도 바로 깨지지 않게 한다. */
  for (let c = 0x20; c <= 0x7e; c++) set.add(String.fromCharCode(c));
  for (const ch of '·—–…“”‘’「」『』〈〉《》※→←↑↓●○△▲▸▾±×÷≤≥≈℃%‰€£¥₩') set.add(ch);

  return [...set].sort().join('');
}

/* ── Google Fonts CSS에서 woff2 주소만 뽑아낸다 ───── */
async function fetchCss(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`CSS 내려받기 실패 ${res.status} · ${url}`);
  return res.text();
}

async function download(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`서체 내려받기 실패 ${res.status} · ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

const chars = await collectChars();
console.log(`화면이 쓰는 고유 문자 ${[...chars].length}자를 기준으로 서브셋을 만듭니다.\n`);

await mkdir(OUT_DIR, { recursive: true });

const blocks = [];
let total = 0;

for (const fam of FAMILIES) {
  for (const weight of fam.weights) {
    const base = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fam.name)}:wght@${weight}&display=swap`;
    const url = fam.subsetByText ? `${base}&text=${encodeURIComponent(chars)}` : base;

    const css = await fetchCss(url);
    /* text= 서브셋 주소는 .woff2 확장자 없이 /l/font?kit=... 형태로 온다 */
    const urls = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map((m) => m[1]);
    if (urls.length === 0) throw new Error(`woff2 주소를 찾지 못했습니다 · ${fam.name} ${weight}`);

    /* text= 서브셋은 조각이 하나다. DM Mono만 기본 서브셋을 그대로 쓴다. */
    const ranges = [...css.matchAll(/unicode-range:\s*([^;]+);/g)].map((m) => m[1].trim());

    for (let i = 0; i < urls.length; i++) {
      const file = urls.length === 1 ? `${fam.slug}-${weight}.woff2` : `${fam.slug}-${weight}-${i}.woff2`;
      const buf = await download(urls[i]);
      await writeFile(path.join(OUT_DIR, file), buf);
      total += buf.length;

      blocks.push(
        [
          '@font-face {',
          `  font-family: '${fam.name}';`,
          '  font-style: normal;',
          `  font-weight: ${weight};`,
          '  font-display: swap;',
          `  src: url('fonts/${file}') format('woff2');`,
          ranges[i] ? `  unicode-range: ${ranges[i]};` : null,
          '}',
        ]
          .filter(Boolean)
          .join('\n')
      );

      console.log(`  ${file.padEnd(28)} ${(buf.length / 1024).toFixed(1)}KB`);
    }
  }
}

const header = [
  '/* 자동 생성 파일. 직접 고치지 말고 npm run fonts 를 실행하십시오.',
  '   폰트 로딩 결정: 자체 호스팅 (2026-09-27). 런타임에 외부 CDN을 호출하지 않습니다.',
  '   서체 라이선스: SIL Open Font License 1.1 — assets/fonts/LICENSE.md 참조.',
  `   서브셋 기준: 이 저장소의 화면·스냅샷이 쓰는 고유 문자 ${[...chars].length}자. */`,
  '',
].join('\n');

await writeFile(OUT_CSS, header + blocks.join('\n\n') + '\n', 'utf8');

console.log(`\n서체 번들 생성 · ${OUT_CSS}`);
console.log(`파일 ${blocks.length}개 · 합계 ${(total / 1024).toFixed(1)}KB`);
