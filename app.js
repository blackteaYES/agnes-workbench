'use strict';

const CONFIG = {
  endpoints: {
    international: { label: '国际站', baseUrl: 'https://apihub.agnes-ai.com' },
    china: { label: '国内站', baseUrl: 'https://apihub.agnes-ai.cn' }
  },
  models: {
    chat: 'agnes-2.5-flash',
    image: 'agnes-image-2.1-flash',
    video: 'agnes-video-v2.0'
  },
  storage: {
    key: 'agnes-workbench.api-key',
    state: 'agnes-workbench.v1',
    database: 'agnes-workbench.storage',
    databaseVersion: 2
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

const IMAGE_MODE_LABELS = { text: '文生图', image: '图生图', composite: '多图合成' };
const VIDEO_MODE_LABELS = { text: '文生视频', image: '图生视频', keyframes: '关键帧动画' };
const WORKS_BACKUP_FORMAT = 'agnes-workbench-works';
const WORKS_BACKUP_VERSION = 1;
const WORKS_IMPORT_MAX_BYTES = 5 * 1024 * 1024;
const WORKS_LIMIT = 40;
const CHAT_SESSION_LIMIT = 20;
const LIGHTWEIGHT_STATE_VERSION = 3;
const STORAGE_POLICY_LIMITS = {
  sessions: { min: 5, max: 100 },
  works: { min: 10, max: 100 }
};
const WORK_GENERATION_FIELDS = [
  'model', 'mode', 'modeLabel', 'size', 'ratio', 'stylePreset', 'styleLabel',
  'referenceCount', 'responseFormat', 'createdAt', 'width', 'height', 'duration',
  'seconds', 'frames', 'frameRate', 'negativePrompt', 'seed'
];

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

const VIDEO_STYLE_PRESETS = {
  none: { label: '自由发挥', prompt: '' },
  cinematic: { label: '电影叙事', prompt: '电影级叙事镜头，主体运动与镜头调度连贯，前中后景层次清晰，戏剧性光影，节奏自然且具有视觉张力' },
  product: { label: '商业产品', prompt: '高级商业广告影像，产品主体始终清晰，材质细节稳定，运镜克制流畅，精确布光，适合品牌与产品展示' },
  documentary: { label: '自然纪实', prompt: '自然纪实影像，真实环境光与物理运动，手持感克制，保留现场细节，动作自然可信，色彩不过度修饰' },
  oriental: { label: '东方意境', prompt: '东方美学动态意境，留白构图，含蓄雅致的色彩，舒缓节奏，镜头运动轻盈，细节带有传统文化气质' },
  neon: { label: '赛博霓虹', prompt: '赛博朋克动态视觉，霓虹冷暖对比，潮湿反光材质，未来城市氛围，镜头运动利落，高密度细节保持稳定' },
  film: { label: '柔和胶片', prompt: '柔和胶片影像质感，细微颗粒，低饱和复古色调，自然柔光，镜头运动舒缓，画面温润且时序连贯' },
  illustration: { label: '艺术插画', prompt: '动态艺术插画，造型语言统一，色彩与构图具有设计感，动作节奏清晰，逐帧细节稳定，画面完整连贯' }
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

const PROMPT_EXAMPLES_FALLBACK = {
  version: 1,
  textToImage: {
    title: '给你的下一幅杰作，留一个位置。',
    description: '选择一个模板作为起点，再在下方提示词调成你的表达。',
    examples: [{
      id: 'wedding-invitation',
      title: '中式婚礼请柬',
      image: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=720&q=82',
      alt: '柔和编辑感的新娘肖像与婚礼请柬海报',
      prompt: '创作一张具有柔和编辑感新娘肖像美学的精致奢华中式婚礼请柬海报。新人姓名：${Lin Zhao & Shen Zhiyi}。婚礼日期：${2026 年 5 月 20 日}。誓言短句：${我愿意，和你一起成为我们}。婚礼地点：${杭州 · 白塔公园}。仪式时间：${18:00}。新娘形象：${棕发柔和盘起、佩戴花朵珍珠耳饰、露肩并穿白色缎面礼服的新娘}。可见标题：${WEDDING DAY}。仪式文字：${宜｜嫁娶}。花束：${粉紫色花束}。配色：${雾感浅灰、象牙白、粉紫与白色}。采用方形构图与优雅留白，背景使用所选配色，并带细微胶片颗粒薄雾。将所选新娘放在右侧三分之一处，裁切为从额头到下颌的侧脸。左侧与中央留给排版，左下加入虚化深灰前景阴影，右下加入柔焦的所选花束。准确使用七组白色文字：所选日期的大写英文格式；所选誓言短句；所选可见标题；同一所选日期的数字格式；所选仪式文字；所选新人姓名；所选婚礼地点与仪式时间。使用高级浪漫纸品、电影柔焦、明亮自然窗光、低反差、奶油白、暖肤色、细腻散景和克制奢华。避免边框、额外 Logo、水印和多余文字。'
    }]
  }
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

let loadedStateHadMessages = false;
let state = loadState();
let apiKey = readStoredKey();
let connectionStatus = 'idle';
let connectionDraft = { endpoint: state.connection.endpoint, customBaseUrl: state.connection.customBaseUrl || '' };
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
const promptAssistStates = {
  image: { request: null, activeKind: 'optimize', cancelArmed: false, cancelTimer: 0 },
  video: { request: null, activeKind: 'optimize', cancelArmed: false, cancelTimer: 0 }
};
let imageActivePrompt = null;
let promptPrintStates = { image: null, video: null };
let toastTimer = 0;
let storageRepository = null;
let storageReady = false;
let storageMigrationLocked = false;
let storageWarningShown = false;
let lightweightStorageWarningShown = false;
let lightweightSaveTimer = 0;
const sessionSaveTimers = new Map();
const sessionWriteQueues = new Map();
const startupNotices = [];
const workMediaRuntime = new Map();
const workMediaObjectUrls = new Map();
const workCacheJobs = new Map();
const workCacheSuppressed = new Set();
let promptExamples = null;
let promptShowcaseCollapsed = false;
let selectedPromptExampleId = '';
let storageHealthReport = null;
let storageEngineState = 'checking';
let workBackfillStarted = false;
let workBackfillPromise = null;
let settingsReturnFocus = null;
let settingsKeyHandler = null;

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
    connection: { endpoint: 'international', customBaseUrl: '', lastVerifiedAt: 0 },
    ui: {
      chat: { temperature: 0.7, maxTokens: 2048, thinking: false, autoFullscreen: true },
      image: { mode: 'text', size: '2K', ratio: '1:1', stylePreset: 'none', keywordDirection: '' },
      video: { mode: 'text', duration: '5', ratio: '16:9', frameRate: '24', negativePrompt: '', seed: '', stylePreset: 'none', keywordDirection: '' },
      general: { theme: 'system', density: 'comfortable', reducedMotion: false, autoSaveProfile: 'standard' },
      storage: { cacheImages: true, sessionRetention: CHAT_SESSION_LIMIT, workRetention: WORKS_LIMIT },
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
    const next = { ...fallback, ...saved, connection: { ...fallback.connection, ...(saved.connection || {}) }, ui: { ...fallback.ui, ...(saved.ui || {}) } };
    next.ui.chat = { ...fallback.ui.chat, ...(next.ui.chat || {}) };
    next.ui.image = { ...fallback.ui.image, ...(next.ui.image || {}) };
    next.ui.video = { ...fallback.ui.video, ...(next.ui.video || {}) };
    next.ui.general = { ...fallback.ui.general, ...(next.ui.general || {}) };
    next.ui.storage = { ...fallback.ui.storage, ...(next.ui.storage || {}) };
    next.ui.layout = { ...fallback.ui.layout, ...(next.ui.layout || {}) };
    next.chatSessions = Array.isArray(next.chatSessions) ? next.chatSessions : [];
    loadedStateHadMessages = next.chatSessions.some((session) => Array.isArray(session?.messages));
    next.chatSessions = next.chatSessions.map((session) => {
      const hasMessages = Array.isArray(session.messages);
      return {
        ...session,
        messages: hasMessages ? session.messages : [],
        messageCount: Number.isFinite(Number(session.messageCount)) ? Number(session.messageCount) : (hasMessages ? session.messages.length : 0),
        _messagesLoaded: hasMessages
      };
    });
    next.works = Array.isArray(next.works) ? next.works : [];
    next.connection.endpoint = ['international', 'china', 'custom'].includes(next.connection.endpoint) ? next.connection.endpoint : 'international';
    next.connection.customBaseUrl = typeof next.connection.customBaseUrl === 'string' ? next.connection.customBaseUrl : '';
    next.connection.lastVerifiedAt = Number.isFinite(Number(next.connection.lastVerifiedAt)) ? Number(next.connection.lastVerifiedAt) : 0;
    next.ui.general.theme = ['dark', 'light', 'system'].includes(next.ui.general.theme) ? next.ui.general.theme : 'dark';
    next.ui.general.density = next.ui.general.density === 'compact' ? 'compact' : 'comfortable';
    next.ui.general.autoSaveProfile = next.ui.general.autoSaveProfile === 'low' ? 'low' : 'standard';
    next.ui.storage.cacheImages = next.ui.storage.cacheImages !== false;
    next.ui.storage.sessionRetention = normalizeRetention(next.ui.storage.sessionRetention, 'sessions');
    next.ui.storage.workRetention = normalizeRetention(next.ui.storage.workRetention, 'works');
    if (next.connection.endpoint === 'custom' && next.connection.customBaseUrl) {
      try { next.connection.customBaseUrl = normalizeCustomBaseUrl(next.connection.customBaseUrl); } catch (error) { next.connection = { endpoint: 'international', customBaseUrl: '' }; }
    }
    if (!next.activeChatId || !next.chatSessions.some((session) => session.id === next.activeChatId)) next.activeChatId = next.chatSessions[0]?.id || null;
    return next;
  } catch (error) {
    return fallback;
  }
}

function chatSessionMetadata(session) {
  return {
    id: session.id,
    title: String(session.title || '新会话'),
    createdAt: Number(session.createdAt || Date.now()),
    updatedAt: Number(session.updatedAt || session.createdAt || Date.now()),
    messageCount: session._messagesLoaded === false ? Number(session.messageCount || 0) : (Array.isArray(session.messages) ? session.messages.length : Number(session.messageCount || 0))
  };
}

function lightweightStateSnapshot() {
  return {
    storageVersion: LIGHTWEIGHT_STATE_VERSION,
    activeMode: state.activeMode,
    activeChatId: state.activeChatId,
    connection: state.connection,
    ui: state.ui,
    chatSessions: state.chatSessions.map(chatSessionMetadata),
    works: state.works
  };
}

function writeLightweightState() {
  window.clearTimeout(lightweightSaveTimer);
  lightweightSaveTimer = 0;
  try {
    localStorage.setItem(CONFIG.storage.state, JSON.stringify(lightweightStateSnapshot()));
  } catch (error) {
    if (!lightweightStorageWarningShown) {
      lightweightStorageWarningShown = true;
      showToast('界面设置无法写入浏览器存储，请检查隐私设置或可用空间。', 'error');
    }
  }
}

function saveState({ immediate = false } = {}) {
  if (storageMigrationLocked) return;
  if (immediate) { writeLightweightState(); return; }
  window.clearTimeout(lightweightSaveTimer);
  lightweightSaveTimer = window.setTimeout(writeLightweightState, getStateSaveDelay());
}

function getStateSaveDelay() {
  return state.ui.general.autoSaveProfile === 'low' ? 2400 : 360;
}

function getSessionSaveDelay() {
  return state.ui.general.autoSaveProfile === 'low' ? 2800 : 420;
}

function normalizeRetention(value, kind) {
  const limits = STORAGE_POLICY_LIMITS[kind];
  const fallback = kind === 'sessions' ? CHAT_SESSION_LIMIT : WORKS_LIMIT;
  const numeric = Math.round(Number(value));
  return Number.isFinite(numeric) ? Math.min(limits.max, Math.max(limits.min, numeric)) : fallback;
}

function getStoragePolicy() {
  return {
    cacheImages: state.ui.storage.cacheImages !== false,
    sessionRetention: normalizeRetention(state.ui.storage.sessionRetention, 'sessions'),
    workRetention: normalizeRetention(state.ui.storage.workRetention, 'works')
  };
}

function saveStoragePolicy(next = {}) {
  state.ui.storage = { ...state.ui.storage, ...getStoragePolicy(), ...next };
  state.ui.storage.sessionRetention = normalizeRetention(state.ui.storage.sessionRetention, 'sessions');
  state.ui.storage.workRetention = normalizeRetention(state.ui.storage.workRetention, 'works');
  saveState();
}

function idbRequest(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener('error', () => reject(request.error || new Error('IndexedDB 请求失败。')), { once: true });
  });
}

function idbTransactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', resolve, { once: true });
    transaction.addEventListener('abort', () => reject(transaction.error || new Error('IndexedDB 事务已中止。')), { once: true });
    transaction.addEventListener('error', () => reject(transaction.error || new Error('IndexedDB 事务失败。')), { once: true });
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('无法读取本地图片附件。'));
    reader.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(value) {
  const response = await fetch(value);
  if (!response.ok) throw new Error('无法转换旧版对话图片。');
  return response.blob();
}

function isSvgFile(file) {
  return Boolean(file && (String(file.type || '').toLowerCase() === 'image/svg+xml' || /\.svg$/i.test(file.name || '')));
}

function isImageFile(file) {
  return Boolean(file && (String(file.type || '').toLowerCase().startsWith('image/') || isSvgFile(file)));
}

function isImageDataUrl(value) {
  return typeof value === 'string' && /^data:image\/[a-z0-9.+-]+(?:;[^,]*)?,/i.test(value);
}

function persistedMessageCopy(message) {
  const copy = { ...message };
  delete copy.streaming;
  delete copy.error;
  return copy;
}

async function serializeMessageForStorage(message, blobs) {
  const copy = persistedMessageCopy(message);
  if (!Array.isArray(copy.content)) return copy;
  copy.content = await Promise.all(copy.content.map(async (part) => {
    if (part?.type !== 'image_url') return { ...part };
    const source = part.image_url || {};
    if (source.ref) {
      return { type: 'image_url', image_url: { ref: source.ref, mimeType: source.mimeType || 'image/*' } };
    }
    const url = String(source.url || '');
    if (!isImageDataUrl(url)) return { type: 'image_url', image_url: { url } };
    const blob = await dataUrlToBlob(url);
    const id = source.ref || `${message.id}-image`;
    blobs.push({ id, blob, mimeType: blob.type || 'image/*', size: blob.size, createdAt: Date.now(), name: message.imageName || '对话图片' });
    return { type: 'image_url', image_url: { ref: id, mimeType: blob.type || 'image/*' } };
  }));
  return copy;
}

async function hydrateStoredMessage(message, blobMap) {
  const copy = { ...message };
  if (!Array.isArray(copy.content)) return copy;
  copy.content = await Promise.all(copy.content.map(async (part) => {
    if (part?.type !== 'image_url' || !part.image_url?.ref) return { ...part, image_url: part?.image_url ? { ...part.image_url } : part?.image_url };
    const record = blobMap.get(part.image_url.ref);
    if (!record?.blob) return null;
    return {
      type: 'image_url',
      image_url: {
        url: await blobToDataUrl(record.blob),
        ref: part.image_url.ref,
        mimeType: part.image_url.mimeType || record.mimeType || record.blob.type || 'image/*'
      }
    };
  }));
  copy.content = copy.content.filter(Boolean);
  return copy;
}

class StorageRepository {
  constructor(database) {
    this.database = database;
  }

