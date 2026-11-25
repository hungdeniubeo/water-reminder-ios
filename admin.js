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
let phoneMode='live', phoneTracked=null, phoneLatest=null, phoneSyncFailed=false;
let lastManualId=null,lastManualRequestId=null,pollTick=0;
let pairingCode = '';
let pairingExpiry = 0;
let refreshBusy = false;
let copyMode = 'auto';
let fixedDraft = { title: '', body: '' };
let routinesUI = null;
let activeRoutines = [];
let systemData=null,systemBusy=false,systemGeneration=0;
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
  resetSystem();
  pairingCode = '';
  pairingExpiry = 0;
  pendingSend = null;
  sendBusy=false;phoneTracked=null;phoneLatest=null;phoneSyncFailed=false;lastManualId=null;lastManualRequestId=null;pollTick=0;
  phoneMode='live';
  draftLoaded = false;
  settingsDirty = false;
  $('settings-dirty-indicator').hidden = true;
  routinesUI?.reset();
  $('send-form').reset();
  renderPreview();renderPhone();feedback('send-status');
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
  syncPhoneHistory(state.messages || []);
  renderPhone();
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
    phoneSyncFailed=false;
    renderState(result);
    $('login-panel').hidden = true;
    $('dashboard').hidden = false;
    $('mobile-nav').hidden = false;
    $('logout').hidden = false;
    await routinesUI?.ensureLoaded();
    if (token===refreshingToken && !silent) feedback('global-status');
  } catch (error) {
    if(token===refreshingToken){phoneSyncFailed=true;renderPhone();}
    if (!silent) feedback(token ? 'global-status' : 'login-status', explainError(error), 'error');
    if (!current && token) feedback('login-status', explainError(error), 'error');
  } finally { refreshBusy = false; }
}
// Keep the mock screen separate from the typed draft and use actual delivery receipts.
function phoneStatus(message) {
  if(!message) return {tone:'pending',label:'Chưa có thông báo',detail:'Tin gửi trực tiếp và theo lịch sẽ hiện ở đây.'};
  if(message.localPhase==='sending') return {tone:'pending',label:'Đang gửi',detail:'Đang gửi yêu cầu tới máy chủ. Chưa xác nhận iPhone nhận.'};
  if(message.localPhase==='unknown') return {tone:'unknown',label:'Chưa rõ kết quả gửi',detail:'Mất phản hồi từ máy chủ. Có thể thử gửi lại cùng nội dung mà không tạo tin trùng.'};
  if(message.localPhase==='rejected') return {tone:'failed',label:'Chưa gửi được',detail:message.error||'Máy chủ từ chối yêu cầu gửi.'};
  const state=messageState(message);
  if(state.tone==='opened') return {...state,detail:'iPhone đã báo mở thông báo.'};
  if(state.tone==='received') return {...state,detail:'iPhone đã gửi biên nhận hiển thị thông báo.'};
  if(state.tone==='accepted') return {...state,label:'Đã chuyển đi · chờ iPhone',detail:'Dịch vụ push đã chấp nhận; chưa có biên nhận từ iPhone.'};
  if(state.tone==='failed') return {...state,detail:message.error||'Máy chủ chưa xác nhận gửi thành công.'};
  return {...state,detail:'Máy chủ đang xử lý yêu cầu gửi.'};
}
function mergePhoneReceipt(previous,next) {
  if(!next || next.id!==previous?.id) return previous;
  // A late snapshot may be older than the receipt we already observed.
  const receivedAt=next.receivedAt||previous.receivedAt;
  const openedAt=next.openedAt||previous.openedAt;
  if(openedAt||previous.status==='opened'||next.status==='opened') return {...next,receivedAt,openedAt,status:'opened'};
  if(receivedAt||previous.status==='received'||next.status==='received') return {...next,receivedAt,status:'received'};
  return next;
}
function sendFeedback(message) {
  const state=messageState(message||{});
  if(state.tone==='failed') feedback('send-status',message?.error||'Thông báo chưa gửi được. Xem trạng thái bên dưới.','error');
  else if(state.tone==='pending') feedback('send-status','Thông báo đang chờ gửi. Theo dõi trạng thái trên khung iPhone.');
  else feedback('send-status',state.tone==='received'||state.tone==='opened'?state.label:'Đã chuyển tới dịch vụ thông báo. Đang chờ phản hồi từ iPhone.','success');
}
function syncPhoneHistory(messages) {
  const newest=messages[0]||null;
  if(newest) {
    if(phoneLatest?.id===newest.id) phoneLatest=mergePhoneReceipt(phoneLatest,newest);
    else if(!phoneLatest||newest.createdAt>=phoneLatest.createdAt) phoneLatest=newest;
  } else if(!phoneTracked?.id) phoneLatest=null;
  if(phoneTracked?.id) {
    phoneTracked=mergePhoneReceipt(phoneTracked,messages.find(m=>m.id===phoneTracked.id));
    const state=messageState(phoneTracked);
    if(newest&&newest.id!==phoneTracked.id&&newest.createdAt>=phoneTracked.createdAt&&
       (['received','opened'].includes(messageState(newest).tone)||
        ['received','opened'].includes(state.tone)||(state.tone==='failed'&&!phoneTracked.retryAt))) phoneTracked=null;
  }
  if(lastManualId) {
    const message=messages.find(m=>m.id===lastManualId);
    if(message&&!sendBusy){
      const state=messageState(message);
      sendFeedback(message);
      if(state.tone!=='pending'&&!message.retryAt&&pendingSend?.requestId===lastManualRequestId) pendingSend=null;
    }
  }
}
function setPhoneMode(mode) {
  phoneMode=mode;renderPhone();
}
function phoneText(id,value) {
  const node=$(id);if(node.textContent!==value)node.textContent=value;
}
function renderPhoneClock() {
  try {
    const now=new Date(),timeZone=current?.settings?.timezone||'Asia/Ho_Chi_Minh';
    phoneText('phone-clock',new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone}).format(now));
    phoneText('phone-date',new Intl.DateTimeFormat('vi-VN',{weekday:'long',day:'numeric',month:'long',timeZone}).format(now));
  } catch {}
}
function renderPhone() {
  const draft=phoneMode==='draft';
  $('phone-draft-tab').setAttribute('aria-pressed',String(draft));
  $('phone-live-tab').setAttribute('aria-pressed',String(!draft));
  $('phone-draft-panel').hidden=!draft;$('phone-live-panel').hidden=draft;
  const connected=!!current?.device?.pushEnabled;
  $('phone-connection').dataset.connected=String(connected);
  phoneText('phone-connection',connected?'Đã bật push':current?.device?.paired?'Chưa bật push':'Chưa kết nối');
  const message=phoneTracked||phoneLatest;
  const state=phoneStatus(message);
  $('phone-live-notification').hidden=!message;
  $('phone-live-empty').hidden=!!message;
  $('phone-live-notification').dataset.tone=state.tone;
  if(message) {
    phoneText('phone-live-title',message.title);
    phoneText('phone-live-body',message.body);
    phoneText('phone-live-time',message.receivedAt?dateLabel(message.receivedAt):state.tone==='opened'||state.tone==='received'?'Đã nhận':'Chờ xác nhận');
    phoneText('phone-live-card-state',state.label);
    phoneText('phone-screen-caption',(message.source==='scheduled'?'THEO LỊCH':'GỬI TRỰC TIẾP')+' · '+(['received','opened'].includes(state.tone)?'ĐÃ XÁC NHẬN':'CHƯA XÁC NHẬN'));
  }else{
    phoneText('phone-live-title','');phoneText('phone-live-body','');phoneText('phone-live-card-state','');
    phoneText('phone-screen-caption','THÔNG BÁO GẦN NHẤT');
  }
  $('phone-delivery').dataset.tone=draft?'draft':state.tone;
  phoneText('phone-delivery-title',draft?'Đang xem trước · chưa gửi':state.label);
  phoneText('phone-delivery-detail',draft?'Nội dung đổi ngay khi mày gõ. Bấm Gửi thông báo để gửi thật.':state.detail);
  phoneText('phone-sync-note',phoneSyncFailed?'Mất kết nối máy chủ · đang hiển thị dữ liệu gần nhất.':draft?'Bản nháp không gửi tới iPhone.':current?'Kiểm tra biên nhận mỗi 3 giây khi mở trang.':'Đang kết nối máy chủ…');
  renderPhoneClock();
}
function renderPreview() {
  $('preview-title').textContent = $('send-title').value.trim() || COMPACT_NOTIFICATION.title;
  $('preview-body').textContent = $('send-body').value || COMPACT_NOTIFICATION.body;
  $('send-count').textContent = $('send-body').value.length + ' / 150';
}
function draftChanged() {
  pendingSend = null;lastManualId=null;lastManualRequestId=null;
  renderPreview();setPhoneMode('draft');
  feedback('send-status');
}
$('phone-draft-tab').addEventListener('click',()=>{renderPreview();setPhoneMode('draft');});
$('phone-preview-link').addEventListener('click',()=>{renderPreview();setPhoneMode('draft');});
$('phone-live-tab').addEventListener('click',()=>{
  // Explicitly returning to live shows the latest stored message, not an unknown local attempt.
  if(!sendBusy) phoneTracked=null;
  setPhoneMode('live');
  if(token)refreshState({silent:true});
});
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
  const submitted=pendingSend,sendingToken=token;
  sendBusy = true; syncSendButton(); feedback('send-status');
  phoneTracked={title,body,source:'manual',localPhase:'sending'};
  lastManualId=null;lastManualRequestId=null;
  setPhoneMode('live');
  try {
    const result = await api('/api/admin/send', {method:'POST', data:submitted});
    if(!token||token!==sendingToken)return;
    if(!result.message?.id)throw new Error('Máy chủ chưa trả về mã thông báo.');
    const message=result.message;
    phoneTracked=message;
    if(!phoneLatest||message.createdAt>=phoneLatest.createdAt)phoneLatest=message;
    syncPhoneHistory(current?.messages||[]);
    renderPhone();
    const state=messageState(message);
    if(pendingSend===submitted){
      lastManualId=message.id;lastManualRequestId=submitted.requestId;
      sendFeedback(message);
      // Keep the same request ID while the server is retrying or still sending.
      if(state.tone!=='pending'&&!message.retryAt) pendingSend=null;
    }
    await refreshState({silent:true});
  } catch (error) {
    if(token===sendingToken){
      const rejected=error.status>=400&&error.status<500;
      phoneTracked={title,body,source:'manual',localPhase:rejected?'rejected':'unknown',error:explainError(error)};renderPhone();
      if(pendingSend===submitted)feedback('send-status',explainError(error),'error');
    }
  } finally {
    if(token===sendingToken){sendBusy=false;syncSendButton();if(lastManualId)syncPhoneHistory(current?.messages||[]);renderPhone();}
  }
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
// System metrics are loaded only on demand, never by the live iPhone poll.
const systemNumber=n=>Number(n).toLocaleString('vi-VN');
function systemBytes(n) {
  if(!Number.isSafeInteger(n)||n<0)return 'Chưa có số liệu';
  if(n<1000000)return (n/1000).toLocaleString('vi-VN',{maximumFractionDigits:1})+' KB';
  return (n/1000000).toLocaleString('vi-VN',{maximumFractionDigits:2})+' MB';
}
function syncSystemControls() {
  $('system-refresh').disabled=systemBusy;
  $('system-retention').disabled=systemBusy||!systemData?.retentionEditable;
  $('system-save').disabled=systemBusy||!systemData?.retentionEditable||Number($('system-retention').value)===systemData?.retentionDays;
  $('system-export').disabled=systemBusy||!systemData||!systemData.totalMessages;
  $('system-cleanup').disabled=systemBusy||!systemData||!systemData.expiredMessages;
}
function resetSystem() {
  systemGeneration++;systemData=null;systemBusy=false;$('system-card').open=false;
  $('system-data').hidden=true;$('system-checked').textContent='Mở mục này để kiểm tra dữ liệu.';
  for(const id of ['system-size','system-total','system-today','system-expired','system-ready'])$(id).textContent='—';
  $('system-progress').hidden=true;$('system-progress').value=0;$('system-retention').value='30';
  feedback('system-status');syncSystemControls();
}
function renderSystem(data) {
  systemData=data;
  const known=Number.isSafeInteger(data.sizeBytes)&&data.sizeBytes>=0;
  const percent=known&&data.freeLimitBytes>0?100*data.sizeBytes/data.freeLimitBytes:null;
  $('system-size').textContent=systemBytes(data.sizeBytes);
  $('system-progress').hidden=percent===null;
  $('system-progress').value=percent===null?0:Math.min(100,percent);
  $('system-progress').dataset.warning=String(percent!==null&&percent>=80);
  $('system-usage-note').textContent=percent===null?'D1 chưa trả dung lượng. Xem Cloudflare Metrics.':
    'Mốc D1 Free: '+systemBytes(data.freeLimitBytes)+' · '+percent.toLocaleString('vi-VN',{maximumFractionDigits:2})+'%'+(percent>=80?' · Đã vượt ngưỡng cảnh báo 80%.':'');
  $('system-total').textContent=systemNumber(data.totalMessages);
  $('system-today').textContent=systemNumber(data.todayMessages);
  $('system-expired').textContent=systemNumber(data.expiredMessages);
  $('system-ready').textContent=data.serviceReady?'Sẵn sàng':'Cần kiểm tra';
  $('system-retention').value=String(data.retentionDays);
  $('system-policy-note').textContent='Dọn tự động mỗi giờ, tối đa '+systemNumber(data.cleanupBatch)+' tin/lần.'+(data.retentionEditable?'':' Cần migration để đổi thời gian lưu.');
  $('system-checked').textContent='Cập nhật '+dateLabel(data.checkedAt)+' · '+data.timezone;
  $('system-data').hidden=false;
  syncSystemControls();
}
async function systemAction(action) {
  if(!token||systemBusy)return;
  const session=token,generation=systemGeneration;
  const valid=()=>token===session&&generation===systemGeneration;
  systemBusy=true;syncSystemControls();feedback('system-status','Đang xử lý…');
  try {
    await action(valid);
  }catch(error){
    if(valid()){
      const message=error.status===404?'Cần deploy Worker mới để xem mục Database.':explainError(error);
      feedback('system-status',message,'error');
      // Refresh before permitting further mutations after an ambiguous result.
      systemData=null;$('system-data').hidden=true;
    }
  }finally{if(valid()){systemBusy=false;syncSystemControls();}}
}
async function fetchSystem(valid) {
  const data=await api('/api/admin/system');
  if(valid())renderSystem(data);
}
function loadSystem() {
  return systemAction(async valid=>{await fetchSystem(valid);if(valid())feedback('system-status');});
}
$('system-card').addEventListener('toggle',()=>{if($('system-card').open) return loadSystem();});
$('system-refresh').addEventListener('click',loadSystem);
$('system-retention').addEventListener('change',syncSystemControls);
$('system-save').addEventListener('click',()=>{
  const days=Number($('system-retention').value);
  if(!systemData?.retentionEditable||![30,60,90].includes(days)||days===systemData.retentionDays)return;
  if(!window.confirm('Đổi thời gian lưu thành '+days+' ngày? Tin quá hạn sẽ bị xóa ở lần dọn tự động tiếp theo.'))return;
  return systemAction(async valid=>{
    await api('/api/admin/system/retention',{method:'POST',data:{days,confirm:true}});
    if(!valid())return;
    await fetchSystem(valid);if(valid())feedback('system-status','Đã lưu thời gian lưu lịch sử.','success');
  });
});
$('system-cleanup').addEventListener('click',()=>{
  if(!systemData?.expiredMessages)return;
  const days=systemData.retentionDays,batch=systemData.cleanupBatch;
  if(!window.confirm('Xóa tối đa '+systemNumber(batch)+' tin cũ hơn '+days+' ngày? Không thể hoàn tác. Lịch nhắc và iPhone không bị thay đổi.'))return;
  return systemAction(async valid=>{
    const result=await api('/api/admin/system/cleanup',{method:'POST',data:{confirm:true,retentionDays:days}});
    if(!valid())return;
    await fetchSystem(valid);
    if(valid())feedback('system-status','Đã dọn '+systemNumber(result.deleted)+' tin hết hạn.','success');
    if(valid())await refreshState({silent:true});
  });
});
$('system-export').addEventListener('click',()=>{
  if(!systemData?.totalMessages)return;
  return systemAction(async valid=>{
    const result=await api('/api/admin/system/export');
    if(!valid())return;
    const blob=new Blob([JSON.stringify(result,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download='beo-history-'+new Date(result.exportedAt*1000).toISOString().slice(0,10)+'.json';
    document.body.append(a);
    try {a.click();} finally{a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    if(valid())feedback('system-status',result.truncated?'Đã tạo file 5.000 tin gần nhất (còn tin cũ hơn).':'Đã tạo file lịch sử JSON.','success');
  });
});
syncSystemControls();
$('refresh').addEventListener('click', () => refreshState());
$('retry-service').addEventListener('click', checkService);
document.addEventListener('visibilitychange', () => { if (!document.hidden && token) refreshState({silent:true}); });
setInterval(() => {
  // Faster receipt checks only in live mode, normal polling while writing a draft.
  const regular=(pollTick++%5)===0;
  if(!document.hidden&&token&&(phoneMode==='live'||regular||sendBusy))refreshState({silent:true});
  if(regular&&current)renderAgenda();
  renderPhoneClock();
  if (pairingExpiry && Date.now() >= pairingExpiry * 1000) {
    $('pair-expiry').textContent = 'Mã đã hết hạn. Tạo mã mới để kết nối.';
    pairingExpiry = 0;
    pairingCode = '';
    $('pair-code').textContent = '···· ····';
  }
}, 3000);
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
renderPreview();renderPhone();
checkService();

return { refreshState, checkService };
}

if (typeof document !== 'undefined' && document.getElementById('login-panel')) startAdmin();
