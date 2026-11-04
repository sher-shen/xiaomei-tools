// node test-core.js  —— 验证拼豆/十字绣图纸核心
const C = require('./bead-core.js');
const PAL = require('./palettes.js');
const assert = require('assert');
let n = 0; const ok = (c, m) => { assert(c, m); n++; console.log('ok -', m); };

// 色卡：色号唯一、hex 合法、至少 3 套
ok(PAL.length >= 3 && PAL.some(p => p.kind === 'bead') && PAL.some(p => p.kind === 'stitch'), '含拼豆与十字绣色卡');
PAL.forEach(p => {
  assert.strictEqual(new Set(p.colors.map(c => c.code)).size, p.colors.length);
  p.colors.forEach(c => assert(/^#[0-9a-f]{6}$/.test(c.hex), p.id + ' ' + c.code));
  assert(p.colors.length >= 30, p.id + ' 至少 30 色');
});
ok(true, '每套色卡色号唯一、hex 合法、不少于 30 色');

// 符号 32 个且不重复，不含 I/O
ok(C.SYMBOLS.length === 32 && new Set(C.SYMBOLS).size === 32 && !/[IO]/.test(C.SYMBOLS), '32 个符号互不相同');

function rgbaOf(list) { const a = new Uint8ClampedArray(list.length * 4); list.forEach((p, i) => { a.set(p.length === 4 ? p : [...p, 255], i * 4); }); return a; }
const card = [
  { code: 'W', name: '白', hex: '#ffffff' }, { code: 'K', name: '黑', hex: '#000000' },
  { code: 'R', name: '红', hex: '#ff0000' }, { code: 'B', name: '蓝', hex: '#0000ff' }
];

// 1) 直接映射到最近色号
let r = C.makeChart(rgbaOf([[250, 250, 250], [10, 10, 10], [240, 20, 10], [5, 0, 230]]), 2, 2, card, { k: 4 });
ok(r.colors.length === 4 && r.indices.every(v => v >= 0), '4 色图映射出 4 个色号');
ok(r.colors[r.indices[2]].code === 'R' && r.colors[r.indices[3]].code === 'B', '红/蓝像素命中 R/B 色号');

// 2) 限制颜色数：12 白 + 3 黑 + 1 红，k=2 时应保留差异最大的
const px = []; for (let i = 0; i < 12; i++) px.push([255, 255, 255]); for (let i = 0; i < 3; i++) px.push([0, 0, 0]); px.push([255, 0, 0]);
r = C.makeChart(rgbaOf(px), 4, 4, card, { k: 2 });
ok(r.colors.length === 2, 'k=2 时只用 2 种颜色');
ok(r.colors[0].code === 'W' && r.counts[0] >= 12, '按用量排序，最多的是白');
ok(r.counts.reduce((a, b) => a + b, 0) === 16, '各色格数之和 = 总格数');

// 3) 透明格留空
r = C.makeChart(rgbaOf([[0, 0, 0, 0], [0, 0, 0, 255], [255, 255, 255, 255], [0, 0, 0, 10]]), 2, 2, card, { k: 4, transparent: true });
ok(r.indices[0] === -1 && r.indices[3] === -1 && r.empty === 2, '透明像素为空格，不计入用量');
ok(r.counts.reduce((a, b) => a + b, 0) === 2, '空格不计数');
r = C.makeChart(rgbaOf([[0, 0, 0, 0], [0, 0, 0, 255]]), 2, 1, card, { k: 4, transparent: false });
ok(r.empty === 0 && r.colors[r.indices[0]].code === 'W', '不留空时透明按白底合成');

// 4) 确定性
const big = new Uint8ClampedArray(60 * 60 * 4);
for (let i = 0; i < 3600; i++) big.set([(i * 37) % 256, (i * 91) % 256, (i * 53) % 256, 255], i * 4);
const dmc = PAL.find(p => p.id === 'dmc').colors;
const t0 = Date.now();
const a1 = C.makeChart(big, 60, 60, dmc, { k: 32, dither: true, clean: true });
const dt = Date.now() - t0;
const a2 = C.makeChart(big, 60, 60, dmc, { k: 32, dither: true, clean: true });
ok(a1.colors.length <= 32 && a1.colors.length >= 20, '噪声图 DMC 32 色：得到 ' + a1.colors.length + ' 色');
ok(JSON.stringify(Array.from(a1.indices)) === JSON.stringify(Array.from(a2.indices)), '结果可复现');
ok(dt < 3000, '60×60 噪声图 32 色在 3 秒内（' + dt + 'ms）');

// 5) 清理孤立格（-1 不参与）
const g = Int32Array.from([0, 0, 0, 0, 1, 0, 0, 0, 0]);
ok(C.cleanIsolated(g, 3, 3)[4] === 0, '孤立格并入邻色');
ok(C.cleanIsolated(Int32Array.from([-1, -1, -1, -1, 1, -1, -1, -1, -1]), 3, 3)[4] === 1, '周围全空的格不动');

// 6) 尺寸与估算
let cs = C.chartSize(100, 200, 1000, 150);
ok(cs.w === 30 && cs.h === 150 && cs.adjusted, '过高的图按 150 行上限缩小列数');
cs = C.chartSize(40, 400, 300, 150); ok(cs.w === 40 && cs.h === 30 && !cs.adjusted, '正常比例 40×30');
let e = C.estimate('bead', 58, 30, [100, 10]);
ok(e.boards === 4 && e.sizeCm[0] === 29 && e.perColor[0] === 105 && e.perColor[1] === 13, '拼豆：4 块板、29cm、备量 +5%（至少 +3）');
e = C.estimate('stitch', 140, 70, [3000, 10]);
ok(Math.abs(e.sizeCm[0] - 25.4) < 1e-9 && e.perColor[0] === 2 && e.perColor[1] === 1, '十字绣：14ct 140 格 = 25.4cm，线量粗估');
console.log('\n全部通过 (' + n + ' 项)');