  static open() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) { reject(new Error('当前浏览器不支持 IndexedDB。')); return; }
      const request = indexedDB.open(CONFIG.storage.database, CONFIG.storage.databaseVersion);
      request.addEventListener('upgradeneeded', () => {
        const database = request.result;
        if (!database.objectStoreNames.contains('sessions')) database.createObjectStore('sessions', { keyPath: 'id' });
        if (!database.objectStoreNames.contains('messages')) {
          const messages = database.createObjectStore('messages', { keyPath: 'id' });
          messages.createIndex('sessionId', 'sessionId', { unique: false });
        }
        if (!database.objectStoreNames.contains('blobs')) database.createObjectStore('blobs', { keyPath: 'id' });
        if (!database.objectStoreNames.contains('workMedia')) {
          const workMedia = database.createObjectStore('workMedia', { keyPath: 'workId' });
          workMedia.createIndex('kind', 'kind', { unique: false });
          workMedia.createIndex('status', 'status', { unique: false });
        }
        if (!database.objectStoreNames.contains('meta')) database.createObjectStore('meta', { keyPath: 'key' });
        request.transaction.objectStore('meta').put({
          key: 'schema-migration',
          databaseVersion: CONFIG.storage.databaseVersion,
          previousVersion: request.oldVersion,
          completedAt: Date.now()
        });
      });
      request.addEventListener('success', () => resolve(new StorageRepository(request.result)), { once: true });
      request.addEventListener('blocked', () => reject(new Error('IndexedDB 升级被其他页面阻止，请关闭旧页面后重试。')), { once: true });
      request.addEventListener('error', () => reject(request.error || new Error('IndexedDB 无法打开。')), { once: true });
    });
  }

  async prepareSession(session) {
    const blobs = [];
    const messages = [];
    for (let index = 0; index < session.messages.length; index += 1) {
      const message = await serializeMessageForStorage(session.messages[index], blobs);
      messages.push({ id: message.id, sessionId: session.id, position: index, message });
    }
    return { metadata: chatSessionMetadata(session), messages, blobs };
  }

  async replaceSession(session) {
    const prepared = await this.prepareSession(session);
    const read = this.database.transaction('messages', 'readonly');
    const readDone = idbTransactionDone(read);
    const oldRecords = await idbRequest(read.objectStore('messages').index('sessionId').getAll(session.id));
    await readDone;
    const transaction = this.database.transaction(['sessions', 'messages', 'blobs'], 'readwrite');
    const sessions = transaction.objectStore('sessions');
    const messages = transaction.objectStore('messages');
    const blobs = transaction.objectStore('blobs');
    oldRecords.forEach((record) => messages.delete(record.id));
    sessions.put(prepared.metadata);
    prepared.messages.forEach((record) => messages.put(record));
    prepared.blobs.forEach((record) => blobs.put(record));
    await idbTransactionDone(transaction);
  }

  async migrateLegacy(sessions) {
    const prepared = [];
    for (const session of sessions) prepared.push(await this.prepareSession(session));
    const transaction = this.database.transaction(['sessions', 'messages', 'blobs', 'meta'], 'readwrite');
    const sessionStore = transaction.objectStore('sessions');
    const messageStore = transaction.objectStore('messages');
    const blobStore = transaction.objectStore('blobs');
    prepared.forEach((item) => {
      sessionStore.put(item.metadata);
      item.messages.forEach((record) => messageStore.put(record));
      item.blobs.forEach((record) => blobStore.put(record));
    });
    transaction.objectStore('meta').put({ key: 'legacy-migration', completedAt: Date.now(), storageVersion: LIGHTWEIGHT_STATE_VERSION });
    await idbTransactionDone(transaction);
  }

  async getMeta(key) {
    const transaction = this.database.transaction('meta', 'readonly');
    const request = idbRequest(transaction.objectStore('meta').get(key));
    const done = idbTransactionDone(transaction);
    const value = await request;
    await done;
    return value || null;
  }

  async setMeta(value) {
    const transaction = this.database.transaction('meta', 'readwrite');
    transaction.objectStore('meta').put(value);
    await idbTransactionDone(transaction);
  }

  async loadSessions(metadataList) {
    const transaction = this.database.transaction(['sessions', 'messages', 'blobs'], 'readonly');
    const done = idbTransactionDone(transaction);
    const sessionRequest = idbRequest(transaction.objectStore('sessions').getAll());
    const messageRequest = idbRequest(transaction.objectStore('messages').getAll());
    const blobRequest = idbRequest(transaction.objectStore('blobs').getAll());
    const [storedSessions, storedMessages, storedBlobs] = await Promise.all([sessionRequest, messageRequest, blobRequest]);
    await done;
    const metadata = new Map([...(metadataList || []), ...storedSessions].map((session) => [session.id, session]));
    const bySession = new Map();
    storedMessages.sort((a, b) => a.position - b.position).forEach((record) => {
      if (!bySession.has(record.sessionId)) bySession.set(record.sessionId, []);
      bySession.get(record.sessionId).push(record.message);
    });
    const blobMap = new Map(storedBlobs.map((record) => [record.id, record]));
    const sessions = [];
    for (const session of metadata.values()) {
      const messages = [];
      for (const message of bySession.get(session.id) || []) messages.push(await hydrateStoredMessage(message, blobMap));
      sessions.push({ ...session, messages, messageCount: messages.length, _messagesLoaded: true });
    }
    return sessions.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
  }

  async getCachedWorkMedia(workId) {
    const transaction = this.database.transaction('workMedia', 'readonly');
    const done = idbTransactionDone(transaction);
    const record = await idbRequest(transaction.objectStore('workMedia').get(workId));
    await done;
    if (record?.status === 'ready') {
      record.lastAccessedAt = Date.now();
      const update = this.database.transaction('workMedia', 'readwrite');
      update.objectStore('workMedia').put(record);
      await idbTransactionDone(update);
    }
    return record || null;
  }

  async cacheWorkMedia(work, { signal, onProgress } = {}) {
    const url = safeMediaUrl(work?.url);
    if (!work?.id || !url) throw new Error('作品媒体地址不可用。');
    if (signal?.aborted) throw new DOMException('缓存已取消。', 'AbortError');
    const response = await fetch(url, { signal, mode: 'cors' });
    if (!response.ok) throw new Error(`媒体请求失败（${response.status}）。`);
    const total = Number(response.headers.get('content-length') || 0);
    let blob;
    if (response.body && total > 0) {
      const reader = response.body.getReader();
      const chunks = [];
      let loaded = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.byteLength;
        onProgress?.(Math.min(100, Math.round(loaded / total * 100)));
      }
      blob = new Blob(chunks, { type: response.headers.get('content-type') || (work.kind === 'video' ? 'video/mp4' : 'image/*') });
    } else {
      blob = await response.blob();
    }
    const record = { workId: work.id, kind: work.kind, blob, mimeType: blob.type || (work.kind === 'video' ? 'video/mp4' : 'image/*'), size: blob.size, sourceUrl: url, cachedAt: Date.now(), lastAccessedAt: Date.now(), status: 'ready', error: '' };
    const transaction = this.database.transaction('workMedia', 'readwrite');
    transaction.objectStore('workMedia').put(record);
    await idbTransactionDone(transaction);
    return record;
  }

  async markWorkMediaFailed(work, error) {
    if (!work?.id) return;
    const transaction = this.database.transaction('workMedia', 'readwrite');
    transaction.objectStore('workMedia').put({ workId: work.id, kind: work.kind, sourceUrl: safeMediaUrl(work.url), cachedAt: 0, lastAccessedAt: Date.now(), status: 'failed', error: String(error?.message || error || '缓存失败').slice(0, 300), size: 0, mimeType: '' });
    await idbTransactionDone(transaction);
  }

  async deleteCachedWorkMedia(workId) {
    const transaction = this.database.transaction('workMedia', 'readwrite');
    transaction.objectStore('workMedia').delete(workId);
    await idbTransactionDone(transaction);
  }

  async clearCachedWorkMedia({ kind = '', failedOnly = false } = {}) {
    const read = this.database.transaction('workMedia', 'readonly');
    const readDone = idbTransactionDone(read);
    const records = await idbRequest(read.objectStore('workMedia').getAll());
    await readDone;
    const selected = records.filter((record) => (!kind || record.kind === kind) && (!failedOnly || record.status === 'failed'));
    if (selected.length) {
      const transaction = this.database.transaction('workMedia', 'readwrite');
      selected.forEach((record) => transaction.objectStore('workMedia').delete(record.workId));
      await idbTransactionDone(transaction);
    }
    return selected;
  }

  async getStorageSnapshot() {
    const transaction = this.database.transaction(['sessions', 'messages', 'blobs', 'workMedia', 'meta'], 'readonly');
    const done = idbTransactionDone(transaction);
    const sessionsRequest = idbRequest(transaction.objectStore('sessions').getAll());
    const messagesRequest = idbRequest(transaction.objectStore('messages').getAll());
    const blobsRequest = idbRequest(transaction.objectStore('blobs').getAll());
    const workMediaRequest = idbRequest(transaction.objectStore('workMedia').getAll());
    const metaRequest = idbRequest(transaction.objectStore('meta').getAll());
    const [sessions, messages, blobs, workMedia, meta] = await Promise.all([sessionsRequest, messagesRequest, blobsRequest, workMediaRequest, metaRequest]);
    await done;
    return { sessions, messages, blobs, workMedia, meta };
  }

  async checkStorageHealth() {
    const snapshot = await this.getStorageSnapshot();
    const requiredStores = ['sessions', 'messages', 'blobs', 'workMedia', 'meta'];
    const missingStores = requiredStores.filter((name) => !this.database.objectStoreNames.contains(name));
    const messageIndexMissing = !missingStores.includes('messages') && !this.database.transaction('messages', 'readonly').objectStore('messages').indexNames.contains('sessionId');
    const sessionIds = new Set(snapshot.sessions.map((record) => record.id));
    const workIds = new Set(state.works.map((work) => work.id));
    const messageOrphans = snapshot.messages.filter((record) => !sessionIds.has(record.sessionId));
    const blobRefs = new Set();
    snapshot.messages.forEach((record) => {
      if (!Array.isArray(record.message?.content)) return;
      record.message.content.forEach((part) => { if (part?.image_url?.ref) blobRefs.add(part.image_url.ref); });
    });
    const blobIds = new Set(snapshot.blobs.map((record) => record.id));
    const missingBlobRefs = [...blobRefs].filter((id) => !blobIds.has(id));
    const blobOrphans = snapshot.blobs.filter((record) => !blobRefs.has(record.id));
    const workMediaOrphans = snapshot.workMedia.filter((record) => !workIds.has(record.workId));
    const workMediaMismatch = snapshot.workMedia.filter((record) => {
      const work = state.works.find((item) => item.id === record.workId);
      if (!work) return false;
      const mimeType = String(record.mimeType || record.blob?.type || '').toLowerCase();
      const declaredKind = mimeType.startsWith('image/') ? 'image' : mimeType.startsWith('video/') ? 'video' : '';
      const typeMismatch = record.kind !== work.kind || (record.status === 'ready' && declaredKind && declaredKind !== work.kind);
      return typeMismatch || safeMediaUrl(work.url) !== safeMediaUrl(record.sourceUrl);
    });
    const messageCounts = new Map();
    snapshot.messages.forEach((record) => messageCounts.set(record.sessionId, (messageCounts.get(record.sessionId) || 0) + 1));
    const sessionCountMismatch = snapshot.sessions.filter((record) => Number(record.messageCount || 0) !== Number(messageCounts.get(record.id) || 0));
    const schemaMeta = snapshot.meta.find((record) => record.key === 'schema-migration');
    const schemaMismatch = !schemaMeta || Number(schemaMeta.databaseVersion) !== CONFIG.storage.databaseVersion || this.database.version !== CONFIG.storage.databaseVersion;
    const issueCount = missingStores.length + Number(messageIndexMissing) + messageOrphans.length + missingBlobRefs.length + blobOrphans.length + workMediaOrphans.length + workMediaMismatch.length + sessionCountMismatch.length + Number(schemaMismatch);
    return { ok: issueCount === 0, issueCount, missingStores, messageIndexMissing, messageOrphans, missingBlobRefs, blobOrphans, workMediaOrphans, workMediaMismatch, sessionCountMismatch, schemaMismatch, snapshot };
  }

  async repairStorage() {
    const health = await this.checkStorageHealth();
    if (health.missingStores.length || health.messageIndexMissing) throw new Error('数据库结构不完整，需要刷新页面触发升级。');
    const transaction = this.database.transaction(['sessions', 'messages', 'blobs', 'workMedia', 'meta'], 'readwrite');
    const sessions = transaction.objectStore('sessions');
    const messages = transaction.objectStore('messages');
    health.messageOrphans.forEach((record) => messages.delete(record.id));
    const missingRefs = new Set(health.missingBlobRefs);
    health.snapshot.messages.forEach((record) => {
      if (health.messageOrphans.some((orphan) => orphan.id === record.id) || !Array.isArray(record.message?.content)) return;
      const content = record.message.content.filter((part) => !part?.image_url?.ref || !missingRefs.has(part.image_url.ref));
      if (content.length !== record.message.content.length) messages.put({ ...record, message: { ...record.message, content } });
    });
    const blobs = transaction.objectStore('blobs');
    health.blobOrphans.forEach((record) => blobs.delete(record.id));
    const workMedia = transaction.objectStore('workMedia');
    health.workMediaOrphans.forEach((record) => workMedia.delete(record.workId));
    health.workMediaMismatch.forEach((record) => workMedia.delete(record.workId));
    const validMessages = health.snapshot.messages.filter((record) => !health.messageOrphans.some((orphan) => orphan.id === record.id));
    const messageCounts = new Map();
    validMessages.forEach((record) => messageCounts.set(record.sessionId, (messageCounts.get(record.sessionId) || 0) + 1));
    health.snapshot.sessions.forEach((record) => sessions.put({ ...record, messageCount: messageCounts.get(record.id) || 0 }));
    transaction.objectStore('meta').put({ key: 'schema-migration', databaseVersion: CONFIG.storage.databaseVersion, previousVersion: CONFIG.storage.databaseVersion, completedAt: Date.now() });
    await idbTransactionDone(transaction);
    const releasedBytes = health.blobOrphans.reduce((total, record) => total + Number(record.size || record.blob?.size || 0), 0)
      + [...health.workMediaOrphans, ...health.workMediaMismatch].reduce((total, record) => total + Number(record.size || record.blob?.size || 0), 0);
    return { removedMessages: health.messageOrphans.length, removedBlobReferences: health.missingBlobRefs.length, removedBlobReferenceIds: health.missingBlobRefs, removedBlobs: health.blobOrphans.length, removedWorkMedia: health.workMediaOrphans.length + health.workMediaMismatch.length, correctedSessions: health.sessionCountMismatch.length, releasedBytes, healthyBefore: health.ok };
  }

  async putBlob(blob, name = '对话图片') {
    const record = { id: createId('blob'), blob, mimeType: blob.type || 'image/*', size: blob.size, createdAt: Date.now(), name };
    const transaction = this.database.transaction('blobs', 'readwrite');
    transaction.objectStore('blobs').put(record);
    await idbTransactionDone(transaction);
    return record;
  }

  async deleteBlob(blobId) {
    if (!blobId) return;
    const transaction = this.database.transaction('blobs', 'readwrite');
    transaction.objectStore('blobs').delete(blobId);
    await idbTransactionDone(transaction);
  }

  async deleteSession(sessionId) {
    const read = this.database.transaction('messages', 'readonly');
    const readDone = idbTransactionDone(read);
    const records = await idbRequest(read.objectStore('messages').index('sessionId').getAll(sessionId));
    await readDone;
    const transaction = this.database.transaction(['sessions', 'messages'], 'readwrite');
    transaction.objectStore('sessions').delete(sessionId);
    const messages = transaction.objectStore('messages');
    records.forEach((record) => messages.delete(record.id));
    await idbTransactionDone(transaction);
  }

  async listStorageRecords(store, { query = '', limit = 200 } = {}) {
    const allowed = ['sessions', 'messages', 'blobs', 'workMedia', 'meta'];
    if (!allowed.includes(store)) throw new Error('不支持的数据类型。');
    const transaction = this.database.transaction(store, 'readonly');
    const records = await idbRequest(transaction.objectStore(store).getAll());
    await idbTransactionDone(transaction);
    const text = String(query || '').trim().toLowerCase();
    return records.filter((record) => !text || JSON.stringify({ ...record, blob: undefined }).toLowerCase().includes(text)).slice(0, limit);
  }

  async getStorageRecord(store, key) {
    const transaction = this.database.transaction(store, 'readonly');
    const record = await idbRequest(transaction.objectStore(store).get(key));
    await idbTransactionDone(transaction);
    return record || null;
  }

  async getStorageRecordDetail(store, key) {
    return this.getStorageRecord(store, key);
  }

  async updateSessionMetadata(id, patch = {}) {
    const record = await this.getStorageRecord('sessions', id);
    if (!record) throw new Error('会话不存在。');
    const next = { ...record, title: String(patch.title ?? record.title).slice(0, 120), messageCount: Number.isFinite(Number(patch.messageCount)) ? Math.max(0, Math.round(Number(patch.messageCount))) : Number(record.messageCount || 0), updatedAt: Date.now() };
    const transaction = this.database.transaction('sessions', 'readwrite');
    transaction.objectStore('sessions').put(next);
    await idbTransactionDone(transaction);
    return next;
  }

  async updateStoredMessage(id, patch = {}) {
    const record = await this.getStorageRecord('messages', id);
    if (!record) throw new Error('消息不存在。');
    const message = { ...record.message, role: ['user', 'assistant', 'system'].includes(patch.role) ? patch.role : record.message.role, content: Array.isArray(patch.content) ? patch.content : record.message.content, reasoning: String(patch.reasoning ?? record.message.reasoning ?? '').slice(0, 20000), createdAt: Number(patch.createdAt || record.message.createdAt || Date.now()) };
    const next = { ...record, message };
    const transaction = this.database.transaction('messages', 'readwrite');
    transaction.objectStore('messages').put(next);
    await idbTransactionDone(transaction);
    return next;
  }

  async appendStoredMessage(sessionId, value) {
    const message = { id: createId('message'), role: ['user', 'assistant', 'system'].includes(value?.role) ? value.role : 'user', content: Array.isArray(value?.content) ? value.content : [{ type: 'text', text: String(value?.text || '') }], createdAt: Date.now() };
    const existing = await this.listStorageRecords('messages');
    const position = existing.filter((record) => record.sessionId === sessionId).length;
    const transaction = this.database.transaction('messages', 'readwrite');
    transaction.objectStore('messages').put({ id: message.id, sessionId, position, message });
    await idbTransactionDone(transaction);
    return message;
  }

  async deleteStoredMessage(id) {
    const transaction = this.database.transaction('messages', 'readwrite');
    transaction.objectStore('messages').delete(id);
    await idbTransactionDone(transaction);
  }

  async deleteStoredSession(id) { return this.deleteSession(id); }
  async deleteStoredBlob(id) { return this.deleteBlob(id); }
  async deleteStoredWorkMedia(id) { return this.deleteCachedWorkMedia(id); }

  async cleanupOrphanBlobs(extraRefs = []) {
    const read = this.database.transaction(['messages', 'blobs'], 'readonly');
    const done = idbTransactionDone(read);
    const messageRequest = idbRequest(read.objectStore('messages').getAll());
    const blobRequest = idbRequest(read.objectStore('blobs').getAll());
    const [messages, blobs] = await Promise.all([messageRequest, blobRequest]);
    await done;
    const used = new Set(extraRefs.filter(Boolean));
    messages.forEach((record) => {
      const content = record.message?.content;
      if (!Array.isArray(content)) return;
      content.forEach((part) => { if (part?.image_url?.ref) used.add(part.image_url.ref); });
    });
    const orphans = blobs.filter((record) => !used.has(record.id));
    if (orphans.length) {
      const transaction = this.database.transaction('blobs', 'readwrite');
      orphans.forEach((record) => transaction.objectStore('blobs').delete(record.id));
      await idbTransactionDone(transaction);
    }
    return { removed: orphans.length, bytes: orphans.reduce((total, record) => total + Number(record.size || record.blob?.size || 0), 0) };
  }

  async stats() {
    const transaction = this.database.transaction(['sessions', 'messages', 'blobs', 'workMedia'], 'readonly');
    const done = idbTransactionDone(transaction);
    const sessionRequest = idbRequest(transaction.objectStore('sessions').count());
    const messageRequest = idbRequest(transaction.objectStore('messages').count());
    const blobRequest = idbRequest(transaction.objectStore('blobs').getAll());
    const workMediaRequest = idbRequest(transaction.objectStore('workMedia').getAll());
    const [sessions, messages, blobs, workMedia] = await Promise.all([sessionRequest, messageRequest, blobRequest, workMediaRequest]);
    await done;
    return { sessions, messages, attachments: blobs.length, attachmentBytes: blobs.reduce((total, record) => total + Number(record.size || record.blob?.size || 0), 0), workMedia: workMedia.length, workMediaBytes: workMedia.reduce((total, record) => total + Number(record.size || record.blob?.size || 0), 0), failedWorkMedia: workMedia.filter((record) => record.status === 'failed').length };
  }
}

function reportStorageFailure(message = '对话历史暂时无法保存到 IndexedDB。') {
  if (storageWarningShown) return;
  storageWarningShown = true;
  showToast(message, 'error');
}

function runtimeBlobRefs() {
  const refs = new Set();
  state.chatSessions.forEach((session) => session.messages.forEach((message) => {
    if (!Array.isArray(message.content)) return;
    message.content.forEach((part) => { if (part?.image_url?.ref) refs.add(part.image_url.ref); });
  }));
  if (chatImage?.blobRef) refs.add(chatImage.blobRef);
  return [...refs];
}

async function persistChatSession(session, { immediate = false } = {}) {
  session.messageCount = session.messages.length;
  if (!immediate) saveState();
  if (!storageReady || !storageRepository) {
    if (immediate) saveState({ immediate: true });
    return false;
  }
  const write = () => {
    sessionSaveTimers.delete(session.id);
    const snapshot = { ...session, messages: session.messages.map((message) => ({ ...message })) };
    const previous = sessionWriteQueues.get(session.id) || Promise.resolve();
    const queued = previous.catch(() => {}).then(async () => {
      try {
        await storageRepository.replaceSession(snapshot);
      } catch (firstError) {
        await storageRepository.cleanupOrphanBlobs(runtimeBlobRefs());
        await storageRepository.replaceSession(snapshot);
      }
      await storageRepository.cleanupOrphanBlobs(runtimeBlobRefs());
      if (state.activeMode === 'works') updateStorageStats();
      return true;
    }).catch(() => {
      reportStorageFailure();
      return false;
    });
    sessionWriteQueues.set(session.id, queued);
    queued.finally(() => { if (sessionWriteQueues.get(session.id) === queued) sessionWriteQueues.delete(session.id); });
    return queued;
  };
  if (immediate) {
    window.clearTimeout(sessionSaveTimers.get(session.id));
    sessionSaveTimers.delete(session.id);
    const result = await write();
    saveState({ immediate: true });
    return result;
  }
  window.clearTimeout(sessionSaveTimers.get(session.id));
  sessionSaveTimers.set(session.id, window.setTimeout(write, getSessionSaveDelay()));
  return true;
}

