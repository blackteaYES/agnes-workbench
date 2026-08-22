'use strict';

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
  const markdownHint = $('#chat-markdown-hint');
  if (markdownHint) {
    const markdownOn = state.ui.chat.renderMarkdown !== false;
    markdownHint.classList.toggle('is-on', markdownOn);
    markdownHint.setAttribute('aria-checked', String(markdownOn));
    $('#chat-markdown-hint-text').textContent = `Markdown：${markdownOn ? '开' : '关'}`;
    const markdownToggle = $('#chat-render-markdown');
    if (markdownToggle) markdownToggle.checked = markdownOn;
  }
}

function toggleChatThinkingFromHint() {
  state.ui.chat.thinking = !state.ui.chat.thinking;
  saveState();
  renderChat();
}

function toggleChatMarkdownFromHint() {
  state.ui.chat.renderMarkdown = !(state.ui.chat.renderMarkdown !== false);
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
  $$('.md-image-media', container).forEach((image) => {
    const showError = () => {
      const holder = image.closest('.md-image');
      if (!holder) return;
      holder.classList.add('is-error');
      image.hidden = true;
      const error = $('.md-image-error', holder);
      if (error) error.hidden = false;
      refreshIcons();
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
    const assistantText = text || (!isStreaming ? 'Agnes 没有返回文本内容。' : '');
    const assistantHtml = state.ui.chat.renderMarkdown ? renderMarkdownText(assistantText) : escapeHtml(assistantText);
    const userHtml = state.ui.chat.renderMarkdown ? renderMarkdownText(text) : escapeHtml(text);
    const answer = user
      ? `<div class="message-content${state.ui.chat.renderMarkdown ? ' md-rendered' : ''}">${image}${userHtml}</div>`
      : `${thinking}<div class="message-content${isStreaming ? ' is-streaming' : ''}${state.ui.chat.renderMarkdown ? ' md-rendered' : ''}" data-answer-content>${assistantHtml}</div>`;
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

  const messageText = message.content || (!message.streaming ? 'Agnes 没有返回文本内容。' : '');
  if (state.ui.chat.renderMarkdown) {
    answer.classList.add('md-rendered');
    // 打字机约 26ms 一拍，Markdown 重排节流到约 240ms，流式结束后补一次完整渲染
    const now = Date.now();
    const lastRender = Number(answer.dataset.mdRenderedAt || 0);
    if (!message.streaming || now - lastRender >= 240) {
      if (message.streaming) answer.dataset.mdRenderedAt = String(now);
      answer.innerHTML = renderMarkdownText(messageText);
      prepareChatMessageImages(answer);
    }
  } else {
    answer.classList.remove('md-rendered');
    delete answer.dataset.mdRenderedAt;
    answer.textContent = messageText;
  }
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
  const mdCopyButton = event.target.closest('.md-image-copy');
  if (mdCopyButton) {
    copyTextToClipboard(mdCopyButton.dataset.mdCopy || '').then((copied) => {
      showToast(copied ? '已复制图片 Markdown 语法。' : '复制失败，请重试。', copied ? 'info' : 'error');
    });
    return;
  }
  const mdPreview = event.target.closest('.md-image-preview');
  if (mdPreview && !mdPreview.closest('.md-image')?.classList.contains('is-error')) {
    const url = safeMediaUrl(mdPreview.dataset.mdImage);
    if (url) {
      openMediaPreview({
        items: [{ url, title: 'Markdown 图片', meta: '对话插图', kind: 'image' }],
        returnFocus: mdPreview
      });
    }
    return;
  }
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
