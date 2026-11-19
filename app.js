import { STORAGE_KEY, normalizeState, localDayKey, dayKeyOffset, totalForDay, getWeekStats, nextReminderSlot } from './logic.js';
import { getLanguage, setLanguage, translate, applyTranslations, formatDate, formatNumber, formatTime } from './i18n.js';
import { configured, session, clearSession, publicConfig, decodeVapidPublicKey, activateDevice, getDevice, updateSchedule, updateMessage, subscribe, unsubscribe, testPush, disconnect } from './solo.js';
import { createJournal } from './journal-ui.js';

const el = id => document.getElementById(id);
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh';
const circleLength = 2 * Math.PI * 72;
const t = (key, vars) => translate(key, lang, vars);
const number = value => formatNumber(value, lang);
const amountLabel = amount => number(amount) + ' ml';

function loadState() {
  try { return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')); }
  catch { return normalizeState(null); }
}
let state = loadState();
let lang = getLanguage();
let currentScreen = 'today';
let renderedDay = localDayKey();
let toastTimer = null;
let backend = null;
let notificationState = null;
let syncing = false;
let journal;

function persistState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; }
  catch { toast(t('storageProblem')); return false; }
}
function toast(message, undo) {
  clearTimeout(toastTimer);
  el('toast-message').textContent = message;
  const button = el('toast-action');
  button.hidden = !undo;
  button.onclick = undo ? () => { button.hidden = true; undo(); } : null;
  el('toast').hidden = false;
  toastTimer = setTimeout(() => { el('toast').hidden = true; }, undo ? 5300 : 3500);
}
function id() { return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2); }

