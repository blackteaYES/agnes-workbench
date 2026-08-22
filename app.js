'use strict';

async function init() {
  state = loadState();
  apiKey = readStoredKey();
  connectionDraft = { endpoint: state.connection.endpoint, customBaseUrl: state.connection.customBaseUrl || '' };
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
  $('#chat-markdown-hint').addEventListener('click', toggleChatMarkdownFromHint);
  $('#chat-auto-fullscreen').addEventListener('change', (event) => { state.ui.chat.autoFullscreen = event.target.checked; saveState(); });
  $('#chat-render-markdown').addEventListener('change', (event) => { state.ui.chat.renderMarkdown = event.target.checked; saveState(); renderChat(); });
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
  $('#chat-render-markdown').checked = state.ui.chat.renderMarkdown !== false;
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

document.addEventListener('DOMContentLoaded', init);
