(function () {
  'use strict';

  var INK, INK2, RED;
  var PALETTES = {
    paper: { ink: '#2b2622', ink2: '#6b5f50', red: '#b3261e' },
    night: { ink: '#f0e8d2', ink2: '#b4ae9c', red: '#d93d30' }
  };
  var theme = 'paper';
  function setPalette(t) {
    theme = PALETTES[t] ? t : 'paper';
    INK = PALETTES[theme].ink; INK2 = PALETTES[theme].ink2; RED = PALETTES[theme].red;
  }
  setPalette('paper');
  var FH = '"MaShan","Songti SC","STSong","Noto Serif SC",serif';
  var FB = '"Songti SC","STSong","Noto Serif SC",serif';
  var MAXBOOKS = 30;
  var LS_KEY = 'bookplate.v1';

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    year: $('year'), owner: $('owner'), list: $('list'), count: $('count'), books: $('books'),
    cv: $('cv'), status: $('status'), save: $('save'), demo: $('demo'), clear: $('clear'),
    nowm: $('nowm'), overlay: $('overlay'), ovImg: $('ov-img'), ovClose: $('ov-close'), colorRow: $('color-row')
  };

  var state = { tpl: 'plate', theme: 'paper', ratings: {}, best: -1, nowm: false };
  var plateWarn = false;
  var fontsReady = false;

  /* ---------- utils ---------- */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function cnYear(y) {
    var d = '〇一二三四五六七八九';
    return String(y).replace(/\d/g, function (c) { return d[+c]; });
  }
  function chars(s) { return Array.from(s).filter(function (c) { return !/\s/.test(c); }); }
  function parseBooks() {
    var lines = els.list.value.split(/\r?\n/), out = [], total = 0;
    lines.forEach(function (ln) {
      ln = ln.trim();
      if (!ln) return;
      total++;
      var p = ln.split(/\s*[\/／]\s*/);
      var t = (p[0] || '').replace(/[《》]/g, '').trim();
      var a = (p.slice(1).join(' ') || '').trim();
      if (!t) return;
      if (out.length < MAXBOOKS) out.push({ title: t, author: a });
    });
    return { books: out, total: total };
  }
  function fitSize(ctx, text, maxW, size, minSize, family) {
    while (size > minSize) {
      ctx.font = size + 'px ' + family;
      if (ctx.measureText(text).width <= maxW) break;
      size -= 2;
    }
    ctx.font = size + 'px ' + family;
    return size;
  }
  function wrapText(ctx, text, maxW) {
    var lines = [], cur = '';
    Array.from(text).forEach(function (ch) {
      if (ctx.measureText(cur + ch).width > maxW && cur) { lines.push(cur); cur = ch; }
      else cur += ch;
    });
    if (cur) lines.push(cur);
    return lines;
  }
  // 截断到不超过 maxW，必要时加省略号
  function truncW(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    var cs = Array.from(text);
    while (cs.length > 1 && ctx.measureText(cs.join('') + '…').width > maxW) cs.pop();
    return cs.join('') + '…';
  }
  // 竖排分词：西文/数字连续段（[A-Za-z0-9 .'-]）整体作为一个横躺单元
  function vtok(str) {
    str = String(str).replace(/\s+/g, ' ').trim();
    var out = [], re = /[A-Za-z0-9][A-Za-z0-9 .'\-]*/g, last = 0, m;
    function pushPlain(t) { Array.from(t).forEach(function (c) { if (!/\s/.test(c)) out.push({ c: c }); }); }
    while ((m = re.exec(str))) {
      pushPlain(str.slice(last, m.index));
      out.push({ w: m[0].replace(/\s+$/, '') });
      last = m.index + m[0].length;
    }
    pushPlain(str.slice(last));
    return out;
  }
  function tcells(t) { return t.w ? Math.max(1, Math.ceil(t.w.length * 0.55)) : 1; }
  function vcount(toks) { return toks.reduce(function (a, t) { return a + tcells(t); }, 0); }
  // 竖排截断：最多 maxN 格，超出则末位换成省略号
  function vtrunc(toks, maxN) {
    maxN = Math.max(1, Math.floor(maxN));
    if (vcount(toks) <= maxN) return toks;
    var out = [], used = 0, budget = Math.max(1, maxN - 1), i, t;
    for (i = 0; i < toks.length; i++) {
      t = toks[i];
      if (used + tcells(t) <= budget) { out.push(t); used += tcells(t); continue; }
      if (t.w && budget - used >= 1) {
        var n = Math.max(1, Math.floor((budget - used) / 0.55));
        out.push({ w: t.w.slice(0, n).replace(/\s+$/, '') });
      }
      break;
    }
    out.push({ c: '…' });
    return out;
  }
  // Canvas 自绘五角星
  function drawStar(ctx, cx, cy, R, filled, color) {
    var r = R * 0.42, i, a;
    ctx.save();
    ctx.beginPath();
    for (i = 0; i < 10; i++) {
      a = -Math.PI / 2 + i * Math.PI / 5;
      var rad = i % 2 ? r : R;
      ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.lineJoin = 'round';
    if (filled) { ctx.fillStyle = color; ctx.fill(); }
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, R * 0.12); ctx.stroke();
    ctx.restore();
  }
  function mk(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  /* ---------- paper texture ---------- */
  var paperCache = {};
  function makePaper(w, h, th) {
    th = th || 'paper';
    var night = th === 'night';
    var key = th + w + 'x' + h;
    if (paperCache[key]) return paperCache[key];
    var c = mk(w, h), g = c.getContext('2d'), r = rng(w * 31 + h);
    var gr = g.createLinearGradient(0, 0, w * 0.6, h);
    if (night) { gr.addColorStop(0, '#22315a'); gr.addColorStop(0.5, '#1a2748'); gr.addColorStop(1, '#131d38'); }
    else { gr.addColorStop(0, '#f7eed6'); gr.addColorStop(0.5, '#f0e3c0'); gr.addColorStop(1, '#e8d8ad'); }
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    // blotchy stains
    for (var i = 0; i < 14; i++) {
      var x = r() * w, y = r() * h, rad = 80 + r() * 260;
      var rg = g.createRadialGradient(x, y, 0, x, y, rad);
      var sc0 = night ? '130,150,210,' : '150,110,50,';
      rg.addColorStop(0, 'rgba(' + sc0 + (0.04 + r() * 0.05) + ')');
      rg.addColorStop(1, 'rgba(' + sc0 + '0)');
      g.fillStyle = rg; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // noise
    var id = g.getImageData(0, 0, w, h), d = id.data;
    for (var p = 0; p < d.length; p += 4) {
      var n = (r() - 0.5) * 20;
      d[p] += n; d[p + 1] += n; d[p + 2] += n * 1.2;
    }
    g.putImageData(id, 0, 0);
    // fibres
    g.lineWidth = 1;
    for (var k = 0; k < Math.round(w * h / 3500); k++) {
      var fx = r() * w, fy = r() * h, a = r() * Math.PI * 2, len = 6 + r() * 22;
      g.strokeStyle = night ? 'rgba(190,200,235,' + (0.03 + r() * 0.05) + ')' : 'rgba(120,90,40,' + (0.04 + r() * 0.07) + ')';
      g.beginPath(); g.moveTo(fx, fy);
      g.quadraticCurveTo(fx + Math.cos(a) * len * 0.5 + r() * 4, fy + Math.sin(a) * len * 0.5 + r() * 4,
        fx + Math.cos(a) * len, fy + Math.sin(a) * len);
      g.stroke();
    }
    // vignette
    var m = Math.max(w, h);
    var vg = g.createRadialGradient(w / 2, h / 2, m * 0.3, w / 2, h / 2, m * 0.78);
    var vc = night ? '4,8,24,' : '110,70,20,';
    vg.addColorStop(0, 'rgba(' + vc + '0)'); vg.addColorStop(1, 'rgba(' + vc + (night ? '0.5' : '0.38') + ')');
    g.fillStyle = vg; g.fillRect(0, 0, w, h);
    // edge darkening
    var eg = [[0, 0, 0, 40], [0, h, 0, h - 40], [0, 0, 40, 0], [w, 0, w - 40, 0]];
    eg.forEach(function (e) {
      var l = g.createLinearGradient(e[0], e[1], e[2], e[3]);
      var ec = night ? '4,8,24,' : '100,60,15,';
      l.addColorStop(0, 'rgba(' + ec + '0.22)'); l.addColorStop(1, 'rgba(' + ec + '0)');
      g.fillStyle = l; g.fillRect(0, 0, w, h);
    });
    paperCache[key] = c;
    return c;
  }

  /* ---------- seal (朱文, aged) ---------- */
  function makeSeal(cs, base, seed) {
    var n = cs.length, rows = n <= 2 ? 2 : (n <= 4 ? 2 : 3), cols = n <= 2 ? 1 : 2;
    var W = cols === 1 ? Math.round(base * 0.56) : base;
    var H = rows === 3 ? Math.round(base * 1.4) : base;
    var c = mk(W, H), g = c.getContext('2d'), r = rng(seed);
    var bw = Math.max(6, base * 0.045);
    g.strokeStyle = RED; g.lineWidth = bw;
    g.strokeRect(bw / 2, bw / 2, W - bw, H - bw);
    g.lineWidth = Math.max(1.5, bw * 0.25);
    g.strokeRect(bw * 1.7, bw * 1.7, W - bw * 3.4, H - bw * 3.4);
    var padd = bw * 2.4, cw = (W - padd * 2) / cols, ch = (H - padd * 2) / rows;
    if (n === 3) { // 右列一个大字（人名），左列上下两字
      var iw = W - padd * 2, ih = H - padd * 2, rw = iw * 0.56, lw = iw - rw;
      var bf = Math.min(rw, ih) * 0.86, sf = Math.min(lw, ih / 2) * 0.86;
      g.fillStyle = RED; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = bf + 'px ' + FH; g.fillText(cs[0], W - padd - rw / 2, H / 2 + bf * 0.04);
      g.font = sf + 'px ' + FH;
      g.fillText(cs[1], padd + lw / 2, padd + ih / 4 + sf * 0.04);
      g.fillText(cs[2], padd + lw / 2, padd + ih * 3 / 4 + sf * 0.04);
      cs = [];
    }
    var fs = Math.min(cw, ch) * 0.86;
    g.fillStyle = RED; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = fs + 'px ' + FH;
    cs.forEach(function (chh, i) {
      var col = Math.floor(i / rows), row = i % rows;
      var cx = W - padd - cw * (col + 0.5), cy = padd + ch * (row + 0.5);
      g.fillText(chh, cx, cy + fs * 0.04);
    });
    // weathering
    g.globalCompositeOperation = 'destination-out';
    var area = W * H;
    for (var i = 0; i < area / 55; i++) {
      g.fillStyle = 'rgba(0,0,0,' + (0.25 + r() * 0.75) + ')';
      g.beginPath(); g.arc(r() * W, r() * H, 0.4 + r() * 2.2, 0, 7); g.fill();
    }
    for (var j = 0; j < 22; j++) {
      g.fillStyle = 'rgba(0,0,0,' + (0.35 + r() * 0.5) + ')';
      var bx = r() * W, by = r() * H, br = 3 + r() * base * 0.07;
      g.beginPath(); g.ellipse(bx, by, br, br * (0.5 + r()), r() * 3, 0, 7); g.fill();
    }
    for (var k = 0; k < 90; k++) { // eroded edge
      var side = r() * 4 | 0, t = r();
      var ex = side === 0 ? t * W : side === 1 ? W : side === 2 ? t * W : 0;
      var ey = side === 0 ? 0 : side === 1 ? t * H : side === 2 ? H : t * H;
      g.fillStyle = 'rgba(0,0,0,0.9)';
      g.beginPath(); g.arc(ex, ey, 1 + r() * 4, 0, 7); g.fill();
    }
    return c;
  }
  function stampSeal(ctx, seal, cx, cy, rot) {
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(rot);
    ctx.globalCompositeOperation = theme === 'night' ? 'source-over' : 'multiply';
    ctx.globalAlpha = 0.9;
    ctx.drawImage(seal, -seal.width / 2, -seal.height / 2);
    ctx.restore();
  }

  /* ---------- 藏书票 ---------- */
  function corner(ctx, x, y, sx, sy) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(sx, sy);
    ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 58, 0, Math.PI / 2); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI / 2); ctx.stroke();
    ctx.fillRect(-12, -12, 24, 24);
    ctx.fillStyle = RED;
    ctx.beginPath(); ctx.moveTo(30, 30); ctx.lineTo(38, 38); ctx.lineTo(30, 46); ctx.lineTo(22, 38); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(72, 12, 4, 0, 7); ctx.arc(12, 72, 4, 0, 7); ctx.fill();
    ctx.restore();
  }
  function divider(ctx, cx, y, w) {
    ctx.save();
    ctx.strokeStyle = INK; ctx.fillStyle = RED; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - w / 2, y); ctx.lineTo(cx - 18, y); ctx.moveTo(cx + 18, y); ctx.lineTo(cx + w / 2, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, y - 9); ctx.lineTo(cx + 9, y); ctx.lineTo(cx, y + 9); ctx.lineTo(cx - 9, y); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  var V_DOT = /^[·・•‧.]$/, V_ROT = /^[—―–－\-～~…《》〈〉「」『』（）()［］\[\]【】〔〕{}<>:：;；]$/, V_CORNER = /^[，。、,]$/;
  function vtext(ctx, toks, x, y, fs, step) {
    step = step || fs * 1.06;
    var oa = ctx.textAlign, ob = ctx.textBaseline, pos = 0;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    toks.forEach(function (t) {
      var span = tcells(t) * step, cy = y + pos + step / 2;
      pos += span;
      if (t.w) {
        var w = ctx.measureText(t.w).width, k = w > span * 0.96 ? span * 0.96 / w : 1;
        ctx.save(); ctx.translate(x, y + pos - span / 2); ctx.rotate(Math.PI / 2); ctx.scale(k, k);
        ctx.fillText(t.w, 0, fs * 0.03); ctx.restore();
        return;
      }
      var c = t.c;
      if (V_DOT.test(c)) {
        ctx.beginPath(); ctx.arc(x, cy, Math.max(1.5, fs * 0.07), 0, 7); ctx.fill();
      } else if (V_ROT.test(c)) {
        ctx.save(); ctx.translate(x, cy); ctx.rotate(Math.PI / 2); ctx.fillText(c, 0, 0); ctx.restore();
      } else if (V_CORNER.test(c)) {
        ctx.fillText(c, x + fs * 0.32, cy - fs * 0.32);
      } else ctx.fillText(c, x, cy + fs * 0.03);
    });
    ctx.textAlign = oa; ctx.textBaseline = ob;
  }
  function watermark(ctx, x, y) {
    ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = INK2; ctx.font = '22px ' + FB;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('xiaomei-tools · 藏书票', x, y); ctx.restore();
  }

  function drawPlate(data) {
    setPalette(data.theme);
    var W = 1242, H = 1656, cv = els.cv;
    cv.width = W; cv.height = H;
    var ctx = cv.getContext('2d');
    ctx.drawImage(makePaper(W, H, theme), 0, 0);

    // frame
    ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.strokeRect(60, 60, W - 120, H - 120);
    ctx.lineWidth = 2.5; ctx.strokeRect(86, 86, W - 172, H - 172);
    corner(ctx, 86, 86, 1, 1); corner(ctx, W - 86, 86, -1, 1);
    corner(ctx, 86, H - 86, 1, -1); corner(ctx, W - 86, H - 86, -1, -1);

    var cx = W / 2, name = data.owner, cn = cnYear(data.year);
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var y = 235, HEADW = 820, hs, ht;
    if (name) {
      // 藏书人过长：先缩字，再截断人名
      var nc = Array.from(name);
      ctx.font = '80px ' + FH;
      while (nc.length > 1 && ctx.measureText(nc.join('') + (nc.length < Array.from(name).length ? '…' : '') + '藏书').width > HEADW) nc.pop();
      ht = nc.join('') + (nc.length < Array.from(name).length ? '…' : '') + '藏书';
      hs = fitSize(ctx, ht, HEADW, 190, 80, FH);
      ctx.fillText(ht, cx, y);
      ctx.fillStyle = RED;
      ctx.font = '50px ' + FH;
      ctx.fillText(cn + ' 读书记', cx, y + 125);
      y += 190;
    } else {
      fitSize(ctx, cn + ' 读书记', HEADW, 170, 80, FH);
      ctx.fillText(cn + ' 读书记', cx, y);
      y += 100;
    }
    divider(ctx, cx, y + 20, 640);
    var top = y + 70;

    // seal（先造，以便给书单让出底部）
    var sc = name ? chars(name).slice(0, 4).concat(['藏', '书']) : ['藏', '书', '之', '印'];
    plateWarn = false;
    var seal = makeSeal(sc, 200, 7 + sc.length);
    var sealBottom = 1535, sealCy = sealBottom - seal.height / 2;

    // year book
    var list = data.books.filter(function (b, i) { return i !== data.best; });
    var yb = data.books[data.best];
    if (yb) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = RED; ctx.font = '34px ' + FH;
      ctx.fillText('年度之书', cx, top + 20);
      ctx.strokeStyle = RED; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx - 200, top + 20); ctx.lineTo(cx - 100, top + 20);
      ctx.moveTo(cx + 100, top + 20); ctx.lineTo(cx + 200, top + 20); ctx.stroke();
      ctx.fillStyle = INK;
      var full = '《' + yb.title + '》', TW = 780, tsz, tl;
      for (tsz = 120; tsz >= 44; tsz -= 2) {
        ctx.font = tsz + 'px ' + FH;
        tl = wrapText(ctx, full, TW);
        if (tl.length <= (tsz > 76 ? 1 : 2)) break;
      }
      if (tl.length > 2) { tl = [tl[0], truncW(ctx, tl.slice(1).join(''), TW)]; }
      else if (tl.length === 2 && tsz <= 44) tl = [tl[0], truncW(ctx, tl[1], TW)];
      var lh = tsz * 1.2, ty0 = top + 52 + tsz * 0.6;
      ctx.font = tsz + 'px ' + FH;
      tl.forEach(function (l, k) { ctx.fillText(l, cx, ty0 + k * lh); });
      var gb = ty0 + (tl.length - 1) * lh + tsz * 0.5, nextTop;
      if (yb.author) {
        ctx.fillStyle = INK2; ctx.font = '38px ' + FB;
        var at = truncW(ctx, yb.author + ' 著', 760);
        ctx.fillText(at, cx, gb + 52);
        nextTop = gb + 52 + 19 + 34;
      } else nextTop = gb + 36;
      top = nextTop + 12;
      divider(ctx, cx, top - 12, 360);
      top += 20;
    }

    // list
    var areaTop = top, areaBottom = sealCy - seal.height / 2 - 26, areaW = W - 2 * 170;
    var n = list.length;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (n) {
      var areaH = Math.max(120, areaBottom - areaTop), maxLen = 1, hasAuthor = false;
      list.forEach(function (b) {
        maxLen = Math.max(maxLen, vcount(vtok(b.title)));
        if (b.author) hasAuthor = true;
      });
      var dense = n > 12, Leff = Math.min(maxLen, dense ? 7 : 8), shrink = dense ? 1 : 0.72;
      function plan(uf) {
        var bst = null;
        for (var bands = 1; bands <= 5; bands++) {
          var gap = bands > 2 ? 28 : 40, Hb = (areaH - (bands - 1) * gap) / bands;
          var per = Math.ceil(n / bands);
          var f = Math.min(84, areaW / (per * uf), Hb / (Leff * 1.06));
          if (!bst || f > bst.fs * 1.08) bst = { bands: bands, fs: f, Hb: Hb, per: per, gap: gap, uf: uf };
        }
        return bst;
      }
      var best = plan(hasAuthor ? 2 : 1.35), showAuthor = hasAuthor;
      if (hasAuthor) { // 太挤时舍去作者列，保证书名可读
        var bn = plan(1.35);
        if (best.fs < bn.fs * 0.75 || (best.fs < 26 && bn.fs > best.fs)) { best = bn; showAuthor = false; }
      }
      if (best.fs < 26) plateWarn = true;
      var fs0 = Math.floor(best.fs);
      for (var i = 0; i < n; i++) {
        var band = Math.floor(i / best.per), idx = i % best.per;
        var inBand = Math.min(best.per, n - band * best.per);
        var unit = fs0 * best.uf, total = inBand * unit;
        var R = cx + total / 2 - idx * unit;
        var bTop = areaTop + band * (best.Hb + best.gap);
        var b = list[i], tc;
        // 书名：最多 0.72 倍字号所能容纳的字数，再多就截断
        tc = vtrunc(vtok(b.title), best.Hb / (fs0 * shrink * 1.06));
        var tfs = Math.min(fs0, best.Hb / (vcount(tc) * 1.06));
        var tx = showAuthor ? R - fs0 * 0.6 : R - unit / 2;
        ctx.fillStyle = INK; ctx.font = tfs + 'px ' + FH;
        vtext(ctx, tc, tx, bTop, tfs);
        if (b.author && showAuthor) {
          var availA = best.Hb - fs0 * 0.9;
          var ac = vtrunc(vtok(b.author), availA / (fs0 * 0.3 * 1.12));
          var afs = Math.min(fs0 * 0.5, availA / (vcount(ac) * 1.12));
          ctx.fillStyle = INK2; ctx.font = afs + 'px ' + FB;
          vtext(ctx, ac, R - fs0 * 1.5, bTop + fs0 * 0.9, afs, afs * 1.12);
        }
        // faint column rule
        if (idx < inBand - 1) {
          ctx.strokeStyle = theme === 'night' ? 'rgba(180,174,156,0.28)' : 'rgba(107,95,80,0.28)'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(R - unit, bTop + 6); ctx.lineTo(R - unit, bTop + best.Hb - 6); ctx.stroke();
        }
      }
    }
    if (!n && !yb) {
      ctx.fillStyle = INK2; ctx.font = '44px ' + FH;
      ctx.fillText('书单尚空，待君落笔', cx, 760);
    }

    stampSeal(ctx, seal, cx, sealCy, -0.04);
    ctx.fillStyle = INK2; ctx.font = '26px ' + FB; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('共 ' + data.books.length + ' 种', cx - 250, 1470);
    ctx.fillText(cn + ' 年', cx + 250, 1470);
    if (data.wm) watermark(ctx, cx, H - 30);
  }

  /* ---------- 书单小票 ---------- */
  var RW = 1080, RPAD = 80, BAND = 36;
  function drawStars(ctx, n, rightX, cy) {
    var R = 14, gap = 35, i;
    for (i = 0; i < 5; i++) drawStar(ctx, rightX - R - (4 - i) * gap, cy, R, i < n, RED);
  }
  function drawReceiptBody(ctx, data, dry, S, shown) {
    S = S || 1; shown = shown == null ? data.books.length : shown;
    var y = 70, cx = RW / 2, name = data.owner;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'center'; ctx.fillStyle = INK;
    var shop = (name || '无名') + '书肆';
    ctx.font = '60px ' + FH;
    if (ctx.measureText(shop).width > RW - 2 * RPAD) {
      var sn = Array.from(name);
      while (sn.length > 1 && ctx.measureText(sn.join('') + '…书肆').width > RW - 2 * RPAD) sn.pop();
      shop = sn.join('') + '…书肆';
    }
    fitSize(ctx, shop, RW - 2 * RPAD, 130, 60, FH);
    ctx.fillText(shop, cx, y + 110);
    y += 150;
    ctx.fillStyle = INK2; ctx.font = '30px ' + FB;
    ctx.fillText('— ' + cnYear(data.year) + ' 年 · 购读清单 —', cx, y + 30);
    y += 70;
    function dash(yy, col) {
      ctx.save(); ctx.strokeStyle = col || INK2; ctx.lineWidth = 2.5; ctx.setLineDash([14, 9]);
      ctx.beginPath(); ctx.moveTo(RPAD, yy); ctx.lineTo(RW - RPAD, yy); ctx.stroke(); ctx.restore();
    }
    dash(y);
    y += 20;
    ctx.textAlign = 'left'; ctx.fillStyle = INK2; ctx.font = '28px ' + FB;
    ctx.fillText('序', RPAD, y + 30); ctx.fillText('书名 / 作者', RPAD + 90, y + 30);
    ctx.textAlign = 'right'; ctx.fillText('评', RW - RPAD, y + 30);
    y += 52;
    dash(y, INK); y += 14;

    var books = data.books, sum = 0, cntR = 0;
    books.forEach(function (b, i) {
      var r = data.ratings[i] || 0;
      if (r) { sum += r; cntR++; }
    });
    books.slice(0, shown).forEach(function (b, i) {
      var r = data.ratings[i] || 0;
      var isBest = i === data.best;
      ctx.font = 38 * S + 'px ' + FB;
      var lines = wrapText(ctx, b.title, RW - 2 * RPAD - 90 - 190);
      if (lines.length > 2) lines = [lines[0], truncW(ctx, lines.slice(1).join(''), RW - 2 * RPAD - 90 - 190)];
      var rowTop = y + 14 * S;
      ctx.textAlign = 'left'; ctx.fillStyle = INK2; ctx.font = 30 * S + 'px ' + FB;
      ctx.fillText((i < 9 ? '0' : '') + (i + 1), RPAD, rowTop + 34 * S);
      ctx.fillStyle = INK; ctx.font = 38 * S + 'px ' + FB;
      lines.forEach(function (l, k) { ctx.fillText(l, RPAD + 90, rowTop + 38 * S + k * 48 * S); });
      var ly = rowTop + 38 * S + (lines.length - 1) * 48 * S;
      if (r) {
        drawStars(ctx, r, RW - RPAD, rowTop + 24 * S);
      }
      var sub = b.author ? '著 · ' + b.author : '';
      if (sub) {
        ctx.font = 28 * S + 'px ' + FB;
        var sw = isBest ? 660 : RW - 2 * RPAD - 90;
        var sl = [truncW(ctx, sub, sw)];
        sl.forEach(function (l) {
          ly += 38 * S; ctx.textAlign = 'left'; ctx.fillStyle = INK2; ctx.font = 28 * S + 'px ' + FB;
          ctx.fillText(l, RPAD + 90, ly);
        });
      }
      if (isBest) {
        if (!sub) ly += 38 * S;
        var tw = 150, th = 38, tx = RW - RPAD - tw, ty = ly - 29 * S;
        ctx.save(); ctx.strokeStyle = RED; ctx.lineWidth = 2.5; ctx.strokeRect(tx, ty, tw, th);
        ctx.fillStyle = RED; ctx.textAlign = 'center'; ctx.font = '26px ' + FH;
        ctx.fillText('年度之书', tx + tw / 2, ty + 28); ctx.restore();
      }
      y = ly + 26 * S;
      if (i < shown - 1) {
        ctx.save(); ctx.strokeStyle = 'rgba(107,95,80,0.35)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 7]);
        ctx.beginPath(); ctx.moveTo(RPAD + 90, y); ctx.lineTo(RW - RPAD, y); ctx.stroke(); ctx.restore();
      }
    });
    if (shown < books.length) {
      ctx.textAlign = 'left'; ctx.fillStyle = INK2; ctx.font = '34px ' + FB;
      ctx.fillText('……共 ' + books.length + ' 本', RPAD + 90, y + 44); y += 62;
    }
    if (!books.length) {
      ctx.textAlign = 'center'; ctx.fillStyle = INK2; ctx.font = '34px ' + FB;
      ctx.fillText('尚无购书记录', cx, y + 60); y += 90;
    }
    y += 6; dash(y, INK); y += 20;

    ctx.textAlign = 'left'; ctx.fillStyle = INK; ctx.font = '40px ' + FB;
    function kv(k, v, red) {
      ctx.textAlign = 'left'; ctx.fillStyle = INK; ctx.font = '36px ' + FB; ctx.fillText(k, RPAD, y + 44);
      ctx.textAlign = 'right'; ctx.fillStyle = red ? RED : INK; ctx.fillText(v, RW - RPAD, y + 44);
      y += 58;
    }
    kv('共读', books.length + ' 本', true);
    if (cntR) kv('均评', (sum / cntR).toFixed(1) + ' 星');
    if (books[data.best]) {
      ctx.font = '36px ' + FB;
      var bw = RW - 2 * RPAD - 190;
      var bl = wrapText(ctx, '《' + books[data.best].title + '》', bw);
      if (bl.length > 2) bl = [bl[0], truncW(ctx, bl.slice(1).join(''), bw)];
      ctx.textAlign = 'left'; ctx.fillStyle = INK; ctx.fillText('年度之书', RPAD, y + 44);
      ctx.textAlign = 'right'; ctx.fillStyle = RED;
      bl.forEach(function (l, k) { ctx.fillText(l, RW - RPAD, y + 44 + k * 46); });
      y += 58 + (bl.length - 1) * 46;
    }
    var d = new Date();
    kv('日期', d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日');
    kv('经手', name || '—');
    y += 10;
    dash(y); y += 30;

    var sealTop = y;
    ctx.textAlign = 'left'; ctx.fillStyle = INK2; ctx.font = '28px ' + FB;
    ctx.fillText('书不负人 · 人莫负书', RPAD, sealTop + 70);
    ctx.fillText('概不赊欠，恕不退换', RPAD, sealTop + 116);
    ctx.fillText('多谢惠顾', RPAD, sealTop + 162);
    var sh = 190;
    if (!dry) {
      var seal = makeSeal(chars(name || '某').slice(0, 2).concat(['书', '肆']), 170, 21);
      sh = seal.height + 20;
      stampSeal(ctx, seal, RW - RPAD - seal.width / 2 - 10, sealTop + seal.height / 2 + 10, 0.05);
    } else sh = 190;
    y = sealTop + Math.max(sh, 190) + 20;
    dash(y); y += 40;
    if (data.wm) {
      ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = INK2; ctx.font = '22px ' + FB;
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('xiaomei-tools · 藏书票', cx, y + 4); ctx.restore();
      y += 40;
    }
    return y;
  }

  function zig(ctx, y0, down) {
    var step = 24, amp = 10;
    ctx.moveTo(0, y0);
    for (var x = 0; x <= RW; x += step) {
      ctx.lineTo(x + step / 2, y0 + (down ? amp : -amp));
      ctx.lineTo(x + step, y0);
    }
  }
  function drawReceipt(data) {
    setPalette('paper');
    var tmp = mk(4, 4).getContext('2d');
    var CAP = 8000 - BAND * 2, S = 1, shown = data.books.length;
    var h = Math.round(drawReceiptBody(tmp, data, true, S, shown));
    var steps = [0.9, 0.8, 0.7];
    for (var si = 0; h > CAP && si < steps.length; si++) {
      S = steps[si]; h = Math.round(drawReceiptBody(tmp, data, true, S, shown));
    }
    if (h > CAP) {
      var lo = 0, hi = shown;
      while (lo < hi) { // 二分：保留尽量多的书目
        var mid = Math.ceil((lo + hi) / 2);
        if (Math.round(drawReceiptBody(tmp, data, true, S, mid)) <= CAP) lo = mid; else hi = mid - 1;
      }
      shown = lo; h = Math.round(drawReceiptBody(tmp, data, true, S, shown));
    }
    var H = h + BAND * 2, cv = els.cv;
    cv.width = RW; cv.height = H;
    var ctx = cv.getContext('2d');
    setPalette('paper');
    ctx.fillStyle = '#d6c8a4'; ctx.fillRect(0, 0, RW, H);
    // paper path with torn edges
    ctx.save();
    ctx.beginPath();
    zig(ctx, BAND, false);
    ctx.lineTo(RW, H - BAND);
    // bottom edge, right to left
    for (var x = RW; x >= 0; x -= 24) {
      ctx.lineTo(x - 12, H - BAND + 10);
      ctx.lineTo(x - 24, H - BAND);
    }
    ctx.closePath();
    ctx.shadowColor = 'rgba(60,40,10,0.4)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#efe2bf'; ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.clip();
    ctx.drawImage(makePaper(RW, h + 40, 'paper'), 0, BAND - 10);
    ctx.translate(0, BAND);
    drawReceiptBody(ctx, data, false, S, shown);
    ctx.restore();
  }

  /* ---------- render pipeline ---------- */
  var timer = 0, token = 0;
  function collect() {
    var p = parseBooks();
    var y = parseInt(els.year.value, 10);
    if (!(y >= 1000 && y <= 9999)) y = new Date().getFullYear();
    return {
      year: y, owner: els.owner.value.trim().replace(/\s+/g, ''), books: p.books, total: p.total, theme: state.theme,
      ratings: state.ratings, best: state.best, wm: !state.nowm
    };
  }
  function render() {
    var my = ++token, data = collect();
    var go = function () {
      if (my !== token) return;
      try {
        if (state.tpl === 'plate') drawPlate(data); else drawReceipt(data);
        els.status.textContent = '预览已生成（' + els.cv.width + '×' + els.cv.height + '）' +
          (state.tpl === 'plate' && plateWarn ? '。书目较多，建议用「书单小票」样式' : '');
        els.cv.setAttribute('aria-label', (state.tpl === 'plate' ? '藏书票' : '书单小票') + '预览，共 ' + data.books.length + ' 本');
      } catch (e) {
        els.status.textContent = '生成失败：' + e.message;
      }
    };
    if (fontsReady) { go(); return null; }
    return loadFonts().then(function () { fontsReady = true; go(); });
  }
  function loadFonts() {
    var txt = '藏书年度之读书记一二三四五六七八九〇肆印某购读清单';
    var tasks = [];
    try {
      tasks.push(document.fonts.load('48px MaShan', txt));
      tasks.push(document.fonts.load('48px MaShan', ''));
    } catch (e) {}
    return Promise.all(tasks).catch(function () {}).then(function () {
      return document.fonts && document.fonts.ready ? document.fonts.ready : null;
    }).catch(function () {});
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(render, 150); }
  var rowTimer = 0;
  function scheduleInput() {
    clearTimeout(rowTimer); clearTimeout(timer);
    rowTimer = setTimeout(function () { buildRows(); render(); }, 150);
  }

  /* ---------- book rows ---------- */
  function buildRows() {
    var p = parseBooks(), box = els.books;
    Object.keys(state.ratings).forEach(function (k) { if (!(+k < p.books.length)) delete state.ratings[k]; });
    if (!(state.best >= 0 && state.best < p.books.length)) state.best = -1;
    els.count.className = 'hint' + (p.total > MAXBOOKS ? ' warn' : '');
    els.count.textContent = p.total ? ('已录入 ' + Math.min(p.total, MAXBOOKS) + ' 本' +
      (p.total > MAXBOOKS ? '，超出 ' + MAXBOOKS + ' 本的部分已忽略' : '')) : '';
    box.textContent = '';
    if (!p.books.length) {
      var e = document.createElement('p'); e.className = 'empty';
      e.textContent = '填入书单后，这里会列出每本书。'; box.appendChild(e); return;
    }
    p.books.forEach(function (b, i) {
      var row = document.createElement('div'); row.className = 'brow';
      var t = document.createElement('div'); t.className = 't';
      t.textContent = (i + 1) + '. ' + b.title; row.appendChild(t);
      var st = document.createElement('div'); st.className = 'stars'; st.setAttribute('role', 'group'); st.setAttribute('aria-label', '《' + b.title + '》评星');
      var cur = state.ratings[i] || 0;
      for (var s = 1; s <= 5; s++) (function (s) {
        var bt = document.createElement('button');
        bt.type = 'button'; bt.textContent = '★'; bt.setAttribute('aria-label', '《' + b.title + '》评 ' + s + ' 星');
        bt.setAttribute('aria-pressed', s <= cur ? 'true' : 'false'); bt.title = s + ' 星';
        if (s <= cur) bt.className = 'on';
        bt.addEventListener('click', function () {
          if (state.ratings[i] === s) delete state.ratings[i]; else state.ratings[i] = s;
          buildRows(); persist(); schedule();
        });
        st.appendChild(bt);
      })(s);
      row.appendChild(st);
      var lb = document.createElement('label'); lb.className = 'best';
      var rd = document.createElement('input'); rd.type = 'checkbox'; rd.checked = state.best === i;
      rd.setAttribute('aria-label', '设《' + b.title + '》为年度之书');
      rd.addEventListener('change', function () {
        state.best = rd.checked ? i : -1;
        buildRows(); persist(); schedule();
      });
      lb.appendChild(rd); lb.appendChild(document.createTextNode('年度'));
      row.appendChild(lb);
      box.appendChild(row);
    });
  }

  /* ---------- persistence ---------- */
  function persist() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        year: els.year.value, owner: els.owner.value, list: els.list.value,
        tpl: state.tpl, theme: state.theme, ratings: state.ratings, best: state.best, nowm: state.nowm, rv: 2
      }));
    } catch (e) {}
  }
  function restore() {
    try {
      var s = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      if (!s) return;
      if (s.year) els.year.value = s.year;
      els.owner.value = s.owner || '';
      els.list.value = s.list || '';
      state.tpl = s.tpl === 'receipt' ? 'receipt' : 'plate';
      state.theme = s.theme === 'night' ? 'night' : 'paper';
      state.nowm = !!s.nowm;
      if (s.rv === 2) {
        state.ratings = s.ratings || {};
        state.best = typeof s.best === 'number' ? s.best : -1;
      } else { // 旧数据以书名为键：按首个同名行迁移
        var tl = parseBooks().books.map(function (b) { return b.title; });
        state.ratings = {};
        Object.keys(s.ratings || {}).forEach(function (k) { var ix = tl.indexOf(k); if (ix >= 0) state.ratings[ix] = s.ratings[k]; });
        state.best = s.best ? tl.indexOf(s.best) : -1;
      }
    } catch (e) {}
  }
  function syncTabs() {
    document.querySelectorAll('.seg button[data-tpl]').forEach(function (b) {
      var on = b.getAttribute('data-tpl') === state.tpl;
      b.className = on ? 'on' : ''; b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    document.querySelectorAll('.seg button[data-theme]').forEach(function (b) {
      var on = b.getAttribute('data-theme') === state.theme;
      b.className = on ? 'on' : ''; b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    els.colorRow.hidden = state.tpl !== 'plate';
    els.nowm.checked = state.nowm;
  }
  function changed() { persist(); scheduleInput(); }

  /* ---------- events ---------- */
  ['year', 'owner', 'list'].forEach(function (k) { els[k].addEventListener('input', changed); });
  document.querySelectorAll('.seg button[data-tpl]').forEach(function (b) {
    b.addEventListener('click', function () {
      state.tpl = b.getAttribute('data-tpl'); syncTabs(); persist(); render();
    });
  });
  document.querySelectorAll('.seg button[data-theme]').forEach(function (b) {
    b.addEventListener('click', function () {
      state.theme = b.getAttribute('data-theme'); syncTabs(); persist(); render();
    });
  });
  els.nowm.addEventListener('change', function () { state.nowm = els.nowm.checked; persist(); render(); });
  els.demo.addEventListener('click', function () {
    els.list.value = ['红楼梦 / 曹雪芹', '西游记 / 吴承恩', '三国演义 / 罗贯中', '水浒传 / 施耐庵', '呐喊 / 鲁迅', '浮生六记 / 沈复'].join('\n');
    if (!els.owner.value.trim()) els.owner.value = '小美';
    state.ratings = { 0: 5, 1: 4, 2: 4, 3: 3, 4: 5, 5: 4 };
    state.best = 0;
    buildRows(); persist(); render();
  });
  els.clear.addEventListener('click', function () {
    els.list.value = ''; state.ratings = {}; state.best = -1; buildRows(); persist(); render();
  });
  var saving = false;
  function setSaving(btn, v) {
    saving = v; btn.disabled = v; btn.textContent = v ? '正在生成……' : '保存图片';
  }
  function fallbackSave(canvas, blob, fname) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = fname;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 10000);
    els.ovImg.src = canvas.toDataURL('image/png');
    els.overlay.hidden = false;
    try { els.ovClose.focus(); } catch (e) {}
  }
  function saveCanvas(canvas, filename, btn) {
    if (saving) return;
    if (!canvas.toBlob) { els.status.textContent = '此浏览器不支持保存，请截图。'; return; }
    setSaving(btn, true);
    clearTimeout(rowTimer); clearTimeout(timer);
    var blobRef = null;
    new Promise(function (resolve) {
      buildRows();
      resolve(render()); // 字体已就绪时同步绘制完成
    }).then(function () {
      return new Promise(function (resolve) { canvas.toBlob(resolve, 'image/png'); });
    }).then(function (blob) {
      if (!blob) throw new Error('导出失败，请重试。');
      blobRef = blob;
      var file = null;
      try { file = new File([blob], filename, { type: 'image/png' }); } catch (e) {}
      var canShare = false;
      try {
        canShare = !!(file && window.matchMedia && matchMedia('(pointer:coarse)').matches &&
          navigator.share && navigator.canShare && navigator.canShare({ files: [file] }));
      } catch (e) {}
      if (!canShare) { fallbackSave(canvas, blob, filename); return; }
      var tm;
      var timeout = new Promise(function (_, rej) { tm = setTimeout(function () { rej(new Error('share timeout')); }, 8000); });
      return Promise.race([navigator.share({ files: [file], title: filename.replace('.png', '') }), timeout]).then(function () {
        clearTimeout(tm); els.status.textContent = '已交给系统分享。';
      }, function (e) {
        clearTimeout(tm);
        if (e && e.name === 'AbortError') return;
        fallbackSave(canvas, blob, filename);
      });
    }).catch(function (e) {
      els.status.textContent = (e && e.message) || '保存失败';
    }).finally(function () { setSaving(btn, false); });
  }
  els.save.addEventListener('click', function () {
    saveCanvas(els.cv, (state.tpl === 'plate' ? '藏书票-' : '书单小票-') + collect().year + '.png', els.save);
  });
  function closeOv() {
    els.overlay.hidden = true; els.ovImg.removeAttribute('src');
    try { els.save.focus(); } catch (e) {}
  }
  els.ovClose.addEventListener('click', closeOv);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeOv(); });

  /* ---------- init ---------- */
  els.year.value = new Date().getFullYear();
  restore();
  syncTabs();
  buildRows();
  render();
})();
