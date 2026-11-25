// 마스크 → 벡터 외곽선 엔진 (브라우저·node 공용)
const Core = (() => {
  // 분리형 박스 블러 2회 (가우시안 근사)
  function blur(src, w, h, r) {
    if (r < 1) return src;
    let a = Float32Array.from(src), b = new Float32Array(w * h);
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < h; y++) {
        const o = y * w; let s = 0;
        for (let x = -r; x <= r; x++) s += a[o + Math.min(w - 1, Math.max(0, x))];
        for (let x = 0; x < w; x++) {
          b[o + x] = s / (2 * r + 1);
          s += a[o + Math.min(w - 1, x + r + 1)] - a[o + Math.max(0, x - r)];
        }
      }
      for (let x = 0; x < w; x++) {
        let s = 0;
        for (let y = -r; y <= r; y++) s += b[Math.min(h - 1, Math.max(0, y)) * w + x];
        for (let y = 0; y < h; y++) {
          a[y * w + x] = s / (2 * r + 1);
          s += b[Math.min(h - 1, y + r + 1) * w + x] - b[Math.max(0, y - r) * w + x];
        }
      }
    }
    return a;
  }

  // 4-연결 성분 라벨링. 반환: {lab, areas, touch}
  function label(bin, w, h, val) {
    const lab = new Int32Array(w * h).fill(-1), areas = [], touch = [];
    const st = new Int32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      if (bin[i] !== val || lab[i] >= 0) continue;
      const id = areas.length; let n = 0, sp = 0, t = false;
      st[sp++] = i; lab[i] = id;
      while (sp) {
        const p = st[--sp]; n++;
        const x = p % w, y = (p - x) / w;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) t = true;
        if (x > 0 && bin[p - 1] === val && lab[p - 1] < 0) { lab[p - 1] = id; st[sp++] = p - 1; }
        if (x < w - 1 && bin[p + 1] === val && lab[p + 1] < 0) { lab[p + 1] = id; st[sp++] = p + 1; }
        if (y > 0 && bin[p - w] === val && lab[p - w] < 0) { lab[p - w] = id; st[sp++] = p - w; }
        if (y < h - 1 && bin[p + w] === val && lab[p + w] < 0) { lab[p + w] = id; st[sp++] = p + w; }
      }
      areas.push(n); touch.push(t);
    }
    return { lab, areas, touch };
  }

  // 조각 제거·구멍 메우기. o.speck = 가장 큰 덩어리 대비 비율, o.people = 큰 순서로 n개(0=전부), o.hole = 전경 대비 비율(Infinity=전부)
  function cleanup(bin, w, h, o) {
    const f = label(bin, w, h, 1);
    if (!f.areas.length) return bin;
    const max = Math.max(...f.areas), order = f.areas.map((a, i) => i).sort((a, b) => f.areas[b] - f.areas[a]);
    const keep = new Uint8Array(f.areas.length);
    order.forEach((id, r) => { if (f.areas[id] >= max * (o.speck || 0) && (!o.people || r < o.people)) keep[id] = 1; });
    let fg = 0;
    for (let i = 0; i < w * h; i++) { if (bin[i] && !keep[f.lab[i]]) bin[i] = 0; fg += bin[i]; }
    if (o.hole > 0) {
      const g = label(bin, w, h, 0);
      const fill = g.areas.map((a, i) => !g.touch[i] && a < fg * o.hole);
      for (let i = 0; i < w * h; i++) if (!bin[i] && fill[g.lab[i]]) bin[i] = 1;
    }
    return bin;
  }

  // 거리 변환(체임퍼 2패스): val 픽셀까지의 거리
  function dist(bin, w, h, val) {
    const D = new Float32Array(w * h), INF = 1e9, S = Math.SQRT2;
    for (let i = 0; i < w * h; i++) D[i] = bin[i] === val ? 0 : INF;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; let d = D[i]; if (!d) continue;
      if (x > 0) d = Math.min(d, D[i - 1] + 1);
      if (y > 0) { d = Math.min(d, D[i - w] + 1); if (x > 0) d = Math.min(d, D[i - w - 1] + S); if (x < w - 1) d = Math.min(d, D[i - w + 1] + S); }
      D[i] = d;
    }
    for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x; let d = D[i]; if (!d) continue;
      if (x < w - 1) d = Math.min(d, D[i + 1] + 1);
      if (y < h - 1) { d = Math.min(d, D[i + w] + 1); if (x < w - 1) d = Math.min(d, D[i + w + 1] + S); if (x > 0) d = Math.min(d, D[i + w - 1] + S); }
      D[i] = d;
    }
    return D;
  }
  // 외곽 확장(+r)·축소(−r), 픽셀
  function offset(bin, w, h, r) {
    if (!r) return bin;
    const out = new Uint8Array(w * h);
    if (r > 0) { const D = dist(bin, w, h, 1); for (let i = 0; i < w * h; i++) out[i] = D[i] <= r ? 1 : 0; }
    else { const D = dist(bin, w, h, 0); for (let i = 0; i < w * h; i++) out[i] = bin[i] && D[i] > -r ? 1 : 0; }
    return out;
  }

  // 픽셀 경계 추적. 바깥=시계방향, 구멍=반시계 → evenodd로 구멍 처리
  function trace(bin, w, h, minLen) {
    const W = w + 1, bits = new Uint8Array(W * (h + 1));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!bin[y * w + x]) continue;
      if (y === 0 || !bin[(y - 1) * w + x]) bits[y * W + x] |= 1;
      if (x === w - 1 || !bin[y * w + x + 1]) bits[y * W + x + 1] |= 2;
      if (y === h - 1 || !bin[(y + 1) * w + x]) bits[(y + 1) * W + x + 1] |= 4;
      if (x === 0 || !bin[y * w + x - 1]) bits[(y + 1) * W + x] |= 8;
    }
    const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1], loops = [];
    for (let v = 0; v < bits.length; v++) {
      while (bits[v]) {
        let d = 0; while (!(bits[v] & (1 << d))) d++;
        let cur = v; const pts = [];
        for (;;) {
          bits[cur] &= ~(1 << d);
          const x = cur % W, y = (cur - x) / W;
          pts.push([x + DX[d] / 2, y + DY[d] / 2]);
          cur = (y + DY[d]) * W + x + DX[d];
          if (cur === v) break;
          const c = [(d + 1) & 3, d, (d + 3) & 3].find(c => bits[cur] & (1 << c));
          if (c === undefined) break;
          d = c;
        }
        if (pts.length >= minLen) loops.push(pts);
      }
    }
    return loops;
  }

  // 닫힌 다각형 RDP 단순화 (반복형)
  function simplify(pts, eps) {
    const n = pts.length;
    if (n < 8 || eps <= 0) return pts;
    let far = 0, fd = -1;
    for (let i = 1; i < n; i++) { const d = (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2; if (d > fd) { fd = d; far = i; } }
    const keep = new Uint8Array(n + 1); keep[0] = keep[far] = keep[n] = 1;
    const P = i => pts[i % n], st = [[0, far], [far, n]], e2 = eps * eps;
    while (st.length) {
      const [a, b] = st.pop(); if (b - a < 2) continue;
      const [ax, ay] = P(a), [bx, by] = P(b), dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1e-9;
      let mi = -1, md = -1;
      for (let i = a + 1; i < b; i++) {
        const [px, py] = P(i), c = dx * (py - ay) - dy * (px - ax), d = c * c / L;
        if (d > md) { md = d; mi = i; }
      }
      if (md > e2) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
    }
    const out = []; for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i]);
    return out;
  }

  // ---------- 곡선 맞춤 (Schneider, Graphics Gems 1990): 원래 윤곽에서 허용 오차(px) 안에 들 때까지 베지어를 쪼개며 맞춤 ----------
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]], add = (a, b) => [a[0] + b[0], a[1] + b[1]], mul = (a, k) => [a[0] * k, a[1] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1], len = a => Math.hypot(a[0], a[1]);
  const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
  function bez(b, t) { const m = 1 - t; return [m * m * m * b[0][0] + 3 * m * m * t * b[1][0] + 3 * m * t * t * b[2][0] + t * t * t * b[3][0], m * m * m * b[0][1] + 3 * m * m * t * b[1][1] + 3 * m * t * t * b[2][1] + t * t * t * b[3][1]]; }
  function bezD1(b, t) { const m = 1 - t; return [3 * (m * m * (b[1][0] - b[0][0]) + 2 * m * t * (b[2][0] - b[1][0]) + t * t * (b[3][0] - b[2][0])), 3 * (m * m * (b[1][1] - b[0][1]) + 2 * m * t * (b[2][1] - b[1][1]) + t * t * (b[3][1] - b[2][1]))]; }
  function bezD2(b, t) { const m = 1 - t; return [6 * (m * (b[2][0] - 2 * b[1][0] + b[0][0]) + t * (b[3][0] - 2 * b[2][0] + b[1][0])), 6 * (m * (b[2][1] - 2 * b[1][1] + b[0][1]) + t * (b[3][1] - 2 * b[2][1] + b[1][1]))]; }
  function chordU(P) { const u = [0]; for (let i = 1; i < P.length; i++) u.push(u[i - 1] + len(sub(P[i], P[i - 1]))); const L = u[u.length - 1] || 1; return u.map(x => x / L); }
  function genBez(P, u, t1, t2) {
    const p0 = P[0], p3 = P[P.length - 1]; let c00 = 0, c01 = 0, c11 = 0, x0 = 0, x1 = 0;
    for (let i = 0; i < P.length; i++) {
      const t = u[i], m = 1 - t, a1 = mul(t1, 3 * m * m * t), a2 = mul(t2, 3 * m * t * t);
      c00 += dot(a1, a1); c01 += dot(a1, a2); c11 += dot(a2, a2);
      const tmp = sub(P[i], add(mul(p0, m * m * m + 3 * m * m * t), mul(p3, 3 * m * t * t + t * t * t)));
      x0 += dot(a1, tmp); x1 += dot(a2, tmp);
    }
    const det = c00 * c11 - c01 * c01, seg = len(sub(p3, p0)), eps = 1e-6 * seg;
    let al = det ? (x0 * c11 - x1 * c01) / det : 0, ar = det ? (c00 * x1 - c01 * x0) / det : 0;
    if (!(al > eps) || !(ar > eps) || al > seg * 2 || ar > seg * 2) al = ar = seg / 3;   // 실패·과도 = 1/3 규칙
    return [p0, add(p0, mul(t1, al)), add(p3, mul(t2, ar)), p3];
  }
  // 점별 허용 오차 E[i](제곱) 대비 비율의 최대값과 위치
  function maxErr(P, E, b, u) {
    let mx = 0, at = P.length >> 1;
    for (let i = 1; i < P.length - 1; i++) { const d = sub(bez(b, u[i]), P[i]), e = dot(d, d) / E[i]; if (e >= mx) { mx = e; at = i; } }
    return [mx, at];
  }
  function reparam(P, b, u) {
    return u.map((t, i) => { const d = sub(bez(b, t), P[i]), d1 = bezD1(b, t), d2 = bezD2(b, t), den = dot(d1, d1) + dot(d, d2);
      const n = den ? t - dot(d, d1) / den : t; return Math.min(1, Math.max(0, n)); });
  }
  // P[i0..i1] 하나의 베지어로 (끝 접선 고정). 반환 {b, er(비율)}
  function fitOnce(P, E, i0, i1, t1, t2) {
    const Q = P.slice(i0, i1 + 1), EQ = E.slice(i0, i1 + 1);
    if (Q.length === 2) { const d = len(sub(Q[1], Q[0])) / 3; return { b: [Q[0], add(Q[0], mul(t1, d)), add(Q[1], mul(t2, d)), Q[1]], er: 0, sp: 0 }; }
    let u = chordU(Q), b = genBez(Q, u, t1, t2), [er, sp] = maxErr(Q, EQ, b, u);
    if (er >= 1 && er < 9) for (let k = 0; k < 6; k++) { u = reparam(Q, b, u); b = genBez(Q, u, t1, t2); [er, sp] = maxErr(Q, EQ, b, u); if (er < 1) break; }
    return { b, er, sp };
  }
  function fitCubic(P, E, i0, i1, t1, t2, out, depth) {
    const r = fitOnce(P, E, i0, i1, t1, t2);
    if (r.er < 1 || i1 - i0 < 2 || depth > 40) { out.push({ b: r.b, i0, i1 }); return; }
    const s = i0 + Math.max(1, Math.min(i1 - i0 - 1, r.sp)), tc = norm(sub(P[s - 1], P[s + 1]));
    fitCubic(P, E, i0, s, t1, tc, out, depth + 1);
    fitCubic(P, E, s, i1, mul(tc, -1), t2, out, depth + 1);
  }
  const tanOut = b => len(sub(b[1], b[0])) > 1e-6 ? norm(sub(b[1], b[0])) : norm(sub(b[3], b[0]));
  const tanIn = b => len(sub(b[2], b[3])) > 1e-6 ? norm(sub(b[2], b[3])) : norm(sub(b[0], b[3]));
  // 점 합치기: 이웃 두 구간을 하나로 맞춰 허용 오차×fac 안이면 합침 (끝 접선 유지 → 매끄러움 유지)
  function mergeSegs(P, E, segs, fac2) {
    let k = 0;
    while (k < segs.length - 1) {
      const a = segs[k], c = segs[k + 1], r = fitOnce(P, E, a.i0, c.i1, tanOut(a.b), tanIn(c.b));
      if (r.er <= fac2) segs.splice(k, 2, { b: r.b, i0: a.i0, i1: c.i1 }); else k++;
    }
    return segs;
  }
  // 열린 꺾은선 RDP
  function rdpOpen(P, eps) {
    if (P.length < 3) return P;
    const keep = new Uint8Array(P.length); keep[0] = keep[P.length - 1] = 1; const st = [[0, P.length - 1]];
    while (st.length) { const [a, b] = st.pop(); if (b - a < 2) continue;
      const A = P[a], d = sub(P[b], A), L = len(d) || 1e-9; let mi = -1, md = -1;
      for (let i = a + 1; i < b; i++) { const q = sub(P[i], A), x = Math.abs(d[0] * q[1] - d[1] * q[0]) / L; if (x > md) { md = x; mi = i; } }
      if (md > eps) { keep[mi] = 1; st.push([a, mi], [mi, b]); } }
    return P.filter((_, i) => keep[i]);
  }

  // 윤곽 준비: 사진 가장자리 점 표시 · 모서리 찾기 · 계단 완화
  function prepLoop(p, W, H, corner) {
    const n = p.length, edge = new Uint8Array(n), mark = new Uint8Array(n);
    for (let i = 0; i < n; i++) { const [x, y] = p[i]; if (x <= 1 || y <= 1 || x >= W - 1 || y >= H - 1) edge[i] = 1; }
    if (corner > 0) {   // 3px 이상 떨어진 앞뒤 점으로 꺾임 측정, 이웃 안에서 가장 꺾인 점 하나만
      const lim = Math.cos((130 - corner * 1.2) * Math.PI / 180), cs = new Float32Array(n).fill(2);
      const far = (i, st) => { let k = 1, q = p[(i + st + n) % n]; while (k < 14 && len(sub(q, p[i])) < 5) { k++; q = p[((i + st * k) % n + n) % n]; } return q; };
      for (let i = 0; i < n; i++) { if (edge[i]) continue; const u = norm(sub(p[i], far(i, -1))), v = norm(sub(far(i, 1), p[i])), c = dot(u, v); if (c < lim) cs[i] = c; }
      for (let i = 0; i < n; i++) { if (cs[i] > 1) continue; let best = true; for (let k = -4; k <= 4 && best; k++) if (k && cs[(i + k + n) % n] < cs[i]) best = false; if (best) mark[i] = 1; }
    }
    for (let i = 0; i < n; i++) if (edge[i] && (!edge[(i - 1 + n) % n] || !edge[(i + 1) % n])) mark[i] = 1;   // 가장자리 구간의 양 끝
    let q = p;   // [1,2,1] 완화 2회 (모서리·가장자리 점은 고정)
    for (let pass = 0; pass < 2; pass++) q = q.map((a, i) => (mark[i] || edge[i]) ? a : [(q[(i - 1 + n) % n][0] + 2 * a[0] + q[(i + 1) % n][0]) / 4, (q[(i - 1 + n) % n][1] + 2 * a[1] + q[(i + 1) % n][1]) / 4]);
    return { p: q, edge, mark };
  }
  // 윤곽 하나 → 구간들 [{l:[끝점]} | {c:[c1,c2,끝점]}], 시작점
  // L.tol[i] = 점별 허용 오차(px), L.ten[i] = 점별 장력(−0.3~+0.3), m = 오차 배율(목표 점 수용), fac2 = 합치기 허용(0 = 끔)
  function fitLoop(L, m, curve, fac2) {
    const { p, edge, mark } = L, n = p.length, segs = [];
    const E = L.tol.map(t => Math.max(1e-4, (t * m) ** 2));
    let br = []; for (let i = 0; i < n; i++) if (mark[i]) br.push(i);
    if (!curve) {   // 직선 모드: 꺾은선 단순화(전체 오차)
      const r = simplify(p, L.tol0 * m); for (let i = 1; i < r.length; i++) segs.push({ l: r[i] });
      segs.push({ l: r[0] });
      return { start: r[0], segs };
    }
    const emit = (P, EP, T, t1, t2) => {   // P 구간 맞춤 → 합치기 → 장력 → segs
      const out = []; fitCubic(P, EP, 0, P.length - 1, t1, t2, out, 0);
      if (fac2 > 0) mergeSegs(P, EP, out, fac2);
      for (const s of out) {
        const k = 1 + T[(s.i0 + s.i1) >> 1], b = s.b;
        segs.push({ c: [add(b[0], mul(sub(b[1], b[0]), k)), add(b[3], mul(sub(b[2], b[3]), k)), b[3]] });
      }
    };
    if (!br.length) {   // 모서리 없는 닫힌 곡선
      const ring = p.concat([p[0]]), k3 = Math.min(3, n - 1), t = norm(sub(p[k3], p[n - k3]));
      emit(ring, E.concat([E[0]]), L.ten.concat([L.ten[0]]), t, mul(t, -1));
      return { start: p[0], segs };
    }
    for (let k = 0; k < br.length; k++) {
      const a = br[k], b = br[(k + 1) % br.length], idx = [];
      for (let i = a; ; i = (i + 1) % n) { idx.push(i); if (i === b && idx.length > 1) break; if (idx.length > n + 1) break; }
      if (idx.length < 2) continue;
      const piece = idx.map(i => p[i]);
      if (idx.every(i => edge[i]) || piece.length < 4) { rdpOpen(piece, .5).slice(1).forEach(q => segs.push({ l: q })); continue; }
      const k3 = Math.min(3, piece.length - 1);
      emit(piece, idx.map(i => E[i]), idx.map(i => L.ten[i]), norm(sub(piece[k3], piece[0])), norm(sub(piece[piece.length - 1 - k3], piece[piece.length - 1])));
    }
    return { start: p[br[0]], segs };
  }
  // 점별 허용 오차·장력: 브러시로 찍은 값(o.zg) + 곡률 배분(o.alloc 0~1)
  function loopParams(L, w, h, o) {
    const { p } = L, n = p.length, tol = new Float32Array(n), ten = new Float32Array(n), zg = o.zg;
    for (let i = 0; i < n; i++) {   // 브러시로 찍은 값(tol>0)이 있으면 그 값, 없으면 전체 값
      let k = -1;
      if (zg) { const gx = Math.min(zg.gw - 1, Math.max(0, Math.floor(p[i][0] * zg.gw / w))), gy = Math.min(zg.gh - 1, Math.max(0, Math.floor(p[i][1] * zg.gh / h))); k = gy * zg.gw + gx; }
      if (k >= 0 && zg.tol[k] > 0) { tol[i] = zg.tol[k]; ten[i] = zg.ten[k]; } else { tol[i] = o.simplify; ten[i] = o.tension || 0; }
    }
    if (o.alloc > 0 && n > 20) {   // 곡률 큰 곳 = 오차 작게(점 촘촘), 완만한 곳 = 오차 크게
      const far = (i, st) => { let k = 1, q = p[(i + st + n) % n]; while (k < 14 && len(sub(q, p[i])) < 5) { k++; q = p[((i + st * k) % n + n) % n]; } return q; };
      const cv = new Float32Array(n); for (let i = 0; i < n; i++) cv[i] = 1 - dot(norm(sub(p[i], far(i, -1))), norm(sub(far(i, 1), p[i])));
      const med = Float32Array.from(cv).sort()[n >> 1] + 2e-3;
      let f = Array.from(cv, c => Math.min(3, Math.max(0.6, ((med) / (c + 2e-3)) ** (0.6 * o.alloc))));
      for (let pass = 0; pass < 3; pass++) f = f.map((v, i) => (f[(i - 2 + n) % n] + f[(i - 1 + n) % n] + v + f[(i + 1) % n] + f[(i + 2) % n]) / 5);
      for (let i = 0; i < n; i++) tol[i] *= f[i];
    }
    return { ...L, tol: Array.from(tol), ten: Array.from(ten), tol0: o.simplify };
  }
  // 맞춘 윤곽들 → SVG d · 점 수 · 앵커 좌표(원본 픽셀)
  function toPath(fits, s) {
    const f = v => (Math.round(v * s * 10) / 10).toString(); let d = '', nodes = 0; const anchors = [];
    for (const F of fits) {
      if (!F.segs.length) continue;
      d += `M${f(F.start[0])} ${f(F.start[1])}`;
      F.segs.forEach((g, i) => {
        if (g.l) d += `L${f(g.l[0])} ${f(g.l[1])}`; else d += `C${f(g.c[0][0])} ${f(g.c[0][1])} ${f(g.c[1][0])} ${f(g.c[1][1])} ${f(g.c[2][0])} ${f(g.c[2][1])}`;
        const e = g.l || g.c[2]; anchors.push(e[0] * s, e[1] * s);
      });
      d += 'Z'; nodes += F.segs.length;
    }
    return { d, nodes, paths: fits.length, anchors };
  }
  // bin → 벡터. o.target(>0) = 점 수가 이 값 이하가 되는 가장 작은 오차 배율을 찾음
  function outline(bin, w, h, o) {
    const pre = trace(bin, w, h, Math.max(8, Math.round(4 * o.simplify + 8))).map(l => prepLoop(l, w, h, o.corner || 0));   // 오차보다 작은 점 같은 고리는 버림
    const loops = pre.map(L => loopParams(L, w, h, o));
    const fac2 = o.merge > 0 ? (1 + o.merge) ** 2 : 0;
    const run = (m, LS = loops) => toPath(LS.map(L => fitLoop(L, m, o.curve, fac2)), o.scale);
    let m = 1, r = run(1);
    if (o.alloc > 0 && o.curve && !(o.target > 0)) {   // 곡률 배분 = 점 수는 그대로 두고 배치만 바꿈 → 배분 없을 때 점 수에 맞춤
      const goal = run(1, pre.map(L => loopParams(L, w, h, { ...o, alloc: 0 }))).nodes;
      let lo = .5, hi = 4;
      for (let k = 0; k < 7; k++) { const mid = Math.sqrt(lo * hi), x = run(mid); if (x.nodes <= goal) { hi = mid; r = x; m = mid; } else lo = mid; }
      if (r.nodes > goal) { m = hi; r = run(hi); }
    }
    if (o.target > 0 && r.nodes > o.target) {
      let lo = 1, hi = 64, best = null;
      for (let k = 0; k < 12; k++) { const x = run((lo + hi) / 2); if (x.nodes <= o.target) { best = x; hi = (lo + hi) / 2; } else lo = (lo + hi) / 2; }
      m = hi; r = best || run(hi);
    }
    return { ...r, tol: o.simplify * m, mult: m };
  }
  // 전체: 확률 마스크(0..1, w×h) → {d, nodes, paths, anchors, tol, bin, cut}
  // o: threshold, smooth, simplify(허용 오차 px), curve, corner, target, merge(0~1, 0=끔), alloc(0~1), tension(−0.3~0.3),
  //    zg({gw,gh,tol,ten} 브러시로 찍은 값 격자, tol 0 = 없음), speck, hole, people, offset, cut, scale
  function vectorize(prob, w, h, o) {
    const b = blur(prob, w, h, o.smooth);
    let bin = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) bin[i] = b[i] >= o.threshold ? 1 : 0;
    cleanup(bin, w, h, o);
    bin = offset(bin, w, h, o.offset || 0);
    const r = { ...outline(bin, w, h, o), bin, cut: '' };
    if (o.cut > 0) {
      const c = offset(cleanup(Uint8Array.from(bin), w, h, { speck: 0, people: 0, hole: Infinity }), w, h, o.cut);
      r.cut = outline(c, w, h, { ...o, corner: 0, target: 0, alloc: 0, zg: null, tension: 0, simplify: Math.max(o.simplify, 1) }).d;
    }
    return r;
  }

  return { blur, label, cleanup, dist, offset, trace, simplify, outline, vectorize, bez };
})();
if (typeof module !== 'undefined') module.exports = Core;
