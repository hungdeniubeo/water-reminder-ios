import { PUSH_API_URL } from './push-config.js';
import { attachClassicPinkButton } from './classic-pink-button.js?v=20261120-50-notes';
import { createWaterNotePicker } from './water-notes.js';

export const SESSION_KEY = 'water-beo-device-session-v1';
const VIEW_KEY = 'water-beo-view-v2';
export const DEFAULT_PROFILE = Object.freeze({
  recipientName: 'Beo', appTitle: 'Water',
  homeMessage: 'Nhắc uống nước mỗi ngày.'
});

// Update only the exact defaults shipped in earlier versions. Personal text stays as entered.
const LEGACY_HOME_DEFAULTS = new Set([
  'Một chút nước, một chút thương.\nAnh luôn nhớ em ♡',
  'Một chút nước, một chút thương. Anh luôn nhớ em ♡',
  'Anh gửi em một chút dịu dàng. Nhớ uống nước đều nhé ♡'
]);
export function normalizeReceiverProfile(profile = {}) {
  const result = { ...DEFAULT_PROFILE, ...profile };
  if (result.appTitle === 'Water ♡') result.appTitle = DEFAULT_PROFILE.appTitle;
  if (LEGACY_HOME_DEFAULTS.has(result.homeMessage)) result.homeMessage = DEFAULT_PROFILE.homeMessage;
  return result;
}

export function readDeviceSession(storage) {
  try {
    const value = JSON.parse((storage ?? globalThis.localStorage).getItem(SESSION_KEY) || 'null');
    return value && typeof value.id === 'string' && typeof value.secret === 'string' ? value : null;
  } catch { return null; }
}

export function decodeVapidPublicKey(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid push key');
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
  if (bytes.length !== 65 || bytes[0] !== 4) throw new Error('Invalid push key');
  return bytes;
}

export function receiverScreen({ online = true, ios = false, standalone = true, supported = true,
  loading = false, config, failed = false, session, permission = 'default', registration,
  subscription, serverPushEnabled = false, verified = false }) {
  if (!online) return 'offline';
  if (ios && !standalone) return 'install';
  if (!supported) return 'unsupported';
  if (loading) return 'loading';
  if (config && (config.apiVersion !== 2 || !config.ready)) return 'server-pending';
  if (failed || !config || !registration) return 'error';
  if (!session) return 'pair';
  if (permission === 'denied') return 'denied';
  if (permission === 'granted' && subscription && serverPushEnabled && verified) return 'ready';
  return 'enable';
}

