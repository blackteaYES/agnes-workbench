'use strict';

const CONFIG = {
  baseUrl: 'https://apihub.agnes-ai.com',
  models: {
    chat: 'agnes-2.5-flash',
    image: 'agnes-image-2.1-flash',
    video: 'agnes-video-v2.0'
  },
  storage: {
    key: 'agnes-workbench.api-key',
    state: 'agnes-workbench.v1'
  },
  timeouts: {
    chat: 120000,
    image: 360000,
    video: 90000,
    poll: 30000
  }
};

const MODE_META = {
  chat: { label: '文本对话', inspector: 'inspector-chat' },
  image: { label: '图像生成', inspector: 'inspector-image' },
  video: { label: '视频生成', inspector: 'inspector-video' },
  works: { label: '作品历史', inspector: 'inspector-works' }
};

const VIDEO_PRESETS = {
  3: { frames: 81, label: '约 3 秒' },
  5: { frames: 121, label: '约 5 秒' },
  10: { frames: 241, label: '约 10 秒' },
  18: { frames: 441, label: '约 18 秒' }
};

const VIDEO_POLL_POLICY = {
  initialDelay: 12000,
  maxDelay: 60000,
  backoffFactor: 1.5,
  rateLimitFallback: 30000,
  minimumRetryAfter: 1000,
  maximumRetryAfter: 120000,
  deadline: 10 * 60 * 1000
};

const VIDEO_DIMENSIONS = {
  '16:9': { width: 1152, height: 648 },
  '9:16': { width: 648, height: 1152 },
  '1:1': { width: 768, height: 768 },
  '4:3': { width: 1024, height: 768 },
  '3:4': { width: 768, height: 1024 }
};

const IMAGE_STYLE_PRESETS = {
  none: { label: '自由发挥', prompt: '' },
  cinematic: { label: '电影叙事', prompt: '电影级叙事画面，前中后景层次清晰，戏剧性光影，细腻质感，具有电影分镜般的视觉张力' },
  product: { label: '商业产品', prompt: '高级商业广告摄影，主体清晰突出，材质细节真实，干净背景，精确布光，适合品牌视觉与产品展示' },
  documentary: { label: '自然纪实', prompt: '自然纪实摄影，真实环境光，保留细节与肌理，克制的色彩，具有现场感和可信的生活气息' },
  oriental: { label: '东方意境', prompt: '东方美学意境，留白构图，含蓄雅致的色彩，轻盈的氛围，细节中带有传统文化气质' },
  neon: { label: '赛博霓虹', prompt: '赛博朋克视觉，霓虹灯色彩，冷暖对比，潮湿反光材质，未来城市氛围，高密度细节' },
  film: { label: '柔和胶片', prompt: '柔和胶片摄影质感，细微颗粒，低饱和复古色调，自然柔光，温润耐看的画面氛围' },
  illustration: { label: '艺术插画', prompt: '精致艺术插画，明确的造型语言，富有设计感的色彩与构图，细节丰富，画面完整统一' }
};

const IMAGE_PROMPT_GUIDES = {
  image: {
    title: '图生图提示词结构',
    parts: [
      '[改变要求]',
      '[新风格 / 场景]',
      '[需要添加或移除的元素]',
      '[需要保留的元素]'
    ],
    example: '将白天街道场景改为电影级赛博朋克夜景，添加霓虹招牌和湿滑路面倒影，同时保留原始街道布局、相机角度和主要建筑形状。'
  },
  composite: {
    title: '多图合成提示词结构',
    parts: [
      '[参考图角色]',
      '[目标场景]',
      '[图像之间的关系]',
      '[风格 / 光照 / 构图]'
    ],
    example: '将第一张图作为主要角色，第二张图作为产品参考，生成一张电影级活动海报，保留角色身份和产品外形，使用自然光照和干净的商业构图。'
  }
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

let state = loadState();
let apiKey = readStoredKey();
let imageReferences = [];
let imageResult = null;
let imageRequestController = null;
let imageCancelArmed = false;
let imageCancelTimer = 0;
let videoJob = null;
let videoImageRefs = [];
let videoKeyframeRefs = [];
let videoRefTarget = { mode: 'image', index: 0 };
let videoPollController = null;
let videoPollWake = null;
let videoRefreshRequested = false;
let videoRefreshInFlight = false;
let activeRequest = null;
let activeWorkFilter = 'all';
let editingMessageId = null;
let chatImage = null;
let chatImageSource = 'upload';
let promptAssistRequest = null;
let promptAssistActive = 'optimize';
let promptAssistCancelArmed = false;
let promptAssistCancelTimer = 0;
let imageActivePrompt = null;
let promptPrintStates = { image: null, video: null };
let toastTimer = 0;

class AgnesApiError extends Error {
  constructor(message, status = 0, payload = null, retryAfter = 0) {
    super(message);
    this.name = 'AgnesApiError';
    this.status = status;
    this.payload = payload;
    this.retryAfter = retryAfter;
  }
}

function defaultState() {
  return {
    activeMode: 'chat',
    activeChatId: null,
    chatSessions: [],
    works: [],
    ui: {
      chat: { temperature: 0.7, maxTokens: 2048, thinking: false, autoFullscreen: true },
      image: { mode: 'text', size: '2K', ratio: '1:1', stylePreset: 'none', keywordDirection: '' },
      video: { mode: 'text', duration: '5', ratio: '16:9', frameRate: '24', negativePrompt: '', seed: '' },
      layout: { sidebarCollapsed: true, inspectorCollapsed: true },
      workPickerAnimation: 'bounce'
    }
  };
}

function loadState() {
  const fallback = defaultState();
  try {
    const raw = localStorage.getItem(CONFIG.storage.state);
    if (!raw) return fallback;
    const saved = JSON.parse(raw);
    const next = { ...fallback, ...saved, ui: { ...fallback.ui, ...(saved.ui || {}) } };
    next.ui.chat = { ...fallback.ui.chat, ...(next.ui.chat || {}) };
    next.ui.image = { ...fallback.ui.image, ...(next.ui.image || {}) };
    next.ui.video = { ...fallback.ui.video, ...(next.ui.video || {}) };
    next.ui.layout = { ...fallback.ui.layout, ...(next.ui.layout || {}) };
    next.chatSessions = Array.isArray(next.chatSessions) ? next.chatSessions : [];
    next.works = Array.isArray(next.works) ? next.works : [];
    if (!next.activeChatId || !next.chatSessions.some((session) => session.id === next.activeChatId)) next.activeChatId = next.chatSessions[0]?.id || null;
    return next;
  } catch (error) {
    return fallback;
  }
}

function saveState() {
  try {
    localStorage.setItem(CONFIG.storage.state, JSON.stringify(state));
  } catch (error) {
    showToast('浏览器存储空间不足，已保留当前页面状态。', 'error');
  }
}

function readStoredKey() {
  try {
    return localStorage.getItem(CONFIG.storage.key) || '';
  } catch (error) {
    return '';
  }
}

function writeStoredKey(value) {
  try {
    if (value) localStorage.setItem(CONFIG.storage.key, value);
    else localStorage.removeItem(CONFIG.storage.key);
  } catch (error) {
    showToast('浏览器拒绝了本地存储，请检查隐私设置。', 'error');
  }
}

function createId(prefix) {
  const suffix = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${suffix}`;
}

function ensureChatSession() {
  if (state.activeChatId && state.chatSessions.some((session) => session.id === state.activeChatId)) return state.chatSessions.find((session) => session.id === state.activeChatId);
  const session = { id: createId('chat'), title: '新会话', createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
  state.chatSessions.unshift(session);
  state.activeChatId = session.id;
  saveState();
  return session;
}

function getActiveSession() {
  return ensureChatSession();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeMediaUrl(value) {
  if (!value || typeof value !== 'string') return '';
  if (value.startsWith('data:image/')) return value;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch (error) {
    return '';
  }
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch (error) {
    return false;
  }
}

function shortText(value, length = 70) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > length ? `${text.slice(0, length)}...` : text;
}

function formatDate(timestamp) {
  try {
    return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp));
  } catch (error) {
    return '--/-- --:--';
  }
}

function formatWaitDuration(milliseconds) {
  const seconds = Math.max(1, Math.ceil(Number(milliseconds || 0) / 1000));
  return seconds >= 60 ? `${Math.ceil(seconds / 60)} 分钟` : `${seconds} 秒`;
}

function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
}

function bindDragDrop(zone, onFiles, { disabledZone = null } = {}) {
  if (!zone) return;
  const isDisabled = () => (disabledZone ? disabledZone() : false);
  zone.addEventListener('dragenter', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isDisabled()) zone.classList.add('is-dragover');
  });
  zone.addEventListener('dragover', (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = isDisabled() ? 'none' : 'copy';
  });
  zone.addEventListener('dragleave', (event) => {
    event.preventDefault();
    event.stopPropagation();
    zone.classList.remove('is-dragover');
  });
  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    event.stopPropagation();
    zone.classList.remove('is-dragover');
    if (isDisabled()) return;
    onFiles(event.dataTransfer?.files || []);
  });
}

function updateRangeProgress(input) {
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const value = Number(input.value || min);
  const progress = max > min ? ((value - min) / (max - min)) * 100 : 0;
  input.style.setProperty('--range-progress', `${Math.max(0, Math.min(100, progress))}%`);
}

function showToast(message, type = 'info') {
  const region = $('#toast-region');
  if (!region) return;
  const toast = document.createElement('div');
  toast.className = `toast${type === 'error' ? ' is-error' : ''}`;
  toast.innerHTML = `<i data-lucide="${type === 'error' ? 'triangle-alert' : 'circle-check'}" aria-hidden="true"></i><span>${escapeHtml(message)}</span>`;
  region.appendChild(toast);
  refreshIcons();
  window.setTimeout(() => toast.remove(), 4200);
}

function showNoticeModal({ title, message, detail, confirmText = '我知道了', kicker = '下载提示' }) {
  const existing = $('#notice-modal');
  if (existing) existing.remove();
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = 'notice-modal';
  backdrop.innerHTML = `
    <section class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="notice-modal-title">
      <div class="modal-topline">
        <span class="section-kicker"><span class="signal-line"></span> ${escapeHtml(kicker)}</span>
        <button class="icon-button small" type="button" id="notice-modal-close" aria-label="关闭" data-tooltip="关闭"><i data-lucide="x" aria-hidden="true"></i></button>
      </div>
      <h2 id="notice-modal-title">${escapeHtml(title)}</h2>
      <p class="modal-copy">${escapeHtml(message)}</p>
      ${detail ? `<div class="modal-warning"><i data-lucide="triangle-alert" aria-hidden="true"></i><span>${escapeHtml(detail)}</span></div>` : ''}
      <div class="modal-actions"><button class="primary-action" type="button" id="notice-modal-confirm">${escapeHtml(confirmText)} <i data-lucide="check" aria-hidden="true"></i></button></div>
    </section>`;
  document.body.appendChild(backdrop);
  refreshIcons();
  const close = () => backdrop.remove();
  backdrop.querySelector('#notice-modal-close').addEventListener('click', close);
  backdrop.querySelector('#notice-modal-confirm').addEventListener('click', close);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });
  const confirmButton = backdrop.querySelector('#notice-modal-confirm');
  confirmButton.focus();
  return close;
}

function showConfirmModal({ title, message, kicker = '二次确认', confirmText = '确认执行', onConfirm }) {
  const existing = $('#confirm-modal');
  if (existing) existing.remove();
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = 'confirm-modal';
  backdrop.innerHTML = `
    <section class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
      <div class="modal-topline">
        <span class="section-kicker"><span class="signal-line"></span> ${escapeHtml(kicker)}</span>
        <button class="icon-button small" type="button" id="confirm-modal-close" aria-label="取消" data-tooltip="取消"><i data-lucide="x" aria-hidden="true"></i></button>
      </div>
      <h2 id="confirm-modal-title">${escapeHtml(title)}</h2>
      <p class="modal-copy">${escapeHtml(message)}</p>
      <div class="modal-warning"><i data-lucide="triangle-alert" aria-hidden="true"></i><span>此操作不可恢复，请确认是否继续。</span></div>
      <div class="modal-actions">
        <button class="text-button" type="button" id="confirm-modal-cancel"><i data-lucide="x" aria-hidden="true"></i>取消</button>
        <button class="primary-action is-danger" type="button" id="confirm-modal-ok"><i data-lucide="trash-2" aria-hidden="true"></i>${escapeHtml(confirmText)}</button>
      </div>
    </section>`;
  document.body.appendChild(backdrop);
  refreshIcons();
  const close = () => backdrop.remove();
  backdrop.querySelector('#confirm-modal-close').addEventListener('click', close);
  backdrop.querySelector('#confirm-modal-cancel').addEventListener('click', close);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });
  backdrop.querySelector('#confirm-modal-ok').addEventListener('click', () => { close(); onConfirm(); });
  backdrop.querySelector('#confirm-modal-ok').focus();
}

const PICKER_ANIMS = [
  { key: 'none', icon: 'ban', label: '无动画' },
  { key: 'ripple', icon: 'waves', label: '流水涟漪' },
  { key: 'beam', icon: 'zap', label: '光刃扫描' },
  { key: 'flip', icon: 'refresh-ccw', label: '翻转揭幕' },
  { key: 'bounce', icon: 'star', label: '弹跳落地' },
  { key: 'blast', icon: 'sparkles', label: '点阵点燃' },
  { key: 'kaleido', icon: 'flower', label: '万花筒旋转' },
  { key: 'deal', icon: 'layers', label: '抽卡发牌' },
  { key: 'shutter', icon: 'blinds', label: '百叶翻起' },
  { key: 'magnet', icon: 'magnet', label: '磁吸汇聚' }
];

const COORD_ANIMS = ['kaleido', 'deal', 'magnet'];

function openWorkPicker({ onPick, multi = false, max = 1, selected = [] }) {
  const images = state.works.filter((work) => work.kind === 'image' && safeMediaUrl(work.url));
  if (!images.length) { showToast('作品库还没有图片作品，先完成一次图像生成吧。', 'error'); return; }
  const existing = $('#work-picker-modal');
  if (existing) existing.remove();
  let anim = PICKER_ANIMS.some((a) => a.key === state.ui.workPickerAnimation) ? state.ui.workPickerAnimation : 'bounce';
  const selectedSet = new Set(selected.map((item) => (typeof item === 'string' ? item : item.url)));
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = 'work-picker-modal';
  backdrop.innerHTML = `
    <section class="modal-panel work-picker-panel" role="dialog" aria-modal="true" aria-labelledby="work-picker-title">
      <div class="modal-topline">
        <span class="section-kicker"><span class="signal-line"></span> 作品库</span>
        <button class="icon-button small" type="button" id="work-picker-close" aria-label="关闭" data-tooltip="关闭"><i data-lucide="x" aria-hidden="true"></i></button>
      </div>
      <h2 id="work-picker-title">选择作品图片</h2>
      <p class="modal-copy">${multi ? '单击预览大图，双击快速勾选；可多选，确认后作为参考图。' : '单击预览大图，双击或预览内选择，直接作为参考。'}</p>
      <div class="picker-anim-row">
        <span class="picker-anim-label">入场动画</span>
        <div class="picker-anim-options">
          ${PICKER_ANIMS.map((a) => '<button class="picker-anim-btn' + (a.key === anim ? ' is-active' : '') + '" type="button" data-picker-anim="' + a.key + '" title="' + a.label + '" aria-label="' + a.label + '"><i data-lucide="' + a.icon + '" aria-hidden="true"></i></button>').join('')}
        </div>
      </div>
      <div class="work-picker-grid"></div>
      ${multi ? '<div class="picker-actions"><span class="picker-count">已选 <strong id="work-picker-count">0</strong>/' + max + '</span><button class="primary-action" type="button" id="work-picker-confirm" disabled><i data-lucide="check" aria-hidden="true"></i>确定选择</button></div>' : ''}
    </section>`;
  document.body.appendChild(backdrop);
  refreshIcons();
  const close = () => backdrop.remove();
  backdrop.querySelector('#work-picker-close').addEventListener('click', close);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });

  const grid = backdrop.querySelector('.work-picker-grid');

  const cardMarkup = (work, index, isSelected) =>
    '<button class="work-picker-card' + (isSelected ? ' is-selected' : '') + '" type="button" style="--i:' + Math.floor(index / 4) + '" data-work-picker-url="' + escapeHtml(work.url) + '" data-work-picker-title="' + escapeHtml(work.title) + '" data-work-picker-meta="' + escapeHtml(work.meta || '') + '"><img src="' + escapeHtml(work.url) + '" alt="' + escapeHtml(work.title) + '" loading="lazy"><span class="pick-check"><i data-lucide="check" aria-hidden="true"></i></span><span>' + escapeHtml(shortText(work.title, 18)) + '</span></button>';

  const applyCoords = () => {
    const gridRect = grid.getBoundingClientRect();
    const gcx = gridRect.left + gridRect.width / 2;
    const gcy = gridRect.top + gridRect.height / 2;
    const cards = Array.from(grid.querySelectorAll('.work-picker-card'));
    if (!cards.length) return;
    const ref = cards[0].getBoundingClientRect();
    const cellW = ref.width + 10;
    const cellH = ref.height + 10;
    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const col = Math.max(0, Math.round((rect.left - gridRect.left) / cellW));
      const row = Math.max(0, Math.round((rect.top - gridRect.top) / cellH));
      let dx = 0;
      let dy = 0;
      let rot = 0;
      let d = 0;
      if (anim === 'kaleido') {
        dx = gcx - cx;
        dy = gcy - cy;
        rot = (Math.random() * 44 - 22).toFixed(1);
        d = Math.min(Math.hypot(dx, dy) * 1.3 + 30, 1200);
      } else if (anim === 'deal') {
        dx = (gridRect.left + 14) - cx;
        dy = (gridRect.top + 14) - cy;
        rot = -(14 - Math.random() * 8).toFixed(1);
        d = Math.min((col + row) * 55, 1400);
      } else if (anim === 'magnet') {
        const dTop = cy - gridRect.top;
        const dBottom = gridRect.bottom - cy;
        const dLeft = cx - gridRect.left;
        const dRight = gridRect.right - cx;
        const nearest = Math.min(dTop, dBottom, dLeft, dRight);
        dx = nearest === dLeft ? -360 : nearest === dRight ? 360 : 0;
        dy = nearest === dTop ? -360 : nearest === dBottom ? 360 : 0;
        d = Math.min(Math.hypot(cx - gcx, cy - gcy) * 1.6 + 40, 1200);
      }
      card.style.setProperty('--dx', dx.toFixed(1) + 'px');
      card.style.setProperty('--dy', dy.toFixed(1) + 'px');
      card.style.setProperty('--rot', rot + 'deg');
      card.style.setProperty('--d', d.toFixed(0) + 'ms');
    });
    grid.classList.add('picker-anim-' + anim);
  };

  const playAnimation = () => {
    if (COORD_ANIMS.includes(anim)) {
      requestAnimationFrame(() => requestAnimationFrame(() => applyCoords()));
    } else {
      grid.classList.add('picker-anim-' + anim);
    }
  };

  const buildCards = () => {
    const current = Array.from(grid.querySelectorAll('.work-picker-card.is-selected')).map((card) => card.dataset.workPickerUrl);
    grid.className = 'work-picker-grid';
    grid.innerHTML = images.map((work, index) => cardMarkup(work, index, selectedSet.has(work.url) || current.includes(work.url))).join('');
    refreshIcons();
    bindCardEvents();
    playAnimation();
    updateActions();
  };

  const updateActions = () => {
    if (!multi) return;
    const count = grid.querySelectorAll('.work-picker-card.is-selected').length;
    const label = backdrop.querySelector('#work-picker-count');
    if (label) label.textContent = String(count);
    const confirm = backdrop.querySelector('#work-picker-confirm');
    if (confirm) confirm.disabled = count === 0;
  };

  const fastPick = (card) => {
    if (card.classList.contains('is-selected')) {
      card.classList.remove('is-selected');
      updateActions();
      return true;
    }
    if (multi && grid.querySelectorAll('.work-picker-card.is-selected').length >= max) {
      showToast('最多选择 ' + max + ' 张。', 'error');
      return false;
    }
    card.classList.add('is-selected');
    updateActions();
    return true;
  };

  const openPreviewFor = (card) => {
    const index = images.findIndex((work) => work.url === card.dataset.workPickerUrl);
    if (index < 0) return;
    const items = images.map((work) => ({ url: safeMediaUrl(work.url), title: work.title, meta: work.meta || '', kind: 'image' }));
    const cardFor = (url) => grid.querySelector(`.work-picker-card[data-work-picker-url="${url.replace(/"/g, '&quot;')}"]`);
    const isItemSelected = (item) => {
      const el = cardFor(item.url);
      return el ? el.classList.contains('is-selected') : false;
    };
    if (multi) {
      openMediaPreview({
        items,
        index,
        isItemSelected,
        disabledWhenChoosing: () => grid.querySelectorAll('.work-picker-card.is-selected').length >= max,
        chooseDisabledLabel: `已达上限（最多 ${max} 张）`,
        onChoose: (item) => {
          const el = cardFor(item.url);
          if (!el) return;
          fastPick(el);
          updateActions();
        }
      });
    } else {
      openMediaPreview({
        items,
        index,
        onChoose: (item) => { close(); onPick({ url: item.url, title: item.title }); }
      });
    }
  };

  const bindCardEvents = () => {
    grid.querySelectorAll('[data-work-picker-url]').forEach((card) => {
      card.addEventListener('click', () => {
        clearTimeout(card._pickerClickTimer);
        card._pickerClickTimer = setTimeout(() => openPreviewFor(card), 200);
      });
      card.addEventListener('dblclick', () => {
        clearTimeout(card._pickerClickTimer);
        if (!multi) { close(); onPick({ url: card.dataset.workPickerUrl, title: card.dataset.workPickerTitle || '作品图片' }); return; }
        fastPick(card);
      });
      if (anim === 'bounce') {
        card.addEventListener('mousemove', (event) => {
          const rect = card.getBoundingClientRect();
          const rx = (event.clientX - rect.left) / rect.width - 0.5;
          const ry = (event.clientY - rect.top) / rect.height - 0.5;
          card.style.transform = 'perspective(520px) rotateX(' + (-ry * 9).toFixed(2) + 'deg) rotateY(' + (rx * 9).toFixed(2) + 'deg) translateY(-2px)';
        });
        card.addEventListener('mouseleave', () => { card.style.transform = ''; });
      }
    });
  };

  backdrop.querySelectorAll('[data-picker-anim]').forEach((btn) => btn.addEventListener('click', () => {
    anim = btn.dataset.pickerAnim;
    state.ui.workPickerAnimation = anim;
    saveState();
    backdrop.querySelectorAll('[data-picker-anim]').forEach((b) => b.classList.toggle('is-active', b === btn));
    buildCards();
  }));

  if (multi) {
    backdrop.querySelector('#work-picker-confirm').addEventListener('click', () => {
      const items = Array.from(grid.querySelectorAll('.work-picker-card.is-selected')).map((card) => ({ url: card.dataset.workPickerUrl, title: card.dataset.workPickerTitle || '作品图片' }));
      close();
      onPick(items);
    });
  }

  buildCards();
  return close;
}

