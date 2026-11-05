// node test-core.js  —— 验证评分/年度之书的稳定键、重复处理与旧数据迁移
const C = require('./rating-core.js');
const assert = require('assert');
let n = 0; const ok = (c, m) => { assert(c, m); n++; console.log('ok -', m); };
const B = (t, a) => ({ title: t, author: a || '' });
const view = (books, rk, bk) => C.toIndexView(C.assignKeys(books), rk, bk);

const books = [B('红楼梦', '曹雪芹'), B('西游记', '吴承恩'), B('呐喊', '鲁迅')];
let k = C.assignKeys(books);
const rk = { [k[0]]: 5, [k[1]]: 4, [k[2]]: 3 }, bk = k[2];
assert.deepStrictEqual(view(books, rk, bk), { ratings: { 0: 5, 1: 4, 2: 3 }, best: 2 }); ok(true, '基础映射');

// 中间插入：评分跟着书走
const ins = [books[0], B('三国演义', '罗贯中'), books[1], books[2]];
assert.deepStrictEqual(view(ins, rk, bk), { ratings: { 0: 5, 2: 4, 3: 3 }, best: 3 }); ok(true, '中间插入后评分/年度之书不错位');

// 删除
const del = [books[0], books[2]];
assert.deepStrictEqual(view(del, rk, bk), { ratings: { 0: 5, 1: 3 }, best: 1 }); ok(true, '删除中间行后不错位');
assert.strictEqual(view([books[0], books[1]], rk, bk).best, -1); ok(true, '年度之书被删 → -1');

// 规范化：空白/全半角/《》/大小写
assert.strictEqual(C.baseKey(' 《红楼梦》 ', '曹雪芹'), C.baseKey('红楼梦', '曹雪芹')); ok(true, '《》与空白不影响键');
assert.strictEqual(C.baseKey('ＡＢＣ', ' x  y'), C.baseKey('abc', 'x y')); ok(true, '全角/大小写/多空格规范化');
assert.notStrictEqual(C.baseKey('红楼梦', '曹雪芹'), C.baseKey('红楼梦', '高鹗')); ok(true, '同名不同作者键不同');

// 重复 title+author：按出现顺序确定性区分
const dup = [B('日记', '甲'), B('日记', '甲'), B('日记', '甲')];
k = C.assignKeys(dup);
assert.strictEqual(new Set(k).size, 3); ok(true, '重复项键唯一');
assert.deepStrictEqual(C.assignKeys(dup), k); ok(true, '重复项键确定性');
assert.deepStrictEqual(view(dup, { [k[0]]: 1, [k[1]]: 2, [k[2]]: 5 }, k[1]), { ratings: { 0: 1, 1: 2, 2: 5 }, best: 1 }); ok(true, '重复项各自评分');

// 空单元格
assert.deepStrictEqual(C.assignKeys([B(''), B('  '), B('书')]).slice(0, 2), ['', '']); ok(true, '空书名无键');
assert.deepStrictEqual(view([B(''), B('书')], { '': 5 }, ''), { ratings: {}, best: -1 }); ok(true, '空书名不可评分/不可当年度之书');
assert.doesNotThrow(() => C.assignKeys([null, undefined, {}])); ok(true, '空对象不抛错');
assert.strictEqual(C.baseKey('书', null), '书␟'); ok(true, '空作者合法');

