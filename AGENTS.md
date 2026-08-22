# AGENTS.md

基于原生 JavaScript 的 Agnes AI 单页创作工作台，提供文本对话、图像生成、视频生成和作品管理。项目无前端框架、无打包器，根目录没有 `package.json`。

## 项目结构

- `index.html`：四种主模式（chat / image / video / works）、顶栏、Inspector、设置中心以及静态弹窗结构。
- `app.js`：薄启动入口和页面事件装配，入口为 `document.addEventListener('DOMContentLoaded', init)`。
- `assets/js/`：按职责拆分的经典脚本，依次包含核心状态、存储、通用 UI、设置、API、Markdown 渲染、聊天、生成共用逻辑、图像、视频和作品。`markdown.js` 是零依赖的安全渲染器：输入整体转义后再做语法转换，用户与助手消息均按开关渲染；Markdown 图片渲染为可预览的 `<img>` 资源（SVG 也仅以图片资源方式显示，绝不作为文本插入 DOM），加载失败显示占位，图片附带复制原始 `![alt](url)` 语法的按钮；语言标记为 `markdown` / `md` 的围栏代码块内容按 Markdown 递归渲染。
- `assets/css/`：按原始级联顺序拆分的主题、布局、功能区、弹窗、预览和响应式样式。
- `assets/vendor/`、`assets/fonts/`：本地 Lucide 和字体资源，正式部署和双击运行不依赖第三方脚本或字体 CDN。
- `config/prompt-examples.json`：文生图案例配置，只用于文生图模式。
- `config/prompt-examples.generated.js`：从 JSON 生成的双击兼容镜像，不要手动修改。
- `scripts/sync-prompt-examples.mjs`：校验案例配置并生成或检查 JS 镜像。
- `assets/prompt-examples/img/`：文生图案例图片目录。
- `tests/agnes_workbench_smoke.py`：Playwright（Python）端到端冒烟测试；该目录被 `.gitignore` 忽略，文件可能只存在于本地。

## 运行方式

无需构建，正式运行方式为 Cloudflare Pages、GitHub Pages 或任意静态 HTTP(S) 服务。仓库根目录就是发布目录，入口为 `index.html`。

Chrome / Edge 也可直接双击 `index.html` 使用：此时案例读取 `config/prompt-examples.generated.js`，官方 Agnes 端点可以直连。不同浏览器对 `file://` 下 localStorage、IndexedDB 和自定义端点 CORS 的策略不同，双击模式不作为跨浏览器一致性承诺。

优先使用 uv 管理的 Python：

```powershell
uv run --no-cache python -m http.server 4173 --bind 127.0.0.1
```

若本机 uv 缓存可正常写入，也可省略 `--no-cache`。uv 不可用时再使用 PATH 中真实可用的 `python`。访问：

```text
http://127.0.0.1:4173/index.html
```

测试脚本固定使用端口 `4173`，启动前先检查端口是否已占用。

Cloudflare Pages 配置：构建命令留空，输出目录使用 `.`。

## 架构与状态

- `state` 保存运行时状态；不要在页面逻辑之外再建立第二套全局状态源。
- 所有 `assets/js/*.js` 都是按 `index.html` 顺序加载的经典脚本，不要改成 `type="module"`，否则会破坏 `file://` 兼容。
- 顶层共享符号使用同一个全局词法环境；不得在多个脚本中重复声明同名顶层 `const` / `let` / `class`。
- `state`、API Key 和连接草稿在 `app.js` 的 `init()` 第一阶段初始化；不要在拆分脚本加载阶段读取尚未初始化的 `state`。
- localStorage 键 `agnes-workbench.v1` 只保存轻量状态：界面设置、连接端点、会话索引和作品记录等，不再保存完整对话正文或媒体二进制。
- API Key 单独保存在 `agnes-workbench.api-key`，不能写入 `state`、IndexedDB、作品记录、备份或日志。
- IndexedDB 数据库名为 `agnes-workbench.storage`，当前版本为 `2`。
- IndexedDB 对象仓库：
  - `sessions`：会话元数据。
  - `messages`：完整消息、正文和思考内容，按 `sessionId` 建索引。
  - `blobs`：本地聊天图片和 SVG 附件。
  - `workMedia`：作品媒体缓存；新图片可自动缓存，视频仅手动缓存。
  - `meta`：迁移和数据库版本元数据，只读展示。
- 数据库读写必须集中在 `StorageRepository`，页面事件不要直接调用 `indexedDB`。
- 旧版完整 localStorage 会话在 IndexedDB 写入成功后才缩减为轻量状态；迁移逻辑必须可重复执行且不能破坏已有数据。
- 默认保留最近 20 个会话、40 条作品；设置中心允许会话 `5–100`、作品 `10–100`。

## API 接线

