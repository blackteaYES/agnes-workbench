'use strict';

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
  const session = { id: createId('chat'), title: '新会话', createdAt: Date.now(), updatedAt: Date.now(), messages: [], _messagesLoaded: true };
  state.chatSessions.unshift(session);
  state.activeChatId = session.id;
  persistChatSession(session, { immediate: true });
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
  if (isImageDataUrl(value)) return value;
  try {
    const url = new URL(value);
    return ['http:', 'https:', 'blob:'].includes(url.protocol) ? url.href : '';
  } catch (error) {
    return '';
  }
}

function safeRemoteMediaUrl(value) {
  const url = safeMediaUrl(value);
  return /^https?:/i.test(url) ? url : '';
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch (error) {
    return false;
  }
}

function normalizeCustomBaseUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) throw new Error('请输入自定义 Base URL。');
  let url;
  try {
    url = new URL(raw);
  } catch (error) {
    throw new Error('Base URL 格式无效，请填写完整的 HTTP(S) 地址。');
  }
  const localHosts = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && localHosts.has(url.hostname))) {
    throw new Error('自定义地址必须使用 HTTPS；本地调试仅允许 localhost、127.0.0.1 或 [::1]。');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('Base URL 不能包含账号、密码、查询参数或 hash。');
  }
  return `${url.origin}${url.pathname}`.replace(/\/+$/, '') || url.origin;
}

function activeConnectionLabel() {
  if (state.connection.endpoint === 'custom') return '自定义';
  return CONFIG.endpoints[state.connection.endpoint]?.label || CONFIG.endpoints.international.label;
}

function activeBaseUrl() {
  if (state.connection.endpoint === 'custom') {
    try { return normalizeCustomBaseUrl(state.connection.customBaseUrl); } catch (error) { return CONFIG.endpoints.international.baseUrl; }
  }
  return CONFIG.endpoints[state.connection.endpoint]?.baseUrl || CONFIG.endpoints.international.baseUrl;
}

function shortText(value, length = 70) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > length ? `${text.slice(0, length)}...` : text;
}

function middleShortText(value, length = 84) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= length) return text;
  const available = Math.max(12, length - 3);
  const head = Math.ceil(available * 0.62);
  return `${text.slice(0, head)}...${text.slice(-(available - head))}`;
}

function formatDate(timestamp) {
  try {
    return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp));
  } catch (error) {
    return '--/-- --:--';
  }
}

function formatFullDate(timestamp) {
  if (!timestamp) return '';
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).format(new Date(timestamp));
  } catch (error) {
    return '';
  }
}

function formatMediaDuration(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value < 0) return '';
  if (value < 60) return `${value.toFixed(value < 10 ? 1 : 0)} 秒`;
  const minutes = Math.floor(value / 60);
  const rest = Math.floor(value % 60).toString().padStart(2, '0');
  return `${minutes}:${rest}`;
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

function syncOverlayState() {
  const hasOverlay = Boolean(document.querySelector('.modal-backdrop:not([hidden]), .preview-backdrop, .inspector.is-mobile-open'));
  document.body.classList.toggle('overlay-open', hasOverlay);
}

function trapFocus(event, container) {
  if (event.key !== 'Tab' || !container) return;
  const focusable = Array.from(container.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'))
    .filter((element) => !element.hidden && element.getClientRects().length > 0);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
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
  const close = () => { backdrop.remove(); syncOverlayState(); };
  backdrop.querySelector('#notice-modal-close').addEventListener('click', close);
  backdrop.querySelector('#notice-modal-confirm').addEventListener('click', close);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });
  const confirmButton = backdrop.querySelector('#notice-modal-confirm');
  syncOverlayState();
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
  const close = () => { backdrop.remove(); syncOverlayState(); };
  backdrop.querySelector('#confirm-modal-close').addEventListener('click', close);
  backdrop.querySelector('#confirm-modal-cancel').addEventListener('click', close);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });
  backdrop.querySelector('#confirm-modal-ok').addEventListener('click', () => { close(); onConfirm(); });
  syncOverlayState();
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