function openMediaPreview({ items, index = 0, isItemSelected, onChoose, chooseLabel = '选择这张图', chooseSelectedLabel = '已选，点击取消', chooseDisabledLabel = '', disabledWhenChoosing, showCancel = true }) {
  const existing = $('#media-preview');
  if (existing) existing.remove();
  const list = Array.from(items || []).filter((item) => item && (item.url || item.src));
  if (!list.length) return;
  let current = Math.min(Math.max(0, index), list.length - 1);
  const navVisible = list.length > 1;
  const overlay = document.createElement('div');
  overlay.className = 'preview-backdrop';
  overlay.id = 'media-preview';
  overlay.innerHTML = `
    <div class="preview-stage">
      <button class="icon-button small preview-close" type="button" data-preview-action="close" aria-label="关闭预览" data-tooltip="关闭"><i data-lucide="x" aria-hidden="true"></i></button>
      <div class="preview-media-slot"></div>
      ${navVisible ? '<button class="preview-nav preview-nav-prev" type="button" data-preview-action="prev" aria-label="上一张" data-tooltip="上一张"><i data-lucide="chevron-left" aria-hidden="true"></i></button><button class="preview-nav preview-nav-next" type="button" data-preview-action="next" aria-label="下一张" data-tooltip="下一张"><i data-lucide="chevron-right" aria-hidden="true"></i></button>' : ''}
      <div class="preview-bar">
        <div class="preview-bar-left">
          <span class="preview-kind-badge"><i data-lucide="image" aria-hidden="true"></i><span data-preview-kind>图像</span></span>
          ${navVisible ? '<span class="preview-counter mono" data-preview-counter>1 / ' + list.length + '</span>' : ''}
          <div class="preview-meta"><strong data-preview-title></strong><span data-preview-meta></span></div>
        </div>
        <div class="preview-bar-actions">
          ${onChoose ? '<button class="primary-action" type="button" data-preview-action="choose"><i data-lucide="check" aria-hidden="true"></i><span data-preview-choose-label></span></button>' : ''}
          ${showCancel ? '<button class="text-button" type="button" data-preview-action="close">取消</button>' : ''}
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  refreshIcons();

  const mediaSlot = overlay.querySelector('.preview-media-slot');

  const renderMedia = () => {
    const item = list[current];
    const src = item.url || item.src;
    mediaSlot.innerHTML = item.kind === 'video'
      ? `<video controls autoplay muted playsinline preload="metadata" src="${escapeHtml(src)}"></video>`
      : `<img src="${escapeHtml(src)}" alt="${escapeHtml(item.title || '')}">`;
    const video = mediaSlot.querySelector('video');
    if (video) {
      try {
        const playback = video.play();
        if (playback?.catch) playback.catch(() => {});
      } catch (error) {
        // 浏览器阻止自动播放时保留控件，让用户手动开始。
      }
    }
    const badgeIcon = overlay.querySelector('.preview-kind-badge [data-lucide]');
    if (badgeIcon) badgeIcon.setAttribute('data-lucide', item.kind === 'video' ? 'clapperboard' : 'image');
    overlay.querySelector('.preview-kind-badge span[data-preview-kind]').textContent = item.kind === 'video' ? '视频' : '图像';
    const title = overlay.querySelector('[data-preview-title]');
    title.textContent = shortText(item.title || '作品', 34);
    title.title = item.title || '';
    const meta = overlay.querySelector('[data-preview-meta]');
    meta.textContent = item.meta ? ' · ' + shortText(item.meta, 80) : '';
    refreshIcons();
  };

  const updateNav = () => {
    if (!navVisible) return;
    overlay.querySelector('.preview-nav-prev').disabled = current <= 0;
    overlay.querySelector('.preview-nav-next').disabled = current >= list.length - 1;
    overlay.querySelector('[data-preview-counter]').textContent = `${current + 1} / ${list.length}`;
  };

  const updateChoose = () => {
    const button = overlay.querySelector('[data-preview-action="choose"]');
    if (!button) return;
    const item = list[current];
    const label = overlay.querySelector('[data-preview-choose-label]');
    const selected = isItemSelected ? Boolean(isItemSelected(item, current)) : false;
    const capped = Boolean(!selected && disabledWhenChoosing && disabledWhenChoosing(item, current));
    button.setAttribute('aria-disabled', capped ? 'true' : 'false');
    label.textContent = selected ? chooseSelectedLabel : (capped ? (chooseDisabledLabel || chooseLabel) : chooseLabel);
  };

  const go = (delta) => {
    const next = current + delta;
    if (next < 0 || next >= list.length) return;
    current = next;
    renderMedia();
    updateNav();
    updateChoose();
    overlay.querySelector('.preview-media-slot').firstElementChild.style.animation = 'none';
    window.requestAnimationFrame(() => { const el = mediaSlot.firstElementChild; if (el) el.style.animation = ''; });
  };

  const close = () => {
    document.removeEventListener('keydown', onKeys);
    overlay.remove();
  };

  const onKeys = (event) => {
    if (event.key === 'Escape') { close(); return; }
    if (!navVisible) return;
    if (event.key === 'ArrowLeft') go(-1);
    if (event.key === 'ArrowRight') go(1);
  };

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) { close(); return; }
    const action = event.target.closest('[data-preview-action]')?.dataset.previewAction;
    if (!action) return;
    if (action === 'close') close();
    else if (action === 'prev') go(-1);
    else if (action === 'next') go(1);
    else if (action === 'choose') {
      const item = list[current];
      if (isItemSelected && isItemSelected(item, current)) {
        onChoose(item, current);
        updateChoose();
        return;
      }
      if (disabledWhenChoosing && disabledWhenChoosing(item, current)) {
        showToast(chooseDisabledLabel || '已达选择上限。', 'error');
        return;
      }
      onChoose(item, current);
      updateChoose();
    }
  });
  renderMedia();
  updateNav();
  updateChoose();
  document.addEventListener('keydown', onKeys);
}

function updateKeyStatus(connected = false) {
  const text = $('#api-status-text');
  const dot = $('#api-status-dot');
  const status = $('#api-status');
  const sidebarState = $('#sidebar-key-state');
  if (apiKey && connected) {
    text.textContent = '已连接';
    sidebarState.textContent = '已验证';
    status.classList.add('is-connected');
    dot.classList.add('is-live');
    return;
  }
  if (apiKey) {
    text.textContent = '密钥已保存';
    sidebarState.textContent = '已保存';
    status.classList.remove('is-connected');
    dot.classList.remove('is-live');
    return;
  }
  text.textContent = '未配置密钥';
  sidebarState.textContent = '未配置';
  status.classList.remove('is-connected');
  dot.classList.remove('is-live');
}

function openKeyModal() {
  const modal = $('#key-modal');
  const input = $('#api-key-input');
  modal.hidden = false;
  input.value = apiKey;
  window.setTimeout(() => input.focus(), 30);
}

function closeKeyModal() {
  $('#key-modal').hidden = true;
}

function requireApiKey() {
  if (apiKey) return true;
  openKeyModal();
  showToast('请先配置 Agnes API 密钥。', 'error');
  return false;
}

function combineSignals(externalSignal, timeoutSignal) {
  if (!externalSignal) return timeoutSignal;
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function') return AbortSignal.any([externalSignal, timeoutSignal]);
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (externalSignal.aborted || timeoutSignal.aborted) controller.abort();
  externalSignal.addEventListener('abort', abort, { once: true });
  timeoutSignal.addEventListener('abort', abort, { once: true });
  return controller.signal;
}

function parseRetryAfter(value) {
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, Math.round(seconds * 1000));
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : Math.max(0, timestamp - Date.now());
}

async function fetchAgnes(path, init = {}, timeoutMs = 120000) {
  const timeoutController = new AbortController();
  const timer = window.setTimeout(() => timeoutController.abort(), timeoutMs);
  const signal = combineSignals(init.signal, timeoutController.signal);
  try {
    const response = await fetch(`${CONFIG.baseUrl}${path}`, { ...init, signal, headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
    if (!response.ok) {
      const raw = await response.text();
      let payload = null;
      try { payload = raw ? JSON.parse(raw) : null; } catch (error) { payload = raw; }
      throw new AgnesApiError(getApiErrorMessage(response.status, payload), response.status, payload, parseRetryAfter(response.headers.get('Retry-After')));
    }
    return response;
  } catch (error) {
    if (error instanceof AgnesApiError) throw error;
    if (error.name === 'AbortError') throw error;
    throw new AgnesApiError('网络请求失败，请检查网络、CORS 或 Agnes 网关状态。', 0, error);
  } finally {
    window.clearTimeout(timer);
  }
}

async function fetchAgnesJson(path, init = {}, timeoutMs = 120000) {
  const response = await fetchAgnes(path, init, timeoutMs);
  const raw = await response.text();
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (error) { throw new AgnesApiError('Agnes 返回了无法解析的响应。', response.status, raw); }
}

function getApiErrorMessage(status, payload) {
  const detail = payload?.error?.message || payload?.message || payload?.detail;
  if (detail) return `Agnes API：${detail}`;
  const messages = { 400: '请求参数无效，请检查提示词和生成设置。', 401: 'API Key 未授权，请检查 Key 是否正确。', 404: '任务或接口不存在，请检查任务 ID。', 429: 'Agnes 查询过于频繁，请稍后再试。', 500: 'Agnes 服务端错误，请稍后重试。', 503: 'Agnes 当前繁忙，请稍后重试。' };
  return messages[status] || `Agnes API 请求失败（${status}）。`;
}

function textFromChatContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.filter((part) => part?.type === 'text').map((part) => part.text || '').join('\n');
}

function messageForApi(message) {
  const content = message.role === 'user' && typeof message.content === 'string'
    ? [{ type: 'text', text: message.content }]
    : message.content;
  return { role: message.role, content };
}

function appendChatPart(result, part, kind = 'content') {
  if (Array.isArray(part)) {
    part.forEach((item) => {
      const type = String(item?.type || '').toLowerCase();
      const nextKind = type.includes('reason') || type.includes('think') ? 'reasoning' : kind;
      appendChatPart(result, item, nextKind);
    });
    return;
  }
  if (part && typeof part === 'object') {
    const value = part.text ?? part.content ?? part.value;
    if (value !== undefined) appendChatPart(result, value, kind);
    ['reasoning_content', 'reasoning', 'thinking', 'thought'].forEach((key) => {
      if (part[key] !== undefined) appendChatPart(result, part[key], 'reasoning');
    });
    return;
  }
  if (typeof part === 'string') result[kind] += part;
}

function parseChatParts(value) {
  const result = { content: '', reasoning: '' };
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    appendChatPart(result, value.content, 'content');
    ['reasoning_content', 'reasoning', 'thinking', 'thought'].forEach((key) => {
      if (value[key] !== undefined) appendChatPart(result, value[key], 'reasoning');
    });
    if (!value.content && value.text !== undefined) appendChatPart(result, value.text, 'content');
    return result;
  }
  appendChatPart(result, value, 'content');
  return result;
}

async function readChatStream(response, onToken, onReasoningToken, signal) {
  if (!response.body) return { content: '' };
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let reasoning = '';
  let usage = null;

  const handleLine = (line) => {
    if (!line.startsWith('data:')) return;
    const payloadText = line.slice(5).trim();
    if (!payloadText || payloadText === '[DONE]') return;
    let payload;
    try { payload = JSON.parse(payloadText); } catch (error) { return; }
    if (payload.error) throw new AgnesApiError(payload.error.message || '流式响应失败。', payload.error.code || 0, payload);
    const parsed = parseChatParts(payload.choices?.[0]?.delta || payload.choices?.[0]?.message || {});
    if (parsed.content) { content += parsed.content; onToken(parsed.content); }
    if (parsed.reasoning) { reasoning += parsed.reasoning; onReasoningToken?.(parsed.reasoning); }
    if (payload.usage) usage = payload.usage;
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (signal?.aborted) throw new DOMException('请求已停止。', 'AbortError');
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    lines.forEach(handleLine);
  }
  if (buffer) handleLine(buffer);
  return { content, reasoning, usage };
}

const AgnesClient = {
  async chat({ messages, settings, onToken, onReasoningToken, signal }) {
    const thinkingEnabled = Boolean(settings.thinking);
    const body = { model: CONFIG.models.chat, messages: messages.map(messageForApi), temperature: Number(settings.temperature), max_tokens: Number(settings.maxTokens), stream: true, chat_template_kwargs: { enable_thinking: thinkingEnabled } };
    const response = await fetchAgnes('/v1/chat/completions', { method: 'POST', body: JSON.stringify(body), signal }, CONFIG.timeouts.chat);
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/event-stream')) return readChatStream(response, onToken, onReasoningToken, signal);
    const payload = await response.json();
    const parsed = parseChatParts(payload.choices?.[0]?.message || {});
    if (parsed.content) onToken(parsed.content);
    if (parsed.reasoning) onReasoningToken?.(parsed.reasoning);
    return { content: parsed.content, reasoning: parsed.reasoning, usage: payload.usage || null };
  },

  async generateImage({ prompt, size, ratio, images, signal }) {
    const extraBody = { response_format: 'url' };
    if (images.length) extraBody.image = images;
    return fetchAgnesJson('/v1/images/generations', { method: 'POST', body: JSON.stringify({ model: CONFIG.models.image, prompt, size, ratio, extra_body: extraBody }), signal }, CONFIG.timeouts.image);
  },

  async createVideo({ mode, prompt, imageUrl, keyframeUrls, settings, signal }) {
    const dimensions = VIDEO_DIMENSIONS[settings.ratio] || VIDEO_DIMENSIONS['16:9'];
    const preset = VIDEO_PRESETS[settings.duration] || VIDEO_PRESETS[5];
    const body = { model: CONFIG.models.video, prompt, width: dimensions.width, height: dimensions.height, num_frames: preset.frames, frame_rate: Number(settings.frameRate) };
    if (settings.negativePrompt) body.negative_prompt = settings.negativePrompt;
    if (settings.seed !== '') body.seed = Number(settings.seed);
    if (mode === 'image') body.image = imageUrl;
    if (mode === 'keyframes') body.extra_body = { image: keyframeUrls, mode: 'keyframes' };
    return fetchAgnesJson('/v1/videos', { method: 'POST', body: JSON.stringify(body), signal }, CONFIG.timeouts.video);
  },

  async getVideo(videoId, signal) {
    return fetchAgnesJson(`/agnesapi?video_id=${encodeURIComponent(videoId)}`, { method: 'GET', signal }, CONFIG.timeouts.poll);
  }
};

function init() {
  ensureChatSession();
  bindEvents();
  syncUiControls();
  setMode(state.activeMode || 'chat');
  renderChat();
  renderImageResult();
  renderVideoJob();
  renderVideoRefs();
  renderWorks();
  updateKeyStatus(false);
  applyLayoutState();
  refreshIcons();
}

function bindEvents() {
  $$('.nav-item').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
  $('#open-key-settings').addEventListener('click', openKeyModal);
  $('#sidebar-key-settings').addEventListener('click', openKeyModal);
  $('#close-key-settings').addEventListener('click', closeKeyModal);
  $('#key-modal').addEventListener('click', (event) => { if (event.target === $('#key-modal')) closeKeyModal(); });
  $('#save-api-key').addEventListener('click', saveApiKey);
  $('#clear-api-key').addEventListener('click', () => showConfirmModal({
    title: '清除本地 API 密钥',
    message: '当前浏览器中保存的 API 密钥将被移除，之后所有模式都需要重新配置密钥。',
    confirmText: '确认清除',
    onConfirm: clearApiKey
  }));
  $('#toggle-key-visibility').addEventListener('click', toggleKeyVisibility);

  $('#new-chat').addEventListener('click', startNewChat);
  $('#clear-chat').addEventListener('click', () => showConfirmModal({
    title: '清空当前会话',
    message: '当前会话的所有消息将被移除，且无法撤销。',
    confirmText: '确认清空',
    onConfirm: clearCurrentChat
  }));
  $('#chat-form').addEventListener('submit', handleChatSubmit);
  $('#chat-send').addEventListener('click', () => { if (activeRequest) activeRequest.abort(); });
  $('#chat-input').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      $('#chat-form').requestSubmit();
    }
  });
  $('#chat-vision-toggle').addEventListener('click', () => { $('#chat-vision-panel').hidden = !$('#chat-vision-panel').hidden; });
  $$('[data-chat-image-source]').forEach((button) => button.addEventListener('click', () => setChatImageSource(button.dataset.chatImageSource)));
  $('#chat-image-file-input').addEventListener('change', handleChatImageFile);
  $('#chat-image-preview').addEventListener('click', handleChatImagePreviewAction);
  $('#chat-clear-image').addEventListener('click', clearChatImageInput);
  $('#chat-suggestions').addEventListener('click', (event) => {
    const button = event.target.closest('[data-prompt]');
    if (!button) return;
    $('#chat-input').value = button.dataset.prompt;
    $('#chat-input').focus();
  });
  $('#chat-messages').addEventListener('click', handleMessageAction);
  $('#chat-messages').addEventListener('keydown', handleMessageAction);

  $$('.segment-button[data-image-mode]').forEach((button) => button.addEventListener('click', () => setImageMode(button.dataset.imageMode)));
  $('#image-file-input').addEventListener('change', handleImageFiles);
  bindDragDrop($('#image-drop-zone'), (files) => addImageReferenceFiles(files));
  $('#image-reference-grid').addEventListener('click', (event) => { if (event.target.closest('[data-reference-action="remove"]')) handleReferenceAction(event); else handleReferenceGridClick(event); });
  $('#image-reference-grid').addEventListener('pointerdown', startReferenceDrag);
  $('#image-prompt-structure').addEventListener('click', handleImageStructureAction);
  $('#image-result').addEventListener('click', handleImageResultAction);
  $('#image-pick-work').addEventListener('click', () => {
    const maxRefs = imageModeMaxRefs();
    const room = maxRefs - imageReferences.length;
    if (room <= 0) { showToast(`参考图已满 ${maxRefs} 张，先移除部分再选择。`, 'error'); return; }
    const workUrls = new Set(state.works.filter((work) => work.kind === 'image').map((work) => safeMediaUrl(work.url)).filter(Boolean));
    const selectedWorkUrls = imageReferences
      .map((reference) => safeMediaUrl(reference.dataUrl || reference.url))
      .filter((url) => workUrls.has(url));
    openWorkPicker({
      multi: true,
      max: room + selectedWorkUrls.length,
      selected: selectedWorkUrls,
      onPick: (items) => {
        const selectedUrls = new Set(items.map((item) => safeMediaUrl(item.url)).filter(Boolean));
        imageReferences = imageReferences.filter((reference) => {
          const url = safeMediaUrl(reference.dataUrl || reference.url);
          return !workUrls.has(url) || selectedUrls.has(url);
        });
        const existingUrls = new Set(imageReferences.map((reference) => safeMediaUrl(reference.dataUrl || reference.url)).filter(Boolean));
        items.forEach((item) => {
          const url = safeMediaUrl(item.url);
          if (!url || existingUrls.has(url)) return;
          imageReferences.push({ id: createId('ref'), name: item.title, url: item.url });
          existingUrls.add(url);
        });
        renderImageReferences();
      }
    });
  });
  $('#image-pick-link').addEventListener('click', () => {
    const maxRefs = imageModeMaxRefs();
    const room = maxRefs - imageReferences.length;
    if (room <= 0) { showToast(`参考图已满 ${maxRefs} 张，先移除部分再添加。`, 'error'); return; }
    openImageUrlModal();
  });
  $('#image-generate').addEventListener('click', handleImageGenerate);
  $('#image-copy-url').addEventListener('click', () => imageResult?.url && copyText(imageResult.url));
  $('#image-open').addEventListener('click', () => {
    const url = imageResult?.url && safeMediaUrl(imageResult.url);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else showToast('暂无可用地址。', 'error');
  });
  $('#image-download').addEventListener('click', () => imageResult?.url && downloadAsset(imageResult.url, 'agnes-image.png', 'image'));
  $$('[data-image-size]').forEach((button) => button.addEventListener('click', () => selectChoice('image', 'size', button.dataset.imageSize)));
  $$('[data-image-ratio]').forEach((button) => button.addEventListener('click', () => selectChoice('image', 'ratio', button.dataset.imageRatio)));
  $$('[data-image-style]').forEach((button) => button.addEventListener('click', () => setImageStylePreset(button.dataset.imageStyle)));
  $('#image-keywords').addEventListener('input', (event) => { state.ui.image.keywordDirection = event.target.value; saveState(); });
  $('#image-random-prompt').addEventListener('click', () => {
    if (promptAssistRequest) { handlePromptAssistCancel('random'); return; }
    requestImagePrompt('random');
  });
  $('#image-optimize-prompt').addEventListener('click', () => {
    if (promptAssistRequest) { handlePromptAssistCancel('optimize'); return; }
    requestImagePrompt('optimize');
  });

  $$('.segment-button[data-video-mode]').forEach((button) => button.addEventListener('click', () => setVideoMode(button.dataset.videoMode)));
  $('#video-generate').addEventListener('click', handleVideoGenerate);
  $('#video-stop').addEventListener('click', stopVideoPolling);
  $('#video-refresh').addEventListener('click', refreshVideoStatus);
  $('#video-image-inputs').addEventListener('click', (event) => handleVideoRefAction('image', event));
  $('#video-keyframe-inputs').addEventListener('click', (event) => handleVideoRefAction('keyframes', event));
  $('#video-image-file-input').addEventListener('change', (event) => handleVideoRefFiles('image', event));
  $('#video-keyframe-file-input').addEventListener('change', (event) => handleVideoRefFiles('keyframes', event));
  bindDragDrop($('#video-image-ref-grid'), (files) => addVideoRefFile('image', 0, files), { disabledZone: () => state.ui.video.mode !== 'image' });
  bindDragDrop($('#video-keyframe-slot-0'), (files) => addVideoRefFile('keyframes', 0, files), { disabledZone: () => state.ui.video.mode !== 'keyframes' });
  bindDragDrop($('#video-keyframe-slot-1'), (files) => addVideoRefFile('keyframes', 1, files), { disabledZone: () => state.ui.video.mode !== 'keyframes' });
  $$('[data-video-duration]').forEach((button) => button.addEventListener('click', () => selectChoice('video', 'duration', button.dataset.videoDuration)));
  $$('[data-video-ratio]').forEach((button) => button.addEventListener('click', () => selectChoice('video', 'ratio', button.dataset.videoRatio)));
  $('#video-frame-rate').addEventListener('change', (event) => { state.ui.video.frameRate = event.target.value; saveState(); });
  $('#video-negative-prompt').addEventListener('input', (event) => { state.ui.video.negativePrompt = event.target.value; saveState(); });
  $('#video-seed').addEventListener('input', (event) => { state.ui.video.seed = event.target.value; saveState(); });

  $('#chat-temperature').addEventListener('input', (event) => { state.ui.chat.temperature = Number(event.target.value); $('#chat-temperature-value').textContent = Number(event.target.value).toFixed(2); updateRangeProgress(event.target); saveState(); });
  $('#chat-max-tokens').addEventListener('change', (event) => { state.ui.chat.maxTokens = Number(event.target.value); saveState(); });
  $('#chat-thinking').addEventListener('change', (event) => { state.ui.chat.thinking = event.target.checked; saveState(); renderChat(); });
  $('#chat-thinking-hint').addEventListener('click', toggleChatThinkingFromHint);
  $('#chat-auto-fullscreen').addEventListener('change', (event) => { state.ui.chat.autoFullscreen = event.target.checked; saveState(); });
  $('#chat-fullscreen-toggle').addEventListener('click', toggleChatFullscreen);
  $('#image-fullscreen-toggle').addEventListener('click', () => toggleModeFullscreen('image'));
  $('#video-fullscreen-toggle').addEventListener('click', () => toggleModeFullscreen('video'));
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (document.querySelector('.modal-backdrop:not([hidden]), .preview-backdrop')) return;
    const activeMode = ['chat', 'image', 'video'].find((mode) => isModeFullscreen(mode));
    if (activeMode) toggleModeFullscreen(activeMode);
  });

  $$('.filter-tab').forEach((button) => button.addEventListener('click', () => { activeWorkFilter = button.dataset.workFilter; renderWorks(); }));
  $('#clear-works').addEventListener('click', () => showConfirmModal({
    title: '清除作品记录',
    message: '作品库中的所有记录（仅保存的 URL 与元数据）将被移除，且无法撤销。',
    confirmText: '确认清除',
    onConfirm: clearWorks
  }));
  $('#works-grid').addEventListener('click', handleWorkAction);
  $('#sidebar-collapse-toggle').addEventListener('click', toggleSidebarCollapse);
  $('#inspector-open-toggle').addEventListener('click', toggleInspectorCollapse);
  $('#inspector-collapse-toggle').addEventListener('click', toggleInspectorCollapse);
  $('#mobile-inspector-toggle').addEventListener('click', () => $('#inspector-panel').classList.toggle('is-mobile-open'));
  $('#mobile-inspector-close').addEventListener('click', () => $('#inspector-panel').classList.remove('is-mobile-open'));
}

function syncUiControls() {
  $('#chat-temperature').value = state.ui.chat.temperature;
  $('#chat-temperature-value').textContent = Number(state.ui.chat.temperature).toFixed(2);
  updateRangeProgress($('#chat-temperature'));
  $('#chat-max-tokens').value = String(state.ui.chat.maxTokens);
  $('#chat-thinking').checked = Boolean(state.ui.chat.thinking);
  $('#chat-auto-fullscreen').checked = Boolean(state.ui.chat.autoFullscreen);
  updateChatStatusHints();
  $('#video-frame-rate').value = String(state.ui.video.frameRate);
  $('#video-negative-prompt').value = state.ui.video.negativePrompt || '';
  $('#video-seed').value = state.ui.video.seed || '';
  $('#image-keywords').value = state.ui.image.keywordDirection || '';
  setImageStylePreset(state.ui.image.stylePreset, false);
  setChoiceButtons('[data-image-size]', state.ui.image.size);
  setChoiceButtons('[data-image-ratio]', state.ui.image.ratio);
  setChoiceButtons('[data-video-duration]', state.ui.video.duration);
  setChoiceButtons('[data-video-ratio]', state.ui.video.ratio);
  setImageMode(state.ui.image.mode, false);
  setVideoMode(state.ui.video.mode, false);
  updateVideoEstimate();
}

function applyLayoutState() {
  const sidebarCollapsed = Boolean(state.ui.layout?.sidebarCollapsed);
  const inspectorCollapsed = Boolean(state.ui.layout?.inspectorCollapsed);
  $('.app-shell').classList.toggle('sidebar-collapsed', sidebarCollapsed);
  $('.content-grid').classList.toggle('inspector-collapsed', inspectorCollapsed);

  const sidebarButton = $('#sidebar-collapse-toggle');
  const sidebarIcon = $('#sidebar-collapse-toggle [data-lucide]');
  if (sidebarButton && sidebarIcon) {
    const label = sidebarCollapsed ? '展开导航栏' : '收起导航栏';
    sidebarButton.setAttribute('aria-label', label);
    sidebarButton.dataset.tooltip = label;
    sidebarIcon.setAttribute('data-lucide', sidebarCollapsed ? 'panel-left-open' : 'panel-left-close');
  }

  const collapseButton = $('#inspector-collapse-toggle');
  const openButton = $('#inspector-open-toggle');
  const label = inspectorCollapsed ? '展开设置面板' : '收起设置面板';
  if (collapseButton) {
    collapseButton.setAttribute('aria-label', label);
    collapseButton.dataset.tooltip = label;
    collapseButton.classList.toggle('is-active', inspectorCollapsed);
  }
  if (openButton) openButton.classList.toggle('is-hidden', !inspectorCollapsed);
  refreshIcons();
}

function toggleSidebarCollapse() {
  state.ui.layout.sidebarCollapsed = !state.ui.layout.sidebarCollapsed;
  saveState();
  applyLayoutState();
}

function toggleInspectorCollapse() {
  state.ui.layout.inspectorCollapsed = !state.ui.layout.inspectorCollapsed;
  saveState();
  applyLayoutState();
}

const FULLSCREEN_MODES = { chat: 'chat-fullscreen', image: 'image-fullscreen', video: 'video-fullscreen' };

function isModeFullscreen(mode) {
  return $('.app-shell').classList.contains(FULLSCREEN_MODES[mode]);
}

function isChatFullscreen() {
  return isModeFullscreen('chat');
}

function toggleModeFullscreen(mode) {
  const enter = !isModeFullscreen(mode);
  const shell = $('.app-shell');
  Object.values(FULLSCREEN_MODES).forEach((name) => shell.classList.remove(name));
  if (enter) shell.classList.add(FULLSCREEN_MODES[mode]);
  const button = $(`#${mode}-fullscreen-toggle`);
  if (button) {
    button.setAttribute('aria-label', enter ? '退出全屏' : '进入全屏');
    button.setAttribute('data-tooltip', enter ? '退出全屏' : '进入全屏');
    button.innerHTML = `<i data-lucide="${enter ? 'minimize-2' : 'maximize-2'}" aria-hidden="true"></i>`;
  }
  refreshIcons();
  const mobileToggle = $('#mobile-inspector-toggle');
  const topbarActions = $('.topbar-actions');
  if (mobileToggle && topbarActions) {
    if (enter && mobileToggle.parentElement !== shell) {
      shell.appendChild(mobileToggle);
    } else if (!enter && mobileToggle.parentElement === shell) {
      topbarActions.appendChild(mobileToggle);
    }
  }
  if (enter && mode === 'chat') {
    const container = $('#chat-messages');
    if (container) container.scrollTop = container.scrollHeight;
  }
}

