# 小工具集（xiaomei-tools）

纯 HTML/CSS/JS，零外部网络请求，界面全中文，移动优先。

## 本地预览

```bash
cd xiaomei-tools
python3 -m http.server 8803
# 浏览器打开 http://localhost:8803/
```

## 工具一览

| 目录 | 说明 |
| --- | --- |
| `01-shufa-wallpaper/` | 书法壁纸·印章·节气：用本地书法字体生成手机壁纸。 |
| `02-bookplate/` | 年度读书藏书票：把一年的读书记录排成一张藏书票。 |
| `03-crochet-chart/` | 钩针图纸：上传图片，生成像素格图纸与逐行（或逐对角线）读针文字。核心纯函数在 `chart-core.js`，可用 `node 03-crochet-chart/test-core.js` 测试。 |
| `00-sandbox-test/` | 沙箱能力测试：检测小红书小工具里的上传、Canvas 导出、本地字体、存储等能力；`make_size_probes.sh` 生成 5/15/30 MB 体积探针 zip 到 `dist/probes/`，用来测上传大小上限。 |
| `shared/` | 共享字体与字符表（只读）。 |

## 打包

```bash
./pack.sh
```

每个工具目录各自打成独立 zip，输出到 `dist/`，`index.html` 位于 zip 根目录，可直接上传小红书小工具。脚本只处理已存在的目录，并排除 `*.sh`、`test-*.js` 与隐藏文件。

## 部署到 Cloudflare Pages

1. 把整个 `xiaomei-tools/` 推到一个 Git 仓库（建议不提交 `dist/`）。
2. Cloudflare 控制台 → Workers & Pages → Create → Pages → 连接该仓库。
3. 构建命令留空，输出目录填 `/`（项目根目录），保存并部署。
4. 或不用 Git：`npx wrangler pages deploy . --project-name xiaomei-tools`。
5. 部署后首页为 `/`，各工具在 `/01-shufa-wallpaper/` 等子路径。

## 字体与授权

`shared/fonts/` 与各工具 `fonts/` 下的中文书法字体（刘建毛草、龙藏体、马善政、志莽行书）均为 SIL Open Font License 1.1（OFL）授权，允许免费使用、嵌入与再分发，但不得单独出售字体本身，衍生字体不得使用保留字体名。各字体的 OFL 许可文本与版权声明已随文件放在同目录（`*-OFL.txt`），分发时请一并保留。`00-sandbox-test/fonts/test.woff2` 是志莽行书的改名副本，授权文本为同目录 `OFL.txt`。

钩针图纸内置的“毛线色卡”为通用自定义色名，并非任何品牌的色号。
