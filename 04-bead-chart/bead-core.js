/* 拼豆 / 十字绣图纸 - 纯函数核心（浏览器与 Node 通用，无 DOM 依赖） */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.XMBead = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function hexToRgb(h) {
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
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

  // 32 个易辨认符号：去掉易混的 I、O，再加数字 2~9
  var SYMBOLS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function symbolFor(i) { return SYMBOLS.charAt(i) || String(i + 1); }

  /** 相同颜色合并计权；独立色超过 maxUnique 时逐步丢低位。pixels=[[r,g,b],...] */
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
   * 从色卡里挑出不超过 k 种颜色。
   * 先把每种（去重后的）像素色映射到色卡最近色，再反复去掉“并入别的颜色代价最小”的那一色，
   * 代价 = 该色所有像素改用次近色后增加的 Lab 平方误差（按像素数加权）。
   * 这样面积小但很显眼的颜色（如眼睛、高光）不容易被吃掉。
   * 返回所选色卡下标数组（按色卡顺序）。
   */
  function selectColors(pixels, cardLabs, k) {
    if (!pixels.length) return [];
    var dd = dedupePixels(pixels), n = dd.colors.length, wt = dd.weights;
    var labs = dd.colors.map(rgbToLab), m = cardLabs.length, i, j;
    var dist = new Float64Array(n * m);
    for (i = 0; i < n; i++) for (j = 0; j < m; j++) dist[i * m + j] = labDist2(labs[i], cardLabs[j]);
    var inSet = new Uint8Array(m), best = new Int32Array(n);
    for (i = 0; i < n; i++) {
      var bj = 0, bd = Infinity;
      for (j = 0; j < m; j++) if (dist[i * m + j] < bd) { bd = dist[i * m + j]; bj = j; }
      best[i] = bj; inSet[bj] = 1;
    }
    var set = [];
    for (j = 0; j < m; j++) if (inSet[j]) set.push(j);
    k = Math.max(1, k);
    while (set.length > k) {
      var cost = new Float64Array(m);
      for (i = 0; i < n; i++) {
        var b = best[i], d2nd = Infinity;
        for (var s = 0; s < set.length; s++) {
          var c = set[s];
          if (c !== b && dist[i * m + c] < d2nd) d2nd = dist[i * m + c];
        }
        cost[b] += wt[i] * (d2nd - dist[i * m + b]);
      }
      var rm = set[0];
      for (s = 1; s < set.length; s++) if (cost[set[s]] < cost[rm] || (cost[set[s]] === cost[rm] && set[s] > rm)) rm = set[s];
      inSet[rm] = 0;
      set = set.filter(function (x) { return x !== rm; });
      for (i = 0; i < n; i++) {
        if (best[i] !== rm) continue;
        var nb = set[0], nd = Infinity;
        for (s = 0; s < set.length; s++) if (dist[i * m + set[s]] < nd) { nd = dist[i * m + set[s]]; nb = set[s]; }
        best[i] = nb;
      }
    }
    return set;
  }

  /**
   * 把像素分配到所选色（chosen = 色卡下标数组）。pixels 里为 null 的是透明格，结果为 -1。
   * dither 时用 Floyd–Steinberg（误差不跨越透明格）。返回 Int32Array，值为 chosen 中的位置。
   */
  function assignPixels(pixels, w, h, chosenRgb, dither) {
    var pl = chosenRgb.map(rgbToLab), cache = {};
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
    var out = new Int32Array(w * h), i;
    if (!dither) {
      for (i = 0; i < w * h; i++) out[i] = pixels[i] ? nearest(pixels[i]) : -1;
      return out;
    }
    var buf = pixels.map(function (p) { return p ? [p[0], p[1], p[2]] : null; });
    var spread = [[1, 0, 7 / 16], [-1, 1, 3 / 16], [0, 1, 5 / 16], [1, 1, 1 / 16]];
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var idx = y * w + x, cur = buf[idx];
        if (!cur) { out[idx] = -1; continue; }
        var cr = cur.map(function (v) { return Math.max(0, Math.min(255, Math.round(v))); });
        var b = nearest(cr);
        out[idx] = b;
        var e0 = cr[0] - chosenRgb[b][0], e1 = cr[1] - chosenRgb[b][1], e2 = cr[2] - chosenRgb[b][2];
        for (var s = 0; s < 4; s++) {
          var nx = x + spread[s][0], ny = y + spread[s][1];
          if (nx < 0 || nx >= w || ny >= h) continue;
          var t = buf[ny * w + nx];
          if (!t) continue;
          t[0] += e0 * spread[s][2]; t[1] += e1 * spread[s][2]; t[2] += e2 * spread[s][2];
        }
      }
    }
    return out;
  }

  /** 清理孤立格：四邻（不含透明格，至少 2 个）都异色的单格并入最多的邻色。返回新数组 */
  function cleanIsolated(indices, w, h) {
    var out = Int32Array.from(indices);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var me = indices[y * w + x];
        if (me < 0) continue;
        var nb = [];
        if (x > 0) nb.push(indices[y * w + x - 1]);
        if (x < w - 1) nb.push(indices[y * w + x + 1]);
        if (y > 0) nb.push(indices[(y - 1) * w + x]);
        if (y < h - 1) nb.push(indices[(y + 1) * w + x]);
        nb = nb.filter(function (v) { return v >= 0; });
        if (nb.length < 2 || nb.indexOf(me) >= 0) continue;
        var cnt = {}, bestC = -1, bc = 0;
        nb.forEach(function (v) { cnt[v] = (cnt[v] || 0) + 1; });
        Object.keys(cnt).map(Number).sort(function (a, b) { return a - b; }).forEach(function (c) {
          if (cnt[c] > bc) { bc = cnt[c]; bestC = c; }
        });
        out[y * w + x] = bestC;
      }
    }
    return out;
  }

  /** 按用量从多到少重排（-1 透明格保持 -1）。返回 {indices, order(旧下标), counts, empty} */
  function sortByCount(indices, nColors) {
    var cnt = new Array(nColors).fill(0), empty = 0, i;
    for (i = 0; i < indices.length; i++) { if (indices[i] < 0) empty++; else cnt[indices[i]]++; }
    var order = [];
    for (i = 0; i < nColors; i++) if (cnt[i] > 0) order.push(i);
    order.sort(function (a, b) { return cnt[b] - cnt[a] || a - b; });
    var map = new Int32Array(nColors).fill(-1);
    order.forEach(function (o, ni) { map[o] = ni; });
    var out = new Int32Array(indices.length);
    for (i = 0; i < indices.length; i++) out[i] = indices[i] < 0 ? -1 : map[indices[i]];
    return { indices: out, order: order, counts: order.map(function (o) { return cnt[o]; }), empty: empty };
  }

  /**
   * 完整流程。
   * rgba: 长度 w*h*4 的像素数组（Uint8ClampedArray 等）
   * card: [{code,name,hex}]；opt: {k, dither, clean, transparent}
   * 返回 {w,h, indices(-1=空), colors:[{code,name,hex,rgb}], counts, empty}
   */
  function makeChart(rgba, w, h, card, opt) {
    opt = opt || {};
    var px = new Array(w * h), opaque = [], i;
    for (i = 0; i < w * h; i++) {
      var a = rgba[i * 4 + 3];
      if (opt.transparent && a < 128) { px[i] = null; continue; }
      // 留空模式下保留原色（否则抠图边缘会被白底冲淡成一圈浅色）；不留空时半透明按白底合成
      var r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
      if (a < 255 && !opt.transparent) { var t = a / 255; r = Math.round(r * t + 255 * (1 - t)); g = Math.round(g * t + 255 * (1 - t)); b = Math.round(b * t + 255 * (1 - t)); }
      px[i] = [r, g, b]; opaque.push(px[i]);
    }
    var cardRgb = card.map(function (c) { return hexToRgb(c.hex); });
    var cardLabs = cardRgb.map(rgbToLab);
    var chosen = selectColors(opaque, cardLabs, opt.k || 12);
    var chosenRgb = chosen.map(function (j) { return cardRgb[j]; });
    var idx = assignPixels(px, w, h, chosenRgb, !!opt.dither);
    if (opt.clean) idx = cleanIsolated(idx, w, h);
    var sorted = sortByCount(idx, chosen.length);
    return {
      w: w, h: h, indices: sorted.indices, counts: sorted.counts, empty: sorted.empty,
      colors: sorted.order.map(function (o) {
        var c = card[chosen[o]];
        return { code: c.code, name: c.name, hex: c.hex, rgb: cardRgb[chosen[o]] };
      })
    };
  }

  /** 裁剪矩形。mode: 'square' 居中正方形；其他 = 原比例 */
  function cropRect(w, h, mode) {
    if (mode === 'square') {
      var s = Math.min(w, h);
      return { sx: Math.floor((w - s) / 2), sy: Math.floor((h - s) / 2), sw: s, sh: s };
    }
    return { sx: 0, sy: 0, sw: w, sh: h };
  }

  /** 按比例由列数算行数；行数超过 maxRows 时缩小列数。返回 {w,h,adjusted} */
  function chartSize(cols, sw, sh, maxRows) {
    maxRows = maxRows || 150;
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
   * 用料估算。kind: 'bead' | 'stitch'
   * 拼豆：5mm 豆，成品 w×0.5cm；29×29 方板块数；每色建议多备 5%（至少 +3 颗）。
   * 十字绣：14ct 绣布，成品 w/14 英寸；每边留 5cm；每支 DMC 25 号线按约 1500 针粗估（2 股全十字）。
   */
  function estimate(kind, w, h, counts) {
    if (kind === 'stitch') {
      var cmW = w / 14 * 2.54, cmH = h / 14 * 2.54;
      return {
        sizeCm: [cmW, cmH], fabricCm: [cmW + 10, cmH + 10],
        perColor: counts.map(function (n) { return Math.max(1, Math.ceil(n / 1500)); })
      };
    }
    return {
      sizeCm: [w * 0.5, h * 0.5], boards: Math.ceil(w / 29) * Math.ceil(h / 29),
      perColor: counts.map(function (n) { return n + Math.max(3, Math.ceil(n * 0.05)); })
    };
  }

  /**
   * iOS Safari 画布保护：把期望缩放系数压到 宽×高 ≤ maxArea 且每边 ≤ maxSide。
   * 返回 {scale, clamped, width, height}；scale ≤ wanted，宽高至少 1。非法输入按 1×1 处理。
   */
  function safeCanvasScale(w, h, wanted, maxArea, maxSide) {
    maxArea = maxArea > 0 && isFinite(maxArea) ? maxArea : 16000000; maxSide = maxSide > 0 && isFinite(maxSide) ? maxSide : 8192;
    w = w > 0 && isFinite(w) ? w : 1; h = h > 0 && isFinite(h) ? h : 1;
    var want = wanted > 0 && isFinite(wanted) ? wanted : 1;
    var s = Math.min(want, maxSide / w, maxSide / h, Math.sqrt(maxArea / (w * h)));
    var cw = Math.max(1, Math.floor(w * s)), ch = Math.max(1, Math.floor(h * s));
    while ((cw > 1 || ch > 1) && (cw * ch > maxArea || cw > maxSide || ch > maxSide)) {
      s *= 0.99; cw = Math.max(1, Math.floor(w * s)); ch = Math.max(1, Math.floor(h * s));
    }
    return { scale: s, clamped: s < want, width: cw, height: ch };
  }

  function textOn(rgb) {
    var l = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
    return l > 150 ? '#222' : '#fff';
  }

  return {
    hexToRgb: hexToRgb, rgbToLab: rgbToLab, labDist2: labDist2, SYMBOLS: SYMBOLS, symbolFor: symbolFor,
    dedupePixels: dedupePixels, selectColors: selectColors, assignPixels: assignPixels,
    cleanIsolated: cleanIsolated, sortByCount: sortByCount, makeChart: makeChart,
    cropRect: cropRect, chartSize: chartSize, estimate: estimate, safeCanvasScale: safeCanvasScale, textOn: textOn
  };
});
