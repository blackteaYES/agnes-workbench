'use strict';

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
