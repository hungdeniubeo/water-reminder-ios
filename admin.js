import { PUSH_API_URL } from './push-config.js';
import { HOME_COPIES } from './water-notes.js?v=20261120-home-copy-v1';

const COMPACT_NOTIFICATION = {
  title: 'Water ♡',
  body: 'Beo ơi, nhớ uống nước nha em ♡'
};

let lastTemplateIndex = -1;
function randomManualTemplate() {
  // Manual templates vary without affecting custom typed messages or schedule settings.
  const count = HOME_COPIES.length;
  const jump = 1 + Math.floor(Math.random() * (count - 1));
  lastTemplateIndex = lastTemplateIndex < 0 ? Math.floor(Math.random() * count) : (lastTemplateIndex + jump) % count;
  const sample = HOME_COPIES[lastTemplateIndex];
  return { title: sample.title.toLocaleUpperCase('vi-VN'), body: sample.body };
}

export function messageState(message) {
  if (message.openedAt || message.status === 'opened') return { label: 'Đã mở', tone: 'opened' };
  if (message.receivedAt || message.status === 'received') return { label: 'iPhone đã nhận', tone: 'received' };
  if (message.status === 'failed') return { label: message.retryAt ? 'Sẽ thử lại' : 'Gửi chưa được', tone: 'failed' };
  if (message.acceptedAt || message.status === 'accepted') return { label: 'Đã chuyển đi', tone: 'accepted' };
  return { label: 'Đang gửi', tone: 'pending' };
}