function toggleChatFullscreen() {
  toggleModeFullscreen('chat');
}

function setMode(mode) {
  const nextMode = MODE_META[mode] ? mode : 'chat';
  state.activeMode = nextMode;
  document.body.dataset.appMode = nextMode;
  saveState();
  $$('.nav-item').forEach((button) => button.classList.toggle('is-active', button.dataset.mode === nextMode));
  $$('[data-mode-panel]').forEach((panel) => panel.classList.toggle('is-hidden', panel.dataset.modePanel !== nextMode));
  $('#mode-breadcrumb').textContent = MODE_META[nextMode].label;
  $$('.inspector-content').forEach((panel) => panel.classList.toggle('is-hidden', panel.id !== MODE_META[nextMode].inspector));
  if (nextMode === 'works') renderWorks();
  $('#inspector-panel').classList.remove('is-mobile-open');
  syncChatFocusMode();
  refreshIcons();
}

function selectChoice(type, key, value) {
  state.ui[type][key] = value;
  setChoiceButtons(`[data-${type}-${key}]`, value);
  if (type === 'video' && key === 'duration') updateVideoEstimate();
  saveState();
}

function setChoiceButtons(selector, value) {
  $$(selector).forEach((button) => {
    const dataKey = Object.keys(button.dataset).find((key) => key !== 'mode' && key !== 'prompt' && key !== 'workFilter');
    button.classList.toggle('is-active', dataKey ? button.dataset[dataKey] === String(value) : false);
  });
}

