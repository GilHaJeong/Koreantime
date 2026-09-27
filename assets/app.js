/* 화면 조립기. 값을 계산하지 않고 스냅샷을 그대로 배치한다. */
(() => {
  'use strict';

  const S = window.__SNAPSHOT__;
  const $ = (id) => document.getElementById(id);

  if (!S) {
    document.body.insertAdjacentHTML(
      'afterbegin',
      '<p style="padding:24px;color:#b3261e;font-weight:600">스냅샷 번들을 찾을 수 없습니다. npm run build 를 먼저 실행하십시오.</p>'
    );
    return;
  }

  const { meta, models, claims, vectors, paths, indicators } = S;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  };

  const pct = (n) => `${(n * 100).toFixed(2)}%`;

  const kindBadge = (kind) => {
    const b = el('span', 'kind', kind);
    b.dataset.k = kind;
    return b;
  };

  const chipRow = (items) => {
    const box = el('div', 'chips');
    for (const t of items) box.appendChild(el('span', 'chip', t));
    return box;
  };

  const field = (label, value, opts = {}) => {
    const box = el('div', `field${opts.extra ? ' ' + opts.extra : ''}`);
    box.appendChild(el('span', 'field-label', label));
    if (value === null || value === undefined || value === '') {
      box.classList.add('empty');
      box.appendChild(el('p', 'field-value', opts.emptyText ?? '값 없음'));
    } else {
      box.appendChild(el('p', `field-value${opts.muted ? ' muted' : ''}`, value));
    }
    return box;
  };

  const pairs = (entries) => {
    const box = el('div', 'pairs');
    for (const [k, v] of entries) {
      const d = el('div');
      d.appendChild(el('span', null, k));
      d.appendChild(el('strong', null, v));
      box.appendChild(d);
    }
    return box;
  };

  /* ── 표지 ─────────────────────────── */
  $('index-title').textContent = meta.indexTitle;
  $('disclaimer').textContent = meta.disclaimer;

  const badges = $('state-badges');
  for (const t of ['자동 계산', '사람 미검토', '외부 검증 전']) {
    badges.appendChild(kindBadgeLike(t, true));
  }
  badges.appendChild(kindBadgeLike(`스냅샷 ${meta.snapshotDate}`, false));
  badges.appendChild(kindBadgeLike(`자동화 등급 ${meta.automationGrade} · 공개 ${meta.publishGrade}`, false));

  function kindBadgeLike(text, warn) {
    const b = el('span', warn ? 'badge warn' : 'badge', text);
    return b;
  }

  const countLabels = {
    models: '모델',
    claims: '주장',
    vectors: '관심 벡터',
    paths: '선택경로',
    indicators: '조기 신호 지표',
  };
  const countsBox = $('counts');
  for (const [key, label] of Object.entries(countLabels)) {
    const d = el('div');
    d.appendChild(el('dt', null, label));
    d.appendChild(el('dd', null, String(meta.counts[key])));
    countsBox.appendChild(d);
  }

  /* ── 선택경로 ─────────────────────── */
  const pathBox = $('path-cards');
  for (const p of paths) {
    const c = el('div', 'card');
    const head = el('div', 'card-head');
    head.appendChild(el('span', 'card-id', p.pathId));
    head.appendChild(el('h3', null, p.title));
    head.appendChild(kindBadge(p.currentJudgment));
    c.appendChild(head);

    c.appendChild(el('p', 'q', p.coreQuestion));
    c.appendChild(el('p', 'why', `판정 보류 이유 — ${p.judgmentReason}`));
    c.appendChild(el('p', 'quote', p.judgmentSentence));

    const m = el('p', 'meta-line', `우선 지표 ${p.priorityIndicators.length}종 · 담당 영역 ${p.ownerDomains.join('·')}`);
    c.appendChild(m);
    c.appendChild(chipRow(p.priorityIndicators));
    pathBox.appendChild(c);
  }

  /* ── 조기 신호 지표 ──────────────── */
  const KIND_ORDER = ['직접값', '대체값', '간접 단서', '미확보'];
  const kindCount = {};
  for (const k of KIND_ORDER) kindCount[k] = indicators.filter((i) => i.valueKind === k).length;

  const bar = el('div', 'bar');
  for (const k of KIND_ORDER) {
    if (!kindCount[k]) continue;
    const s = el('span');
    s.dataset.k = k;
    s.style.width = `${(kindCount[k] / indicators.length) * 100}%`;
    s.title = `${k} ${kindCount[k]}건`;
    bar.appendChild(s);
  }
  const legend = el('p', 'legend');
  for (const k of KIND_ORDER) {
    const wrapper = el('span');
    wrapper.appendChild(kindBadge(k));
    wrapper.appendChild(document.createTextNode(` ${kindCount[k]}건`));
    legend.appendChild(wrapper);
  }
  $('kind-summary').append(bar, legend);

  const indicatorRows = $('indicator-rows');

  const renderIndicators = (kind) => {
    indicatorRows.replaceChildren();
    const list = kind === '전체' ? indicators : indicators.filter((i) => i.valueKind === kind);
    for (const i of list) {
      const r = el('div', 'row');
      const head = el('div', 'row-head');
      head.appendChild(el('span', 'row-id', i.indicatorId));
      head.appendChild(el('h3', 'row-title', i.title));
      head.appendChild(kindBadge(i.valueKind));
      r.appendChild(head);

      r.appendChild(field('지표 정의', i.definition, { muted: true }));

      if (i.valueKind === '미확보') {
        r.appendChild(field('현재값', null, { emptyText: '값 없음 · 이 지표에 대응하는 수치가 확보되지 않았습니다' }));
        r.appendChild(field('참고 단서 (이 지표의 값이 아님)', i.referenceClue, { extra: 'clue', muted: true }));
      } else {
        r.appendChild(field('현재값', i.currentValue));
      }

      r.appendChild(field('판단 메모', i.note, { muted: true }));

      r.appendChild(
        pairs([
          ['지표 영역', i.domain],
          ['신호 방향', i.signalDirection],
          ['시의성', i.timeliness],
          ['갱신 주기', i.updateCycle],
          ['연결 경로', i.linkedPaths.join('·')],
          ['판단 경계값', i.judgmentBoundary],
          ['기준값', i.baseline],
          ['자료 확보 계획', i.dataPlan],
        ])
      );

      if (i.sourceUrls && i.sourceUrls.length) {
        const ul = el('ul', 'srcs');
        for (const u of i.sourceUrls) {
          const li = el('li');
          const a = el('a', null, u);
          a.href = u;
          a.rel = 'noreferrer noopener';
          a.target = '_blank';
          li.appendChild(a);
          ul.appendChild(li);
        }
        r.appendChild(ul);
      }

      indicatorRows.appendChild(r);
    }
  };

  const indicatorFilters = $('indicator-filters');
  const indicatorOptions = ['전체', ...KIND_ORDER.filter((k) => kindCount[k] > 0)];
  for (const opt of indicatorOptions) {
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

  /* ── 모델 관심 벡터 ──────────────── */
  const modelBox = $('model-cards');
  for (const m of models) {
    const rows = vectors
      .filter((v) => v.modelId === m.modelId)
      .slice()
      .sort((a, b) => b.shareProvisional - a.shareProvisional);
    const sum = rows.reduce((t, v) => t + v.shareProvisional, 0);
    const max = rows.length ? rows[0].shareProvisional : 1;

    const c = el('div', 'model');
    const head = el('div', 'model-head');
    head.appendChild(el('span', 'row-id', m.modelId));
    head.appendChild(el('h3', null, m.label));
    head.appendChild(el('span', 'pair', m.sessionPair));
    c.appendChild(head);

    c.appendChild(el('p', 'struct', `원문에서 관측된 구조 — ${m.observedStructure}`));

    const bars = el('div', 'vbars');
    for (const v of rows) {
      const line = el('div', 'vbar');
      line.dataset.state = v.vectorState;
      const nameEl = el('span', 'name', v.area);
      nameEl.title = v.note;
      line.appendChild(nameEl);
      const track = el('span', 'track');
      const fill = el('span', 'fill');
      fill.style.width = `${(v.shareProvisional / max) * 100}%`;
      track.appendChild(fill);
      line.appendChild(track);
      line.appendChild(el('span', 'val', pct(v.shareProvisional)));
      bars.appendChild(line);
    }
    c.appendChild(bars);

    const states = [...new Set(rows.map((v) => v.vectorState))].join('·');
    c.appendChild(
      el(
        'p',
        'sumline',
        `${rows.length}개 영역 · 비중 합계 ${sum.toFixed(4)} · 벡터 상태 ${states} · 주장 ${m.claimCount}건 · 조건부 경로 ${m.conditionalPaths.join('·')}`
      )
    );
    modelBox.appendChild(c);
  }

  /* ── 주장 원장 ───────────────────── */
  const claimRows = $('claim-rows');
  const claimCountEl = $('claim-count');

  const renderClaims = (filter) => {
    claimRows.replaceChildren();
    const list = claims.filter((c) => {
      if (filter.type === 'all') return true;
      if (filter.type === 'model') return c.modelId === filter.value;
      if (filter.type === 'area') return c.area === filter.value;
      return true;
    });
    claimCountEl.textContent = `${list.length}건 표시 · 전체 ${claims.length}건`;

    for (const c of list) {
      const r = el('div', 'row');
      const head = el('div', 'row-head');
      head.appendChild(el('span', 'row-id', c.claimId));
      head.appendChild(el('h3', 'row-title', c.title));
      head.appendChild(el('span', 'chip', c.area));
      r.appendChild(head);

      r.appendChild(field('원문 주장', c.originalText));
      r.appendChild(field('정규화 주장 (비교용)', c.normalizedText, { muted: true, extra: 'clue' }));

      r.appendChild(
        pairs([
          ['모델', c.modelId],
          ['세부 영역', c.subArea],
          ['근거 유형', c.evidenceType],
          ['주장 유형', c.claimType],
          ['검증 상태', c.verificationState],
          ['공통성 상태', c.commonalityState],
          ['분석 상태', c.analysisState],
          ['세션 쌍', c.sessionPair],
        ])
      );

      const src = el('p', 'mono', `원자료 참조 · ${c.sourceUrl}`);
      r.appendChild(src);
      claimRows.appendChild(r);
    }
  };

  const claimFilters = $('claim-filters');
  const options = [
    { label: `전체 ${claims.length}`, filter: { type: 'all' } },
    ...models.map((m) => ({
      label: `${m.modelId} ${m.claimCount}`,
      filter: { type: 'model', value: m.modelId },
    })),
    ...meta.areaEnum.map((a) => ({
      label: `${a} ${claims.filter((c) => c.area === a).length}`,
      filter: { type: 'area', value: a },
    })),
  ];
  options.forEach((opt, idx) => {
    const b = el('button', null, opt.label);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(idx === 0));
    b.addEventListener('click', () => {
      for (const sib of claimFilters.children) sib.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-pressed', 'true');
      renderClaims(opt.filter);
    });
    claimFilters.appendChild(b);
  });
  renderClaims({ type: 'all' });

  /* ── 규칙·바닥 ───────────────────── */
  const rulesBox = $('display-rules');
  for (const rule of meta.displayRules) rulesBox.appendChild(el('li', null, rule));

  $('provenance').textContent =
    `${meta.sourceOfTruth}. 주장 원장의 원자료 참조는 내부 세션 식별자(session://…)이며 공개 인용 가능한 외부 출처가 아닙니다. ` +
    `외부 출처가 있는 지표는 해당 항목에 링크로 표시했습니다.`;

  $('footer-meta').textContent =
    `${meta.projectTitle} · 스냅샷 ${meta.snapshotVersion} (${meta.snapshotDate}) · ` +
    `${meta.contractVersion} · 정본 저장소 ${meta.canonicalRepository} · 게이트 ${S.buildInfo.gate}`;
})();
