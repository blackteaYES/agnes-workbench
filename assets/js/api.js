
'use strict';

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
