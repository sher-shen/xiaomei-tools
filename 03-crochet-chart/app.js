/* 钩针图纸生成器 - 界面逻辑（依赖 chart-core.js） */
(function () {
  'use strict';
  var C = window.XMChart;
  var $ = function (id) { return document.getElementById(id); };
  var LS_KEY = 'xm_crochet_progress_v1';

  var srcImg = null, srcName = '';
  var S = null;           // 当前生成结果
  var zoom = 0;           // 0 = 适应宽度，否则为倍数
  var curIdx = 0;
  var timer = null;

  // ---------- 输入 ----------
  var thumbUrl = null;
  function loadFile(f) {
    if (!f || !/^image\//.test(f.type || 'image/')) return;
    $('resumeHint').hidden = true;
    var url = URL.createObjectURL(f);
    // 立刻显示缩略图
    if (thumbUrl) { try { URL.revokeObjectURL(thumbUrl); } catch (e) { /* 忽略 */ } }
    thumbUrl = url;
    $('thumb').src = url; $('srcrow').hidden = false;
    $('srcinfo').textContent = (f.name || '图片') + '  读取中…';
    var img = new Image();
    img.onload = function () {
      srcImg = img; srcName = f.name || '图片';
      $('srcinfo').textContent = srcName + '  ' + img.naturalWidth + '×' + img.naturalHeight;
      $('gen').disabled = false;
      generate();
    };
    img.onerror = function () { $('srcinfo').textContent = '这张图片无法读取，请换一张'; };
    img.src = url;
  }
  $('file').addEventListener('change', function (e) { loadFile(e.target.files && e.target.files[0]); });
  var drop = $('drop');
  ['dragenter', 'dragover'].forEach(function (n) {
    drop.addEventListener(n, function (e) { e.preventDefault(); drop.classList.add('drag'); });
  });
  ['dragleave', 'drop'].forEach(function (n) {
    drop.addEventListener(n, function (e) { e.preventDefault(); drop.classList.remove('drag'); });
  });
  drop.addEventListener('drop', function (e) {
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    loadFile(f);
  });

  // ---------- 记住参数 ----------
  var P_KEY = 'xm_crochet_params_v1';
  var P_IDS = ['cols', 'ncolors', 'tech', 'crop'], P_CHK = ['yarn', 'dither', 'clean'];
  function saveParams() {
    try {
      var o = {};
      P_IDS.forEach(function (id) { o[id] = $(id).value; });
      P_CHK.forEach(function (id) { o[id] = $(id).checked; });
      localStorage.setItem(P_KEY, JSON.stringify(o));
    } catch (e) { /* 忽略 */ }
  }
  function loadParams() {
    try {
      var o = JSON.parse(localStorage.getItem(P_KEY) || 'null');
      if (!o) return;
      P_IDS.forEach(function (id) {
        if (o[id] == null) return;
        var el = $(id), old = el.value;
        el.value = o[id];
        if (el.value === '' || (el.tagName === 'SELECT' && el.selectedIndex < 0)) el.value = old;
      });
      P_CHK.forEach(function (id) { if (typeof o[id] === 'boolean') $(id).checked = o[id]; });
    } catch (e) { /* 忽略 */ }
  }

  function updateLabels() {
    $('colsOut').textContent = $('cols').value;
    $('ncolorsOut').textContent = $('ncolors').value;
    if (srcImg) {
      var z = calcSize();
      $('sizeInfo').textContent = '图纸大小 ' + z.w + ' × ' + z.h + ' 格' +
        (z.adjusted ? '（已按比例把列数调整为 ' + z.w + '）' : '');
    }
  }
  function calcSize() {
    var r = C.cropRect(srcImg.naturalWidth, srcImg.naturalHeight, $('crop').value);
    return C.chartSize(+$('cols').value, r.sw, r.sh, 300);
  }
  function schedule() {
    updateLabels(); saveParams();
    if (!srcImg) return;
    clearTimeout(timer);
    timer = setTimeout(function () { timer = null; generate(); }, 300);   // 防抖 300ms
  }
  ['cols', 'ncolors'].forEach(function (id) { $(id).addEventListener('input', schedule); });
  ['yarn', 'dither', 'clean', 'crop'].forEach(function (id) { $(id).addEventListener('change', schedule); });
  $('tech').addEventListener('change', function () { saveParams(); if (srcImg) generate(); });
  $('gen').addEventListener('click', function () { clearTimeout(timer); timer = null; generate(); });

  // ---------- 生成 ----------
  var genToken = 0, genPending = false;
  function generate() {
    if (!srcImg) return;
    updateLabels();
    var tok = ++genToken;
    genPending = true;
    $('status').textContent = '正在生成…';
    setTimeout(function () {     // 让出一帧，先把“正在生成”画出来
      if (tok !== genToken) return;
      genPending = false;
      try { doGenerate(); $('status').textContent = ''; }
      catch (e) { $('status').textContent = '生成失败：' + (e && e.message || e); }
    }, 30);
  }
  function doGenerate() {
    var z = calcSize(), w = z.w, h = z.h, k = +$('ncolors').value;
    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var cx = cv.getContext('2d');
    cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h);
    cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
    var cr = C.cropRect(srcImg.naturalWidth, srcImg.naturalHeight, $('crop').value);
    cx.drawImage(srcImg, cr.sx, cr.sy, cr.sw, cr.sh, 0, 0, w, h);
    var data = cx.getImageData(0, 0, w, h).data, px = [];
    for (var i = 0; i < w * h; i++) px.push([data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]);

    var rgbPal = C.kmeansPalette(px, k, 20240601, 15);
    var pal;   // [{rgb,hex,name}]
    if ($('yarn').checked) {
      pal = C.mapToYarn(rgbPal);
    } else {
      pal = rgbPal.map(function (c) { return { rgb: c, hex: C.rgbToHex(c), name: C.nearestName(c) + '系' }; });
    }
    var idx = C.assignPixels(px, w, h, pal.map(function (p) { return p.rgb; }), $('dither').checked);
    if ($('clean').checked) idx = C.cleanIsolated(idx, w, h);
    var sorted = C.sortByCount(idx, pal);
    var palette = sorted.palette;
    if (!$('yarn').checked) {
      var nn = C.uniqueNames(palette);
      palette.forEach(function (p, i) { p.name = nn[i]; });
    }
    var tech = $('tech').value;
    var steps = tech === 'c2c' ? C.c2cDiagonals(sorted.indices, w, h) : C.tapestryRows(sorted.indices, w, h);
    var chg = C.colorChanges(steps);
    S = { chg: chg, w: w, h: h, indices: sorted.indices, palette: palette, counts: sorted.counts, tech: tech, steps: steps, sig: sig(sorted.indices, w, h, tech) };
    restoreProgress();
    render();
  }
  function sig(arr, w, h, tech) {
    var hsh = 5381;
    for (var i = 0; i < arr.length; i++) hsh = ((hsh * 33) ^ (arr[i] + 1)) >>> 0;
    return tech + ':' + w + 'x' + h + ':' + hsh;
  }
  function symOf(i) { return C.symbolFor(i); }

  // ---------- 进度 ----------
  function restoreProgress() {
    curIdx = 0;
    try {
      var o = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      if (o && o.sig === S.sig && o.idx >= 0 && o.idx < S.steps.length) curIdx = o.idx;
    } catch (e) { /* 忽略 */ }
  }
  function saveProgress() {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ sig: S.sig, idx: curIdx })); } catch (e) { /* 忽略 */ }
  }

  // ---------- 渲染 ----------
  function render() {
    $('result').hidden = false;
    renderLegend();
    renderSteps();
    drawMain();
  }

  function renderLegend() {
    var total = S.w * S.h, ul = $('legend');
    ul.innerHTML = '';
    S.palette.forEach(function (p, i) {
      var li = document.createElement('li');
      var sw = document.createElement('span');
      sw.className = 'sw'; sw.style.background = p.hex; sw.style.color = textOn(p.rgb);
      sw.textContent = symOf(i);
      var nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = p.name + '  ' + p.hex;
      var ct = document.createElement('span'); ct.className = 'ct';
      ct.textContent = S.counts[i] + ' 格 · ' + (S.counts[i] * 100 / total).toFixed(1) + '%';
      li.appendChild(sw); li.appendChild(nm); li.appendChild(ct);
      ul.appendChild(li);
    });
    $('est').textContent = '总格数 ' + total + '（' + S.w + ' × ' + S.h + '），共 ' + S.palette.length + ' 种颜色。每种颜色用线量请按自己的针法与线材另行估算。';
    var u = S.tech === 'c2c' ? '条' : '行', g = S.chg, n = S.steps.length;
    $('chg').textContent = '换线统计：全图共换线 ' + g.total + ' 次（' + u + '内 ' + g.within + ' 次 + ' + u + '间衔接 ' + g.turns +
      ' 次）；平均每' + u + ' ' + (g.total / n).toFixed(1) + ' 次，最多的是第 ' + (g.maxIndex + 1) + ' ' + u + '（' + g.max + ' 次）。';
  }

  function stepText(st) {
    return S.tech === 'c2c' ? C.formatC2CLine(st, symOf) : C.formatTapestryLine(st, symOf);
  }

  function renderSteps() {
    var c2c = S.tech === 'c2c';
    $('readTitle').textContent = c2c ? '逐条读针（C2C 对角线）' : '逐行读针（提花挂毯钩）';
    $('prev').textContent = c2c ? '上一条' : '上一行';
    $('next').textContent = c2c ? '下一条' : '下一行';
    $('readNote').textContent = c2c
      ? '从图纸右下角起钩；↗ 为从左下往右上钩，↙ 为从右上往左下钩；增针段每条比上一条多 1 格，减针段每条少 1 格。'
      : '第 1 行为图纸最下一行；奇数行从右往左（←），偶数行从左往右（→）。字母含义见上方图例。';
    var ol = $('rows'); ol.innerHTML = '';
    S.steps.forEach(function (st, i) {
      var li = document.createElement('li');
      li.textContent = stepText(st);
      li.addEventListener('click', function () { goto(i); });
      ol.appendChild(li);
    });
    markCurrent(false);
  }

  function markCurrent(scroll) {
    var items = $('rows').children;
    for (var i = 0; i < items.length; i++) {
      items[i].className = i < curIdx ? 'done' : (i === curIdx ? 'on' : '');
    }
    $('cur').textContent = stepText(S.steps[curIdx]) + '  [换色 ' + S.chg.perStep[curIdx] + ' 次]';
    $('prev').disabled = curIdx <= 0;
    $('next').disabled = curIdx >= S.steps.length - 1;
    if (scroll && items[curIdx]) {
      var box = $('rows'), el = items[curIdx];
      box.scrollTop = el.offsetTop - box.offsetTop - box.clientHeight / 3;
    }
  }
  function goto(i) {
    curIdx = Math.max(0, Math.min(S.steps.length - 1, i));
    saveProgress(); markCurrent(true); drawMain();
  }
  $('prev').addEventListener('click', function () { if (S) goto(curIdx - 1); });
  $('next').addEventListener('click', function () { if (S) goto(curIdx + 1); });

  // ---------- 画图纸 ----------
  function textOn(rgb) {
    var l = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
    return l > 150 ? '#222' : '#fff';
  }
  function tint(rgb) {   // 打印用：向白色靠拢，便于黑白打印时看清符号
    return 'rgb(' + rgb.map(function (v) { return Math.round(v * 0.45 + 255 * 0.55); }).join(',') + ')';
  }
  function cellSize() { return Math.max(12, Math.min(30, Math.floor(1800 / S.w))); }

  function drawChart(cv, opt) {
    var w = S.w, h = S.h, cs = cellSize(), M = 30;
    cv.width = w * cs + M * 2; cv.height = h * cs + M * 2;
    var g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
    var ox = M, oy = M, x, y;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      var p = S.palette[S.indices[y * w + x]];
      g.fillStyle = opt.print ? tint(p.rgb) : p.hex; g.fillRect(ox + x * cs, oy + y * cs, cs, cs);
    }
    if (opt.symbols) {
      g.font = 'bold ' + Math.floor(cs * 0.62) + 'px sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
        var ci = S.indices[y * w + x];
        g.fillStyle = opt.print ? '#000' : textOn(S.palette[ci].rgb);
        g.fillText(symOf(ci), ox + x * cs + cs / 2, oy + y * cs + cs / 2 + 1);
      }
    }
    // 细线
    g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 1; g.beginPath();
    for (x = 0; x <= w; x++) { g.moveTo(ox + x * cs + 0.5, oy); g.lineTo(ox + x * cs + 0.5, oy + h * cs); }
    for (y = 0; y <= h; y++) { g.moveTo(ox, oy + y * cs + 0.5); g.lineTo(ox + w * cs, oy + y * cs + 0.5); }
    g.stroke();
    // 粗线：列每 10 格；行从下数每 10 行
    g.strokeStyle = '#111'; g.lineWidth = 2; g.beginPath();
    for (x = 0; x <= w; x += 10) { g.moveTo(ox + x * cs, oy); g.lineTo(ox + x * cs, oy + h * cs); }
    for (var r = 0; r <= h; r += 10) { var yy = oy + (h - r) * cs; g.moveTo(ox, yy); g.lineTo(ox + w * cs, yy); }
    g.stroke();
    g.strokeStyle = '#111'; g.lineWidth = 2; g.strokeRect(ox, oy, w * cs, h * cs);
    // 编号
    g.fillStyle = '#333'; g.font = '11px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    var step = cs >= 18 ? 5 : 10;
    for (x = 1; x <= w; x++) if (x === 1 || x % step === 0) {
      g.fillText(String(x), ox + (x - 0.5) * cs, oy - 12);
      g.fillText(String(x), ox + (x - 0.5) * cs, oy + h * cs + 12);
    }
    for (r = 1; r <= h; r++) if (r === 1 || r % step === 0) {
      var cy = oy + (h - r + 0.5) * cs;
      g.fillText(String(r), ox - 15, cy);
      g.fillText(String(r), ox + w * cs + 15, cy);
    }
    // 高亮
    if (opt.highlight) {
      g.strokeStyle = '#d4141c'; g.lineWidth = 3;
      var st = S.steps[curIdx];
      if (S.tech === 'c2c') {
        C.diagCells(curIdx, w, h).forEach(function (c) {
          g.strokeRect(ox + c[0] * cs + 1.5, oy + c[1] * cs + 1.5, cs - 3, cs - 3);
        });
      } else {
        var ry = oy + (h - st.row) * cs;
        g.strokeRect(ox + 1.5, ry + 1.5, w * cs - 3, cs - 3);
        g.fillStyle = '#d4141c'; g.font = 'bold 14px sans-serif';
        g.fillText(st.dir, st.dir === '←' ? ox + w * cs + 15 : ox - 15, ry + cs / 2);
      }
    }
  }

  function drawMain() {
    drawChart($('chart'), { symbols: $('showSym').checked, highlight: true });
    applyZoom();
  }
  function applyZoom() {
    var cv = $('chart');
    cv.style.width = zoom ? Math.round(cv.width * zoom) + 'px' : '100%';
    cv.style.maxWidth = zoom ? 'none' : '100%';
  }
  $('showSym').addEventListener('change', function () { if (S) drawMain(); });
  $('zoomFit').addEventListener('click', function () { zoom = 0; if (S) applyZoom(); });
  $('zoomIn').addEventListener('click', function () {
    if (!S) return;
    zoom = zoom ? zoom * 1.4 : Math.max(1, $('chartWrap').clientWidth / $('chart').width * 1.4); applyZoom();
  });
  $('zoomOut').addEventListener('click', function () {
    if (!S) return;
    var base = zoom || ($('chartWrap').clientWidth / $('chart').width);
    zoom = Math.max(0.2, base / 1.4); applyZoom();
  });

  // ---------- 导出 ----------
  function exportCanvas() {
    var chart = document.createElement('canvas');
    drawChart(chart, { symbols: $('showSym').checked, highlight: false });
    var rowH = 34, pad = 20, head = 44;
    var W = Math.max(chart.width, 460);
    var H = head + chart.height + pad + S.palette.length * rowH + pad + 20;
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#2a2826'; g.font = 'bold 20px serif'; g.textBaseline = 'middle'; g.textAlign = 'left';
    g.fillText('钩针图纸  ' + S.w + '×' + S.h + '  ' + S.palette.length + '色  ' +
      (S.tech === 'c2c' ? 'C2C 斜钩' : '提花挂毯钩'), pad, head / 2);
    g.drawImage(chart, Math.floor((W - chart.width) / 2), head);
    var y = head + chart.height + pad;
    g.font = '16px serif';
    var total = S.w * S.h;
    S.palette.forEach(function (p, i) {
      g.fillStyle = p.hex; g.fillRect(pad, y + 3, 28, 28);
      g.strokeStyle = '#0006'; g.lineWidth = 1; g.strokeRect(pad + 0.5, y + 3.5, 28, 28);
      g.fillStyle = textOn(p.rgb); g.font = 'bold 15px sans-serif'; g.textAlign = 'center';
      g.fillText(symOf(i), pad + 14, y + 18);
      g.fillStyle = '#2a2826'; g.font = '16px serif'; g.textAlign = 'left';
      g.fillText(p.name + '  ' + p.hex + '   ' + S.counts[i] + ' 格 · ' + (S.counts[i] * 100 / total).toFixed(1) + '%', pad + 40, y + 18);
      y += rowH;
    });
    return cv;
  }

  function downloadBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
  }

  // 保存：先 flush 防抖生成；仅触屏设备且能分享文件时走 share（8 秒超时），否则下载 + 长按层
  var saving = false;
  function closeOverlay() { $('overlay').hidden = true; $('ovImg').removeAttribute('src'); }
  $('savePng').addEventListener('click', function () {
    if (!S || saving) return;
    saving = true; $('savePng').disabled = true;
    var hint = $('saveHint');
    function finish() { saving = false; $('savePng').disabled = false; }
    try {
      if (timer || genPending) {          // 有尚未执行的防抖/排队生成：立即生成，保证保存的是最新参数
        clearTimeout(timer); timer = null; genToken++; genPending = false;
        doGenerate(); $('status').textContent = '';
      }
      var cv = exportCanvas();
      var fname = 'crochet-chart-' + S.w + 'x' + S.h + '.png';
      var fallback = function (blob) {
        var done = false;
        if (blob) { try { downloadBlob(blob, fname); done = true; } catch (e) { done = false; } }
        $('ovImg').src = cv.toDataURL('image/png'); $('overlay').hidden = false;
        hint.textContent = done ? '已触发下载；若没有反应，请在全屏图片上长按保存。' : '请在全屏图片上长按保存。';
      };
      cv.toBlob(function (blob) {
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
          Promise.race([navigator.share({ files: [file], title: '钩针图纸' }), timeout]).then(function (r) {
            clearTimeout(tm);
            if (r === 'timeout') fallback(blob);
            else hint.textContent = '已调出系统分享，可选择“存储图像”。';
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
      try { $('ovImg').src = cv_safe(); $('overlay').hidden = false; } catch (e2) { hint.textContent = '保存失败：' + (e && e.message || e); }
      finish();
    }
  });
  function cv_safe() { return exportCanvas().toDataURL('image/png'); }
  $('closeOv').addEventListener('click', closeOverlay);

  // ---------- 打印 ----------
  var printing = false;
  function beforePrint() {
    if (!S || printing) return;
    printing = true;
    drawChart($('chart'), { symbols: true, highlight: false, print: true });
  }
  function afterPrint() { if (!printing) return; printing = false; if (S) drawMain(); }
  window.addEventListener('beforeprint', beforePrint);
  window.addEventListener('afterprint', afterPrint);
  $('printBtn').addEventListener('click', function () { if (S) window.print(); });

  $('saveTxt').addEventListener('click', function () {
    if (!S) return;
    var total = S.w * S.h, L = [];
    L.push('钩针图纸  ' + S.w + ' × ' + S.h + ' 格  ' + (S.tech === 'c2c' ? 'C2C 斜钩' : '提花挂毯钩'));
    L.push('总格数 ' + total + '，颜色 ' + S.palette.length + ' 种，全图换线 ' + S.chg.total + ' 次');
    L.push('', '【颜色图例】');
    S.palette.forEach(function (p, i) {
      L.push(symOf(i) + '  ' + p.name + '  ' + p.hex + '  ' + S.counts[i] + ' 格  ' + (S.counts[i] * 100 / total).toFixed(1) + '%');
    });
    L.push('', S.tech === 'c2c'
      ? '【逐条读针】从右下角起钩；↗ 左下到右上，↙ 右上到左下。'
      : '【逐行读针】第 1 行为最下一行；奇数行从右往左（←），偶数行从左往右（→）。');
    S.steps.forEach(function (st) { L.push(stepText(st)); });
    var blob = new Blob([L.join('\n') + '\n'], { type: 'text/plain;charset=utf-8' });
    try { downloadBlob(blob, 'crochet-pattern.txt'); $('saveHint').textContent = '已触发下载 .txt；若无反应，可手动复制上方读针文字。'; }
    catch (e) { $('saveHint').textContent = '当前环境无法下载文件，请手动复制读针文字。'; }
  });

  loadParams();
  updateLabels();
  // 刷新后有进度但没图：提示重新选图
  try {
    var po = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (po && po.sig && po.idx >= 0) {
      $('resumeHint').textContent = '重新选择同一张图即可接着上次进度（第 ' + (po.idx + 1) + ' ' +
        (/^c2c:/.test(po.sig) ? '条' : '行') + '）。';
      $('resumeHint').hidden = false;
    }
  } catch (e) { /* 忽略 */ }
})();