function addWater(value) {
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount < 20 || amount > 2000) { toast(t('amountInvalid')); return false; }
  const now = new Date();
  state.logs.push({ id: id(), at: now.toISOString(), day: localDayKey(now), amount });
  persistState();
  renderToday();
  if (currentScreen === 'history') renderHistory();
  toast(t('waterAdded', { amount: number(amount) }));
  return true;
}
function removeWater(logId) {
  const index = state.logs.findIndex(item => item.id === logId);
  if (index < 0) return;
  const entry = state.logs.splice(index, 1)[0];
  persistState(); renderToday(); renderHistory();
  toast(t('entryRemoved'), () => {
    if (!state.logs.some(item => item.id === entry.id)) state.logs.push(entry);
    persistState(); renderToday(); renderHistory();
    toast(t('entryRestored'));
  });
}
function nextScheduledTime(date = new Date()) {
  if (!state.reminder.enabled) return null;
  const startParts = state.reminder.start.split(':').map(Number);
  const endParts = state.reminder.end.split(':').map(Number);
  const start = startParts[0] * 60 + startParts[1];
  const end = endParts[0] * 60 + endParts[1];
  if (start >= end) return null;
  const minute = date.getHours() * 60 + date.getMinutes();
  let slot = start;
  while (slot <= minute && slot <= end) slot += state.reminder.interval;
  const output = new Date(date);
  if (slot > end) { output.setDate(output.getDate() + 1); slot = start; }
  output.setHours(Math.floor(slot / 60), slot % 60, 0, 0);
  return output;
}
function renderNextReminder() {
  const next = nextScheduledTime();
  el('next-reminder').textContent = next ? t('v2NextTime', { time: formatTime(next, lang) }) : t('v2NextDisabled');
}
function makeDropIcon() {
  const wrapper = document.createElement('span');
  wrapper.className = 'entry-icon';
  wrapper.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5C9 7 5.5 10.6 5.5 15a6.5 6.5 0 1 0 13 0C18.5 10.6 15 7 12 2.5Z"/></svg>';
  return wrapper;
}
function renderToday() {
  const day = localDayKey();
  const entries = state.logs.filter(item => item.day === day).sort((a,b) => b.at.localeCompare(a.at));
  const total = totalForDay(entries, day);
  const fraction = Math.min(total / state.goal, 1);
  const percent = Math.round(100 * total / state.goal);
  const now = new Date();
  el('today-date').textContent = formatDate(now, lang, { weekday: 'long', month: 'long', day: 'numeric' }).toLocaleUpperCase(lang === 'vi' ? 'vi-VN' : 'en-US');
  el('today-total').textContent = number(total);
  el('progress-ring').setAttribute('aria-valuenow', String(Math.min(percent, 100)));
  el('progress-ring').setAttribute('aria-valuetext', amountLabel(total) + ' / ' + amountLabel(state.goal));
  el('ring-front').style.strokeDashoffset = String(circleLength * (1 - fraction));
  el('progress-percent').textContent = String(Math.min(percent, 100)) + '%';
  el('today-goal-label').textContent = t('goalOf', { amount: number(state.goal) });
  el('progress-remaining').textContent = percent >= 100 ? t('completed') : t('remaining', { amount: number(state.goal - total) });
  el('progress-status-label').textContent = percent >= 100 ? t('goalReached') : t('onYourWay');
  el('progress-message').textContent = percent >= 100 ? t('reachedToday') : percent >= 50 ? t('halfWay') : total ? t('startingWell') : t('startFresh');
  el('today-count').textContent = t('entryCount', { count: entries.length }).toLocaleUpperCase(lang === 'vi' ? 'vi-VN' : 'en-US');
  renderNextReminder();
  journal?.renderWeek();
  journal?.renderStory();
  const list = el('today-entries');
  list.replaceChildren();
  if (!entries.length) {
    const item = document.createElement('li'); item.className = 'empty-card';
    const heading = document.createElement('strong'); heading.textContent = t('emptyTitle');
    const body = document.createElement('p'); body.textContent = t('emptyDescription');
    item.append(heading, body); list.append(item); return;
  }
  for (const entry of entries) {
    const item = document.createElement('li'); item.className = 'entry-item';
    const text = document.createElement('span'); text.className = 'entry-text';
    const total = document.createElement('strong'); total.textContent = amountLabel(entry.amount);
    const time = document.createElement('small'); time.textContent = formatTime(new Date(entry.at), lang);
    text.append(total, time);
    const remove = document.createElement('button'); remove.className = 'delete-button'; remove.type = 'button'; remove.textContent = '×';
    remove.setAttribute('aria-label', t('removeEntry', { amount: number(entry.amount), time: time.textContent }));
    remove.addEventListener('click', () => removeWater(entry.id));
    item.append(makeDropIcon(), text, remove); list.append(item);
  }
}
function renderHistory() {
  const stats = getWeekStats(state.logs, state.goal, new Date());
  const loggedWeekDays = stats.days.filter(day=>state.logs.some(item=>item.day===day.day));
  el('week-average').textContent = loggedWeekDays.length ? amountLabel(Math.round(loggedWeekDays.reduce((sum,day)=>sum+day.amount,0)/loggedWeekDays.length)) : '—';
  el('days-reached').textContent = t('daysCount', { count: stats.reached });
  const bars = el('week-bars'); bars.replaceChildren();
  for (const d of stats.days) {
    const col = document.createElement('div'); col.className = 'bar-col' + (d.today ? ' today' : '');
    const track = document.createElement('div'); track.className = 'bar-track'; track.setAttribute('aria-label', d.day + ': ' + amountLabel(d.amount));
    const fill = document.createElement('div'); fill.className = 'bar-fill'; fill.style.height = (d.amount ? Math.max(6, Math.min(100, d.amount / state.goal * 100)) : 0) + '%'; track.append(fill);
    const label = document.createElement('span'); label.className = 'bar-day';
    label.textContent = formatDate(new Date(d.day + 'T12:00:00'), lang, { weekday:'short' });
    col.append(track, label); bars.append(col);
  }
  const days = el('history-days'); days.replaceChildren();
  for (let offset = 0; offset > -14; offset--) {
    const day = dayKeyOffset(offset); const value = totalForDay(state.logs, day);
    const row = document.createElement('div'); row.className = 'history-day-row';
    const label = document.createElement('span'); label.className = 'history-day-name';
    label.textContent = offset === 0 ? t('today') : offset === -1 ? t('yesterday') : formatDate(new Date(day + 'T12:00:00'), lang, { weekday: 'long' });
    const date = document.createElement('small'); date.textContent = formatDate(new Date(day + 'T12:00:00'), lang, { day: 'numeric', month: 'short' }); label.append(date);
    const total = document.createElement('strong'); total.textContent = state.logs.some(item=>item.day===day) ? amountLabel(value) : t('v3NoEntryShort');
    row.append(label, total);
    if (value >= state.goal) { const check = document.createElement('span'); check.className='goal-mark'; check.textContent='✓'; check.title = t('reachedAria'); row.append(check); }
    days.append(row);
  }
}
function previewSchedule() {
  const start = el('remind-start').value; const end = el('remind-end').value;
  const interval = Number(el('remind-interval').value);
  if (!start || !end || start >= end) { el('reminder-preview').textContent = t('previewInvalid'); return; }
  const startMin = Number(start.slice(0,2)) * 60 + Number(start.slice(3));
  const endMin = Number(end.slice(0,2)) * 60 + Number(end.slice(3));
  const slots = [];
  for (let minute = startMin; minute <= endMin && slots.length < 4; minute += interval) {
    const time = new Date(); time.setHours(Math.floor(minute/60), minute%60, 0, 0);
    slots.push(formatTime(time, lang));
  }
  el('reminder-preview').textContent = t('preview', { times: slots.join(', '), more: startMin + 4*interval <= endMin ? ' …' : '' });
}
function renderSettings() {
  el('goal-input').value = state.goal;
  el('remind-enabled').checked = !!state.reminder.enabled;
  el('remind-start').value = state.reminder.start;
  el('remind-end').value = state.reminder.end;
  el('remind-interval').value = String(state.reminder.interval);
  previewSchedule();
  el('reminder-mode-note').textContent = notificationState?.pushEnabled ? t('soloPushActiveNote') : t('v2ReminderFallback');
}
function renderPushSettings() {
  const connected = configured() && backend?.ready;
  const active = !!session();
  const enabled = !!notificationState?.pushEnabled && typeof Notification !== 'undefined' && Notification.permission === 'granted';
  el('solo-setup-help').hidden = connected;
  el('solo-activation').hidden = !connected || active;
  el('solo-controls').hidden = !connected || !active;
  el('solo-status').textContent = !configured() ? t('soloNotConfigured') : !backend?.ready ? t('soloNotReady') :
    !active ? t('soloActivateFirst') : enabled ? t('soloPushEnabled') : t('soloActivated');
  el('enable-push').disabled = !connected || !active || enabled;
  el('test-push').disabled = !connected || !active || !enabled;
  el('disable-push').hidden = !enabled;
  el('reminder-mode-note').textContent = enabled ? t('soloPushActiveNote') : t('v2ReminderFallback');
}
function changeScreen(screen) {
  if (!['today','history','settings'].includes(screen)) return;
  currentScreen = screen;
  for (const name of ['today','history','settings']) el('screen-'+name).hidden = name !== screen;
  document.querySelectorAll('[data-tab]').forEach(button => {
    const selected = button.dataset.tab === screen;
    button.classList.toggle('active',selected);
    if (selected) button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current');
  });
  if (screen === 'history') {renderHistory();journal?.render();}
  if (screen === 'settings') renderSettings();
  window.scrollTo({ top:0, behavior:'auto' });
}
function applyLocale() {
  applyTranslations(lang);
  renderToday();renderHistory();journal?.render();renderSettings();renderPushSettings();
}
function showDialog(dialog) { if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open',''); }
function closeDialog(dialog) { if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open'); }
function schedulePayload() { return { ...state.reminder, locale: lang, timezone }; }
async function syncSchedule() {
  if (syncing || !session() || !backend?.ready) return;
  syncing = true;
  try { await updateSchedule(schedulePayload()); }
  catch (err) { if (err.status === 401) { clearSession(); notificationState = null; renderPushSettings(); } }
  finally { syncing = false; }
}
async function refreshDevice() {
  if (!session() || !backend?.ready) { notificationState=null;renderPushSettings();return; }
  try { notificationState=await getDevice();if(notificationState.note && !el('solo-message').value)el('solo-message').value=notificationState.note; }
  catch (err) { if (err.status===401) { clearSession();notificationState=null; } }
  renderPushSettings();
}
async function beginBackend() {
  if (!configured()) { renderPushSettings();return; }
  try { backend=await publicConfig(); } catch { backend=null; }
  renderPushSettings();
  if (backend?.ready && session()) {await refreshDevice(); await syncSchedule();}
}
function checkForegroundReminder() {
  if (document.hidden || notificationState?.pushEnabled) return;
  const due = nextReminderSlot(new Date(), state.reminder, state.lastReminderSlot);
  if (!due) return;
  state.lastReminderSlot = due;
  persistState();
  toast(t('reminderToast'));
}

// Navigation, language and personal water tracking.
document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click',()=>changeScreen(button.dataset.tab)));
document.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click',()=>changeScreen(button.dataset.go)));
document.querySelectorAll('[data-lang]').forEach(button => button.addEventListener('click',()=>{
  if (button.dataset.lang === lang) return;
  lang = button.dataset.lang; setLanguage(lang); applyLocale(); syncSchedule();
}));
document.querySelectorAll('[data-add]').forEach(button => button.addEventListener('click',()=>addWater(button.dataset.add)));
el('open-log').addEventListener('click',()=>showDialog(el('log-dialog')));
el('close-dialog').addEventListener('click',()=>closeDialog(el('log-dialog')));
el('about-button').addEventListener('click',()=>showDialog(el('about-dialog')));
el('close-about').addEventListener('click',()=>closeDialog(el('about-dialog')));
el('got-it').addEventListener('click',()=>closeDialog(el('about-dialog')));
document.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click',()=>{
  el('amount-input').value = button.dataset.preset;
  document.querySelectorAll('[data-preset]').forEach(item=>item.classList.toggle('selected',item===button));
}));
el('amount-input').addEventListener('input',()=>document.querySelectorAll('[data-preset]').forEach(button=>button.classList.toggle('selected',button.dataset.preset===el('amount-input').value)));
el('drink-form').addEventListener('submit',event=>{
  event.preventDefault(); if (!addWater(el('amount-input').value)) return;
  closeDialog(el('log-dialog'));el('amount-input').value='250';
  document.querySelectorAll('[data-preset]').forEach(button=>button.classList.toggle('selected',button.dataset.preset==='250'));
});
el('goal-form').addEventListener('submit',event=>{
  event.preventDefault();const goal=Number(el('goal-input').value);
  if (!Number.isInteger(goal)||goal<500||goal>6000) {toast(t('goalInvalid'));return;}
  state.goal=goal;persistState();renderToday();renderSettings();toast(t('goalUpdated'));
});
['remind-start','remind-end','remind-interval'].forEach(name=>el(name).addEventListener('change',previewSchedule));
el('reminder-form').addEventListener('submit',async event=>{
  event.preventDefault(); const start=el('remind-start').value;const end=el('remind-end').value;
  if (!start||!end||start>=end) {toast(t('timeInvalid'));return;}
  state.reminder={enabled:el('remind-enabled').checked,start,end,interval:Number(el('remind-interval').value)};
  state.lastReminderSlot='';persistState();renderNextReminder();
  toast(t(state.reminder.enabled?'remindersSaved':'remindersOff'));
  if (session() && backend?.ready) {try{await updateSchedule(schedulePayload());}catch{toast(t('soloBackendDown'));}}
});

