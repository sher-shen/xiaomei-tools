# 小工具集（xiaomei-tools）

在线地址：<https://sher-shen.github.io/xiaomei-tools/>

纯 HTML/CSS/JS，零外部网络请求，界面全中文，移动优先。

## 本地预览

```bash
cd xiaomei-tools
python3 -m http.server 8803
# 浏览器打开 http://localhost:8803/
```

## 工具一览

| 目录 | 功能要点 |
| --- | --- |
| `01-shufa-wallpaper/` | 书法壁纸·印章·节气：用本地书法字体生成手机壁纸；节气一键填入文字；闲章（方形/竖长条/圆形/椭圆/葫芦形/随形多种印形，可调做旧程度）；可仅导出印章 PNG，或导出“印蜕卡片”。 |
| `02-bookplate/` | 年度读书藏书票：把一年的读书记录排成一张藏书票；支持评星与年度之书，可切换“藏书票”与“书单小票”两种样式，藏书票有“古纸”与“夜读”两种配色；示例书单一键填入。 |
| `03-crochet-chart/` | 钩针图纸：上传即显示缩略图，可居中裁成正方形；k-means 配色（去重加权，150 列也流畅）、毛线色卡、抖动、清理孤立格；参数改动 300ms 防抖自动重新生成；显示颜色图例、清理孤格与每行/全图换线次数统计；逐行（挂毯钩）或逐对角线（C2C）读针，带进度记忆；保存 PNG：触屏设备且支持文件分享时走系统分享（8 秒超时），否则下载并给出长按保存层；行数上限 300，超出会按比例缩小列数并提示；导出 .txt；打印图纸（只打印图纸、图例、读针文字，黑白友好）；参数记在本机 localStorage。核心纯函数在 `chart-core.js`。 |
| `00-sandbox-test/` | 沙箱能力测试：检测小红书小工具里的上传、Canvas 导出、本地字体、存储、`navigator.share` 及文件分享（canShare files）等能力；剪贴板需点按钮才测（会覆盖剪贴板）；“实测分享图片”真实调用 share 并计时；`make_size_probes.sh` 生成 5/15/30 MB 体积探针 zip 到 `dist/probes/`。 |
| `shared/` | 字符表 `charset.txt` 与字体授权文本（不含字体文件，见下）。 |

## 开发说明

```bash
# 本地预览
python3 -m http.server 8803        # 然后打开 http://localhost:8803/

# 跑测试（钩针图纸核心纯函数）
node 03-crochet-chart/test-core.js

# 打包（每个工具一个 zip，输出到 dist/）
./pack.sh
```

约束：零外部网络请求（仅根首页与本文件有 GitHub 链接）、移动优先、界面全中文。

## 打包

```bash
./pack.sh
```

每个工具目录各自打成独立 zip，输出到 `dist/`，`index.html` 位于 zip 根目录，可直接上传小红书小工具。脚本只处理已存在的目录，并排除 `*.sh`、`test-*.js`、`*.map` 与隐藏文件（含 `.DS_Store`）。

## 部署

当前线上为 GitHub Pages：<https://sher-shen.github.io/xiaomei-tools/>，push 到 `main` 分支后自动发布，根目录即站点根，各工具在 `/01-shufa-wallpaper/` 等子路径。

国内访问备选：Cloudflare Pages。连接同一仓库，构建命令留空，输出目录填 `/`；或 `npx wrangler pages deploy . --project-name xiaomei-tools`。

## 字体与授权

各工具 `fonts/` 下与 `shared/fonts/*-OFL.txt` 对应的中文书法字体（刘建毛草、龙藏体、马善政、志莽行书）均为 SIL Open Font License 1.1（OFL）授权，允许免费使用、嵌入与再分发，但不得单独出售字体本身，衍生字体不得使用保留字体名。各字体的 OFL 许可文本与版权声明已随文件放在同目录（`*-OFL.txt`），分发时请一并保留。`00-sandbox-test/fonts/test.woff2` 是志莽行书的改名副本，授权文本为同目录 `OFL.txt`。

钩针图纸内置的“毛线色卡”为通用自定义色名，并非任何品牌的色号。

## 字体子集化

字体已子集化为 GB2312 常用字约 6800 字（字符表见 `shared/charset.txt`），以控制体积；各工具目录内各自带有 woff2，`shared/fonts/` 只保留授权文本。字体源文件可从 [google/fonts](https://github.com/google/fonts) 仓库的 `ofl/` 目录获取（刘建毛草 liujianmaocao、龙藏体 longcang、马善政 mashanzheng、志莽行书 zhimangxing），子集化命令：

```bash
pyftsubset ZhiMangXing-Regular.ttf --text-file=shared/charset.txt --flavor=woff2 --output-file=ZhiMangXing-Regular.woff2
```