async function initializeStorage() {
  storageMigrationLocked = loadedStateHadMessages;
  storageEngineState = loadedStateHadMessages ? 'migrating' : 'checking';
  try {
    storageRepository = await StorageRepository.open();
    if (loadedStateHadMessages) {
      const migration = await storageRepository.getMeta('legacy-migration');
      if (!migration || migration.storageVersion !== LIGHTWEIGHT_STATE_VERSION) await storageRepository.migrateLegacy(state.chatSessions);
      state.chatSessions = await storageRepository.loadSessions(state.chatSessions.map(chatSessionMetadata));
      storageMigrationLocked = false;
      storageReady = true;
      storageEngineState = 'ready';
      writeLightweightState();
      startupNotices.push('旧版对话历史已迁移到 IndexedDB。');
    } else {
      state.chatSessions = await storageRepository.loadSessions(state.chatSessions);
      storageReady = true;
      storageEngineState = 'ready';
    }
    await storageRepository.cleanupOrphanBlobs();
    await hydrateWorkMediaRuntime();
  } catch (error) {
    storageMigrationLocked = loadedStateHadMessages;
    storageReady = false;
    storageEngineState = 'unavailable';
    startupNotices.push(loadedStateHadMessages
      ? 'IndexedDB 迁移失败，旧版 localStorage 数据已原样保留。'
      : 'IndexedDB 当前不可用，对话历史和本地图片无法持久保存。');
  }
}

async function hydrateWorkMediaRuntime() {
  if (!storageReady || !storageRepository) return;
  for (const objectUrl of workMediaObjectUrls.values()) URL.revokeObjectURL(objectUrl);
  workMediaObjectUrls.clear();
  workMediaRuntime.clear();
  for (const work of state.works) {
    try {
      const record = await storageRepository.getCachedWorkMedia(work.id);
      if (record?.status === 'ready' && record.blob) {
        const previous = workMediaObjectUrls.get(work.id);
        if (previous) URL.revokeObjectURL(previous);
        const objectUrl = URL.createObjectURL(record.blob);
        workMediaObjectUrls.set(work.id, objectUrl);
        workMediaRuntime.set(work.id, { status: 'ready', url: objectUrl, record });
      } else if (record?.status === 'failed') workMediaRuntime.set(work.id, { status: 'cache-failed', error: record.error || '缓存失败', record });
    } catch (error) {
      workMediaRuntime.set(work.id, { status: 'cache-failed', error: '无法读取本地缓存' });
    }
  }
}

async function cacheWorkMedia(work, { silent = false, force = false } = {}) {
  if (force) workCacheSuppressed.delete(work?.id);
  if (workCacheSuppressed.has(work?.id) && !force) return null;
  if (!storageReady || !storageRepository || (!force && !state.ui.storage.cacheImages && work.kind === 'image')) return null;
  cancelWorkCacheJob(work.id);
  const controller = new AbortController();
  workCacheJobs.set(work.id, controller);
  workMediaRuntime.set(work.id, { status: 'loading', progress: 0 });
  renderWorks();
  try {
    const record = await storageRepository.cacheWorkMedia(work, {
      signal: controller.signal,
      onProgress: (progress) => {
        workMediaRuntime.set(work.id, { status: 'loading', progress });
        const label = document.querySelector(`[data-work-cache-progress="${CSS.escape(work.id)}"]`);
        if (label) label.textContent = progress ? `缓存中 ${progress}%` : '缓存中';
      }
    });
    const previous = workMediaObjectUrls.get(work.id);
    if (previous) URL.revokeObjectURL(previous);
    const objectUrl = URL.createObjectURL(record.blob);
    workMediaObjectUrls.set(work.id, objectUrl);
    workMediaRuntime.set(work.id, { status: 'ready', url: objectUrl, record });
    renderWorks();
    if (!silent) showToast('作品媒体已缓存到本地。');
    if (workCacheJobs.get(work.id) === controller) workCacheJobs.delete(work.id);
    return record;
  } catch (error) {
    if (workCacheJobs.get(work.id) === controller) workCacheJobs.delete(work.id);
    if (error.name !== 'AbortError') {
      const message = workCacheErrorMessage(error);
      await storageRepository.markWorkMediaFailed(work, new Error(message)).catch(() => {});
      workMediaRuntime.set(work.id, { status: 'cache-failed', error: message });
      renderWorks();
      if (!silent) showToast(`媒体缓存失败：${message}`, 'error');
    }
    return null;
  }
}

function cancelWorkCacheJob(workId) {
  const controller = workCacheJobs.get(workId);
  if (controller) controller.abort();
  workCacheJobs.delete(workId);
}

function cancelAllWorkCacheJobs() {
  workCacheJobs.forEach((controller) => controller.abort());
  workCacheJobs.clear();
}

function suppressWorkCache(workId) {
  if (workId) workCacheSuppressed.add(workId);
}

function startWorkCacheJob(work, options = {}) {
  if (options.force) workCacheSuppressed.delete(work?.id);
  return cacheWorkMedia(work, options);
}

function workCacheErrorMessage(error) {
  const message = String(error?.message || '');
  if (/failed to fetch|networkerror|network request failed/i.test(message)) return '浏览器无法跨域下载该媒体，远程地址仍可直接使用。';
  if (/\（403\）|\(403\)/.test(message)) return '远程媒体拒绝访问（403），可能已过期或需要授权。';
  if (/\（404\）|\(404\)/.test(message)) return '远程媒体不存在（404），地址可能已失效。';
  return message || '浏览器无法下载远程媒体。';
}