export function startAdmin() {
const SESSION_KEY = 'water-admin-session-v2';
const $ = id => document.getElementById(id);
const apiBase = PUSH_API_URL.replace(/\/$/, '');
let token = '';
try { token = sessionStorage.getItem(SESSION_KEY) || ''; } catch {}
let current = null;
let settingsDirty = false;
let draftLoaded = false;
let sendBusy = false;
let pendingSend = null;
let pairingCode = '';
let pairingExpiry = 0;
let refreshBusy = false;


function feedback(id, text = '', tone = '') {
  $(id).textContent = text;
  $(id).dataset.tone = tone;
}
function rememberSession(value) {
  token = value;
  try { if (value) sessionStorage.setItem(SESSION_KEY, value); else sessionStorage.removeItem(SESSION_KEY); } catch {}
}
function lockDashboard() {
  rememberSession('');
  current = null;
  $('dashboard').hidden = true;
  $('logout').hidden = true;
  $('login-panel').hidden = false;
  $('pair-result').hidden = true;
  $('message-history').replaceChildren();
  pairingCode = '';
  pairingExpiry = 0;
  pendingSend = null;
  draftLoaded = false;
  settingsDirty = false;
  $('send-form').reset();
  $('settings-form').reset();
}
function explainError(error) {
  if (error.status === 401) return 'Phiên quản trị đã hết hạn. Đăng nhập lại để tiếp tục.';
  if (error.status === 429) return 'Quá nhiều thao tác liên tiếp. Đợi một lát rồi thử lại.';
  if (error.status === 503) return 'Máy chủ chưa sẵn sàng. Kiểm tra cập nhật và cấu hình máy chủ.';
  if (error.name === 'AbortError' || error.name === 'TimeoutError') return 'Kết nối đang chậm. Có thể thử gửi lại cùng nội dung mà không tạo thông báo trùng.';
  if (!error.status) return 'Chưa kết nối được máy chủ. Kiểm tra mạng rồi thử lại.';
  return error.message || 'Thao tác chưa hoàn tất. Thử lại sau.';
}
async function api(path, {method = 'GET', data, authenticated = true} = {}) {
  const sentToken = token;
  const headers = {};
  if (data !== undefined) headers['Content-Type'] = 'application/json';
  if (authenticated && token) headers.Authorization = 'Bearer ' + token;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  let response;
  try { response = await fetch(apiBase + path, {method, headers, body: data === undefined ? undefined : JSON.stringify(data), cache: 'no-store', credentials: 'omit', signal: controller.signal}); }
  finally { clearTimeout(timeout); }
  let result;
  try { result = await response.json(); } catch { result = {}; }
  if (!response.ok) {
    const error = new Error(result.error || 'Máy chủ trả về lỗi ' + response.status);
    error.status = response.status;
    if (response.status === 401 && authenticated && token === sentToken) {
      lockDashboard();
      feedback('login-status', 'Phiên quản trị đã hết hạn. Đăng nhập lại để tiếp tục.', 'error');
    }
    throw error;
  }
  return result;
}
function dateLabel(seconds) {
  if (!seconds) return '';
  const date = new Date(seconds * 1000);
  try { return new Intl.DateTimeFormat('vi-VN', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: current?.settings?.timezone || 'Asia/Ho_Chi_Minh'}).format(date); }
  catch { return date.toLocaleString('vi-VN'); }
}
function renderHistory(messages) {
  const fragment = document.createDocumentFragment();
  if (!messages.length) {
    const item = document.createElement('li');
    item.className = 'empty-history';
    item.textContent = 'Chưa có thông báo nào.';
    fragment.append(item);
  }
  for (const message of messages.slice(0, 12)) {
    const item = document.createElement('li'); item.className = 'message-item';
    const row = document.createElement('div'); row.className = 'message-row';
    const title = document.createElement('strong'); title.textContent = message.title;
    const state = messageState(message);
    const badge = document.createElement('span'); badge.className = 'message-state ' + state.tone; badge.textContent = state.label;
    row.append(title, badge);
    const body = document.createElement('p'); body.textContent = message.body;
    const time = document.createElement('time');
    if (message.createdAt) time.dateTime = new Date(message.createdAt * 1000).toISOString();
    time.textContent = (message.source === 'scheduled' ? 'Theo lịch · ' : 'Gửi trực tiếp · ') + dateLabel(message.createdAt);
    item.append(row, body, time);
    if (message.error && state.tone === 'failed') {
      const detail = document.createElement('p'); detail.className = 'message-error'; detail.textContent = message.error; item.append(detail);
    }
    fragment.append(item);
  }
  $('message-history').replaceChildren(fragment);
}
function syncSendButton() {
  const canSend = !!(token && current?.device?.pushEnabled && current?.service?.ready !== false);
  $('send-button').disabled = !canSend || sendBusy;
  $('send-button').textContent = sendBusy ? 'Đang gửi…' : 'Gửi thông báo ↗';
  if ($('use-send-template')) $('use-send-template').disabled = sendBusy;
}
function fillSettings(settings) {
  const form = $('settings-form');
  for (const [name, value] of Object.entries(settings)) {
    const field = form.elements.namedItem(name);
    if (!field) continue;
    if (field.type === 'checkbox') field.checked = !!value;
    else field.value = value ?? '';
  }
}
function renderState(state) {
  current = state;
  const {settings, device} = state;
  $('heading-name').textContent = settings.recipientName;
  $('device-name').textContent = settings.recipientName;
  $('connection-dot').classList.toggle('connected', !!device.pushEnabled);
  const connected = device.pushEnabled;
  $('connection-title').textContent = connected ? 'iPhone đã bật nhận thông báo' : device.paired ? 'iPhone đã kết nối, cần bật thông báo' : 'Chưa kết nối iPhone';
  $('connection-detail').textContent = connected ? 'Sẵn sàng gửi ngay hoặc gửi theo lịch.' : device.paired ? 'Mở app từ màn hình chính iPhone và chạm Bật thông báo.' : 'Tạo mã bên dưới để kết nối iPhone nhận thông báo.';
  $('device-status').textContent = connected ? 'Một iPhone đã đăng ký nhận thông báo.' : device.paired ? 'Đã ghép một iPhone. Chưa bật nhận thông báo.' : 'Chưa có iPhone nào được ghép với app.';
  $('pair-button').textContent = device.paired ? 'Kết nối iPhone khác' : 'Tạo mã kết nối';
  if (!settingsDirty) fillSettings(settings);
  if (!draftLoaded) {
    const isShippedDefault = (settings.notificationTitle === 'Water ♡' &&
      ['Beo ơi, nhớ nhấp một chút nước nha em ♡', 'Beo ơi, nhớ uống nước nha em ♡'].includes(settings.reminderMessage)) ||
      (settings.notificationTitle === 'Beo ơi 💧' && settings.reminderMessage === 'Đến giờ uống nước rồi nè em.');
    const draft = isShippedDefault ? randomManualTemplate() : { title: settings.notificationTitle, body: settings.reminderMessage };
    $('send-title').value = draft.title;
    $('send-body').value = draft.body;
    draftLoaded = true;
    renderPreview();
  }
  renderHistory(state.messages || []);
  syncSendButton();
}
async function refreshState({silent = false} = {}) {
  if (!token || refreshBusy) return;
  const refreshingToken = token;
  refreshBusy = true;
  try {
    const result = await api('/api/admin/state');
    if (!token || token !== refreshingToken) return;
    renderState(result);
    $('login-panel').hidden = true;
    $('dashboard').hidden = false;
    $('logout').hidden = false;
    if (!silent) feedback('global-status');
  } catch (error) {
    if (!silent) feedback(token ? 'global-status' : 'login-status', explainError(error), 'error');
    if (!current && token) feedback('login-status', explainError(error), 'error');
  } finally { refreshBusy = false; }
}
function renderPreview() {
  $('preview-title').textContent = $('send-title').value.trim() || COMPACT_NOTIFICATION.title;
  $('preview-body').textContent = $('send-body').value || COMPACT_NOTIFICATION.body;
  $('send-count').textContent = $('send-body').value.length + ' / 150';
}
function draftChanged() {
  pendingSend = null;
  renderPreview();
  feedback('send-status');
}
$('use-send-template')?.addEventListener('click', () => {
  const draft = randomManualTemplate();
  $('send-title').value = draft.title;
  $('send-body').value = draft.body;
  draftChanged();
});
$('use-reminder-template')?.addEventListener('click', () => {
  $('reminder-title').value = COMPACT_NOTIFICATION.title;
  $('reminder-body').value = COMPACT_NOTIFICATION.body;
  settingsDirty = true;
  feedback('settings-status', 'Đã điền mẫu. Chọn Lưu thay đổi để áp dụng.');
});
async function checkService() {
  $('login-button').disabled = true;
  $('login-button').textContent = 'Đang kiểm tra kết nối…';
  $('upgrade-note').hidden = true;
  feedback('login-status');
  try {
    const config = await api('/api/config', {authenticated:false});
    if (config.apiVersion !== 2) {
      $('upgrade-note').hidden = false;
      $('login-button').textContent = 'Cần cập nhật máy chủ';
      return;
    }
    if (!config.ready) feedback('login-status', 'Máy chủ chưa sẵn sàng gửi thông báo. Đăng nhập để kiểm tra cấu hình.', 'error');
    $('login-button').textContent = 'Vào trang quản trị';
    $('login-button').disabled = false;
    if (token) await refreshState();
  } catch (error) {
    feedback('login-status', explainError(error), 'error');
    $('upgrade-note').hidden = false;
    $('login-button').textContent = 'Chưa kết nối được';
  }
}

