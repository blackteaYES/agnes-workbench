'use strict';

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
