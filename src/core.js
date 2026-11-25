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

  // SVG path d 문자열. curve=true면 Catmull-Rom → 3차 베지어. corner(0~100) = 꺾임이 큰 점은 모서리로 유지(0=끔)
  function toPath(loops, s, curve, corner) {
    const f = v => (Math.round(v * s * 10) / 10).toString();
    const lim = corner > 0 ? Math.cos((135 - corner) * Math.PI / 180) : -2; // 진행 방향 cos 이 이 값보다 작으면 모서리
    let d = '', nodes = 0;
    for (const p of loops) {
      const n = p.length; if (n < 3) continue; nodes += n;
      const sharp = new Uint8Array(n);
      if (lim > -2) for (let i = 0; i < n; i++) {
        // 계단 모서리가 두 점(45°+45°)으로 갈라지므로 3px 이상 떨어진 이웃으로 꺾임을 잰다
        const b = p[i], far = st => { let k = 1, q = p[(i + st + n) % n]; while (k < 5 && Math.hypot(q[0] - b[0], q[1] - b[1]) < 3) { k++; q = p[(i + st * k + n * 5) % n]; } return q; };
        const a = far(-1), c = far(1);
        const ux = b[0] - a[0], uy = b[1] - a[1], vx = c[0] - b[0], vy = c[1] - b[1];
        const cs = (ux * vx + uy * vy) / ((Math.hypot(ux, uy) * Math.hypot(vx, vy)) || 1);
        if (cs < lim) sharp[i] = 1;
      }
      d += `M${f(p[0][0])} ${f(p[0][1])}`;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n, p0 = p[(i - 1 + n) % n], p1 = p[i], p2 = p[j], p3 = p[(i + 2) % n];
        if (!curve) { if (i < n - 1) d += `L${f(p2[0])} ${f(p2[1])}`; continue; }
        // 접선 길이를 구간 길이의 1/3로 제한 → 모서리에서 튀는 고리 방지. 모서리 점은 접선 0
        const seg = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 3;
        const cl = (x, y) => { const l = Math.hypot(x, y); return l > seg && l > 0 ? [x * seg / l, y * seg / l] : [x, y]; };
        const [ax, ay] = sharp[i] ? [0, 0] : cl((p2[0] - p0[0]) / 6, (p2[1] - p0[1]) / 6);
        const [bx, by] = sharp[j] ? [0, 0] : cl((p3[0] - p1[0]) / 6, (p3[1] - p1[1]) / 6);
        d += `C${f(p1[0] + ax)} ${f(p1[1] + ay)} ${f(p2[0] - bx)} ${f(p2[1] - by)} ${f(p2[0])} ${f(p2[1])}`;
      }
      d += 'Z';
    }
    return { d, nodes, paths: loops.length };
  }

  function outline(bin, w, h, o) {
    const loops = trace(bin, w, h, 8).map(l => simplify(l, o.simplify)).filter(l => l.length >= 3);
    return toPath(loops, o.scale, o.curve, o.corner || 0);
  }
  // 전체: 확률 마스크(0..1, w×h) → {d, nodes, paths, bin, cut}
  // o: threshold, smooth, simplify, curve, corner, speck, hole, people, offset(작업 px), cut(작업 px, 0=없음), scale
  function vectorize(prob, w, h, o) {
    const b = blur(prob, w, h, o.smooth);
    let bin = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) bin[i] = b[i] >= o.threshold ? 1 : 0;
    cleanup(bin, w, h, o);
    bin = offset(bin, w, h, o.offset || 0);
    const r = { ...outline(bin, w, h, o), bin, cut: '' };
    if (o.cut > 0) {
      const c = offset(cleanup(Uint8Array.from(bin), w, h, { speck: 0, people: 0, hole: Infinity }), w, h, o.cut);
      r.cut = outline(c, w, h, { ...o, corner: 0 }).d;
    }
    return r;
  }

  return { blur, label, cleanup, dist, offset, trace, simplify, toPath, vectorize };
})();
if (typeof module !== 'undefined') module.exports = Core;
