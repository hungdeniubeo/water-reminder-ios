import { STORAGE_KEY, normalizeState, localDayKey, dayKeyOffset, totalForDay, getWeekStats, nextReminderSlot } from './logic.js';
import { getLanguage, setLanguage, translate, applyTranslations, formatDate, formatNumber, formatTime } from './i18n.js';
import { backendConfigured, getSession, clearSession, getPublicConfig, getCouple, createCouple, joinCouple, renewInvite, leaveCouple, updateProfile, updateProgress, updateSchedule, registerSubscription, unregisterSubscription, requestTestPush } from './couple.js';

const el = id => document.getElementById(id);
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh';
const PROFILE_KEY = 'water-couple-profile-v2';
const circleLength = 2 * Math.PI * 72;
const t = (key, vars) => translate(key, lang, vars);
const number = value => formatNumber(value, lang);
const amountLabel = amount => number(amount) + ' ml';

function getProfile() {
  try { const parsed = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); return { name: String(parsed?.name || '').slice(0, 32), note: String(parsed?.note || '').slice(0, 150) }; }
  catch { return { name: '', note: '' }; }
}
function loadState() {
  try { return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')); }
  catch { return normalizeState(null); }
}
let state = loadState();
let profile = getProfile();
let lang = getLanguage();
let currentScreen = 'today';
let renderedDay = localDayKey();
let toastTimer = null;
let backend = null;
let remote = null;
let invite = null;
let syncing = false;
let fetchingCouple = false;

function persistState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; }
  catch { toast(t('storageProblem')); return false; }
}
function saveProfileLocal() {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); return true; }
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

