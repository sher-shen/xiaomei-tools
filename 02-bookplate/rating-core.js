/* 评分/年度之书的稳定键与迁移（纯函数，无 DOM）。浏览器与 node 共用。 */
(function (root) {
  'use strict';
  function norm(s) {
    return String(s == null ? '' : s).normalize('NFKC').replace(/[《》\u241f\u200b-\u200d\u2060\ufeff]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  }
  // 基础键：规范化书名 + 作者；书名为空 → ''（无键，不可评分）
  function baseKey(title, author) {
    var t = norm(title);
    if (!t) return '';
    return t + '␟' + norm(author);
  }
  // 为每本书分配键；同键重复时按出现顺序加 ␟2、␟3…（确定性；␟ 已被 norm 剔除，不会与作者名如 "#2" 撞键）；空书名得 ''
  function assignKeys(books) {
    var seen = {}, out = [];
    (books || []).forEach(function (b) {
      var k = baseKey(b && b.title, b && b.author);
      if (!k) { out.push(''); return; }
      seen[k] = (seen[k] || 0) + 1;
      out.push(seen[k] === 1 ? k : k + '\u241f' + seen[k]);
    });
    return out;
  }
  function validStar(v) {
    if (typeof v !== 'number' && typeof v !== 'string') return 0; // true / [3] / {} 之类不算星级
    v = Math.round(+v);
    return v >= 1 && v <= 5 ? v : 0;
  }
  function cleanMap(o) {
    var out = {};
    if (o && typeof o === 'object' && !Array.isArray(o)) Object.keys(o).forEach(function (k) {
      var v = validStar(o[k]);
      if (k && v) out[k] = v;
    });
    return out;
  }
  // 存储格式 rv:3 → {rk:{key:星}, bk:key}
  function serialize(rk, bk) { return { ratings: cleanMap(rk), best: typeof bk === 'string' ? bk : '' }; }
  // 读取任意存档（rv 3 按键 / rv 2 按下标 / 更旧按书名），返回 {rk, bk}；损坏数据返回空
  function migrate(saved, books) {
    var empty = { rk: {}, bk: '' };
    try {
      if (!saved || typeof saved !== 'object') return empty;
      books = Array.isArray(books) ? books : [];
      var rv = typeof saved.rv === 'number' ? saved.rv : 0; // 字符串 "3" 之类不可信，按旧版处理
      var keys = assignKeys(books), rk = {}, bk = '';
      if (rv >= 3) { // 未来版本（rv>3）按 rv3 结构尽力读取，不当成旧版按书名误迁移
        return { rk: cleanMap(saved.ratings), bk: typeof saved.best === 'string' ? saved.best : '' };
      }
      var r = saved.ratings && typeof saved.ratings === 'object' && !Array.isArray(saved.ratings) ? saved.ratings : {};
      if (rv === 2) { // 按下标
        Object.keys(r).forEach(function (k) {
          var v = validStar(r[k]);
          if (/^\d+$/.test(k) && String(+k) === k && +k < keys.length && keys[+k] && v) rk[keys[+k]] = v;
        });
        if (Number.isInteger(saved.best) && saved.best >= 0 && saved.best < keys.length) bk = keys[saved.best];
      } else { // 最旧：以书名为键，取首个同名行
        var titles = books.map(function (b) { return String((b && b.title) || ''); });
        Object.keys(r).forEach(function (k) {
          var ix = titles.indexOf(k), v = validStar(r[k]);
          if (ix >= 0 && keys[ix] && v) rk[keys[ix]] = v;
        });
        if (typeof saved.best === 'string' && saved.best) {
          var bi = titles.indexOf(saved.best);
          if (bi >= 0) bk = keys[bi];
        }
      }
      return { rk: rk, bk: bk };
    } catch (e) { return empty; }
  }
  // 键→当前下标视图：{ratings:{i:星}, best:i|-1}
  function toIndexView(keys, rk, bk) {
    var ratings = {}, best = -1;
    keys.forEach(function (k, i) {
      if (!k) return;
      if (rk && rk[k]) ratings[i] = rk[k];
      if (bk && k === bk) best = i;
    });
    return { ratings: ratings, best: best };
  }
  var api = { norm: norm, baseKey: baseKey, assignKeys: assignKeys, serialize: serialize, migrate: migrate, toIndexView: toIndexView };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RatingCore = api;
})(typeof self !== 'undefined' ? self : this);
