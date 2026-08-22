<div align="center">

<img src="assets/brand/logo.png" width="88" alt="Agnes Workbench Logo">

# Agnes Workbench

**A multimodal AI creation workbench in your browser · no framework · no bundler · works out of the box**

[![version](https://img.shields.io/badge/version-2.25.3-blue)](https://github.com/blackteaYES/agnes-workbench)
![pure JavaScript](https://img.shields.io/badge/pure%20JavaScript-no%20framework%20%7C%20no%20build-brightgreen)
![deploy](https://img.shields.io/badge/deploy-any%20static%20host-orange)
![data](https://img.shields.io/badge/data-stays%20local-green)

**[🚀 Live Demo](https://agnes-workbench.pages.dev)** · **[📖 Blog Post](https://blackteayes.github.io/vibe-coding/agnes-workbench.html)** · **[💬 Issues](https://github.com/blackteaYES/agnes-workbench/issues)**

[简体中文](README.md) ｜ **English**

<img src="docs/images/workbench-overview.png" alt="Agnes Workbench quick-start overview: chat, text-to-image, video generation and works management, three steps to start creating">

</div>

---

> **Note** — The application UI is currently in Simplified Chinese. This document is the English translation of the [Chinese README](README.md).

## Overview

Agnes Workbench brings **text chat, image generation, video generation and works management** into a single browser page. It is built with vanilla JavaScript — no frontend framework, no bundler, and no third-party CDN dependencies. Cloning the repository gives you a fully runnable app; the repository root is the publish directory.

It is for anyone who wants one lightweight entry point for multimodal creation instead of juggling multiple tools.

## ✨ Features

| Module | Capabilities |
|---|---|
| 💬 Chat | OpenAI-style streaming output, `reasoning_content` thinking process, thinking mode, multiple sessions, message editing and resending, image understanding |
| 🖼️ Image | Text-to-image / image-to-image / multi-image composite; size, ratio and style presets, random inspiration and targeted prompt optimization |
| 🎬 Video | Text-to-video / image-to-video / keyframe animation; rate-limit-aware backoff polling with manual refresh |
| 🗂️ Works | Image/video filtering, deletion, download, local caching and re-caching, backup import and export |

Supporting capabilities around the creation flow:

- **Text-to-image examples**: example images and full prompts loaded from an external JSON file; the example rail supports manual collapsing, horizontal scrolling and selection state.
- **Chat images**: file picking, drag-and-drop, HTTPS links, works picker and SVG attachments are unified; image links in messages render as zoomable thumbnails.
- **Reference images**: local upload, drag-and-drop, works collection and HTTPS links share one entry point; click to preview, drag to reorder, or swap keyframes directly.
- **Unified media preview**: images, videos, works and reference images share one preview layer; desktop uses dedicated navigation, mobile supports swipe switching, and the detail dialog shows saved generation parameters.
- **Layered local storage**: localStorage only keeps lightweight state; full messages, attachments and work media go into IndexedDB to avoid quota limits.
- **Local data management**: search, inspect and safely manage sessions, messages, chat attachments, work caches and read-only system metadata.
- **Unified settings center**: theme, UI density, motion, auto-save, retention counts, persistent storage, storage health checks and the Agnes connection in one place.

## 📸 Interface

### Chat & Image Understanding

<img src="docs/images/agnes-chat.png" alt="Agnes chat interface: streaming output, reasoning process and multi-session management">

### Image Generation

<img src="docs/images/generate-image.png" alt="Agnes image generation interface: text-to-image, image-to-image and multi-image composite">

### Video Generation

<img src="docs/images/generate-video.png" alt="Agnes video generation interface: text-to-video, image-to-video and keyframe animation">

### Works & Backup

<img src="docs/images/works.png" alt="Agnes works interface: image/video filtering, caching and backup">

## 🚀 Quick Start

Three steps to start creating:

### 1. Open the workbench

**Live demo** (recommended): visit <https://agnes-workbench.pages.dev>.

**Run locally**: the project has no frontend dependencies and no build step — serve the repository root with any static file server:

```powershell
uv run --no-cache python -m http.server 4173 --bind 127.0.0.1
```

Then open <http://127.0.0.1:4173/index.html>.

Chrome / Edge can also open `index.html` directly by double-clicking it: the example config automatically falls back to a local mirror and the official Agnes endpoints remain reachable. Browser policies for localStorage, IndexedDB and custom-endpoint CORS under `file://` vary, so HTTP(S) is still the recommended way to run.

### 2. Connect to the Agnes API

Open the "Connection" section in the settings center (top right):

1. Choose the international site, the China site, or a custom Base URL;
2. Enter your shared Agnes API Key;
3. Test the connection.

<img src="docs/images/model-config.png" alt="Agnes API connection settings in the settings center (UI in Chinese)">

The API Key is only stored in this browser's localStorage under `agnes-workbench.api-key`, sent as `Authorization: Bearer <key>`, and never enters works records, backups, IndexedDB or logs.

### 3. Start creating

Switch freely between the four modes: Chat, Image, Video and Works. Generated results are added to the works collection automatically, where you can cache, download and back them up.

## 🌐 Static Deployment

Cloudflare Pages can publish the repository root directly:

```text
Build command: leave empty
Output directory: .
Entry file: index.html
```

All runtime resources use relative paths; the Lucide icon set and fonts are bundled locally, with no third-party script or font CDN. GitHub Pages and any static HTTP(S) hosting work equally well.

The international and China API endpoints support cross-origin browser requests; custom APIs need CORS configured to allow your page origin.

## 🔌 Endpoints and Models

| Endpoint | Base URL |
|---|---|
| International (default) | `https://apihub.agnes-ai.com` |
| China | `https://apihub.agnes-ai.cn` |
| Custom | Any valid HTTPS URL; HTTP is allowed for localhost, 127.0.0.1 and `[::1]` during local debugging |

| Capability | Model |
|---|---|
| Chat | `agnes-2.5-flash` |
| Image | `agnes-image-2.1-flash` |
| Video | `agnes-video-v2.0` |

## 🖼️ Text-to-Image Example Config

The example config lives in [config/prompt-examples.json](config/prompt-examples.json) and only affects text-to-image mode; it supports one or more examples. Image-to-image and multi-image composite keep using the built-in prompt structure guides and do not read this JSON.

```json
{
  "version": 1,
  "textToImage": {
    "title": "Save a spot for your next masterpiece.",
    "description": "Pick a template as a starting point, then tune the prompt below.",
    "examples": [
      {
        "id": "wedding-invitation",
        "title": "Chinese Wedding Invitation",
        "image": "assets/prompt-examples/img/chinese-wedding-invitation.jpg",
        "alt": "Soft-lit bride portrait with a Chinese wedding invitation poster",
        "prompt": "Full prompt, ${placeholders} allowed"
      }
    ]
  }
}
```

Config rules:

- The file must be valid UTF-8 JSON; comments and trailing commas are not supported.
- `id` must be unique and stable — never rely on array indices; `title`, `image`, `alt` and `prompt` must be strings.
- Put local images in `assets/prompt-examples/img/` with paths relative to the repository root; public HTTPS image URLs also work.
- `${...}` placeholders are written into the prompt box verbatim and are never auto-replaced.
- Clicking an example fills in the full prompt, highlights it and smoothly scrolls the rail; the rail never auto-collapses — collapsing is fully user-controlled.
- If an image fails to load, a placeholder is shown but the prompt still fills in.

Under HTTP(S) the app fetches the JSON directly; when opening `index.html` by double-click, or if the JSON request fails, it falls back to [config/prompt-examples.generated.js](config/prompt-examples.generated.js). The JSON is the only hand-edited source — never edit the generated file by hand. After changing the JSON, run the sync script and commit the regenerated file:

```powershell
node scripts/sync-prompt-examples.mjs
node scripts/sync-prompt-examples.mjs --check
```

The sync script validates the structure, example IDs, image URL forms and local image paths, and detects a stale generated file.

## 💾 Local Storage

### localStorage

- `agnes-workbench.api-key`: the API Key.
- `agnes-workbench.v1`: lightweight app state — UI settings, connection endpoint, session index and works records.

Full message bodies, reasoning content and media binaries are never repeatedly written to localStorage.

### IndexedDB

Database: `agnes-workbench.storage`, current version `2`.

| Object store | Contents | Management |
|---|---|---|
| `sessions` | Session title, timestamps and message counts | View, search, create, rename, delete |
| `messages` | Full messages, roles, bodies and reasoning | View, search, add, edit safe fields, delete |
| `blobs` | Local chat images and SVG attachments | View metadata, delete |
| `workMedia` | Image blobs or manually cached video blobs | View cache status, delete local cache |
| `meta` | Migration and DB version records | Read-only |

Primary keys, foreign keys, blob binaries and the API Key are never editable. Deleting a session, message, attachment or cache asks for confirmation first; deleting a work's cache never deletes the work record or its remote URL.

The "Storage & Data" section of the settings center also provides:

- Browser usage and quota estimates, plus a persistent-storage request.
- Refreshed statistics, orphan attachment cleanup and cache cleanup.
- History compaction.
- Checks and repairs for orphaned messages, attachment references, work caches and session counts.

By default the latest 20 sessions and 40 works are kept, adjustable to `5–100` and `10–100` respectively.

## 🗂️ Work Caching and Backup

Work records and media caches form two layers:

```text
Work record (URL / prompt / parameters)
           +
optional IndexedDB media blob
```

- Newly generated images are cached asynchronously by default; entering the works page also retries caching older still-accessible images.
- Videos are not auto-cached; cache them manually from the work card.
- Display priority: local cache → remote URL → explicit media-unavailable state.
- Clearing the cache only frees browser space and never deletes work records.
- Caching fails when a third-party media URL lacks CORS permission, returns 403/404, is unreachable or has expired. The remote URL is kept, with "re-cache" and "open remote URL" still available.
- Storage quotas, private modes and eviction policies are up to the browser; for important works, export a backup and keep the media files separately.

The works page offers "Export backup" and "Import backup". Backup files are named like `agnes-works-<timestamp>.agnes-workbench.json`, with the format identifier `agnes-workbench-works`, currently at version `1`.

A backup contains the work type, title, creation time, media URL, full prompt, metadata and saved generation parameters; it never contains the API Key, chat sessions, image or video binaries, or UI and connection settings.

Imports are limited to a single JSON file of at most 5 MB. Before importing, the app reports valid, invalid, duplicate and truncated records; imports only merge in new works deduplicated by "media type + URL" and never overwrite or delete existing works. Once a remote URL expires, the JSON alone cannot recover the media file.

## 🎨 Theming and Responsive Layout

- Dark, light and system-following themes; comfortable and compact UI density.
- Full-motion and reduced-motion options, respecting the system `prefers-reduced-motion` setting.
- Desktop, tablet and mobile share the same main flows; on phones, mode switching, settings, storage management and help are reachable from the topbar workspace entry.
- The media preview hides overlay arrows on mobile in favor of left/right swipe.

## 🧪 Testing and Self-Checks

Regular static checks:

```powershell
Get-ChildItem assets\js -Filter *.js | ForEach-Object { node --check $_.FullName }
node --check app.js
node scripts/sync-prompt-examples.mjs --check
git diff --check
Get-Content -Raw -Encoding UTF8 config\prompt-examples.json | ConvertFrom-Json | Out-Null
```

The Playwright smoke test needs the Python package and Chromium. The script mocks the Agnes API via `page.route` and covers the chat, image understanding, image, video and works flows:

```powershell
uv pip install playwright
uv run playwright install chromium
uv run python tests/agnes_workbench_smoke.py
```

Manual browser checks are currently the primary verification; before a release, verify:

- International, China and custom endpoint connections.
- SVG, local images, drag-and-drop, works picker and the unified media preview.
- Text-to-image example loading, manual collapsing, selection state and prompt filling.
- Image generation, video polling and works saving.
- Session, works and IndexedDB cache restoration after refresh.
- Light/dark themes plus the mobile workspace and help entries.

## 📁 Project Structure

```text
agnes-workbench/
├── index.html                  # Page structure and asset wiring (single entry)
├── app.js                      # Bootstrap and page event wiring
├── assets/
│   ├── js/                     # Classic scripts loaded in dependency order (core → storage → ui → … → works)
│   ├── css/                    # Stylesheets numbered by cascade order
│   ├── vendor/                 # Bundled Lucide icon library
│   ├── fonts/                  # Bundled fonts
│   ├── brand/                  # Icons and brand assets
│   └── prompt-examples/img/    # Text-to-image example images
├── config/                     # Example JSON and its double-click-compatible mirror
├── scripts/                    # Example config sync/validation script
└── docs/images/                # Documentation images
```

## 🛠️ Technical Conventions

- `index.html` keeps the full static page structure; `app.js` only handles bootstrap and event wiring, with business logic in `assets/js/`.
- JavaScript is loaded as classic scripts in dependency order — no framework, no bundler, no ES Modules — for static hosting and Chrome / Edge double-click compatibility.
- CSS lives in `assets/css/` in its original cascade order from `index.html`; splitting never changes the existing UI, motion or responsive contracts.
- Runtime state lives in a single `state` source; all database I/O is centralized in `StorageRepository`.
- Lucide is pinned and bundled locally; dynamically inserted icons are initialized by `refreshIcons()`.
- UI copy and code comments are written in zh-CN.
- When changing HTML, JavaScript or CSS, bump `<title>` and the `v=...` cache versions in tandem; Markdown-only changes do not require a version bump.

## 📚 Links

- [Blog post: Agnes Workbench — a multimodal AI creation workbench in the browser](https://blackteayes.github.io/vibe-coding/agnes-workbench.html) (in Chinese)
- [Live demo](https://agnes-workbench.pages.dev)
- [Issues and feature suggestions](https://github.com/blackteaYES/agnes-workbench/issues)

---

<div align="center">

If Agnes Workbench helps you, consider giving it a ⭐ Star — it keeps the project going.

</div>