function updateVideoEstimate() {
  const settings = VIDEO_PRESETS[state.ui.video.duration] || VIDEO_PRESETS[5];
  $('#video-estimate').innerHTML = `<i data-lucide="clock-3" aria-hidden="true"></i> ${settings.label} / ${settings.frames} 帧`;
  refreshIcons();
}

function saveApiKey() {
  const value = $('#api-key-input').value.trim();
  if (!value) { showToast('API 密钥不能为空。', 'error'); return; }
  apiKey = value;
  writeStoredKey(apiKey);
  updateKeyStatus(false);
  closeKeyModal();
  showToast('API 密钥已保存在当前浏览器。');
}

function clearApiKey() {
  apiKey = '';
  writeStoredKey('');
  updateKeyStatus(false);
  $('#api-key-input').value = '';
  closeKeyModal();
  showToast('本地 API 密钥已清除。');
}

function toggleKeyVisibility() {
  const input = $('#api-key-input');
  const icon = $('#toggle-key-visibility [data-lucide]');
  input.type = input.type === 'password' ? 'text' : 'password';
  if (icon) icon.setAttribute('data-lucide', input.type === 'password' ? 'eye' : 'eye-off');
  refreshIcons();
}

function startNewChat() {
  const session = { id: createId('chat'), title: '新会话', createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
  state.chatSessions.unshift(session);
  state.activeChatId = session.id;
  editingMessageId = null;
  saveState();
  renderChat();
  showToast('已创建新会话。');
}

function clearCurrentChat() {
  if (activeRequest) activeRequest.abort();
  const session = getActiveSession();
  session.messages = [];
  session.title = '新会话';
  session.updatedAt = Date.now();
  editingMessageId = null;
  saveState();
  renderChat();
}

function hasChatConversation(session = getActiveSession()) {
  return session.messages.some((message) => message.role === 'user');
}

function updateChatStatusHints() {
  const hint = $('#chat-thinking-hint');
  if (!hint) return;
  const enabled = Boolean(state.ui.chat.thinking);
  hint.classList.toggle('is-on', enabled);
  hint.setAttribute('aria-checked', String(enabled));
  $('#chat-thinking').checked = enabled;
  $('#chat-thinking-hint-text').textContent = `思考模式：${enabled ? '开' : '关'}`;
}

function toggleChatThinkingFromHint() {
  state.ui.chat.thinking = !state.ui.chat.thinking;
  saveState();
  renderChat();
}

function syncChatFocusMode() {
  $('.app-shell').classList.toggle('chat-focus', state.activeMode === 'chat' && hasChatConversation());
}

function focusChatWorkspace() {
  state.ui.layout.sidebarCollapsed = true;
  state.ui.layout.inspectorCollapsed = true;
  $('#inspector-panel').classList.remove('is-mobile-open');
  saveState();
  applyLayoutState();
}

function contentImageUrl(content) {
  if (!Array.isArray(content)) return '';
  return content.find((part) => part?.type === 'image_url')?.image_url?.url || '';
}

function setChatImageSource(source) {
  chatImageSource = ['upload', 'url'].includes(source) ? source : 'upload';
  $$('[data-chat-image-source]').forEach((button) => button.classList.toggle('is-active', button.dataset.chatImageSource === chatImageSource));
  $('#chat-image-upload-source').hidden = chatImageSource !== 'upload';
  $('#chat-image-url-source').hidden = chatImageSource !== 'url';
}

function renderChatImagePreview() {
  const preview = $('#chat-image-preview');
  if (!chatImage) {
    preview.hidden = true;
    preview.innerHTML = '';
    return;
  }
  preview.hidden = false;
  preview.innerHTML = `<div class="chat-image-preview"><img src="${escapeHtml(chatImage.dataUrl)}" alt="${escapeHtml(chatImage.name)}"><div class="chat-image-preview-copy"><strong>${escapeHtml(chatImage.name)}</strong><small>本地图片已准备</small></div><button class="icon-button small" type="button" data-chat-image-action="remove" aria-label="移除本地图片" data-tooltip="移除本地图片"><i data-lucide="x" aria-hidden="true"></i></button></div>`;
  refreshIcons();
}

async function handleChatImageFile(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('请选择图片文件。', 'error'); return; }
  try {
    chatImage = { name: file.name, dataUrl: await fileToDataUrl(file) };
    setChatImageSource('upload');
    renderChatImagePreview();
    showToast('本地图片已添加。');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function handleChatImagePreviewAction(event) {
  if (!event.target.closest('[data-chat-image-action="remove"]')) return;
  chatImage = null;
  renderChatImagePreview();
}

function clearChatImageInput() {
  chatImage = null;
  $('#chat-image-url').value = '';
  $('#chat-image-file-input').value = '';
  setChatImageSource('upload');
  renderChatImagePreview();
  $('#chat-vision-panel').hidden = true;
}

function resetChatImageInput() {
  chatImage = null;
  $('#chat-image-url').value = '';
  $('#chat-image-file-input').value = '';
  setChatImageSource('upload');
  renderChatImagePreview();
}

function isAcceptedImageSource(value) {
  return value.startsWith('data:image/') || isHttpsUrl(value);
}

function imageLabelForMessage(message, imageUrl) {
  return imageUrl.startsWith('data:image/') ? (message.imageName || '本地图片') : shortText(imageUrl, 54);
}

function buildChatContent(text, imageUrl = '') {
  const content = [{ type: 'text', text }];
  if (imageUrl) content.push({ type: 'image_url', image_url: { url: imageUrl } });
  return content;
}

function assistantMessageToolsMarkup(messageId) {
  return `<div class="message-tools"><button type="button" data-message-action="copy" data-message-id="${escapeHtml(messageId)}"><i data-lucide="copy" aria-hidden="true"></i>复制</button><button type="button" data-message-action="regenerate" data-message-id="${escapeHtml(messageId)}"><i data-lucide="refresh-cw" aria-hidden="true"></i>重新生成</button></div>`;
}

function renderChat() {
  const session = getActiveSession();
  syncChatFocusMode();
  updateChatStatusHints();
  $('#chat-session-title').textContent = session.title || '新会话';
  const container = $('#chat-messages');
  if (!session.messages.length) {
    container.innerHTML = '<div class="chat-empty"><div class="chat-empty-mark">AG</div><strong>等待一条新的指令</strong><small>AGNES 2.5 FLASH / 支持多轮对话</small></div>';
    $('#chat-suggestions').hidden = false;
    refreshIcons();
    return;
  }
  $('#chat-suggestions').hidden = true;
  const keepChatAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 96;
  container.innerHTML = session.messages.map((message) => {
    const user = message.role === 'user';
    const imageUrl = contentImageUrl(message.content);
    const text = textFromChatContent(message.content);
    const isStreaming = Boolean(message.streaming);
    const image = imageUrl ? `<div class="message-image-link"><i data-lucide="image" aria-hidden="true"></i><span>${escapeHtml(imageLabelForMessage(message, imageUrl))}</span></div>` : '';
    const isEditing = user && editingMessageId === message.id;
    const actions = !isEditing && user
      ? `<div class="message-tools"><button type="button" data-message-action="edit" data-message-id="${message.id}"><i data-lucide="pencil" aria-hidden="true"></i>编辑</button></div>`
      : !user && !isStreaming
        ? assistantMessageToolsMarkup(message.id)
        : '';
    const editableImage = imageUrl && !imageUrl.startsWith('data:image/');
    const preservedImage = imageUrl && !editableImage ? `<div class="message-edit-field"><span>图片</span><strong>${escapeHtml(imageLabelForMessage(message, imageUrl))}（保留）</strong></div>` : '';
    const editor = isEditing
      ? `<div class="message-edit-box">${image}<textarea class="message-edit-input" data-edit-input="${message.id}" rows="4">${escapeHtml(text)}</textarea>${editableImage ? `<label class="message-edit-field"><span>图片 URL</span><input data-edit-image="${message.id}" type="url" value="${escapeHtml(imageUrl)}"></label>` : preservedImage}<div class="message-edit-actions"><button class="text-button" type="button" data-message-action="cancel-edit" data-message-id="${message.id}">取消</button><button class="primary-action small-action" type="button" data-message-action="resend-edit" data-message-id="${message.id}"><i data-lucide="send" aria-hidden="true"></i>重发</button></div></div>`
      : '';
    const thinking = !user && message.reasoning
      ? `<details class="thinking-block" open><summary><i data-lucide="brain" aria-hidden="true"></i><span>思考过程</span><span class="thinking-state">${isStreaming ? '思考中' : '可收起'}</span></summary><div class="thinking-content">${escapeHtml(message.reasoning)}</div></details>`
      : '';
    const answer = user ? `<div class="message-content">${image}${escapeHtml(text)}</div>` : `${thinking}<div class="message-content${isStreaming ? ' is-streaming' : ''}" data-answer-content>${escapeHtml(text || (!isStreaming ? 'Agnes 没有返回文本内容。' : ''))}</div>`;
    return `<article class="message-row ${user ? 'user' : 'assistant'}${isEditing ? ' is-editing' : ''}" data-message-id="${message.id}" tabindex="0"><div class="message-avatar">${user ? '我' : 'AG'}</div><div class="message-body"><div class="message-meta"><span>${user ? '我' : 'AGNES'}</span><span>${formatDate(message.createdAt)}</span>${isStreaming ? '<span class="status-light is-live"></span>' : ''}</div>${editor || answer}${actions}</div></article>`;
  }).join('');
  refreshIcons();
  if (keepChatAtBottom) window.requestAnimationFrame(() => { container.scrollTop = container.scrollHeight; });
}

function updateStreamingMessageView(message) {
  const row = $$('.message-row').find((item) => item.dataset.messageId === message.id);
  if (!row) {
    renderChat();
    return;
  }
  const container = $('#chat-messages');
  const keepChatAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 96;
  const answer = $('[data-answer-content]', row) || $('.message-content', row);
  if (!answer) return;

  if (message.reasoning) {
    let thinkingBlock = $('.thinking-block', row);
    if (!thinkingBlock) {
      answer.insertAdjacentHTML('beforebegin', '<details class="thinking-block" open><summary><i data-lucide="brain" aria-hidden="true"></i><span>思考过程</span><span class="thinking-state">思考中</span></summary><div class="thinking-content"></div></details>');
      thinkingBlock = $('.thinking-block', row);
      refreshIcons();
    }
    $('.thinking-content', thinkingBlock).textContent = message.reasoning;
    $('.thinking-state', thinkingBlock).textContent = message.streaming ? '思考中' : '可收起';
  }

  answer.textContent = message.content || (!message.streaming ? 'Agnes 没有返回文本内容。' : '');
  answer.classList.toggle('is-streaming', Boolean(message.streaming));

  const meta = $('.message-meta', row);
  const liveStatus = $('.status-light', meta);
  if (message.streaming && !liveStatus) meta.insertAdjacentHTML('beforeend', '<span class="status-light is-live"></span>');
  if (!message.streaming && liveStatus) liveStatus.remove();
  if (!message.streaming && !$('.message-tools', row)) {
    $('.message-body', row).insertAdjacentHTML('beforeend', assistantMessageToolsMarkup(message.id));
    refreshIcons();
  }

  if (keepChatAtBottom) window.requestAnimationFrame(() => { container.scrollTop = container.scrollHeight; });
}

async function handleChatSubmit(event) {
  event.preventDefault();
  if (activeRequest) { activeRequest.abort(); return; }
  if (!requireApiKey()) return;
  const input = $('#chat-input');
  const text = input.value.trim();
  const imageUrl = chatImageSource === 'upload' ? (chatImage?.dataUrl || '') : $('#chat-image-url').value.trim();
  const imageName = chatImageSource === 'upload' ? (chatImage?.name || '') : '';
  if (!text) { showToast('请输入文本提示词。', 'error'); input.focus(); return; }
  if (imageUrl && !isAcceptedImageSource(imageUrl)) { showToast('请使用本地图片，或填写公开可访问的 HTTPS 图片地址。', 'error'); return; }
  if (state.ui.chat.autoFullscreen && !isChatFullscreen()) toggleChatFullscreen();
  const session = getActiveSession();
  const content = buildChatContent(text, imageUrl);
  session.messages.push({ id: createId('message'), role: 'user', content, imageName, createdAt: Date.now() });
  if (session.title === '新会话') session.title = shortText(text, 28);
  session.updatedAt = Date.now();
  input.value = '';
  resetChatImageInput();
  $('#chat-vision-panel').hidden = true;
  focusChatWorkspace();
  saveState();
  renderChat();
  await completeChat(session);
}

// 用小批量字符和固定节奏缓冲流式响应，避免消息区瞬间刷满。
function createChatTypewriter(onUpdate) {
  const queues = { content: [], reasoning: [] };
  let timer = 0;
  let drainResolver = null;

  const hasPending = () => queues.content.length > 0 || queues.reasoning.length > 0;
  const resolveDrain = () => {
    if (!hasPending() && drainResolver) {
      const resolve = drainResolver;
      drainResolver = null;
      resolve();
    }
  };
  const schedule = () => {
    if (!timer) timer = window.setTimeout(flush, 26);
  };
  const flush = () => {
    timer = 0;
    const reasoningChunk = queues.reasoning.splice(0, 2).join('');
    const contentChunk = reasoningChunk ? '' : queues.content.splice(0, 3).join('');
    if (reasoningChunk || contentChunk) onUpdate({ content: contentChunk, reasoning: reasoningChunk });
    if (hasPending()) schedule();
    else resolveDrain();
  };

  return {
    pushContent(value) {
      queues.content.push(...Array.from(value || ''));
      schedule();
    },
    pushReasoning(value) {
      queues.reasoning.push(...Array.from(value || ''));
      schedule();
    },
    drain() {
      if (!hasPending()) return Promise.resolve();
      return new Promise((resolve) => { drainResolver = resolve; schedule(); });
    },
    flushAll() {
      if (timer) { window.clearTimeout(timer); timer = 0; }
      const contentChunk = queues.content.splice(0).join('');
      const reasoningChunk = queues.reasoning.splice(0).join('');
      if (contentChunk || reasoningChunk) onUpdate({ content: contentChunk, reasoning: reasoningChunk });
      resolveDrain();
    }
  };
}

async function completeChat(session) {
  const assistant = { id: createId('message'), role: 'assistant', content: '', createdAt: Date.now(), streaming: true };
  session.messages.push(assistant);
  activeRequest = new AbortController();
  const chatSettings = { ...state.ui.chat };
  const typewriter = createChatTypewriter(({ content, reasoning }) => {
    if (content) assistant.content += content;
    if (reasoning) assistant.reasoning = (assistant.reasoning || '') + reasoning;
    updateStreamingMessageView(assistant);
  });
  $('#chat-send').disabled = false;
  $('#chat-send').setAttribute('aria-label', '停止生成');
  $('#chat-send').innerHTML = '<span>停止</span><i data-lucide="square" aria-hidden="true"></i>';
  renderChat();
  try {
    const result = await AgnesClient.chat({ messages: session.messages.slice(0, -1), settings: chatSettings, signal: activeRequest.signal, onToken: (token) => typewriter.pushContent(token), onReasoningToken: (token) => typewriter.pushReasoning(token) });
    await typewriter.drain();
    assistant.content = result.content || assistant.content || 'Agnes 没有返回文本内容。';
    assistant.reasoning = result.reasoning || assistant.reasoning || '';
    assistant.streaming = false;
    assistant.usage = result.usage || null;
    updateKeyStatus(true);
    showToast('文本响应已完成。');
  } catch (error) {
    typewriter.flushAll();
    assistant.streaming = false;
    if (error.name === 'AbortError') assistant.content = assistant.content || '生成已停止。';
    else { assistant.content = `请求失败：${error.message}`; showToast(error.message, 'error'); }
  } finally {
    activeRequest = null;
    session.updatedAt = Date.now();
    saveState();
    $('#chat-send').disabled = false;
    $('#chat-send').setAttribute('aria-label', '发送消息');
    $('#chat-send').innerHTML = '<span>发送</span><i data-lucide="arrow-up" aria-hidden="true"></i>';
    updateStreamingMessageView(assistant);
    refreshIcons();
  }
}

function handleMessageAction(event) {
  const button = event.target.closest('[data-message-action]');
  if (!button) {
    const row = event.target.closest('.message-row');
    if (!row || event.target.closest('.message-edit-box')) return;
    if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
    if (event.type === 'keydown') event.preventDefault();
    row.classList.toggle('is-actions-open');
    return;
  }
  const session = getActiveSession();
  const message = session.messages.find((item) => item.id === button.dataset.messageId);
  if (!message) return;
  if (button.dataset.messageAction === 'copy') copyText(textFromChatContent(message.content));
  if (button.dataset.messageAction === 'regenerate') regenerateMessage(message.id);
  if (button.dataset.messageAction === 'edit') beginEditMessage(message.id);
  if (button.dataset.messageAction === 'cancel-edit') cancelEditMessage();
  if (button.dataset.messageAction === 'resend-edit') resendEditedMessage(message.id);
}

function beginEditMessage(messageId) {
  if (activeRequest) return;
  const session = getActiveSession();
  const message = session.messages.find((item) => item.id === messageId && item.role === 'user');
  if (!message) return;
  editingMessageId = messageId;
  renderChat();
  window.requestAnimationFrame(() => {
    const input = $$('[data-edit-input]').find((element) => element.dataset.editInput === messageId);
    input?.focus();
    input?.select();
  });
}

function cancelEditMessage() {
  editingMessageId = null;
  renderChat();
}

async function resendEditedMessage(messageId) {
  if (activeRequest || !requireApiKey()) return;
  const session = getActiveSession();
  const index = session.messages.findIndex((message) => message.id === messageId && message.role === 'user');
  if (index < 0) return;
  const textInput = $$('[data-edit-input]').find((element) => element.dataset.editInput === messageId);
  const imageInput = $$('[data-edit-image]').find((element) => element.dataset.editImage === messageId);
  const originalMessage = session.messages[index];
  const text = textInput?.value.trim() || '';
  const imageUrl = imageInput ? imageInput.value.trim() : contentImageUrl(originalMessage.content);
  const imageName = imageInput ? '' : (originalMessage.imageName || '');
  if (!text) { showToast('编辑后的内容不能为空。', 'error'); textInput?.focus(); return; }
  if (imageUrl && !isAcceptedImageSource(imageUrl)) { showToast('请使用本地图片，或填写公开可访问的 HTTPS 图片地址。', 'error'); return; }
  session.messages.splice(index);
  session.messages.push({ id: createId('message'), role: 'user', content: buildChatContent(text, imageUrl), imageName, createdAt: Date.now() });
  if (index === 0 || session.title === '新会话') session.title = shortText(text, 28);
  session.updatedAt = Date.now();
  editingMessageId = null;
  saveState();
  renderChat();
  await completeChat(session);
}

async function regenerateMessage(messageId) {
  if (activeRequest) return;
  if (!requireApiKey()) return;
  const session = getActiveSession();
  const index = session.messages.findIndex((message) => message.id === messageId);
  if (index < 0) return;
  session.messages.splice(index, 1);
  saveState();
  renderChat();
  await completeChat(session);
}

function setImageMode(mode, persist = true) {
  const nextMode = ['text', 'image', 'composite'].includes(mode) ? mode : 'text';
  state.ui.image.mode = nextMode;
  $$('.segment-button[data-image-mode]').forEach((button) => button.classList.toggle('is-active', button.dataset.imageMode === nextMode));
  $('#image-reference-zone').classList.toggle('is-hidden', nextMode === 'text');
  if (nextMode === 'image' && imageReferences.length > 1) {
    imageReferences = imageReferences.slice(0, 1);
    showToast('图生图模式仅支持 1 张参考图，已保留第一张，其余已移除。');
  }
  renderImageReferences();
  renderImagePromptGuide();
  if (persist) saveState();
}

function imageModeMaxRefs() {
  return state.ui.image.mode === 'image' ? 1 : 4;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`无法读取图片：${file.name}`));
    reader.readAsDataURL(file);
  });
}

