# agnes-workbench

基于原生 JavaScript 的 Agnes AI 创作工作台（无框架、无打包器）。支持文本对话、图像生成、视频生成与作品历史，通过 Agnes API 驱动。

## 功能

- **文本对话** — OpenAI 风格流式输出，含思考模式（`reasoning_content`）、图像理解（上传图片 / HTTPS URL）、多会话与消息编辑/重发。
- **图像生成** — 文生图 / 图生图 / 多图合成，风格预设、提示词工作台（随机灵感 / 优化提示词）、输出档位与宽高比可调，参考图可从本地或作品库选择并长按拖拽排序。
- **视频生成** — 文生视频 / 图生视频 / 关键帧动画，关键帧可拖动调整顺序，异步任务 + 智能轮询（含限流退避），可手动刷新状态。
- **作品历史** — 仅保存媒体 URL、提示词摘要与元数据到浏览器 localStorage，绝不保存 API 密钥；图片和视频预览支持左右切换，视频进入预览后自动播放。

## 运行

无需构建，任选一个静态服务器托管仓库根目录即可：

```bash
uv run python -m http.server 4173
```

打开 `http://127.0.0.1:4173/index.html`，在「API 密钥」弹窗中填入 Agnes API Key（仅保存在本地 localStorage，以 `Authorization: Bearer` 发送请求）。

## 测试

冒烟测试（Playwright）通过 `page.route` 模拟 Agnes API：

```bash
uv sync
uv pip install playwright && uv run playwright install chromium
uv run python tests/agnes_workbench_smoke.py
```

## 技术要点

- API 基础 URL：`https://apihub.agnes-ai.com`；模型 `agnes-2.5-flash` / `agnes-image-2.1-flash` / `agnes-video-v2.0`；密钥 localStorage 键 `agnes-workbench.api-key`。
- 全部代码集中在 `index.html` + `app.js` + `styles.css`，无第三方框架；lucide 图标来自 CDN。
- 界面文案与代码注释均为 zh-CN。
