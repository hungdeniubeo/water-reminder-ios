import { PUSH_API_URL } from './push-config.js';
import { previewScheduleTimes, upcomingReminders } from './admin-features.js?v=20261125-flexible-v1';
import { setupRoutinesAdmin } from './routines-admin.js?v=20261125-flexible-v1';
import { setupTimePickers } from './time-picker.js?v=20261125-flexible-v1';
import { HOME_COPIES } from './water-notes.js?v=20261122-daily-v3';

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
let copyMode = 'auto';
let fixedDraft = { title: '', body: '' };
let routinesUI = null;
let activeRoutines = [];
const timePickers = setupTimePickers();


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
  $('mobile-nav').hidden = true;
  activeRoutines = [];
  $('logout').hidden = true;
  $('login-panel').hidden = false;
  $('pair-result').hidden = true;
  $('message-history').replaceChildren();
  pairingCode = '';
  pairingExpiry = 0;
  pendingSend = null;
  draftLoaded = false;
  settingsDirty = false;
  $('settings-dirty-indicator').hidden = true;
  routinesUI?.reset();
  $('send-form').reset();
  $('settings-form').reset();
  $('routine-overview-text').textContent = 'Chưa tải lịch';
  $('overview-timeline').replaceChildren();
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
  for (const message of messages.slice(0, 5)) {
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
    else if (name === 'appTitle' && (value === 'Water' || value === 'Water ♡')) field.value = 'Beo Daily';
    else if (name === 'homeMessage' && value === 'Nhắc uống nước mỗi ngày.') field.value = 'Nhắc Beo mỗi ngày.';
    else field.value = value ?? '';
  }
}
function renderAgenda() {
  if (!current?.settings) return;
  const settings = current.settings;
  const active = activeRoutines.filter(item => item.enabled).length + (settings.enabled ? 1 : 0);
  $('overview-label').textContent = active
    ? `${active} lịch đang bật · thời gian dự kiến, theo múi giờ đã chọn`
    : 'Chưa có lịch nào đang bật.';
  const events = upcomingReminders(settings, activeRoutines, new Date(), 3);
  const fragment = document.createDocumentFragment();
  if (!events.length) {
    const item = document.createElement('li');
    item.className = 'upcoming-empty';
    item.textContent = 'Bật một lịch nhắc để xem những lần nhắc tiếp theo.';
    fragment.append(item);
  }
  for (const event of events) {
    const item = document.createElement('li'); item.className = 'upcoming-item';
    const dot = document.createElement('span'); dot.className = 'upcoming-dot'; dot.setAttribute?.('aria-hidden','true');
    const content = document.createElement('div'); content.className = 'upcoming-content';
    const time = document.createElement('span'); time.className = 'upcoming-time'; time.textContent = event.when;
    const title = document.createElement('strong'); title.className = 'upcoming-title'; title.textContent = event.title;
    content.append(time,title); item.append(dot,content); fragment.append(item);
  }
  $('overview-timeline').replaceChildren(fragment);
}
function renderWaterSummary(settings) {
  $('water-status').textContent = settings.enabled ? 'Đang bật' : 'Đang tắt';
  $('water-status').classList.toggle('is-on',!!settings.enabled);
  $('water-frequency').textContent = `${settings.start}–${settings.end} · mỗi ${settings.interval} phút`;
}
function renderHeroDate(settings) {
  try {
    $('hero-date').textContent = new Intl.DateTimeFormat('vi-VN',{
      timeZone:settings.timezone,day:'2-digit',month:'2-digit',year:'numeric'
    }).format(new Date());
  } catch { $('hero-date').textContent = ''; }
}
function renderState(state) {
  current = state;
  const {settings, device} = state;
  renderHeroDate(settings);
  renderWaterSummary(settings);
  routinesUI?.setLegacySettings(settings);
  renderAgenda();
  $('heading-name').textContent = settings.recipientName;
  $('device-name').textContent = settings.recipientName;
  $('connection-dot').classList.toggle('connected', !!device.pushEnabled);
  const connected = device.pushEnabled;
  $('connection-title').textContent = connected ? 'iPhone đã bật nhận thông báo' : device.paired ? 'iPhone đã kết nối, cần bật thông báo' : 'Chưa kết nối iPhone';
  $('connection-detail').textContent = connected ? 'Sẵn sàng gửi ngay hoặc gửi theo lịch.' : device.paired ? 'Mở app từ màn hình chính iPhone và chạm Bật thông báo.' : 'Tạo mã bên dưới để kết nối iPhone nhận thông báo.';
  $('device-status').textContent = connected ? 'Một iPhone đã đăng ký nhận thông báo.' : device.paired ? 'Đã ghép một iPhone. Chưa bật nhận thông báo.' : 'Chưa có iPhone nào được ghép với app.';
  $('pair-button').textContent = device.paired ? 'Kết nối iPhone khác' : 'Tạo mã kết nối';
  if (!settingsDirty) { fillSettings(settings); timePickers.sync(); }
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
  if (!settingsDirty) {
    copyMode = isAutomaticCopy(settings) ? 'auto' : 'fixed';
    $('reminder-mode').value = copyMode;
    $('custom-copy-fields').hidden = copyMode !== 'fixed';
    if (copyMode === 'fixed') fixedDraft = {title:settings.notificationTitle,body:settings.reminderMessage};
  }
  updateSchedulePreview();
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
    $('mobile-nav').hidden = false;
    $('logout').hidden = false;
    await routinesUI?.ensureLoaded();
    if (token===refreshingToken && !silent) feedback('global-status');
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
const isAutomaticCopy = settings =>
  (settings.notificationTitle === 'Water ♡' && [
    'Beo ơi, nhớ nhấp một chút nước nha em ♡', 'Beo ơi, nhớ uống nước nha em ♡'
  ].includes(settings.reminderMessage)) ||
  (settings.notificationTitle === 'Beo ơi 💧' && settings.reminderMessage === 'Đến giờ uống nước rồi nè em.');

function updateSchedulePreview() {
  const times = previewScheduleTimes($('schedule-start').value, $('schedule-end').value, $('schedule-interval').value);
  const box = $('schedule-preview');
  if (!times.length) box.textContent = 'Chọn giờ hợp lệ và nhập từ 5 đến 720 phút.';
  else {
    box.textContent = times.length + ' lần/ngày · ' + times.slice(0,4).join(' · ') +
      (times.length > 4 ? ' …' : '');
  }
  box.classList.toggle('warning',times.length>40);
  if (times.length>40) box.textContent += ' (hơi nhiều thông báo)';
  for (const button of (document.querySelectorAll?.('[data-interval]') || [])) {
    button.classList.toggle('selected', Number(button.dataset.interval) === Number($('schedule-interval').value));
  }
}
$('reminder-mode').addEventListener('change', () => {
  const next = $('reminder-mode').value;
  if (copyMode === 'fixed') fixedDraft={title:$('reminder-title').value,body:$('reminder-body').value};
  copyMode = next === 'fixed' ? 'fixed' : 'auto';
  if (copyMode === 'fixed') {
    $('reminder-title').value = fixedDraft.title || 'Nhắc Beo uống nước ♡';
    $('reminder-body').value = fixedDraft.body || 'Nhớ uống nước đầy đủ nha em ♡';
  }
  $('custom-copy-fields').hidden = copyMode !== 'fixed';
  settingsDirty = true;
  $('settings-dirty-indicator').hidden = false;
  feedback('settings-status');
});
$('use-home-auto').addEventListener('click', () => {
  $('home-message').value = 'Nhắc Beo mỗi ngày.';
  settingsDirty = true;
  $('settings-dirty-indicator').hidden = false;
  feedback('settings-status','Đã chọn lời chào tự đổi. Nhấn Lưu lịch lặp để áp dụng.');
});
for (const button of (document.querySelectorAll?.('[data-interval]') || [])) {
  button.addEventListener('click', () => {
    $('schedule-interval').value = button.dataset.interval;
    settingsDirty = true;
    $('settings-dirty-indicator').hidden = false;
    updateSchedulePreview();
    feedback('settings-status');
  });
}
for (const id of ['schedule-start','schedule-end','schedule-interval']) {
  $(id).addEventListener('input',updateSchedulePreview);
  $(id).addEventListener('change',updateSchedulePreview);
}
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
$('settings-form').addEventListener('input', () => { settingsDirty = true; $('settings-dirty-indicator').hidden = false; feedback('settings-status'); });
$('settings-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = $('settings-form');
  if (!form.reportValidity()) return;
  const data = Object.fromEntries(new FormData(form));
  data.enabled = $('schedule-enabled').checked;
  data.interval = Number(data.interval);
  if (!Number.isInteger(data.interval) || data.interval < 5 || data.interval > 720) {
    feedback('settings-status', 'Nhập số phút nguyên từ 5 đến 720.', 'error'); return;
  }
  if (copyMode === 'auto') {
    data.notificationTitle = COMPACT_NOTIFICATION.title;
    data.reminderMessage = COMPACT_NOTIFICATION.body;
  } else {
    data.notificationTitle = String(data.notificationTitle || '').trim();
    data.reminderMessage = String(data.reminderMessage || '').trim();
    if (!data.notificationTitle || !data.reminderMessage || isAutomaticCopy(data)) {
      feedback('settings-status','Nhập một lời nhắc riêng khác mẫu tự đổi.','error'); return;
    }
  }
  if (data.start >= data.end) { feedback('settings-status', 'Giờ kết thúc cần muộn hơn giờ bắt đầu trong cùng ngày.', 'error'); return; }
  $('save-settings').disabled = true;
  try {
    await api('/api/admin/settings', {method:'POST',data});
    settingsDirty = false;
    $('settings-dirty-indicator').hidden = true;
    feedback('settings-status', 'Đã lưu thay đổi.', 'success');
    await refreshState({silent:true});
    renderWaterSummary(data);
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
  if (current) renderAgenda();
  if (pairingExpiry && Date.now() >= pairingExpiry * 1000) {
    $('pair-expiry').textContent = 'Mã đã hết hạn. Tạo mã mới để kết nối.';
    pairingExpiry = 0;
    pairingCode = '';
    $('pair-code').textContent = '···· ····';
  }
}, 15000);
routinesUI = setupRoutinesAdmin({$,api,
  onFormOpen:() => timePickers.sync(),
  today:()=>new Intl.DateTimeFormat('en-CA',{timeZone:current?.settings?.timezone||'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),
  onLegacyEdit:()=>{const section=$('schedule-section');section.open=true;section.scrollIntoView?.({behavior:'smooth',block:'start'});},
  onLegacyToggle:async enabled=>{
    if(settingsDirty||$('save-settings').disabled) throw new Error('Lưu cài đặt lịch lặp đang chỉnh trước khi bật/tắt.');
    if(!current?.settings) throw new Error('Chưa tải cài đặt lịch lặp.');
    const savingToken=token;$('save-settings').disabled=true;
    try{
      const state=await api('/api/admin/state');
      if(!token||token!==savingToken)return;
      const result=await api('/api/admin/settings',{method:'POST',data:{...state.settings,enabled}});
      if(current&&token===savingToken) renderState({...current,settings:result.settings});
    }finally{$('save-settings').disabled=false;}
  },
  onChange:reminders => { activeRoutines = reminders; renderAgenda(); }
});
for (const id of ['hero-add','mobile-add']) {
  $(id).addEventListener('click', () => routinesUI?.openNew());
}
updateSchedulePreview();
renderPreview();
checkService();

return { refreshState, checkService };
}

if (typeof document !== 'undefined' && document.getElementById('login-panel')) startAdmin();