async function addImageReferenceFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  const maxRefs = imageModeMaxRefs();
  const room = maxRefs - imageReferences.length;
  if (room <= 0) { showToast(`参考图已满 ${maxRefs} 张，先移除部分再上传。`, 'error'); return; }
  const imageFiles = files.filter((file) => file.type.startsWith('image/'));
  const accepted = imageFiles.slice(0, room);
  for (const file of accepted) {
    try {
      imageReferences.push({ id: createId('ref'), name: file.name, dataUrl: await fileToDataUrl(file) });
    } catch (error) {
      showToast(error.message, 'error');
    }
  }
  if (accepted.length < imageFiles.length) showToast(`参考图最多 ${maxRefs} 张，已保留前 ${accepted.length} 张。`, 'error');
  if (files.length > imageFiles.length) showToast(`已忽略 ${files.length - imageFiles.length} 个非图片文件，请选择图片文件。`, 'error');
  renderImageReferences();
}

async function handleImageFiles(event) {
  const files = Array.from(event.target.files || []);
  event.target.value = '';
  await addImageReferenceFiles(files);
}

function renderImageReferences() {
  const maxRefs = imageModeMaxRefs();
  $('#image-reference-count').textContent = `${imageReferences.length} / ${maxRefs}`;
  $('#image-reference-grid').innerHTML = imageReferences.map((reference) => `<div class="reference-tile"><img draggable="false" src="${escapeHtml(reference.dataUrl || reference.url)}" alt="${escapeHtml(reference.name)}"><button type="button" data-reference-action="remove" data-reference-id="${reference.id}" aria-label="移除参考图"><i data-lucide="x" aria-hidden="true"></i></button></div>`).join('');
  const full = imageReferences.length >= maxRefs;
  const zone = $('#image-drop-zone');
  if (zone) {
    zone.classList.toggle('is-disabled', full);
    zone.setAttribute('aria-disabled', full ? 'true' : 'false');
    const text = $('#image-drop-zone-text');
    if (text) text.textContent = full ? `参考图已满 ${maxRefs} 张` : '拖入图片或点击选择';
  }
  updateImagePromptNote();
  refreshIcons();
}

function handleReferenceAction(event) {
  const button = event.target.closest('[data-reference-action="remove"]');
  if (!button) return;
  imageReferences = imageReferences.filter((reference) => reference.id !== button.dataset.referenceId);
  renderImageReferences();
}

let refDragClickGuard = false;

function handleReferenceGridClick(event) {
  if (refDragClickGuard) { event.preventDefault(); return; }
  if (event.target.closest('[data-reference-action="remove"]')) return;
  const tile = event.target.closest('.reference-tile');
  if (!tile) return;
  const id = tile.querySelector('[data-reference-id]')?.dataset.referenceId;
  const index = imageReferences.findIndex((reference) => reference.id === id);
  if (index < 0) return;
  openMediaPreview({
    items: imageReferences.map((reference) => ({ url: reference.dataUrl || reference.url, title: reference.name || '参考图', kind: 'image' })),
    index
  });
}

function startReferenceDrag(event) {
  if (event.button !== undefined && event.button !== 0) return;
  const tile = event.target.closest('.reference-tile');
  if (!tile || event.target.closest('[data-reference-action="remove"]')) return;
  if (imageReferences.length < 2) return;
  const id = tile.querySelector('[data-reference-id]')?.dataset.referenceId;
  if (!id || imageReferences.findIndex((reference) => reference.id === id) < 0) return;
  const pointerId = event.pointerId;
  const grid = $('#image-reference-grid');
  const startX = event.clientX;
  const startY = event.clientY;
  let dragging = false;
  let ended = false;

  const releaseCapture = () => {
    if (tile.hasPointerCapture?.(pointerId)) {
      try { tile.releasePointerCapture(pointerId); } catch (error) { /* 指针已释放 */ }
    }
  };
  const removeWaitingListeners = () => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onEnd);
    document.removeEventListener('pointercancel', onEnd);
    tile.removeEventListener('lostpointercapture', onEnd);
  };
  const endWaiting = () => {
    if (ended) return;
    ended = true;
    window.clearTimeout(timer);
    removeWaitingListeners();
    releaseCapture();
  };
  const onMove = (moveEvent) => {
    if (ended || moveEvent.pointerId !== pointerId || dragging) return;
    if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) > 8) endWaiting();
  };
  const onEnd = () => { if (!dragging) endWaiting(); };
  const timer = window.setTimeout(() => {
    if (ended) return;
    dragging = true;
    removeWaitingListeners();
    if (!tile.isConnected || !grid?.isConnected) { endWaiting(); return; }
    beginReferenceDrag(tile, grid, pointerId, startX, startY, endWaiting);
  }, 350);

  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onEnd);
  document.addEventListener('pointercancel', onEnd);
  tile.addEventListener('lostpointercapture', onEnd);
  try { tile.setPointerCapture(pointerId); } catch (error) { /* 当前浏览器不支持指针捕获 */ }
}

