// 곡선 정확도 비교: 실제 마스크(.real_mask.bin, 1237x1575 그레이)에서 점 수와 윤곽 오차. OLD_CORE=이전 core.js 경로 주면 같이 비교
const New = require('../src/core.js'), Old = (() => { try { return require(process.env.OLD_CORE || '/tmp/core_old.js'); } catch (e) { return null; } })(), fs = require('fs');
const [H, W] = [1575, 1237], raw = fs.readFileSync(__dirname + '/.real_mask.bin'), prob = Float32Array.from(raw, v => v / 255);
// 기준 윤곽(촘촘한 점) = 경계 0.5 이진 마스크의 픽셀 경계
const base = { threshold: .5, smooth: 0, curve: true, corner: 0, speck: .2, hole: 0, people: 0, offset: 0, cut: 0, scale: 1 };
const bin = new Uint8Array(W * H); for (let i = 0; i < bin.length; i++) bin[i] = prob[i] >= .5 ? 1 : 0;
New.cleanup(bin, W, H, base);
const ref = New.trace(bin, W, H, 8).flat();
// 경로 d → 촘촘한 표본점
function sample(d) {
  const t = d.match(/[MLCZ]|-?[\d.]+/g); let i = 0, cur = [0, 0], st = [0, 0], cmd = '', out = [];
  while (i < t.length) { if (/[MLCZ]/.test(t[i])) cmd = t[i++];
    if (cmd === 'M') { cur = st = [+t[i++], +t[i++]]; }
    else if (cmd === 'L') { const p = [+t[i++], +t[i++]]; for (let k = 0; k <= 20; k++) out.push([cur[0] + (p[0] - cur[0]) * k / 20, cur[1] + (p[1] - cur[1]) * k / 20]); cur = p; }
    else if (cmd === 'C') { const b = [cur, [+t[i++], +t[i++]], [+t[i++], +t[i++]], [+t[i++], +t[i++]]]; for (let k = 0; k <= 20; k++) out.push(New.bez(b, k / 20)); cur = b[3]; }
    else if (cmd === 'Z') { cur = st; } }
  return out;
}
// 격자 해시로 최근접 거리
const G = 8, grid = new Map(); ref.forEach(p => { const k = (p[0] / G | 0) + ',' + (p[1] / G | 0); (grid.get(k) || grid.set(k, []).get(k)).push(p); });
function nd(q) { const gx = q[0] / G | 0, gy = q[1] / G | 0; let m = 1e9; for (let r = 0; r < 6 && (m > (r - 1) * G || r < 2); r++) for (let x = gx - r; x <= gx + r; x++) for (let y = gy - r; y <= gy + r; y++) { if (Math.max(Math.abs(x - gx), Math.abs(y - gy)) !== r) continue; for (const p of grid.get(x + ',' + y) || []) m = Math.min(m, Math.hypot(p[0] - q[0], p[1] - q[1])); } return m; }
function stat(label, r) { const s = sample(r.d).map(nd); s.sort((a, b) => a - b);
  console.log(label.padEnd(22), 'nodes', String(r.nodes).padStart(5), ' 평균오차', (s.reduce((a, b) => a + b) / s.length).toFixed(2), ' 95%', s[s.length * .95 | 0].toFixed(2), ' 최대', s[s.length - 1].toFixed(2), 'px'); }
if (Old) for (const sm of [6, 2]) stat('이전 단순화 ' + sm, Old.vectorize(prob, W, H, { ...base, simplify: sm }));
for (const tol of [0.5, 1, 2, 4]) stat('새 허용오차 ' + tol, New.vectorize(prob, W, H, { ...base, simplify: tol }));
stat('새 목표 100점', New.vectorize(prob, W, H, { ...base, simplify: .5, target: 100 }));
let t = Date.now(); New.vectorize(prob, W, H, { ...base, simplify: 1 }); console.log('시간', Date.now() - t, 'ms');
const r = New.vectorize(prob, W, H, { ...base, simplify: 1 });
fs.writeFileSync(__dirname + '/.cmp.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#000"/><path fill="#fff" fill-rule="evenodd" d="${New.vectorize(prob, W, H, { ...base, simplify: 0.3, curve: false }).d}"/><path fill="none" stroke="#2aa8ff" stroke-width="3" d="${r.d}"/></svg>`);
