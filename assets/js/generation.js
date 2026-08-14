'use strict';

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
  let value = null;
  if (window.location.protocol !== 'file:') {
    try {
      const response = await fetch(`config/prompt-examples.json?v=2.24.0`, { cache: 'no-store' });
      if (!response.ok) throw new Error('案例配置加载失败');
      value = await response.json();
    } catch (error) {
      value = null;
    }
  }
  const generated = window.AG_PROMPT_EXAMPLES;
  promptExamples = Array.isArray(value?.textToImage?.examples)
    ? value
    : Array.isArray(generated?.textToImage?.examples)
      ? generated
      : PROMPT_EXAMPLES_FALLBACK;
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