function beginReferenceDrag(tile, grid, pointerId, startX, startY, endPointerSession) {
  if (!tile?.isConnected || !grid?.isConnected) { endPointerSession(); return; }
  const order = [...imageReferences];
  const startRect = tile.getBoundingClientRect();
  let layoutCenterX = startRect.left + startRect.width / 2;
  let layoutCenterY = startRect.top + startRect.height / 2;
  const grabOffsetX = startX - layoutCenterX;
  const grabOffsetY = startY - layoutCenterY;
  let finished = false;
  document.body.classList.add('ref-dragging');
  tile.classList.add('is-dragging');

  const applyTransform = (clientX, clientY) => {
    tile.style.transform = `translate(${(clientX - grabOffsetX - layoutCenterX).toFixed(1)}px, ${(clientY - grabOffsetY - layoutCenterY).toFixed(1)}px) rotate(2deg) scale(1.06)`;
  };
  const removeDragListeners = () => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onEnd);
    document.removeEventListener('pointercancel', onEnd);
    tile.removeEventListener('lostpointercapture', onEnd);
  };
  const onMove = (moveEvent) => {
    if (finished || moveEvent.pointerId !== pointerId) return;
    const list = Array.from(grid.querySelectorAll('.reference-tile'));
    const from = list.indexOf(tile);
    let over = -1;
    for (let i = 0; i < list.length; i += 1) {
      if (list[i] === tile) continue;
      const rect = list[i].getBoundingClientRect();
      const inHorizontalBand = moveEvent.clientX >= rect.left && moveEvent.clientX <= rect.right;
      const inVerticalBand = moveEvent.clientY >= rect.top - rect.height * 0.5 && moveEvent.clientY <= rect.bottom + rect.height * 0.5;
      if (inHorizontalBand && inVerticalBand) { over = i; break; }
    }
    if (over >= 0 && over !== from) {
      const target = list[over];
      const targetRect = target.getBoundingClientRect();
      const [moved] = order.splice(from, 1);
      order.splice(over, 0, moved);
      if (over < from) grid.insertBefore(tile, target);
      else grid.insertBefore(tile, target.nextSibling);
      layoutCenterX = targetRect.left + targetRect.width / 2;
      layoutCenterY = targetRect.top + targetRect.height / 2;
    }
    applyTransform(moveEvent.clientX, moveEvent.clientY);
  };
  const onEnd = () => {
    if (finished) return;
    finished = true;
    removeDragListeners();
    document.body.classList.remove('ref-dragging');
    tile.classList.remove('is-dragging');
    tile.style.transform = '';
    endPointerSession();
    imageReferences = order;
    renderImageReferences();
    refDragClickGuard = true;
    window.setTimeout(() => { refDragClickGuard = false; }, 120);
  };
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onEnd);
  document.addEventListener('pointercancel', onEnd);
  tile.addEventListener('lostpointercapture', onEnd);
  applyTransform(startX, startY);
}

function openImageUrlModal() {
  const existing = $('#image-url-modal');
  if (existing) existing.remove();
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = 'image-url-modal';
  backdrop.innerHTML = `
    <section class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="image-url-modal-title">
      <div class="modal-topline">
        <span class="section-kicker"><span class="signal-line"></span> 图片来源</span>
        <button class="icon-button small" type="button" id="image-url-modal-close" aria-label="关闭" data-tooltip="关闭"><i data-lucide="x" aria-hidden="true"></i></button>
      </div>
      <h2 id="image-url-modal-title">填写图片链接</h2>
      <p class="modal-copy">支持公开可访问的 HTTPS 图片地址，也可以粘贴作品集图片 URL。</p>
      <div class="url-modal-input-wrap"><i data-lucide="link" aria-hidden="true"></i><input id="image-url-modal-input" type="url" placeholder="https://example.com/image.png" autocomplete="off"></div>
      <div class="modal-actions"><button class="text-button" type="button" id="image-url-modal-cancel"><i data-lucide="x" aria-hidden="true"></i>取消</button><button class="primary-action" type="button" id="image-url-modal-confirm">确定 <i data-lucide="check" aria-hidden="true"></i></button></div>
    </section>`;
  document.body.appendChild(backdrop);
  refreshIcons();
  const close = () => backdrop.remove();
  const input = backdrop.querySelector('#image-url-modal-input');
  const submit = () => {
    const url = input.value.trim();
    if (!url) { showToast('请填写图片链接。', 'error'); input.focus(); return; }
    if (!isHttpsUrl(url)) { showToast('请填写公开可访问的 HTTPS 图片链接。', 'error'); input.focus(); return; }
    imageReferences.push({ id: createId('ref'), name: shortText(url, 24), url });
    renderImageReferences();
    close();
  };
  backdrop.querySelector('#image-url-modal-close').addEventListener('click', close);
  backdrop.querySelector('#image-url-modal-cancel').addEventListener('click', close);
  backdrop.querySelector('#image-url-modal-confirm').addEventListener('click', submit);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });
  input.addEventListener('keydown', (event) => { if (event.key === 'Enter') submit(); });
  input.focus();
}

function videoRefValue(ref) {
  return ref ? (ref.dataUrl || ref.url) : '';
}

function isUsableVideoRef(ref) {
  return Boolean(ref && (ref.dataUrl || isHttpsUrl(ref.url)));
}

function setVideoRef(kind, index, item) {
  if (kind === 'image') videoImageRefs = [item];
  else videoKeyframeRefs[index] = item;
  renderVideoRefs();
}

function videoRefEmptyMarkup(title) {
  return `<div class="video-ref-empty">
    <div class="video-ref-empty-mark"><i data-lucide="image-plus" aria-hidden="true"></i></div>
    <span class="video-ref-empty-title">${escapeHtml(title)}</span>
    <small class="video-ref-empty-note">可拖入本地图片，或从上方选择来源</small>
    <div class="video-ref-empty-actions">
      <button class="video-ref-source" type="button" data-video-ref-action="upload"><i data-lucide="upload" aria-hidden="true"></i>上传</button>
      <button class="video-ref-source" type="button" data-video-ref-action="pick"><i data-lucide="folder-open" aria-hidden="true"></i>作品集</button>
      <button class="video-ref-source" type="button" data-video-ref-action="link"><i data-lucide="link" aria-hidden="true"></i>链接</button>
    </div>
  </div>`;
}

function videoRefTileMarkup(ref) {
  return `<div class="video-ref-shot">
    <img src="${escapeHtml(ref.dataUrl || ref.url)}" alt="${escapeHtml(ref.name || '视频参考图')}">
    <div class="video-ref-shot-bar"><span>${escapeHtml(ref.name || shortText(ref.url || '', 30))}</span><button class="icon-button small" type="button" data-video-ref-action="remove" aria-label="移除参考图"><i data-lucide="x" aria-hidden="true"></i></button></div>
  </div>`;
}

function renderVideoRefs() {
  const imageGrid = $('#video-image-ref-grid');
  if (imageGrid) {
    imageGrid.innerHTML = videoImageRefs.length ? videoRefTileMarkup(videoImageRefs[0]) : videoRefEmptyMarkup('添加首帧参考图');
    $('#video-image-ref-count').textContent = `${videoImageRefs.length ? 1 : 0} / 1`;
  }
  [0, 1].forEach((index) => {
    const slot = $(`#video-keyframe-slot-${index}`);
    if (!slot) return;
    slot.innerHTML = videoKeyframeRefs[index] ? videoRefTileMarkup(videoKeyframeRefs[index]) : videoRefEmptyMarkup('添加关键帧');
  });
  refreshIcons();
}

function addVideoRefFile(kind, index, fileList) {
  const file = Array.from(fileList || [])[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('请选择图片文件。', 'error'); return; }
  fileToDataUrl(file)
    .then((dataUrl) => {
      setVideoRef(kind, index, { id: createId('ref'), name: file.name, dataUrl });
      showToast('图片已加入，将随任务发送。');
    })
    .catch((error) => showToast(error.message, 'error'));
}

function handleVideoRefFiles(kind, event) {
  addVideoRefFile(kind, videoRefTarget.index, event.target.files);
  event.target.value = '';
}

function handleVideoRefAction(kind, event) {
  const button = event.target.closest('[data-video-ref-action]');
  if (!button) {
    const img = event.target.closest('.video-ref-shot img');
    if (img) openVideoRefPreview(img.getAttribute('src'));
    return;
  }
  let index = 0;
  if (kind === 'keyframes') index = button.closest('#video-keyframe-slot-1') ? 1 : 0;
  const action = button.dataset.videoRefAction;
  if (action === 'remove') {
    if (kind === 'image') videoImageRefs = [];
    else videoKeyframeRefs[index] = undefined;
    renderVideoRefs();
    return;
  }
  videoRefTarget = { mode: kind, index };
  if (action === 'upload') {
    $(kind === 'image' ? '#video-image-file-input' : '#video-keyframe-file-input').click();
    return;
  }
  if (action === 'pick') {
    openWorkPicker({ onPick: (item) => { setVideoRef(kind, index, { id: createId('ref'), name: item.title, url: item.url }); } });
    return;
  }
  if (action === 'link') openVideoUrlModal(kind, index);
}

function openVideoRefPreview(srcUrl) {
  const items = [];
  if (videoImageRefs[0]) items.push({ url: videoRefValue(videoImageRefs[0]), title: videoImageRefs[0].name || '首帧参考图', meta: '首帧', kind: 'image' });
  videoKeyframeRefs.forEach((ref, index) => {
    if (ref) items.push({ url: videoRefValue(ref), title: ref.name || `关键帧 ${index + 1}`, meta: `关键帧 ${index + 1}`, kind: 'image' });
  });
  if (!items.length) return;
  const index = Math.max(0, items.findIndex((item) => item.url === srcUrl));
  openMediaPreview({ items, index });
}

function openVideoUrlModal(kind, index) {
  const existing = $('#video-url-modal');
  if (existing) existing.remove();
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = 'video-url-modal';
  backdrop.innerHTML = `
    <section class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="video-url-modal-title">
      <div class="modal-topline">
        <span class="section-kicker"><span class="signal-line"></span> 图片来源</span>
        <button class="icon-button small" type="button" id="video-url-modal-close" aria-label="关闭" data-tooltip="关闭"><i data-lucide="x" aria-hidden="true"></i></button>
      </div>
      <h2 id="video-url-modal-title">填写图片链接</h2>
      <p class="modal-copy">支持公开可访问的 HTTPS 图片地址，也可以粘贴作品集图片 URL。</p>
      <div class="url-modal-input-wrap"><i data-lucide="link" aria-hidden="true"></i><input id="video-url-modal-input" type="url" placeholder="https://example.com/image.png" autocomplete="off"></div>
      <div class="modal-actions"><button class="text-button" type="button" id="video-url-modal-cancel"><i data-lucide="x" aria-hidden="true"></i>取消</button><button class="primary-action" type="button" id="video-url-modal-confirm">确定 <i data-lucide="check" aria-hidden="true"></i></button></div>
    </section>`;
  document.body.appendChild(backdrop);
  refreshIcons();
  const close = () => backdrop.remove();
  const input = backdrop.querySelector('#video-url-modal-input');
  const submit = () => {
    const url = input.value.trim();
    if (!url) { showToast('请填写图片链接。', 'error'); input.focus(); return; }
    if (!isHttpsUrl(url)) { showToast('请填写公开可访问的 HTTPS 图片链接。', 'error'); input.focus(); return; }
    setVideoRef(kind, index, { id: createId('ref'), name: shortText(url, 24), url });
    close();
  };
  backdrop.querySelector('#video-url-modal-close').addEventListener('click', close);
  backdrop.querySelector('#video-url-modal-cancel').addEventListener('click', close);
  backdrop.querySelector('#video-url-modal-confirm').addEventListener('click', submit);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });
  input.addEventListener('keydown', (event) => { if (event.key === 'Enter') submit(); });
  input.focus();
}

function imagePromptReferenceUrls() {
  if (!['image', 'composite'].includes(state.ui.image.mode)) return [];
  const urls = imageReferences.map((reference) => reference.dataUrl || reference.url);
  return state.ui.image.mode === 'image' ? urls.slice(0, 1) : urls;
}

function renderImagePromptGuide() {
  const container = $('#image-prompt-structure');
  if (!container) return;
  const guide = IMAGE_PROMPT_GUIDES[state.ui.image.mode];
  container.classList.toggle('is-hidden', !guide);
  if (!guide) return;
  container.innerHTML = `
    <div class="prompt-structure-head">
      <span><i data-lucide="braces" aria-hidden="true"></i>${escapeHtml(guide.title)}</span>
      <button class="text-button" type="button" id="image-structure-fill"><i data-lucide="pen-line" aria-hidden="true"></i>填入示例</button>
    </div>
    <div class="prompt-structure-parts">${guide.parts.map((part) => `<span>${escapeHtml(part)}</span>`).join('')}</div>
    <div class="prompt-structure-example">${escapeHtml(guide.example)}</div>`;
  refreshIcons();
}

function handleImageStructureAction(event) {
  const button = event.target.closest('#image-structure-fill');
  if (!button) return;
  const guide = IMAGE_PROMPT_GUIDES[state.ui.image.mode];
  if (!guide) return;
  const input = $('#image-prompt');
  input.value = guide.example;
  input.focus();
  showToast('示例已填入提示词，可直接修改。');
}

function handleImageResultAction(event) {
  if (event.target.closest('[data-print-action]')) { handlePrintAction(event); return; }
  if (event.target.closest('#image-cancel-generate')) handleImageCancelClick();
  if (event.target.closest('.loading-state, .output-empty')) return;
  if (!event.target.closest('.result-figure img')) return;
  const url = safeMediaUrl(imageResult?.url);
  if (!url) return;
  openMediaPreview({
    items: [{ url, title: 'Agnes 生成图像', meta: `${imageResult.size || ''} / ${imageResult.ratio || ''}`.replace(/^\/\s*/, ''), kind: 'image' }],
    index: 0
  });
}

function updateImagePromptNote() {
  const preset = IMAGE_STYLE_PRESETS[state.ui.image.stylePreset] || IMAGE_STYLE_PRESETS.none;
  const referenceCount = imagePromptReferenceUrls().length;
  const referenceNote = referenceCount ? `AI 会先读取 ${referenceCount} 张参考图，再整理提示词。` : 'AI 会根据文字要求整理提示词。';
  const styleNote = preset.prompt ? `生成时追加“${preset.label}”风格要求。` : '当前不追加风格预设。';
  $('#image-prompt-note').querySelector('span').textContent = `${referenceNote} ${styleNote}`;
}

function setImageStylePreset(preset, persist = true) {
  const next = IMAGE_STYLE_PRESETS[preset] ? preset : 'none';
  const selected = IMAGE_STYLE_PRESETS[next];
  state.ui.image.stylePreset = next;
  $$('[data-image-style]').forEach((button) => button.classList.toggle('is-active', button.dataset.imageStyle === next));
  $('#image-style-summary').textContent = selected.label;
  updateImagePromptNote();
  if (persist) saveState();
}

function composeImagePrompt(prompt) {
  const preset = IMAGE_STYLE_PRESETS[state.ui.image.stylePreset] || IMAGE_STYLE_PRESETS.none;
  return preset.prompt ? `${prompt}\n\n风格要求：${preset.prompt}` : prompt;
}

