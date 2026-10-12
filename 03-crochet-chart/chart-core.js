/* 钩针图纸 - 纯函数核心（浏览器与 Node 通用，无 DOM 依赖） */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.XMChart = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 通用毛线色卡（自定义，非任何品牌色号）
  var YARN = [
    ['米白', '#f3ecdc'], ['奶油', '#f5e6c4'], ['象牙', '#efe3c8'], ['浅灰', '#cfcfcb'],
    ['中灰', '#9a9a98'], ['深灰', '#5e5f60'], ['炭黑', '#2a2a2b'], ['纯白', '#fbfbf8'],
    ['藏青', '#1f2f4d'], ['宝蓝', '#2c55a0'], ['天蓝', '#79a9d6'], ['浅蓝', '#bcd6ea'],
    ['湖蓝', '#2e8aa0'], ['青绿', '#4fa59a'], ['薄荷', '#aad8c4'], ['墨绿', '#1f4a38'],
    ['草绿', '#6a9a3c'], ['橄榄', '#7c7a35'], ['抹茶', '#a9b97a'], ['姜黄', '#d5a021'],
    ['明黄', '#f1cf3c'], ['奶黄', '#f6e49a'], ['橘色', '#e07a2c'], ['杏色', '#eec3a0'],
    ['砖红', '#a2402f'], ['朱红', '#c8362a'], ['正红', '#d02a2e'], ['酒红', '#7a1f2e'],
    ['玫红', '#c2487a'], ['粉红', '#ec9fb0'], ['浅粉', '#f4cfd4'], ['藕粉', '#d3a7a6'],
    ['淡紫', '#b9a6cf'], ['藕紫', '#8a6c9a'], ['深紫', '#4c2f63'], ['驼色', '#b48a5c'],
    ['咖啡', '#6b4a33'], ['巧克力', '#3f2a1f'], ['卡其', '#c2ad82'], ['肤色', '#e8c3a4']
  ];

  function hexToRgb(h) {
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  }
  function rgbToHex(c) {
    return '#' + c.map(function (v) {
      v = Math.max(0, Math.min(255, Math.round(v)));
      return (v < 16 ? '0' : '') + v.toString(16);
    }).join('');
  }

  function rgbToLab(c) {
    function lin(v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
    var r = lin(c[0]), g = lin(c[1]), b = lin(c[2]);
    var x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
    var y = (r * 0.2126729 + g * 0.7151522 + b * 0.0721750);
    var z = (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) / 1.08883;
    function f(t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; }
    var fx = f(x), fy = f(y), fz = f(z);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }
  function labDist2(a, b) {
    var d0 = a[0] - b[0], d1 = a[1] - b[1], d2 = a[2] - b[2];
    return d0 * d0 + d1 * d1 + d2 * d2;
  }

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * 像素去重/降采样：相同颜色合并并记权重；独立色仍超过 maxUnique 时逐步量化（丢低位）。
   * 返回 {colors:[[r,g,b],...], weights:[n,...]}
   */
  function dedupePixels(pixels, maxUnique) {
    maxUnique = maxUnique || 3000;
    for (var q = 0; q <= 7; q++) {
      var map = {}, keys = [];
      for (var i = 0; i < pixels.length; i++) {
        var p = pixels[i];
        var key = ((p[0] >> q) << 16) | ((p[1] >> q) << 8) | (p[2] >> q);
        var e = map[key];
        if (!e) { e = map[key] = [0, 0, 0, 0]; keys.push(key); }
        e[0] += p[0]; e[1] += p[1]; e[2] += p[2]; e[3]++;
      }
      if (keys.length <= maxUnique || q === 7) {
        return {
          colors: keys.map(function (k) { var e = map[k]; return [Math.round(e[0] / e[3]), Math.round(e[1] / e[3]), Math.round(e[2] / e[3])]; }),
          weights: keys.map(function (k) { return map[k][3]; })
        };
      }
    }
  }

  /**
   * k-means（Lab 空间，k-means++ 初始化，固定种子；先对像素去重加权，大图也很快）
   * pixels: [[r,g,b],...]  返回 RGB 调色板 [[r,g,b],...]（长度 <= k）
   */
  function kmeansPalette(pixels, k, seed, maxIter) {
    seed = seed == null ? 12345 : seed;
    maxIter = maxIter == null ? 15 : Math.min(15, maxIter);
    if (!pixels.length) return [];
    var dd0 = dedupePixels(pixels), cols = dd0.colors, wt = dd0.weights;
    var n = cols.length;
    var labs = cols.map(rgbToLab);
    k = Math.max(1, Math.min(k, n));
    var rnd = mulberry32(seed), i, j;
    function pickWeighted(arr) {
      var sum = 0;
      for (var t = 0; t < n; t++) sum += arr[t];
      if (sum <= 0) return Math.floor(rnd() * n);
      var r = rnd() * sum, acc = 0;
      for (t = 0; t < n; t++) { acc += arr[t]; if (acc >= r) return t; }
      return n - 1;
    }
    // k-means++（按权重）
    var centers = [labs[pickWeighted(wt)].slice()];
    var d2 = new Float64Array(n), pw = new Float64Array(n);
    for (i = 0; i < n; i++) d2[i] = labDist2(labs[i], centers[0]);
    while (centers.length < k) {
      for (i = 0; i < n; i++) pw[i] = d2[i] * wt[i];
      var c = labs[pickWeighted(pw)].slice();
      centers.push(c);
      for (i = 0; i < n; i++) { var dd = labDist2(labs[i], c); if (dd < d2[i]) d2[i] = dd; }
    }
    var assign = new Int32Array(n).fill(-1);
    for (var it = 0; it < maxIter; it++) {
      var changed = false;
      for (i = 0; i < n; i++) {
        var best = 0, bd = Infinity;
        for (j = 0; j < centers.length; j++) {
          var d = labDist2(labs[i], centers[j]);
          if (d < bd) { bd = d; best = j; }
        }
        if (assign[i] !== best) { assign[i] = best; changed = true; }
      }
      var sums = centers.map(function () { return [0, 0, 0, 0]; });
      for (i = 0; i < n; i++) {
        var s = sums[assign[i]], w = wt[i];
        s[0] += labs[i][0] * w; s[1] += labs[i][1] * w; s[2] += labs[i][2] * w; s[3] += w;
      }
      for (j = 0; j < centers.length; j++) {
        if (sums[j][3] > 0) centers[j] = [sums[j][0] / sums[j][3], sums[j][1] / sums[j][3], sums[j][2] / sums[j][3]];
      }
      if (!changed) break;
    }
    // 用成员像素的 RGB 加权平均作为色（避免 Lab 反变换），空簇丢弃
    var rs = centers.map(function () { return [0, 0, 0, 0]; });
    for (i = 0; i < n; i++) {
      var q = rs[assign[i]], w2 = wt[i];
      q[0] += cols[i][0] * w2; q[1] += cols[i][1] * w2; q[2] += cols[i][2] * w2; q[3] += w2;
    }
    var pal = [];
    rs.forEach(function (q) {
      if (q[3] > 0) pal.push([Math.round(q[0] / q[3]), Math.round(q[1] / q[3]), Math.round(q[2] / q[3])]);
    });
    return pal;
  }

  /** 把调色板每色映射到最近的色卡色（Lab），重复的合并。返回 [{rgb,name,hex}] 或原调色板 */
  function mapToYarn(palette, yarn) {
    yarn = yarn || YARN;
    var yl = yarn.map(function (y) { return rgbToLab(hexToRgb(y[1])); });
    var used = {}, out = [];
    palette.forEach(function (c) {
      var l = rgbToLab(c), bi = 0, bd = Infinity;
      for (var i = 0; i < yarn.length; i++) {
        var d = labDist2(l, yl[i]);
        if (d < bd) { bd = d; bi = i; }
      }
      if (!used[bi]) { used[bi] = 1; out.push({ rgb: hexToRgb(yarn[bi][1]), hex: yarn[bi][1], name: yarn[bi][0] }); }
    });
    return out;
  }

  /** 给无色卡的调色板起近似色名（取最近的色卡名，仅作提示） */
  function nearestName(rgb, yarn) {
    yarn = yarn || YARN;
    var l = rgbToLab(rgb), bi = 0, bd = Infinity;
    for (var i = 0; i < yarn.length; i++) {
      var d = labDist2(l, rgbToLab(hexToRgb(yarn[i][1])));
      if (d < bd) { bd = d; bi = i; }
    }
    return yarn[bi][0];
  }

  /** 把每个像素分配到调色板最近色；dither 时用 Floyd–Steinberg。返回长度 w*h 的索引数组 */
  function assignPixels(pixels, w, h, palette, dither) {
    var pl = palette.map(rgbToLab);
    var cache = {};
    function nearest(c) {
      var ck = (c[0] << 16) | (c[1] << 8) | c[2];
      if (cache[ck] !== undefined) return cache[ck];
      var l = rgbToLab(c), bi = 0, bd = Infinity;
      for (var j = 0; j < pl.length; j++) {
        var d = labDist2(l, pl[j]);
        if (d < bd) { bd = d; bi = j; }
      }
      return (cache[ck] = bi);
    }
    var out = new Array(w * h);
    if (!dither) {
      for (var i = 0; i < w * h; i++) out[i] = nearest(pixels[i]);
      return out;
    }
    var buf = pixels.map(function (p) { return [p[0], p[1], p[2]]; });
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var idx = y * w + x, cur = buf[idx];
        var cc = [Math.max(0, Math.min(255, cur[0])), Math.max(0, Math.min(255, cur[1])), Math.max(0, Math.min(255, cur[2]))];
        var cr = [Math.round(cc[0]), Math.round(cc[1]), Math.round(cc[2])];
        var b = nearest(cr);
        out[idx] = b;
        var err = [cc[0] - palette[b][0], cc[1] - palette[b][1], cc[2] - palette[b][2]];
        var spread = [[1, 0, 7 / 16], [-1, 1, 3 / 16], [0, 1, 5 / 16], [1, 1, 1 / 16]];
        for (var s = 0; s < spread.length; s++) {
          var nx = x + spread[s][0], ny = y + spread[s][1];
          if (nx < 0 || nx >= w || ny >= h) continue;
          var t = buf[ny * w + nx];
          t[0] += err[0] * spread[s][2]; t[1] += err[1] * spread[s][2]; t[2] += err[2] * spread[s][2];
        }
      }
    }
    return out;
  }

  /** 按格数从多到少重排调色板，A 为最多的颜色。返回 {indices, palette, counts} */
  function sortByCount(indices, palette) {
    var cnt = palette.map(function () { return 0; });
    indices.forEach(function (v) { cnt[v]++; });
    var order = [];
    for (var i = 0; i < palette.length; i++) if (cnt[i] > 0) order.push(i);
    order.sort(function (a, b) { return cnt[b] - cnt[a] || a - b; });
    var map = {};
    order.forEach(function (o, ni) { map[o] = ni; });
    return {
      indices: indices.map(function (v) { return map[v]; }),
      palette: order.map(function (o) { return palette[o]; }),
      counts: order.map(function (o) { return cnt[o]; })
    };
  }

  function symbolFor(i) {
    return String.fromCharCode(65 + i); // A, B, C ...（最多 16 色 = A..P）
  }

  function runs(seq) {
    var out = [];
    seq.forEach(function (v) {
      if (out.length && out[out.length - 1].c === v) out[out.length - 1].n++;
      else out.push({ c: v, n: 1 });
    });
    return out;
  }

  /**
   * 提花挂毯钩（按行）。第 1 行 = 图纸最下面一行；奇数行从右往左（←），偶数行从左往右（→）。
   * 返回 [{row, dir:'←'|'→', runs:[{c,n}]}]，runs 为实际钩织顺序。
   */
  function tapestryRows(indices, w, h) {
    var rows = [];
    for (var r = 1; r <= h; r++) {
      var y = h - r, seq = [];
      for (var x = 0; x < w; x++) seq.push(indices[y * w + x]);
      var rtl = (r % 2 === 1);
      if (rtl) seq.reverse();
      rows.push({ row: r, dir: rtl ? '←' : '→', runs: runs(seq) });
    }
    return rows;
  }

  /**
   * C2C 斜钩。起点 = 右下角；第 k 条对角线（k 从 0）含所有 u+v=k 的格，
   * u = 距右边的格数，v = 距下边的格数。
   * k 为偶数：从左下往右上（↗）；k 为奇数：从右上往左下（↙）。
   * phase：inc 增针段 / flat 平段（一侧加针一侧减针，仅长方形出现）/ dec 减针段
   * 返回 [{diag, dir, phase, len, switchTo:null|'flat'|'dec', runs:[{c,n}]}]
   */
  function c2cDiagonals(indices, w, h) {
    var m = Math.min(w, h), M = Math.max(w, h), total = w + h - 1, out = [];
    var prev = null;
    for (var k = 0; k < total; k++) {
      var phase = k < m ? 'inc' : (k < M ? 'flat' : 'dec');
      var uLo = Math.max(0, k - (h - 1)), uHi = Math.min(k, w - 1), seq = [];
      var even = (k % 2 === 0);
      // 偶数：u 从大到小 (x 从左到右，向右上)；奇数：u 从小到大
      if (even) for (var u = uHi; u >= uLo; u--) seq.push(cell(u, k - u));
      else for (u = uLo; u <= uHi; u++) seq.push(cell(u, k - u));
      out.push({
        diag: k + 1, dir: even ? '↗' : '↙', phase: phase, len: seq.length,
        switchTo: (prev !== null && prev !== phase) ? phase : null, runs: runs(seq)
      });
      prev = phase;
    }
    function cell(u, v) { return indices[(h - 1 - v) * w + (w - 1 - u)]; }
    return out;
  }

  /** 某条对角线（0 起）包含的格 [[x,y],...] */
  function diagCells(k, w, h) {
    var uLo = Math.max(0, k - (h - 1)), uHi = Math.min(k, w - 1), out = [];
    for (var u = uLo; u <= uHi; u++) out.push([w - 1 - u, h - 1 - (k - u)]);
    return out;
  }


  /**
   * 清理孤立格：四邻（边角格取现有邻格，至少 2 个）都与自己异色的单个孤格，
   * 并入出现最多的邻色（平局取编号小者）。基于原数组一次判定，返回新数组。
   */
  function cleanIsolated(indices, w, h) {
    var out = indices.slice();
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var me = indices[y * w + x], nb = [];
        if (x > 0) nb.push(indices[y * w + x - 1]);
        if (x < w - 1) nb.push(indices[y * w + x + 1]);
        if (y > 0) nb.push(indices[(y - 1) * w + x]);
        if (y < h - 1) nb.push(indices[(y + 1) * w + x]);
        if (nb.length < 2) continue;
        var iso = true, cnt = {};
        for (var i = 0; i < nb.length; i++) {
          if (nb[i] === me) { iso = false; break; }
          cnt[nb[i]] = (cnt[nb[i]] || 0) + 1;
        }
        if (!iso) continue;
        var best = -1, bc = 0;
        Object.keys(cnt).map(Number).sort(function (a, b) { return a - b; }).forEach(function (c) {
          if (cnt[c] > bc) { bc = cnt[c]; best = c; }
        });
        out[y * w + x] = best;
      }
    }
    return out;
  }

  /**
   * 换线统计。steps 为 tapestryRows / c2cDiagonals 的结果。
   * perStep[i] = 该行（条）内换色次数；turns = 相邻两行（条）衔接处颜色不同的次数；
   * total = 行内换色合计 + 衔接换色。
   */
  function colorChanges(steps) {
    var per = [], within = 0, turns = 0;
    steps.forEach(function (st, i) {
      var n = Math.max(0, st.runs.length - 1);
      per.push(n); within += n;
      if (i > 0) {
        var pr = steps[i - 1].runs;
        if (pr[pr.length - 1].c !== st.runs[0].c) turns++;
      }
    });
    var mx = 0, mi = 0;
    per.forEach(function (n, i) { if (n > mx) { mx = n; mi = i; } });
    return { perStep: per, within: within, turns: turns, total: within + turns, max: mx, maxIndex: mi };
  }

  /** 裁剪矩形。mode: 'square' 居中正方形；其他 = 原比例。返回 {sx,sy,sw,sh} */
  function cropRect(w, h, mode) {
    if (mode === 'square') {
      var s = Math.min(w, h);
      return { sx: Math.floor((w - s) / 2), sy: Math.floor((h - s) / 2), sw: s, sh: s };
    }
    return { sx: 0, sy: 0, sw: w, sh: h };
  }

  /**
   * 图纸尺寸：按裁剪后比例由列数算行数；行数超过 maxRows 时按比例缩小列数，使行数 = maxRows。
   * 返回 {w, h, adjusted}（adjusted 为 true 表示列数被改动）
   */
  function chartSize(cols, sw, sh, maxRows) {
    maxRows = maxRows || 300;
    var w = Math.max(1, Math.round(cols));
    var h = Math.max(1, Math.round(w * sh / sw)), adjusted = false;
    if (h > maxRows) {
      h = maxRows;
      w = Math.max(1, Math.min(w, Math.round(maxRows * sw / sh)));
      adjusted = w !== Math.round(cols);
    }
    return { w: w, h: h, adjusted: adjusted };
  }

  /**
   * 调色板重名处理：items=[{name,rgb}]（原地不改，返回新名字数组）。
   * 重名组内按明度（Lab L）最深者加“深”、最浅者加“浅”前缀；仍重名则加序号。
   */
  function uniqueNames(items) {
    var names = items.map(function (it) { return it.name; });
    var groups = {};
    names.forEach(function (n, i) { (groups[n] = groups[n] || []).push(i); });
    Object.keys(groups).forEach(function (n) {
      var g = groups[n];
      if (g.length < 2) return;
      g.sort(function (a, b) { return rgbToLab(items[a].rgb)[0] - rgbToLab(items[b].rgb)[0] || a - b; });
      names[g[0]] = '深' + n;
      names[g[g.length - 1]] = '浅' + n;
    });
    var seen = {};
    return names.map(function (n) {
      if (!seen[n]) { seen[n] = 1; return n; }
      seen[n]++;
      return n + seen[n];
    });
  }

  var PHASE_NAME = { inc: '增针段', flat: '平段', dec: '减针段' };

  function formatRuns(rs, syms) {
    return rs.map(function (r) { return syms(r.c) + '×' + r.n; }).join('，');
  }
  function formatTapestryLine(row, syms) {
    return '第 ' + row.row + ' 行（' + row.dir + '）：' + formatRuns(row.runs, syms);
  }
  function formatC2CLine(d, syms) {
    var s = '';
    if (d.switchTo) s += '【转为' + PHASE_NAME[d.switchTo] + '】';
    return s + '第 ' + d.diag + ' 条对角线（' + PHASE_NAME[d.phase] + ' ' + d.dir + '，' + d.len + ' 格）：' + formatRuns(d.runs, syms);
  }

  return {
    YARN: YARN, hexToRgb: hexToRgb, rgbToHex: rgbToHex, rgbToLab: rgbToLab, labDist2: labDist2,
    mulberry32: mulberry32, kmeansPalette: kmeansPalette, mapToYarn: mapToYarn, nearestName: nearestName,
    assignPixels: assignPixels, dedupePixels: dedupePixels, cleanIsolated: cleanIsolated, colorChanges: colorChanges, cropRect: cropRect, chartSize: chartSize, uniqueNames: uniqueNames, sortByCount: sortByCount, symbolFor: symbolFor,
    tapestryRows: tapestryRows, c2cDiagonals: c2cDiagonals, diagCells: diagCells,
    PHASE_NAME: PHASE_NAME, formatTapestryLine: formatTapestryLine, formatC2CLine: formatC2CLine
  };
});
