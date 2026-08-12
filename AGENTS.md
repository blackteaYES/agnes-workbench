# AGENTS.md

基于原生 JavaScript 的单页应用，用于 Agnes AI API 创作工作台（文本对话 / 图像生成 / 视频生成）。无框架、无打包器、根目录无 `package.json`。

## 目录结构
- `index.html` — 所有 HTML 结构以及 4 种模式（chat / image / video / works）+ 设置面板。
- `app.js` — 所有逻辑。启动入口是 `document.addEventListener('DOMContentLoaded', init)`（app.js:2297）。使用单个模块级 `state` 对象。
- `styles.css` — 所有样式。
- `tests/agnes_workbench_smoke.py` — Playwright（Python）端到端冒烟测试。

## 运行 / 本地服务
- 无需构建。任选一个静态服务器托管仓库根目录即可。冒烟测试硬编码了 `http://127.0.0.1:4173/index.html`，测试时请用该端口提供服务：
  `python -m http.server 4173`

## Python 环境（uv）
- 本机 Python 是通过 **uv** 安装/托管的，不是系统直接安装：优先检测并使用 `uv run python` / `uv python` 找到的解释器，其次才是 PATH 里直接安装的 `python`。用到 Python 的场合（如上面的静态服务器、下面的冒烟测试）都按此顺序解析。
- 若要为项目创建虚拟环境并安装依赖：`uv sync` 或 `uv pip install playwright && uv run playwright install chromium`。

## 冒烟测试
- 运行测试：`uv run python tests/agnes_workbench_smoke.py`（需要 `playwright` Python 包 + `playwright install chromium`）。测试通过 `page.route` 模拟 Agnes API、在 localStorage 写入假 API 密钥，断言对话 / 图像理解 / 图像 / 视频 / 作品流程以及无控制台错误。截图输出到 `%TEMP%`。

## 约定 / 注意事项
- **版本号装饰：** 修改 `index.html`、`app.js` 或 `styles.css` 时，务必同时更新 CSS/JS 的 `<link>/<script>` 标签上的 `v=...`，以及 `<title>` 中的 `vX.Y.Z`（index.html:8,12,14），否则浏览器会使用过期缓存。即使忘记更新，测试仍然会通过。
- **界面文案仅限 zh-CN。** 新增的界面文本（包括现有 `label` 字段和 `showToast` 消息）都应当是中文。`app.js` 中的注释也是中文。
- **图标：** lucide 图标来自 CDN；任何动态注入、包含 `data-lucide="..."` 的 HTML 在其进入 DOM 后都需要调用 `refreshIcons()`（约 app.js:254）。现有的修饰器在静态 HTML 和 `init()` 中初始化图标属性。
- **API 接线**（app.js:3-20）：对话使用 POST `/v1/chat/completions`，采用 OpenAI 风格的分块 SSE（content + `reasoning_content`）；图像使用 POST `/v1/images/generations`，参考图放在 `extra_body.image` 下，优先使用 `response_format: 'url'`；视频使用 POST `/v1/videos`（按时长预设写入 `num_frames`），然后轮询 GET `/agnesapi?video_id=...`。基础 URL 为 `https://apihub.agnes-ai.com`。认证方式为 `Authorization: Bearer <key>`，密钥来自 localStorage。
- **localStorage 键：** API 密钥 `agnes-workbench.api-key`；完整应用状态 `agnes-workbench.v1`。作品历史只保存媒体 URL + 提示词/元数据，绝不保存密钥。
- 根目录 `.gitignore` 忽略 `.opencode/`（opencode 自身配置：插件依赖 + superdesign UI 技能）、`.venv/`、`tests/`——不要整体照搬 `.opencode/skill` 中的 CSS 建议；本应用在 `styles.css` 中有自己的设计体系。

暂时不要冒烟测试了，告诉我让我进行自测