function cleanPromptAssistantText(value) {
  return String(value || '')
    .replace(/^```(?:text|markdown)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .replace(/^(提示词|优化后的提示词|生成提示词)[:：]\s*/i, '')
    .trim();
}

function buildImagePromptInstruction(kind) {
  const basePrompt = $('#image-prompt').value.trim();
  const direction = $('#image-keywords').value.trim() || '请综合补足主体、环境、构图、光线、材质和氛围';
  const preset = IMAGE_STYLE_PRESETS[state.ui.image.stylePreset] || IMAGE_STYLE_PRESETS.none;
  const modeLabel = { text: '文生图', image: '图生图', composite: '多图合成' }[state.ui.image.mode] || '文生图';
  const referenceUrls = imagePromptReferenceUrls();
  const referenceInstruction = referenceUrls.length
    ? `你会收到 ${referenceUrls.length} 张参考图。请先观察参考图中真实可见的主体、颜色、姿态、构图、背景和材质，再输出提示词；必须以参考图为依据，不要凭空替换主体，不要只写“基于参考图”。`
    : '当前没有参考图，请完全根据文字要求设计画面。';
  if (kind === 'random') {
    return `请为 Agnes 图像模型创作一条可直接使用的中文生图提示词。当前模式：${modeLabel}。${referenceInstruction}创作方向：${direction}。风格预设：${preset.prompt || '自由发挥'}。要求提示词包含明确主体、场景关系、构图视角、光线、色彩、材质和氛围，信息密度高但表达自然。只返回一段提示词，不要解释，不要加标题，不要使用 Markdown。`;
  }
  return `请优化下面这条 Agnes 图像提示词。保留原始意图，不改变主体和核心内容；${referenceInstruction}根据优化方向补足主体细节、空间关系、构图、镜头、光线、材质、色彩与画面质量。当前模式：${modeLabel}。优化方向：${direction}。风格预设：${preset.prompt || '不额外限定风格'}。原始提示词：${basePrompt}。只返回优化后的完整提示词，不要解释，不要加标题，不要使用 Markdown。`;
}

function setPromptAssistButtons(busy, activeKind = '') {
  if (activeKind) promptAssistActive = activeKind;
  const labels = { random: ['随机灵感', '取消灵感'], optimize: ['优化提示词', '取消优化'] };
  ['random', 'optimize'].forEach((kind) => {
    const button = $(`#image-${kind === 'random' ? 'random' : 'optimize'}-prompt`);
    button.disabled = busy && activeKind !== kind;
    button.classList.toggle('is-primary', busy ? activeKind === kind : promptAssistActive === kind);
    const label = labels[kind][busy && activeKind === kind ? 1 : 0];
    button.querySelector('span').textContent = label;
  });
}

function handlePromptAssistCancel(kind) {
  if (!promptAssistRequest) return;
  const button = $(`#image-${kind === 'random' ? 'random' : 'optimize'}-prompt`);
  if (!promptAssistCancelArmed) {
    promptAssistCancelArmed = true;
    if (button) {
      button.querySelector('span').textContent = '再点一次确认取消';
      button.classList.add('is-confirming');
    }
    window.clearTimeout(promptAssistCancelTimer);
    promptAssistCancelTimer = window.setTimeout(() => {
      promptAssistCancelArmed = false;
      if (button) {
        button.querySelector('span').textContent = kind === 'random' ? '取消灵感' : '取消优化';
        button.classList.remove('is-confirming');
      }
    }, 3000);
    return;
  }
  promptAssistCancelArmed = false;
  window.clearTimeout(promptAssistCancelTimer);
  promptAssistRequest.abort();
  showToast('已取消提示词生成。');
}

async function requestImagePrompt(kind) {
  if (promptAssistRequest || !requireApiKey()) return;
  const basePrompt = $('#image-prompt').value.trim();
  if (kind === 'optimize' && !basePrompt) {
    showToast('请先写下已有提示词，再进行优化。', 'error');
    $('#image-prompt').focus();
    return;
  }
  promptAssistRequest = new AbortController();
  setPromptAssistButtons(true, kind);
  try {
    const promptContent = [{ type: 'text', text: buildImagePromptInstruction(kind) }];
    imagePromptReferenceUrls().forEach((url) => promptContent.push({ type: 'image_url', image_url: { url } }));
    const result = await AgnesClient.chat({
      messages: [
        { role: 'system', content: '你是 Agnes 图像提示词设计师，擅长把创作意图整理为可执行的高质量生图提示词。' },
        { role: 'user', content: promptContent }
      ],
      settings: { temperature: kind === 'random' ? 0.95 : 0.55, maxTokens: 768, thinking: false },
      signal: promptAssistRequest.signal,
      onToken: () => {}
    });
    const prompt = cleanPromptAssistantText(result.content);
    if (!prompt) throw new AgnesApiError('Agnes 没有返回可用的提示词。');
    $('#image-prompt').value = prompt;
    showToast(kind === 'random' ? '随机灵感已写入提示词。' : '提示词已优化。');
  } catch (error) {
    if (error.name !== 'AbortError') showToast(error.message, 'error');
  } finally {
    promptAssistRequest = null;
    promptAssistCancelArmed = false;
    window.clearTimeout(promptAssistCancelTimer);
    setPromptAssistButtons(false);
  }
}

function renderImageResult() {
  const result = $('#image-result');
  const actions = $('#image-output-actions');
  if (!imageResult) {
    actions.hidden = true;
    result.innerHTML = '<div class="output-empty"><div class="output-empty-mark"><i data-lucide="image" aria-hidden="true"></i></div><span>输出画布为空</span><small>选择模式、写下提示词，然后开始一次生成。</small></div>';
    refreshIcons();
    return;
  }
  if (imageResult.status === 'loading') {
    actions.hidden = true;
    result.innerHTML = `<div class="loading-state"><div class="loading-ring"></div><span>正在整理画面...</span><small>图像生成进行中</small>${promptPrintMarkup('image')}<button class="image-cancel-button" type="button" id="image-cancel-generate">取消生成</button></div>`;
    ensurePromptPrint('image');
    refreshIcons();
    return;
  }
  const url = safeMediaUrl(imageResult.url);
  if (!url) {
    actions.hidden = true;
    result.innerHTML = '<div class="output-empty"><div class="output-empty-mark"><i data-lucide="triangle-alert" aria-hidden="true"></i></div><span>结果地址不可用</span><small>Agnes 返回了无法展示的媒体地址。</small></div>';
    refreshIcons();
    return;
  }
  actions.hidden = false;
  result.innerHTML = `<figure class="result-figure"><img src="${escapeHtml(url)}" alt="Agnes 生成图像"><figcaption class="result-caption"><span>${escapeHtml(imageResult.size)} / ${escapeHtml(imageResult.ratio)}</span><span>${escapeHtml(shortText(url, 48))}</span></figcaption></figure>${imageActivePrompt ? promptPrintMiniMarkup('image', imageActivePrompt) : ''}`;
  refreshIcons();
}

async function handleImageGenerate() {
  if (!requireApiKey()) return;
  if (imageRequestController) { showToast('已有生成任务进行中。', 'error'); return; }
  const basePrompt = $('#image-prompt').value.trim();
  const prompt = composeImagePrompt(basePrompt);
  const mode = state.ui.image.mode;
  if (!basePrompt) { showToast('请输入图像提示词，或先使用随机灵感。', 'error'); $('#image-prompt').focus(); return; }
  if (mode !== 'text' && !imageReferences.length) { showToast('图生图和多图合成至少需要一张参考图。', 'error'); return; }
  const button = $('#image-generate');
  button.disabled = true;
  imageResult = { status: 'loading' };
  imageActivePrompt = prompt;
  renderImageResult();
  startPromptPrint('image', prompt);
  imageRequestController = new AbortController();
  window.clearTimeout(imageCancelTimer);
  imageCancelArmed = false;
  try {
    const refImages = imageReferences.map((reference) => reference.dataUrl || reference.url).slice(0, imageModeMaxRefs());
    const payload = await AgnesClient.generateImage({ prompt, size: state.ui.image.size, ratio: state.ui.image.ratio, images: refImages, signal: imageRequestController.signal });
    const item = payload.data?.[0] || {};
    const url = item.url || (item.b64_json ? (item.b64_json.startsWith('data:') ? item.b64_json : `data:image/png;base64,${item.b64_json}`) : '');
    if (!url) throw new AgnesApiError('Agnes 没有返回图像 URL 或 Base64 内容。');
    imageResult = { status: 'complete', url, size: state.ui.image.size, ratio: state.ui.image.ratio, prompt, createdAt: Date.now() };
    addWork({ kind: 'image', title: shortText(basePrompt, 38), prompt, url, meta: `${state.ui.image.size} / ${state.ui.image.ratio}`, createdAt: imageResult.createdAt });
    updateKeyStatus(true);
    showToast('图像已生成并保存到作品。');
  } catch (error) {
    if (error.name === 'AbortError') {
      imageResult = null;
      imageActivePrompt = null;
      showToast('已取消生成。');
    } else {
      imageResult = null;
      imageActivePrompt = null;
      showToast(error.message, 'error');
    }
  } finally {
    imageRequestController = null;
    window.clearTimeout(imageCancelTimer);
    imageCancelArmed = false;
    button.disabled = false;
    stopPromptPrint('image');
    renderImageResult();
  }
}

function handleImageCancelClick() {
  if (!imageRequestController) return;
  if (!imageCancelArmed) {
    imageCancelArmed = true;
    const button = $('#image-cancel-generate');
    if (button) {
      button.textContent = '再点一次确认取消';
      button.classList.add('is-confirming');
    }
    window.clearTimeout(imageCancelTimer);
    imageCancelTimer = window.setTimeout(() => {
      imageCancelArmed = false;
      const current = $('#image-cancel-generate');
      if (current) {
        current.textContent = '取消生成';
        current.classList.remove('is-confirming');
      }
    }, 3000);
    return;
  }
  imageCancelArmed = false;
  window.clearTimeout(imageCancelTimer);
  imageRequestController.abort();
}

function promptPrintMarkup(kind) {
  return `<div class="prompt-print" id="${kind}-prompt-print">
    <div class="prompt-print-head">
      <span class="prompt-print-title"><i data-lucide="printer" aria-hidden="true"></i>发送给模型的提示词</span>
      <span class="prompt-print-actions">
        <button class="text-button" type="button" data-print-action="copy"><i data-lucide="copy" aria-hidden="true"></i>复制</button>
        <button class="text-button" type="button" data-print-action="view"><i data-lucide="expand" aria-hidden="true"></i>完整查看</button>
      </span>
    </div>
    <pre class="prompt-print-text" id="${kind}-prompt-print-text"></pre>
    <span class="prompt-print-status" id="${kind}-prompt-print-status"></span>
  </div>`;
}

function promptPrintMiniMarkup(kind, text) {
  return `<div class="prompt-print-mini" id="${kind}-prompt-print-mini">
    <span class="prompt-print-mini-label"><i data-lucide="printer" aria-hidden="true"></i>已发送提示词</span>
    <span class="prompt-print-mini-text">${escapeHtml(shortText(text || '', 46))}</span>
    <button class="text-button" type="button" data-print-action="copy"><i data-lucide="copy" aria-hidden="true"></i>复制</button>
    <button class="text-button" type="button" data-print-action="view"><i data-lucide="expand" aria-hidden="true"></i>完整查看</button>
  </div>`;
}

function startPromptPrint(kind, text) {
  stopPromptPrint(kind);
  if (!text) return;
  promptPrintStates[kind] = { text, index: 0, done: false, timer: 0 };
  promptPrintStep(kind);
}

function stopPromptPrint(kind) {
  const state = promptPrintStates[kind];
  if (state?.timer) window.clearTimeout(state.timer);
  promptPrintStates[kind] = null;
}

function promptPrintStep(kind) {
  const state = promptPrintStates[kind];
  if (!state || state.done) return;
  if (state.index >= state.text.length) {
    state.done = true;
    syncPromptPrintDom(kind);
    return;
  }
  state.index = Math.min(state.text.length, state.index + 1);
  syncPromptPrintDom(kind);
  state.timer = window.setTimeout(() => promptPrintStep(kind), 30);
}

function syncPromptPrintDom(kind) {
  const state = promptPrintStates[kind];
  const container = document.getElementById(`${kind}-prompt-print`);
  const textNode = document.getElementById(`${kind}-prompt-print-text`);
  const statusNode = document.getElementById(`${kind}-prompt-print-status`);
  if (container) container.classList.toggle('done', Boolean(state?.done));
  if (textNode) textNode.textContent = state ? state.text.slice(0, state.index) : '';
  if (statusNode) statusNode.textContent = state?.done ? '已发送，等待模型生成…' : '';
}

function ensurePromptPrint(kind) {
  syncPromptPrintDom(kind);
  const state = promptPrintStates[kind];
  if (state && !state.done && !state.timer) promptPrintStep(kind);
}

function handlePrintAction(event) {
  const button = event.target.closest('[data-print-action]');
  if (!button) return;
  const zone = button.closest('#image-result') ? 'image' : 'video';
  const text = zone === 'image' ? imageActivePrompt : (videoJob?.prompt || '');
  if (!text) return;
  if (button.dataset.printAction === 'copy') {
    copyText(text);
    return;
  }
  showNoticeModal({ title: '发送给模型的提示词', message: text, kicker: '提示词' });
}

function setVideoMode(mode, persist = true) {
  const nextMode = ['text', 'image', 'keyframes'].includes(mode) ? mode : 'text';
  state.ui.video.mode = nextMode;
  $$('.segment-button[data-video-mode]').forEach((button) => button.classList.toggle('is-active', button.dataset.videoMode === nextMode));
  $('#video-image-inputs').classList.toggle('is-hidden', nextMode !== 'image');
  $('#video-keyframe-inputs').classList.toggle('is-hidden', nextMode !== 'keyframes');
  renderVideoRefs();
  if (persist) saveState();
}

function renderVideoJob() {
  const result = $('#video-result');
  const stopButton = $('#video-stop');
  const refreshButton = $('#video-refresh');
  if (!videoJob) {
    stopButton.hidden = true;
    refreshButton.hidden = true;
    result.innerHTML = '<div class="job-empty"><i data-lucide="film" aria-hidden="true"></i><span>还没有视频任务</span><small>异步任务创建后，进度和最终 URL 会显示在这里。</small></div>';
    refreshIcons();
    return;
  }
  const status = videoJob.status;
  const isActive = ['creating', 'queued', 'in_progress'].includes(status);
  const isTerminal = ['completed', 'failed'].includes(status);
  stopButton.hidden = !isActive || !videoPollController;
  refreshButton.hidden = !videoJob.videoId || isTerminal;
  refreshButton.disabled = videoRefreshInFlight || videoRefreshRequested;
  const statusText = videoJob.rateLimited ? '查询延后' : ({ creating: '创建中', queued: '排队中', in_progress: '生成中', completed: '已完成', failed: '失败', stopped: '已停止跟踪' }[status] || status);
  const statusClass = videoJob.rateLimited ? 'is-delayed' : status === 'failed' ? 'is-failed' : status === 'completed' ? 'is-complete' : '';
  const progress = Math.max(0, Math.min(100, Number(videoJob.progress || 0)));
  if (status === 'completed' && videoJob.url) {
    const url = safeMediaUrl(videoJob.url);
    stopPromptPrint('video');
    result.innerHTML = `<div class="video-result"><video controls preload="metadata" src="${escapeHtml(url)}"></video><div class="video-result-actions"><button class="icon-button small" type="button" data-video-action="copy" aria-label="复制视频 URL" data-tooltip="复制视频 URL"><i data-lucide="link" aria-hidden="true"></i></button><button class="icon-button small" type="button" data-video-action="download" aria-label="下载视频" data-tooltip="下载视频"><i data-lucide="download" aria-hidden="true"></i></button></div><div class="job-meta"><div class="job-meta-item"><small>状态</small><strong>已完成</strong></div><div class="job-meta-item"><small>尺寸</small><strong>${escapeHtml(videoJob.size || '--')}</strong></div><div class="job-meta-item"><small>时长</small><strong>${escapeHtml(videoJob.seconds || '--')} 秒</strong></div></div></div>${videoJob.prompt ? promptPrintMiniMarkup('video', videoJob.prompt) : ''}`;
    refreshIcons();
    return;
  }
  const notice = videoJob.error
    ? `<p class="job-notice is-error">${escapeHtml(videoJob.error)}</p>`
    : videoJob.pollNotice
      ? `<p class="job-notice">${escapeHtml(videoJob.pollNotice)}</p>`
      : '';
  const printBlock = isActive
    ? promptPrintMarkup('video')
    : (videoJob.prompt ? promptPrintMiniMarkup('video', videoJob.prompt) : '');
  result.innerHTML = `<div class="job-card"><div class="job-status-row"><span class="job-status ${statusClass}"><span class="status-light ${status === 'failed' || videoJob.rateLimited ? '' : 'is-live'}"></span>${statusText}</span><span class="mono">${progress}%</span></div><div class="job-progress"><div class="job-progress-bar" style="width:${progress}%"></div></div><div class="job-meta"><div class="job-meta-item"><small>视频编号</small><strong>${escapeHtml(shortText(videoJob.videoId || '--', 18))}</strong></div><div class="job-meta-item"><small>尺寸</small><strong>${escapeHtml(videoJob.size || '--')}</strong></div><div class="job-meta-item"><small>状态</small><strong>${escapeHtml(statusText)}</strong></div></div>${notice}${printBlock}</div>`;
  if (isActive) {
    ensurePromptPrint('video');
  } else {
    stopPromptPrint('video');
  }
  refreshIcons();
}