function todayProgress() { const day = localDayKey(); return { day, total: totalForDay(state.logs, day), goal: state.goal }; }
function sendProgress() {
  if (!getSession() || !backend?.ready) return;
  const data = todayProgress();
  updateProgress(data).then(() => {
    if (currentScreen === 'couple' && remote) {
      remote.self = { ...remote.self, total: data.total, goal: data.goal };
      renderCouple();
    }
  }).catch(() => { /* keep local history safe; retry when next visible */ });
}
function addWater(value) {
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount < 20 || amount > 2000) { toast(t('amountInvalid')); return false; }
  const now = new Date();
  state.logs.push({ id: id(), at: now.toISOString(), day: localDayKey(now), amount });
  persistState();
  renderToday();
  if (currentScreen === 'history') renderHistory();
  if (currentScreen === 'couple') renderCouple();
  sendProgress();
  toast(t('waterAdded', { amount: number(amount) }));
  return true;
}
function removeWater(logId) {
  const index = state.logs.findIndex(item => item.id === logId);
  if (index < 0) return;
  const entry = state.logs.splice(index, 1)[0];
  persistState(); renderToday(); renderHistory(); sendProgress();
  toast(t('entryRemoved'), () => {
    if (!state.logs.some(item => item.id === entry.id)) state.logs.push(entry);
    persistState(); renderToday(); renderHistory(); sendProgress();
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
  el('week-average').textContent = amountLabel(stats.average);
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
    const total = document.createElement('strong'); total.textContent = amountLabel(value);
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
  el('reminder-mode-note').textContent = remote?.self?.pushEnabled ? t('v2ReminderPush') : t('v2ReminderFallback');
}
function initProfileForm() {
  el('my-name').value = profile.name;
  el('partner-note').value = profile.note;
  el('note-count').textContent = profile.note.length + '/150';
}
function renderCouple() {
  const configured = backendConfigured() && !!backend?.ready;
  const session = getSession();
  const paired = !!remote?.paired;
  const pending = !!session && !paired;
  el('backend-unavailable').hidden = configured;
  if (!configured) {
    el('backend-unavailable').querySelector('strong').textContent = t('v2SetupNeeded');
    el('backend-unavailable').querySelector('p span').textContent = t('v2SetupNeededDesc');
  }
  el('connect-card').hidden = !configured;
  el('pair-create-box').hidden = !!session;
  el('pair-join-box').hidden = !!session;
  el('pair-create-box').closest('section').querySelector('.or-divider').hidden = !!session;
  el('paired-info').hidden = !session;
  el('paired-description').textContent = paired ? t('v2PairAlready') : t('v2PairWaiting');
  el('pair-invite').hidden = !pending;
  el('couple-status').textContent = paired ? t('v2Connected') : pending ? t('v2WaitingPartner') : t('v2NotPaired');
  el('me-name').textContent = profile.name || t('v2Me');
  const me = todayProgress();
  el('me-progress').textContent = t('v2PartnerToday', { amount: number(me.total), goal: number(me.goal) });
  el('partner-name').textContent = remote?.partner?.name || t('v2Partner');
  el('partner-progress').textContent = remote?.partner ?
    t('v2PartnerToday', { amount: number(remote.partner.total), goal: number(remote.partner.goal) }) : t('v2PartnerPending');
  const enabled = !!remote?.self?.pushEnabled && typeof Notification !== 'undefined' && Notification.permission === 'granted';
  el('push-status').textContent = !configured ? t('v2PushUnavailable') : enabled ? t('v2PushActive') : t('v2PushInactive');
  el('enable-push').disabled = !configured || !session || enabled;
  el('test-push').disabled = !configured || !session || !enabled;
  el('disable-push').hidden = !enabled;
  el('reminder-mode-note').textContent = enabled ? t('v2ReminderPush') : t('v2ReminderFallback');
}
function changeScreen(screen) {
  if (!['today','history','couple','settings'].includes(screen)) return;
  currentScreen = screen;
  for (const name of ['today','history','couple','settings']) el('screen-'+name).hidden = name !== screen;
  document.querySelectorAll('[data-tab]').forEach(button => {
    const selected = button.dataset.tab === screen;
    button.classList.toggle('active',selected);
    if (selected) button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current');
  });
  if (screen === 'history') renderHistory();
  if (screen === 'settings') renderSettings();
  if (screen === 'couple') { renderCouple(); refreshCouple(); }
  window.scrollTo({ top:0, behavior:'auto' });
}
function applyLocale() {
  applyTranslations(lang);
  renderToday();renderHistory();renderSettings();renderCouple();
}
function showDialog(dialog) { if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open',''); }
function closeDialog(dialog) { if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open'); }
function profilePayload() { return { name: profile.name || t('v2Me'), note: profile.note, locale: lang }; }
function schedulePayload() { return { ...state.reminder, locale: lang, timezone }; }
async function refreshCouple() {
  if (!getSession() || !backend?.ready || fetchingCouple) return;
  fetchingCouple = true;
  try { remote = await getCouple(); renderCouple(); }
  catch (err) {
    if (err.status === 401) { clearSession();remote=null; invite=null;renderCouple();toast(t('v2PairAuthLost')); }
  } finally { fetchingCouple = false; }
}
async function safeRemoteSync() {
  if (syncing || !getSession() || !backend?.ready) return;
  syncing = true;
  try { await Promise.all([updateProfile(profilePayload()),updateSchedule(schedulePayload()),updateProgress(todayProgress())]); await refreshCouple(); }
  catch { /* Re-send on the next visit; never interfere with local tracking. */ }
  finally { syncing = false; }
}
async function beginBackend() {
  if (!backendConfigured()) {renderCouple();return;}
  try { backend = await getPublicConfig(); renderCouple(); if (getSession() && backend.ready) { await refreshCouple(); await safeRemoteSync(); } }
  catch { backend=null; renderCouple(); }
}
function pairingError(err) {
  if (err.status === 401) {clearSession();remote=null; renderCouple();toast(t('v2PairAuthLost'));return;}
  toast(t('v2PairError') + (err.status === 403 ? ' ('+err.message+')' : ''));
}
function putInvite(newInvite) {
  invite = newInvite;
  el('invite-code').textContent = newInvite.code || '--------';
  el('pair-invite').hidden = false;
}
function checkForegroundReminder() {
  if (document.hidden || remote?.self?.pushEnabled) return;
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
  lang = button.dataset.lang; setLanguage(lang); applyLocale(); safeRemoteSync();
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
  state.goal=goal;persistState();renderToday();renderSettings();renderCouple();sendProgress();toast(t('goalUpdated'));
});
['remind-start','remind-end','remind-interval'].forEach(name=>el(name).addEventListener('change',previewSchedule));
el('reminder-form').addEventListener('submit',async event=>{
  event.preventDefault(); const start=el('remind-start').value;const end=el('remind-end').value;
  if (!start||!end||start>=end) {toast(t('timeInvalid'));return;}
  state.reminder={enabled:el('remind-enabled').checked,start,end,interval:Number(el('remind-interval').value)};
  state.lastReminderSlot='';persistState();renderNextReminder();
  toast(t(state.reminder.enabled?'remindersSaved':'remindersOff'));
  if (getSession() && backend?.ready) {try{await updateSchedule(schedulePayload());}catch{toast(t('v2PushBackendDown'));}}
});

// Backup is local-only. Device credentials and personal notes are never exported.
el('export-backup').addEventListener('click',()=>{
  const obj={format:'water-reminder-backup',version:1,exportedAt:new Date().toISOString(),data:state};
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
    state=normalizeState(obj.data);persistState();applyLocale();sendProgress();toast(t('backupRestored'));
  }catch(err){toast(err.message||t('backupFailed'));}
});

// Couple identity and one-time pairing.
el('partner-note').addEventListener('input',()=>el('note-count').textContent=el('partner-note').value.length+'/150');
el('profile-form').addEventListener('submit',async event=>{
  event.preventDefault();profile={name:el('my-name').value.trim().slice(0,32),note:el('partner-note').value.slice(0,150)};
  if(!profile.name){toast(t('v2NeedName'));return;}
  saveProfileLocal();renderCouple();toast(t('v2ProfileSaved'));
  if(getSession()&&backend?.ready){try{await updateProfile(profilePayload());await refreshCouple();}catch{toast(t('v2PushBackendDown'));}}
});
el('create-pair').addEventListener('click',async()=>{
  if(!backend?.ready){toast(t('v2PairNeedBackend'));return;}
  const key=el('setup-passphrase').value;
  if(!key){toast(t('v2PairNeedBackend'));return;}
  const button=el('create-pair');button.disabled=true;
  try{
    const response=await createCouple(key,profilePayload());el('setup-passphrase').value='';putInvite(response);
    await safeRemoteSync();await refreshCouple();renderCouple();toast(t('v2PairReady'));
  }catch(err){pairingError(err);}finally{button.disabled=false;}
});
el('join-pair').addEventListener('click',async()=>{
  if(!backend?.ready){toast(t('v2PairNeedBackend'));return;}
  const code=el('join-code').value.trim().toUpperCase();if(code.length!==8){toast(t('v2PairError'));return;}
  const button=el('join-pair');button.disabled=true;
  try{
    await joinCouple(code,profilePayload());invite=null;await safeRemoteSync();await refreshCouple();renderCouple();toast(t('v2PairJoined'));
  }catch(err){pairingError(err);}finally{button.disabled=false;}
});
el('copy-code').addEventListener('click',async()=>{
  if(!invite?.code)return;
  try{await navigator.clipboard.writeText(invite.code);toast(t('v2CopyDone'));}catch{toast(invite.code);}
});
el('refresh-pair').addEventListener('click',async()=>{
  if(!getSession())return;
  try{await refreshCouple();if(!remote?.paired){putInvite(await renewInvite());}toast(t('v2PairRefreshed'));}catch(err){pairingError(err);}
});
el('leave-pair').addEventListener('click',async()=>{
  if(!getSession()||!confirm(t('v2ConfirmLeave')))return;
  try{
    const reg=await navigator.serviceWorker?.ready;const sub=await reg?.pushManager?.getSubscription();if(sub)await sub.unsubscribe();
    await leaveCouple();remote=null;invite=null;renderCouple();toast(t('v2PairLeft'));
  }catch(err){pairingError(err);}
});

// Permission is requested only directly inside the user's click handler.
el('enable-push').addEventListener('click',async()=>{
  if(!getSession()){toast(t('v2PushNeedPair'));return;}
  if(!backend?.ready){toast(t('v2PushUnavailable'));return;}
  const standalone=matchMedia('(display-mode: standalone)').matches || navigator.standalone===true;
  if(!standalone && /iPhone|iPad|iPod/.test(navigator.userAgent)){toast(t('v2PushNeedInstall'));return;}
  if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)){toast(t('v2PushUnsupported'));return;}
  if(Notification.permission==='denied'){toast(t('v2PushDenied'));return;}
  // requestPermission is invoked synchronously by the user's gesture.
  const requestPermission=Notification.requestPermission();
  const button=el('enable-push');button.disabled=true;
  try{
    const permission=await requestPermission;
    if(permission!=='granted'){toast(t('v2PushDenied'));return;}
    const registration=await navigator.serviceWorker.ready;
    const publicKey=backend.vapidPublicKey;
    if(!publicKey)throw Error('Missing VAPID public key');
    const subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:publicKey});
    await registerSubscription(subscription.toJSON());
    await updateSchedule(schedulePayload());
    await refreshCouple();renderCouple();toast(t('v2PushSuccess'));
  }catch(err){console.error('Push subscription error',err);toast(t('v2PushError'));}
  finally{renderCouple();}
});
el('test-push').addEventListener('click',async()=>{
  try{await requestTestPush();toast(t('v2PushTestSuccess'));}
  catch(err){toast(t('v2PushError')+' ('+err.message+')');}
});
el('disable-push').addEventListener('click',async()=>{
  try{
    await unregisterSubscription();
    const registration=await navigator.serviceWorker?.ready;const subscription=await registration?.pushManager?.getSubscription();
    if(subscription)await subscription.unsubscribe();
    await refreshCouple();renderCouple();toast(t('v2PushDisabled'));
  }catch{toast(t('v2PushBackendDown'));}
});

// Keep the existing local data even when the push backend is unconfigured/offline.
applyLocale();initProfileForm();renderCouple();beginBackend();
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{}));
document.addEventListener('visibilitychange',()=>{
  if(document.hidden)return;
  if(localDayKey()!==renderedDay){renderToday();renderHistory();sendProgress();renderedDay=localDayKey();}
  checkForegroundReminder();refreshCouple();
});
setInterval(()=>{
  if(document.hidden)return;
  if(localDayKey()!==renderedDay){renderToday();renderHistory();sendProgress();renderedDay=localDayKey();}
  renderNextReminder();checkForegroundReminder();
},30_000);