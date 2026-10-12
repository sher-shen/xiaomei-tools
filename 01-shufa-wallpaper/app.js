/* 书法壁纸生成器 —— 纯前端，无外部请求 */
(function () {
'use strict';

/* ---------- 数据：24 节气（近似日期 + 公有领域名句） ---------- */
// [名称, 月, 日, 诗句, 作者]
const TERMS = [
  ['小寒',1,6,'墙角数枝梅，凌寒独自开','王安石'],
  ['大寒',1,20,'梅须逊雪三分白，雪却输梅一段香','卢梅坡'],
  ['立春',2,4,'东风带雨逐西风，大地阳和暖气生','张栻'],
  ['雨水',2,19,'好雨知时节，当春乃发生','杜甫'],
  ['惊蛰',3,6,'微雨众卉新，一雷惊蛰始','韦应物'],
  ['春分',3,21,'仲春初四日，春色正中分','徐铉'],
  ['清明',4,5,'清明时节雨纷纷，路上行人欲断魂','杜牧'],
  ['谷雨',4,20,'草树知春不久归，百般红紫斗芳菲','韩愈'],
  ['立夏',5,6,'绿树阴浓夏日长，楼台倒影入池塘','高骈'],
  ['小满',5,21,'梅子留酸软齿牙，芭蕉分绿与窗纱','杨万里'],
  ['芒种',6,6,'时雨及芒种，四野皆插秧','陆游'],
  ['夏至',6,21,'昼晷已云极，宵漏自此长','韦应物'],
  ['小暑',7,7,'荷风送香气，竹露滴清响','孟浩然'],
  ['大暑',7,23,'何以消烦暑，端坐一院中','白居易'],
  ['立秋',8,7,'乳鸦啼散玉屏空，一枕新凉一扇风','刘翰'],
  ['处暑',8,23,'疾风驱急雨，残暑扫除空','仇远'],
  ['白露',9,8,'蒹葭苍苍，白露为霜','诗经'],
  ['秋分',9,23,'自古逢秋悲寂寥，我言秋日胜春朝','刘禹锡'],
  ['寒露',10,8,'远上寒山石径斜，白云生处有人家','杜牧'],
  ['霜降',10,23,'月落乌啼霜满天，江枫渔火对愁眠','张继'],
  ['立冬',11,7,'绿蚁新醅酒，红泥小火炉','白居易'],
  ['小雪',11,22,'千山鸟飞绝，万径人踪灭','柳宗元'],
  ['大雪',12,7,'忽如一夜春风来，千树万树梨花开','岑参'],
  ['冬至',12,22,'天时人事日相催，冬至阳生春又来','杜甫']
];

const BGS = {
  xuan:  { base:[244,238,224], ink:'#2a2623', fiber:'rgba(150,130,100,A)', dark:false },
  ink:   { base:[214,213,208], ink:'#1f1e1d', fiber:'rgba(90,90,90,A)',    dark:false },
  juan:  { base:[236,222,184], ink:'#2e2519', fiber:'rgba(140,110,60,A)',  dark:false },
  night: { base:[28,27,26],    ink:'#efe9da', fiber:'rgba(200,190,170,A)', dark:true }
};
const PUNC = /[，。、；：！？,.;:!?“”‘’「」『』《》（）()…—·\s]/;

/* ---------- DOM ---------- */
const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
const el = {
  text: $('text'), sig: $('sig'), keepPunc: $('keepPunc'), scale: $('scale'), scaleVal: $('scaleVal'),
  sealOn: $('sealOn'), sealText: $('sealText'), sealPrev: $('sealPrev'),
  warn: $('warn'), term: $('term'), termHint: $('termHint')
};
const radio = name => document.querySelector('input[name="' + name + '"]:checked').value;
const FONT_FAMS = ['MaShanZheng', 'ZhiMangXing', 'LiuJianMaoCao', 'LongCang'];

/* ---------- 工具 ---------- */
function mulberry32(a) { // 可复现的伪随机，保证预览不闪烁
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hashStr(s) { let h = 2166136261; for (const c of s) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
const inCharset = ch => window.CHARSET.has(ch);

/* ---------- 字体加载 ---------- */
const fontReady = {};
function loadFont(fam, sample) {
  const key = fam + '|' + sample;
  if (!fontReady[key]) {
    fontReady[key] = document.fonts.load('64px "' + fam + '"', sample || '书')
      .catch(function () { /* 加载失败则回退系统字体 */ });
  }
  return fontReady[key];
}

/* ---------- 宣纸纹理（程序化，按尺寸+类型缓存） ---------- */
const bgCache = {};
function makePaper(w, h, type) {
  const key = w + 'x' + h + type;
  if (bgCache[key]) return bgCache[key];
  const cfg = BGS[type], rnd = mulberry32(hashStr(key));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = 'rgb(' + cfg.base.join(',') + ')'; g.fillRect(0, 0, w, h);
  // 大块云斑：模拟纸张不均匀
  for (let i = 0; i < 28; i++) {
    const x = rnd() * w, y = rnd() * h, r = (0.15 + rnd() * 0.35) * Math.max(w, h) * 0.5;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const a = 0.05 + rnd() * 0.05, v = cfg.dark ? '255,250,240' : (rnd() < 0.5 ? '255,252,244' : '120,100,70');
    gr.addColorStop(0, 'rgba(' + v + ',' + a + ')'); gr.addColorStop(1, 'rgba(' + v + ',0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }
  // 逐像素噪点
  const img = g.getImageData(0, 0, w, h), d = img.data;
  const amp = cfg.dark ? 7 : 11;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * amp;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  // 纤维线：短而弯的细线
  g.lineCap = 'round';
  const nf = Math.round(w * h / 1800);
  for (let i = 0; i < nf; i++) {
    const x = rnd() * w, y = rnd() * h, len = 8 + rnd() * 40, ang = rnd() * Math.PI * 2;
    const bend = (rnd() - 0.5) * 1.2;
    g.strokeStyle = cfg.fiber.replace('A', (0.04 + rnd() * 0.1).toFixed(3));
    g.lineWidth = 0.5 + rnd() * 1.1;
    g.beginPath(); g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(ang + bend) * len * 0.5, y + Math.sin(ang + bend) * len * 0.5,
                       x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    g.stroke();
  }
  // 四周微暗（晕边）
  const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, cfg.dark ? 'rgba(0,0,0,0.35)' : 'rgba(90,70,40,0.16)');
  g.fillStyle = vg; g.fillRect(0, 0, w, h);
  bgCache[key] = c;
  return c;
}

/* ---------- 印章 ---------- */
const SEAL_COLORS = { cinnabar: '#c0392b', orange: '#e2622d', brown: '#8b2e2a' };
const SEAL_WORDS = ['小自在','加餐','努力加餐饭','不争','见山','观云','停云','伴云','山月','自在','守心','慎独','养心','写心','有光','归真','平常心','和光同尘','小闲','小安','快哉','也罢','又活一日','聊以自娱','只余懒是真','今是昨非','不合时宜','看完了','见笑','无一长','活泼','畅怀','长乐未央','如愿','如意','平安','吉祥','洞然明白','静坐一日如两日','越不聪明越快活'];

function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
// 采样圆角矩形轮廓为多边形点集
function rrectPts(x, y, w, h, r) {
  const p = [], cs = [[x + w - r, y + r, -90], [x + w - r, y + h - r, 0], [x + r, y + h - r, 90], [x + r, y + r, 180]];
  cs.forEach(function (c) {
    for (let i = 0; i <= 10; i++) { const a = (c[2] + i * 9) * Math.PI / 180; p.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]); }
  });
  return p;
}
function ellipsePts(cx, cy, rx, ry) {
  const p = []; for (let i = 0; i < 240; i++) { const a = i / 240 * Math.PI * 2; p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
  return p;
}
// 各印形：轮廓点 pts、文字区 box、col=是否单列竖排
function sealShape(kind, S, rnd) {
  const box = (w, h, cy) => ({ x: (S - w) / 2, y: (cy === undefined ? S / 2 : cy) - h / 2, w: w, h: h });
  switch (kind) {
    case 'circle': return { pts: ellipsePts(S / 2, S / 2, S * 0.46, S * 0.46), box: box(S * 0.62, S * 0.62) };
    case 'ellipse': return { pts: ellipsePts(S / 2, S / 2, S * 0.34, S * 0.46), box: box(S * 0.46, S * 0.66) };
    case 'strip': return { pts: rrectPts(S * 0.28, S * 0.04, S * 0.44, S * 0.92, S * 0.05), box: box(S * 0.3, S * 0.76), col: true };
    case 'gourd': { // 两圆相叠，只保留外轮廓
      const c1 = [S / 2, S * 0.27, S * 0.2], c2 = [S / 2, S * 0.66, S * 0.3], p = [];
      const out = (px, py, c) => Math.hypot(px - S / 2, py - c[1]) > c[2];
      for (let i = 1; i <= 160; i++) { const a = Math.PI / 2 + i / 160 * Math.PI * 2, x = c1[0] + Math.cos(a) * c1[2], y = c1[1] + Math.sin(a) * c1[2]; if (out(x, y, c2)) p.push([x, y]); }
      for (let i = 1; i <= 220; i++) { const a = -Math.PI / 2 + i / 220 * Math.PI * 2, x = c2[0] + Math.cos(a) * c2[2], y = c2[1] + Math.sin(a) * c2[2]; if (out(x, y, c1)) p.push([x, y]); }
      return { pts: p, box: box(S * 0.27, S * 0.66, S * 0.52), col: true };
    }
    case 'stone': { // 随形：9 个随机半径控制点 + 余弦插值，得到圆润不规则轮廓
      const ctl = []; for (let i = 0; i < 9; i++) ctl.push(0.9 + rnd() * 0.18);
      const p = [];
      for (let i = 0; i < 260; i++) {
        const t = i / 260 * 9, k = Math.floor(t), f = (1 - Math.cos((t - k) * Math.PI)) / 2;
        const r = ctl[k % 9] * (1 - f) + ctl[(k + 1) % 9] * f, a = i / 260 * Math.PI * 2;
        p.push([S / 2 + Math.cos(a) * S * 0.45 * r, S / 2 + Math.sin(a) * S * 0.46 * r]);
      }
      return { pts: p, box: box(S * 0.6, S * 0.6) };
    }
    default: return { pts: rrectPts(S * 0.04, S * 0.04, S * 0.92, S * 0.92, S * 0.02), box: box(S * 0.74, S * 0.74) };
  }
}
// 字格（阅读顺序：右列先、自上而下）
function sealCells(n, b, col, rnd) {
  const c = [];
  if (n === 1) return [b];
  if (col || (n === 2 && (b.h > b.w * 1.2 || rnd() < 0.5))) { // 单列竖排（长条/葫芦，或方印两字上下排）
    for (let i = 0; i < n; i++) c.push({ x: b.x, y: b.y + i * b.h / n, w: b.w, h: b.h / n });
    return c;
  }
  if (n === 2) { // 方印左右排：右字先
    c.push({ x: b.x + b.w / 2, y: b.y, w: b.w / 2, h: b.h }, { x: b.x, y: b.y, w: b.w / 2, h: b.h });
    return c;
  }
  const hw = b.w / 2, rr = n === 3 ? 1 : Math.ceil(n / 2), lr = n - rr; // 右列 rr 字，左列 lr 字
  for (let i = 0; i < rr; i++) c.push({ x: b.x + hw, y: b.y + i * b.h / rr, w: hw, h: b.h / rr });
  for (let i = 0; i < lr; i++) c.push({ x: b.x, y: b.y + i * b.h / lr, w: hw, h: b.h / lr });
  if (n === 3) { c.length = 0; c.push({ x: b.x + hw, y: b.y, w: hw, h: b.h }, { x: b.x, y: b.y, w: hw, h: b.h / 2 }, { x: b.x, y: b.y + b.h / 2, w: hw, h: b.h / 2 }); }
  return c;
}
// 把单字按实际字形包围盒缩放填满格子（宽高比最多拉伸 ±15%）
function drawGlyph(g, ch, cell) {
  g.save(); g.translate(cell.x + cell.w / 2, cell.y + cell.h / 2);
  if (!inCharset(ch)) { g.globalAlpha = 0.5; g.fillRect(-cell.w * 0.3, -cell.h * 0.3, cell.w * 0.6, cell.h * 0.6); g.restore(); return; }
  g.font = '100px "MaShanZheng"'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  const m = g.measureText(ch), L = m.actualBoundingBoxLeft, R = m.actualBoundingBoxRight, A = m.actualBoundingBoxAscent, D = m.actualBoundingBoxDescent;
  const bw = L + R, bh = A + D;
  if (bw > 0 && bh > 0) {
    const tw = cell.w * 0.92, th = cell.h * 0.92, u = Math.min(tw / bw, th / bh);
    g.scale(Math.min(tw / bw, u * 1.15), Math.min(th / bh, u * 1.15));
    g.fillText(ch, -(R - L) / 2, -(D - A) / 2);
  }
  g.restore();
}
// 在正方形 canvas c 上画一方印。opt: {shape, style(zhu/bai), color, aging(0-100)}
function drawSeal(c, chars, opt) {
  const S = c.width, g = c.getContext('2d'), n = chars.length;
  const rnd = mulberry32(hashStr(chars.join('') + opt.style + opt.shape)), age = opt.aging / 100;
  g.clearRect(0, 0, S, S);
  const sh = sealShape(opt.shape, S, rnd), cells = sealCells(n, sh.box, sh.col, rnd);
  g.save();
  g.translate(S / 2, S / 2); g.rotate((rnd() - 0.5) * 4 * Math.PI / 180); g.translate(-S / 2, -S / 2); // 轻微旋转 ±2°
  g.fillStyle = g.strokeStyle = opt.color;
  const path = function () { g.beginPath(); sh.pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); };
  if (opt.style === 'bai') { // 白文：实心红底，字挖空
    path(); g.fill();
    g.globalCompositeOperation = 'destination-out';
    cells.forEach((cl, i) => drawGlyph(g, chars[i], cl));
  } else {                   // 朱文：细边框 + 红字
    g.lineWidth = S * 0.03; g.lineJoin = 'round'; path(); g.stroke();
    cells.forEach((cl, i) => drawGlyph(g, chars[i], cl));
    g.globalCompositeOperation = 'destination-out'; // 边框随机断口 1–3 处
    const nb = 1 + Math.floor(rnd() * 3);
    for (let i = 0; i < nb; i++) { const p = sh.pts[Math.floor(rnd() * sh.pts.length)]; g.beginPath(); g.arc(p[0], p[1], S * (0.014 + rnd() * 0.02), 0, Math.PI * 2); g.fill(); }
  }
  // ---- 做旧（程度由 age 控制）----
  g.globalCompositeOperation = 'destination-out';
  const chips = Math.round(age * S / 7);                // 边缘缺口
  for (let i = 0; i < chips; i++) {
    const p = sh.pts[Math.floor(rnd() * sh.pts.length)], r = S * (0.006 + rnd() * 0.022);
    g.globalAlpha = 0.7 + rnd() * 0.3; g.beginPath();
    g.ellipse(p[0] + (rnd() - 0.5) * S * 0.01, p[1] + (rnd() - 0.5) * S * 0.01, r * (0.6 + rnd()), r * (0.6 + rnd()), rnd() * 3, 0, Math.PI * 2); g.fill();
  }
  const specks = Math.round(age * S * S / 160);          // 印泥不匀的小白点
  for (let i = 0; i < specks; i++) {
    g.globalAlpha = 0.3 + rnd() * 0.7; g.beginPath();
    g.arc(rnd() * S, rnd() * S, S * (0.0015 + rnd() * rnd() * 0.011), 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.restore();
  if (age > 0) { // 颗粒：整体 alpha 轻度噪声
    const img = g.getImageData(0, 0, S, S), d = img.data, k = 0.3 * age;
    for (let i = 3; i < d.length; i += 4) if (d[i]) d[i] = d[i] * (1 - k + rnd() * k);
    g.putImageData(img, 0, 0);
  }
}
// 取印文：为空则用落款首字，再不然"闲章"；最多 6 字
function sealChars() {
  let t = Array.from(el.sealText.value.replace(/\s/g, ''));
  if (!t.length) t = Array.from(el.sig.value.replace(/\s/g, '')).slice(0, 1);
  if (!t.length) t = ['闲', '章'];
  return t.slice(0, 6);
}
function makeSeal(size) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  drawSeal(c, sealChars(), { shape: $('sealShape').value, style: radio('seal'), color: SEAL_COLORS[radio('sealColor')], aging: +$('aging').value });
  return c;
}

/* ---------- 文本处理 ---------- */
// 返回列/行数组（每项为字符数组）
function splitLines(raw, keep) {
  let lines;
  if (raw.indexOf('\n') >= 0) lines = raw.split('\n');
  else lines = raw.split(/(?<=[，。、；：！？,.;:!?])/); // 单行长句按标点自动分列
  const out = [];
  lines.forEach(function (ln) {
    let chars = Array.from(ln.replace(/[ \t　]/g, ''));
    if (!keep) chars = chars.filter(c => !PUNC.test(c));
    if (chars.length) out.push(chars);
  });
  return out;
}
function checkMissing(lines, sig, seal) {
  const miss = [];
  lines.concat([sig, seal]).forEach(function (ln) {
    ln.forEach(function (c) { if (!inCharset(c) && miss.indexOf(c) < 0) miss.push(c); });
  });
  return miss;
}

/* ---------- 主绘制 ---------- */
let renderToken = 0;
async function render() {
  const token = ++renderToken;
  const fam = radio('font');
  const [W, H] = radio('size').split('x').map(Number);
  const vertical = radio('layout') === 'v';
  const bg = BGS[radio('bg')];
  const lines = splitLines(el.text.value, el.keepPunc.checked);
  const sig = Array.from(el.sig.value.replace(/\s/g, ''));
  const useSeal = el.sealOn.checked;
  const seal = sealChars();

  // 缺字提示
  const miss = checkMissing(lines, sig, useSeal ? seal : []);
  if (miss.length) {
    el.warn.hidden = false;
    el.warn.textContent = miss.map(c => '「' + c + '」不在字库中，建议换字').join('；');
  } else el.warn.hidden = true;

  // 等字体就绪后再画
  const sample = lines.concat([sig]).map(a => a.join('')).join('') + '书';
  await Promise.all([loadFont(fam, sample), loadFont('MaShanZheng', seal.join(''))]);
  if (token !== renderToken) return;

  if (cv.width !== W) cv.width = W;
  if (cv.height !== H) cv.height = H;
  ctx.drawImage(makePaper(W, H, radio('bg')), 0, 0);

  const sealCv = useSeal ? makeSeal(Math.round(Math.min(W, H) * 0.2)) : null;
  const k = el.scale.value / 100;
  const L = { ctx: ctx, W: W, H: H, fam: fam, lines: lines, sig: sig, sealCv: sealCv, bg: bg, k: k };
  if (lines.length) (vertical ? layoutVertical : layoutHorizontal)(L);
  else { ctx.fillStyle = 'rgba(128,120,110,.6)'; ctx.font = (W * 0.04) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('请输入文字', W / 2, H / 2); }

  // 同步小印章预览
  const sp = el.sealPrev, sc = makeSeal(sp.width);
  sp.getContext('2d').clearRect(0, 0, sp.width, sp.height); sp.getContext('2d').drawImage(sc, 0, 0);
}

// 画单个字：缺字 → 灰色占位
function drawChar(g, ch, x, y, fs, ink, vertical) {
  if (!inCharset(ch)) {
    g.save(); g.fillStyle = 'rgba(140,135,128,0.35)';
    roundRect(g, x - fs * 0.36, y - fs * 0.36, fs * 0.72, fs * 0.72, fs * 0.08); g.fill(); g.restore();
    return;
  }
  g.fillStyle = ink;
  if (vertical && /[，。、；：！？,.;:!?]/.test(ch)) { // 竖排标点：缩小并移到格子右上
    g.save(); g.font = (fs * 0.55) + 'px "' + g.fontFam + '"';
    g.fillText(ch, x + fs * 0.28, y - fs * 0.3); g.restore(); return;
  }
  g.fillText(ch, x, y);
}

function layoutVertical(L) {
  const g = L.ctx, W = L.W, H = L.H, n = L.lines.length;
  const m = Math.max(...L.lines.map(l => l.length));
  const hasExtra = L.sig.length > 0 || L.sealCv;
  const mx = W * 0.1, my = H * (H > W ? 0.09 : 0.11);
  const colK = 1.32, pitchK = 1.08;
  const extraCols = hasExtra ? 0.75 : 0;                 // 落款列占的字宽
  let fs = Math.min((W - 2 * mx) / (n * colK + extraCols), (H - 2 * my) / (m * pitchK), W * 0.4) * L.k;
  const colW = fs * colK, pitch = fs * pitchK;
  const blockW = n * colW, totalW = blockW + extraCols * fs;
  const blockH = m * pitch;
  const x0 = (W + totalW) / 2;                           // 最右边缘
  const top = (H - blockH) / 2;
  g.font = fs + 'px "' + L.fam + '"'; g.fontFam = L.fam; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.save(); g.shadowColor = L.bg.ink; g.shadowBlur = fs * 0.012;
  L.lines.forEach(function (ln, ci) {
    const cx = x0 - (ci + 0.5) * colW;
    // 每列自上而下；较短的列顶端对齐
    ln.forEach(function (ch, ri) { drawChar(g, ch, cx, top + (ri + 0.5) * pitch, fs, L.bg.ink, true); });
  });
  g.restore();
  // 落款 + 印章：位于最左侧列，底部对齐正文底部
  if (hasExtra) {
    const sx = x0 - blockW - (extraCols * fs) / 2;
    const bottom = top + blockH;
    const ss = L.sealCv ? Math.min(fs * 0.72, extraCols * fs * 0.95) : 0;
    const gap = ss ? fs * 0.12 : 0;
    let sfs = fs * 0.4;
    const maxSigH = blockH * 0.7 - ss - gap;
    if (L.sig.length && L.sig.length * sfs * 1.12 > maxSigH) sfs = Math.max(maxSigH / (L.sig.length * 1.12), fs * 0.15);
    const sigH = L.sig.length * sfs * 1.12;
    const sigTop = bottom - ss - gap - sigH;
    g.font = sfs + 'px "' + L.fam + '"'; g.fontFam = L.fam;
    L.sig.forEach(function (ch, i) { drawChar(g, ch, sx, sigTop + (i + 0.5) * sfs * 1.12, sfs, L.bg.ink, true); });
    if (L.sealCv) stampSeal(g, L.sealCv, sx - ss / 2, bottom - ss, ss, L.bg.dark);
  }
}

function layoutHorizontal(L) {
  const g = L.ctx, W = L.W, H = L.H, n = L.lines.length;
  const m = Math.max(...L.lines.map(l => l.length));
  const hasExtra = L.sig.length > 0 || L.sealCv;
  const mx = W * 0.1, my = H * 0.1;
  const lineK = 1.5;
  const extraH = hasExtra ? 1.9 : 0;                     // 落款+印章高度（字高倍数）
  let fs = Math.min((W - 2 * mx) / m, (H - 2 * my) / (n * lineK + extraH), W * 0.35) * L.k;
  const blockH = n * fs * lineK, totalH = blockH + extraH * fs;
  const top = (H - totalH) / 2;
  g.font = fs + 'px "' + L.fam + '"'; g.fontFam = L.fam; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.save(); g.shadowColor = L.bg.ink; g.shadowBlur = fs * 0.012;
  let maxW = 0;
  L.lines.forEach(function (ln, ri) {
    const cy = top + (ri + 0.5) * fs * lineK, w = ln.length * fs;
    maxW = Math.max(maxW, w);
    ln.forEach(function (ch, i) { drawChar(g, ch, (W - w) / 2 + (i + 0.5) * fs, cy, fs, L.bg.ink, false); });
  });
  g.restore();
  if (hasExtra) {
    const right = (W + maxW) / 2;
    const sfs = fs * 0.42, ss = L.sealCv ? fs * 0.8 : 0;
    const sy = top + blockH + sfs * 0.7;
    g.font = sfs + 'px "' + L.fam + '"'; g.fontFam = L.fam;
    const sw = L.sig.length * sfs * 1.12;
    L.sig.forEach(function (ch, i) { drawChar(g, ch, right - sw + (i + 0.5) * sfs * 1.12, sy, sfs, L.bg.ink, false); });
    if (L.sealCv) stampSeal(g, L.sealCv, right - ss, sy + sfs * 0.7, ss, L.bg.dark);
  }
}

function stampSeal(g, sealCv, x, y, size, dark) {
  g.save();
  g.globalCompositeOperation = dark ? 'source-over' : 'multiply';
  g.globalAlpha = 0.93;
  g.drawImage(sealCv, x, y, size, size);
  g.restore();
}

/* ---------- 保存 / 导出 ---------- */
function showBlob(canvas, name) {
  canvas.toBlob(function (blob) {
    if (!blob) { alert('生成失败，请重试'); return; }
    const url = URL.createObjectURL(blob);
    // 1) 触发下载（桌面浏览器）
    try { const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); } catch (e) { /* 忽略 */ }
    // 2) 全屏层显示 <img>，供 iOS / App 内置浏览器长按保存
    $('outImg').src = url; $('overlay').hidden = false;
  }, 'image/png');
}
$('btnSave').addEventListener('click', async function () {
  await render();
  showBlob(cv, 'shufa-wallpaper.png');
});
$('btnSeal').addEventListener('click', async function () {
  await loadFont('MaShanZheng', sealChars().join(''));
  showBlob(makeSeal(600), 'seal.png');
});

$('btnCard').addEventListener('click', async function () {
  const W = 1242, H = 1656, chars = sealChars();
  await loadFont('MaShanZheng', chars.join('') + '书');
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.drawImage(makePaper(W, H, 'xuan'), 0, 0);
  const ss = Math.round(W * 0.6);
  g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.94;
  g.drawImage(makeSeal(ss), (W - ss) / 2, H * 0.1, ss, ss); g.restore();
  // 印文名称：横排，字距拉开
  const fs = W * 0.055, gap = fs * 1.5, x0 = W / 2 - (chars.length - 1) * gap / 2, y = H * 0.66;
  g.font = fs + 'px "MaShanZheng"'; g.fontFam = 'MaShanZheng'; g.textAlign = 'center'; g.textBaseline = 'middle';
  chars.forEach((ch, i) => drawChar(g, ch, x0 + i * gap, y, fs, '#2a2623', false));
  g.fillStyle = 'rgba(42,38,35,.35)'; g.fillRect(W / 2 - W * 0.04, H * 0.72, W * 0.08, 2);
  const sig = el.sig.value.trim();
  g.font = (W * 0.03) + 'px "PingFang SC","Songti SC",serif'; g.fillStyle = '#8a8277';
  g.fillText('字体排印' + (sig ? ' · ' + sig + '制' : ''), W / 2, H * 0.76);
  showBlob(c, 'seal-card.png');
});
$('btnClose').addEventListener('click', function () { $('overlay').hidden = true; });
$('overlay').addEventListener('click', function (e) { if (e.target === this) this.hidden = true; });

/* ---------- 节气 ---------- */
function recommendTerm(now) {
  // 近似：找最近一个已过的节气；若已过超过 7 天，则推荐下一个
  const y = now.getFullYear(), t = now.getTime();
  const list = [];
  [y - 1, y, y + 1].forEach(yy => TERMS.forEach((e, i) => list.push({ i: i, ts: new Date(yy, e[1] - 1, e[2]).getTime() })));
  list.sort((a, b) => a.ts - b.ts);
  let idx = 0;
  for (let j = 0; j < list.length; j++) if (list[j].ts <= t) idx = j;
  const cur = list[idx], next = list[idx + 1];
  return (t - cur.ts) / 864e5 <= 7 ? cur.i : next.i;
}
function fillTerm() {
  const e = TERMS[el.term.value];
  el.text.value = e[3].replace('，', '，\n');
  el.sig.value = e[0];
  el.sealText.value = '';
  render();
}
function initTerms() {
  TERMS.forEach(function (e, i) {
    const o = document.createElement('option'); o.value = i; o.textContent = e[0] + '（' + e[1] + '月' + e[2] + '日前后）';
    el.term.appendChild(o);
  });
  const r = recommendTerm(new Date());
  el.term.value = r;
  el.termHint.textContent = '按今天日期推荐：' + TERMS[r][0] + '。诗句出自 ' + TERMS[r][4] + '。';
  el.term.addEventListener('change', function () {
    const e = TERMS[el.term.value]; el.termHint.textContent = '「' + e[3] + '」 —— ' + e[4];
  });
  $('btnTerm').addEventListener('click', fillTerm);
  SEAL_WORDS.forEach(function (w) { const o = document.createElement('option'); o.value = w; o.textContent = w; $('sealPreset').appendChild(o); });
  $('sealPreset').addEventListener('change', function () { if (this.value) el.sealText.value = this.value; });
  fillTerm();
}

/* ---------- 事件 ---------- */
let pending = false;
function schedule() { if (pending) return; pending = true; requestAnimationFrame(function () { pending = false; render(); }); }
['input', 'change'].forEach(function (ev) {
  document.querySelector('main').addEventListener(ev, function (e) {
    if (e.target === el.term) return;
    if (e.target === el.scale) el.scaleVal.textContent = el.scale.value + '%';
    if (e.target.id === "aging") $("agingVal").textContent = e.target.value;
    schedule();
  });
});

initTerms();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
})();
