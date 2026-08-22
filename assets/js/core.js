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
      image: 'assets/prompt-examples/img/chinese-wedding-invitation.jpg',
      alt: '柔和编辑感的新娘肖像与婚礼请柬海报',
      prompt: '创作一张具有柔和编辑感新娘肖像美学的精致奢华中式婚礼请柬海报。新人姓名：${Lin Zhao & Shen Zhiyi}。婚礼日期：${2026 年 5 月 20 日}。誓言短句：${我愿意，和你一起成为我们}。婚礼地点：${杭州 · 白塔公园}。仪式时间：${18:00}。新娘形象：${棕发柔和盘起、佩戴花朵珍珠耳饰、露肩并穿白色缎面礼服的新娘}。可见标题：${WEDDING DAY}。仪式文字：${宜｜嫁娶}。花束：${粉紫色花束}。配色：${雾感浅灰、象牙白、粉紫与白色}。采用方形构图与优雅留白，背景使用所选配色，并带细微胶片颗粒薄雾。将所选新娘放在右侧三分之一处，裁切为从额头到下颌的侧脸。左侧与中央留给排版，左下加入虚化深灰前景阴影，右下加入柔焦的所选花束。准确使用七组白色文字：所选日期的大写英文格式；所选誓言短句；所选可见标题；同一所选日期的数字格式；所选仪式文字；所选新人姓名；所选婚礼地点与仪式时间。使用高级浪漫纸品、电影柔焦、明亮自然窗光、低反差、奶油白、暖肤色、细腻散景和克制奢华。避免边框、额外 Logo、水印和多余文字。'
    }]
  }
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

let loadedStateHadMessages = false;
let state = null;
let apiKey = '';
let connectionStatus = 'idle';
let connectionDraft = { endpoint: 'international', customBaseUrl: '' };
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
      chat: { temperature: 0.7, maxTokens: 2048, thinking: false, autoFullscreen: true, renderMarkdown: true },
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