$('login-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!$('login-form').reportValidity()) return;
  $('login-button').disabled = true;
  $('login-button').textContent = 'Đang đăng nhập…';
  feedback('login-status');
  try {
    const result = await api('/api/admin/login', {method:'POST', data:{code:$('admin-code').value}, authenticated:false});
    if (typeof result.token !== 'string' || !result.token) throw new Error('Phiên đăng nhập không hợp lệ');
    rememberSession(result.token);
    $('admin-code').value = '';
    await refreshState();
  } catch (error) { feedback('login-status', error.status === 403 || error.status === 401 ? 'Mã quản trị chưa đúng. Kiểm tra lại mã.' : explainError(error), 'error'); }
  finally { $('login-button').disabled = false; $('login-button').textContent = 'Vào trang quản trị'; }
});
$('logout').addEventListener('click', async () => {
  $('logout').disabled = true;
  try { await api('/api/admin/logout', {method:'POST', data:{}}); }
  catch { /* Clear this browser's credential even if the network is unavailable. */ }
  finally { lockDashboard(); $('logout').disabled = false; feedback('login-status', 'Đã đăng xuất trên trình duyệt này.'); }
});
$('send-title').addEventListener('input', draftChanged);
$('send-body').addEventListener('input', draftChanged);
$('send-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (sendBusy || !current?.device?.pushEnabled || !$('send-form').reportValidity()) return;
  const title = $('send-title').value.trim();
  const body = $('send-body').value.trim();
  if (!title || !body) { feedback('send-status', 'Nhập tiêu đề và nội dung thông báo.', 'error'); return; }
  if (!pendingSend || pendingSend.title !== title || pendingSend.body !== body) pendingSend = {title, body, requestId:crypto.randomUUID()};
  sendBusy = true; syncSendButton(); feedback('send-status');
  try {
    const result = await api('/api/admin/send', {method:'POST', data:pendingSend});
    const state = messageState(result.message || {});
    if (state.tone === 'failed') feedback('send-status', result.message?.error || 'Thông báo chưa gửi được. Xem trạng thái bên dưới.', 'error');
    else if (state.tone === 'pending') feedback('send-status', 'Thông báo đang chờ gửi. Theo dõi trạng thái trong Lịch sử gửi.');
    else feedback('send-status', state.tone === 'received' || state.tone === 'opened' ? state.label : 'Đã chuyển tới dịch vụ thông báo. Đang chờ phản hồi từ iPhone.', 'success');
    // Keep the same request ID while the server is retrying or still sending.
    if (state.tone !== 'pending' && !result.message?.retryAt) pendingSend = null;
    await refreshState({silent:true});
  } catch (error) { feedback('send-status', explainError(error), 'error'); }
  finally { sendBusy = false; syncSendButton(); }
});
$('settings-form').addEventListener('input', () => { settingsDirty = true; feedback('settings-status'); });
$('settings-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = $('settings-form');
  if (!form.reportValidity()) return;
  const data = Object.fromEntries(new FormData(form));
  data.enabled = $('schedule-enabled').checked;
  data.interval = Number(data.interval);
  if (data.start >= data.end) { feedback('settings-status', 'Giờ kết thúc cần muộn hơn giờ bắt đầu trong cùng ngày.', 'error'); return; }
  $('save-settings').disabled = true;
  try {
    await api('/api/admin/settings', {method:'POST',data});
    settingsDirty = false;
    feedback('settings-status', 'Đã lưu thay đổi.', 'success');
    await refreshState({silent:true});
  } catch (error) { feedback('settings-status', explainError(error), 'error'); }
  finally { $('save-settings').disabled = false; }
});
$('pair-button').addEventListener('click', async () => {
  const replace = !!current?.device?.paired;
  if (replace && !window.confirm('Chỉ một iPhone được nhận thông báo. Khi mã mới được nhập thành công, iPhone cũ sẽ được ngắt kết nối. Tạo mã mới?')) return;
  $('pair-button').disabled = true;
  feedback('pair-status');
  try {
    const result = await api('/api/admin/pairing', {method:'POST',data:{replace}});
    pairingCode = result.code;
    pairingExpiry = result.expiresAt;
    $('pair-code').textContent = pairingCode.slice(0,4) + ' ' + pairingCode.slice(4);
    $('pair-expiry').textContent = 'Hết hạn lúc ' + dateLabel(pairingExpiry) + ' · Chỉ dùng một lần';
    $('pair-result').hidden = false;
    feedback('pair-status', 'Nhập mã kết nối này trong app trên iPhone cần nhận thông báo.');
  } catch (error) { feedback('pair-status', explainError(error), 'error'); }
  finally { $('pair-button').disabled = false; }
});
$('copy-code').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(pairingCode); feedback('pair-status', 'Đã sao chép mã kết nối.', 'success'); }
  catch { feedback('pair-status', 'Chọn và sao chép mã phía trên.'); }
});
$('refresh').addEventListener('click', () => refreshState());
$('retry-service').addEventListener('click', checkService);
document.addEventListener('visibilitychange', () => { if (!document.hidden && token) refreshState({silent:true}); });
setInterval(() => {
  if (!document.hidden && token) refreshState({silent:true});
  if (pairingExpiry && Date.now() >= pairingExpiry * 1000) {
    $('pair-expiry').textContent = 'Mã đã hết hạn. Tạo mã mới để kết nối.';
    pairingExpiry = 0;
    pairingCode = '';
    $('pair-code').textContent = '···· ····';
  }
}, 15000);
renderPreview();
checkService();

return { refreshState, checkService };
}

if (typeof document !== 'undefined' && document.getElementById('login-panel')) startAdmin();