function getVideoSettings() {
  return { ...state.ui.video };
}

async function handleVideoGenerate() {
  if (!requireApiKey()) return;
  const prompt = $('#video-prompt').value.trim();
  const mode = state.ui.video.mode;
  if (!prompt) { showToast('请输入视频提示词。', 'error'); $('#video-prompt').focus(); return; }
  const imageRef = videoImageRefs[0] || null;
  const keyframeRefs = [videoKeyframeRefs[0], videoKeyframeRefs[1]].filter(isUsableVideoRef);
  if (mode === 'image' && !isUsableVideoRef(imageRef)) { showToast('图生视频需要一张首帧参考图（上传图片或填写 HTTPS 链接）。', 'error'); return; }
  if (mode === 'keyframes' && keyframeRefs.length !== 2) { showToast('关键帧动画需要两张参考图（上传图片或填写 HTTPS 链接）。', 'error'); return; }
  const button = $('#video-generate');
  button.disabled = true;
  videoPollController = new AbortController();
  videoRefreshRequested = false;
  videoRefreshInFlight = false;
  videoJob = { status: 'creating', progress: 0, createdAt: Date.now(), prompt };
  startPromptPrint('video', prompt);
  renderVideoJob();
  try {
    const created = await AgnesClient.createVideo({ mode, prompt, imageUrl: imageRef ? videoRefValue(imageRef) : '', keyframeUrls: keyframeRefs.map(videoRefValue), settings: getVideoSettings(), signal: videoPollController.signal });
    const videoId = created.video_id || created.task_id || created.id;
    if (!videoId) throw new AgnesApiError('任务创建成功，但响应中没有 video_id 或 task_id。');
    videoJob = { ...videoJob, ...created, videoId, status: created.status || 'queued', progress: Number(created.progress || 0), size: created.size, seconds: created.seconds, prompt };
    renderVideoJob();
    await pollVideo(videoId, prompt);
  } catch (error) {
    if (error.name === 'AbortError') {
      if (videoJob && videoJob.status !== 'completed') videoJob.status = 'stopped';
    } else {
      videoJob = { ...(videoJob || {}), status: 'failed', error: error.message };
      showToast(error.message, 'error');
    }
    renderVideoJob();
  } finally {
    videoPollController = null;
    videoPollWake = null;
    videoRefreshRequested = false;
    videoRefreshInFlight = false;
    button.disabled = false;
    renderVideoJob();
  }
}

function getVideoRetryDelay(error, currentDelay) {
  const serverDelay = Number(error.retryAfter || 0);
  if (serverDelay > 0) return Math.min(VIDEO_POLL_POLICY.maximumRetryAfter, Math.max(VIDEO_POLL_POLICY.minimumRetryAfter, serverDelay));
  return Math.min(VIDEO_POLL_POLICY.maxDelay, Math.max(VIDEO_POLL_POLICY.rateLimitFallback, Math.round(currentDelay * 2)));
}

async function pollVideo(videoId, prompt, { single = false } = {}) {
  const deadline = Date.now() + VIDEO_POLL_POLICY.deadline;
  let delay = VIDEO_POLL_POLICY.initialDelay;
  while (Date.now() < deadline) {
    const manualRefresh = videoRefreshRequested;
    videoRefreshRequested = false;
    let payload;
    try {
      videoRefreshInFlight = true;
      renderVideoJob();
      payload = await AgnesClient.getVideo(videoId, videoPollController.signal);
    } catch (error) {
      if (error.status !== 429) throw error;
      const retryDelay = getVideoRetryDelay(error, delay);
      const pendingStatus = ['queued', 'in_progress'].includes(videoJob?.status) ? videoJob.status : 'queued';
      videoJob = {
        ...videoJob,
        status: pendingStatus,
        rateLimited: true,
        pollNotice: single
          ? `服务端暂时限流，请等待 ${formatWaitDuration(retryDelay)} 后再手动刷新。`
          : `服务端正在生成，查询已限流；将在 ${formatWaitDuration(retryDelay)} 后自动重试，可点击“刷新状态”提前查询。`
      };
      videoRefreshInFlight = false;
      renderVideoJob();
      if (single) return;
      await waitForVideoPoll(retryDelay, videoPollController.signal);
      continue;
    } finally {
      videoRefreshInFlight = false;
    }
    videoJob = { ...videoJob, ...payload, videoId, status: payload.status || videoJob.status, progress: Number(payload.progress ?? videoJob.progress ?? 0), size: payload.size || videoJob.size, seconds: payload.seconds || videoJob.seconds };
    videoJob.rateLimited = false;
    videoJob.pollNotice = '';
    if (videoJob.status === 'completed') {
      videoJob.url = payload.metadata?.url || payload.url || '';
      if (!videoJob.url) throw new AgnesApiError('视频任务已完成，但响应中没有 metadata.url。');
      addWork({ kind: 'video', title: shortText(prompt, 38), prompt, url: videoJob.url, meta: `${videoJob.size || '--'} / ${videoJob.seconds || '--'} 秒`, createdAt: Date.now() });
      updateKeyStatus(true);
      showToast('视频已完成并保存到作品。');
      renderVideoJob();
      return;
    }
    if (videoJob.status === 'failed') throw new AgnesApiError(payload.error?.message || '视频任务生成失败。');
    renderVideoJob();
    if (single) {
      videoJob = { ...videoJob, status: 'stopped', pollNotice: '任务仍在生成，可稍后点击“刷新状态”再次查询。' };
      renderVideoJob();
      return;
    }
    const refreshQueued = videoRefreshRequested;
    videoRefreshRequested = false;
    await waitForVideoPoll(refreshQueued || manualRefresh ? 1000 : delay, videoPollController.signal);
    delay = Math.min(VIDEO_POLL_POLICY.maxDelay, Math.round(delay * VIDEO_POLL_POLICY.backoffFactor));
  }
  throw new AgnesApiError('视频轮询超过 10 分钟，已停止跟踪。');
}

function stopVideoPolling() {
  if (!videoPollController) return;
  videoRefreshRequested = false;
  videoPollController.abort();
  showToast('已停止自动跟踪，可手动刷新任务状态。');
}

async function refreshVideoStatus() {
  if (!videoJob?.videoId || ['completed', 'failed'].includes(videoJob.status) || videoRefreshInFlight || videoRefreshRequested) return;
  videoRefreshRequested = true;
  if (videoPollController) {
    if (videoPollWake) videoPollWake();
    renderVideoJob();
    showToast('已安排立即查询任务状态。');
    return;
  }
  videoPollController = new AbortController();
  videoRefreshInFlight = true;
  videoJob = { ...videoJob, status: videoJob.status === 'stopped' ? 'queued' : videoJob.status, rateLimited: false, pollNotice: '正在查询任务状态……', error: '' };
  renderVideoJob();
  try {
    await pollVideo(videoJob.videoId, videoJob.prompt || '', { single: true });
  } catch (error) {
    if (error.name === 'AbortError') {
      videoJob = { ...videoJob, status: 'stopped', pollNotice: '已停止本次查询，可稍后再次刷新。' };
    } else {
      videoJob = { ...videoJob, status: 'failed', error: error.message };
      showToast(error.message, 'error');
    }
  } finally {
    videoPollController = null;
    videoPollWake = null;
    videoRefreshRequested = false;
    videoRefreshInFlight = false;
    renderVideoJob();
  }
}

function waitForVideoPoll(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', abort);
      if (videoPollWake === wake) videoPollWake = null;
      callback();
    };
    const wake = () => finish(resolve);
    const abort = () => finish(() => reject(new DOMException('请求已停止。', 'AbortError')));
    const timer = window.setTimeout(wake, milliseconds);
    videoPollWake = wake;
    if (!signal) return;
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  });
}

function addWork(record) {
  state.works = [{ id: createId('work'), ...record }, ...state.works].slice(0, 40);
  saveState();
  renderWorks();
}

function renderWorks() {
  const works = state.works.filter((work) => activeWorkFilter === 'all' || work.kind === activeWorkFilter);
  const allCount = state.works.length;
  const imageCount = state.works.filter((work) => work.kind === 'image').length;
  const videoCount = state.works.filter((work) => work.kind === 'video').length;
  $('#works-count').textContent = String(allCount);
  $('#all-work-count').textContent = String(allCount);
  $('#image-work-count').textContent = String(imageCount);
  $('#video-work-count').textContent = String(videoCount);
  $('#inspector-work-total').textContent = String(allCount);
  $('#inspector-image-total').textContent = String(imageCount);
  $('#inspector-video-total').textContent = String(videoCount);
  $$('.filter-tab').forEach((button) => button.classList.toggle('is-active', button.dataset.workFilter === activeWorkFilter));
  if (!works.length) {
    $('#works-grid').innerHTML = '<div class="works-empty"><i data-lucide="archive" aria-hidden="true"></i><span>作品库还没有记录</span><small>完成一次图像或视频生成后，结果会出现在这里。</small></div>';
    refreshIcons();
    return;
  }
  $('#works-grid').innerHTML = works.map((work) => {
    const url = safeMediaUrl(work.url);
    const isVideo = work.kind === 'video';
    const media = url ? (isVideo ? `<video muted preload="metadata" src="${escapeHtml(url)}"></video>` : `<img src="${escapeHtml(url)}" alt="${escapeHtml(work.title)}">`) : '<div class="output-empty"><i data-lucide="image-off" aria-hidden="true"></i></div>';
    return `<article class="work-card" data-work-id="${work.id}"><div class="work-card-media">${media}<span class="work-card-type"><i data-lucide="${isVideo ? 'clapperboard' : 'image'}" aria-hidden="true"></i>${isVideo ? '视频' : '图像'}</span></div><div class="work-card-body"><div class="work-card-title" title="${escapeHtml(work.title)}">${escapeHtml(work.title)}</div><div class="work-card-meta"><span>${escapeHtml(work.meta || '--')}</span><span>${formatDate(work.createdAt)}</span></div><div class="work-card-actions"><button type="button" data-work-action="open" data-work-id="${work.id}"><i data-lucide="external-link" aria-hidden="true"></i>打开</button><button type="button" data-work-action="download" data-work-id="${work.id}"><i data-lucide="download" aria-hidden="true"></i>下载</button><button type="button" data-work-action="delete" data-work-id="${work.id}" aria-label="删除作品" data-tooltip="删除作品"><i data-lucide="trash-2" aria-hidden="true"></i></button></div></div></article>`;
  }).join('');
  refreshIcons();
}

function clearWorks() {
  if (!state.works.length) { showToast('作品库已经为空。'); return; }
  state.works = [];
  saveState();
  renderWorks();
  showToast('作品记录已清除。');
}

function handleWorkAction(event) {
  const mediaArea = event.target.closest('.work-card-media');
  if (mediaArea) {
    const filtered = state.works.filter((work) => activeWorkFilter === 'all' || work.kind === activeWorkFilter);
    const work = filtered.find((item) => item.id === mediaArea.closest('.work-card')?.dataset.workId);
    if (!work) return;
    const items = filtered.map((item) => ({ url: safeMediaUrl(item.url), title: item.title, meta: item.meta || '', kind: item.kind })).filter((item) => item.url);
    if (!items.length) return;
    const index = Math.max(0, items.findIndex((item) => item.url === safeMediaUrl(work.url)));
    openMediaPreview({ items, index });
    return;
  }
  const button = event.target.closest('[data-work-action]');
  if (!button) return;
  const work = state.works.find((item) => item.id === button.dataset.workId);
  if (!work) return;
  if (button.dataset.workAction === 'delete') {
    showConfirmModal({
      title: '删除作品',
      message: `作品「${work.title}」将从作品库中移除，且无法撤销。`,
      confirmText: '确认删除',
      onConfirm: () => {
        state.works = state.works.filter((item) => item.id !== work.id);
        saveState();
        renderWorks();
      }
    });
    return;
  }
  if (button.dataset.workAction === 'open') window.open(work.url, '_blank', 'noopener,noreferrer');
  if (button.dataset.workAction === 'download') downloadAsset(work.url, `${work.kind === 'video' ? 'agnes-video' : 'agnes-image'}-${work.id}`, work.kind);
}

$('#video-result')?.addEventListener('click', (event) => {
  if (event.target.closest('[data-print-action]')) { handlePrintAction(event); return; }
  const button = event.target.closest('[data-video-action]');
  if (!button || !videoJob?.url) return;
  if (button.dataset.videoAction === 'copy') copyText(videoJob.url);
  if (button.dataset.videoAction === 'download') downloadAsset(videoJob.url, 'agnes-video.mp4', 'video');
});

async function copyText(value) {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    showToast('已复制到剪贴板。');
  } catch (error) {
    showToast('复制失败，请手动选择文本。', 'error');
  }
}

async function downloadAsset(url, filename, kind = 'image') {
  const mediaLabel = kind === 'video' ? '视频' : '图片';
  const safeUrl = safeMediaUrl(url);
  if (!safeUrl) { showToast('媒体地址不可用。', 'error'); return; }
  let blob = null;
  try {
    const response = await fetch(safeUrl);
    if (!response.ok) throw new Error('download failed');
    blob = await response.blob();
  } catch (error) {
    blob = null;
  }
  if (blob && blob.size) {
    try {
      await saveBlob(blob, filename);
      showToast('下载已开始。');
    } catch (error) {
      if (error.name !== 'AbortError') showToast('下载失败。', 'error');
    }
    return;
  }
  openMediaFallback(safeUrl, kind);
  showNoticeModal({
    title: `无法直接下载${mediaLabel}`,
    message: `${mediaLabel}服务未开放下载，已在新标签页打开该${mediaLabel}。`,
    detail: `请在新打开的${mediaLabel}页中右键点击${mediaLabel}，选择「另存为」完成保存。`,
  });
}

function openMediaFallback(url, kind) {
  if (kind === 'video') {
    const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>视频预览</title><style>html,body{margin:0;min-height:100%;background:#000}body{display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box}video{max-width:100%;max-height:calc(100vh - 48px);outline:0}</style></head><body><video src="${escapeHtml(url)}" controls preload="metadata"></video></body></html>`;
    const objectUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    window.open(objectUrl, '_blank', 'noopener,noreferrer');
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

async function saveBlob(blob, filename) {
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({ suggestedName: filename });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (error) {
      if (error.name === 'AbortError') return;
    }
  }
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

document.addEventListener('DOMContentLoaded', init);
