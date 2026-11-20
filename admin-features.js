import { HOME_COPIES } from './water-notes.js?v=20261120-home-copy-v1';

export const MIN_INTERVAL = 5;
export const MAX_INTERVAL = 720;
const AUTO_TITLE = 'Water ♡';
const AUTO_BODY = 'Beo ơi, nhớ uống nước nha em ♡';
const autoSettings = value => (value?.notificationTitle === AUTO_TITLE &&
  [AUTO_BODY, 'Beo ơi, nhớ nhấp một chút nước nha em ♡'].includes(value?.reminderMessage)) ||
  (value?.notificationTitle === 'Beo ơi 💧' && value?.reminderMessage === 'Đến giờ uống nước rồi nè em.');
const padded = n => String(n).padStart(2,'0');
const shortInterval = mins => mins < 60 ? mins + ' phút' : mins % 60 === 0
  ? (mins/60) + ' giờ' : Math.floor(mins/60) + ' giờ ' + mins%60 + ' phút';

/** Preview uses the exact same start + k*interval schedule as the Cloudflare Worker. */
export function previewScheduleTimes(start, end, interval) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start || '') ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(end || '')) return [];
  const n = Number(interval);
  if (!Number.isInteger(n) || n < MIN_INTERVAL || n > MAX_INTERVAL || start >= end) return [];
  const first = Number(start.slice(0,2))*60 + Number(start.slice(3));
  const last = Number(end.slice(0,2))*60 + Number(end.slice(3));
  const result = [];
  for (let minute=first; minute<=last; minute+=n) result.push(padded(Math.floor(minute/60))+':'+padded(minute%60));
  return result;
}
function csvCell(value) {
  // Prevent CSV formula injection if any content is opened in a spreadsheet.
  return '"' + String(value ?? '').replace(/^[\s]*[=+\-@]/, text => "'" + text)
    .replaceAll('"','""').replaceAll(/\r?\n/g,' ') + '"';
}

