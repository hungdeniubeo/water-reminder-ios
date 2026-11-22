/** Daily and weekly reminder editor; does not change the Cloudflare API contract. */
const DAYS = [
  {day:1,label:'T2'}, {day:2,label:'T3'}, {day:3,label:'T4'},
  {day:4,label:'T5'}, {day:5,label:'T6'}, {day:6,label:'T7'}, {day:0,label:'CN'}
];
const everyDay = 127;
const weekdayMask = 62;
const weekendMask = 65;
const describeDays = mask => mask === everyDay ? 'Hằng ngày' : mask === weekdayMask ? 'Thứ 2–6' :
  DAYS.filter(d => mask & (1 << d.day)).map(d => d.label).join(', ');

const TEMPLATES = Object.freeze({
  work:{label:'Đi làm',time:'08:00',days:62,title:'BEO ƠI, CHUẨN BỊ ĐI LÀM NHA ♡',body:'Chúc em một ngày làm việc suôn sẻ nha.'},
  lunch:{label:'Ăn trưa',time:'11:50',days:127,title:'BEO ƠI, ĐẾN GIỜ ĂN TRƯA ♡',body:'Nghỉ tay ăn trưa một chút nha em.'},
  rest:{label:'Nghỉ ngơi',time:'15:00',days:127,title:'BEO ƠI, NGHỈ MỘT CHÚT NHA ♡',body:'Em nghỉ tay, thư giãn một xíu rồi mình làm tiếp nha.'},
  sleep:{label:'Đi ngủ',time:'22:00',days:127,title:'BEO ƠI, NGỦ NGON NHA ♡',body:'Hết ngày rồi, em ngủ ngon nhé ♡'}
});

