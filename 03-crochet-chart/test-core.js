// node test-core.js  —— 验证 k-means 与逐行读针
const C = require('./chart-core.js');
const assert = require('assert');
let n = 0; const ok = (c, m) => { assert(c, m); n++; console.log('ok -', m); };

// 4x4：左上 0 右上 1 左下 2 右下 3
const idx = [0,0,1,1, 0,0,1,1, 2,2,3,3, 2,2,3,3];
const S = i => 'ABCD'[i];

// 1) 逐行读针（tapestry）：第1行=最下行，奇数行 ←
const rows = C.tapestryRows(idx, 4, 4);
const lines = rows.map(r => C.formatTapestryLine(r, S));
assert.deepStrictEqual(lines, [
  '第 1 行（←）：D×2，C×2',
  '第 2 行（→）：C×2，D×2',
  '第 3 行（←）：B×2，A×2',
  '第 4 行（→）：A×2，B×2'
]); ok(true, 'tapestry 4x4 四行读针正确');

// 2) C2C 对角线
const d = C.c2cDiagonals(idx, 4, 4);
assert.deepStrictEqual(d.map(x => x.len), [1,2,3,4,3,2,1]); ok(true, 'C2C 对角线长度 1,2,3,4,3,2,1');
assert.deepStrictEqual(d.map(x => x.phase), ['inc','inc','inc','inc','dec','dec','dec']); ok(true, '增针/减针分段正确');
assert.strictEqual(d[4].switchTo, 'dec'); assert.strictEqual(d[0].switchTo, null); ok(true, '切换点在第5条');
const dl = d.map(x => C.formatC2CLine(x, S));
assert.strictEqual(dl[0], '第 1 条对角线（增针段 ↗，1 格）：D×1');
assert.strictEqual(dl[1], '第 2 条对角线（增针段 ↙，2 格）：D×2');
// 第3条(k=2,↗): u从大到小: u=2,v=0 -> x=1,y=3 -> C ; u=1,v=1 -> x=2,y=2 -> D ; u=0,v=2 -> x=3,y=1 -> B
assert.strictEqual(dl[2], '第 3 条对角线（增针段 ↗，3 格）：C×1，D×1，B×1');
assert.strictEqual(dl[4], '【转为减针段】第 5 条对角线（减针段 ↗，3 格）：' + dl[4].split('：')[1]);
ok(true, 'C2C 文本格式与单元顺序正确');
// 长方形 3x5 出现平段
const d2 = C.c2cDiagonals(new Array(15).fill(0), 3, 5);
assert.deepStrictEqual(d2.map(x => x.len), [1,2,3,3,3,2,1]);
assert.deepStrictEqual(d2.map(x => x.phase), ['inc','inc','inc','flat','flat','dec','dec']); ok(true, '长方形含平段');
// 所有格恰好被覆盖一次
const tot = d2.reduce((a, x) => a + x.runs.reduce((b, r) => b + r.n, 0), 0); assert.strictEqual(tot, 15); ok(true, '对角线覆盖全部格');

// 3) k-means
const px = [];
for (let i = 0; i < 8; i++) px.push([250 - i, i, i]);        // 红
for (let i = 0; i < 8; i++) px.push([i, i, 240 + i]);        // 蓝
const p1 = C.kmeansPalette(px, 2, 42, 15), p2 = C.kmeansPalette(px, 2, 42, 15);
assert.deepStrictEqual(p1, p2); ok(true, 'k-means 固定种子可复现');
assert.strictEqual(p1.length, 2); ok(true, '得到 2 色');
const a = C.assignPixels(px, 4, 4, p1, false);
assert(a.slice(0, 8).every(v => v === a[0]) && a.slice(8).every(v => v === a[8]) && a[0] !== a[8]); ok(true, '红/蓝分成两簇');
const red = p1.find(c => c[0] > 200), blue = p1.find(c => c[2] > 200);
assert(red && blue && red[0] >= 243 && blue[2] >= 240); ok(true, '簇中心接近红/蓝');
assert.strictEqual(C.kmeansPalette([[1,2,3],[1,2,3]], 5, 1).length, 1); ok(true, '独立色少于 k 时自动减少');
// 色卡映射
const m = C.mapToYarn([[252,252,248],[250,250,246],[30,30,30]]);
assert.strictEqual(m.length, 2); ok(true, '近似色合并到同一色卡色');
assert(m.some(x => x.name === '炭黑' || x.name === '纯白')); ok(true, '色卡映射(Lab)命中预期颜色: ' + m.map(x=>x.name));
// sortByCount
const s = C.sortByCount([1,1,1,0,2,2], [[0,0,0],[1,1,1],[2,2,2]]);
assert.deepStrictEqual(s.indices, [0,0,0,2,1,1]); ok(true, 'sortByCount A=最多');
console.log('\n全部通过 (' + n + ' 项)');
