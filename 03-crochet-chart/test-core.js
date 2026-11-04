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

// 4) 去重 / 清理孤格 / 换线统计 / 裁剪
const dd = C.dedupePixels([[1,1,1],[1,1,1],[2,2,2]]);
assert.strictEqual(dd.colors.length, 2); assert.deepStrictEqual(dd.weights, [2,1]); ok(true, 'dedupePixels 合并相同颜色并计权');
const many = []; for (let i = 0; i < 5000; i++) many.push([i % 256, (i * 7) % 256, (i * 13) % 256]);
const dm = C.dedupePixels(many, 500); assert(dm.colors.length <= 500 && dm.weights.reduce((a, b) => a + b, 0) === 5000); ok(true, '独立色过多时量化，权重总和不变');
const big = []; for (let i = 0; i < 22500; i++) big.push([(i * 37) % 256, (i * 91) % 256, (i * 53) % 256]);
const t0 = Date.now(); const pb = C.kmeansPalette(big, 8, 1, 15); assert(pb.length === 8 && Date.now() - t0 < 3000); ok(true, '150x150 大图 k-means 在 3 秒内完成');
// 孤格：中心 1 被四个 0 包围 -> 0；角落 2 的两邻都是 0 -> 0；非孤格不变
const g = [0,0,0,0, 0,1,0,0, 0,0,0,0, 2,0,1,1];
const gc = C.cleanIsolated(g, 4, 4);
assert.strictEqual(gc[5], 0); assert.strictEqual(gc[12], 0); ok(true, '孤立格并入邻色');
assert.strictEqual(gc[14], 1); assert.strictEqual(gc[15], 1); ok(true, '相邻同色的格保持不变');
const src = [0,1,2,3]; C.cleanIsolated(src, 2, 2); assert.deepStrictEqual(src, [0,1,2,3]); ok(true, '清理不修改原数组');
assert.strictEqual(C.cleanIsolated([1,0,0, 0,2,0, 0,0,0], 3, 3)[4], 0); ok(true, '3x3 中心孤格并入 0');
const cc = C.colorChanges(C.tapestryRows(idx, 4, 4));
assert.deepStrictEqual(cc.perStep, [1,1,1,1]); assert.strictEqual(cc.within, 4); ok(true, '每行换色次数');
assert.strictEqual(cc.turns, 1); assert.strictEqual(cc.total, 5); ok(true, '行间衔接换色计入总数 (行内4+衔接1)');
const cc1 = C.colorChanges(C.tapestryRows(new Array(9).fill(0), 3, 3)); assert.strictEqual(cc1.total, 0); ok(true, '单色图换线 0 次');
assert.deepStrictEqual(C.cropRect(200, 100, 'square'), { sx: 50, sy: 0, sw: 100, sh: 100 }); ok(true, '居中正方形裁剪');
assert.deepStrictEqual(C.cropRect(200, 100, 'orig'), { sx: 0, sy: 0, sw: 200, sh: 100 }); ok(true, '保持原比例');
// 尺寸 / 重名
let cs = C.chartSize(150, 200, 1000, 300);
assert.deepStrictEqual([cs.w, cs.h, cs.adjusted], [60, 300, true]); ok(true, '200x1000 选 150 列 -> 60x300 并提示');
cs = C.chartSize(40, 200, 100, 300); assert.deepStrictEqual([cs.w, cs.h, cs.adjusted], [40, 20, false]); ok(true, '正常比例不调整');
cs = C.chartSize(150, 1, 1, 300); assert.deepStrictEqual([cs.w, cs.h, cs.adjusted], [150, 150, false]); ok(true, '正方形 150 列不调整');
const un = C.uniqueNames([{name:'朱红系',rgb:[200,54,42]},{name:'朱红系',rgb:[120,20,10]},{name:'灰系',rgb:[1,1,1]}]);
assert.deepStrictEqual(un, ['浅朱红系','深朱红系','灰系']); ok(true, '重名按明度加深/浅');
const un3 = C.uniqueNames([{name:'A',rgb:[50,50,50]},{name:'A',rgb:[100,100,100]},{name:'A',rgb:[200,200,200]},{name:'A',rgb:[150,150,150]}]);
assert.strictEqual(new Set(un3).size, 4); ok(true, '多重名仍保证唯一: ' + un3);
// 边界：尺寸 / 进度 / 极小图
cs = C.chartSize(40, 0, 0, 300); assert(cs.w >= 1 && cs.h >= 1 && isFinite(cs.w) && isFinite(cs.h)); ok(true, '0 尺寸图片不产生 NaN');
cs = C.chartSize(NaN, 100, 100, 300); assert(cs.w === 1 && cs.h === 1); ok(true, '列数 NaN 退化为 1');
cs = C.chartSize(10, 10000, 1, 300); assert.deepStrictEqual([cs.w, cs.h], [10, 1]); ok(true, '极扁图高度至少 1');
cs = C.chartSize(10, 1, 10000, 300); assert.deepStrictEqual([cs.w, cs.h], [1, 300]); ok(true, '极窄图列数至少 1');
assert.deepStrictEqual(C.parseProgress('{"sig":"c2c:4x4:1","idx":3}'), { sig: 'c2c:4x4:1', idx: 3 }); ok(true, '合法进度可解析');
['', 'null', '{bad', '[]', '5', '{"sig":"a","idx":"3"}', '{"sig":"a","idx":-1}', '{"sig":"a","idx":1.5}', '{"idx":1}', '{"sig":1,"idx":1}']
  .forEach(r => assert.strictEqual(C.parseProgress(r), null)); ok(true, '损坏/非法进度记录一律拒绝');
assert.strictEqual(C.restoreIdx('{"sig":"x","idx":2}', 'x', 5), 2); assert.strictEqual(C.restoreIdx('{"sig":"x","idx":2}', 'y', 5), 0);
assert.strictEqual(C.restoreIdx('{"sig":"x","idx":5}', 'x', 5), 0); ok(true, '进度仅在签名一致且未越界时恢复');
const t1 = C.tapestryRows([0, 1, 1], 1, 3); assert.deepStrictEqual(t1.map(r => r.dir), ['←', '→', '←']); ok(true, '单列图每行一格');
const c1 = C.c2cDiagonals([0, 1, 2, 3], 1, 4);
assert.deepStrictEqual(c1.map(x => x.len), [1, 1, 1, 1]); assert.deepStrictEqual(c1.map(x => x.phase), ['inc', 'flat', 'flat', 'flat']);
assert.deepStrictEqual(c1.map(x => x.runs[0].c), [3, 2, 1, 0]); ok(true, 'C2C 单列图：从右下起逐格向上');
const c1r = C.c2cDiagonals([0, 1, 2, 3], 4, 1); assert.deepStrictEqual(c1r.map(x => x.runs[0].c), [3, 2, 1, 0]); ok(true, 'C2C 单行图：从右往左');
const c11 = C.c2cDiagonals([7], 1, 1); assert.strictEqual(c11.length, 1); assert.strictEqual(C.colorChanges(c11).total, 0); ok(true, '1x1 图可读');
assert.deepStrictEqual(C.kmeansPalette([], 4, 1), []); ok(true, '空像素 k-means 返回空');
const one = C.assignPixels([[10, 10, 10]], 1, 1, [[0, 0, 0]], true); assert.deepStrictEqual(one, [0]); ok(true, '1x1 抖动不越界');
console.log('\n全部通过 (' + n + ' 项)');
