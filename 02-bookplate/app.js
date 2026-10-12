(function () {
  'use strict';

  var INK = '#2b2622', INK2 = '#6b5f50', RED = '#b3261e';
  var FH = '"MaShan","Songti SC","STSong","Noto Serif SC",serif';
  var FB = '"Songti SC","STSong","Noto Serif SC",serif';
  var MAXBOOKS = 30;
  var LS_KEY = 'bookplate.v1';

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    year: $('year'), owner: $('owner'), list: $('list'), count: $('count'), books: $('books'),
    cv: $('cv'), status: $('status'), save: $('save'), demo: $('demo'), clear: $('clear'),
    overlay: $('overlay'), ovImg: $('ov-img'), ovClose: $('ov-close')
  };

  var state = { tpl: 'plate', ratings: {}, best: '' };
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
  function mk(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  /* ---------- paper texture ---------- */
  var paperCache = {};
  function makePaper(w, h) {
    var key = w + 'x' + h;
    if (paperCache[key]) return paperCache[key];
    var c = mk(w, h), g = c.getContext('2d'), r = rng(w * 31 + h);
    var gr = g.createLinearGradient(0, 0, w * 0.6, h);
    gr.addColorStop(0, '#f7eed6'); gr.addColorStop(0.5, '#f0e3c0'); gr.addColorStop(1, '#e8d8ad');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    // blotchy stains
    for (var i = 0; i < 14; i++) {
      var x = r() * w, y = r() * h, rad = 80 + r() * 260;
      var rg = g.createRadialGradient(x, y, 0, x, y, rad);
      rg.addColorStop(0, 'rgba(150,110,50,' + (0.04 + r() * 0.05) + ')');
      rg.addColorStop(1, 'rgba(150,110,50,0)');
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
      g.strokeStyle = 'rgba(120,90,40,' + (0.04 + r() * 0.07) + ')';
      g.beginPath(); g.moveTo(fx, fy);
      g.quadraticCurveTo(fx + Math.cos(a) * len * 0.5 + r() * 4, fy + Math.sin(a) * len * 0.5 + r() * 4,
        fx + Math.cos(a) * len, fy + Math.sin(a) * len);
      g.stroke();
    }
    // vignette
    var m = Math.max(w, h);
    var vg = g.createRadialGradient(w / 2, h / 2, m * 0.3, w / 2, h / 2, m * 0.78);
    vg.addColorStop(0, 'rgba(110,70,20,0)'); vg.addColorStop(1, 'rgba(110,70,20,0.38)');
    g.fillStyle = vg; g.fillRect(0, 0, w, h);
    // edge darkening
    var eg = [[0, 0, 0, 40], [0, h, 0, h - 40], [0, 0, 40, 0], [w, 0, w - 40, 0]];
    eg.forEach(function (e) {
      var l = g.createLinearGradient(e[0], e[1], e[2], e[3]);
      l.addColorStop(0, 'rgba(100,60,15,0.22)'); l.addColorStop(1, 'rgba(100,60,15,0)');
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
    ctx.globalCompositeOperation = 'multiply';
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
  function vtext(ctx, cs, x, y, fs, step) {
    step = step || fs * 1.06;
    cs.forEach(function (c, i) { ctx.fillText(c, x, y + (i + 0.5) * step); });
  }

  function drawPlate(data) {
    var W = 1242, H = 1656, cv = els.cv;
    cv.width = W; cv.height = H;
    var ctx = cv.getContext('2d');
    ctx.drawImage(makePaper(W, H), 0, 0);

    // frame
    ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.strokeRect(60, 60, W - 120, H - 120);
    ctx.lineWidth = 2.5; ctx.strokeRect(86, 86, W - 172, H - 172);
    corner(ctx, 86, 86, 1, 1); corner(ctx, W - 86, 86, -1, 1);
    corner(ctx, 86, H - 86, 1, -1); corner(ctx, W - 86, H - 86, -1, -1);

    var cx = W / 2, name = data.owner, cn = cnYear(data.year);
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var y = 235;
    if (name) {
      fitSize(ctx, name + '藏书', 820, 190, 80, FH);
      ctx.fillText(name + '藏书', cx, y);
      ctx.fillStyle = RED;
      ctx.font = '50px ' + FH;
      ctx.fillText(cn + ' 读书记', cx, y + 125);
      y += 190;
    } else {
      fitSize(ctx, cn + ' 读书记', 820, 170, 80, FH);
      ctx.fillText(cn + ' 读书记', cx, y);
      y += 100;
    }
    divider(ctx, cx, y + 20, 640);
    var top = y + 70;

    // year book
    var list = data.books.filter(function (b) { return b.title !== data.best; });
    var yb = data.books.filter(function (b) { return b.title === data.best; })[0];
    if (yb) {
      ctx.fillStyle = RED; ctx.font = '34px ' + FH;
      ctx.fillText('年度之书', cx, top + 20);
      ctx.strokeStyle = RED; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx - 200, top + 20); ctx.lineTo(cx - 100, top + 20);
      ctx.moveTo(cx + 100, top + 20); ctx.lineTo(cx + 200, top + 20); ctx.stroke();
      ctx.fillStyle = INK;
      fitSize(ctx, '《' + yb.title + '》', 780, 130, 44, FH);
      ctx.fillText('《' + yb.title + '》', cx, top + 120);
      if (yb.author) {
        ctx.fillStyle = INK2; ctx.font = '38px ' + FB;
        ctx.fillText(yb.author + ' 著', cx, top + 200);
      }
      top += 250;
      divider(ctx, cx, top - 12, 360);
      top += 20;
    }

    // list
    var areaTop = top, areaBottom = 1290, areaW = W - 2 * 170;
    var n = list.length;
    if (n) {
      var areaH = areaBottom - areaTop, maxLen = 1;
      list.forEach(function (b) { maxLen = Math.max(maxLen, chars(b.title).length); });
      var best = null;
      for (var bands = 1; bands <= 3; bands++) {
        var gap = 40, Hb = (areaH - (bands - 1) * gap) / bands;
        var per = Math.ceil(n / bands);
        var fs = Math.min(84, areaW / (per * 2), Hb / Math.min(maxLen, 9));
        if (!best || fs > best.fs * 1.08) best = { bands: bands, fs: fs, Hb: Hb, per: per, gap: gap };
      }
      var fs0 = Math.floor(best.fs);
      for (var i = 0; i < n; i++) {
        var band = Math.floor(i / best.per), idx = i % best.per;
        var inBand = Math.min(best.per, n - band * best.per);
        var unit = fs0 * 2, total = inBand * unit;
        var R = cx + total / 2 - idx * unit;
        var bTop = areaTop + band * (best.Hb + best.gap);
        var b = list[i], tc = chars(b.title);
        var tfs = Math.min(fs0, best.Hb / tc.length * 0.97);
        ctx.fillStyle = INK; ctx.font = tfs + 'px ' + FH;
        vtext(ctx, tc, R - fs0 * 0.6, bTop, tfs);
        if (b.author) {
          var ac = chars(b.author), afs = Math.min(fs0 * 0.5, (best.Hb - fs0 * 0.9) / ac.length * 0.97);
          ctx.fillStyle = INK2; ctx.font = afs + 'px ' + FB;
          vtext(ctx, ac, R - fs0 * 1.5, bTop + fs0 * 0.9, afs, afs * 1.12);
        }
        // faint column rule
        if (idx < inBand - 1) {
          ctx.strokeStyle = 'rgba(107,95,80,0.28)'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(R - unit + 0.0, bTop + 6); ctx.lineTo(R - unit, bTop + best.Hb - 6); ctx.stroke();
        }
      }
    }
    if (!n && !yb) {
      ctx.fillStyle = INK2; ctx.font = '44px ' + FH;
      ctx.fillText('书单尚空，待君落笔', cx, 760);
    }

    // seal
    var sc = name ? chars(name).slice(0, 4).concat(['藏', '书']) : ['藏', '书', '之', '印'];
    var seal = makeSeal(sc, 200, 7 + sc.length);
    stampSeal(ctx, seal, cx, 1430 - (sc.length > 4 ? 20 : 0), -0.04);
    ctx.fillStyle = INK2; ctx.font = '26px ' + FB; ctx.textAlign = 'center';
    ctx.fillText('共 ' + data.books.length + ' 种', cx - 250, 1470);
    ctx.fillText(cn + ' 年', cx + 250, 1470);
  }

  /* ---------- 书单小票 ---------- */
  var RW = 1080, RPAD = 80, BAND = 36;
  function stars(n) { return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n); }
  function drawReceiptBody(ctx, data, dry) {
    var y = 70, cx = RW / 2, name = data.owner;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'center'; ctx.fillStyle = INK;
    var shop = (name || '无名') + '书肆';
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
      var r = data.ratings[b.title] || 0;
      if (r) { sum += r; cntR++; }
      var isBest = b.title === data.best;
      ctx.font = '38px ' + FB;
      var lines = wrapText(ctx, b.title, RW - 2 * RPAD - 90 - 190);
      var rowTop = y + 14;
      ctx.textAlign = 'left'; ctx.fillStyle = INK2; ctx.font = '30px ' + FB;
      ctx.fillText((i < 9 ? '0' : '') + (i + 1), RPAD, rowTop + 34);
      ctx.fillStyle = INK; ctx.font = '38px ' + FB;
      lines.forEach(function (l, k) { ctx.fillText(l, RPAD + 90, rowTop + 38 + k * 48); });
      var ly = rowTop + 38 + (lines.length - 1) * 48;
      if (r) {
        ctx.textAlign = 'right'; ctx.fillStyle = RED; ctx.font = '32px ' + FB;
        ctx.fillText(stars(r), RW - RPAD, rowTop + 36);
      }
      var sub = b.author ? '著 · ' + b.author : '';
      if (sub) {
        ly += 38; ctx.textAlign = 'left'; ctx.fillStyle = INK2; ctx.font = '28px ' + FB;
        ctx.fillText(sub, RPAD + 90, ly);
      }
      if (isBest) {
        if (!sub) ly += 38;
        var tw = 150, th = 38, tx = RW - RPAD - tw, ty = ly - 29;
        ctx.save(); ctx.strokeStyle = RED; ctx.lineWidth = 2.5; ctx.strokeRect(tx, ty, tw, th);
        ctx.fillStyle = RED; ctx.textAlign = 'center'; ctx.font = '26px ' + FH;
        ctx.fillText('年度之书', tx + tw / 2, ty + 28); ctx.restore();
      }
      y = ly + 26;
      if (i < books.length - 1) {
        ctx.save(); ctx.strokeStyle = 'rgba(107,95,80,0.35)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 7]);
        ctx.beginPath(); ctx.moveTo(RPAD + 90, y); ctx.lineTo(RW - RPAD, y); ctx.stroke(); ctx.restore();
      }
    });
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
    if (data.best) {
      ctx.font = '36px ' + FB;
      var bw = RW - 2 * RPAD - 120;
      var bl = wrapText(ctx, '《' + data.best + '》', bw);
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
    var tmp = mk(4, 4).getContext('2d');
    var h = Math.round(drawReceiptBody(tmp, data, true));
    var H = h + BAND * 2, cv = els.cv;
    cv.width = RW; cv.height = H;
    var ctx = cv.getContext('2d');
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
    ctx.drawImage(makePaper(RW, h + 40), 0, BAND - 10);
    ctx.translate(0, BAND);
    drawReceiptBody(ctx, data, false);
    ctx.restore();
  }

  /* ---------- render pipeline ---------- */
  var timer = 0, token = 0;
  function collect() {
    var p = parseBooks();
    var y = parseInt(els.year.value, 10);
    if (!(y >= 1000 && y <= 9999)) y = new Date().getFullYear();
    return {
      year: y, owner: els.owner.value.trim().replace(/\s+/g, ''), books: p.books, total: p.total,
      ratings: state.ratings, best: state.best
    };
  }
  function render() {
    var my = ++token, data = collect();
    var go = function () {
      if (my !== token) return;
      try {
        if (state.tpl === 'plate') drawPlate(data); else drawReceipt(data);
        els.status.textContent = '预览已生成（' + els.cv.width + '×' + els.cv.height + '）';
      } catch (e) {
        els.status.textContent = '生成失败：' + e.message;
      }
    };
    if (fontsReady) go();
    else {
      loadFonts().then(function () { fontsReady = true; go(); });
    }
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
  function schedule() { clearTimeout(timer); timer = setTimeout(render, 160); }

  /* ---------- book rows ---------- */
  function buildRows() {
    var p = parseBooks(), box = els.books;
    var titles = p.books.map(function (b) { return b.title; });
    Object.keys(state.ratings).forEach(function (k) { if (titles.indexOf(k) < 0) delete state.ratings[k]; });
    if (state.best && titles.indexOf(state.best) < 0) state.best = '';
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
      var st = document.createElement('div'); st.className = 'stars';
      var cur = state.ratings[b.title] || 0;
      for (var s = 1; s <= 5; s++) (function (s) {
        var bt = document.createElement('button');
        bt.type = 'button'; bt.textContent = '★'; bt.setAttribute('aria-label', s + ' 星');
        if (s <= cur) bt.className = 'on';
        bt.addEventListener('click', function () {
          if (state.ratings[b.title] === s) delete state.ratings[b.title]; else state.ratings[b.title] = s;
          buildRows(); persist(); schedule();
        });
        st.appendChild(bt);
      })(s);
      row.appendChild(st);
      var lb = document.createElement('label'); lb.className = 'best';
      var rd = document.createElement('input'); rd.type = 'checkbox'; rd.checked = state.best === b.title;
      rd.addEventListener('change', function () {
        state.best = rd.checked ? b.title : '';
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
        tpl: state.tpl, ratings: state.ratings, best: state.best
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
      state.ratings = s.ratings || {};
      state.best = s.best || '';
    } catch (e) {}
  }
  function syncTabs() {
    document.querySelectorAll('.seg button').forEach(function (b) {
      b.className = b.getAttribute('data-tpl') === state.tpl ? 'on' : '';
    });
  }
  function changed() { buildRows(); persist(); schedule(); }

  /* ---------- events ---------- */
  ['year', 'owner', 'list'].forEach(function (k) { els[k].addEventListener('input', changed); });
  document.querySelectorAll('.seg button').forEach(function (b) {
    b.addEventListener('click', function () {
      state.tpl = b.getAttribute('data-tpl'); syncTabs(); persist(); render();
    });
  });
  els.demo.addEventListener('click', function () {
    els.list.value = ['红楼梦 / 曹雪芹', '西游记 / 吴承恩', '三国演义 / 罗贯中', '水浒传 / 施耐庵', '呐喊 / 鲁迅', '浮生六记 / 沈复'].join('\n');
    if (!els.owner.value.trim()) els.owner.value = '小美';
    state.ratings = { '红楼梦': 5, '西游记': 4, '三国演义': 4, '水浒传': 3, '呐喊': 5, '浮生六记': 4 };
    state.best = '红楼梦';
    changed();
  });
  els.clear.addEventListener('click', function () {
    els.list.value = ''; state.ratings = {}; state.best = ''; changed();
  });
  els.save.addEventListener('click', function () {
    if (!els.cv.toBlob) { els.status.textContent = '此浏览器不支持保存，请截图。'; return; }
    els.cv.toBlob(function (blob) {
      if (!blob) { els.status.textContent = '导出失败，请重试。'; return; }
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = (state.tpl === 'plate' ? '藏书票-' : '书单小票-') + collect().year + '.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      els.ovImg.src = url;
      els.overlay.hidden = false;
    }, 'image/png');
  });
  function closeOv() { els.overlay.hidden = true; els.ovImg.removeAttribute('src'); }
  els.ovClose.addEventListener('click', closeOv);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeOv(); });

  /* ---------- init ---------- */
  restore();
  syncTabs();
  buildRows();
  render();
})();