export function createAdminFeatures({ $, api, getState, markDirty, setSendDraft, dateLabel, messageState }) {
  let mode = 'auto';
  let fixedDraft = {title:'',body:''};
  let hasHistory = false;
  let historyItems = [];
  let historyTotal = 0;
  let historyOffset = 0;
  let historyBusy = false;
  let sequence = 0;
  let historyTimer = null;
  const HISTORY_LIMIT = 30;

  function showMode(next, isEdit=false) {
    if (isEdit && mode === 'fixed') fixedDraft = {
      title: $('reminder-title').value, body: $('reminder-body').value
    };
    mode = next === 'fixed' ? 'fixed' : 'auto';
    if (isEdit) {
      if (mode === 'auto') {
        $('reminder-title').value = AUTO_TITLE;
        $('reminder-body').value = AUTO_BODY;
      } else {
        $('reminder-title').value = fixedDraft.title || 'Nhắc Beo uống nước ♡';
        $('reminder-body').value = fixedDraft.body || 'Nhớ uống nước đầy đủ nha em ♡';
      }
      markDirty();
    }
    $('custom-copy-fields').hidden = mode !== 'fixed';
    $('mode-auto').classList.toggle('selected',mode === 'auto');
    $('mode-fixed').classList.toggle('selected',mode === 'fixed');
    $('mode-auto').setAttribute?.('aria-pressed',String(mode === 'auto'));
    $('mode-fixed').setAttribute?.('aria-pressed',String(mode === 'fixed'));
    $('copy-mode-help').textContent = mode === 'auto'
      ? 'Mỗi lần nhắc, app sẽ dùng một câu khác nhau. Bạn vẫn có thể gửi lời nhắn riêng bất cứ lúc nào.'
      : 'Tiêu đề và lời nhắn được gửi giống nhau mỗi lần tới giờ.';
  }

  function preview() {
    const times = previewScheduleTimes($('schedule-start').value,$('schedule-end').value,$('schedule-interval').value);
    const minutes = Number($('schedule-interval').value);
    const start = $('schedule-start').value;
    const end = $('schedule-end').value;
    $('schedule-preview-count').textContent = times.length ? times.length + ' lần/ngày' : 'Chưa hợp lệ';
    $('schedule-preview-summary').textContent = times.length
      ? 'Từ '+start+' đến '+end+' · mỗi '+shortInterval(minutes)
      : 'Kiểm tra giờ bắt đầu, kết thúc và số phút (5–720).';
    const samples = times.length > 9 ? [...times.slice(0,6),'…',times[times.length-1]] : times;
    $('schedule-preview-times').textContent = samples.join('   ·   ');
    $('schedule-preview-warning').hidden = times.length <= 40;
    $('schedule-preview-warning').textContent = times.length > 40
      ? 'Lịch này gửi '+times.length+' thông báo/ngày. Nếu nhiều quá, bạn có thể tăng số phút.'
      : '';
    $('metric-frequency').textContent = times.length ? shortInterval(minutes) : 'Chưa hợp lệ';
    $('metric-frequency-sub').textContent = times.length ? times.length+' lần trong khung giờ' : 'Kiểm tra lại lịch';
    for (const item of (document.querySelectorAll?.('[data-interval]') || [])) {
      item.classList.toggle('selected',Number(item.dataset.interval) === minutes);
    }
  }

  function renderMetrics(state) {
    const {settings,device,messages=[]} = state;
    $('metric-schedule').textContent = settings.enabled ? 'Đang bật' : 'Đã tạm tắt';
    $('metric-schedule-sub').textContent = settings.start+' — '+settings.end;
    $('metric-device').textContent = device.pushEnabled ? 'Sẵn sàng' : device.paired ? 'Cần bật push' : 'Chưa kết nối';
    $('metric-device-sub').textContent = device.pushEnabled ? 'Đang đăng ký nhận thông báo'
      : device.paired ? 'Mở app iPhone để bật thông báo' : 'Tạo mã ghép để bắt đầu';
    const last = messages[0];
    $('metric-latest').textContent = last ? messageState(last).label : 'Chưa có';
    $('metric-latest-sub').textContent = last ? dateLabel(last.createdAt) : 'Chưa có lời nhắn nào';
    $('device-last-seen').textContent = device.lastSeenAt ? 'Hoạt động: '+dateLabel(device.lastSeenAt)
      : 'Chưa có hoạt động được ghi nhận';
    $('disconnect-button').disabled = !device.paired;
    preview();
  }

  function renderHistory(messages) {
    const root = $('message-history');
    const fragment = document.createDocumentFragment();
    if (!messages.length) {
      const empty = document.createElement('li');
      empty.className = 'empty-history';
      empty.textContent = 'Chưa tìm thấy thông báo phù hợp.';
      fragment.append(empty);
    }
    for (const message of messages) {
      const item = document.createElement('li'); item.className = 'message-item';
      const row = document.createElement('div'); row.className = 'message-row';
      const title = document.createElement('strong'); title.textContent = message.title;
      const state = messageState(message);
      const badge = document.createElement('span'); badge.className = 'message-state '+state.tone; badge.textContent = state.label;
      row.append(title,badge);
      const body = document.createElement('p'); body.textContent = message.body;
      const time = document.createElement('time');
      if (message.createdAt) time.dateTime = new Date(message.createdAt*1000).toISOString();
      time.textContent = (message.source==='scheduled'?'Theo lịch':'Gửi ngay')+' · '+dateLabel(message.createdAt);
      item.append(row,body,time);
      if (message.error && state.tone === 'failed') {
        const detail = document.createElement('p'); detail.className = 'message-error';
        detail.textContent = message.error; item.append(detail);
      }
      fragment.append(item);
    }
    root.replaceChildren(fragment);
  }

  function historyControls() {
    $('history-total').textContent = hasHistory ? historyTotal+' thông báo phù hợp' : 'Đang tải lịch sử…';
    $('history-prev').disabled = historyBusy || historyOffset <= 0;
    $('history-next').disabled = historyBusy || historyOffset + HISTORY_LIMIT >= historyTotal;
    $('history-export').disabled = historyBusy || !historyItems.length;
    $('history-page').textContent = 'Trang '+(Math.floor(historyOffset/HISTORY_LIMIT)+1) +
      (historyTotal ? ' / '+Math.ceil(historyTotal/HISTORY_LIMIT) : '');
  }

  async function loadHistory({ reset=false } = {}) {
    if (!getState() || historyBusy) return;
    if (reset) historyOffset = 0;
    const number = ++sequence;
    historyBusy = true;
    historyControls();
    const params = new URLSearchParams({
      limit:String(HISTORY_LIMIT), offset:String(historyOffset),
      source:$('history-source').value || 'all',
      status:$('history-status').value || 'all',
      q:($('history-search').value || '').trim()
    });
    try {
      const result = await api('/api/admin/history?'+params.toString());
      if (!getState() || number !== sequence) return;
      hasHistory = true;
      historyTotal = Number(result.total) || 0;
      historyItems = result.messages || [];
      renderHistory(historyItems);
      $('history-feedback').textContent = '';
    } catch (error) {
      if (!getState() || number !== sequence) return;
      const fallback = getState().messages || [];
      if (!hasHistory) renderHistory(fallback);
      $('history-feedback').textContent = error.status === 404
        ? 'Cần cập nhật máy chủ để lọc và xuất lịch sử chi tiết.'
        : 'Chưa tải được lịch sử chi tiết. Bạn có thể thử lại.';
      $('history-feedback').dataset.tone = 'error';
    } finally {
      historyBusy = false;
      if (getState() && number === sequence) historyControls();
    }
  }

  function onStateChange(state, dirty=false) {
    if (!dirty) {
      showMode(autoSettings(state.settings) ? 'auto' : 'fixed');
      if (mode === 'fixed') fixedDraft = {
        title:state.settings.notificationTitle,body:state.settings.reminderMessage
      };
    }
    renderMetrics(state);
    if (hasHistory) renderHistory(historyItems);
    if (!hasHistory && !historyBusy) void loadHistory();
  }

  function reset() {
    hasHistory = false;
    historyItems = []; historyTotal = 0; historyOffset = 0;
    sequence++;
    clearTimeout(historyTimer); historyTimer = null;
    $('history-total').textContent = 'Đăng nhập để xem lịch sử.';
    $('history-feedback').textContent = '';
    $('history-prev').disabled = true;
    $('history-next').disabled = true;
    $('history-export').disabled = true;
  }

  $('mode-auto').addEventListener('click',()=>showMode('auto',true));
  $('mode-fixed').addEventListener('click',()=>showMode('fixed',true));
  $('use-reminder-template').addEventListener('click',()=>showMode('auto',true));
  $('use-home-auto').addEventListener('click',()=>{
    $('home-message').value = 'Nhắc uống nước mỗi ngày.';
    markDirty();
    $('settings-status').textContent = 'Đã chọn lời chào tự đổi. Nhớ lưu cài đặt nhé.';
  });
  for (const preset of (document.querySelectorAll?.('[data-interval]') || [])) {
    preset.addEventListener('click',()=>{
      $('schedule-interval').value = preset.dataset.interval;
      markDirty();
      preview();
    });
  }
  for (const id of ['schedule-start','schedule-end','schedule-interval']) {
    $(id).addEventListener('input',preview);
    $(id).addEventListener('change',preview);
  }
  $('schedule-to-send').addEventListener('click',()=>{
    const sample = HOME_COPIES[Math.floor(Math.random()*HOME_COPIES.length)];
    const draft = mode === 'auto'
      ? {title:sample.title.toLocaleUpperCase('vi-VN'),body:sample.body}
      : {title:$('reminder-title').value.trim(),body:$('reminder-body').value.trim()};
    setSendDraft(draft);
    $('send-status').textContent = 'Đã điền nội dung để thử. Kiểm tra rồi nhấn Gửi tới iPhone.';
    $('compose-section').scrollIntoView?.({behavior:'smooth',block:'start'});
    $('send-title').focus?.();
  });

  $('disconnect-button').addEventListener('click',async()=>{
    if (!getState()?.device?.paired || !window.confirm(
      'Ngắt kết nối iPhone của Beo? Máy sẽ không còn nhận được thông báo. Muốn kết nối lại cần tạo mã mới.')) return;
    $('disconnect-button').disabled = true;
    $('device-feedback').textContent = '';
    try {
      await api('/api/admin/device/disconnect',{method:'POST',data:{confirm:true}});
      $('pair-result').hidden = true;
      $('device-feedback').textContent = 'Đã ngắt kết nối. Bạn có thể tạo mã mới để ghép lại.';
      $('device-feedback').dataset.tone = 'success';
      // Update the display from server truth, not from an optimistic local assumption.
      await api('/api/admin/state').then(result => onStateChange(result,false));
      $('device-status').textContent = 'Chưa có iPhone kết nối.';
    } catch (error) {
      $('device-feedback').textContent = error.message || 'Chưa thể ngắt thiết bị. Thử lại nhé.';
      $('device-feedback').dataset.tone = 'error';
    } finally { $('disconnect-button').disabled = !getState()?.device?.paired; }
  });

  $('history-refresh').addEventListener('click',()=>loadHistory());
  $('history-prev').addEventListener('click',()=>{
    if (historyBusy || historyOffset === 0) return;
    historyOffset = Math.max(0,historyOffset-HISTORY_LIMIT); void loadHistory();
  });
  $('history-next').addEventListener('click',()=>{
    if (historyBusy || historyOffset+HISTORY_LIMIT>=historyTotal) return;
    historyOffset += HISTORY_LIMIT; void loadHistory();
  });
  for(const id of ['history-source','history-status']){
    $(id).addEventListener('change',()=>loadHistory({reset:true}));
  }
  $('history-search').addEventListener('input',()=>{
    clearTimeout(historyTimer);
    historyTimer = setTimeout(()=>{historyTimer=null;void loadHistory({reset:true});},300);
  });
  $('history-export').addEventListener('click',()=>{
    if (!historyItems.length) return;
    const rows = [['Thời gian','Loại','Trạng thái','Tiêu đề','Nội dung']];
    for(const m of historyItems) rows.push([
      dateLabel(m.createdAt),m.source==='scheduled'?'Theo lịch':'Gửi ngay',
      messageState(m).label,m.title,m.body
    ]);
    const csv = '\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const link = document.createElement('a');
    link.href = url;link.download = 'water-beo-lich-su-trang-'+(Math.floor(historyOffset/HISTORY_LIMIT)+1)+'.csv';
    document.body?.append?.(link);link.click?.();link.remove?.();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
    $('history-feedback').textContent = 'Đã xuất CSV của trang đang xem.';
    $('history-feedback').dataset.tone = 'success';
  });
  $('refresh').addEventListener('click',()=>loadHistory());

  preview();
  return {onStateChange,reset,loadHistory,preview};
}
