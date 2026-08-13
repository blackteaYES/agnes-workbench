# agnes-workbench

基于原生 JavaScript 的 Agnes AI 创作工作台（无框架、无打包器）。支持文本对话、图像生成、视频生成与作品历史，通过 Agnes API 驱动。

## 功能

- **文本对话** — OpenAI 风格流式输出，含思考模式（`reasoning_content`）、图像理解（上传图片 / HTTPS URL）、多会话与消息编辑/重发。
- **图像生成** — 文生图 / 图生图 / 多图合成，风格预设、提示词工作台（随机灵感 / 优化提示词）、输出档位与宽高比可调，参考图可从本地或作品库选择并长按拖拽排序。
- **视频生成** — 文生视频 / 图生视频 / 关键帧动画，关键帧可拖动调整顺序，异步任务 + 智能轮询（含限流退避），可手动刷新状态。
- **作品历史** — 仅保存媒体 URL、提示词摘要与元数据，绝不保存 API 密钥；图片和视频预览支持左右切换，视频进入预览后自动播放。
- **作品备份** — 可将全部作品导出为版本化 `.agnes-workbench.json` 清单，并在预览校验后合并导入；按媒体类型与 URL 去重，作品上限仍为 40 条。
- **分层本地存储** — 对话正文、思考过程、本地聊天图片和作品媒体缓存使用 IndexedDB；localStorage 只保留界面设置、会话索引和作品 URL，避免大段内容反复触发容量上限。设置中心可配置自动保存节奏、会话/作品保留数量、持久存储和健康修复。
- **统一设置中心** — 顶栏设置入口集中管理主题、界面密度、动效、自动保存、连接和 IndexedDB 存储维护。
- **作品媒体缓存** — 新生成图片和仍可访问的旧图片会后台缓存到 IndexedDB；视频默认只保存远程地址，可在作品卡中手动缓存。
- **文生图案例** — 文生图提示词区提供可收起的案例灵感入口，案例定义位于 `config/prompt-examples.json`，支持多个案例、相对路径或 HTTPS 图片，点击卡片可填入完整模板。
- **本地数据管理** — 设置中心支持查看、搜索和安全删除 IndexedDB 中的会话、消息、聊天附件、作品缓存与只读元数据；主键、Blob 二进制和 API 密钥不会开放编辑。
- **帮助中心与移动工作区** — 顶栏的工作区入口在手机端也可访问模式、设置、存储管理和帮助中心；帮助页覆盖创作、缓存、备份和常见问题。
- **SVG 图片** — 文本对话支持上传、拖放、回显和放大预览 SVG 图片。

## 运行

无需构建，任选一个静态服务器托管仓库根目录即可：

```bash
uv run python -m http.server 4173
```

打开 `http://127.0.0.1:4173/index.html`，在「连接设置」中选择国际站、国内站或自定义 Base URL，并填入共享的 Agnes API Key（仅保存在本地 localStorage，以 `Authorization: Bearer` 发送请求）。

## 测试

冒烟测试（Playwright）通过 `page.route` 模拟 Agnes API：

```bash
uv sync
uv pip install playwright && uv run playwright install chromium
uv run python tests/agnes_workbench_smoke.py
```

## 技术要点

- API 站点：国际站 `https://apihub.agnes-ai.com`（默认）、国内站 `https://apihub.agnes-ai.cn`，也支持自定义 Base URL；模型 `agnes-2.5-flash` / `agnes-image-2.1-flash` / `agnes-video-v2.0`；密钥 localStorage 键 `agnes-workbench.api-key`。
- 应用状态索引继续使用 localStorage 键 `agnes-workbench.v1`；完整会话与本地附件保存在 IndexedDB 数据库 `agnes-workbench.storage`。打开新版时会自动迁移旧版 localStorage 对话，数据库写入成功后才缩减旧状态。
- 应用设置中的存储分区可查看浏览器存储估算、IndexedDB 会话/消息/附件/作品缓存统计，申请持久存储，清理失效缓存，检查并修复数据库。压缩历史会二次确认，默认保留当前会话、最近 20 个会话和最近 40 条作品，数量可在设置中调整（会话 5–100 个、作品 10–100 条）。
- 作品备份只包含媒体 URL、提示词、生成参数、类型和时间，不包含图片或视频文件；远程媒体地址失效后无法通过备份文件恢复媒体内容。
- 全部代码集中在 `index.html` + `app.js` + `styles.css`，无第三方框架；lucide 图标来自 CDN。
- 界面文案与代码注释均为 zh-CN。
