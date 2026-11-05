/* 拼豆 / 十字绣图纸 - 界面逻辑（依赖 palettes.js、bead-core.js） */
(function () {
  'use strict';
  var C = window.XMBead, CARDS = window.XMBeadPalettes;
  var $ = function (id) { return document.getElementById(id); };
  var P_KEY = 'xm_bead_params_v1';

  var src = null, srcName = '';   // src: Image 或 canvas
  var S = null;                   // 当前结果
  var zoom = 0, focus = -1, timer = null;

  // ---------- 色卡下拉 ----------
  CARDS.forEach(function (c) {
    var o = document.createElement('option'); o.value = c.id; o.textContent = c.name; $('card').appendChild(o);
  });
  function curCard() {
    var id = $('card').value;
    for (var i = 0; i < CARDS.length; i++) if (CARDS[i].id === id) return CARDS[i];
    return CARDS[0];
  }
  function unit(kind) { return kind === 'stitch' ? '格' : '颗'; }

  // ---------- 输入 ----------
  var thumbUrl = null, loadTok = 0, MAX_WORK = 1600;
  // 分步折半缩小，避免一次缩得太多造成锯齿；放大时关闭平滑，保持像素画边缘清晰
  function resample(s, sx, sy, sw, sh, dw, dh) {
    var cur = s, cw = sw, ch = sh, x0 = sx, y0 = sy, t, tg;
    while (cw >= dw * 2 || ch >= dh * 2) {
      var nw = cw >= dw * 2 ? Math.ceil(cw / 2) : cw, nh = ch >= dh * 2 ? Math.ceil(ch / 2) : ch;
      t = document.createElement('canvas'); t.width = nw; t.height = nh;
      tg = t.getContext('2d'); tg.imageSmoothingEnabled = true; tg.imageSmoothingQuality = 'high';
      tg.drawImage(cur, x0, y0, cw, ch, 0, 0, nw, nh);
      cur = t; x0 = 0; y0 = 0; cw = nw; ch = nh;
    }
    var out = document.createElement('canvas'); out.width = dw; out.height = dh;
    var g = out.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingEnabled = dw < cw || dh < ch;
    g.imageSmoothingQuality = 'high';
    g.drawImage(cur, x0, y0, cw, ch, 0, 0, dw, dh);
    return out;
  }
  function setSource(img, name, w, h) {
    // 超大图先缩成工作副本（长边 ≤1600），之后每次生成都不必重新解码缩放大图
    var m = Math.max(w, h);
    src = m > MAX_WORK ? resample(img, 0, 0, w, h, Math.max(1, Math.round(w * MAX_WORK / m)), Math.max(1, Math.round(h * MAX_WORK / m))) : img;
    srcName = name;
    $('srcrow').hidden = false;
    $('srcinfo').textContent = name + '  ' + w + '×' + h;
    $('gen').disabled = false;
    generate();
  }
  function loadFile(f) {
    if (!f) return;
    if (!/^image\//.test(f.type || 'image/')) { $('srcrow').hidden = false; $('srcinfo').textContent = '这不是图片文件，请选择 JPG / PNG / WebP 等图片'; return; }
    var tok = ++loadTok, url = URL.createObjectURL(f);
    if (thumbUrl) { try { URL.revokeObjectURL(thumbUrl); } catch (e) { /* 忽略 */ } }
    thumbUrl = url;
    $('thumb').src = url; $('srcrow').hidden = false;
    $('srcinfo').textContent = (f.name || '图片') + '  读取中…';
    var img = new Image();
    img.onload = function () {
      if (tok !== loadTok) return;
      if (!img.naturalWidth || !img.naturalHeight) { $('srcinfo').textContent = '这张图片没有明确的尺寸，请换一张'; return; }
      setSource(img, f.name || '图片', img.naturalWidth, img.naturalHeight);
    };
    img.onerror = function () { if (tok === loadTok) $('srcinfo').textContent = '这张图片无法读取，请换一张'; };
    img.src = url;
  }
  $('file').addEventListener('change', function (e) {
    loadFile(e.target.files && e.target.files[0]);
    try { e.target.value = ''; } catch (err) { /* 忽略：允许再次选同一文件 */ }
  });
  // 拖到卡片外不要让浏览器直接打开图片
  ['dragover', 'drop'].forEach(function (n) { window.addEventListener(n, function (e) { e.preventDefault(); }); });
  var drop = $('drop');
  ['dragenter', 'dragover'].forEach(function (n) {
    drop.addEventListener(n, function (e) { e.preventDefault(); drop.classList.add('drag'); });
  });
  ['dragleave', 'drop'].forEach(function (n) {
    drop.addEventListener(n, function (e) { e.preventDefault(); drop.classList.remove('drag'); });
  });
  drop.addEventListener('drop', function (e) {
    loadFile(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]);
  });

  // 示例图：透明底的小蘑菇（本地用 canvas 画，不联网）
  function demoImage() {
    var cv = document.createElement('canvas'); cv.width = 240; cv.height = 240;
    var g = cv.getContext('2d');
    g.fillStyle = '#c8302c';                      // 菌盖
    g.beginPath(); g.ellipse(120, 112, 100, 82, 0, Math.PI, 0); g.lineTo(220, 128);
    g.quadraticCurveTo(120, 150, 20, 128); g.closePath(); g.fill();
    var grd = g.createRadialGradient(90, 60, 4, 110, 90, 110);   // 高光过渡
    grd.addColorStop(0, 'rgba(255,170,150,.75)'); grd.addColorStop(1, 'rgba(255,170,150,0)');
    g.fillStyle = grd; g.fill();
    g.fillStyle = '#fbf6ea';                      // 白点
    [[120, 62, 20], [62, 92, 15], [176, 92, 15], [92, 120, 9], [150, 118, 9]].forEach(function (d) {
      g.beginPath(); g.arc(d[0], d[1], d[2], 0, Math.PI * 2); g.fill();
    });
    g.fillStyle = '#f1dcb8';                      // 菌柄
    g.beginPath(); g.moveTo(78, 136); g.quadraticCurveTo(70, 200, 86, 222); g.lineTo(154, 222);
    g.quadraticCurveTo(170, 200, 162, 136); g.closePath(); g.fill();
    g.fillStyle = '#d6b88c'; g.fillRect(84, 206, 72, 16);
    g.fillStyle = '#2a2826';                      // 眼睛
    g.beginPath(); g.ellipse(102, 170, 7, 11, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(138, 170, 7, 11, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f29a9a';                      // 腮红
    g.beginPath(); g.ellipse(88, 190, 9, 5, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(152, 190, 9, 5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5a9a3c';                      // 草
    g.beginPath(); g.moveTo(30, 232); g.quadraticCurveTo(120, 210, 210, 232); g.lineTo(210, 240); g.lineTo(30, 240); g.closePath(); g.fill();
    return cv;
  }
  $('demo').addEventListener('click', function () {
    var cv = demoImage();
    if (thumbUrl) { try { URL.revokeObjectURL(thumbUrl); } catch (e) { /* 忽略 */ } thumbUrl = null; }
    loadTok++;
    $('thumb').src = cv.toDataURL('image/png');
    setSource(cv, '示例图（小蘑菇）', cv.width, cv.height);
  });

  // ---------- 参数 ----------
  var P_IDS = ['card', 'cols', 'ncolors', 'crop'], P_CHK = ['transparent', 'clean', 'dither'];
  function mode() { var r = document.querySelector('input[name=mode]:checked'); return r ? r.value : 'code'; }
  function saveParams() {
    try {
      var o = { mode: mode() };
      P_IDS.forEach(function (id) { o[id] = $(id).value; });
      P_CHK.forEach(function (id) { o[id] = $(id).checked; });
      localStorage.setItem(P_KEY, JSON.stringify(o));
    } catch (e) { /* 忽略 */ }
  }
  function loadParams() {
    try {
      var o = JSON.parse(localStorage.getItem(P_KEY) || 'null');
      if (!o || typeof o !== 'object') return;
      P_IDS.forEach(function (id) {
        var v = o[id];
        if (typeof v !== 'string' && typeof v !== 'number') return;
        var el = $(id), old = el.value;
        if (el.type === 'range' && !isFinite(parseFloat(v))) return;
        el.value = v;
        if (el.value === '' || (el.tagName === 'SELECT' && el.selectedIndex < 0)) el.value = old;
      });
      P_CHK.forEach(function (id) { if (typeof o[id] === 'boolean') $(id).checked = o[id]; });
      var modes = document.querySelectorAll('input[name=mode]');
      for (var i = 0; i < modes.length; i++) if (modes[i].value === o.mode) modes[i].checked = true;
    } catch (e) { /* 忽略 */ }
  }

  function calcSize() {
    var w = src.naturalWidth || src.width, h = src.naturalHeight || src.height;
    var r = C.cropRect(w, h, $('crop').value);
    return C.chartSize(+$('cols').value, r.sw, r.sh, 150);
  }
  function updateLabels() {
    var card = curCard();
    $('ncolors').max = Math.min(32, card.colors.length);
    $('colsOut').textContent = $('cols').value;
    $('ncolorsOut').textContent = $('ncolors').value;
    $('cardInfo').textContent = card.kind === 'stitch'
      ? '十字绣：按 14ct 绣布估算成品尺寸，数量单位为“格（针）”。'
      : '拼豆：按 5mm 豆、29×29 拼板估算，数量单位为“颗”。';
    if (src) {
      var z = calcSize();
      $('sizeInfo').textContent = '图纸大小 ' + z.w + ' × ' + z.h + ' 格' +
        (z.adjusted ? '（超过 150 行，已按比例把列数调整为 ' + z.w + '）' : '');
    }
  }
  function schedule() {
    updateLabels(); saveParams();
    if (!src) return;
    clearTimeout(timer);
    timer = setTimeout(function () { timer = null; generate(); }, 300);   // 防抖 300ms
  }
  ['cols', 'ncolors'].forEach(function (id) { $(id).addEventListener('input', schedule); });
  ['card', 'crop', 'transparent', 'clean', 'dither'].forEach(function (id) { $(id).addEventListener('change', schedule); });
  $('gen').addEventListener('click', function () { clearTimeout(timer); timer = null; generate(); });

  // ---------- 生成 ----------
  var genToken = 0, genPending = false;
  function generate() {
    if (!src) return;
    updateLabels();
    var tok = ++genToken;
    genPending = true;
    $('status').textContent = '正在生成…';
    setTimeout(function () {
      if (tok !== genToken) return;
      genPending = false;
      try { $('status').textContent = doGenerate(); }
      catch (e) { $('status').textContent = '生成失败：' + (e && e.message || e); }
    }, 30);
  }
  function doGenerate() {
    var z = calcSize(), w = z.w, h = z.h, card = curCard();
    var sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height;
    var cr = C.cropRect(sw, sh, $('crop').value);
    var cv = resample(src, cr.sx, cr.sy, cr.sw, cr.sh, w, h);
    var data = cv.getContext('2d').getImageData(0, 0, w, h).data;
    var r = C.makeChart(data, w, h, card.colors, {
      k: +$('ncolors').value, transparent: $('transparent').checked,
      clean: $('clean').checked, dither: $('dither').checked
    });
    r.card = card;
    S = r; focus = -1;
    render();
    return r.colors.length ? '' : '图中没有可用的不透明像素（整张图都是透明的）。可取消“透明处留空”再试。';
  }

  // ---------- 渲染 ----------
  function render() {
    $('result').hidden = false;
    renderLegend();
    drawMain();
  }
  function fmtCm(v) { return (Math.round(v * 10) / 10) + ''; }
  function renderLegend() {
    var kind = S.card.kind, u = unit(kind), filled = S.w * S.h - S.empty;
    var e = C.estimate(kind, S.w, S.h, S.counts);
    var t = S.card.short + ' 色卡 · ' + S.w + ' × ' + S.h + ' 格 · 共 ' + S.colors.length + ' 色 · 合计 ' + filled + ' ' + u +
      (S.empty ? '（留空 ' + S.empty + ' 格）' : '') + '。';
    if (kind === 'stitch') {
      t += '14ct 绣布成品约 ' + fmtCm(e.sizeCm[0]) + ' × ' + fmtCm(e.sizeCm[1]) + ' cm，建议裁布 ' +
        fmtCm(e.fabricCm[0]) + ' × ' + fmtCm(e.fabricCm[1]) + ' cm（每边留 5cm）。线量按每支约 1500 针粗估（2 股全十字）。';
    } else {
      t += '成品约 ' + fmtCm(e.sizeCm[0]) + ' × ' + fmtCm(e.sizeCm[1]) + ' cm，需 29×29 方板 ' + e.boards + ' 块。建议量已多备 5%。';
    }
    $('est').textContent = t;
    var ul = $('legend'); ul.innerHTML = '';
    S.colors.forEach(function (c, i) {
      var li = document.createElement('li');
      li.setAttribute('role', 'button'); li.tabIndex = 0;
      li.setAttribute('aria-label', '高亮 ' + C.symbolFor(i) + ' ' + c.code + ' ' + c.name + '，' + S.counts[i] + ' ' + u);
      if (i === focus) li.className = 'on';
      var sw = document.createElement('span');
      sw.className = 'sw'; sw.style.background = c.hex; sw.style.color = C.textOn(c.rgb);
      sw.textContent = C.symbolFor(i);
      var nm = document.createElement('span'); nm.className = 'nm';
      var cd = document.createElement('span'); cd.className = 'cd'; cd.textContent = c.code;
      nm.appendChild(cd); nm.appendChild(document.createTextNode(' ' + c.name));
      var ct = document.createElement('span'); ct.className = 'ct';
      ct.textContent = S.counts[i] + ' ' + u;
      var sm = document.createElement('small');
      sm.textContent = kind === 'stitch' ? '约 ' + e.perColor[i] + ' 支线' : '建议备 ' + e.perColor[i] + ' 颗';
      ct.appendChild(sm);
      li.appendChild(sw); li.appendChild(nm); li.appendChild(ct);
      function toggle() { focus = focus === i ? -1 : i; renderLegendState(); drawMain(); }
      li.addEventListener('click', toggle);
      li.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggle(); } });
      ul.appendChild(li);
    });
    renderLegendState();
  }
  function renderLegendState() {
    var items = $('legend').children;
    for (var i = 0; i < items.length; i++) {
      items[i].className = i === focus ? 'on' : '';
      items[i].setAttribute('aria-pressed', i === focus ? 'true' : 'false');
    }
    $('focusInfo').textContent = focus >= 0
      ? '高亮：' + C.symbolFor(focus) + ' ' + S.colors[focus].code + '（' + S.counts[focus] + ' ' + unit(S.card.kind) + '）'
      : '';
  }

  // ---------- 画图纸 ----------
  function cellSize() { return Math.max(18, Math.min(36, Math.floor(2000 / S.w))); }
  function fade(rgb) { return 'rgb(' + rgb.map(function (v) { return Math.round(v * 0.18 + 255 * 0.82); }).join(',') + ')'; }

  function drawChart(cv, opt) {
    var w = S.w, h = S.h, cs = opt.cs || cellSize(), M = 30, x, y, i;
    cv.width = w * cs + M * 2; cv.height = h * cs + M * 2;
    var g = cv.getContext('2d');
    if (!g) throw new Error('浏览器无法创建画布（可能内存不足），请减少列数后重试');
    g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
    var ox = M, oy = M, f = opt.focus;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      var ci = S.indices[y * w + x];
      if (ci < 0) continue;
      g.fillStyle = (f >= 0 && ci !== f) ? fade(S.colors[ci].rgb) : S.colors[ci].hex;
      g.fillRect(ox + x * cs, oy + y * cs, cs, cs);
    }
    // 空格画一个小点，便于区分“留空”和“白色”
    g.fillStyle = '#d9d2c3';
    for (i = 0; i < w * h; i++) if (S.indices[i] < 0) {
      g.beginPath(); g.arc(ox + (i % w + 0.5) * cs, oy + (Math.floor(i / w) + 0.5) * cs, Math.max(1.2, cs * 0.08), 0, Math.PI * 2); g.fill();
    }
    if (opt.mode !== 'none') {
      g.textAlign = 'center'; g.textBaseline = 'middle';
      var fonts = {};
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
        ci = S.indices[y * w + x];
        if (ci < 0 || (f >= 0 && ci !== f)) continue;
        var label = opt.mode === 'sym' ? C.symbolFor(ci) : S.colors[ci].code;
        var fs = fonts[label.length] || (fonts[label.length] = Math.max(6, Math.floor(Math.min(cs * 0.6, cs * 0.92 / (label.length * 0.58)))));
        g.font = 'bold ' + fs + 'px sans-serif';
        g.fillStyle = C.textOn(S.colors[ci].rgb);
        g.fillText(label, ox + x * cs + cs / 2, oy + y * cs + cs / 2 + 1);
      }
    }
    // 细线
    g.strokeStyle = 'rgba(0,0,0,0.2)'; g.lineWidth = 1; g.beginPath();
    for (x = 0; x <= w; x++) { g.moveTo(ox + x * cs + 0.5, oy); g.lineTo(ox + x * cs + 0.5, oy + h * cs); }
    for (y = 0; y <= h; y++) { g.moveTo(ox, oy + y * cs + 0.5); g.lineTo(ox + w * cs, oy + y * cs + 0.5); }
    g.stroke();
    // 粗线：每 10 格（从左上数）
    g.strokeStyle = '#111'; g.lineWidth = 2; g.beginPath();
    for (x = 0; x <= w; x += 10) { g.moveTo(ox + x * cs, oy); g.lineTo(ox + x * cs, oy + h * cs); }
    for (y = 0; y <= h; y += 10) { g.moveTo(ox, oy + y * cs); g.lineTo(ox + w * cs, oy + y * cs); }
    g.stroke();
    g.strokeRect(ox, oy, w * cs, h * cs);
    // 编号
    g.fillStyle = '#333'; g.font = '11px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    var step = cs >= 18 ? 5 : 10;
    for (x = 1; x <= w; x++) if (x === 1 || x % step === 0) {
      g.fillText(String(x), ox + (x - 0.5) * cs, oy - 12);
      g.fillText(String(x), ox + (x - 0.5) * cs, oy + h * cs + 12);
    }
    for (y = 1; y <= h; y++) if (y === 1 || y % step === 0) {
      var cy = oy + (y - 0.5) * cs;
      g.fillText(String(y), ox - 15, cy);
      g.fillText(String(y), ox + w * cs + 15, cy);
    }
  }

  function drawMain() {
    drawChart($('chart'), { mode: mode(), focus: focus });
    $('chart').setAttribute('aria-label', '拼豆图纸 ' + S.w + ' 列 × ' + S.h + ' 行，共 ' + S.colors.length + ' 色，详见下方用量清单');
    applyZoom();
  }
  function applyZoom() {
    var cv = $('chart');
    cv.style.width = zoom ? Math.round(cv.width * zoom) + 'px' : '100%';
    cv.style.maxWidth = zoom ? 'none' : '100%';
  }
  Array.prototype.forEach.call(document.querySelectorAll('input[name=mode]'), function (r) {
    r.addEventListener('change', function () { saveParams(); if (S) drawMain(); });
  });
  $('zoomFit').addEventListener('click', function () { zoom = 0; if (S) applyZoom(); });
  $('zoomIn').addEventListener('click', function () {
    if (!S) return;
    var base = zoom || ($('chartWrap').clientWidth / $('chart').width);
    zoom = Math.min(2, base * 1.4); applyZoom();
  });
  $('zoomOut').addEventListener('click', function () {
    if (!S) return;
    var base = zoom || ($('chartWrap').clientWidth / $('chart').width);
    zoom = Math.max(0.1, base / 1.4); applyZoom();
  });

  // ---------- 导出 ----------
  function exportCanvas() {
    var chart = document.createElement('canvas');
    var m = mode();
    drawChart(chart, { mode: m === 'none' ? 'sym' : m, focus: -1, cs: Math.max(cellSize(), 22) });
    var kind = S.card.kind, u = unit(kind), e = C.estimate(kind, S.w, S.h, S.counts);
    var pad = 24, head = 70, rowH = 40, colW = 300;
    var W = Math.max(chart.width + pad * 2, 680);
    var cols = Math.max(1, Math.floor((W - pad * 2) / colW));
    colW = Math.floor((W - pad * 2) / cols);
    var rows = Math.ceil(S.colors.length / cols);
    var H = head + chart.height + 56 + rows * rowH + 40;
    // iOS Safari 画布上限：面积 ≤16M 像素、单边 ≤8192；超出则整体等比缩小
    var sc = C.safeCanvasScale(W, H, 1);
    var cv = document.createElement('canvas'); cv.width = sc.width; cv.height = sc.height;
    var g = cv.getContext('2d');
    if (!g) throw new Error('浏览器无法创建导出画布（可能内存不足），请减少列数后重试');
    cv.scaledNote = sc.clamped ? '图纸较大，导出图已缩小到 ' + sc.width + '×' + sc.height + ' 像素（受手机浏览器画布上限限制）。' : '';
    g.scale(sc.width / W, sc.height / H);
    g.fillStyle = '#fbf8f0'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#b8372b'; g.fillRect(pad, 18, 4, 34);
    g.fillStyle = '#2a2826'; g.textBaseline = 'middle'; g.textAlign = 'left';
    g.font = 'bold 22px serif';
    g.fillText((kind === 'stitch' ? '十字绣图纸' : '拼豆图纸') + '  ' + S.w + ' × ' + S.h, pad + 14, 28);
    g.font = '14px serif'; g.fillStyle = '#6b655c';
    g.fillText(S.card.short + ' 色卡 · ' + S.colors.length + ' 色 · 合计 ' + (S.w * S.h - S.empty) + ' ' + u + ' · 成品约 ' +
      fmtCm(e.sizeCm[0]) + '×' + fmtCm(e.sizeCm[1]) + ' cm', pad + 14, 50);
    g.drawImage(chart, Math.floor((W - chart.width) / 2), head);
    var y0 = head + chart.height + 16;
    g.fillStyle = '#2a2826'; g.font = 'bold 17px serif';
    g.fillText('色号图例（符号 · 色号 · 色名 · 用量）', pad, y0 + 14);
    y0 += 40;
    S.colors.forEach(function (c, i) {
      var cx = pad + (i % cols) * colW, cy = y0 + Math.floor(i / cols) * rowH;
      g.fillStyle = c.hex; g.fillRect(cx, cy + 4, 30, 30);
      g.strokeStyle = '#0006'; g.lineWidth = 1; g.strokeRect(cx + 0.5, cy + 4.5, 30, 30);
      g.fillStyle = C.textOn(c.rgb); g.font = 'bold 15px sans-serif'; g.textAlign = 'center';
      g.fillText(C.symbolFor(i), cx + 15, cy + 20);
      g.textAlign = 'left'; g.fillStyle = '#2a2826'; g.font = 'bold 15px sans-serif';
      g.fillText(c.code, cx + 40, cy + 20);
      var cw = g.measureText(c.code).width;
      g.font = '15px serif'; g.fillText(c.name, cx + 46 + cw, cy + 20);
      g.textAlign = 'right'; g.font = '14px sans-serif';
      g.fillText(S.counts[i] + ' ' + u, cx + colW - 14, cy + 20);
      g.textAlign = 'left';
    });
    g.fillStyle = '#9a9384'; g.font = '12px serif';
    g.fillText('屏幕色为近似值，请以实物色卡为准', pad, H - 18);
    return cv;
  }

  function downloadBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
  }

  // 保存：先 flush 防抖；仅触屏且能分享文件时走系统分享（8 秒超时），否则下载 + 长按保存层
  var saving = false;
  function closeOverlay() {
    $('overlay').hidden = true; $('ovImg').removeAttribute('src');
    try { $('savePng').focus(); } catch (e) { /* 忽略 */ }
  }
  function openOverlay(url) {
    $('ovImg').src = url; $('overlay').hidden = false;
    try { $('closeOv').focus(); } catch (e) { /* 忽略 */ }
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('overlay').hidden) closeOverlay(); });
  $('savePng').addEventListener('click', function () {
    if (!S || saving) return;
    saving = true; $('savePng').disabled = true;
    var hint = $('saveHint'), cv = null;
    function finish() { saving = false; $('savePng').disabled = false; }
    try {
      if (timer || genPending) {
        clearTimeout(timer); timer = null; genToken++; genPending = false;
        $('status').textContent = doGenerate();
      }
      cv = exportCanvas();
      var note = cv.scaledNote ? cv.scaledNote + ' ' : '';
      var fname = (S.card.kind === 'stitch' ? 'cross-stitch-' : 'bead-chart-') + S.w + 'x' + S.h + '.png';
      var fallback = function (blob) {
        var done = false;
        if (blob) { try { downloadBlob(blob, fname); done = true; } catch (e) { done = false; } }
        var url = '';
        try { url = cv.toDataURL('image/png'); } catch (e) { url = ''; }
        if (!url || url.length < 32) { hint.textContent = note + '导出失败：浏览器无法生成图片，请减少列数或颜色后重试。'; return; }
        openOverlay(url);
        hint.textContent = note + (done ? '已触发下载；若没有反应，请在全屏图片上长按保存。' : '请在全屏图片上长按保存。');
      };
      cv.toBlob(function (blob) {   // blob 可能为 null（内存不足），fallback 会改走 dataURL
        try {
          var file = null;
          try { if (blob) file = new File([blob], fname, { type: 'image/png' }); } catch (e) { file = null; }
          var canShare = false;
          try {
            canShare = !!(file && window.matchMedia && window.matchMedia('(pointer:coarse)').matches &&
              navigator.share && navigator.canShare && navigator.canShare({ files: [file] }));
          } catch (e) { canShare = false; }
          if (!canShare) { fallback(blob); finish(); return; }
          var tm, timeout = new Promise(function (res) { tm = setTimeout(function () { res('timeout'); }, 8000); });
          Promise.race([navigator.share({ files: [file], title: '拼豆图纸' }), timeout]).then(function (r) {
            clearTimeout(tm);
            if (r === 'timeout') fallback(blob);
            else hint.textContent = note + '已调出系统分享，可选择“存储图像”。';
            finish();
          }, function (e) {
            clearTimeout(tm);
            try { if (!(e && e.name === 'AbortError')) fallback(blob); } finally { finish(); }
          });
        } catch (e) {
          try { fallback(blob); } finally { finish(); }
        }
      }, 'image/png');
    } catch (e) {
      hint.textContent = '保存失败：' + (e && e.message || e);
      finish();
    }
  });
  $('closeOv').addEventListener('click', closeOverlay);

  loadParams();
  updateLabels();
})();
