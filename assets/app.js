/* 화면 조립기.
   시각 디자인 계약 v0.2 이행. 값을 계산하지 않고 스냅샷을 그대로 배치한다.
   강조색은 사람의 선택·링크·현재 위치에만 쓰고 데이터에는 칠하지 않는다. */
(() => {
  'use strict';

  const S = window.__SNAPSHOT__;
  const $ = (id) => document.getElementById(id);

  /* 6장 DisclaimerHeader: meta 주입 실패 시 빈칸이 아니라 적색 경고 블록 */
  if (!S || !S.meta) {
    const bar = $('bar-badges');
    if (bar) {
      bar.className = 'fail';
      bar.textContent = '스냅샷 주입 실패 · 이 화면의 표지를 신뢰할 수 없습니다';
    }
    document.body.insertAdjacentHTML(
      'afterbegin',
      '<p style="padding:24px;color:#a3402f">스냅샷 번들이 없습니다. npm run build 를 먼저 실행하십시오.</p>'
    );
    return;
  }

  const { meta, models, claims, vectors, paths, indicators } = S;

  /* ── 3.3 관심 영역 9색 토큰 ─────────────────────── */
  const AREA_TOKEN = {
    '시간·노동': '--area-time',
    '소득·불평등': '--area-income',
    '조직·경영': '--area-org',
    '경제·산업': '--area-econ',
    '교육·인재': '--area-edu',
    '국가·행정': '--area-gov',
    '공동체·관계': '--area-community',
    '윤리·철학·의미': '--area-ethics',
    '가족·돌봄': '--area-care',
  };
  const areaVar = (area) => (AREA_TOKEN[area] ? `var(${AREA_TOKEN[area]})` : 'var(--text-faint)');

  /* 3.4 운영사는 중립 회색 4단계 세로 바로만. 브랜드 색 금지 */
  const VENDOR_BAR = {
    'S01 · GPT 쌍': '#868e9c',
    'S02 · Gemini 쌍': '#b3aca0',
    'S03 · Opus 쌍': '#575f6d',
  };

  /* 6장 StatusBadge: 화이트리스트 밖 값은 렌더하지 않는 단일 렌더러 */
  const BADGE_SET = new Set([
    '자동 계산', '사람 미검토', '외부 검증 전',
    '직접값', '대체값', '간접 단서', '미확보',
    '판정 보류', '예비',
  ]);

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  };

  const badge = (label, aria) => {
    if (!BADGE_SET.has(label)) {
      console.error(`배지 화이트리스트 위반: ${label} — 렌더하지 않습니다.`);
      return null;
    }
    const b = el('span', 'badge', label);
    b.dataset.s = label;
    b.setAttribute('aria-label', aria ?? `상태: ${label}`);
    return b;
  };

  const appendBadge = (parent, label, aria) => {
    const b = badge(label, aria);
    if (b) parent.appendChild(b);
    return b;
  };

  /* 모든 수치는 모노 서체 + 스냅샷 출처 툴팁을 동반한다 (8장) */
  const num = (text, sourceId) => {
    const n = el('span', 'num', text);
    n.title = `스냅샷 ${meta.snapshotVersion} · ${sourceId}`;
    return n;
  };

  const idTag = (text, sourceId) => {
    const n = el('span', 'id', text);
    if (sourceId) n.title = `스냅샷 ${meta.snapshotVersion} · ${sourceId}`;
    return n;
  };

  const pct = (n) => `${(n * 100).toFixed(2)}%`;

  const areaChip = (area) => {
    const c = el('span', 'chip', area);
    c.style.setProperty('--chip', areaVar(area));
    return c;
  };

  const idChip = (text) => el('span', 'chip id', text);

  /* ── 고정 헤더 ──────────────────────────────────── */
  $('bar-ref').textContent = `${meta.contractVersion} · 스냅샷 ${meta.snapshotVersion} (${meta.snapshotDate})`;
  const barBadges = $('bar-badges');
  for (const s of ['자동 계산', '사람 미검토', '외부 검증 전']) appendBadge(barBadges, s);

  /* ── 색인용 가설 인라인 태그 (8장: 해설 링크 없이는 렌더 금지) ── */
  const EXPLAINER =
    '“대한민국 여가시간 80% 분석”은 이 작업을 부르기 위한 색인 문자열이며, ' +
    '한국인의 여가시간이 80% 늘어난다는 사실 진술이 아닙니다. ' +
    '80%라는 수치는 이 화면의 어떤 스냅샷에도 근거가 없고, 조기 신호 지표 12종 중 직접값은 0건입니다. ' +
    '따라서 이 문자열은 검증 대상 가설의 이름표로만 쓰며, 본문 수치와 섞어 인용할 수 없습니다.';

  const hypoBox = $('hypothesis');
  const explainerBox = $('hypothesis-explainer');
  if (explainerBox) {
    explainerBox.textContent = EXPLAINER;
    hypoBox.append(
      document.createTextNode('색인용 가설 '),
      (() => {
        const a = el('a', null, meta.indexTitle);
        a.href = '#hypothesis-note';
        a.setAttribute('aria-label', `색인용 가설 ${meta.indexTitle} — 해설로 이동`);
        return a;
      })()
    );
  } else {
    hypoBox.remove();
  }

  /* ── 다섯 개의 질문 ─────────────────────────────── */
  const directCount = indicators.filter((i) => i.valueKind === '직접값').length;
  const questions = [
    ...paths.map((p) => ({
      q: p.coreQuestion,
      a: `${p.pathId} ${p.title} · 우선 지표 ${p.priorityIndicators.join('·')} · 현재 판정 판정 보류`,
    })),
    {
      q: '우리는 위 네 질문에 답할 수치를 갖고 있는가?',
      a: `아직 아닙니다. 조기 신호 지표 12종 가운데 직접값은 ${directCount}건이고, 대체값 3건·간접 단서 4건·미확보 5건입니다.`,
    },
  ];
  const qList = $('questions');
  for (const item of questions) {
    const li = el('li');
    li.appendChild(el('p', 'q', item.q));
    li.appendChild(el('p', 'a', item.a));
    qList.appendChild(li);
  }

  /* ── 건수 ───────────────────────────────────────── */
  const COUNT_LABEL = {
    models: '모델', claims: '주장', vectors: '관심 벡터',
    paths: '선택경로', indicators: '조기 신호 지표',
  };
  const countsBox = $('counts');
  for (const [key, label] of Object.entries(COUNT_LABEL)) {
    const d = el('div');
    d.appendChild(el('dt', null, label));
    const dd = el('dd');
    dd.appendChild(num(String(meta.counts[key]), `${key}.json`));
    d.appendChild(dd);
    countsBox.appendChild(d);
  }

  /* ── 선택경로 ───────────────────────────────────── */
  const pathBox = $('path-cards');
  for (const p of paths) {
    const c = el('div', 'card enter');
    const head = el('div', 'card-head');
    head.appendChild(idTag(p.pathId, 'paths.json'));
    head.appendChild(el('h3', null, p.title));
    appendBadge(head, p.currentJudgment, `${p.pathId} 현재 판정: ${p.currentJudgment}`);
    c.appendChild(head);

    c.appendChild(el('p', 'q', p.coreQuestion));
    c.appendChild(el('p', 'why', `판정 보류 이유 — ${p.judgmentReason}`));
    c.appendChild(el('p', 'quote', p.judgmentSentence));

    const foot = el('div', 'foot');
    foot.appendChild(el('p', 'field-label', `우선 지표 ${p.priorityIndicators.length}종 · 담당 영역 ${p.ownerDomains.join('·')}`));
    const chips = el('div', 'chips');
    for (const i of p.priorityIndicators) chips.appendChild(idChip(i));
    foot.appendChild(chips);
    c.appendChild(foot);

    pathBox.appendChild(c);
  }

  /* ── ValueOrGap ─────────────────────────────────── */
  const valueOrGap = (indicator) => {
    const box = el('div', 'field');
    box.appendChild(el('span', 'field-label', '현재값'));

    if (indicator.valueKind === '미확보') {
      const bar = el('p', 'gap-bar');
      const hatch = el('span', 'gap-hatch');
      hatch.setAttribute('role', 'img');
      hatch.setAttribute('aria-label', '미확보');
      hatch.title = `미확보 — ${indicator.referenceClue}`;
      bar.appendChild(hatch);
      const b = badge('미확보', `${indicator.indicatorId} 값 종류: 미확보`);
      if (b) bar.appendChild(b);
      box.appendChild(bar);
      box.appendChild(el('p', 'gap-why', '이 지표의 정의에 대응하는 수치가 확보되지 않았습니다.'));
      return box;
    }

    box.appendChild(el('p', 'field-value', indicator.currentValue));
    return box;
  };

  /* ── 조기 신호 지표 ─────────────────────────────── */
  const KIND_ORDER = ['직접값', '대체값', '간접 단서', '미확보'];
  const kindCount = Object.fromEntries(
    KIND_ORDER.map((k) => [k, indicators.filter((i) => i.valueKind === k).length])
  );

  const indicatorRows = $('indicator-rows');
  const indicatorCount = $('indicator-count');

  const renderIndicators = (kind) => {
    indicatorRows.replaceChildren();
    /* 정의 순서를 유지한다. valueKind 로 정렬하지 않는다 (6장 SignalBoard). */
    const list = kind === '전체' ? indicators : indicators.filter((i) => i.valueKind === kind);
    indicatorCount.textContent = `${list.length}건 표시 · 전체 ${indicators.length}건 · 정의 순서 유지`;

    for (const i of list) {
      const r = el('div', 'row');
      const head = el('div', 'row-head');
      head.appendChild(idTag(i.indicatorId, 'indicators.json'));
      head.appendChild(el('h3', 'row-title', i.title));
      appendBadge(head, i.valueKind, `${i.indicatorId} 값 종류: ${i.valueKind}`);
      r.appendChild(head);

      const def = el('div', 'field');
      def.appendChild(el('span', 'field-label', '지표 정의'));
      def.appendChild(el('p', 'field-value muted', i.definition));
      r.appendChild(def);

      r.appendChild(valueOrGap(i));

      if (i.valueKind === '미확보') {
        const clue = el('div', 'field clue');
        clue.appendChild(el('span', 'field-label', '참고 단서 · 이 지표의 값이 아님'));
        clue.appendChild(el('p', 'field-value muted', i.referenceClue));
        r.appendChild(clue);
      }

      const note = el('div', 'field');
      note.appendChild(el('span', 'field-label', '판단 메모'));
      note.appendChild(el('p', 'field-value muted', i.note));
      r.appendChild(note);

      const dl = el('dl', 'pairs');
      const entries = [
        ['지표 영역', i.domain],
        ['신호 방향', i.signalDirection],
        ['시의성', i.timeliness],
        ['갱신 주기', i.updateCycle],
        ['연결 경로', i.linkedPaths.join('·')],
        ['판단 경계값', i.judgmentBoundary],
        ['기준값', i.baseline],
        ['자료 확보 계획', i.dataPlan],
      ];
      for (const [k, v] of entries) {
        const wrap = el('div');
        wrap.appendChild(el('dt', null, k));
        wrap.appendChild(el('dd', null, v));
        dl.appendChild(wrap);
      }
      r.appendChild(dl);

      if (i.sourceUrls && i.sourceUrls.length) {
        const ul = el('ul', 'srcs');
        for (const u of i.sourceUrls) {
          const li = el('li');
          const a = el('a', null, u);
          a.href = u;
          a.rel = 'noreferrer noopener';
          a.target = '_blank';
          li.appendChild(a);
          /* 6장 SourceLink: 버전 태그 없는 링크는 렌더하지 않는다 */
          li.appendChild(el('span', 'ver', `스냅샷 ${meta.snapshotVersion}`));
          ul.appendChild(li);
        }
        r.appendChild(ul);
      }

      indicatorRows.appendChild(r);
    }
  };

  const indicatorFilters = $('indicator-filters');
  for (const opt of ['전체', ...KIND_ORDER.filter((k) => kindCount[k] > 0)]) {
    const b = el('button', null, opt === '전체' ? `전체 ${indicators.length}` : `${opt} ${kindCount[opt]}`);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(opt === '전체'));
    b.addEventListener('click', () => {
      for (const sib of indicatorFilters.children) sib.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-pressed', 'true');
      renderIndicators(opt);
    });
    indicatorFilters.appendChild(b);
  }
  renderIndicators('전체');

  /* ── 모델 관심 벡터 + 표 대체본 ─────────────────── */
  const modelBox = $('model-cards');
  for (const m of models) {
    const rows = vectors
      .filter((v) => v.modelId === m.modelId)
      .slice()
      .sort((a, b) => b.shareProvisional - a.shareProvisional);
    const sum = rows.reduce((t, v) => t + v.shareProvisional, 0);
    const max = rows.length ? rows[0].shareProvisional : 1;

    const c = el('div', 'model');
    /* 3.4 sourceStatus full → 실선 1px. partial → 점선. missing → 해칭 + 점선 */
    if (m.sourceStatus === 'partial') c.style.borderStyle = 'dashed';
    if (m.sourceStatus === 'missing') {
      c.style.borderStyle = 'dashed';
      c.style.backgroundImage =
        'repeating-linear-gradient(45deg, var(--line) 0, var(--line) 1.5px, transparent 1.5px, transparent 6px)';
    }

    const head = el('div', 'model-head');
    const vendor = el('span', 'vendor');
    vendor.style.setProperty('--vendor', VENDOR_BAR[m.sessionPair] ?? 'var(--text-faint)');
    vendor.setAttribute('role', 'img');
    vendor.setAttribute('aria-label', `세션 쌍 ${m.sessionPair}`);
    head.appendChild(vendor);
    head.appendChild(idTag(m.modelId, 'models.json'));
    head.appendChild(el('h3', null, m.label));
    head.appendChild(el('span', 'pair', m.sessionPair));
    c.appendChild(head);

    c.appendChild(el('p', 'struct', `원문에서 관측된 구조 — ${m.observedStructure}`));

    const bars = el('div', 'vbars');
    for (const v of rows) {
      const line = el('div', `vbar${v.vectorState === '예비 계산' ? ' prelim' : ''}`);
      const name = el('span', 'name', v.area);
      name.title = v.note;
      line.appendChild(name);

      const track = el('span', 'track');
      const fill = el('span', 'fill');
      fill.style.width = `${(v.shareProvisional / max) * 100}%`;
      fill.style.setProperty('--area', areaVar(v.area));
      track.appendChild(fill);
      line.appendChild(track);

      const val = el('span', 'val');
      val.appendChild(num(pct(v.shareProvisional), `vectors.json · ${v.vectorId}`));
      /* 8장: 예비 비중은 점선 모서리 + "예비" 배지 동시 강제 */
      if (v.vectorState === '예비 계산') appendBadge(val, '예비', `${v.vectorId} 벡터 상태: 예비 계산`);
      line.appendChild(val);

      bars.appendChild(line);
    }
    c.appendChild(bars);

    /* 1장: 모든 시각화에는 동등한 표 대체본이 같은 페이지에 있어야 한다 */
    const alt = el('details', 'alt');
    alt.appendChild(el('summary', null, `${m.modelId} 관심 벡터 표 대체본 보기`));
    const table = el('table', 'alt-table');
    const thead = el('thead');
    const hr = el('tr');
    for (const h of ['관심 영역', '비중', '주장 수', '벡터 상태', '자료 상태']) hr.appendChild(el('th', null, h));
    thead.appendChild(hr);
    table.appendChild(thead);
    const tbody = el('tbody');
    for (const v of rows) {
      const tr = el('tr');
      tr.appendChild(el('td', null, v.area));
      tr.appendChild(el('td', 'n', pct(v.shareProvisional)));
      tr.appendChild(el('td', 'n', String(v.claimCount)));
      tr.appendChild(el('td', null, v.vectorState));
      tr.appendChild(el('td', null, v.sourceStatus));
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    alt.appendChild(table);
    c.appendChild(alt);

    const states = [...new Set(rows.map((v) => v.vectorState))].join('·');
    const sumline = el('p', 'sumline');
    sumline.append(
      document.createTextNode(`${rows.length}개 영역 · 비중 합계 `),
      num(sum.toFixed(4), `vectors.json · ${m.modelId}`),
      document.createTextNode(` · 벡터 상태 ${states} · 주장 ${m.claimCount}건 · 조건부 경로 ${m.conditionalPaths.join('·')}`)
    );
    c.appendChild(sumline);

    modelBox.appendChild(c);
  }

  /* ── 주장 원장 ──────────────────────────────────── */
  const claimRows = $('claim-rows');
  const claimCount = $('claim-count');

  const renderClaims = (f) => {
    claimRows.replaceChildren();
    const list = claims.filter((c) =>
      f.type === 'all' ? true : f.type === 'model' ? c.modelId === f.value : c.area === f.value
    );
    claimCount.textContent = `${list.length}건 표시 · 전체 ${claims.length}건`;

    for (const c of list) {
      /* 6장 ClaimPanel: 원문 슬롯이 비면 아예 열지 않는다 */
      if (!c.originalText) {
        console.error(`원문 결측으로 렌더하지 않음: ${c.claimId}`);
        continue;
      }
      const r = el('div', 'row');
      const head = el('div', 'row-head');
      head.appendChild(idTag(c.claimId, 'claims.json'));
      head.appendChild(el('h3', 'row-title', c.title));
      head.appendChild(areaChip(c.area));
      r.appendChild(head);

      const o = el('div', 'field');
      o.appendChild(el('span', 'field-label', '모델 원문'));
      o.appendChild(el('p', 'orig', c.originalText));
      r.appendChild(o);

      const n = el('div', 'field clue');
      n.appendChild(el('span', 'field-label', '정규화 문장 · 편집 산출물'));
      n.appendChild(el('p', 'norm', c.normalizedText));
      r.appendChild(n);

      const dl = el('dl', 'pairs');
      for (const [k, v] of [
        ['모델', c.modelId],
        ['세부 영역', c.subArea],
        ['근거 유형', c.evidenceType],
        ['주장 유형', c.claimType],
        ['검증 상태', c.verificationState],
        ['공통성 상태', c.commonalityState],
        ['분석 상태', c.analysisState],
        ['세션 쌍', c.sessionPair],
      ]) {
        const w = el('div');
        w.appendChild(el('dt', null, k));
        w.appendChild(el('dd', null, v));
        dl.appendChild(w);
      }
      r.appendChild(dl);
      r.appendChild(el('p', 'mono', `원자료 참조 · ${c.sourceUrl}`));
      claimRows.appendChild(r);
    }
  };

  const claimFilters = $('claim-filters');
  const claimOptions = [
    { label: `전체 ${claims.length}`, f: { type: 'all' } },
    ...models.map((m) => ({ label: `${m.modelId} ${m.claimCount}`, f: { type: 'model', value: m.modelId } })),
    ...meta.areaEnum.map((a) => ({
      label: `${a} ${claims.filter((c) => c.area === a).length}`,
      f: { type: 'area', value: a },
    })),
  ];
  claimOptions.forEach((opt, idx) => {
    const b = el('button', null, opt.label);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(idx === 0));
    b.addEventListener('click', () => {
      for (const sib of claimFilters.children) sib.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-pressed', 'true');
      renderClaims(opt.f);
    });
    claimFilters.appendChild(b);
  });
  renderClaims({ type: 'all' });

  /* ── 규칙 · 미구현 고지 · 바닥 ──────────────────── */
  const rulesBox = $('display-rules');
  for (const rule of meta.displayRules) rulesBox.appendChild(el('li', null, rule));

  const NOT_YET = [
    ['사각형 맵 (TreemapMap)', '관심 벡터를 면적으로 보여 주는 사각형 맵은 아직 없습니다. 현재는 막대와 표 대체본으로만 제공합니다.'],
    ['공통성 매트릭스 (ConsensusMatrix)', '모델 간 공통·고유 제시를 ● △ — 기호로 대조하는 화면은 아직 없습니다. 주장 33건이 전부 판정 대기라 대조할 판정이 없습니다.'],
    ['이해관계층 보기 (StakeholderView)', '8종 이해관계층 필터는 아직 없습니다. 지표 DB에 이해관계층 값은 있으나 화면에 연결하지 않았습니다.'],
    ['경로 시간축 (PathTimeline)', 'P01~P04를 4국면 수평 축으로 놓는 화면은 아직 없습니다. 현재는 카드로만 제공합니다.'],
    ['접근성 실측', '본문 대비비 4.5:1, 배지 3:1, 영역 9색의 색각 구분 가능성, 해칭 패턴의 축소 내성은 모두 미실측입니다.'],
    ['서체 로딩', 'Noto Serif KR · Noto Sans KR · DM Mono를 지정했으나 로딩 방식(자체 호스팅·외부 CDN)이 미결이라 웹폰트를 내려받지 않습니다. 서체가 없는 환경에서는 바탕·돋움·고정폭 계열로 층위만 유지됩니다.'],
    ['다크 보조 테마', '계약 10장에서 제공 여부가 미결이므로 토큰만 정의하고 자동 추종은 붙이지 않았습니다. 활성화하려면 사람이 html 요소에 data-theme="dark"를 붙여야 합니다.'],
  ];
  const notYet = $('not-yet');
  for (const [k, v] of NOT_YET) {
    notYet.appendChild(el('dt', null, k));
    notYet.appendChild(el('dd', null, v));
  }

  $('provenance').textContent =
    `${meta.sourceOfTruth}. 주장 원장의 원자료 참조는 내부 세션 식별자(session://…)이며 공개 인용 가능한 외부 출처가 아닙니다. ` +
    '외부 출처가 확인된 지표에만 링크와 스냅샷 버전 태그를 답니다.';

  $('footer-meta').textContent =
    `${meta.projectTitle} · 스냅샷 ${meta.snapshotVersion} (${meta.snapshotDate}) · ` +
    `${meta.contractVersion} · 시각 디자인 계약 v0.2 · 정본 저장소 ${meta.canonicalRepository} · ` +
    `게이트 ${S.buildInfo.gate}`;
})();