async function cacheExistingWorkImages() {
  if (!storageReady || !state.ui.storage.cacheImages) return;
  if (workBackfillPromise) return workBackfillPromise;
  workBackfillPromise = (async () => {
    const candidates = state.works.filter((work) => {
      const status = workMediaRuntime.get(work.id)?.status;
      return work.kind === 'image' && !['ready', 'loading'].includes(status) && !workCacheSuppressed.has(work.id);
    });
    let cursor = 0;
    const worker = async () => {
      while (cursor < candidates.length) {
        const work = candidates[cursor++];
        await cacheWorkMedia(work, { silent: true });
      }
    };
    await Promise.all([worker(), worker()]);
  })().finally(() => { workBackfillPromise = null; });
  return workBackfillPromise;
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

function updateKeyStatus(connected = false, authError = false) {
  if (connected) {
    connectionStatus = 'connected';
    const now = Date.now();
    if (now - Number(state.connection.lastVerifiedAt || 0) > 30000) {
      state.connection.lastVerifiedAt = now;
      saveState();
    }
  }
  else if (authError) connectionStatus = 'error';
  else if (!apiKey) connectionStatus = 'idle';
  const text = $('#api-status-text');
  const endpoint = $('#api-status-endpoint');
  const dot = $('#api-status-dot');
  const status = $('#api-status');
  if (!text || !dot || !status) return;
  const stateLabel = !apiKey ? '未配置' : connectionStatus === 'connected' ? '已连接' : connectionStatus === 'error' ? '认证失败' : '待验证';
  if (endpoint) endpoint.textContent = activeConnectionLabel();
  text.textContent = stateLabel;
  status.classList.toggle('is-connected', Boolean(apiKey && connectionStatus === 'connected'));
  status.classList.toggle('is-error', Boolean(apiKey && connectionStatus === 'error'));
  dot.classList.toggle('is-live', Boolean(apiKey && connectionStatus === 'connected'));
  status.setAttribute('aria-label', `打开连接设置，当前为${activeConnectionLabel()}，${stateLabel}`);
  const settingsStatus = $('#settings-connection-status');
  if (settingsStatus) {
    const verified = state.connection.lastVerifiedAt ? `，最近验证 ${formatFullDate(state.connection.lastVerifiedAt)}` : '';
    settingsStatus.textContent = `当前状态：${stateLabel}${verified}`;
  }
}

function syncConnectionModal() {
  const endpoint = connectionDraft.endpoint;
  $('#connection-endpoints')?.querySelectorAll('[data-connection-endpoint]').forEach((button) => {
    const active = button.dataset.connectionEndpoint === endpoint;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  const field = $('#custom-base-url-field');
  if (field) field.hidden = endpoint !== 'custom';
  const input = $('#custom-base-url-input');
  if (input) input.value = connectionDraft.customBaseUrl || '';
}

function selectConnectionEndpoint(endpoint) {
  if (!['international', 'china', 'custom'].includes(endpoint)) return;
  connectionDraft.endpoint = endpoint;
  syncConnectionModal();
}

function selectSettingsSection(section = 'general') {
  const next = ['general', 'storage', 'connection'].includes(section) ? section : 'general';
  $$('[data-settings-section]').forEach((button) => {
    const active = button.dataset.settingsSection === next;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  $$('[data-settings-panel]').forEach((panel) => panel.classList.toggle('is-hidden', panel.dataset.settingsPanel !== next));
  if (next === 'storage') updateStorageStats();
}

function setGeneralSettingsControls() {
  const general = state.ui.general || {};
  const storage = state.ui.storage || {};
  $('#settings-theme').value = general.theme || 'dark';
  $('#settings-density').value = general.density || 'comfortable';
  $('#settings-reduced-motion').checked = Boolean(general.reducedMotion);
  $('#settings-auto-fullscreen').checked = Boolean(state.ui.chat.autoFullscreen);
  $('#settings-autosave').value = general.autoSaveProfile || 'standard';
  $('#settings-cache-images').checked = storage.cacheImages !== false;
  $('#settings-session-retention').value = String(normalizeRetention(storage.sessionRetention, 'sessions'));
  $('#settings-work-retention').value = String(normalizeRetention(storage.workRetention, 'works'));
  applyGeneralSettings();
}

function applyGeneralSettings() {
  const general = state.ui.general || {};
  const theme = ['dark', 'light', 'system'].includes(general.theme) ? general.theme : 'dark';
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme === 'system' ? 'light dark' : theme;
  document.documentElement.dataset.density = general.density === 'compact' ? 'compact' : 'comfortable';
  document.documentElement.classList.toggle('reduce-motion', Boolean(general.reducedMotion));
}

function updateGeneralSetting(key, value) {
  state.ui.general[key] = value;
  applyGeneralSettings();
  saveState();
}

function updateStorageSetting(key, value) {
  const normalized = key === 'sessionRetention' ? normalizeRetention(value, 'sessions') : key === 'workRetention' ? normalizeRetention(value, 'works') : value;
  saveStoragePolicy({ [key]: normalized });
  if (key === 'cacheImages' && value) cacheExistingWorkImages();
}

function resetGeneralSettings() {
  showConfirmModal({
    title: '恢复默认界面设置',
    message: '主题、密度、动效和自动保存频率将恢复默认值。作品和对话不会被删除。',
    confirmText: '恢复默认',
    onConfirm: () => {
      state.ui.general = { theme: 'system', density: 'comfortable', reducedMotion: false, autoSaveProfile: 'standard' };
      setGeneralSettingsControls();
      saveState({ immediate: true });
      showToast('通用设置已恢复默认。');
    }
  });
}

function openSettingsModal(section = 'general') {
  const modal = $('#settings-modal');
  const input = $('#api-key-input');
  settingsReturnFocus = document.activeElement;
  modal.hidden = false;
  syncOverlayState();
  input.value = apiKey;
  connectionDraft = { endpoint: state.connection.endpoint, customBaseUrl: state.connection.customBaseUrl || '' };
  syncConnectionModal();
  setGeneralSettingsControls();
  selectSettingsSection(section);
  if (settingsKeyHandler) document.removeEventListener('keydown', settingsKeyHandler, true);
  settingsKeyHandler = (event) => {
    if (event.key === 'Escape' && !$('#confirm-modal')) {
      event.preventDefault();
      event.stopPropagation();
      closeSettingsModal();
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const tab = event.target.closest('[data-settings-section]');
      if (!tab) return;
      const tabs = $$('[data-settings-section]');
      const nextIndex = (tabs.indexOf(tab) + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      event.preventDefault();
      selectSettingsSection(tabs[nextIndex].dataset.settingsSection);
      tabs[nextIndex].focus();
    }
  };
  document.addEventListener('keydown', settingsKeyHandler, true);
  window.setTimeout(() => (section === 'connection' ? input : modal.querySelector('[data-settings-section]'))?.focus(), 30);
}

function closeSettingsModal() {
  $('#settings-modal').hidden = true;
  if (settingsKeyHandler) document.removeEventListener('keydown', settingsKeyHandler, true);
  settingsKeyHandler = null;
  syncOverlayState();
  const target = settingsReturnFocus;
  settingsReturnFocus = null;
  if (target?.isConnected) window.requestAnimationFrame(() => target.focus());
}

function openKeyModal() { openSettingsModal('connection'); }
function closeKeyModal() { closeSettingsModal(); }

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
  const baseUrl = activeBaseUrl();
  try {
    const response = await fetch(`${baseUrl}${path}`, { ...init, signal, headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
    if (!response.ok) {
      const raw = await response.text();
      let payload = null;
      try { payload = raw ? JSON.parse(raw) : null; } catch (error) { payload = raw; }
      throw new AgnesApiError(getApiErrorMessage(response.status, payload), response.status, payload, parseRetryAfter(response.headers.get('Retry-After')));
    }
    if (baseUrl === activeBaseUrl()) updateKeyStatus(true);
    return response;
  } catch (error) {
    if (error instanceof AgnesApiError && [401, 403].includes(error.status)) updateKeyStatus(false, true);
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
    : Array.isArray(message.content)
      ? message.content.map((part) => part?.type === 'image_url'
        ? { type: 'image_url', image_url: { url: part.image_url?.url || '' } }
        : part)
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

async function init() {
  applyGeneralSettings();
  await initializeStorage();
  loadPromptExamples();
  ensureChatSession();
  bindEvents();
  syncUiControls();
  setMode(state.activeMode || 'chat');
  renderChat();
  renderImageResult();
  renderVideoJob();
  renderVideoRefs();
  renderWorks();
  setGeneralSettingsControls();
  updateKeyStatus(false);
  applyLayoutState();
  refreshIcons();
  updateStorageStats();
  startupNotices.forEach((message) => showToast(message, message.includes('失败') || message.includes('不可用') ? 'error' : 'info'));
}

function bindEvents() {
  $$('.nav-item').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
  $('#settings-button').addEventListener('click', () => openSettingsModal('general'));
  $('#api-status').addEventListener('click', () => openSettingsModal('connection'));
  $$('[data-connection-endpoint]').forEach((button) => button.addEventListener('click', () => selectConnectionEndpoint(button.dataset.connectionEndpoint)));
  $('#custom-base-url-input').addEventListener('input', (event) => { connectionDraft.customBaseUrl = event.target.value; });
  $('#close-key-settings').addEventListener('click', closeSettingsModal);
  $('#settings-modal').addEventListener('click', (event) => { if (event.target === $('#settings-modal')) closeSettingsModal(); });
  $('#save-api-key').addEventListener('click', saveApiKey);
  $('#clear-api-key').addEventListener('click', () => showConfirmModal({
    title: '清除本地 API 密钥',
    message: '当前浏览器中保存的 API 密钥将被移除，之后所有模式都需要重新配置密钥。',
    confirmText: '确认清除',
    onConfirm: clearApiKey
  }));
  $('#toggle-key-visibility').addEventListener('click', toggleKeyVisibility);
  $$('[data-settings-section]').forEach((button) => button.addEventListener('click', () => selectSettingsSection(button.dataset.settingsSection)));
  $('#settings-theme').addEventListener('change', (event) => updateGeneralSetting('theme', event.target.value));
  $('#settings-density').addEventListener('change', (event) => updateGeneralSetting('density', event.target.value));
  $('#settings-reduced-motion').addEventListener('change', (event) => updateGeneralSetting('reducedMotion', event.target.checked));
  $('#settings-auto-fullscreen').addEventListener('change', (event) => {
    state.ui.chat.autoFullscreen = event.target.checked;
    $('#chat-auto-fullscreen').checked = event.target.checked;
    saveState();
  });
  $('#settings-autosave').addEventListener('change', (event) => updateGeneralSetting('autoSaveProfile', event.target.value));
  $('#settings-cache-images').addEventListener('change', (event) => updateStorageSetting('cacheImages', event.target.checked));
  $('#settings-session-retention').addEventListener('change', (event) => {
    updateStorageSetting('sessionRetention', event.target.value);
    event.target.value = String(state.ui.storage.sessionRetention);
  });
  $('#settings-work-retention').addEventListener('change', (event) => {
    updateStorageSetting('workRetention', event.target.value);
    event.target.value = String(state.ui.storage.workRetention);
  });
  $('#reset-general-settings').addEventListener('click', resetGeneralSettings);
  $('#request-persistent-storage').addEventListener('click', requestPersistentStorage);
  $('#check-storage-health').addEventListener('click', checkStorageHealthUi);
  $('#repair-storage').addEventListener('click', repairStorageUi);
  $('#clear-cached-media').addEventListener('click', clearCachedMediaUi);
  $('#storage-data-manager').addEventListener('click', openStorageDataManager);
  $('#test-api-connection').addEventListener('click', testApiConnection);

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
  $('#chat-image-file-input').addEventListener('change', handleChatImageFile);
  $('#chat-image-preview').addEventListener('click', handleChatImagePreviewAction);
  bindDragDrop($('#chat-image-drop-zone'), (files) => addChatImageFiles(files));
  $('#chat-pick-work').addEventListener('click', openChatWorkPicker);
  $('#chat-pick-link').addEventListener('click', openChatUrlModal);
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
  $('#image-reference-grid').addEventListener('click', handleReferenceAction);
  $('#image-reference-grid').addEventListener('keydown', handleMediaReferencePreviewKeydown);
  $('#image-reference-grid').addEventListener('pointerdown', startReferenceDrag);
  $('#image-prompt-structure').addEventListener('click', handleImageStructureAction);
  $('#image-prompt-showcase').addEventListener('click', handlePromptShowcaseAction);
  $('#workspace-button').addEventListener('click', openWorkspaceMenu);
  $('#help-button').addEventListener('click', openHelpCenter);
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
      max: room + selectedWorkUrls.length,
      selected: selectedWorkUrls,
      onConfirm: (items) => {
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
    if (promptAssistStates.image.request) { handlePromptAssistCancel('image', 'random'); return; }
    requestPromptAssist('image', 'random');
  });
  $('#image-optimize-prompt').addEventListener('click', () => {
    if (promptAssistStates.image.request) { handlePromptAssistCancel('image', 'optimize'); return; }
    requestPromptAssist('image', 'optimize');
  });

  $$('.segment-button[data-video-mode]').forEach((button) => button.addEventListener('click', () => setVideoMode(button.dataset.videoMode)));
  $$('[data-video-style]').forEach((button) => button.addEventListener('click', () => setVideoStylePreset(button.dataset.videoStyle)));
  $('#video-keywords').addEventListener('input', (event) => { state.ui.video.keywordDirection = event.target.value; saveState(); });
  $('#video-random-prompt').addEventListener('click', () => {
    if (promptAssistStates.video.request) { handlePromptAssistCancel('video', 'random'); return; }
    requestPromptAssist('video', 'random');
  });
  $('#video-optimize-prompt').addEventListener('click', () => {
    if (promptAssistStates.video.request) { handlePromptAssistCancel('video', 'optimize'); return; }
    requestPromptAssist('video', 'optimize');
  });
  $('#video-generate').addEventListener('click', handleVideoGenerate);
  $('#video-stop').addEventListener('click', stopVideoPolling);
  $('#video-refresh').addEventListener('click', refreshVideoStatus);
  $('#video-image-inputs').addEventListener('click', (event) => handleVideoRefAction('image', event));
  $('#video-image-inputs').addEventListener('keydown', handleMediaReferencePreviewKeydown);
  $('#video-keyframe-inputs').addEventListener('click', (event) => handleVideoRefAction('keyframes', event));
  $('#video-keyframe-inputs').addEventListener('keydown', handleMediaReferencePreviewKeydown);
  $('#video-keyframe-inputs').addEventListener('pointerdown', startKeyframeDrag);
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
    const inspector = $('#inspector-panel');
    if (event.key === 'Tab' && inspector.classList.contains('is-mobile-open')) {
      trapFocus(event, inspector);
      return;
    }
    if (event.key === 'Escape' && inspector.classList.contains('is-mobile-open')) {
      event.preventDefault();
      closeMobileInspector({ restoreFocus: true });
      return;
    }
    if (event.key === 'Tab') {
      const overlays = Array.from(document.querySelectorAll('.modal-backdrop:not([hidden]), .preview-backdrop'));
      trapFocus(event, overlays[overlays.length - 1]);
      return;
    }
    if (event.key !== 'Escape') return;
    if (document.querySelector('.modal-backdrop:not([hidden]), .preview-backdrop')) return;
    const activeMode = ['chat', 'image', 'video'].find((mode) => isModeFullscreen(mode));
    if (activeMode) toggleModeFullscreen(activeMode);
  });

  $$('.filter-tab').forEach((button) => button.addEventListener('click', () => { activeWorkFilter = button.dataset.workFilter; renderWorks(); }));
  $('#export-works').addEventListener('click', downloadWorksBackup);
  $('#import-works').addEventListener('click', () => $('#works-import-input').click());
  $('#works-import-input').addEventListener('change', openWorksImport);
  $('#clear-works').addEventListener('click', () => showConfirmModal({
    title: '清除作品记录',
    message: '作品库中的所有记录（仅保存的 URL 与元数据）将被移除，且无法撤销。',
    confirmText: '确认清除',
    onConfirm: clearWorks
  }));
  $('#cleanup-storage').addEventListener('click', requestStorageAttachmentCleanup);
  $('#compact-history').addEventListener('click', requestHistoryCompaction);
  $('#refresh-storage-stats').addEventListener('click', () => updateStorageStats({ announce: true }));
  $('#works-grid').addEventListener('click', handleWorkAction);
  $('#sidebar-collapse-toggle').addEventListener('click', toggleSidebarCollapse);
  $('#inspector-open-toggle').addEventListener('click', toggleInspectorCollapse);
  $('#inspector-collapse-toggle').addEventListener('click', toggleInspectorCollapse);
  $('#mobile-inspector-toggle').addEventListener('click', toggleMobileInspector);
  $('#mobile-inspector-close').addEventListener('click', () => closeMobileInspector({ restoreFocus: true }));
  $('#mobile-inspector-backdrop').addEventListener('click', () => closeMobileInspector({ restoreFocus: true }));
  const inspectorMedia = window.matchMedia('(max-width: 1160px)');
  if (inspectorMedia.addEventListener) inspectorMedia.addEventListener('change', syncMobileInspectorLayout);
  else inspectorMedia.addListener?.(syncMobileInspectorLayout);
  window.addEventListener('pagehide', writeLightweightState);
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
  $('#video-keywords').value = state.ui.video.keywordDirection || '';
  setImageStylePreset(state.ui.image.stylePreset, false);
  setVideoStylePreset(state.ui.video.stylePreset, false);
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

function isMobileInspectorLayout() {
  return window.matchMedia('(max-width: 1160px)').matches;
}

function openMobileInspector() {
  if (!isMobileInspectorLayout()) return;
  const panel = $('#inspector-panel');
  const backdrop = $('#mobile-inspector-backdrop');
  const toggle = $('#mobile-inspector-toggle');
  panel.classList.add('is-mobile-open');
  panel.setAttribute('aria-hidden', 'false');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  backdrop.hidden = false;
  toggle.setAttribute('aria-expanded', 'true');
  syncOverlayState();
  window.requestAnimationFrame(() => $('#mobile-inspector-close')?.focus());
}

function closeMobileInspector({ restoreFocus = false } = {}) {
  const panel = $('#inspector-panel');
  const backdrop = $('#mobile-inspector-backdrop');
  const toggle = $('#mobile-inspector-toggle');
  const wasOpen = panel.classList.contains('is-mobile-open');
  panel.classList.remove('is-mobile-open');
  panel.setAttribute('aria-hidden', isMobileInspectorLayout() ? 'true' : 'false');
  panel.removeAttribute('role');
  panel.removeAttribute('aria-modal');
  backdrop.hidden = true;
  toggle.setAttribute('aria-expanded', 'false');
  syncOverlayState();
  if (restoreFocus && wasOpen) toggle.focus();
}

function toggleMobileInspector() {
  if ($('#inspector-panel').classList.contains('is-mobile-open')) closeMobileInspector({ restoreFocus: true });
  else openMobileInspector();
}

function syncMobileInspectorLayout() {
  if (!isMobileInspectorLayout()) closeMobileInspector();
  else if (!$('#inspector-panel').classList.contains('is-mobile-open')) $('#inspector-panel').setAttribute('aria-hidden', 'true');
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
  if (enter) closeMobileInspector();
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
  if (nextMode === 'works') {
    renderWorks();
    updateStorageStats();
    if (!workBackfillStarted) {
      workBackfillStarted = true;
      cacheExistingWorkImages().catch(() => {});
    }
  }
  closeMobileInspector();
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
  if (!value && apiKey) { showToast('如需移除现有密钥，请使用“清除本地密钥”。', 'error'); return; }
  let customBaseUrl = connectionDraft.customBaseUrl || '';
  if (connectionDraft.endpoint === 'custom') {
    try {
      customBaseUrl = normalizeCustomBaseUrl($('#custom-base-url-input').value);
    } catch (error) {
      showToast(error.message, 'error');
      $('#custom-base-url-input').focus();
      return;
    }
  }
  state.connection = { endpoint: connectionDraft.endpoint, customBaseUrl, lastVerifiedAt: 0 };
  if (value !== apiKey) {
    apiKey = value;
    writeStoredKey(apiKey);
  }
  connectionStatus = 'idle';
  updateKeyStatus(false);
  closeKeyModal();
  saveState({ immediate: true });
  showToast('连接设置已保存。');
}

function clearApiKey() {
  apiKey = '';
  writeStoredKey('');
  connectionStatus = 'idle';
  state.connection.lastVerifiedAt = 0;
  updateKeyStatus(false);
  $('#api-key-input').value = '';
  saveState({ immediate: true });
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
  const session = { id: createId('chat'), title: '新会话', createdAt: Date.now(), updatedAt: Date.now(), messages: [], _messagesLoaded: true };
  state.chatSessions.unshift(session);
  state.activeChatId = session.id;
  editingMessageId = null;
  persistChatSession(session, { immediate: true });
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
  persistChatSession(session, { immediate: true });
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
  closeMobileInspector();
  saveState();
  applyLayoutState();
}

function contentImageUrl(content) {
  if (!Array.isArray(content)) return '';
  return content.find((part) => part?.type === 'image_url')?.image_url?.url || '';
}

function renderChatImagePreview() {
  const preview = $('#chat-image-preview');
  if (!chatImage) {
    preview.hidden = true;
    preview.innerHTML = '';
    return;
  }
  const src = chatImage.dataUrl || chatImage.url;
  const sourceLabel = chatImage.source === 'work' ? '作品集图片' : chatImage.source === 'link' ? 'HTTPS 图片链接' : '本地图片';
  preview.hidden = false;
  preview.innerHTML = `<div class="chat-image-preview"><button class="chat-image-preview-media" type="button" data-chat-image-action="preview" aria-label="预览 ${escapeHtml(chatImage.name)}" data-tooltip="预览"><img src="${escapeHtml(src)}" alt="${escapeHtml(chatImage.name)}"></button><div class="chat-image-preview-copy"><strong title="${escapeHtml(chatImage.name)}">${escapeHtml(chatImage.name)}</strong><small>${sourceLabel}已准备</small></div><button class="media-ref-remove" type="button" data-chat-image-action="remove" aria-label="移除 ${escapeHtml(chatImage.name)}" data-tooltip="移除图片"><i data-lucide="trash-2" aria-hidden="true"></i></button></div>`;
  refreshIcons();
}

async function addChatImageFiles(fileList) {
  const file = Array.from(fileList || [])[0];
  if (!file) return;
  if (!isImageFile(file)) { showToast('请选择图片文件或 SVG 文件。', 'error'); return; }
  try {
    const dataUrl = await fileToDataUrl(file);
    let blobRecord = null;
    if (storageReady && storageRepository) {
      try {
        const storageBlob = isSvgFile(file) && file.type !== 'image/svg+xml' ? await dataUrlToBlob(dataUrl) : file;
        blobRecord = await storageRepository.putBlob(storageBlob, file.name);
      } catch (firstError) {
        try {
          await storageRepository.cleanupOrphanBlobs(runtimeBlobRefs());
          const storageBlob = isSvgFile(file) && file.type !== 'image/svg+xml' ? await dataUrlToBlob(dataUrl) : file;
          blobRecord = await storageRepository.putBlob(storageBlob, file.name);
        } catch (retryError) {
          blobRecord = null;
        }
      }
    }
    if (!blobRecord) {
      const keepInMemory = window.confirm('IndexedDB 当前无法保存这张图片。\n\n选择“确定”：仅在当前页面临时使用，刷新后会丢失。\n选择“取消”：不添加这张图片。');
      if (!keepInMemory) return;
      showToast('图片仅保留在当前页面，刷新后会丢失。', 'error');
    }
    if (chatImage?.blobRef && chatImage.blobRef !== blobRecord?.id) storageRepository?.deleteBlob(chatImage.blobRef).catch(() => {});
    chatImage = { name: file.name, dataUrl, blobRef: blobRecord?.id || '', mimeType: isSvgFile(file) ? 'image/svg+xml' : (file.type || 'image/*'), source: 'upload', volatile: !blobRecord };
    renderChatImagePreview();
    showToast('本地图片已添加。');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleChatImageFile(event) {
  const files = Array.from(event.target.files || []);
  event.target.value = '';
  await addChatImageFiles(files);
}

function handleChatImagePreviewAction(event) {
  const action = event.target.closest('[data-chat-image-action]')?.dataset.chatImageAction;
  if (!action || !chatImage) return;
  if (action === 'preview') {
    openMediaPreview({
      items: [{ url: chatImage.dataUrl || chatImage.url, title: chatImage.name || '对话参考图', meta: chatImage.source === 'work' ? '作品集' : '', kind: 'image' }],
      index: 0,
      returnFocus: event.target.closest('[data-chat-image-action="preview"]')
    });
    return;
  }
  if (action === 'remove') {
    if (chatImage.blobRef) storageRepository?.deleteBlob(chatImage.blobRef).catch(() => {});
    chatImage = null;
    renderChatImagePreview();
  }
}

function clearChatImageInput() {
  if (chatImage?.blobRef) storageRepository?.deleteBlob(chatImage.blobRef).catch(() => {});
  chatImage = null;
  $('#chat-image-file-input').value = '';
  renderChatImagePreview();
  $('#chat-vision-panel').hidden = true;
}

function resetChatImageInput({ preserveBlob = false } = {}) {
  if (!preserveBlob && chatImage?.blobRef) storageRepository?.deleteBlob(chatImage.blobRef).catch(() => {});
  chatImage = null;
  $('#chat-image-file-input').value = '';
  renderChatImagePreview();
}

function openChatWorkPicker() {
  const workUrls = new Set(state.works.filter((work) => work.kind === 'image').map((work) => safeMediaUrl(work.url)).filter(Boolean));
  const currentUrl = safeMediaUrl(chatImage?.url || '');
  openWorkPicker({
    max: 1,
    selected: currentUrl && workUrls.has(currentUrl) ? [currentUrl] : [],
    onConfirm: (items) => {
      const item = items[0];
      if (!item) return;
      if (chatImage?.blobRef) storageRepository?.deleteBlob(chatImage.blobRef).catch(() => {});
      chatImage = { name: item.title || '作品图片', url: item.url, source: 'work' };
      renderChatImagePreview();
    }
  });
}

function openChatUrlModal() {
  openReferenceUrlModal({
    onConfirm: (url) => {
      if (chatImage?.blobRef) storageRepository?.deleteBlob(chatImage.blobRef).catch(() => {});
      chatImage = { name: shortText(url, 30), url, source: 'link' };
      renderChatImagePreview();
    }
  });
}

function isAcceptedImageSource(value) {
  return isImageDataUrl(value) || isHttpsUrl(value);
}

function imageLabelForMessage(message, imageUrl) {
  if (message.imageName) return message.imageName;
  if (isImageDataUrl(imageUrl)) return '本地图片';
  try {
    const pathName = new URL(imageUrl).pathname.split('/').filter(Boolean).pop();
    return pathName ? shortText(decodeURIComponent(pathName), 54) : '对话图片';
  } catch (error) {
    return '对话图片';
  }
}

function chatMessageImageMarkup(message, imageUrl) {
  if (!imageUrl) return '';
  const label = imageLabelForMessage(message, imageUrl);
  return `<button class="message-image-preview" type="button" data-message-action="preview-image" data-message-id="${escapeHtml(message.id)}" aria-label="放大预览 ${escapeHtml(label)}"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(label)}" loading="lazy" decoding="async"><span class="message-image-error" hidden><i data-lucide="image-off" aria-hidden="true"></i><span>图片无法显示</span></span></button>`;
}

function prepareChatMessageImages(container) {
  $$('.message-image-preview img', container).forEach((image) => {
    const showError = () => {
      const preview = image.closest('.message-image-preview');
      if (!preview) return;
      preview.classList.add('is-error');
      image.hidden = true;
      const error = $('.message-image-error', preview);
      if (error) error.hidden = false;
    };
    image.addEventListener('error', showError, { once: true });
    if (image.complete && !image.naturalWidth) showError();
  });
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
    const image = chatMessageImageMarkup(message, imageUrl);
    const isEditing = user && editingMessageId === message.id;
    const actions = !isEditing && user
      ? `<div class="message-tools"><button type="button" data-message-action="edit" data-message-id="${message.id}"><i data-lucide="pencil" aria-hidden="true"></i>编辑</button></div>`
      : !user && !isStreaming
        ? assistantMessageToolsMarkup(message.id)
        : '';
    const editableImage = imageUrl && !isImageDataUrl(imageUrl);
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
  prepareChatMessageImages(container);
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
  const imageUrl = chatImage?.dataUrl || chatImage?.url || '';
  const imageName = chatImage?.name || '';
  const imageBlobRef = chatImage?.blobRef || '';
  const imageMimeType = chatImage?.mimeType || '';
  if (!text) { showToast('请输入文本提示词。', 'error'); input.focus(); return; }
  if (imageUrl && !isAcceptedImageSource(imageUrl)) { showToast('请使用本地图片，或填写公开可访问的 HTTPS 图片地址。', 'error'); return; }
  if (state.ui.chat.autoFullscreen && !isChatFullscreen()) toggleChatFullscreen();
  const session = getActiveSession();
  const content = buildChatContent(text, imageUrl);
  if (imageBlobRef && content[1]?.image_url) {
    content[1].image_url.ref = imageBlobRef;
    content[1].image_url.mimeType = imageMimeType;
  }
  session.messages.push({ id: createId('message'), role: 'user', content, imageName, createdAt: Date.now() });
  if (session.title === '新会话') session.title = shortText(text, 28);
  session.updatedAt = Date.now();
  input.value = '';
  resetChatImageInput({ preserveBlob: Boolean(imageBlobRef) });
  $('#chat-vision-panel').hidden = true;
  focusChatWorkspace();
  await persistChatSession(session, { immediate: true });
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
    showToast('文本响应已完成。');
  } catch (error) {
    typewriter.flushAll();
    assistant.streaming = false;
    if (error.name === 'AbortError') assistant.content = assistant.content || '生成已停止。';
    else { assistant.content = `请求失败：${error.message}`; showToast(error.message, 'error'); }
  } finally {
    activeRequest = null;
    session.updatedAt = Date.now();
    await persistChatSession(session, { immediate: true });
    $('#chat-send').disabled = false;
    $('#chat-send').setAttribute('aria-label', '发送消息');
    $('#chat-send').innerHTML = '<span>发送</span><i data-lucide="arrow-up" aria-hidden="true"></i>';
    updateStreamingMessageView(assistant);
    refreshIcons();
  }
}

function handleMessageAction(event) {
  const button = event.target.closest('[data-message-action]');
  if (button && event.type === 'keydown') return;
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
  if (button.dataset.messageAction === 'preview-image') {
    const imageUrl = safeMediaUrl(contentImageUrl(message.content));
    if (!imageUrl) { showToast('图片地址不可用。', 'error'); return; }
    openMediaPreview({
      items: [{
        url: imageUrl,
        title: imageLabelForMessage(message, imageUrl),
        meta: '对话图片',
        kind: 'image'
      }],
      returnFocus: button
    });
    return;
  }
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
  await persistChatSession(session, { immediate: true });
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
  await persistChatSession(session, { immediate: true });
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
  renderImagePromptShowcase();
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
    const source = isSvgFile(file) && file.type !== 'image/svg+xml' ? new Blob([file], { type: 'image/svg+xml' }) : file;
    reader.readAsDataURL(source);
  });
}

async function addImageReferenceFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  const maxRefs = imageModeMaxRefs();
  const room = maxRefs - imageReferences.length;
  if (room <= 0) { showToast(`参考图已满 ${maxRefs} 张，先移除部分再上传。`, 'error'); return; }
  const imageFiles = files.filter(isImageFile);
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

function handleMediaReferencePreviewKeydown(event) {
  if (!event.target.matches('.media-ref-visual[role="button"]') || !['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  event.target.click();
}

function imageReferenceTileMarkup(reference) {
  const id = escapeHtml(reference.id);
  const name = reference.name || '参考图';
  const safeName = escapeHtml(name);
  return `<div class="reference-tile" data-reference-id="${id}">
    <div class="reference-tile-media media-ref-visual" role="button" tabindex="0" data-reference-action="preview" data-reference-id="${id}" aria-label="预览 ${safeName}"><img draggable="false" src="${escapeHtml(reference.dataUrl || reference.url)}" alt="${safeName}"></div>
    <div class="media-ref-footer">
      <span class="media-ref-name" title="${safeName}">${safeName}</span>
      <div class="media-ref-actions">
        <button class="media-ref-remove" type="button" data-reference-action="remove" data-reference-id="${id}" aria-label="移除 ${safeName}" data-tooltip="移除参考图"><i data-lucide="trash-2" aria-hidden="true"></i></button>
      </div>
    </div>
  </div>`;
}

function renderImageReferences() {
  const maxRefs = imageModeMaxRefs();
  const grid = $('#image-reference-grid');
  $('#image-reference-count').textContent = `${imageReferences.length} / ${maxRefs}`;
  grid.innerHTML = imageReferences.map(imageReferenceTileMarkup).join('');
  grid.classList.toggle('is-reorderable', imageReferences.length > 1);
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
  const control = event.target.closest('[data-reference-action]');
  if (!control) return;
  const action = control.dataset.referenceAction;
  const id = control.dataset.referenceId;
  const index = imageReferences.findIndex((reference) => reference.id === id);
  if (index < 0) return;
  if (action === 'preview') {
    openMediaPreview({
      items: imageReferences.map((reference) => ({ url: reference.dataUrl || reference.url, title: reference.name || '参考图', kind: 'image' })),
      index,
      returnFocus: control
    });
    return;
  }
  if (action !== 'remove') return;
  imageReferences = imageReferences.filter((reference) => reference.id !== id);
    renderImageReferences();
    window.requestAnimationFrame(() => {
      const cards = $$('#image-reference-grid .reference-tile');
      const nextCard = cards[Math.min(index, cards.length - 1)];
      (nextCard?.querySelector('.media-ref-remove') || $('#image-pick-work'))?.focus();
    });
}

let activeMediaDragLayer = null;
const referenceFlipAnimations = new WeakMap();

function animateReferenceFlip(elements, firstRects) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  elements.forEach((element) => {
    const first = firstRects.get(element);
    if (!first || typeof element.animate !== 'function') return;
    referenceFlipAnimations.get(element)?.cancel();
    const last = element.getBoundingClientRect();
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    const animation = element.animate(
      [{ transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)` }, { transform: 'translate(0, 0)' }],
      { duration: 200, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)' }
    );
    referenceFlipAnimations.set(element, animation);
    animation.addEventListener('finish', () => {
      if (referenceFlipAnimations.get(element) === animation) referenceFlipAnimations.delete(element);
    }, { once: true });
  });
}

// 浮层挂到 body，避免工作区的 transform 坐标系和 overflow 裁剪影响拖拽。
function createMediaDragLayer(tile, rect, startX, startY) {
  if (activeMediaDragLayer) return null;
  const layer = document.createElement('div');
  const visual = tile.cloneNode(true);
  layer.className = 'media-drag-layer';
  layer.style.width = `${rect.width}px`;
  layer.style.height = `${rect.height}px`;
  visual.classList.remove('is-drag-source', 'is-drop-target', 'is-dragging');
  visual.classList.add('media-drag-visual');
  visual.removeAttribute('id');
  visual.setAttribute('aria-hidden', 'true');
  visual.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
  visual.querySelectorAll('button').forEach((button) => button.remove());
  layer.appendChild(visual);
  document.body.appendChild(layer);

  const grabOffsetX = startX - rect.left;
  const grabOffsetY = startY - rect.top;
  let left = rect.left;
  let top = rect.top;
  let frame = 0;
  let settleTimer = 0;
  let transitionHandler = null;
  let settled = false;

  const draw = () => {
    frame = 0;
    layer.style.transform = `translate3d(${left.toFixed(1)}px, ${top.toFixed(1)}px, 0)`;
  };
  const flush = () => {
    if (frame) window.cancelAnimationFrame(frame);
    draw();
  };
  const destroy = () => {
    if (frame) window.cancelAnimationFrame(frame);
    if (settleTimer) window.clearTimeout(settleTimer);
    if (transitionHandler) layer.removeEventListener('transitionend', transitionHandler);
    layer.remove();
    if (activeMediaDragLayer === api) activeMediaDragLayer = null;
  };
  const move = (clientX, clientY) => {
    if (settled) return;
    left = clientX - grabOffsetX;
    top = clientY - grabOffsetY;
    if (!frame) frame = window.requestAnimationFrame(draw);
  };
  const settleTo = (targetRect, onComplete, { immediate = false } = {}) => {
    if (settled || !targetRect) return;
    settled = true;
    flush();
    const complete = () => {
      if (!layer.isConnected) return;
      destroy();
      onComplete?.();
    };
    left = targetRect.left;
    top = targetRect.top;
    if (immediate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      draw();
      window.queueMicrotask ? window.queueMicrotask(complete) : Promise.resolve().then(complete);
      return;
    }
    layer.classList.add('is-settling');
    void layer.offsetWidth;
    transitionHandler = (event) => {
      if (event.target === layer && event.propertyName === 'transform') complete();
    };
    layer.addEventListener('transitionend', transitionHandler);
    draw();
    settleTimer = window.setTimeout(complete, 260);
  };
  const api = { move, settleTo, remove: destroy };
  activeMediaDragLayer = api;
  draw();
  return api;
}

function startPointerReorderGesture(event, { tile, onStart, onMove, onDrop, onCancel }) {
  if (event.button !== undefined && event.button !== 0) return;
  if (!tile?.isConnected) return;
  const pointerId = event.pointerId;
  const startX = event.clientX;
  const startY = event.clientY;
  const dragThreshold = event.pointerType === 'touch' ? 10 : 6;
  let phase = 'pressed';
  let ended = false;

  const releaseCapture = () => {
    if (tile.hasPointerCapture?.(pointerId)) {
      try { tile.releasePointerCapture(pointerId); } catch (error) { /* 指针已释放 */ }
    }
  };
  const removeListeners = () => {
    document.removeEventListener('pointermove', handleMove);
    document.removeEventListener('pointerup', handleDrop);
    document.removeEventListener('pointercancel', handleCancel);
    tile.removeEventListener('lostpointercapture', handleCancel);
    window.removeEventListener('blur', handleCancel);
    document.removeEventListener('visibilitychange', handleVisibility);
    document.removeEventListener('keydown', handleKeydown);
  };
  const finish = (kind, endEvent) => {
    if (ended) return;
    ended = true;
    removeListeners();
    releaseCapture();
    if (phase !== 'dragging') return;
    if (kind === 'drop') onDrop?.(endEvent);
    else onCancel?.();
  };
  const handleMove = (moveEvent) => {
    if (ended || moveEvent.pointerId !== pointerId) return;
    if (phase === 'pressed') {
      if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) <= dragThreshold) return;
      phase = 'dragging';
      onStart?.(startX, startY);
      try { tile.setPointerCapture(pointerId); } catch (error) { /* 当前浏览器不支持指针捕获 */ }
    }
    moveEvent.preventDefault();
    const coalesced = moveEvent.getCoalescedEvents?.();
    onMove?.(coalesced?.length ? coalesced[coalesced.length - 1] : moveEvent);
  };
  const handleDrop = (dropEvent) => finish('drop', dropEvent);
  const handleCancel = () => finish('cancel');
  const handleVisibility = () => { if (document.hidden) handleCancel(); };
  const handleKeydown = (keyEvent) => { if (keyEvent.key === 'Escape') handleCancel(); };

  document.addEventListener('pointermove', handleMove);
  document.addEventListener('pointerup', handleDrop);
  document.addEventListener('pointercancel', handleCancel);
  tile.addEventListener('lostpointercapture', handleCancel);
  window.addEventListener('blur', handleCancel);
  document.addEventListener('visibilitychange', handleVisibility);
  document.addEventListener('keydown', handleKeydown);
}

function findReferenceDropTarget(container, tile, placeholder, clientX, clientY) {
  const containerRect = container.getBoundingClientRect();
  const padding = 18;
  if (clientX < containerRect.left - padding || clientX > containerRect.right + padding || clientY < containerRect.top - padding || clientY > containerRect.bottom + padding) return null;
  let closest = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of container.children) {
    if (candidate !== placeholder && (!candidate.matches?.('.reference-tile') || candidate === tile)) continue;
    const rect = candidate.getBoundingClientRect();
    const dx = (clientX - rect.left - rect.width / 2) / Math.max(rect.width, 1);
    const dy = (clientY - rect.top - rect.height / 2) / Math.max(rect.height, 1);
    const distance = Math.hypot(dx, dy);
    if (distance >= closestDistance) continue;
    closest = candidate;
    closestDistance = distance;
  }
  return closest;
}

function startReferenceDrag(event) {
  if (activeMediaDragLayer) return;
  const tile = event.target.closest('.reference-tile');
  if (!tile || !event.target.closest('.media-ref-visual')) return;
  if (imageReferences.length < 2) return;
  const grid = $('#image-reference-grid');
  if (!grid) return;
  const draggedId = tile.dataset.referenceId;
  if (!draggedId || !imageReferences.some((reference) => reference.id === draggedId)) return;
  const originOrder = [...imageReferences];
  const draftOrder = [...originOrder];
  let currentTarget = null;
  let placeholder = null;
  let dragLayer = null;

  const clearTarget = () => {
    if (currentTarget) currentTarget.classList.remove('is-drop-target');
    currentTarget = null;
  };
  const resetSource = () => {
    tile.classList.remove('is-drag-source');
    tile.removeAttribute('aria-hidden');
    tile.style.position = '';
    tile.style.left = '';
    tile.style.top = '';
    tile.style.width = '';
    tile.style.height = '';
    tile.style.zIndex = '';
    tile.style.margin = '';
    tile.style.pointerEvents = '';
  };
  const visualNodes = () => Array.from(grid.children).filter((node) => node === placeholder || (node.matches?.('.reference-tile') && node !== tile));
  const restorePlaceholder = () => {
    const elements = Array.from(grid.querySelectorAll('.reference-tile')).filter((element) => element !== tile);
    const firstRects = new Map(elements.map((element) => [element, element.getBoundingClientRect()]));
    const byId = new Map(elements.map((element) => [element.dataset.referenceId, element]));
    originOrder.forEach((reference) => {
      if (reference.id === draggedId) {
        grid.appendChild(placeholder);
        return;
      }
      const element = byId.get(reference.id);
      if (element) grid.appendChild(element);
    });
    draftOrder.splice(0, draftOrder.length, ...originOrder);
    animateReferenceFlip(elements, firstRects);
  };
  const updateDropTarget = (clientX, clientY) => {
    const target = findReferenceDropTarget(grid, tile, placeholder, clientX, clientY);
    if (target !== currentTarget) {
      clearTarget();
      currentTarget = target;
      if (currentTarget) currentTarget.classList.add('is-drop-target');
    }
    if (!target || target === placeholder) return target;
    const list = visualNodes();
    const from = list.indexOf(placeholder);
    const over = list.indexOf(target);
    if (from < 0 || over < 0 || over === from) return target;
    const animated = list.filter((element) => element !== placeholder);
    const firstRects = new Map(animated.map((element) => [element, element.getBoundingClientRect()]));
    const [moved] = draftOrder.splice(from, 1);
    draftOrder.splice(over, 0, moved);
    if (over < from) grid.insertBefore(placeholder, target);
    else grid.insertBefore(placeholder, target.nextSibling);
    animateReferenceFlip(animated, firstRects);
    return target;
  };
  const finishDrag = (commit, { immediate = false } = {}) => {
    clearTarget();
    document.body.classList.remove('ref-dragging');
    const destination = placeholder?.getBoundingClientRect();
    if (!dragLayer || !destination) {
      placeholder?.remove();
      resetSource();
      return;
    }
    dragLayer.settleTo(destination, () => {
      if (placeholder?.isConnected) grid.insertBefore(tile, placeholder);
      placeholder?.remove();
      placeholder = null;
      resetSource();
      if (commit) {
        imageReferences = [...draftOrder];
        renderImageReferences();
      }
      dragLayer = null;
    }, { immediate });
  };

  startPointerReorderGesture(event, {
    tile,
    onStart: (startX, startY) => {
      const rect = tile.getBoundingClientRect();
      dragLayer = createMediaDragLayer(tile, rect, startX, startY);
      if (!dragLayer) return;
      placeholder = document.createElement('div');
      placeholder.className = 'reference-drag-placeholder';
      placeholder.style.width = `${rect.width}px`;
      placeholder.style.height = `${rect.height}px`;
      grid.insertBefore(placeholder, tile);
      tile.style.position = 'fixed';
      tile.style.left = `${rect.left}px`;
      tile.style.top = `${rect.top}px`;
      tile.style.width = `${rect.width}px`;
      tile.style.height = `${rect.height}px`;
      tile.style.margin = '0';
      tile.style.pointerEvents = 'none';
      tile.classList.add('is-drag-source');
      tile.setAttribute('aria-hidden', 'true');
      document.body.classList.add('ref-dragging');
    },
    onMove: (moveEvent) => {
      if (!dragLayer || !placeholder) return;
      dragLayer.move(moveEvent.clientX, moveEvent.clientY);
      updateDropTarget(moveEvent.clientX, moveEvent.clientY);
    },
    onDrop: (dropEvent) => {
      if (!dragLayer || !placeholder) return;
      const target = updateDropTarget(dropEvent.clientX, dropEvent.clientY);
      const hasDraftChange = draftOrder.some((reference, index) => reference.id !== originOrder[index]?.id);
      const valid = Boolean(target && hasDraftChange);
      if (!valid) restorePlaceholder();
      finishDrag(valid);
    },
    onCancel: () => {
      if (!dragLayer || !placeholder) return;
      restorePlaceholder();
      finishDrag(false, { immediate: document.hidden });
    }
  });
}

function startKeyframeDrag(event) {
  if (activeMediaDragLayer) return;
  if (!event.target.closest('.media-ref-visual')) return;
  if (![0, 1].every((index) => Boolean(videoKeyframeRefs[index]))) return;
  const tile = event.target.closest('.video-ref-shot');
  const pair = event.currentTarget.querySelector('.video-ref-pair');
  if (!tile || !pair) return;
  const slots = Array.from(pair.querySelectorAll('.video-ref-slot'));
  const from = Number(tile.dataset.videoRefIndex);
  if (!Number.isInteger(from) || !slots[from]) return;
  const originOrder = [...videoKeyframeRefs];
  let currentTarget = null;
  let dragLayer = null;
  const clearTarget = () => {
    if (currentTarget) currentTarget.classList.remove('is-drop-target');
    currentTarget = null;
  };
  const clearDraggingState = () => {
    clearTarget();
    document.body.classList.remove('ref-dragging');
  };
  const findTarget = (clientX, clientY) => slots.find((slot, index) => {
    if (index === from) return false;
    const rect = slot.getBoundingClientRect();
    const padding = 10;
    return clientX >= rect.left - padding && clientX <= rect.right + padding && clientY >= rect.top - padding && clientY <= rect.bottom + padding;
  }) || null;
  const updateTarget = (clientX, clientY) => {
    const target = findTarget(clientX, clientY);
    if (target !== currentTarget) {
      clearTarget();
      currentTarget = target;
      if (currentTarget) currentTarget.classList.add('is-drop-target');
    }
    return target;
  };
  const settleBack = ({ immediate = false } = {}) => {
    clearDraggingState();
    const sourceRect = tile.getBoundingClientRect();
    dragLayer?.settleTo(sourceRect, () => {
      tile.classList.remove('is-drag-source');
      tile.style.pointerEvents = '';
      dragLayer = null;
    }, { immediate });
  };

  startPointerReorderGesture(event, {
    tile,
    onStart: (startX, startY) => {
      const startRect = tile.getBoundingClientRect();
      dragLayer = createMediaDragLayer(tile, startRect, startX, startY);
      if (!dragLayer) return;
      document.body.classList.add('ref-dragging');
      tile.classList.add('is-drag-source');
      tile.style.pointerEvents = 'none';
    },
    onMove: (moveEvent) => {
      if (!dragLayer) return;
      dragLayer.move(moveEvent.clientX, moveEvent.clientY);
      updateTarget(moveEvent.clientX, moveEvent.clientY);
    },
    onDrop: (dropEvent) => {
      if (!dragLayer) return;
      const target = updateTarget(dropEvent.clientX, dropEvent.clientY);
      const dropIndex = target ? slots.indexOf(target) : -1;
      const valid = dropIndex >= 0;
      if (!valid) {
        settleBack();
        return;
      }
      const targetTile = target.querySelector('.video-ref-shot');
      const targetRect = target.getBoundingClientRect();
      const sourceRect = slots[from].getBoundingClientRect();
      clearDraggingState();
      if (targetTile && typeof targetTile.animate === 'function' && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        targetTile.classList.add('is-swap-counterpart');
        targetTile.animate(
          [
            { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 },
            { transform: `translate3d(${(sourceRect.left - targetRect.left).toFixed(1)}px, ${(sourceRect.top - targetRect.top).toFixed(1)}px, 0) scale(0.985)`, opacity: 0.82 }
          ],
          { duration: 180, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)', fill: 'forwards' }
        );
      }
      dragLayer.settleTo(targetRect, () => {
        videoKeyframeRefs = [...originOrder];
        [videoKeyframeRefs[from], videoKeyframeRefs[dropIndex]] = [videoKeyframeRefs[dropIndex], videoKeyframeRefs[from]];
        tile.style.pointerEvents = '';
        renderVideoRefs();
        dragLayer = null;
      });
    },
    onCancel: () => {
      if (!dragLayer) return;
      settleBack({ immediate: document.hidden });
    }
  });
}

function openReferenceUrlModal({ onConfirm }) {
  const existing = $('#reference-url-modal');
  if (existing) existing.remove();
  const returnFocus = document.activeElement;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = 'reference-url-modal';
  backdrop.innerHTML = `
    <section class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="reference-url-modal-title">
      <div class="modal-topline">
        <span class="section-kicker"><span class="signal-line"></span> 图片来源</span>
        <button class="icon-button small" type="button" id="reference-url-modal-close" aria-label="关闭" data-tooltip="关闭"><i data-lucide="x" aria-hidden="true"></i></button>
      </div>
      <h2 id="reference-url-modal-title">填写图片链接</h2>
      <p class="modal-copy">支持公开可访问的 HTTPS 图片地址。</p>
      <div class="url-modal-input-wrap"><i data-lucide="link" aria-hidden="true"></i><input id="reference-url-modal-input" type="url" placeholder="https://example.com/image.png" autocomplete="off"></div>
      <div class="modal-actions"><button class="text-button" type="button" id="reference-url-modal-cancel"><i data-lucide="x" aria-hidden="true"></i>取消</button><button class="primary-action" type="button" id="reference-url-modal-confirm">确定 <i data-lucide="check" aria-hidden="true"></i></button></div>
    </section>`;
  document.body.appendChild(backdrop);
  refreshIcons();
  syncOverlayState();
  const close = () => {
    backdrop.remove();
    syncOverlayState();
    if (returnFocus?.isConnected) window.requestAnimationFrame(() => returnFocus.focus());
  };
  const input = backdrop.querySelector('#reference-url-modal-input');
  const submit = () => {
    const url = input.value.trim();
    if (!url) { showToast('请填写图片链接。', 'error'); input.focus(); return; }
    if (!isHttpsUrl(url)) { showToast('请填写公开可访问的 HTTPS 图片链接。', 'error'); input.focus(); return; }
    onConfirm?.(url);
    close();
  };
  backdrop.querySelector('#reference-url-modal-close').addEventListener('click', close);
  backdrop.querySelector('#reference-url-modal-cancel').addEventListener('click', close);
  backdrop.querySelector('#reference-url-modal-confirm').addEventListener('click', submit);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });
  input.addEventListener('keydown', (event) => { if (event.key === 'Enter') submit(); });
  input.focus();
}

function openImageUrlModal() {
  openReferenceUrlModal({
    onConfirm: (url) => {
      imageReferences.push({ id: createId('ref'), name: shortText(url, 24), url });
      renderImageReferences();
    }
  });
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

function videoRefTileMarkup(ref, index = 0, kind = 'image') {
  const name = ref.name || shortText(ref.url || '', 30) || '视频参考图';
  const safeName = escapeHtml(name);
  return `<div class="video-ref-shot" data-video-ref-index="${index}">
    <div class="video-ref-media media-ref-visual" role="button" tabindex="0" data-video-ref-action="preview" aria-label="预览 ${safeName}"><img draggable="false" src="${escapeHtml(ref.dataUrl || ref.url)}" alt="${safeName}"></div>
    <div class="media-ref-footer">
      <span class="media-ref-name" title="${safeName}">${safeName}</span>
      <div class="media-ref-actions">
        <button class="media-ref-remove" type="button" data-video-ref-action="remove" aria-label="移除 ${safeName}" data-tooltip="移除参考图"><i data-lucide="trash-2" aria-hidden="true"></i></button>
      </div>
    </div>
  </div>`;
}

function renderVideoRefs() {
  const imageGrid = $('#video-image-ref-grid');
  if (imageGrid) {
    imageGrid.innerHTML = videoImageRefs.length ? videoRefTileMarkup(videoImageRefs[0], 0, 'image') : videoRefEmptyMarkup('添加首帧参考图');
    $('#video-image-ref-count').textContent = `${videoImageRefs.length ? 1 : 0} / 1`;
  }
  [0, 1].forEach((index) => {
    const slot = $(`#video-keyframe-slot-${index}`);
    if (!slot) return;
    slot.innerHTML = videoKeyframeRefs[index] ? videoRefTileMarkup(videoKeyframeRefs[index], index, 'keyframe') : videoRefEmptyMarkup('添加关键帧');
  });
  const pair = $('#video-keyframe-inputs .video-ref-pair');
  if (pair) pair.classList.toggle('is-reorderable', [0, 1].every((index) => Boolean(videoKeyframeRefs[index])));
  updateVideoPromptNote();
  refreshIcons();
}

function addVideoRefFile(kind, index, fileList) {
  const file = Array.from(fileList || [])[0];
  if (!file) return;
  if (!isImageFile(file)) { showToast('请选择图片文件或 SVG 文件。', 'error'); return; }
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
  if (!button) return;
  let index = 0;
  if (kind === 'keyframes') index = button.closest('#video-keyframe-slot-1') ? 1 : 0;
  const action = button.dataset.videoRefAction;
  if (action === 'preview') {
    const ref = kind === 'image' ? videoImageRefs[0] : videoKeyframeRefs[index];
    if (ref) openVideoRefPreview(videoRefValue(ref), button);
    return;
  }
  if (action === 'remove') {
    if (kind === 'image') videoImageRefs = [];
    else videoKeyframeRefs[index] = undefined;
    renderVideoRefs();
    window.requestAnimationFrame(() => {
      const slot = kind === 'image' ? $('#video-image-ref-grid') : $(`#video-keyframe-slot-${index}`);
      slot?.querySelector('[data-video-ref-action="upload"]')?.focus();
    });
    return;
  }
  videoRefTarget = { mode: kind, index };
  if (action === 'upload') {
    $(kind === 'image' ? '#video-image-file-input' : '#video-keyframe-file-input').click();
    return;
  }
  if (action === 'pick') {
    const current = kind === 'image' ? videoImageRefs[0] : videoKeyframeRefs[index];
    const currentUrl = current ? safeMediaUrl(videoRefValue(current)) : '';
    const workUrls = new Set(state.works.filter((work) => work.kind === 'image').map((work) => safeMediaUrl(work.url)).filter(Boolean));
    openWorkPicker({
      max: 1,
      selected: currentUrl && workUrls.has(currentUrl) ? [currentUrl] : [],
      onConfirm: (items) => {
        const item = items[0];
        if (item) setVideoRef(kind, index, { id: createId('ref'), name: item.title, url: item.url });
      }
    });
    return;
  }
  if (action === 'link') openVideoUrlModal(kind, index);
}

function openVideoRefPreview(srcUrl, returnFocus = document.activeElement) {
  const items = [];
  if (videoImageRefs[0]) items.push({ url: videoRefValue(videoImageRefs[0]), title: videoImageRefs[0].name || '首帧参考图', meta: '首帧', kind: 'image' });
  videoKeyframeRefs.forEach((ref, index) => {
    if (ref) items.push({ url: videoRefValue(ref), title: ref.name || `关键帧 ${index + 1}`, meta: `关键帧 ${index + 1}`, kind: 'image' });
  });
  if (!items.length) return;
  const index = Math.max(0, items.findIndex((item) => item.url === srcUrl));
  openMediaPreview({ items, index, returnFocus });
}

function openVideoUrlModal(kind, index) {
  openReferenceUrlModal({
    onConfirm: (url) => setVideoRef(kind, index, { id: createId('ref'), name: shortText(url, 24), url })
  });
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

async function loadPromptExamples() {
  try {
    const response = await fetch(`config/prompt-examples.json?v=2.23.1`, { cache: 'no-store' });
    if (!response.ok) throw new Error('案例配置加载失败');
    const value = await response.json();
    if (!Array.isArray(value?.textToImage?.examples)) throw new Error('案例配置格式无效');
    promptExamples = value;
  } catch (error) {
    promptExamples = PROMPT_EXAMPLES_FALLBACK;
  }
  renderImagePromptShowcase();
}

function resolvePromptExampleImage(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try { return new URL(raw, document.baseURI).href; } catch (error) { return ''; }
}

function renderImagePromptShowcase() {
  const container = $('#image-prompt-showcase');
  if (!container) return;
  const visible = state.ui.image.mode === 'text';
  container.classList.toggle('is-hidden', !visible);
  if (!visible) return;
  const config = promptExamples?.textToImage || PROMPT_EXAMPLES_FALLBACK.textToImage;
  $('#prompt-showcase-title').textContent = config.title || PROMPT_EXAMPLES_FALLBACK.textToImage.title;
  $('#prompt-showcase-description').textContent = config.description || PROMPT_EXAMPLES_FALLBACK.textToImage.description;
  container.classList.toggle('is-collapsed', promptShowcaseCollapsed);
  const toggle = $('[data-prompt-showcase-toggle]', container);
  toggle?.setAttribute('aria-expanded', String(!promptShowcaseCollapsed));
  toggle?.setAttribute('aria-label', promptShowcaseCollapsed ? '展开案例' : '收起案例');
  toggle?.setAttribute('data-tooltip', promptShowcaseCollapsed ? '展开案例' : '收起案例');
  const gallery = $('#prompt-showcase-gallery');
  const examples = Array.isArray(config.examples) ? config.examples.filter((item) => item?.prompt) : [];
  gallery.classList.toggle('has-selection', Boolean(selectedPromptExampleId));
  gallery.innerHTML = examples.map((example) => {
    const image = resolvePromptExampleImage(example.image);
    const title = example.title || '提示词案例';
    const selected = String(example.id || '') === selectedPromptExampleId;
    return `<button class="prompt-example-card${selected ? ' is-selected' : ''}" type="button" data-prompt-example-id="${escapeHtml(example.id || '')}" aria-label="使用案例：${escapeHtml(title)}" aria-pressed="${selected}"><span class="prompt-example-title">${escapeHtml(title)}</span><span class="prompt-example-media">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(example.alt || title)}" loading="lazy"><span class="prompt-example-fallback" hidden><i data-lucide="image-off" aria-hidden="true"></i></span>` : '<span class="prompt-example-fallback"><i data-lucide="image" aria-hidden="true"></i></span>'}</span></button>`;
  }).join('');
  $$('.prompt-example-card img', gallery).forEach((image) => image.addEventListener('error', () => { image.hidden = true; const fallback = $('.prompt-example-fallback', image.closest('.prompt-example-media')); if (fallback) fallback.hidden = false; }, { once: true }));
  refreshIcons();
}

function updatePromptExampleSelection(example, sourceCard) {
  if (!example) return;
  const gallery = $('#prompt-showcase-gallery');
  if (!gallery) return;
  const cards = $$('.prompt-example-card', gallery);
  const previousIndex = cards.findIndex((card) => card.classList.contains('is-selected'));
  selectedPromptExampleId = String(example.id || '');
  gallery.classList.add('has-selection');
  cards.forEach((card) => {
    const selected = card.dataset.promptExampleId === selectedPromptExampleId;
    card.classList.toggle('is-selected', selected);
    card.setAttribute('aria-pressed', String(selected));
  });
  const selectedCard = sourceCard?.isConnected
    ? sourceCard
    : cards.find((card) => card.dataset.promptExampleId === selectedPromptExampleId);
  if (!selectedCard) return;
  const selectedIndex = cards.indexOf(selectedCard);
  const direction = previousIndex >= 0 && selectedIndex < previousIndex ? 'backward' : 'forward';
  gallery.classList.remove('is-sliding-forward', 'is-sliding-backward');
  void gallery.offsetWidth;
  gallery.classList.add(`is-sliding-${direction}`);
  const targetLeft = selectedCard.offsetLeft - ((gallery.clientWidth - selectedCard.offsetWidth) / 2);
  const reduceMotion = state.ui.general.reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  gallery.scrollTo({ left: Math.max(0, targetLeft), behavior: reduceMotion ? 'auto' : 'smooth' });
  window.setTimeout(() => gallery.classList.remove('is-sliding-forward', 'is-sliding-backward'), reduceMotion ? 20 : 440);
}

function fillPromptExample(example, sourceCard) {
  const input = $('#image-prompt');
  if (!input || !example?.prompt) return;
  const apply = () => {
    input.value = example.prompt;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
    updatePromptExampleSelection(example, sourceCard);
    showToast('案例提示词已填入，可继续修改。');
  };
  if (input.value.trim()) {
    showConfirmModal({ title: '替换当前提示词', message: '当前输入内容会被案例模板替换，是否继续？', confirmText: '确认替换', onConfirm: apply });
  } else apply();
}

function handlePromptShowcaseAction(event) {
  const toggle = event.target.closest('[data-prompt-showcase-toggle]');
  if (toggle) {
    promptShowcaseCollapsed = !promptShowcaseCollapsed;
    const container = $('#image-prompt-showcase');
    container.classList.toggle('is-collapsed', promptShowcaseCollapsed);
    toggle.setAttribute('aria-expanded', String(!promptShowcaseCollapsed));
    toggle.setAttribute('aria-label', promptShowcaseCollapsed ? '展开案例' : '收起案例');
    toggle.setAttribute('data-tooltip', promptShowcaseCollapsed ? '展开案例' : '收起案例');
    return;
  }
  const card = event.target.closest('[data-prompt-example-id]');
  if (!card) return;
  const config = promptExamples?.textToImage || PROMPT_EXAMPLES_FALLBACK.textToImage;
  const example = (config.examples || []).find((item) => String(item.id || '') === card.dataset.promptExampleId);
  fillPromptExample(example, card);
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
    items: [{
      url,
      title: 'Agnes 生成图像',
      meta: `${imageResult.size || ''} / ${imageResult.ratio || ''}`.replace(/^\/\s*/, ''),
      kind: 'image',
      prompt: imageResult.prompt || imageActivePrompt || '',
      generation: imageResult.generation || null,
      createdAt: imageResult.createdAt || null
    }],
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

function createImageGenerationSnapshot({ mode, referenceCount, createdAt }) {
  const preset = IMAGE_STYLE_PRESETS[state.ui.image.stylePreset] || IMAGE_STYLE_PRESETS.none;
  return {
    model: CONFIG.models.image,
    mode,
    modeLabel: IMAGE_MODE_LABELS[mode] || mode,
    size: state.ui.image.size,
    ratio: state.ui.image.ratio,
    stylePreset: state.ui.image.stylePreset,
    styleLabel: preset.label,
    referenceCount,
    responseFormat: 'URL',
    createdAt
  };
}

function videoPromptReferenceUrls() {
  const refs = state.ui.video.mode === 'image'
    ? videoImageRefs.slice(0, 1)
    : state.ui.video.mode === 'keyframes'
      ? videoKeyframeRefs.slice(0, 2)
      : [];
  return refs.filter(isUsableVideoRef).map(videoRefValue);
}

function updateVideoPromptNote() {
  const note = $('#video-prompt-note');
  if (!note) return;
  const preset = VIDEO_STYLE_PRESETS[state.ui.video.stylePreset] || VIDEO_STYLE_PRESETS.none;
  const referenceCount = videoPromptReferenceUrls().length;
  const referenceNote = state.ui.video.mode === 'image' && referenceCount
    ? 'AI 会先读取首帧参考图，再设计动作和运镜。'
    : state.ui.video.mode === 'keyframes' && referenceCount
      ? `AI 会按顺序读取 ${referenceCount} 张关键帧，再设计过渡过程。`
      : 'AI 会根据文字要求设计动作、运镜和节奏。';
  const styleNote = preset.prompt ? `创建任务时追加“${preset.label}”风格要求。` : '当前不追加风格预设。';
  note.querySelector('span').textContent = `${referenceNote} ${styleNote}`;
}

function setVideoStylePreset(preset, persist = true) {
  const next = VIDEO_STYLE_PRESETS[preset] ? preset : 'none';
  const selected = VIDEO_STYLE_PRESETS[next];
  state.ui.video.stylePreset = next;
  $$('[data-video-style]').forEach((button) => button.classList.toggle('is-active', button.dataset.videoStyle === next));
  $('#video-style-summary').textContent = selected.label;
  updateVideoPromptNote();
  if (persist) saveState();
}

function composeVideoPrompt(prompt) {
  const preset = VIDEO_STYLE_PRESETS[state.ui.video.stylePreset] || VIDEO_STYLE_PRESETS.none;
  return preset.prompt ? `${prompt}\n\n视频风格要求：${preset.prompt}` : prompt;
}

function createVideoGenerationSnapshot({ mode, referenceCount, createdAt, settings }) {
  const dimensions = VIDEO_DIMENSIONS[settings.ratio] || VIDEO_DIMENSIONS['16:9'];
  const duration = VIDEO_PRESETS[settings.duration] || VIDEO_PRESETS[5];
  const style = VIDEO_STYLE_PRESETS[settings.stylePreset] || VIDEO_STYLE_PRESETS.none;
  return {
    model: CONFIG.models.video,
    mode,
    modeLabel: VIDEO_MODE_LABELS[mode] || mode,
    width: dimensions.width,
    height: dimensions.height,
    ratio: settings.ratio,
    duration: Number(settings.duration),
    frames: duration.frames,
    frameRate: Number(settings.frameRate),
    stylePreset: settings.stylePreset,
    styleLabel: style.label,
    referenceCount,
    negativePrompt: settings.negativePrompt || '',
    seed: settings.seed === '' ? '' : settings.seed,
    createdAt
  };
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

function buildVideoPromptInstruction(kind) {
  const basePrompt = $('#video-prompt').value.trim();
  const direction = $('#video-keywords').value.trim() || '请综合补足主体动作、运动轨迹、镜头调度、节奏、光线变化和时序连续性';
  const preset = VIDEO_STYLE_PRESETS[state.ui.video.stylePreset] || VIDEO_STYLE_PRESETS.none;
  const mode = state.ui.video.mode;
  const modeLabel = { text: '文生视频', image: '图生视频', keyframes: '关键帧动画' }[mode] || '文生视频';
  const referenceUrls = videoPromptReferenceUrls();
  const referenceInstruction = mode === 'image' && referenceUrls.length
    ? '你会收到一张首帧参考图。请先观察图中真实可见的主体、姿态、场景、构图、光线和材质，以它作为视频起始状态，设计合理运动；不得凭空替换主体或改变身份。'
    : mode === 'keyframes' && referenceUrls.length
      ? `你会按起始帧、结束帧的顺序收到 ${referenceUrls.length} 张关键帧。请先观察两帧中主体、姿态、场景和构图的差异，明确描述从第一帧到第二帧的连续过渡；不得颠倒首尾、替换主体或破坏身份一致性。`
      : '当前没有参考帧，请完全根据文字要求设计连续画面。';
  if (kind === 'random') {
    return `请为 Agnes 视频模型创作一条可直接使用的中文视频生成提示词。当前模式：${modeLabel}。${referenceInstruction}创作方向：${direction}。风格预设：${preset.prompt || '自由发挥'}。提示词必须明确主体、起始状态、动作过程、结束状态、场景、镜头运动、节奏、光线和氛围，保持物理运动合理、时序连续、主体身份稳定；使用一个连贯镜头，避免互相冲突的动作和运镜。只返回一段提示词，不要解释，不要加标题，不要使用 Markdown。`;
  }
  return `请优化下面这条 Agnes 视频生成提示词。保留原始意图、主体身份和核心动作；${referenceInstruction}根据优化方向补足动作轨迹、时间顺序、镜头调度、景别变化、节奏、光线变化、环境反馈与首尾衔接，消除互相冲突的动作和运镜，提升主体稳定性与画面连续性。当前模式：${modeLabel}。优化方向：${direction}。风格预设：${preset.prompt || '不额外限定风格'}。原始提示词：${basePrompt}。只返回优化后的完整提示词，不要解释，不要加标题，不要使用 Markdown。`;
}

function promptAssistButton(target, kind) {
  return $(`#${target}-${kind === 'random' ? 'random' : 'optimize'}-prompt`);
}

function setPromptAssistButtons(target, busy, activeKind = '') {
  const assist = promptAssistStates[target];
  if (!assist) return;
  if (activeKind) assist.activeKind = activeKind;
  const labels = { random: ['随机灵感', '取消灵感'], optimize: ['优化提示词', '取消优化'] };
  ['random', 'optimize'].forEach((kind) => {
    const button = promptAssistButton(target, kind);
    if (!button) return;
    button.disabled = busy && activeKind !== kind;
    button.classList.toggle('is-primary', busy ? activeKind === kind : assist.activeKind === kind);
    button.setAttribute('aria-busy', busy && activeKind === kind ? 'true' : 'false');
    const label = labels[kind][busy && activeKind === kind ? 1 : 0];
    button.querySelector('span').textContent = label;
  });
}

function handlePromptAssistCancel(target, kind) {
  const assist = promptAssistStates[target];
  if (!assist?.request) return;
  const button = promptAssistButton(target, kind);
  if (!assist.cancelArmed) {
    assist.cancelArmed = true;
    if (button) {
      button.querySelector('span').textContent = '再点一次确认取消';
      button.classList.add('is-confirming');
    }
    window.clearTimeout(assist.cancelTimer);
    assist.cancelTimer = window.setTimeout(() => {
      assist.cancelArmed = false;
      if (button) {
        button.querySelector('span').textContent = kind === 'random' ? '取消灵感' : '取消优化';
        button.classList.remove('is-confirming');
      }
    }, 3000);
    return;
  }
  assist.cancelArmed = false;
  window.clearTimeout(assist.cancelTimer);
  assist.request.abort();
  showToast('已取消提示词生成。');
}

async function requestPromptAssist(target, kind) {
  const assist = promptAssistStates[target];
  if (!assist || assist.request || !requireApiKey()) return;
  const input = $(`#${target}-prompt`);
  const basePrompt = input.value.trim();
  if (kind === 'optimize' && !basePrompt) {
    showToast('请先写下已有提示词，再进行优化。', 'error');
    input.focus();
    return;
  }
  const isVideo = target === 'video';
  const referenceUrls = isVideo ? videoPromptReferenceUrls() : imagePromptReferenceUrls();
  assist.request = new AbortController();
  setPromptAssistButtons(target, true, kind);
  try {
    const instruction = isVideo ? buildVideoPromptInstruction(kind) : buildImagePromptInstruction(kind);
    const promptContent = [{ type: 'text', text: instruction }];
    referenceUrls.forEach((url) => promptContent.push({ type: 'image_url', image_url: { url } }));
    const result = await AgnesClient.chat({
      messages: [
        { role: 'system', content: isVideo
          ? '你是 Agnes 视频提示词设计师，擅长把创作意图和参考帧整理为动作明确、运镜合理、时序连贯的高质量视频提示词。'
          : '你是 Agnes 图像提示词设计师，擅长把创作意图整理为可执行的高质量生图提示词。' },
        { role: 'user', content: promptContent }
      ],
      settings: { temperature: kind === 'random' ? 0.95 : 0.55, maxTokens: isVideo ? 896 : 768, thinking: false },
      signal: assist.request.signal,
      onToken: () => {}
    });
    const prompt = cleanPromptAssistantText(result.content);
    if (!prompt) throw new AgnesApiError('Agnes 没有返回可用的提示词。');
    input.value = prompt;
    showToast(kind === 'random'
      ? `${isVideo ? '视频' : '图像'}随机灵感已写入提示词。`
      : `${isVideo ? '视频' : '图像'}提示词已优化。`);
  } catch (error) {
    if (error.name !== 'AbortError') showToast(error.message, 'error');
  } finally {
    assist.request = null;
    assist.cancelArmed = false;
    window.clearTimeout(assist.cancelTimer);
    promptAssistButton(target, kind)?.classList.remove('is-confirming');
    setPromptAssistButtons(target, false);
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
    result.innerHTML = `<div class="loading-state"><div class="loading-ring"></div><span>正在整理画面...</span><small>图像生成进行中</small>${promptPrintMarkup('image', imageActivePrompt)}<button class="image-cancel-button" type="button" id="image-cancel-generate">取消生成</button></div>`;
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
  result.innerHTML = `<div class="output-result-stack image-result-stack"><figure class="result-figure"><img src="${escapeHtml(url)}" alt="Agnes 生成图像"><figcaption class="result-caption"><span>${escapeHtml(imageResult.size)} / ${escapeHtml(imageResult.ratio)}</span><span>${escapeHtml(shortText(url, 48))}</span></figcaption></figure>${imageActivePrompt ? promptPrintMiniMarkup('image', imageActivePrompt) : ''}</div>`;
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
  const createdAt = Date.now();
  const refImages = imageReferences.map((reference) => reference.dataUrl || reference.url).slice(0, imageModeMaxRefs());
  const generation = createImageGenerationSnapshot({ mode, referenceCount: refImages.length, createdAt });
  button.disabled = true;
  imageResult = { status: 'loading' };
  imageActivePrompt = prompt;
  renderImageResult();
  startPromptPrint('image', prompt);
  imageRequestController = new AbortController();
  window.clearTimeout(imageCancelTimer);
  imageCancelArmed = false;
  try {
    const payload = await AgnesClient.generateImage({ prompt, size: generation.size, ratio: generation.ratio, images: refImages, signal: imageRequestController.signal });
    const item = payload.data?.[0] || {};
    const url = item.url || (item.b64_json ? (item.b64_json.startsWith('data:') ? item.b64_json : `data:image/png;base64,${item.b64_json}`) : '');
    if (!url) throw new AgnesApiError('Agnes 没有返回图像 URL 或 Base64 内容。');
    imageResult = { status: 'complete', url, size: generation.size, ratio: generation.ratio, prompt, generation, createdAt };
    addWork({ kind: 'image', title: shortText(basePrompt, 38), prompt, url, meta: `${generation.size} / ${generation.ratio}`, generation, createdAt });
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

function promptPrintMarkup(kind, text = '') {
  const preview = shortText(text, 180) || '提示词准备中…';
  return `<div class="prompt-print" id="${kind}-prompt-print">
    <div class="prompt-print-head">
      <span class="prompt-print-title"><i data-lucide="printer" aria-hidden="true"></i>发送给模型的提示词</span>
      <span class="prompt-print-actions">
        <button class="text-button" type="button" data-print-action="copy"><i data-lucide="copy" aria-hidden="true"></i>复制</button>
        <button class="text-button" type="button" data-print-action="view"><i data-lucide="expand" aria-hidden="true"></i>完整查看</button>
      </span>
    </div>
    <pre class="prompt-print-text" id="${kind}-prompt-print-text" title="${escapeHtml(text)}">${escapeHtml(preview)}</pre>
    <span class="prompt-print-status" id="${kind}-prompt-print-status"></span>
  </div>`;
}

function promptPrintMiniMarkup(kind, text) {
  const fullText = text || '暂无可用提示词';
  return `<div class="prompt-print-mini" id="${kind}-prompt-print-mini">
    <span class="prompt-print-mini-label"><i data-lucide="printer" aria-hidden="true"></i>已发送提示词</span>
    <span class="prompt-print-mini-actions">
      <button class="text-button" type="button" data-print-action="copy"><i data-lucide="copy" aria-hidden="true"></i>复制</button>
      <button class="text-button" type="button" data-print-action="view"><i data-lucide="expand" aria-hidden="true"></i>完整查看</button>
    </span>
    <span class="prompt-print-mini-text" title="${escapeHtml(fullText)}">${escapeHtml(fullText)}</span>
  </div>`;
}

function startPromptPrint(kind, text) {
  stopPromptPrint(kind);
  if (!text) return;
  promptPrintStates[kind] = { text, index: text.length, done: true, timer: 0 };
  syncPromptPrintDom(kind);
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
  if (textNode && state) {
    textNode.textContent = shortText(state.text, 180);
    textNode.title = state.text;
  }
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
    result.innerHTML = `<div class="output-result-stack video-result-stack"><div class="video-result"><video controls preload="metadata" src="${escapeHtml(url)}"></video><div class="video-result-actions"><button class="icon-button small" type="button" data-video-action="preview" aria-label="预览视频" data-tooltip="预览视频"><i data-lucide="scan-eye" aria-hidden="true"></i></button><button class="icon-button small" type="button" data-video-action="copy" aria-label="复制视频 URL" data-tooltip="复制视频 URL"><i data-lucide="link" aria-hidden="true"></i></button><button class="icon-button small" type="button" data-video-action="download" aria-label="下载视频" data-tooltip="下载视频"><i data-lucide="download" aria-hidden="true"></i></button></div><div class="job-meta"><div class="job-meta-item"><small>状态</small><strong>已完成</strong></div><div class="job-meta-item"><small>尺寸</small><strong>${escapeHtml(videoJob.size || '--')}</strong></div><div class="job-meta-item"><small>时长</small><strong>${escapeHtml(videoJob.seconds || '--')} 秒</strong></div></div></div>${videoJob.prompt ? promptPrintMiniMarkup('video', videoJob.prompt) : ''}</div>`;
    refreshIcons();
    return;
  }
  const notice = videoJob.error
    ? `<p class="job-notice is-error">${escapeHtml(videoJob.error)}</p>`
    : videoJob.pollNotice
      ? `<p class="job-notice">${escapeHtml(videoJob.pollNotice)}</p>`
      : '';
  const printBlock = isActive
    ? promptPrintMarkup('video', videoJob.prompt)
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
  const basePrompt = $('#video-prompt').value.trim();
  const prompt = composeVideoPrompt(basePrompt);
  const mode = state.ui.video.mode;
  if (!basePrompt) { showToast('请输入视频提示词，或先使用随机灵感。', 'error'); $('#video-prompt').focus(); return; }
  const imageRef = videoImageRefs[0] || null;
  const keyframeRefs = [videoKeyframeRefs[0], videoKeyframeRefs[1]].filter(isUsableVideoRef);
  if (mode === 'image' && !isUsableVideoRef(imageRef)) { showToast('图生视频需要一张首帧参考图（上传图片或填写 HTTPS 链接）。', 'error'); return; }
  if (mode === 'keyframes' && keyframeRefs.length !== 2) { showToast('关键帧动画需要两张参考图（上传图片或填写 HTTPS 链接）。', 'error'); return; }
  const button = $('#video-generate');
  const createdAt = Date.now();
  const settings = getVideoSettings();
  const referenceCount = mode === 'image' ? 1 : mode === 'keyframes' ? keyframeRefs.length : 0;
  const generation = createVideoGenerationSnapshot({ mode, referenceCount, createdAt, settings });
  button.disabled = true;
  videoPollController = new AbortController();
  videoRefreshRequested = false;
  videoRefreshInFlight = false;
  videoJob = { status: 'creating', progress: 0, createdAt, prompt, generation };
  startPromptPrint('video', prompt);
  renderVideoJob();
  try {
    const created = await AgnesClient.createVideo({ mode, prompt, imageUrl: imageRef ? videoRefValue(imageRef) : '', keyframeUrls: keyframeRefs.map(videoRefValue), settings, signal: videoPollController.signal });
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
      addWork({
        kind: 'video',
        title: shortText(prompt, 38),
        prompt,
        url: videoJob.url,
        meta: `${videoJob.size || '--'} / ${videoJob.seconds || '--'} 秒`,
        generation: videoJob.generation || null,
        createdAt: videoJob.createdAt || Date.now()
      });
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
  const work = { id: createId('work'), ...record };
  const limit = getStoragePolicy().workRetention;
  const removed = [work, ...state.works].slice(limit);
  state.works = [work, ...state.works].slice(0, limit);
  removed.forEach((item) => {
    const objectUrl = workMediaObjectUrls.get(item.id);
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    workMediaObjectUrls.delete(item.id);
    workMediaRuntime.delete(item.id);
    storageRepository?.deleteCachedWorkMedia(item.id).catch(() => {});
  });
  saveState({ immediate: true });
  renderWorks();
  if (work.kind === 'image' && state.ui.storage.cacheImages) cacheWorkMedia(work, { silent: true });
}

function normalizeWorkGeneration(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const generation = {};
  WORK_GENERATION_FIELDS.forEach((key) => {
    const field = value[key];
    if (typeof field === 'string') generation[key] = field.slice(0, key === 'negativePrompt' ? 10000 : 1000);
    else if (typeof field === 'number' && Number.isFinite(field)) generation[key] = field;
    else if (typeof field === 'boolean') generation[key] = field;
  });
  return Object.keys(generation).length ? generation : null;
}

function createWorksBackupPayload() {
  const works = [...state.works]
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
    .map((work) => {
      const url = safeMediaUrl(work.url);
      if (!['image', 'video'].includes(work.kind) || !/^https?:/i.test(url)) return null;
      return {
        id: String(work.id || ''),
        kind: work.kind,
        title: String(work.title || ''),
        prompt: String(work.prompt || ''),
        url,
        meta: String(work.meta || ''),
        generation: normalizeWorkGeneration(work.generation),
        createdAt: Number.isFinite(Number(work.createdAt)) ? Number(work.createdAt) : null
      };
    })
    .filter(Boolean);
  return { format: WORKS_BACKUP_FORMAT, version: WORKS_BACKUP_VERSION, exportedAt: new Date().toISOString(), works };
}

function worksBackupFilename(date = new Date()) {
  const part = (value) => String(value).padStart(2, '0');
  return `agnes-works-${date.getFullYear()}${part(date.getMonth() + 1)}${part(date.getDate())}-${part(date.getHours())}${part(date.getMinutes())}${part(date.getSeconds())}.agnes-workbench.json`;
}

async function downloadWorksBackup() {
  const payload = createWorksBackupPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  try {
    await saveBlob(blob, worksBackupFilename());
    showToast(`作品备份已导出，共 ${payload.works.length} 条。`);
  } catch (error) {
    if (error.name !== 'AbortError') showToast('作品备份导出失败。', 'error');
  }
}

function normalizeImportedWork(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const kind = value.kind === 'image' || value.kind === 'video' ? value.kind : '';
  const url = safeMediaUrl(typeof value.url === 'string' ? value.url.trim() : '');
  if (!kind || !/^https?:/i.test(url)) return null;
  const createdAtValue = Number(value.createdAt);
  const title = String(value.title || '').trim();
  return {
    kind,
    title: (title || (kind === 'video' ? '导入视频作品' : '导入图像作品')).slice(0, 240),
    prompt: String(value.prompt || '').slice(0, 20000),
    url,
    meta: String(value.meta || '').trim().slice(0, 2000),
    generation: normalizeWorkGeneration(value.generation),
    createdAt: Number.isFinite(createdAtValue) && createdAtValue > 0 ? createdAtValue : Date.now()
  };
}

function importedWorkKey(work) {
  return `${work.kind}|${work.url}`;
}

function analyzeImportedWorks(records) {
  const unique = new Map();
  let internalDuplicates = 0;
  records.forEach((work) => {
    const key = importedWorkKey(work);
    const previous = unique.get(key);
    if (previous) internalDuplicates += 1;
    if (!previous || work.createdAt > previous.createdAt) unique.set(key, work);
  });
  const currentKeys = new Set(state.works.map((work) => {
    const url = safeMediaUrl(work.url);
    return url ? `${work.kind}|${url}` : '';
  }).filter(Boolean));
  const uniqueRecords = [...unique.values()].sort((a, b) => b.createdAt - a.createdAt);
  const currentDuplicates = uniqueRecords.filter((work) => currentKeys.has(importedWorkKey(work))).length;
  const candidates = uniqueRecords.filter((work) => !currentKeys.has(importedWorkKey(work)));
  const available = Math.max(0, getStoragePolicy().workRetention - state.works.length);
  const additions = candidates.slice(0, available);
  return {
    additions,
    internalDuplicates,
    currentDuplicates,
    truncated: Math.max(0, candidates.length - additions.length)
  };
}

async function parseWorksBackup(file) {
  if (!file) throw new Error('请选择作品备份文件。');
  if (!file.size) throw new Error('备份文件为空。');
  if (file.size > WORKS_IMPORT_MAX_BYTES) throw new Error('备份文件不能超过 5MB。');
  let payload;
  try {
    payload = JSON.parse(await file.text());
  } catch (error) {
    throw new Error('备份文件不是有效的 JSON。');
  }
  if (payload?.format !== WORKS_BACKUP_FORMAT) throw new Error('这不是 Agnes 作品备份文件。');
  if (!Number.isInteger(payload.version) || payload.version !== WORKS_BACKUP_VERSION) throw new Error(`暂不支持这个备份版本（当前支持版本 ${WORKS_BACKUP_VERSION}）。`);
  if (!Array.isArray(payload.works)) throw new Error('备份文件缺少作品列表。');
  const normalized = payload.works.map(normalizeImportedWork);
  const records = normalized.filter(Boolean);
  if (!records.length && payload.works.length) throw new Error('备份中没有可导入的有效作品。');
  const analysis = analyzeImportedWorks(records);
  return {
    fileName: file.name,
    exportedAt: typeof payload.exportedAt === 'string' && Number.isFinite(Date.parse(payload.exportedAt)) ? payload.exportedAt : '',
    total: payload.works.length,
    valid: records.length,
    invalid: payload.works.length - records.length,
    records,
    ...analysis
  };
}

function mergeImportedWorks(records) {
  const analysis = analyzeImportedWorks(records);
  const imported = analysis.additions.map((work) => ({ id: createId('work'), ...work }));
  if (imported.length) {
    state.works = [...state.works, ...imported].sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
    saveState({ immediate: true });
    renderWorks();
    if (state.ui.storage.cacheImages) cacheExistingWorkImages().catch(() => {});
  }
  return { imported: imported.length, truncated: analysis.truncated };
}

function showWorksImportPreview(summary, onConfirm) {
  $('#works-import-preview')?.remove();
  const returnFocus = $('#import-works');
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = 'works-import-preview';
  const exportedAt = summary.exportedAt ? formatFullDate(Date.parse(summary.exportedAt)) : '未提供';
  backdrop.innerHTML = `
    <section class="modal-panel works-import-panel" role="dialog" aria-modal="true" aria-labelledby="works-import-title">
      <div class="modal-topline">
        <span class="section-kicker"><span class="signal-line is-lime"></span> 作品恢复</span>
        <button class="icon-button small" type="button" data-works-import-action="close" aria-label="关闭导入预览" data-tooltip="关闭"><i data-lucide="x" aria-hidden="true"></i></button>
      </div>
      <h2 id="works-import-title">确认导入作品备份</h2>
      <div class="works-import-file"><i data-lucide="file-json" aria-hidden="true"></i><div><strong title="${escapeHtml(summary.fileName)}">${escapeHtml(summary.fileName)}</strong><small>导出时间：${escapeHtml(exportedAt)}</small></div></div>
      <div class="works-import-stats" aria-label="导入统计">
        <div><small>文件记录</small><strong>${summary.total}</strong></div>
        <div><small>有效记录</small><strong>${summary.valid}</strong></div>
        <div><small>无效记录</small><strong>${summary.invalid}</strong></div>
        <div><small>当前重复</small><strong>${summary.currentDuplicates}</strong></div>
        <div><small>实际新增</small><strong>${summary.additions.length}</strong></div>
        <div><small>超限截去</small><strong>${summary.truncated}</strong></div>
      </div>
      ${summary.internalDuplicates ? `<p class="works-import-note">文件内部发现 ${summary.internalDuplicates} 条重复记录，已保留创建时间较新的版本。</p>` : ''}
      <div class="modal-warning"><i data-lucide="triangle-alert" aria-hidden="true"></i><span>备份不包含图片或视频文件，媒体地址失效后无法通过该文件恢复媒体。</span></div>
      <div class="modal-actions"><button class="text-button" type="button" data-works-import-action="close"><i data-lucide="x" aria-hidden="true"></i>取消</button><button class="primary-action" type="button" data-works-import-action="confirm" ${summary.additions.length ? '' : 'disabled'}><i data-lucide="upload" aria-hidden="true"></i>确认导入</button></div>
    </section>`;
  document.body.appendChild(backdrop);
  refreshIcons();
  syncOverlayState();
  const panel = backdrop.querySelector('.works-import-panel');
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
    if (event.target === backdrop || event.target.closest('[data-works-import-action="close"]')) { close(); return; }
    if (!event.target.closest('[data-works-import-action="confirm"]')) return;
    close();
    onConfirm?.();
  });
  document.addEventListener('keydown', onKeys, true);
  window.requestAnimationFrame(() => backdrop.querySelector('[data-works-import-action="confirm"]:not([disabled]), [data-works-import-action="close"]')?.focus());
}

async function openWorksImport(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  try {
    const summary = await parseWorksBackup(file);
    showWorksImportPreview(summary, () => {
      const result = mergeImportedWorks(summary.records);
      if (!result.imported) { showToast('没有可新增的作品记录。', 'error'); return; }
      const suffix = result.truncated ? `，另有 ${result.truncated} 条因作品上限未导入` : '';
      showToast(`已导入 ${result.imported} 条作品${suffix}。`);
    });
  } catch (error) {
    showToast(error.message || '作品备份导入失败。', 'error');
  }
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
  const cachedCount = [...workMediaRuntime.values()].filter((item) => item.status === 'ready').length;
  const cacheLabel = $('#works-cache-summary');
  if (cacheLabel) cacheLabel.textContent = `${cachedCount} 个本地缓存`;
  $$('.filter-tab').forEach((button) => button.classList.toggle('is-active', button.dataset.workFilter === activeWorkFilter));
  if (!works.length) {
    $('#works-grid').innerHTML = '<div class="works-empty"><i data-lucide="archive" aria-hidden="true"></i><span>作品库还没有记录</span><small>完成一次图像或视频生成后，结果会出现在这里。</small></div>';
    refreshIcons();
    return;
  }
  $('#works-grid').innerHTML = works.map((work) => {
    const runtime = workMediaRuntime.get(work.id);
    const remoteUrl = safeMediaUrl(work.url);
    const url = runtime?.status === 'ready' ? runtime.url : remoteUrl;
    const isVideo = work.kind === 'video';
    const unavailable = runtime?.status === 'unavailable' || !remoteUrl;
    const media = !unavailable && url ? (isVideo ? `<video muted preload="metadata" src="${escapeHtml(url)}"></video>` : `<img src="${escapeHtml(url)}" alt="${escapeHtml(work.title)}">`) : '';
    const cacheStatus = runtime?.status === 'ready' ? '已缓存' : runtime?.status === 'loading' ? `缓存中${runtime.progress ? ` ${runtime.progress}%` : ''}` : runtime?.status === 'cache-failed' ? '缓存失败，使用远程地址' : unavailable ? '媒体不可用' : '远程地址';
    const cacheAction = runtime?.status === 'ready' ? 'clear-cache' : 'recache';
    const cacheLabelText = runtime?.status === 'ready' ? '清除缓存' : (isVideo ? '缓存视频' : '缓存图片');
    const fallback = unavailable ? `<div class="work-media-unavailable"><i data-lucide="image-off" aria-hidden="true"></i><strong>媒体地址失效</strong><small>${escapeHtml(runtime?.error || '无法加载远程媒体')}</small></div>` : '';
    return `<article class="work-card${unavailable ? ' is-media-failed' : ''}" data-work-id="${work.id}"><div class="work-card-media">${fallback || media}<span class="work-card-type"><i data-lucide="${isVideo ? 'clapperboard' : 'image'}" aria-hidden="true"></i>${isVideo ? '视频' : '图像'}</span></div><div class="work-card-body"><div class="work-card-title" title="${escapeHtml(work.title)}">${escapeHtml(work.title)}</div><div class="work-card-meta"><span>${escapeHtml(work.meta || '--')}</span><span data-work-cache-progress="${escapeHtml(work.id)}">${escapeHtml(cacheStatus)}</span></div><div class="work-card-actions"><button type="button" data-work-action="open" data-work-id="${work.id}"><i data-lucide="external-link" aria-hidden="true"></i>打开</button><button type="button" data-work-action="download" data-work-id="${work.id}"><i data-lucide="download" aria-hidden="true"></i>下载</button><button type="button" data-work-action="${cacheAction}" data-work-id="${work.id}"${runtime?.status === 'loading' ? ' disabled' : ''}><i data-lucide="${cacheAction === 'clear-cache' ? 'database-zap' : 'hard-drive-download'}" aria-hidden="true"></i>${runtime?.status === 'loading' ? '缓存中' : cacheLabelText}</button><button type="button" data-work-action="delete" data-work-id="${work.id}" aria-label="删除作品" data-tooltip="删除作品"><i data-lucide="trash-2" aria-hidden="true"></i></button></div></div></article>`;
  }).join('');
  prepareWorkMedia();
  refreshIcons();
}

function prepareWorkMedia() {
  $$('#works-grid .work-card-media img, #works-grid .work-card-media video').forEach((media) => {
    const showUnavailable = () => {
      const container = media.closest('.work-card-media');
      if (!container || container.querySelector('.work-media-unavailable')) return;
      const work = state.works.find((item) => item.id === media.closest('.work-card')?.dataset.workId);
      const runtime = work && workMediaRuntime.get(work.id);
      const remoteUrl = work && safeMediaUrl(work.url);
      if (work && runtime?.status === 'ready' && remoteUrl && media.src !== remoteUrl) {
        workMediaRuntime.set(work.id, { status: 'cache-failed', error: '本地缓存无法读取，已回退远程地址', record: runtime.record });
        media.addEventListener('error', showUnavailable, { once: true });
        media.src = remoteUrl;
        return;
      }
      if (work) workMediaRuntime.set(work.id, { status: 'unavailable', error: '远程媒体地址无法访问' });
      media.hidden = true;
      container.insertAdjacentHTML('afterbegin', '<div class="work-media-unavailable"><i data-lucide="image-off" aria-hidden="true"></i><strong>媒体地址失效</strong><small>可尝试重新缓存或打开原地址</small></div>');
      refreshIcons();
    };
    media.addEventListener('error', showUnavailable, { once: true });
    if (media instanceof HTMLImageElement && media.complete && !media.naturalWidth) showUnavailable();
  });
}

function formatStorageBytes(value) {
  const bytes = Math.max(0, Number(value || 0));
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(bytes < 10 * 1024 ** 2 ? 1 : 0)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

async function updateStorageStats({ announce = false } = {}) {
  const status = $('#storage-engine-status');
  if (!status) return;
  let repositoryStats = { sessions: state.chatSessions.length, messages: state.chatSessions.reduce((total, session) => total + session.messages.length, 0), attachments: 0, attachmentBytes: 0 };
  if (storageReady && storageRepository) {
    try { repositoryStats = await storageRepository.stats(); } catch (error) { reportStorageFailure(); }
  }
  let migrationMeta = null;
  if (storageReady && storageRepository) {
    try { migrationMeta = await storageRepository.getMeta('schema-migration'); } catch (error) { migrationMeta = null; }
  }
  const engineLabels = {
    checking: '正在检查',
    migrating: '正在迁移',
    ready: storageHealthReport && !storageHealthReport.ok ? '需要修复' : 'IndexedDB 已启用',
    unavailable: '存储不可用'
  };
  status.textContent = engineLabels[storageEngineState] || '存储不可用';
  status.classList.toggle('is-error', !storageReady || Boolean(storageHealthReport && !storageHealthReport.ok));
  $('#storage-record-count').textContent = `${repositoryStats.sessions} / ${repositoryStats.messages}`;
  $('#storage-attachment-count').textContent = `${repositoryStats.attachments} 个 / ${formatStorageBytes(repositoryStats.attachmentBytes)}`;
  $('#storage-work-media-count').textContent = `${repositoryStats.workMedia || 0} 个 / ${formatStorageBytes(repositoryStats.workMediaBytes || 0)}`;
  $('#storage-database-version').textContent = storageRepository
    ? `v${storageRepository.database.version} / ${migrationMeta?.completedAt ? formatFullDate(migrationMeta.completedAt) : '迁移时间未知'}`
    : '不可用';
  let usageLabel = '浏览器未提供估算';
  let percent = 0;
  if (navigator.storage?.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      const usage = Number(estimate.usage || 0);
      const quota = Number(estimate.quota || 0);
      percent = quota ? Math.min(100, usage / quota * 100) : 0;
      usageLabel = quota ? `${formatStorageBytes(usage)} / ${formatStorageBytes(quota)}` : formatStorageBytes(usage);
    } catch (error) {
      usageLabel = '浏览器未提供估算';
    }
  }
  $('#storage-usage').textContent = usageLabel;
  $('#storage-meter-fill').style.width = `${percent}%`;
  let persistedLabel = '持久存储状态未知';
  if (navigator.storage?.persisted) {
    try { persistedLabel = await navigator.storage.persisted() ? '已获得持久存储' : '尚未获得持久存储'; } catch (error) { persistedLabel = '持久存储状态未知'; }
  }
  $('#storage-persistence-status').textContent = persistedLabel;
  if (announce) showToast('存储统计已刷新。');
}

async function requestPersistentStorage() {
  if (!navigator.storage?.persist) { showToast('当前浏览器不支持持久存储申请。', 'error'); return; }
  try {
    const granted = await navigator.storage.persist();
    await updateStorageStats();
    showToast(granted ? '已申请浏览器持久存储。' : '浏览器未授予持久存储权限。', granted ? 'info' : 'error');
  } catch (error) {
    showToast('持久存储申请失败。', 'error');
  }
}

async function clearCachedMediaUi() {
  if (!storageReady || !storageRepository) { showToast('IndexedDB 当前不可用，无法清理缓存。', 'error'); return; }
  showConfirmModal({
    title: '清理失效作品缓存',
    message: '将删除已标记失败的作品媒体缓存，不会删除作品记录或远程地址。',
    confirmText: '确认清理',
    onConfirm: async () => {
      cancelAllWorkCacheJobs();
      const records = await storageRepository.clearCachedWorkMedia({ failedOnly: true });
      records.forEach((record) => { suppressWorkCache(record.workId); const objectUrl = workMediaObjectUrls.get(record.workId); if (objectUrl) URL.revokeObjectURL(objectUrl); workMediaObjectUrls.delete(record.workId); workMediaRuntime.delete(record.workId); });
      renderWorks();
      await updateStorageStats();
      showToast(records.length ? `已清理 ${records.length} 个失效缓存。` : '没有发现失效缓存。');
    }
  });
}

async function checkStorageHealthUi() {
  if (!storageReady || !storageRepository) { showToast('IndexedDB 当前不可用，无法检查。', 'error'); return; }
  try {
    storageHealthReport = await storageRepository.checkStorageHealth();
    const issues = storageHealthReport.issueCount;
    $('#repair-storage').disabled = issues === 0;
    const summary = $('#storage-health-summary');
    const structural = storageHealthReport.missingStores.length + Number(storageHealthReport.messageIndexMissing) + Number(storageHealthReport.schemaMismatch);
    summary.hidden = false;
    summary.classList.toggle('is-error', issues > 0);
    summary.innerHTML = issues
      ? `<strong>发现 ${issues} 项问题</strong><span>孤立消息 ${storageHealthReport.messageOrphans.length} · 缺失附件引用 ${storageHealthReport.missingBlobRefs.length} · 孤儿附件 ${storageHealthReport.blobOrphans.length} · 作品缓存 ${storageHealthReport.workMediaOrphans.length + storageHealthReport.workMediaMismatch.length} · 会话计数 ${storageHealthReport.sessionCountMismatch.length} · 数据库结构 ${structural}</span>`
      : '<strong>存储状态正常</strong><span>对象仓库、引用关系、作品缓存和会话计数均通过检查。</span>';
    await updateStorageStats();
    showToast(issues ? `发现 ${issues} 项存储问题，可点击“修复存储”。` : '存储检查通过，未发现问题。', issues ? 'error' : 'info');
  } catch (error) {
    showToast('存储健康检查失败。', 'error');
  }
}

async function repairStorageUi() {
  if (!storageReady || !storageRepository) return;
  showConfirmModal({
    title: '修复本地存储',
    message: '将删除孤立消息、孤儿附件和没有对应作品的媒体缓存，不会删除作品记录或 API 密钥。',
    confirmText: '确认修复',
    onConfirm: async () => {
      try {
        const result = await storageRepository.repairStorage();
        const removedRefs = new Set(result.removedBlobReferenceIds || []);
        if (removedRefs.size) {
          state.chatSessions.forEach((session) => {
            session.messages = session.messages.map((message) => Array.isArray(message.content)
              ? { ...message, content: message.content.filter((part) => !part?.image_url?.ref || !removedRefs.has(part.image_url.ref)) }
              : message);
            session.messageCount = session.messages.length;
          });
          if (chatImage?.blobRef && removedRefs.has(chatImage.blobRef)) chatImage = null;
          renderChatImagePreview();
          renderChat();
        }
        storageHealthReport = null;
        $('#repair-storage').disabled = true;
        await hydrateWorkMediaRuntime();
        renderWorks();
        await updateStorageStats();
        saveState({ immediate: true });
        const summary = $('#storage-health-summary');
        summary.hidden = false;
        summary.classList.remove('is-error');
        summary.innerHTML = `<strong>修复完成</strong><span>清理 ${result.removedMessages} 条孤立消息、${result.removedBlobReferences} 个失效附件引用、${result.removedBlobs} 个孤儿附件、${result.removedWorkMedia} 个作品缓存，修正 ${result.correctedSessions} 个会话计数，释放 ${formatStorageBytes(result.releasedBytes)}。</span>`;
        showToast(`存储修复完成，释放 ${formatStorageBytes(result.releasedBytes)}。`);
      } catch (error) { showToast('存储修复失败，请稍后重试。', 'error'); }
    }
  });
}

async function testApiConnection() {
  if (!apiKey) { showToast('请先配置 API 密钥。', 'error'); return; }
  const button = $('#test-api-connection');
  button.disabled = true;
  $('#settings-connection-status').textContent = '当前状态：测试中';
  try {
    await fetchAgnes('/v1/models', { method: 'GET' }, CONFIG.timeouts.poll);
    updateKeyStatus(true);
    showToast('连接测试成功。');
  } catch (error) {
    const authError = error.status === 401 || error.status === 403;
    if (!authError) connectionStatus = 'idle';
    updateKeyStatus(false, authError);
    $('#settings-connection-status').textContent = `当前状态：${error.status === 401 || error.status === 403 ? '认证失败' : '连接失败'}`;
    showToast(error.message || '连接测试失败。', 'error');
  } finally { button.disabled = false; }
}

async function cleanupStorageAttachments() {
  if (!storageReady || !storageRepository) {
    showToast('IndexedDB 当前不可用，无法清理附件。', 'error');
    return;
  }
  const button = $('#cleanup-storage');
  button.disabled = true;
  try {
    const result = await storageRepository.cleanupOrphanBlobs(runtimeBlobRefs());
    await updateStorageStats();
    showToast(result.removed ? `已清理 ${result.removed} 个孤儿附件，释放 ${formatStorageBytes(result.bytes)}。` : '没有发现孤儿附件。');
  } catch (error) {
    showToast('孤儿附件清理失败，请稍后重试。', 'error');
  } finally {
    button.disabled = false;
  }
}

function requestStorageAttachmentCleanup() {
  showConfirmModal({
    title: '清理孤儿附件',
    message: '将删除没有任何聊天消息引用的 IndexedDB 附件，不会删除会话、消息或作品记录。',
    confirmText: '确认清理',
    onConfirm: cleanupStorageAttachments
  });
}

function requestHistoryCompaction() {
  const policy = getStoragePolicy();
  const sortedSessions = [...state.chatSessions].sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
  const keepIds = new Set(sortedSessions.slice(0, policy.sessionRetention).map((session) => session.id));
  if (state.activeChatId) keepIds.add(state.activeChatId);
  const removableSessions = state.chatSessions.filter((session) => !keepIds.has(session.id));
  const removableWorks = Math.max(0, state.works.length - policy.workRetention);
  if (!removableSessions.length && !removableWorks) {
    showToast(`历史已在当前范围内：最多 ${policy.sessionRetention} 个最近会话和 ${policy.workRetention} 条作品。`);
    return;
  }
  showConfirmModal({
    title: '压缩本地历史',
    message: `将保留当前会话、最近 ${policy.sessionRetention} 个会话和最近 ${policy.workRetention} 条作品。本次会删除 ${removableSessions.length} 个较早会话${removableWorks ? `及 ${removableWorks} 条较早作品` : ''}，随后清理无引用附件。`,
    confirmText: '确认压缩',
    onConfirm: () => compactHistory(removableSessions.map((session) => session.id))
  });
}

async function compactHistory(sessionIds) {
  const policy = getStoragePolicy();
  const removeSet = new Set(sessionIds);
  state.chatSessions = state.chatSessions.filter((session) => !removeSet.has(session.id));
  const sortedWorks = [...state.works].sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  const removedWorks = sortedWorks.slice(policy.workRetention);
  state.works = sortedWorks.slice(0, policy.workRetention);
  if (!state.chatSessions.some((session) => session.id === state.activeChatId)) state.activeChatId = state.chatSessions[0]?.id || null;
  if (storageReady && storageRepository) {
    try {
      for (const sessionId of sessionIds) await storageRepository.deleteSession(sessionId);
      for (const work of removedWorks) await storageRepository.deleteCachedWorkMedia(work.id);
      await storageRepository.cleanupOrphanBlobs(runtimeBlobRefs());
    } catch (error) {
      showToast('部分 IndexedDB 历史未能清理，请重试。', 'error');
    }
  }
  ensureChatSession();
  removedWorks.forEach((work) => {
    const objectUrl = workMediaObjectUrls.get(work.id);
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    workMediaObjectUrls.delete(work.id);
    workMediaRuntime.delete(work.id);
  });
  saveState({ immediate: true });
  renderChat();
  renderWorks();
  await updateStorageStats();
  showToast(`历史压缩完成，已移除 ${sessionIds.length} 个较早会话。`);
}

function clearWorks() {
  if (!state.works.length) { showToast('作品库已经为空。'); return; }
  const previousWorks = state.works;
  state.works = [];
  previousWorks.forEach((work) => { const objectUrl = workMediaObjectUrls.get(work.id); if (objectUrl) URL.revokeObjectURL(objectUrl); storageRepository?.deleteCachedWorkMedia(work.id).catch(() => {}); });
  workMediaObjectUrls.clear();
  workMediaRuntime.clear();
  saveState({ immediate: true });
  renderWorks();
  showToast('作品记录已清除。');
}

function handleWorkAction(event) {
  const mediaArea = event.target.closest('.work-card-media');
  if (mediaArea) {
    const filtered = state.works.filter((work) => activeWorkFilter === 'all' || work.kind === activeWorkFilter);
    const work = filtered.find((item) => item.id === mediaArea.closest('.work-card')?.dataset.workId);
    if (!work) return;
    const items = filtered.map(previewItemFromWork);
    if (!items.length) return;
    const index = Math.max(0, items.findIndex((item) => item.workId === work.id));
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
        const objectUrl = workMediaObjectUrls.get(work.id);
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        workMediaObjectUrls.delete(work.id);
        workMediaRuntime.delete(work.id);
        storageRepository?.deleteCachedWorkMedia(work.id).catch(() => {});
        saveState({ immediate: true });
        renderWorks();
      }
    });
    return;
  }
  if (button.dataset.workAction === 'open') window.open(work.url, '_blank', 'noopener,noreferrer');
  if (button.dataset.workAction === 'download') downloadAsset(workMediaRuntime.get(work.id)?.url || work.url, `${work.kind === 'video' ? 'agnes-video' : 'agnes-image'}-${work.id}`, work.kind);
  if (button.dataset.workAction === 'cache' || button.dataset.workAction === 'recache') cacheWorkMedia(work, { force: true });
  if (button.dataset.workAction === 'clear-cache') {
    showConfirmModal({
      title: '清除作品本地缓存',
      message: '只会删除本地媒体副本，作品记录和远程地址会继续保留。',
      confirmText: '确认清除',
      onConfirm: async () => {
        cancelWorkCacheJob(work.id);
        suppressWorkCache(work.id);
        await storageRepository?.deleteCachedWorkMedia(work.id);
        const objectUrl = workMediaObjectUrls.get(work.id);
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        workMediaObjectUrls.delete(work.id);
        workMediaRuntime.delete(work.id);
        renderWorks();
        updateStorageStats();
      }
    });
  }
}

$('#video-result')?.addEventListener('click', (event) => {
  if (event.target.closest('[data-print-action]')) { handlePrintAction(event); return; }
  const button = event.target.closest('[data-video-action]');
  if (button && videoJob?.url) {
    if (button.dataset.videoAction === 'preview') {
      openMediaPreview({
        items: [{
          url: safeMediaUrl(videoJob.url),
          title: 'Agnes 生成视频',
          meta: `${videoJob.size || ''} / ${videoJob.seconds || ''} 秒`.replace(/^\/\s*/, ''),
          kind: 'video',
          prompt: videoJob.prompt || '',
          generation: videoJob.generation || null,
          createdAt: videoJob.createdAt || null
        }],
        returnFocus: button
      });
    }
    if (button.dataset.videoAction === 'copy') copyText(videoJob.url);
    if (button.dataset.videoAction === 'download') downloadAsset(videoJob.url, 'agnes-video.mp4', 'video');
    return;
  }
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
      if (error.name === 'AbortError') throw error;
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
