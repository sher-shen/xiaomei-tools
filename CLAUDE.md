# xiaomei-tools 协作记忆

纯 HTML/CSS/JS 小工具集（00~04 + 首页），零外部网络请求、界面全中文、移动优先、不引第三方库。

## 红线
- 不推 main，不合并任何 PR，不强推；推送失败如实报告具体步骤，不反复重试。
- 浏览器验证（Playwright）**禁止真实触发下载**：必须 stub `HTMLAnchorElement.prototype.click`、`URL.createObjectURL`，`navigator.share/canShare` 置空，context 设 `acceptDownloads:false` 并监听 `download` 事件（出现即违规）。曾因反复下载被叫停。
- 不做纯风格改动；新增核心逻辑必须配 `test-core.js` 用例。

## 结构与决定
- 各工具自包含，`pack.sh` 把每个目录单独打 zip 到 `dist/`（`index.html` 在 zip 根；排除 `*.sh`、`test-*.js`）。
- **不做 `shared/` 脚本抽取**：目录运行写 `../shared/x.js`，zip 内要写 `shared/x.js`，同一份 HTML 无法两边都成立；四处保存层 DOM/行为也不一致。`shared/` 只放字符表与字体授权文本。
- 01 字体已只含 charset 6883 字，实测无法再缩。
- 核心纯函数：01 `core.js`（`retryUntil`）、02 `rating-core.js`（书名+作者稳定匹配、rv:3 迁移）、03 `chart-core.js`（进度 LRU、量化缓存）、04 `bead-core.js`（`safeCanvasScale`）。

## 测试
```bash
node 01-shufa-wallpaper/test-core.js   # 15
node 02-bookplate/test-core.js         # 27
node 03-crochet-chart/test-core.js     # 62
node 04-bead-chart/test-core.js        # 31
./pack.sh                              # dist/ 应有 5 个 zip
```

## 约定
- 提交信息中文简明，末尾加 `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`；PR 描述末尾加 `🤖 Generated with [Claude Code](https://claude.com/claude-code)`。
- 分支：`claude/polish-all-2` → PR 到 `claude/polish-all`（PR #3）。

## 未实测
- iOS/微信真机的 canvas 上限与系统分享。