- 国际站：`https://apihub.agnes-ai.com`（默认）。
- 国内站：`https://apihub.agnes-ai.cn`。
- 自定义 Base URL：公网仅允许 HTTPS；本地开发允许 `localhost`、`127.0.0.1` 和 `[::1]` 的 HTTP。
- 认证：`Authorization: Bearer <key>`。
- 对话：POST `/v1/chat/completions`，处理 OpenAI 风格 SSE 的 `content` 和 `reasoning_content`。
- 图像：POST `/v1/images/generations`，参考图写入 `extra_body.image`，优先请求 `response_format: "url"`。
- 视频：POST `/v1/videos`，按时长预设写入 `num_frames`；随后 GET `/agnesapi?video_id=...` 轮询。
- 所有 Agnes 请求经 `fetchAgnes()` 动态解析当前端点；不要在业务函数中重新硬编码 Base URL。

## 媒体与缓存

- 作品记录保存远程 URL、提示词、元数据和轻量生成参数，不保存 API Key。
- 新生成图片和可访问的旧图片可缓存到 `workMedia`；视频默认只保留 URL，由用户主动缓存。
- 显示优先级为“本地 Blob URL → 远程 URL → 明确的媒体不可用状态”。关闭或替换 Object URL 时必须调用 `URL.revokeObjectURL()`。
- 浏览器直接下载第三方媒体会受 CORS、403、URL 过期和网络策略影响。缓存失败不能删除作品记录，必须保留远程 URL 并显示可读原因。
- 清除缓存只删除 IndexedDB 媒体，不得删除作品记录、提示词或远程 URL。
- SVG 只能作为图片资源通过 `<img>` / Data URI / Blob 显示，不能把未经处理的 SVG 文本直接插入 DOM。

## 文生图案例

- 案例只在文生图模式显示；图生图和多图合成继续使用 `IMAGE_PROMPT_GUIDES`。
- 配置文件必须是 UTF-8 JSON，公共结构为：

```json
{
  "version": 1,
  "textToImage": {
    "title": "区域标题",
    "description": "区域说明",
    "examples": [
      {
        "id": "唯一且稳定的 ID",
        "title": "案例标题",
        "image": "assets/prompt-examples/img/example.jpg",
        "alt": "案例图片替代文字",
        "prompt": "完整提示词，可保留 ${变量占位符}"
      }
    ]
  }
}
```

- 图片可使用相对路径或 HTTPS URL；本地图片放入 `assets/prompt-examples/img/`。
- `id` 必须唯一且稳定，不能依赖数组下标。
- 点击案例只填入提示词、更新选中态并滚动案例轨道；不得自动折叠案例区。折叠状态只由用户点击折叠按钮控制。
- HTTP(S) 下优先读取原 JSON；`file://` 或 JSON 请求失败时使用生成镜像。
- 修改 JSON 后运行 `node scripts/sync-prompt-examples.mjs`，并提交同步更新后的生成文件。
- 修改案例加载行为或配置格式时同步更新 `assets/js/generation.js` 中 JSON 请求的缓存版本参数。

## 界面约定

- 新增界面文案和 JavaScript 注释仅使用 zh-CN。
- 使用现有 CSS 变量和主题语义，不新增只适配深色模式的硬编码表面。
- 新交互必须同时考虑鼠标、触摸和键盘；图标按钮实际命中区域应不低于 `44×44px`。
- Lucide 固定版本保存在 `assets/vendor/`。动态插入含 `data-lucide` 的 DOM 后必须调用 `refreshIcons()`。
- 媒体优先完整显示，通常使用 `object-fit: contain`；只有案例缩略图等明确需要统一视觉裁切的场景才使用 `cover`。
- 尊重应用“减少动效”设置和系统 `prefers-reduced-motion`。

## 版本与缓存

修改 `index.html`、`app.js`、`assets/js/` 或 `assets/css/` 时必须同步更新：

- `index.html` 的 `<title>` 版本号。
- CSS `<link>` 的 `v=...`。
- JS `<script>` 的 `v=...`。
- 若案例行为或配置格式发生变化，更新 `assets/js/generation.js` 中 `prompt-examples.json?v=...`。

只修改 Markdown 文档时不需要升级应用版本。

## 验证

常规静态检查：

```powershell
Get-ChildItem assets\js -Filter *.js | ForEach-Object { node --check $_.FullName }
node --check app.js
node scripts/sync-prompt-examples.mjs --check
git diff --check
Get-Content -Raw -Encoding UTF8 config\prompt-examples.json | ConvertFrom-Json | Out-Null
```

需要运行冒烟测试时：

```powershell
uv pip install playwright
uv run playwright install chromium
uv run python tests/agnes_workbench_smoke.py
```

测试通过 `page.route` 模拟 Agnes API，并断言对话、图像理解、图像、视频、作品流程以及无控制台错误。

**当前项目要求：暂时不要运行 Playwright 冒烟测试。完成修改后提供浏览器自测地址和明确的人工自测清单，由用户自行验证。**

## Git 与工作区

- 工作区可能包含用户未提交的修改；不要重置、覆盖或清理与当前任务无关的内容。
- `.gitignore` 忽略 `.opencode/`、`.agents/`、`.venv/` 和 `tests/`。
- 不要整体照搬外部技能目录中的 CSS；本项目以 `assets/css/` 的现有设计体系和既定加载顺序为准。
- 拆分后的 CSS 必须保持 `index.html` 中的 `<link>` 顺序；不要把媒体查询集中重排到单独位置，避免改变级联结果。
- 除非用户明确要求，不要自动提交或推送 Git。
