'use strict';

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
