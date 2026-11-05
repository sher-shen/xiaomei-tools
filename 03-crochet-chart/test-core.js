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
// 多图纸进度 LRU
{
  let st = [];
  for (let i = 0; i < 12; i++) st = C.touchProgress(st, 's' + i, i, i);
  assert.strictEqual(st.length, 10); assert.strictEqual(st[0].sig, 's11'); assert.strictEqual(st[9].sig, 's2'); ok(true, '进度仅保留最近 10 条');
  st = C.touchProgress(st, 's5', 7, 99); assert.strictEqual(st[0].sig, 's5'); assert.strictEqual(st.length, 10);
  assert.strictEqual(C.findProgressIdx(st, 's5', 20), 7); assert.strictEqual(C.findProgressIdx(st, 's5', 5), 0);
  assert.strictEqual(C.findProgressIdx(st, 'zzz', 20), 0); ok(true, '更新置顶、越界/未知回 0');
  const a = C.touchProgress([], 'A', 3, 1), b = C.touchProgress(a, 'B', 4, 2);
  assert.strictEqual(C.findProgressIdx(b, 'A', 9), 3); ok(true, '换参数翻页后旧图纸进度不丢');
  const rt = C.parseProgressStore(C.serializeProgressStore(b)); assert.deepStrictEqual(rt, b); ok(true, '序列化往返一致');
  assert.deepStrictEqual(C.parseProgressStore('{"sig":"c2c:4x4:1","idx":3}'), [{ sig: 'c2c:4x4:1', idx: 3, t: 0 }]); ok(true, '旧版单条数据迁移');
  ['', 'null', '{bad', '[]', '5', '{"items":5}'].forEach(r => assert.deepStrictEqual(C.parseProgressStore(r), []));
  const mix = C.parseProgressStore('{"items":[{"sig":"a","idx":1},{"sig":"a","idx":2},{"sig":1,"idx":1},{"sig":"b","idx":-1},null,{"sig":"c","idx":"3"},{"sig":"d","idx":4}]}');
  assert.deepStrictEqual(mix.map(x => x.sig), ['a', 'd']); ok(true, '损坏/重复条目被丢弃，好条目保留');
}
// 第 1 轮加固
{
  assert.strictEqual(C.touchProgress([], 'A', NaN, 1)[0].idx, 0);
  assert.strictEqual(C.touchProgress([], 'A', -3, 1)[0].idx, 0);
  assert.deepStrictEqual(C.touchProgress([{ sig: 'x', idx: 1, t: 0 }], 5, 1, 1), [{ sig: 'x', idx: 1, t: 0 }]);
  assert.strictEqual(C.touchProgress([], 'A', 1, NaN)[0].t, 0);
  assert.strictEqual(C.touchProgress([{ sig: 'a', idx: 1, t: 0 }, { sig: 'b', idx: 1, t: 0 }], 'c', 1, 1, -1).length, 3);
  ok(true, 'touchProgress：非法 idx/sig/now/max 不写坏存档');
  const mk = C.makeQuantCache(-1); mk.put('a', 1); mk.put('b', 2); assert.strictEqual(Object.keys(mk.map).length, 2); ok(true, '缓存容量非法时回落默认（不死循环）');
  assert.deepStrictEqual(C.parseProgressStore('{"items":[{"sig":"__proto__","idx":1},{"sig":"constructor","idx":2}]}').map(x => x.sig), ['__proto__', 'constructor']); ok(true, '特殊签名不被误判重复');
  // 配额满：写入失败时从最旧开始丢弃
  const items = ['a', 'b', 'c', 'd'].map((s, i) => ({ sig: s, idx: i, t: i }));
  let wrote; const w = (lim) => (str) => { if (JSON.parse(str).items.length > lim) throw new Error('Quota'); wrote = str; };
  assert.strictEqual(C.saveProgressStore(items, w(2)), 2); assert.deepStrictEqual(JSON.parse(wrote).items.map(x => x.sig), ['a', 'b']); ok(true, '配额满：丢最旧后写入成功，最新保留');
  assert.strictEqual(C.saveProgressStore(items, w(0)), 0); assert.strictEqual(C.saveProgressStore([], w(9)), 0); ok(true, '完全写不进去 → 返回 0 不抛错');
}
// 量化缓存
{
  const px = []; for (let i = 0; i < 64; i++) px.push([(i * 37) % 256, (i * 91) % 256, (i * 13) % 256]);
  let calls = 0; const kf = (...a) => { calls++; return C.kmeansPalette(...a); };
  const cache = C.makeQuantCache(2), o = { w: 8, h: 8, k: 4, yarn: true, dither: false, clean: true, seed: 1, iter: 15 };
  const r1 = C.quantizePattern(px, o, cache, kf); assert.strictEqual(calls, 1); assert.strictEqual(r1.cached, false);
  const r2 = C.quantizePattern(px, o, cache, kf); assert.strictEqual(calls, 1); assert.strictEqual(r2.cached, true);
  assert.deepStrictEqual(r2.indices, r1.indices); assert.deepStrictEqual(r2.palette, r1.palette); ok(true, '同输入命中缓存，k-means 未重跑');
  const full = C.quantizePattern(px, o, null, kf); assert.strictEqual(calls, 2);
  assert.deepStrictEqual([full.indices, full.palette, full.counts], [r2.indices, r2.palette, r2.counts]); ok(true, '缓存结果与完整重算一致');
  r2.palette[0].name = 'X'; r2.indices[0] = 99; const r3 = C.quantizePattern(px, o, cache, kf);
  assert.deepStrictEqual(r3.palette, r1.palette); assert.strictEqual(r3.indices[0], r1.indices[0]); ok(true, '缓存返回副本，调用方修改不污染');
  C.quantizePattern(px, Object.assign({}, o, { k: 5 }), cache, kf); assert.strictEqual(calls, 3); ok(true, '色数变化重算');
  const px2 = px.slice(); px2[0] = [1, 2, 3]; C.quantizePattern(px2, o, cache, kf); assert.strictEqual(calls, 4); ok(true, '图片内容变化重算');
  C.quantizePattern(px, o, cache, kf); assert.strictEqual(calls, 5); ok(true, '缓存有上限(LRU 淘汰)');
}
console.log('\n全部通过 (' + n + ' 项)');