export function createReceiverClient({ baseUrl = PUSH_API_URL, fetchImpl = globalThis.fetch, storage } = {}) {
  return async (path, { method = 'GET', payload, authenticate = true } = {}) => {
    const headers = { Accept: 'application/json' };
    if (payload !== undefined) headers['Content-Type'] = 'application/json';
    const session = authenticate ? readDeviceSession(storage) : null;
    if (session) headers.Authorization = `Bearer ${session.id}.${session.secret}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetchImpl(baseUrl.replace(/\/$/, '') + path, {
        method, headers, cache: 'no-store', mode: 'cors', signal: controller.signal,
        body: payload === undefined ? undefined : JSON.stringify(payload)
      });
      let data = {};
      try { data = await response.json(); } catch { /* A failed proxy may return HTML. */ }
      if (!response.ok) {
        const error = new Error(data.error || 'Connection failed');
        error.status = response.status;
        throw error;
      }
      return data;
    } finally { clearTimeout(timer); }
  };
}

export function startReceiver() {
  const $ = id => document.getElementById(id);
  const client = createReceiverClient();
  const pickWaterNote = createWaterNotePicker();
  let currentWaterNote = pickWaterNote();
  const permission = () => typeof Notification === 'undefined' ? 'unavailable' : Notification.permission;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const state = { profile: { ...DEFAULT_PROFILE }, latestMessage: null, session: readDeviceSession(),
    config: null, registration: null, subscription: null, serverPushEnabled: false, verified: false,
    failed: false, loading: true, busy: '', feedback: '', refreshing: false, refreshAgain: false };
  let selectedMessage = null;
  let requestedMessageId = new URL(location.href).searchParams.get('message');
  if (requestedMessageId && !/^[A-Za-z0-9_-]{1,100}$/.test(requestedMessageId)) requestedMessageId = null;

  try {
    const cached = JSON.parse(localStorage.getItem(VIEW_KEY) || 'null');
    if (cached?.profile && state.session) state.profile = normalizeReceiverProfile(cached.profile);
    if (cached?.latestMessage && state.session) state.latestMessage = cached.latestMessage;
  } catch { /* The app still works without an offline copy. */ }

  function cacheView() {
    try { localStorage.setItem(VIEW_KEY, JSON.stringify({ profile: state.profile, latestMessage: state.latestMessage })); }
    catch { /* Do not report a successful subscription as failed due to cache quota. */ }
  }
  function forgetExpiredSession() {
    state.session = null;
    state.latestMessage = null;
    state.profile = { ...DEFAULT_PROFILE };
    try { localStorage.removeItem(SESSION_KEY); localStorage.removeItem(VIEW_KEY); } catch { /* private mode */ }
  }
  function currentScreen() {
    return receiverScreen({ online: navigator.onLine, ios, standalone: standalone(), supported,
      loading: state.loading, config: state.config, failed: state.failed, session: state.session,
      permission: permission(), registration: state.registration, subscription: state.subscription,
      serverPushEnabled: state.serverPushEnabled, verified: state.verified });
  }
  function renderLetter() {
    const message = selectedMessage || state.latestMessage;
    $('letter-title').textContent = message?.title || 'Thông báo';
    $('letter-body').textContent = message?.body || 'Chưa có thông báo. Thông báo mới nhất sẽ hiện ở đây.';
    const rawTime = message?.createdAt;
    const date = rawTime ? new Date(typeof rawTime === 'number' && rawTime < 1e12 ? rawTime * 1000 : rawTime) : null;
    const validTime = date && Number.isFinite(date.getTime());
    $('letter-time').hidden = !validTime;
    $('letter-time').textContent = validTime ? new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    }).format(date) : '';
  }
  function openLetter(message = null) {
    selectedMessage = message;
    renderLetter();
    if (!$('letter-dialog').open) $('letter-dialog').showModal();
  }
  function render() {
    const screen = currentScreen();
    const labels = { loading: 'Đang kết nối', ready: 'Đã bật thông báo', offline: 'Đang ngoại tuyến',
      install: 'Thêm vào iPhone', unsupported: 'Chưa hỗ trợ', 'server-pending': 'Chờ kết nối',
      error: 'Chưa kết nối', pair: 'Chưa kết nối', denied: 'Thông báo đang tắt', enable: 'Chưa bật thông báo' };
    $('app-title').textContent = state.profile.appTitle;
    $('greeting').textContent = state.profile.recipientName;
    $('home-message').textContent = state.profile.homeMessage;
    document.title = `${state.profile.appTitle} — ${state.profile.recipientName}`;
    $('connection-label').textContent = labels[screen];
    $('connection-state').dataset.state = screen;
    $('quiet-note').textContent = screen === 'ready'
      ? currentWaterNote : 'Bật thông báo để nhận lời nhắc.';
    const showSetup = !['ready', 'loading'].includes(screen);
    $('setup-panel').hidden = !showSetup;
    document.body.dataset.setup = String(showSetup);
    $('pair-form').hidden = screen !== 'pair';
    $('enable-button').hidden = screen !== 'enable';
    $('enable-button').disabled = !!state.busy || !state.registration || !state.config?.vapidPublicKey;
    $('enable-button').textContent = state.busy === 'enable' ? 'Đang bật thông báo…' : 'Bật thông báo';
    $('pair-button').disabled = !!state.busy;
    $('pair-code').disabled = !!state.busy;
    $('pair-button').textContent = state.busy === 'pair' ? 'Đang kết nối…' : 'Kết nối';
    $('refresh-button').hidden = !['offline', 'denied', 'error', 'server-pending', 'unsupported', 'install'].includes(screen);
    $('refresh-button').disabled = !!state.busy;
    const copy = {
      offline: ['Không có kết nối mạng', 'Kết nối mạng để cập nhật lời nhắc. Chạm thông báo từ iPhone để xem nội dung.'],
      install: ['Thêm vào màn hình chính', 'Trong Safari, chọn Chia sẻ → Thêm vào MH chính. Sau đó mở app từ biểu tượng mới để bật thông báo.'],
      unsupported: ['Trình duyệt chưa hỗ trợ', 'Trên iPhone, cần iOS 16.4 trở lên. Thêm app vào màn hình chính rồi mở lại từ biểu tượng Water.'],
      'server-pending': ['Hệ thống chưa sẵn sàng', 'Hệ thống thông báo cần được cập nhật. Thử kiểm tra lại sau.'],
      error: ['Chưa kết nối được', 'Không thể kết nối với hệ thống thông báo. Kiểm tra mạng rồi thử lại.'],
      pair: ['Kết nối thiết bị', 'Nhập mã từ trang quản trị để nhận thông báo trên iPhone này.'],
      denied: ['Thông báo đang tắt', `Vào Cài đặt iPhone → Thông báo → ${state.profile.appTitle}, bật Cho phép thông báo rồi quay lại app.`],
      enable: ['Bật thông báo', 'Nhận thông báo ngay cả khi app đóng. Chọn Cho phép khi iPhone hỏi quyền thông báo.']
    }[screen];
    if (copy) { $('setup-title').textContent = copy[0]; $('setup-copy').textContent = copy[1]; }
    $('action-feedback').textContent = state.feedback;
    $('action-feedback').hidden = !state.feedback;
    renderLetter();
  }

  async function prepareWorker() {
    if (!supported) return null;
    if (state.registration?.active) return state.registration;
    await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
    let timer;
    try {
      return await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Worker unavailable')), 12000); })
      ]);
    } finally { clearTimeout(timer); }
  }

  async function openRequestedMessage() {
    if (!requestedMessageId || !state.session) return;
    const id = requestedMessageId;
    let message = state.latestMessage?.id === id ? state.latestMessage : null;
    if (!message) {
      try {
        const result = await client(`/api/device/messages/${encodeURIComponent(id)}`);
        if (result.message?.id === id) message = result.message;
      } catch { /* A removed message must not open a different, newer message. */ }
    }
    if (requestedMessageId === id) requestedMessageId = null;
    const url = new URL(location.href);
    url.searchParams.delete('message');
    history.replaceState({}, '', url);
    if (message) openLetter(message);
  }

  async function refresh() {
    if (state.refreshing || state.busy) { state.refreshAgain = true; return; }
    state.refreshAgain = false;
    state.refreshing = true;
    state.failed = false;
    state.loading = true;
    state.verified = false;
    render();
    try {
      if (!navigator.onLine) return;
      const [configResult, workerResult] = await Promise.allSettled([
        client('/api/config', { authenticate: false }), prepareWorker()
      ]);
      if (configResult.status === 'fulfilled') state.config = configResult.value;
      else { state.config = null; state.failed = true; }
      if (workerResult.status === 'fulfilled') state.registration = workerResult.value;
      else state.failed = true;
      if (state.config?.apiVersion !== 2 || !state.config.ready || !state.session || (ios && !standalone())) return;
      const device = await client('/api/device/me');
      if (device.profile) state.profile = normalizeReceiverProfile(device.profile);
      state.latestMessage = device.latestMessage || null;
      state.serverPushEnabled = !!device.pushEnabled;
      cacheView();
      if (state.registration) state.subscription = await state.registration.pushManager.getSubscription();
      if (permission() === 'granted' && state.subscription) {
        await client('/api/device/subscribe', { method: 'POST', payload: { subscription: state.subscription.toJSON() } });
        state.serverPushEnabled = true;
        state.verified = true;
      } else if (state.registration && state.serverPushEnabled) {
        // The server must not advertise an iPhone subscription that no longer exists locally.
        await client('/api/device/unsubscribe', { method: 'POST', payload: {} });
        state.serverPushEnabled = false;
      }
      await openRequestedMessage();
    } catch (error) {
      if (error.status === 401) { forgetExpiredSession(); state.feedback = 'Kết nối đã hết hiệu lực. Nhập mã mới từ trang quản trị.'; }
      else state.failed = true;
    } finally {
      state.loading = false; state.refreshing = false; render();
      if (state.refreshAgain) { state.refreshAgain = false; queueMicrotask(refresh); }
    }
  }

  $('pair-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (state.busy) return;
    const code = $('pair-code').value.replace(/\s/g, '');
    if (!/^\d{8}$/.test(code)) { state.feedback = 'Nhập đủ 8 chữ số của mã kết nối.'; render(); return; }
    try {
      // Check storage before consuming a one-time code.
      localStorage.setItem('water-beo-storage-check', '1');
      localStorage.removeItem('water-beo-storage-check');
    } catch { state.feedback = 'Trình duyệt không thể lưu kết nối. Mở app ở chế độ thường rồi thử lại.'; render(); return; }
    state.busy = 'pair'; state.feedback = ''; render();
    try {
      const result = await client('/api/pair', { method: 'POST', payload: { code }, authenticate: false });
      if (!result.device?.id || !result.device?.secret) throw new Error('Pairing unavailable');
      localStorage.setItem(SESSION_KEY, JSON.stringify(result.device));
      state.session = result.device;
      $('pair-code').value = '';
    } catch (error) {
      state.feedback = error.status === 429
        ? 'Đã thử quá nhiều lần. Chờ vài phút rồi nhập lại.'
        : error.status && error.status < 500
          ? 'Mã không đúng hoặc đã hết hạn. Tạo mã mới trong trang quản trị.'
          : 'Chưa kết nối được. Kiểm tra mạng rồi thử lại.';
    } finally { state.busy = ''; render(); }
    if (state.session) { await refresh(); if (currentScreen() === 'enable') $('enable-button').focus(); }
  });

  $('enable-button').addEventListener('click', () => {
    if (state.busy || currentScreen() !== 'enable' || !state.registration || !state.config?.vapidPublicKey) return;
    let permissionRequest;
    // Keep this in the original click stack. No config fetch or worker await before consent.
    try { permissionRequest = Notification.requestPermission(); }
    catch { state.feedback = 'Mở app từ màn hình chính rồi thử bật thông báo lại.'; render(); return; }
    state.busy = 'enable'; state.feedback = ''; render();
    Promise.resolve(permissionRequest).then(async consent => {
      if (consent !== 'granted') {
        state.feedback = consent === 'denied' ? '' : 'Chưa cấp quyền thông báo. Có thể bật lại tại đây.';
        return;
      }
      const subscription = state.subscription || await state.registration.pushManager.subscribe({
        userVisibleOnly: true, applicationServerKey: decodeVapidPublicKey(state.config.vapidPublicKey)
      });
      await client('/api/device/subscribe', { method: 'POST', payload: { subscription: subscription.toJSON() } });
      state.subscription = subscription;
      state.serverPushEnabled = true;
      state.verified = true;
      state.failed = false;
    }).catch(error => {
      if (error.status === 401) forgetExpiredSession();
      state.feedback = 'Chưa bật được thông báo. Kiểm tra mạng rồi thử lại.';
    }).finally(() => {
      state.busy = ''; render();
      if (state.refreshAgain || requestedMessageId) refresh();
    });
  });

  attachClassicPinkButton($('letter-button'), () => {
    if (currentScreen() !== 'ready') return;
    currentWaterNote = pickWaterNote();
    const note = $('quiet-note');
    note.textContent = currentWaterNote;
    // A tiny text transition, independent of the splash animation.
    if (typeof note.animate === 'function' && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      note.animate([{opacity: .55, transform: 'translateY(3px)'}, {opacity: 1, transform: 'translateY(0)'}],
        {duration: 190, easing: 'ease-out'});
    }
  });
  // The droplet changes only this local line, never sends a push or opens a popup.
  $('close-letter').addEventListener('click', () => $('letter-dialog').close());
  $('letter-done').addEventListener('click', () => $('letter-dialog').close());
  $('letter-dialog').addEventListener('click', event => {
    if (event.target !== $('letter-dialog')) return;
    const rect = $('letter-dialog').getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) $('letter-dialog').close();
  });
  $('refresh-button').addEventListener('click', () => { state.feedback = ''; refresh(); });
  window.addEventListener('online', () => refresh());
  window.addEventListener('offline', () => render());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
  navigator.serviceWorker?.addEventListener('message', event => {
    if (event.data?.type === 'NOTIFICATION_OPENED' && event.data?.id) requestedMessageId = event.data.id;
    refresh();
  });
  render();
  refresh();
  return { refresh, state };
}

if (typeof document !== 'undefined' && document.getElementById('letter-button')) startReceiver();
