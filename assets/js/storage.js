'use strict';

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