export function setupRoutinesAdmin({ $, api, onFormOpen = () => {}, onChange = () => {} }) {
  let reminders = [];
  let initialized = false;
  let busy = false;
  let editing = null;
  let lastFocus = null;
  const status = (value='',tone='') => { $('routines-status').textContent = value; $('routines-status').dataset.tone = tone; };
  const formStatus = (value='',tone='') => { $('routine-form-status').textContent = value; $('routine-form-status').dataset.tone = tone; };
  const weekdays = () => [...(document.querySelectorAll?.('[data-routine-day]') || [])];
  const quickDays = () => [...(document.querySelectorAll?.('[data-routine-preset]') || [])];
  const checkedDays = () => weekdays().reduce((mask,item) => item.checked ? mask | (1 << Number(item.dataset.routineDay)) : mask,0);
  const setDays = mask => weekdays().forEach(box => { box.checked = !!(mask & (1 << Number(box.dataset.routineDay))); });

  function syncScheduleSummary() {
    const mask = checkedDays();
    for (const button of quickDays()) {
      const selected = Number(button.dataset.routinePreset) === mask;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
    }
    const time = $('routine-time').value || '12:00';
    $('routine-schedule-summary').textContent = mask
      ? 'Nhắc lúc ' + time + ' · ' + describeDays(mask)
      : 'Chọn ít nhất một ngày để lưu lời nhắc.';
  }
  const draft = () => ({
    label:$('routine-label').value.trim(),title:$('routine-title').value.trim(),
    body:$('routine-body').value.trim(),time:$('routine-time').value,
    days:checkedDays(),enabled:$('routine-enabled').checked
  });

  function render() {
    const list = $('routine-list');
    const fragment = document.createDocumentFragment();
    if (!reminders.length) {
      const empty = document.createElement('li'); empty.className = 'routine-empty';
      empty.textContent = 'Chưa có lời nhắc nào. Tạo một lời nhắc để bắt đầu nhé.'; fragment.append(empty);
    }
    for (const routine of reminders.slice().sort((a,b) => a.time.localeCompare(b.time))) {
      const item = document.createElement('li'); item.className = 'routine-item' + (routine.enabled?'':' is-disabled');
      const copy = document.createElement('div'); copy.className = 'routine-copy';
      const time = document.createElement('span'); time.className = 'routine-time-bubble'; time.textContent = routine.time;
      const contents = document.createElement('div'); contents.className = 'routine-text';
      const name = document.createElement('strong'); name.textContent = routine.label;
      const meta = document.createElement('small'); meta.textContent = describeDays(routine.days);
      const preview = document.createElement('small'); preview.className = 'routine-preview-line'; preview.textContent = routine.body;
      contents.append(name,meta,preview); copy.append(time,contents);
      const actions = document.createElement('div'); actions.className = 'routine-actions';
      const toggle = document.createElement('button'); toggle.type = 'button';
      toggle.className = 'routine-toggle ' + (routine.enabled ? 'is-on':'');
      toggle.textContent = routine.enabled ? 'Đang bật' : 'Đã tắt';
      toggle.setAttribute('aria-label',(routine.enabled?'Tắt ':'Bật ')+routine.label);
      toggle.setAttribute('aria-pressed', String(routine.enabled));
      toggle.disabled = busy;
      toggle.addEventListener('click', async () => {
        if (busy) return;
        await saveRoutine(routine.id,{...routine,enabled:!routine.enabled},false);
      });
      const edit = document.createElement('button'); edit.type='button'; edit.className='inline-link';
      edit.textContent='Sửa'; edit.disabled=busy; edit.setAttribute('aria-label','Sửa '+routine.label);
      edit.addEventListener('click',()=>{ if(!busy) openForm(routine); });
      actions.append(toggle,edit); item.append(copy,actions); fragment.append(item);
    }
    list.replaceChildren(fragment);
    const enabled = reminders.filter(item=>item.enabled).length;
    if ($('routine-overview-text')) $('routine-overview-text').textContent = !reminders.length
      ? 'Chưa có lời nhắc nào' : `${reminders.length} lời nhắc đã tạo · ${enabled} đang bật`;
    if ($('routine-count')) $('routine-count').textContent = enabled+' bật';
    onChange(reminders.slice());
  }

  function openForm(item=null, template=null) {
    if (busy) return;
    editing = item?.id||null;
    lastFocus = globalThis.document?.activeElement || null;
    const source = item || (template && TEMPLATES[template]) || {};
    $('routine-form-title').textContent = item ? 'Sửa lời nhắc' : 'Tạo lời nhắc mới';
    $('routine-label').value = source.label || '';
    $('routine-title').value = source.title || '';
    $('routine-body').value = source.body || '';
    $('routine-time').value = source.time || '12:00';
    $('routine-enabled').checked = item ? item.enabled : true;
    setDays(source.days ?? everyDay);
    syncScheduleSummary();
    $('routine-delete').hidden = !item;
    $('routine-form').hidden = false;
    if ($('routine-editor-backdrop')) $('routine-editor-backdrop').hidden = false;
    globalThis.document?.body?.classList?.add('editor-open');
    formStatus(); status();
    onFormOpen();
    $('routine-form').scrollIntoView?.({behavior:'smooth',block:'nearest'});
    $('routine-label').focus?.({preventScroll:true});
  }
  function closeForm() {
    $('routine-form').hidden = true; editing = null; formStatus();
    if ($('routine-editor-backdrop')) $('routine-editor-backdrop').hidden = true;
    globalThis.document?.body?.classList?.remove('editor-open');
    lastFocus?.focus?.({preventScroll:true}); lastFocus = null;
  }
  async function load() {
    if (busy) return;
    busy=true; status('Đang tải lịch…');
    try {
      const result = await api('/api/admin/routines');
      reminders = Array.isArray(result.routines) ? result.routines : [];
      status();
    } catch(error) {
      status(error.status===404||error.status===503
        ? 'Lịch hằng ngày chưa có trên máy chủ. Cần kiểm tra Worker để sử dụng.'
        : error.message||'Không tải được lịch. Kiểm tra mạng rồi thử lại.','error');
    } finally {busy=false;render();}
  }
  async function saveRoutine(id,data,close=true) {
    if (busy) return;
    busy = true; formStatus('Đang lưu…');
    try {
      await api(id?'/api/admin/routines/'+encodeURIComponent(id):'/api/admin/routines',{
        method:id?'PATCH':'POST',data
      });
      if (close) closeForm();
      busy=false;
      await load();
      status('Đã lưu lời nhắc.','success');
    } catch(error) {
      formStatus(error.message||'Không lưu được. Thử lại nhé.','error');
      status(error.message||'Không lưu được lịch.','error');
    } finally { busy=false; }
  }

  for (const button of quickDays()) button.addEventListener('click',()=>{
    const mask=Number(button.dataset.routinePreset);
    if (![everyDay,weekdayMask,weekendMask].includes(mask)) return;
    setDays(mask);syncScheduleSummary();
  });
  for (const box of weekdays()) box.addEventListener('change',syncScheduleSummary);
  $('routine-time').addEventListener('input',syncScheduleSummary);
  $('routine-time').addEventListener('change',syncScheduleSummary);
  $('routine-add').addEventListener('click',()=>openForm());
  $('routine-cancel').addEventListener('click',closeForm);
  $('routine-close')?.addEventListener('click',closeForm);
  $('routine-editor-backdrop')?.addEventListener('click',closeForm);
  $('routine-refresh').addEventListener('click',load);
  for (const button of (document.querySelectorAll?.('[data-reminder-template]') || [])) {
    button.addEventListener('click',()=>openForm(null,button.dataset.reminderTemplate));
  }
  document.addEventListener?.('keydown',event=>{
    if ($('routine-form').hidden) return;
    if (event.key==='Escape') {
      if (document.querySelector?.('.time-picker-panel:not([hidden])')) return;
      event.preventDefault(); closeForm(); return;
    }
    if (event.key!=='Tab') return;
    const focusables=[...($('routine-form').querySelectorAll?.('button:not([disabled]):not([hidden]), input:not([disabled]),textarea:not([disabled])')||[])].filter(el=>!el.closest?.('[hidden]'));
    if (!focusables.length) return;
    const first=focusables[0],last=focusables[focusables.length-1];
    if (event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  $('routine-form').addEventListener('submit',async event=>{
    event.preventDefault();
    if (!$('routine-form').reportValidity()) return;
    const data=draft();
    if (!data.days){formStatus('Chọn ít nhất một ngày trong tuần.','error');return;}
    await saveRoutine(editing,data);
  });
  $('routine-delete').addEventListener('click',async()=>{
    if (!editing||busy||!window.confirm('Xóa lời nhắc này? Các lịch khác vẫn được giữ.')) return;
    busy=true;formStatus('Đang xóa…');
    try {
      await api('/api/admin/routines/'+encodeURIComponent(editing),{method:'DELETE',data:{}});
      closeForm();busy=false;await load();status('Đã xóa lời nhắc.','success');
    } catch(error){formStatus(error.message||'Chưa xóa được.','error');}
    finally{busy=false;}
  });
  return {
    ensureLoaded(){if(initialized)return;initialized=true;void load();},
    openNew(template){openForm(null,template);},
    reset(){initialized=false;reminders=[];editing=null;closeForm();$('routine-list').replaceChildren();status();onChange([]);}
  };
}