// 迁移 rv:2（按下标）
let m = C.migrate({ rv: 2, ratings: { 0: 5, 2: 3, 9: 4, x: 2 }, best: 1 }, books);
assert.deepStrictEqual(m, { rk: { [k0(0)]: 5, [k0(2)]: 3 }, bk: k0(1) }); ok(true, 'rv2 按下标迁移（越界/非法键丢弃）');
function k0(i) { return C.assignKeys(books)[i]; }
// 迁移最旧（按书名）
m = C.migrate({ ratings: { 红楼梦: 4, 不存在: 5 }, best: '呐喊' }, books);
assert.deepStrictEqual(m, { rk: { [k0(0)]: 4 }, bk: k0(2) }); ok(true, '旧版按书名迁移');
// rv:3 往返
const s = C.serialize(rk, bk);
m = C.migrate(Object.assign({ rv: 3 }, s), []);
assert.deepStrictEqual(m, { rk, bk }); ok(true, 'rv3 序列化往返');
// 迁移后插入仍正确
m = C.migrate({ rv: 2, ratings: { 1: 4 }, best: 1 }, books);
assert.deepStrictEqual(view(ins, m.rk, m.bk), { ratings: { 2: 4 }, best: 2 }); ok(true, '迁移后再插入不错位');

// 损坏数据
[null, undefined, 5, 'x', [], { rv: 2, ratings: 'bad', best: 'z' }, { rv: 2, ratings: [1, 2], best: 1.5 },
 { rv: 3, ratings: { a: 99, b: 'x', c: NaN, d: 3 }, best: 7 }, { ratings: null, best: {} }].forEach((bad, i) => {
  let r; assert.doesNotThrow(() => { r = C.migrate(bad, books); }); 
  assert(r && typeof r.rk === 'object' && typeof r.bk === 'string');
});
ok(true, '各种损坏存档不抛错且返回合法结构');
assert.deepStrictEqual(C.migrate({ rv: 3, ratings: { a: 99, b: 'x', d: 3.4 }, best: 7 }, []), { rk: { d: 3 }, bk: '' }); ok(true, '非法星级被清洗');
assert.deepStrictEqual(C.migrate({ rv: 2, ratings: { 0: 5 } }, null), { rk: {}, bk: '' }); ok(true, 'books 非数组不抛错');

// 第 1 轮加固
assert.deepStrictEqual(C.migrate({ rv: 3, ratings: { a: true, b: [3], c: {}, d: '4', e: null } }, []).rk, { d: 4 }); ok(true, 'true/数组/对象/null 不算星级');
m = C.migrate({ rv: 4, ratings: { [k0(0)]: 5 }, best: k0(1) }, books);
assert.deepStrictEqual(m, { rk: { [k0(0)]: 5 }, bk: k0(1) }); ok(true, '未来版本 rv>3 按键结构读取');
m = C.migrate({ rv: 2, ratings: { 0: 5, '00': 1, '01': 2 }, best: 0 }, books);
assert.deepStrictEqual(m.rk, { [k0(0)]: 5 }); ok(true, 'rv2 非规范下标键（00/01）丢弃，不覆盖');
assert.notStrictEqual(C.baseKey('a\u241fb', 'c'), C.baseKey('a', 'b\u241fc')); ok(true, '书名/作者含分隔符不串键');

// 第 2 轮加固
assert.strictEqual(C.baseKey('红楼梦\u200b', '曹\ufeff雪芹'), C.baseKey('红楼梦', '曹雪芹')); ok(true, '零宽字符/BOM 不影响键');
m = C.migrate({ rv: '3', ratings: { [k0(0)]: 5 }, best: k0(0) }, books);
assert.deepStrictEqual(m, { rk: {}, bk: '' }); ok(true, 'rv 为字符串不当作新版结构（按旧版处理，不误读）');

// 第 3 轮（监工挑刺）：重复书名的序号后缀不得与作者名撞键
var dup3 = [B('a', ''), B('a', ''), B('a', '#2')];
var k3 = C.assignKeys(dup3);
assert.strictEqual(new Set(k3).size, 3); ok(true, '重复项后缀不与作者 "#2" 撞键');
m = C.migrate({ rv: 2, ratings: { 1: 5, 2: 1 }, best: 2 }, dup3);
assert.deepStrictEqual(C.toIndexView(k3, m.rk, m.bk), { ratings: { 1: 5, 2: 1 }, best: 2 }); ok(true, '撞键场景迁移后评分/年度之书各归其位');

console.log(n + ' checks passed');