function openWorkPicker({ onConfirm, max = 1, selected = [] }) {
  const images = state.works
    .filter((work) => work.kind === 'image' && safeMediaUrl(work.url))
    .map((work) => ({
      ...work,
      url: safeMediaUrl(work.url),
      displayUrl: workMediaRuntime.get(work.id)?.status === 'ready' ? workMediaRuntime.get(work.id).url : safeMediaUrl(work.url)
    }));
  if (!images.length) { showToast('作品库还没有图片作品，先完成一次图像生成吧。', 'error'); return; }
  const existing = $('#work-picker-modal');
  if (existing) existing.remove();
  const limit = Math.max(1, Math.min(Number(max) || 1, images.length));
  let anim = PICKER_ANIMS.some((a) => a.key === state.ui.workPickerAnimation) ? state.ui.workPickerAnimation : 'bounce';
  const availableUrls = new Set(images.map((work) => work.url));
  const selectedSet = new Set(selected.map((item) => safeMediaUrl(typeof item === 'string' ? item : item?.url)).filter((url) => availableUrls.has(url)).slice(0, limit));
  let draftSelection = new Set(selectedSet);
  const returnFocus = document.activeElement;
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
      <p class="modal-copy">选择作品图片，确认后应用为参考图。</p>
      <div class="picker-anim-row">
        <span class="picker-anim-label">入场动画</span>
        <div class="picker-anim-options">
          ${PICKER_ANIMS.map((a) => '<button class="picker-anim-btn' + (a.key === anim ? ' is-active' : '') + '" type="button" data-picker-anim="' + a.key + '" title="' + a.label + '" aria-label="' + a.label + '"><i data-lucide="' + a.icon + '" aria-hidden="true"></i></button>').join('')}
        </div>
      </div>
      <div class="work-picker-grid"></div>
      <div class="picker-actions"><span class="picker-count">已选 <strong id="work-picker-count">0</strong>/${limit}</span><button class="primary-action" type="button" id="work-picker-confirm" disabled><i data-lucide="check" aria-hidden="true"></i>确定选择</button></div>
    </section>`;
  document.body.appendChild(backdrop);
  refreshIcons();
  const close = ({ restoreFocus = true } = {}) => {
    backdrop.remove();
    syncOverlayState();
    if (restoreFocus && returnFocus?.isConnected) window.requestAnimationFrame(() => returnFocus.focus());
  };
  backdrop.querySelector('#work-picker-close').addEventListener('click', close);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });

  const grid = backdrop.querySelector('.work-picker-grid');

  const cardMarkup = (work, index, isSelected) =>
    '<article class="work-picker-card' + (isSelected ? ' is-selected' : '') + '" style="--i:' + Math.floor(index / 4) + '" data-work-picker-url="' + escapeHtml(work.url) + '" data-work-picker-title="' + escapeHtml(work.title) + '" data-work-picker-meta="' + escapeHtml(work.meta || '') + '"><button class="work-picker-select" type="button" data-work-picker-action="select" aria-pressed="' + (isSelected ? 'true' : 'false') + '" aria-label="选择 ' + escapeHtml(work.title) + '"><span class="work-picker-media"><img src="' + escapeHtml(work.displayUrl) + '" alt="' + escapeHtml(work.title) + '" loading="lazy"><span class="pick-check"><i data-lucide="check" aria-hidden="true"></i></span></span></button><div class="work-picker-footer"><button class="work-picker-name" type="button" data-work-picker-action="select" aria-pressed="' + (isSelected ? 'true' : 'false') + '" title="' + escapeHtml(work.title) + '"><span class="work-picker-title">' + escapeHtml(shortText(work.title, 18)) + '</span></button><button class="work-picker-preview" type="button" data-work-picker-action="preview" aria-label="预览 ' + escapeHtml(work.title) + '" data-tooltip="预览"><i data-lucide="scan-eye" aria-hidden="true"></i></button></div></article>';

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
    grid.className = 'work-picker-grid';
    grid.innerHTML = images.map((work, index) => cardMarkup(work, index, draftSelection.has(work.url))).join('');
    refreshIcons();
    bindCardEvents();
    playAnimation();
    updateActions();
  };

  const updateActions = () => {
    const count = draftSelection.size;
    const label = backdrop.querySelector('#work-picker-count');
    if (label) label.textContent = String(count);
    const confirm = backdrop.querySelector('#work-picker-confirm');
    if (confirm) confirm.disabled = count === 0;
    grid.querySelectorAll('.work-picker-card').forEach((card) => {
      const selectedCard = draftSelection.has(card.dataset.workPickerUrl);
      card.classList.toggle('is-selected', selectedCard);
      card.querySelectorAll('[data-work-picker-action="select"]').forEach((button) => button.setAttribute('aria-pressed', selectedCard ? 'true' : 'false'));
    });
  };

  const toggleSelection = (url) => {
    if (draftSelection.has(url)) {
      draftSelection.delete(url);
      updateActions();
      return true;
    }
    if (limit === 1) draftSelection.clear();
    else if (draftSelection.size >= limit) {
      showToast('最多选择 ' + limit + ' 张。', 'error');
      return false;
    }
    draftSelection.add(url);
    updateActions();
    return true;
  };

  const openPreviewFor = (card) => {
    const index = images.findIndex((work) => work.url === card.dataset.workPickerUrl);
    if (index < 0) return;
    const items = images.map(previewItemFromWork);
    openMediaPreview({
      items,
      index,
      isItemSelected: (item) => draftSelection.has(item.sourceUrl || item.url),
      disabledWhenChoosing: (item) => limit > 1 && draftSelection.size >= limit && !draftSelection.has(item.sourceUrl || item.url),
      chooseDisabledLabel: `已达上限（最多 ${limit} 张）`,
      onChoose: (item) => toggleSelection(item.sourceUrl || item.url),
      returnFocus: card.querySelector('[data-work-picker-action="preview"]')
    });
  };

  const bindCardEvents = () => {
    grid.querySelectorAll('.work-picker-card').forEach((card) => {
      card.addEventListener('click', (event) => {
        const action = event.target.closest('[data-work-picker-action]')?.dataset.workPickerAction;
        if (action === 'preview') { openPreviewFor(card); return; }
        if (action === 'select' || !action) toggleSelection(card.dataset.workPickerUrl);
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

  backdrop.querySelector('#work-picker-confirm').addEventListener('click', () => {
    const items = images.filter((work) => draftSelection.has(work.url)).map((work) => ({
      url: work.url,
      title: work.title,
      meta: work.meta || '',
      prompt: work.prompt || '',
      generation: work.generation || null,
      createdAt: work.createdAt || null
    }));
    close({ restoreFocus: false });
    onConfirm?.(items);
  });

  syncOverlayState();
  buildCards();
  window.requestAnimationFrame(() => backdrop.querySelector('#work-picker-close')?.focus());
  return close;
}

function generationDetailRows(item) {
  const generation = item?.generation || {};
  const rows = [];
  const add = (label, value, copyable = false) => {
    if (value === undefined || value === null || value === '') return;
    rows.push({ label, value: String(value), copyable });
  };
  add('模型', generation.model);
  add('生成模式', generation.modeLabel || (item.kind === 'video' ? VIDEO_MODE_LABELS[generation.mode] : IMAGE_MODE_LABELS[generation.mode]));
  if (item.kind === 'video') {
    add('画面尺寸', generation.width && generation.height ? `${generation.width} × ${generation.height}` : generation.size);
    add('画面比例', generation.ratio);
    add('时长', generation.duration ? `${generation.duration} 秒` : generation.seconds ? `${generation.seconds} 秒` : '');
    add('总帧数', generation.frames);
    add('帧率', generation.frameRate ? `${generation.frameRate} fps` : '');
  } else {
    add('尺寸档位', generation.size);
    add('画面比例', generation.ratio);
  }
  add('风格', generation.styleLabel);
  add(item.kind === 'video' ? '参考帧' : '参考图', Number.isFinite(Number(generation.referenceCount)) ? `${generation.referenceCount} 张` : '');
  if (item.kind === 'image') add('响应格式', generation.responseFormat);
  if (item.kind === 'video') {
    add('负向提示词', generation.negativePrompt, true);
    add('种子', generation.seed);
  }
  add('生成时间', formatFullDate(item.createdAt || generation.createdAt));
  return rows;
}

function previewItemFromWork(work) {
  return {
    url: workMediaRuntime.get(work.id)?.url || safeMediaUrl(work.url),
    sourceUrl: safeMediaUrl(work.url),
    workId: work.id,
    title: work.title,
    meta: work.meta || '',
    kind: work.kind,
    prompt: work.prompt || '',
    generation: work.generation || null,
    createdAt: work.createdAt || null,
    allowUrlCopy: Boolean(work.url)
  };
}

function previewSummaryFacts(item) {
  const generation = item?.generation || {};
  const facts = [];
  const add = (value) => { if (value && !facts.includes(String(value))) facts.push(String(value)); };
  add(item.meta);
  add(generation.modeLabel || (item.kind === 'video' ? VIDEO_MODE_LABELS[generation.mode] : IMAGE_MODE_LABELS[generation.mode]));
  if (generation.styleLabel && generation.styleLabel !== '自由发挥') add(generation.styleLabel);
  if (Number(generation.referenceCount) > 0) add(`${generation.referenceCount} 张${item.kind === 'video' ? '参考帧' : '参考图'}`);
  return facts;
}

function previewDisplayTitle(item) {
  const title = String(item?.title || '').trim();
  if (title && !['Agnes 生成图像', 'Agnes 生成视频'].includes(title)) return title;
  return shortText(item?.prompt, 44) || title || (item?.kind === 'video' ? '视频作品' : '图像作品');
}

function previewPromptSummary(item) {
  const prompt = String(item?.prompt || '').replace(/\s+/g, ' ').trim();
  const title = previewDisplayTitle(item).replace(/\.\.\.$/, '').trim();
  if (!prompt) return '';
  if (title && prompt.startsWith(title)) return middleShortText(prompt.slice(title.length).replace(/^[\s,，。:：;；·-]+/, ''), 112);
  return middleShortText(prompt, 112);
}

function showMediaDetailsModal(item, returnFocus = document.activeElement) {
  const existing = $('#media-details-modal');
  if (existing) existing.remove();
  const rows = generationDetailRows(item);
  const url = safeMediaUrl(item.sourceUrl || item.url || item.src);
  const copyableUrl = /^https?:/i.test(url) ? url : '';
  const sections = [];
  if (item.prompt) {
    sections.push(`<section class="media-detail-section"><div class="media-detail-heading"><h3>提示词</h3><button class="text-button" type="button" data-media-detail-copy="prompt"><i data-lucide="copy" aria-hidden="true"></i>复制提示词</button></div><pre class="media-detail-prompt">${escapeHtml(item.prompt)}</pre></section>`);
  }
  if (rows.length) {
    sections.push(`<section class="media-detail-section"><h3>生成参数</h3><dl class="media-detail-grid">${rows.map((row, index) => `<div class="media-detail-row"><dt>${escapeHtml(row.label)}</dt><dd>${escapeHtml(row.value)}</dd>${row.copyable ? `<button class="icon-button small" type="button" data-media-detail-copy="row" data-media-detail-row="${index}" aria-label="复制${escapeHtml(row.label)}" data-tooltip="复制${escapeHtml(row.label)}"><i data-lucide="copy" aria-hidden="true"></i></button>` : ''}</div>`).join('')}</dl></section>`);
  }
  if (copyableUrl) {
    sections.push(`<section class="media-detail-section media-detail-url"><div class="media-detail-heading"><h3>媒体地址</h3>${copyableUrl && item.allowUrlCopy !== false ? '<button class="text-button" type="button" data-media-detail-copy="url"><i data-lucide="copy" aria-hidden="true"></i>复制地址</button>' : ''}</div><p title="${escapeHtml(url)}">${escapeHtml(shortText(url, 120))}</p></section>`);
  }
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop media-details-backdrop';
  backdrop.id = 'media-details-modal';
  backdrop.innerHTML = `<section class="modal-panel media-details-panel" role="dialog" aria-modal="true" aria-labelledby="media-details-title"><div class="modal-topline"><span class="section-kicker"><span class="signal-line"></span> 生成详情</span><button class="icon-button small" type="button" data-media-detail-action="close" aria-label="关闭生成详情" data-tooltip="关闭"><i data-lucide="x" aria-hidden="true"></i></button></div><h2 id="media-details-title">${escapeHtml(previewDisplayTitle(item))}</h2><div class="media-details-content">${sections.join('') || '<p class="modal-copy">这个媒体没有可展示的附加信息。</p>'}</div></section>`;
  document.body.appendChild(backdrop);
  refreshIcons();
  syncOverlayState();
  const panel = backdrop.querySelector('.media-details-panel');
  const close = () => {
    document.removeEventListener('keydown', onKeys, true);
    backdrop.remove();
    syncOverlayState();
    if (returnFocus?.isConnected) window.requestAnimationFrame(() => returnFocus.focus());
  };
  const onKeys = (event) => {
    if (event.key === 'Escape') { event.stopPropagation(); close(); return; }
    trapFocus(event, panel);
  };
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop || event.target.closest('[data-media-detail-action="close"]')) { close(); return; }
    const copyAction = event.target.closest('[data-media-detail-copy]');
    if (!copyAction) return;
    if (copyAction.dataset.mediaDetailCopy === 'prompt') copyText(item.prompt);
    else if (copyAction.dataset.mediaDetailCopy === 'url') copyText(copyableUrl);
    else if (copyAction.dataset.mediaDetailCopy === 'row') copyText(rows[Number(copyAction.dataset.mediaDetailRow)]?.value || '');
  });
  document.addEventListener('keydown', onKeys, true);
  window.requestAnimationFrame(() => backdrop.querySelector('[data-media-detail-action="close"]')?.focus());
}

function openMediaPreview({ items, index = 0, isItemSelected, onChoose, chooseLabel = '选择这张图', chooseSelectedLabel = '已选，点击取消', chooseDisabledLabel = '', disabledWhenChoosing, returnFocus = document.activeElement }) {
  const existing = $('#media-preview');
  if (existing) existing.remove();
  const list = Array.from(items || []).filter((item) => item && (item.url || item.src || item.workId));
  if (!list.length) return;
  let current = Math.min(Math.max(0, index), list.length - 1);
  const navVisible = list.length > 1;
  const overlay = document.createElement('div');
  overlay.className = 'preview-backdrop';
  overlay.id = 'media-preview';
  overlay.innerHTML = `
    <div class="preview-stage${navVisible ? ' has-navigation' : ''}" role="dialog" aria-modal="true" aria-label="媒体预览">
      <div class="preview-media-frame">
        <div class="preview-media-slot" data-preview-media-slot>
          <div class="preview-media-box is-loading" data-preview-media-box><div class="preview-media-element" data-preview-media-element></div><button class="icon-button small preview-close" type="button" data-preview-action="close" aria-label="关闭预览" data-tooltip="关闭"><i data-lucide="x" aria-hidden="true"></i></button></div>
        </div>
      </div>
      ${navVisible ? '<div class="preview-nav-row"><button class="preview-nav preview-nav-prev" type="button" data-preview-action="prev" aria-label="上一张" data-tooltip="上一张"><i data-lucide="chevron-left" aria-hidden="true"></i></button><span class="preview-counter mono" data-preview-counter aria-live="polite">1 / ' + list.length + '</span><button class="preview-nav preview-nav-next" type="button" data-preview-action="next" aria-label="下一张" data-tooltip="下一张"><i data-lucide="chevron-right" aria-hidden="true"></i></button></div>' : ''}
      <section class="preview-info-panel" aria-label="媒体信息">
        <div class="preview-info-toolbar">
          <div class="preview-info-facts"><span class="preview-kind-badge"><i data-lucide="image" aria-hidden="true"></i><span data-preview-kind>图像</span></span><div class="preview-facts" data-preview-facts></div></div>
          <div class="preview-info-actions">
            <button class="text-button" type="button" data-preview-action="copy-prompt" hidden><i data-lucide="copy" aria-hidden="true"></i>复制提示词</button>
            <button class="text-button" type="button" data-preview-action="details" hidden><i data-lucide="list-collapse" aria-hidden="true"></i><span data-preview-details-label>查看参数</span></button>
            ${onChoose ? '<button class="primary-action" type="button" data-preview-action="choose"><i data-lucide="check" aria-hidden="true"></i><span data-preview-choose-label></span></button>' : ''}
          </div>
        </div>
        <div class="preview-info-summary">
          <strong data-preview-title></strong>
          <button class="preview-prompt-summary" type="button" data-preview-action="details" hidden><span aria-hidden="true">·</span><span data-preview-prompt></span><i data-lucide="expand" aria-hidden="true"></i></button>
        </div>
      </section>
    </div>`;
  document.body.appendChild(overlay);
  refreshIcons();
  syncOverlayState();

  const stage = overlay.querySelector('.preview-stage');
  const mediaSlot = overlay.querySelector('[data-preview-media-slot]');
  const mediaBox = overlay.querySelector('[data-preview-media-box]');
  const mediaElement = overlay.querySelector('[data-preview-media-element]');
  let naturalSize = null;
  let resizeFrame = 0;
  let renderVersion = 0;

  const updateMediaBox = () => {
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(() => {
      if (!naturalSize || !mediaSlot.isConnected) return;
      const rect = mediaSlot.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const scale = Math.min(rect.width / naturalSize.width, rect.height / naturalSize.height, 1);
      mediaBox.style.width = `${Math.max(1, Math.round(naturalSize.width * scale))}px`;
      mediaBox.style.height = `${Math.max(1, Math.round(naturalSize.height * scale))}px`;
      mediaBox.classList.remove('is-loading');
    });
  };

  const renderDetails = (item) => {
    const kind = item.kind === 'video' ? '视频' : '图像';
    const badgeIcon = overlay.querySelector('.preview-kind-badge [data-lucide]');
    if (badgeIcon) badgeIcon.setAttribute('data-lucide', item.kind === 'video' ? 'clapperboard' : 'image');
    overlay.querySelector('[data-preview-kind]').textContent = kind;
    const title = overlay.querySelector('[data-preview-title]');
    title.textContent = previewDisplayTitle(item);
    title.title = item.title || '';
    const facts = [...previewSummaryFacts(item), ...(item.details || []).map((detail) => detail?.value || detail)].filter(Boolean);
    overlay.querySelector('[data-preview-facts]').innerHTML = facts.map((fact) => `<span>${escapeHtml(fact)}</span>`).join('');
    const promptButton = overlay.querySelector('.preview-prompt-summary');
    const promptText = overlay.querySelector('[data-preview-prompt]');
    const promptSummary = previewPromptSummary(item);
    promptButton.hidden = !promptSummary;
    promptText.textContent = promptSummary;
    promptText.title = item.prompt || '';
    overlay.querySelector('[data-preview-action="copy-prompt"]').hidden = !item.prompt;
    const detailRows = generationDetailRows(item);
    const hasDetails = Boolean(item.prompt || detailRows.length || item.details?.length);
    const detailsLabel = overlay.querySelector('[data-preview-details-label]');
    if (detailsLabel) detailsLabel.textContent = detailRows.length ? '查看参数' : '查看信息';
    overlay.querySelectorAll('[data-preview-action="details"]').forEach((button) => {
      if (!button.classList.contains('preview-prompt-summary')) button.hidden = !hasDetails;
    });
  };

  const renderMedia = () => {
    renderVersion += 1;
    const version = renderVersion;
    const item = list[current];
    const src = item.url || item.src;
    naturalSize = null;
    mediaBox.classList.add('is-loading');
    mediaBox.classList.remove('is-unavailable');
    mediaBox.style.removeProperty('width');
    mediaBox.style.removeProperty('height');
    if (!src) {
      naturalSize = { width: 640, height: 360 };
      mediaBox.classList.add('is-unavailable');
      mediaElement.innerHTML = '<div class="preview-media-error"><i data-lucide="image-off" aria-hidden="true"></i><strong>媒体地址失效</strong><small>作品记录仍然保留，但没有可加载的本地缓存或远程地址。</small><div><button class="text-button" type="button" data-preview-action="recache"><i data-lucide="refresh-cw" aria-hidden="true"></i>尝试重新缓存</button></div></div>';
      renderDetails(item);
      updateMediaBox();
      refreshIcons();
      return;
    }
    mediaElement.innerHTML = item.kind === 'video' ? `<video controls autoplay muted playsinline preload="metadata" src="${escapeHtml(src)}"></video>` : `<img src="${escapeHtml(src)}" alt="${escapeHtml(item.title || '')}">`;
    const media = mediaElement.querySelector('img, video');
    let readyHandled = false;
    const onReady = () => {
      if (readyHandled || version !== renderVersion || !media.isConnected) return;
      readyHandled = true;
      const width = media instanceof HTMLVideoElement ? media.videoWidth : media.naturalWidth;
      const height = media instanceof HTMLVideoElement ? media.videoHeight : media.naturalHeight;
      naturalSize = width && height ? { width, height } : { width: 16, height: 9 };
      item.mediaWidth = width || null;
      item.mediaHeight = height || null;
      if (media instanceof HTMLVideoElement && Number.isFinite(media.duration)) item.mediaDuration = media.duration;
      const measured = [width && height ? `${width} × ${height}px` : '', item.mediaDuration ? formatMediaDuration(item.mediaDuration) : ''].filter(Boolean);
      item.details = [...(item.details || []).filter((detail) => !detail?.runtime), ...measured.map((value) => ({ value, runtime: true }))];
      renderDetails(item);
      updateMediaBox();
    };
    media.addEventListener(item.kind === 'video' ? 'loadedmetadata' : 'load', onReady, { once: true });
    media.addEventListener('error', () => {
      if (version !== renderVersion || !media.isConnected) return;
      const sourceUrl = safeMediaUrl(item.sourceUrl);
      const runtime = item.workId ? workMediaRuntime.get(item.workId) : null;
      if (runtime?.status === 'ready' && src === runtime.url && sourceUrl && sourceUrl !== src) {
        item.url = sourceUrl;
        workMediaRuntime.set(item.workId, { status: 'cache-failed', error: '本地缓存无法读取，已回退远程地址', record: runtime.record });
        renderMedia();
        return;
      }
      naturalSize = { width: 640, height: 360 };
      mediaBox.classList.add('is-unavailable');
      mediaElement.innerHTML = `<div class="preview-media-error"><i data-lucide="image-off" aria-hidden="true"></i><strong>媒体地址失效</strong><small>远程媒体无法加载，可重新缓存或在新窗口检查原地址。</small><div><button class="text-button" type="button" data-preview-action="recache"><i data-lucide="refresh-cw" aria-hidden="true"></i>尝试重新缓存</button>${sourceUrl ? '<button class="text-button" type="button" data-preview-action="open-original"><i data-lucide="external-link" aria-hidden="true"></i>打开原地址</button>' : ''}</div></div>`;
      if (item.workId) workMediaRuntime.set(item.workId, { status: 'unavailable', error: '远程媒体地址无法访问' });
      updateMediaBox();
      refreshIcons();
    }, { once: true });
    if ((media instanceof HTMLImageElement && media.complete) || (media instanceof HTMLVideoElement && media.readyState >= 1)) onReady();
    if (media instanceof HTMLVideoElement) {
      try {
        const playback = media.play();
        if (playback?.catch) playback.catch(() => {});
      } catch (error) {
        // 浏览器阻止自动播放时保留原生控件。
      }
    }
    renderDetails(item);
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
  };

  let swipeStart = null;
  const handleSwipeStart = (event) => {
    if (!navVisible || !['touch', 'pen'].includes(event.pointerType) || event.isPrimary === false) return;
    if (event.target.closest('[data-preview-action]')) return;
    const video = event.target.closest('video');
    if (video) {
      const rect = video.getBoundingClientRect();
      if (event.clientY >= rect.bottom - 56) return;
    }
    swipeStart = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  };
  const handleSwipeEnd = (event) => {
    if (!swipeStart || event.pointerId !== swipeStart.pointerId) return;
    const { x, y } = swipeStart;
    swipeStart = null;
    const dx = event.clientX - x;
    const dy = event.clientY - y;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
    go(dx < 0 ? 1 : -1);
  };
  const handleSwipeCancel = () => { swipeStart = null; };
  mediaSlot.addEventListener('pointerdown', handleSwipeStart);
  mediaSlot.addEventListener('pointerup', handleSwipeEnd);
  mediaSlot.addEventListener('pointercancel', handleSwipeCancel);
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(updateMediaBox) : null;
  resizeObserver?.observe(mediaSlot);
  window.addEventListener('resize', updateMediaBox);

  const close = () => {
    renderVersion += 1;
    document.removeEventListener('keydown', onKeys);
    resizeObserver?.disconnect();
    window.removeEventListener('resize', updateMediaBox);
    window.cancelAnimationFrame(resizeFrame);
    overlay.remove();
    syncOverlayState();
    if (returnFocus?.isConnected) window.requestAnimationFrame(() => returnFocus.focus());
  };

  const onKeys = (event) => {
    if ($('#media-details-modal')) return;
    if (event.key === 'Escape') { close(); return; }
    trapFocus(event, stage);
    if (!navVisible) return;
    if (event.key === 'ArrowLeft') go(-1);
    if (event.key === 'ArrowRight') go(1);
  };

  overlay.addEventListener('click', (event) => {
    const action = event.target.closest('[data-preview-action]')?.dataset.previewAction;
    if (event.target === overlay) { close(); return; }
    if (!action) return;
    const item = list[current];
    if (action === 'close') close();
    else if (action === 'prev') go(-1);
    else if (action === 'next') go(1);
    else if (action === 'copy-prompt') copyText(item.prompt);
    else if (action === 'details') showMediaDetailsModal(item, event.target.closest('[data-preview-action]'));
    else if (action === 'open-original') {
      const url = safeMediaUrl(item.sourceUrl || item.url);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    } else if (action === 'recache') {
      const work = state.works.find((record) => record.id === item.workId);
      if (!work) { showToast('这个媒体没有可重新缓存的作品记录。', 'error'); return; }
      const button = event.target.closest('[data-preview-action="recache"]');
      button.disabled = true;
      cacheWorkMedia(work, { force: true }).then((record) => {
        button.disabled = false;
        if (!record) return;
        item.url = workMediaRuntime.get(work.id)?.url || safeMediaUrl(work.url);
        renderMedia();
      });
    }
    else if (action === 'choose') {
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
  window.requestAnimationFrame(() => overlay.querySelector('.preview-close')?.focus());
}

function openWorkspaceMenu() {
  const existing = $('#workspace-menu');
  if (existing) { existing.remove(); syncOverlayState(); return; }
  const menu = document.createElement('div');
  menu.id = 'workspace-menu';
  menu.className = 'workspace-menu modal-backdrop';
  menu.innerHTML = `<section class="workspace-menu-panel" role="dialog" aria-modal="true" aria-labelledby="workspace-menu-title"><div class="modal-topline"><span class="section-kicker"><span class="signal-line"></span> 本地工作区</span><button class="icon-button small" type="button" data-workspace-close aria-label="关闭工作区菜单"><i data-lucide="x" aria-hidden="true"></i></button></div><h2 id="workspace-menu-title">在工作区中切换</h2><div class="workspace-menu-grid">${Object.entries(MODE_META).map(([mode, meta]) => `<button type="button" data-workspace-mode="${mode}"><i data-lucide="${mode === 'chat' ? 'message-square-text' : mode === 'image' ? 'image' : mode === 'video' ? 'clapperboard' : 'archive'}" aria-hidden="true"></i>${meta.label}</button>`).join('')}<button type="button" data-workspace-settings><i data-lucide="settings-2" aria-hidden="true"></i>设置中心</button><button type="button" data-workspace-storage><i data-lucide="database" aria-hidden="true"></i>存储管理</button><button type="button" data-workspace-help><i data-lucide="circle-help" aria-hidden="true"></i>帮助中心</button></div></section>`;
  document.body.appendChild(menu);
  refreshIcons();
  const onKey = (event) => { if (event.key === 'Escape') { event.preventDefault(); close(); } };
  const close = () => { document.removeEventListener('keydown', onKey, true); menu.remove(); syncOverlayState(); };
  document.addEventListener('keydown', onKey, true);
  menu.addEventListener('click', (event) => {
    if (event.target === menu || event.target.closest('[data-workspace-close]')) { close(); return; }
    const mode = event.target.closest('[data-workspace-mode]')?.dataset.workspaceMode;
    if (mode) { close(); setMode(mode); return; }
    if (event.target.closest('[data-workspace-settings]')) { close(); openSettingsModal('general'); return; }
    if (event.target.closest('[data-workspace-storage]')) { close(); openSettingsModal('storage'); return; }
    if (event.target.closest('[data-workspace-help]')) { close(); openHelpCenter(); }
  });
  syncOverlayState();
  menu.querySelector('[data-workspace-close]')?.focus();
}

function openHelpCenter() {
  const existing = $('#help-modal');
  if (existing) { existing.remove(); syncOverlayState(); return; }
  const backdrop = document.createElement('div');
  backdrop.id = 'help-modal';
  backdrop.className = 'modal-backdrop';
  const sections = [
    ['start', '快速开始', '先在连接设置中选择站点并配置 API 密钥，然后从文本、图像或视频模式开始创作。'],
    ['chat', '文本对话', '输入问题后发送。通过添加图片可以让 Agnes 进行图像理解，消息支持编辑、复制和重新生成。'],
    ['image', '图像生成', '文生图直接输入描述；图生图和多图合成可拖入参考图、从作品集合选择或添加 HTTPS 图片链接。'],
    ['video', '视频生成', '选择文生视频、图生视频或关键帧动画，设置时长、比例和帧率后提交异步任务。'],
    ['reference', '参考图与关键帧', '点击参考图可放大预览；在可排序场景中按住图片并移动即可排序或交换，删除按钮只移除当前参考图。'],
    ['works', '作品集合', '生成结果会保留媒体 URL、提示词和参数。图片可自动缓存，视频可在作品卡中手动缓存。'],
    ['backup', '作品备份', '作品页面可导出或导入版本化 JSON。备份包含媒体地址、提示词和生成参数，不包含 API 密钥或媒体文件。'],
    ['storage', '本地存储', '聊天正文和本地附件保存在 IndexedDB，清理缓存不会删除作品记录。设置中心可检查、修复和管理安全字段。'],
    ['connection', '连接与站点', '国际站、国内站和自定义 Base URL 共用一个 API 密钥。连接失败时可在设置中心测试网络与认证状态。'],
    ['appearance', '界面设置', '主题支持深色、浅色和跟随系统；还可以调整界面密度、减少动效和自动保存频率。'],
    ['faq', '常见问题', '远程地址失效时可重新缓存或打开原地址；浏览器无痕模式可能限制 IndexedDB 和持久存储。']
  ];
  backdrop.innerHTML = `<section class="modal-panel help-panel" role="dialog" aria-modal="true" aria-labelledby="help-title"><div class="modal-topline"><span class="section-kicker"><span class="signal-line"></span> 使用手册</span><button class="icon-button small" type="button" data-help-close aria-label="关闭帮助"><i data-lucide="x" aria-hidden="true"></i></button></div><h2 id="help-title">Agnes 工作台帮助</h2><div class="help-quick-actions"><button type="button" data-help-mode="chat">文本对话</button><button type="button" data-help-mode="image">图像生成</button><button type="button" data-help-mode="video">视频生成</button><button type="button" data-help-mode="works">作品集合</button><button type="button" data-help-settings="storage">存储设置</button><button type="button" data-help-settings="connection">连接设置</button></div><input class="help-search" type="search" placeholder="搜索帮助内容" aria-label="搜索帮助内容"><div class="help-layout"><nav class="help-toc">${sections.map(([id, title]) => `<button type="button" data-help-target="${id}">${title}</button>`).join('')}</nav><div class="help-content">${sections.map(([id, title, body]) => `<article id="help-section-${id}" data-help-section><h3>${title}</h3><p>${body}</p></article>`).join('')}</div></div></section>`;
  document.body.appendChild(backdrop);
  refreshIcons();
  const onKey = (event) => { if (event.key === 'Escape') { event.preventDefault(); close(); } };
  const close = () => { document.removeEventListener('keydown', onKey, true); backdrop.remove(); syncOverlayState(); };
  document.addEventListener('keydown', onKey, true);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop || event.target.closest('[data-help-close]')) { close(); return; }
    const target = event.target.closest('[data-help-target]')?.dataset.helpTarget;
    if (target) $(`#help-section-${target}`, backdrop)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const mode = event.target.closest('[data-help-mode]')?.dataset.helpMode;
    if (mode) { close(); setMode(mode); return; }
    const settings = event.target.closest('[data-help-settings]')?.dataset.helpSettings;
    if (settings) { close(); openSettingsModal(settings); }
  });
  $('.help-search', backdrop).addEventListener('input', (event) => {
    const query = event.target.value.trim().toLowerCase();
    $$('[data-help-section]', backdrop).forEach((section) => { section.hidden = Boolean(query && !section.textContent.toLowerCase().includes(query)); });
  });
  syncOverlayState();
  backdrop.querySelector('[data-help-close]')?.focus();
}

