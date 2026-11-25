// 엔진 단위 테스트: node tests/test_core.js
const C = require('../src/core.js'), fs = require('fs'), assert = require('assert');
const w = 200, h = 200, p = new Float32Array(w * h);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const r = Math.hypot(x - 100, y - 100);
  if (r < 70 && r >= 25) p[y * w + x] = 1;                    // 도넛
  if (r < 5) p[y * w + x] = 1;                                // 구멍 안 작은 섬
  if (x >= 185 && y >= 185 && x < 195 && y < 195) p[y * w + x] = 1; // 작은 덩어리
}
const base = { threshold: .5, smooth: 1, simplify: 1, curve: true, corner: 0, speck: 0, hole: 0, people: 0, offset: 0, cut: 0, scale: 1 };
const run = o => C.vectorize(p, w, h, { ...base, ...o });
const area = r => r.bin.reduce((a, b) => a + b, 0);
let r = run({}); assert.strictEqual(r.paths, 4, '도넛 2 + 섬 + 덩어리');
r = run({ speck: 0.02 }); assert.strictEqual(r.paths, 2, '작은 조각 제거');
r = run({ people: 1 }); assert.strictEqual(r.paths, 2, '가장 큰 1개');
r = run({ speck: 0.02, hole: Infinity }); assert.strictEqual(r.paths, 1, '구멍 전부 메움');
const a0 = area(run({ people: 1 })), a1 = area(run({ people: 1, offset: 5 })), a2 = area(run({ people: 1, offset: -5 }));
assert(a1 > a0 && a2 < a0, '확장·축소');
r = run({ people: 1, cut: 8 }); assert(r.cut.startsWith('M') && (r.cut.match(/M/g) || []).length === 1, '칼선 = 바깥 1개');
const sq = new Float32Array(w * h); for (let y = 50; y < 150; y++) for (let x = 50; x < 150; x++) sq[y * w + x] = 1;
const soft = C.vectorize(sq, w, h, { ...base, simplify: 2 }), hard = C.vectorize(sq, w, h, { ...base, simplify: 2, corner: 50 });
assert(hard.d !== soft.d, '모서리 보존 적용');
// 성능
const W = 2048, H = 1536, q = new Float32Array(W * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) q[y * W + x] = Math.hypot((x - 1024) / 700, (y - 800) / 600) < 1 + 0.05 * Math.sin(x / 7) ? 1 : 0;
let t = Date.now(); C.vectorize(q, W, H, { ...base, smooth: 3, speck: .02, hole: .003, offset: 10, cut: 20 });
console.log('ok · 2048x1536 확장+칼선', Date.now() - t, 'ms');
fs.writeFileSync(__dirname + '/out_core.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><path d="${hard.d}"/><path fill="none" stroke="red" d="${r.cut}"/><path fill-rule="evenodd" fill="#555" d="${r.d}"/></svg>`);
