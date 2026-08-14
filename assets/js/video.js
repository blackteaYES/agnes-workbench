'use strict';

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