async function openStorageDataManager() {
  if (!storageReady || !storageRepository) { showToast('IndexedDB 当前不可用。', 'error'); return; }
  const existing = $('#storage-data-modal');
  if (existing) { existing.remove(); syncOverlayState(); return; }
  const backdrop = document.createElement('div');
  backdrop.id = 'storage-data-modal';
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<section class="modal-panel storage-data-panel" role="dialog" aria-modal="true" aria-labelledby="storage-data-title"><div class="modal-topline"><span class="section-kicker"><span class="signal-line"></span> IndexedDB 管理</span><button class="icon-button small" type="button" data-storage-close aria-label="关闭数据管理"><i data-lucide="x" aria-hidden="true"></i></button></div><h2 id="storage-data-title">本地数据</h2><div class="storage-data-toolbar"><select id="storage-data-store" aria-label="数据类型"><option value="sessions">会话</option><option value="messages">消息</option><option value="blobs">聊天附件</option><option value="workMedia">作品缓存</option><option value="meta">系统元数据</option></select><input id="storage-data-search" type="search" placeholder="搜索记录" aria-label="搜索记录"></div><div class="storage-data-actions"><button class="text-button" type="button" id="storage-new-session"><i data-lucide="plus" aria-hidden="true"></i>新建空会话</button><button class="text-button" type="button" id="storage-new-message"><i data-lucide="message-square-plus" aria-hidden="true"></i>新增消息</button></div><div id="storage-data-list" class="storage-data-list"></div></section>`;
  document.body.appendChild(backdrop);
  refreshIcons();
  const onKey = (event) => { if (event.key === 'Escape') { event.preventDefault(); close(); } };
  const close = () => { document.removeEventListener('keydown', onKey, true); backdrop.remove(); syncOverlayState(); };
  document.addEventListener('keydown', onKey, true);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop || event.target.closest('[data-storage-close]')) close(); });
  const render = async () => {
    const store = $('#storage-data-store', backdrop).value;
    const query = $('#storage-data-search', backdrop).value;
    const records = await storageRepository.listStorageRecords(store, { query, limit: 100 });
    $('#storage-data-list', backdrop).innerHTML = records.length ? records.map((record) => { const key = String(record.id || record.workId || record.key || ''); const editable = store === 'sessions'; const message = record.message || {}; const messageText = Array.isArray(message.content) ? message.content.filter((part) => part?.type === 'text').map((part) => part.text || '').join('') : ''; return `<article class="storage-data-record"><strong>${escapeHtml(record.title || record.name || record.id || record.workId || record.key || '记录')}</strong><small>${escapeHtml(store)} · ${escapeHtml(formatFullDate(record.updatedAt || record.createdAt || record.cachedAt || Date.now()))}</small>${editable ? `<input class="storage-data-title-input" data-storage-title="${escapeHtml(key)}" value="${escapeHtml(record.title || '')}" aria-label="会话标题">` : ''}${store === 'messages' ? `<select class="storage-data-role" data-storage-message-role="${escapeHtml(key)}" aria-label="消息角色"><option value="user"${message.role === 'user' ? ' selected' : ''}>用户</option><option value="assistant"${message.role === 'assistant' ? ' selected' : ''}>助手</option><option value="system"${message.role === 'system' ? ' selected' : ''}>系统</option></select><textarea class="storage-data-message-input" data-storage-message-text="${escapeHtml(key)}" rows="2" aria-label="消息文本">${escapeHtml(messageText)}</textarea><textarea class="storage-data-message-input" data-storage-message-reasoning="${escapeHtml(key)}" rows="2" aria-label="思考内容" placeholder="思考内容（可选）">${escapeHtml(message.reasoning || '')}</textarea>` : ''}<button type="button" data-storage-delete="${escapeHtml(key)}" data-storage-store="${store}"${store === 'meta' ? ' disabled' : ''}><i data-lucide="trash-2" aria-hidden="true"></i>删除</button></article>`; }).join('') : '<div class="storage-data-empty">没有匹配的记录</div>';
    refreshIcons();
  };
  backdrop.addEventListener('change', (event) => { if (event.target.id === 'storage-data-store') render(); });
  let searchTimer = 0;
  $('#storage-data-search', backdrop).addEventListener('input', () => { window.clearTimeout(searchTimer); searchTimer = window.setTimeout(render, 160); });
  $('#storage-new-session', backdrop).addEventListener('click', async () => { startNewChat(); await persistChatSession(getActiveSession(), { immediate: true }); await render(); });
  $('#storage-new-message', backdrop).addEventListener('click', async () => { const session = getActiveSession(); const message = await storageRepository.appendStoredMessage(session.id, { role: 'user', text: '' }); session.messages.push(message); session.messageCount = session.messages.length; session.updatedAt = Date.now(); await storageRepository.updateSessionMetadata(session.id, { messageCount: session.messageCount }); saveState({ immediate: true }); renderChat(); await render(); showToast('已新增空白消息，可在列表中编辑。'); });
  backdrop.addEventListener('click', (event) => {
    const button = event.target.closest('[data-storage-delete]');
    if (!button || button.disabled) return;
    showConfirmModal({ title: '删除本地记录', message: '此操作只影响 IndexedDB 中的本地数据，无法撤销。', confirmText: '确认删除', onConfirm: async () => {
      const store = button.dataset.storageStore;
      const key = button.dataset.storageDelete;
      if (store === 'sessions') await storageRepository.deleteStoredSession(key);
      else if (store === 'messages') await storageRepository.deleteStoredMessage(key);
      else if (store === 'blobs') await storageRepository.deleteStoredBlob(key);
      else if (store === 'workMedia') { suppressWorkCache(key); cancelWorkCacheJob(key); await storageRepository.deleteStoredWorkMedia(key); const objectUrl = workMediaObjectUrls.get(key); if (objectUrl) URL.revokeObjectURL(objectUrl); workMediaObjectUrls.delete(key); workMediaRuntime.delete(key); renderWorks(); }
      if (store === 'sessions') {
        state.chatSessions = state.chatSessions.filter((session) => session.id !== key);
        if (state.activeChatId === key) { state.activeChatId = state.chatSessions[0]?.id || null; ensureChatSession(); }
        renderChat();
        saveState({ immediate: true });
        await storageRepository.cleanupOrphanBlobs(runtimeBlobRefs());
      }
      if (store === 'messages') {
        const session = state.chatSessions.find((item) => item.messages?.some((message) => message.id === key));
        if (session) { session.messages = session.messages.filter((message) => message.id !== key); session.messageCount = session.messages.length; session.updatedAt = Date.now(); await storageRepository.updateSessionMetadata(session.id, { messageCount: session.messageCount }); renderChat(); saveState({ immediate: true }); await storageRepository.cleanupOrphanBlobs(runtimeBlobRefs()); }
      }
      await render(); updateStorageStats();
    } });
  });
  backdrop.addEventListener('change', async (event) => {
    const input = event.target.closest('[data-storage-title]');
    if (input) try {
      await storageRepository.updateSessionMetadata(input.dataset.storageTitle, { title: input.value });
      const session = state.chatSessions.find((item) => item.id === input.dataset.storageTitle);
      if (session) { session.title = input.value; session.updatedAt = Date.now(); }
      saveState({ immediate: true });
      renderChat();
      showToast('会话标题已更新。');
    } catch (error) { showToast('会话标题更新失败。', 'error'); }
    const role = event.target.closest('[data-storage-message-role]');
    if (role) await updateManagedMessage(role.dataset.storageMessageRole, { role: role.value });
  });
  backdrop.addEventListener('blur', async (event) => {
    const input = event.target.closest('[data-storage-message-text]');
    if (input) await updateManagedMessage(input.dataset.storageMessageText, { text: input.value });
    const reasoning = event.target.closest('[data-storage-message-reasoning]');
    if (reasoning) await updateManagedMessage(reasoning.dataset.storageMessageReasoning, { reasoning: reasoning.value });
  }, true);
  syncOverlayState();
  await render();
  backdrop.querySelector('[data-storage-close]')?.focus();
}

async function updateManagedMessage(id, patch = {}) {
  try {
    const record = await storageRepository.getStorageRecord('messages', id);
    if (!record) return;
    const content = Array.isArray(record.message?.content) ? record.message.content.map((part) => ({ ...part })) : [{ type: 'text', text: '' }];
    const memoryMessage = state.chatSessions.flatMap((session) => session.messages || []).find((message) => message.id === id);
    const memoryContent = Array.isArray(memoryMessage?.content) ? memoryMessage.content.map((part) => ({ ...part })) : content.map((part) => ({ ...part }));
    if (patch.text !== undefined) {
      const textPart = content.find((part) => part.type === 'text');
      if (textPart) textPart.text = String(patch.text).slice(0, 20000);
      else content.unshift({ type: 'text', text: String(patch.text).slice(0, 20000) });
      const memoryTextPart = memoryContent.find((part) => part.type === 'text');
      if (memoryTextPart) memoryTextPart.text = String(patch.text).slice(0, 20000);
      else memoryContent.unshift({ type: 'text', text: String(patch.text).slice(0, 20000) });
    }
    const reasoning = patch.reasoning !== undefined ? String(patch.reasoning).slice(0, 20000) : undefined;
    await storageRepository.updateStoredMessage(id, { role: patch.role, content, reasoning });
    for (const session of state.chatSessions) {
      const message = session.messages?.find((item) => item.id === id);
      if (message) { message.role = patch.role || message.role; message.content = memoryContent; if (reasoning !== undefined) message.reasoning = reasoning; session.updatedAt = Date.now(); session.messageCount = session.messages.length; }
    }
    renderChat();
    saveState({ immediate: true });
    showToast('消息已更新。');
  } catch (error) { showToast('消息更新失败。', 'error'); }
}