// Backup is local-only. Device credentials and personal notes are never exported.
el('export-backup').addEventListener('click',()=>{
  const obj={format:'water-reminder-backup',version:1,exportedAt:new Date().toISOString(),data:state,bodyNotes:journal?.exportNotes()};
  const url=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download='water-backup-'+localDayKey()+'.json';document.body.append(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),5000);toast(t('backupReady'));
});
el('import-backup').addEventListener('click',()=>el('backup-file').click());
el('backup-file').addEventListener('change',async()=>{
  const file=el('backup-file').files[0];el('backup-file').value='';if(!file)return;
  try{
    if(file.size>5*1024*1024)throw Error(t('backupTooLarge'));
    const obj=JSON.parse(await file.text());
    if(obj.format!=='water-reminder-backup'||obj.version!==1||!Array.isArray(obj.data?.logs))throw Error(t('backupInvalid'));
    if(!confirm(t('backupConfirm')))return;
    state=normalizeState(obj.data);persistState();if(obj.bodyNotes)journal?.restoreNotes(obj.bodyNotes);applyLocale();toast(t('backupRestored'));
  }catch(err){toast(err.message||t('backupFailed'));}
});

// Activate exactly one phone, then opt into Web Push from its Home Screen app.
el('solo-activate').addEventListener('click',async()=>{
  if(!backend?.ready){toast(t('soloNotReady'));return;}
  const code=el('solo-code').value;
  if(code.length<16){toast(t('soloCodeTooShort'));return;}
  el('solo-activate').disabled=true;
  try{
    await activateDevice(code,lang);
    el('solo-code').value='';
    await syncSchedule();
    await refreshDevice();
    toast(t('soloActivationSuccess'));
  }catch(err){toast(err.status===409?t('soloAlreadyUsed'):t('soloActivationError'));}
  finally{el('solo-activate').disabled=false;}
});
el('solo-save-message').addEventListener('click',async()=>{
  if(!session())return;
  try{await updateMessage(el('solo-message').value.trim());await refreshDevice();toast(t('soloMessageSaved'));}
  catch{toast(t('soloBackendDown'));}
});
el('enable-push').addEventListener('click',async()=>{
  if(!session()||!backend?.ready){toast(t('soloActivateFirst'));return;}
  const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  if(!standalone && /iPhone|iPad|iPod/.test(navigator.userAgent)){toast(t('v2PushNeedInstall'));return;}
  if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)){toast(t('v2PushUnsupported'));return;}
  if(Notification.permission==='denied'){toast(t('v2PushDenied'));return;}
  // Must originate from the click gesture on iOS.
  const permissionPromise=Notification.requestPermission();
  const button=el('enable-push');button.disabled=true;
  try{
    const permission=await permissionPromise;
    if(permission!=='granted'){toast(t('v2PushDenied'));return;}
    const registration=await navigator.serviceWorker.ready;
    const subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeVapidPublicKey(backend.vapidPublicKey)});
    await subscribe(subscription.toJSON());
    await updateSchedule(schedulePayload());
    await refreshDevice();toast(t('v2PushSuccess'));
  }catch(err){console.error('Push setup failed',err);toast(t('v2PushError'));}
  finally{renderPushSettings();}
});
el('test-push').addEventListener('click',async()=>{
  try{await testPush();toast(t('v2PushTestSuccess'));}
  catch(err){toast(t('v2PushError')+' ('+err.message+')');}
});
el('disable-push').addEventListener('click',async()=>{
  try{
    await unsubscribe();
    const registration=await navigator.serviceWorker?.ready;
    const existing=await registration?.pushManager?.getSubscription();if(existing)await existing.unsubscribe();
    await refreshDevice();toast(t('v2PushDisabled'));
  }catch{toast(t('soloBackendDown'));}
});
el('solo-disconnect').addEventListener('click',async()=>{
  if(!session()||!confirm(t('soloConfirmDisconnect')))return;
  try{
    const registration=await navigator.serviceWorker?.ready;
    const existing=await registration?.pushManager?.getSubscription();if(existing)await existing.unsubscribe();
    await disconnect();notificationState=null;renderPushSettings();toast(t('soloDisconnected'));
  }catch{toast(t('soloBackendDown'));}
});
// Journal data and self-reported symptoms stay exclusively on this device.
journal = createJournal({
  getState:()=>state, getLanguage:()=>lang, t, number, amountLabel, formatDate, formatTime,
  openHistory:()=>changeScreen('history'),
  addEntry:(day,amount)=>{
    state.logs.push({id:id(),at:new Date().toISOString(),day,amount});
    persistState();renderToday();renderHistory();toast(t('v3DaySaved'));
  },
  deleteEntry:removeWater,
  showToast:toast
});
// Keep the existing local data even when the push backend is unconfigured/offline.
applyLocale();beginBackend();
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{}));
document.addEventListener('visibilitychange',()=>{
  if(document.hidden)return;
  if(localDayKey()!==renderedDay){renderToday();renderHistory();renderedDay=localDayKey();}
  checkForegroundReminder();refreshDevice();
});
setInterval(()=>{
  if(document.hidden)return;
  if(localDayKey()!==renderedDay){renderToday();renderHistory();renderedDay=localDayKey();}
  renderNextReminder();checkForegroundReminder();
},30_000);

// Dedicated iPhone PWA: ignore two-finger pinch and Safari gesture zoom.
for(const eventName of ['gesturestart','gesturechange','gestureend']){
  document.addEventListener(eventName,event=>event.preventDefault(),{passive:false});
}
document.addEventListener('touchmove',event=>{
  if(event.touches.length>1)event.preventDefault();
},{passive:false});
// Prevent copying or selecting UI copy, without breaking text fields and pasting.
const isEditableControl = target => target instanceof Element &&
  !!target.closest('input, textarea, [contenteditable="true"]');
for (const eventName of ['copy', 'cut', 'contextmenu', 'selectstart']) {
  document.addEventListener(eventName, event => {
    if (!isEditableControl(event.target)) event.preventDefault();
  }, { capture: true });
}
