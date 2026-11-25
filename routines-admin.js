/** Fixed, repeated, random and date reminder editor. */
import { validSchedule, MAX_MESSAGE_VARIANTS } from './routine-schedule.js?v=20261125-flexible-v1';
const DAYS = [
  {day:1,label:'T2'}, {day:2,label:'T3'}, {day:3,label:'T4'},
  {day:4,label:'T5'}, {day:5,label:'T6'}, {day:6,label:'T7'}, {day:0,label:'CN'}
];
const everyDay = 127;
const weekdayMask = 62;
const weekendMask = 65;
const describeDays = mask => mask === everyDay ? 'Hằng ngày' : mask === weekdayMask ? 'Thứ 2–6' :
  DAYS.filter(d => mask & (1 << d.day)).map(d => d.label).join(', ');

const cycleName=cycle=>({once:'Một lần',monthly:'Hằng tháng',yearly:'Hằng năm'})[cycle]||'';
const dateLabel=date=>date?date.split('-').reverse().join('/'):'';
export function describeRoutine(r) {
  const s=r.schedule||{kind:'fixed'},days=describeDays(r.days);
  if(s.kind==='repeat') return {badge:'↻ '+s.interval+'′',meta:s.start+'–'+s.end+' · '+days+' · Mỗi '+s.interval+' phút'};
  if(s.kind==='random') return {badge:s.count+' lần',meta:'Ngẫu nhiên · '+s.start+'–'+s.end+' · '+days};
  if(s.kind==='date') return {badge:r.time,meta:dateLabel(s.date)+' · '+cycleName(s.cycle)};
  return {badge:r.time,meta:days};
}
const TEMPLATES = Object.freeze({
  work:{label:'Đi làm',time:'08:00',days:62,title:'BEO ƠI, CHUẨN BỊ ĐI LÀM NHA ♡',body:'Chúc em một ngày làm việc suôn sẻ nha.'},
  lunch:{label:'Ăn trưa',time:'11:50',days:127,title:'BEO ƠI, ĐẾN GIỜ ĂN TRƯA ♡',body:'Nghỉ tay ăn trưa một chút nha em.'},
  rest:{label:'Nghỉ ngơi',time:'15:00',days:127,title:'BEO ƠI, NGHỈ MỘT CHÚT NHA ♡',body:'Em nghỉ tay, thư giãn một xíu rồi mình làm tiếp nha.'},
  sleep:{label:'Đi ngủ',time:'22:00',days:127,title:'BEO ƠI, NGỦ NGON NHA ♡',body:'Hết ngày rồi, em ngủ ngon nhé ♡'},
  water:{label:'Uống nước',time:'08:00',days:127,title:'Beo ơi, uống nước nha ♡',body:'Em nhớ uống một chút nước nhé.',schedule:{kind:'repeat',start:'08:00',end:'20:00',interval:60,messages:[{title:'Cục cưng ơi ♡',body:'Nghỉ tay uống một ngụm nước nè.'},{title:'Nhắc Beo một chút',body:'Bé nhớ chăm sóc bản thân nha.'}]}},
  surprise:{label:'Nhắn Beo bất ngờ',time:'09:00',days:127,title:'Anh nhớ Beo ♡',body:'Gửi em một chút yêu thương.',schedule:{kind:'random',start:'09:00',end:'21:00',count:3,messages:[{title:'Thương Beo ♡',body:'Bé đang làm gì đó?'},{title:'Một lời nhắn nhỏ',body:'Anh mong hôm nay em có một ngày thật vui.'}]}},
  eyes:{label:'Nghỉ mắt',time:'09:00',days:62,title:'Beo ơi, nghỉ mắt nha ♡',body:'Nhìn ra xa và nghỉ tay một chút nhé.',schedule:{kind:'repeat',start:'09:00',end:'17:00',interval:90}}
});

export function setupRoutinesAdmin({ $, api, onFormOpen = () => {}, onChange = () => {}, onLegacyEdit = () => {}, onLegacyToggle = async () => {}, today = () => new Date().toISOString().slice(0,10) }) {
  let reminders = [];
  let initialized = false;
  let busy = false;
  let editing = null;
  let lastFocus = null;
  let advanced = false, legacy = null, variantSerial=0, variantRows=[], generation=0;
  const status = (value='',tone='') => { $('routines-status').textContent = value; $('routines-status').dataset.tone = tone; };
  const formStatus = (value='',tone='') => { $('routine-form-status').textContent = value; $('routine-form-status').dataset.tone = tone; };
  const weekdays = () => [...(document.querySelectorAll?.('[data-routine-day]') || [])];
  const quickDays = () => [...(document.querySelectorAll?.('[data-routine-preset]') || [])];
  const checkedDays = () => weekdays().reduce((mask,item) => item.checked ? mask | (1 << Number(item.dataset.routineDay)) : mask,0);
  const setDays = mask => weekdays().forEach(box => { box.checked = !!(mask & (1 << Number(box.dataset.routineDay))); });

  const kind = () => advanced ? ($('routine-kind')?.value || 'fixed') : 'fixed';
  const value = (id,fallback='') => $(id)?.value || fallback;
  function toggleField(id,show) { const el=$(id); if(el){el.hidden=!show; el.disabled=!show;} }
  function syncAvailability() {
    toggleField('routine-kind-fields',advanced);
    toggleField('routine-copy-fields',advanced);
    if($('routine-upgrade-note')) $('routine-upgrade-note').hidden=advanced;
    for(const button of document.querySelectorAll?.('[data-advanced-template]')||[]) button.hidden=!advanced;
  }
  function syncFields() {
    const k=kind(),windowed=k==='repeat'||k==='random';
    toggleField('routine-time-fields',!windowed);
    $('routine-time').disabled=windowed;
    toggleField('routine-window-fields',windowed);
    toggleField('routine-repeat-fields',k==='repeat');
    toggleField('routine-random-fields',k==='random');
    toggleField('routine-date-fields',k==='date');
    toggleField('routine-days-fields',k!=='date');
    if($('routine-interval')) $('routine-interval').disabled=k!=='repeat';
    if($('routine-random-count')) $('routine-random-count').disabled=k!=='random';
    if($('routine-kind-hint')) $('routine-kind-hint').textContent=({fixed:'Nhắc đúng giờ vào các ngày đã chọn.',repeat:'Lặp theo số phút trong khung giờ mỗi ngày.',random:'Tự chọn giờ khác nhau theo từng ngày.',date:'Nhắc một lần hoặc theo tháng, năm.'})[k];
    syncScheduleSummary();
  }
  function variantValues() {return variantRows.map(row=>({title:row.title.value.trim(),body:row.body.value.trim()}));}
  function syncVariants() {
    const show=advanced&&value('routine-copy-mode')==='random';
    toggleField('routine-variants-panel',show);
    for(const row of variantRows){row.title.disabled=!show;row.body.disabled=!show;}
    if($('routine-variant-add')) $('routine-variant-add').disabled=variantRows.length>=MAX_MESSAGE_VARIANTS-1;
  }
  function addVariant(message={}) {
    const list=$('routine-variants');
    if(!list||variantRows.length>=MAX_MESSAGE_VARIANTS-1) return;
    const serial=++variantSerial;
    const row=document.createElement('div');row.className='routine-variant';
    const heading=document.createElement('div');heading.className='variant-heading';
    const name=document.createElement('span');name.textContent='Nội dung khác';
    const remove=document.createElement('button');remove.type='button';remove.className='inline-link danger-link';remove.textContent='Xóa';
    const title=document.createElement('input');title.id='routine-variant-title-'+serial;title.maxLength=70;title.required=true;title.value=message.title||'';
    const titleLabel=document.createElement('label');titleLabel.htmlFor=title.id;titleLabel.textContent='Tiêu đề';
    const body=document.createElement('textarea');body.id='routine-variant-body-'+serial;body.maxLength=150;body.required=true;body.rows=2;body.value=message.body||'';
    const bodyLabel=document.createElement('label');bodyLabel.htmlFor=body.id;bodyLabel.textContent='Lời nhắn';
    const record={row,title,body};
    remove.addEventListener('click',()=>{variantRows=variantRows.filter(item=>item!==record);if(row.remove)row.remove();else list.replaceChildren(...variantRows.map(item=>item.row));syncVariants();});
    heading.append(name,remove);row.append(heading,titleLabel,title,bodyLabel,body);list.append(row);variantRows.push(record);syncVariants();
  }
  function fillAdvanced(source) {
    const s=source.schedule||{kind:'fixed'};
    for(const [id,v] of Object.entries({'routine-kind':s.kind,'routine-start':s.start||'09:00','routine-end':s.end||'21:00','routine-interval':s.interval||60,'routine-random-count':s.count||3,'routine-date':s.date||today(),'routine-cycle':s.cycle||'once','routine-copy-mode':s.messages?.length?'random':'fixed'})) if($(id)) $(id).value=String(v);
    variantRows=[];$('routine-variants')?.replaceChildren();
    for(const message of s.messages||[]) addVariant(message);
    syncAvailability();syncVariants();syncFields();
  }
  function scheduleDraft() {
    const k=kind(),s={kind:k,messages:value('routine-copy-mode')==='random'?variantValues():[]};
    if(k==='repeat'||k==='random') Object.assign(s,{start:value('routine-start'),end:value('routine-end')});
    if(k==='repeat') s.interval=Number(value('routine-interval'));
    if(k==='random') s.count=Number(value('routine-random-count'));
    if(k==='date') Object.assign(s,{date:value('routine-date'),cycle:value('routine-cycle')});
    return s;
  }
  function syncScheduleSummary() {
    const mask = checkedDays();
    for (const button of quickDays()) {
      const selected = Number(button.dataset.routinePreset) === mask;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
    }
    const time=$('routine-time').value||'12:00',k=kind(),s=scheduleDraft();
    let summary='';
    if(k==='date') summary='Nhắc lúc '+time+' · '+dateLabel(s.date)+' · '+cycleName(s.cycle);
    else if(!mask) summary='Chọn ít nhất một ngày để lưu lời nhắc.';
    else if(k==='repeat') summary='Mỗi '+s.interval+' phút · '+s.start+'–'+s.end+' · '+describeDays(mask);
    else if(k==='random') summary=s.count+' lần ngẫu nhiên · '+s.start+'–'+s.end+' · '+describeDays(mask);
    else summary='Nhắc lúc '+time+' · '+describeDays(mask);
    $('routine-schedule-summary').textContent=summary;
  }
  const draft = () => {
    const s=scheduleDraft(),windowed=s.kind==='repeat'||s.kind==='random';
    const data={label:$('routine-label').value.trim(),title:$('routine-title').value.trim(),
      body:$('routine-body').value.trim(),time:windowed?s.start:$('routine-time').value,
      days:s.kind==='date'?everyDay:checkedDays(),enabled:$('routine-enabled').checked};
    if(advanced) data.schedule=s;
    return data;
  };

  function render() {
    const list = $('routine-list');
    const fragment = document.createDocumentFragment();
    const all=legacy?[...reminders,legacy]:reminders;
    if (!all.length) {
      const empty = document.createElement('li'); empty.className = 'routine-empty';
      empty.textContent = 'Chưa có lời nhắc nào. Tạo một lời nhắc để bắt đầu nhé.'; fragment.append(empty);
    }
    for (const routine of all.slice().sort((a,b) => a.time.localeCompare(b.time))) {
      const item = document.createElement('li'); item.className = 'routine-item' + (routine.enabled?'':' is-disabled');
      const copy = document.createElement('div'); copy.className = 'routine-copy';
      const description=describeRoutine(routine);
      const time = document.createElement('span'); time.className = 'routine-time-bubble'+(['repeat','random'].includes(routine.schedule?.kind)?' flexible':''); time.textContent = description.badge;
      const contents = document.createElement('div'); contents.className = 'routine-text';
      const name = document.createElement('strong'); name.textContent = routine.label;
      const meta = document.createElement('small'); meta.textContent = description.meta+(routine.schedule?.messages?.length?' · '+(routine.schedule.messages.length+1)+' nội dung':'');
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
        if(routine.legacy) {
          const session=generation;busy=true;render();
          try{await onLegacyToggle(!routine.enabled);if(session===generation)status('Đã lưu lịch lặp.','success');}
          catch(error){if(session===generation)status(error.message||'Không lưu được lịch lặp.','error');}
          finally{if(session===generation){busy=false;render();}}
        } else await saveRoutine(routine.id,{...routine,enabled:!routine.enabled},false);
      });
      const edit = document.createElement('button'); edit.type='button'; edit.className='inline-link';
      edit.textContent='Sửa'; edit.disabled=busy; edit.setAttribute('aria-label','Sửa '+routine.label);
      edit.addEventListener('click',()=>{ if(!busy) { if(routine.legacy)onLegacyEdit(); else openForm(routine); } });
      actions.append(toggle,edit); item.append(copy,actions); fragment.append(item);
    }
    list.replaceChildren(fragment);
    const enabled = all.filter(item=>item.enabled).length;
    if ($('routine-overview-text')) $('routine-overview-text').textContent = !all.length
      ? 'Chưa có lời nhắc nào' : `${all.length} lời nhắc · ${enabled} đang bật`;
    if ($('routine-count')) $('routine-count').textContent = enabled+' bật';
    onChange(reminders.slice());
  }

  function openForm(item=null, template=null) {
    if (busy) return;
    editing = item?.id||null;
    lastFocus = globalThis.document?.activeElement || null;
    const source = item || (template && TEMPLATES[template]) || {};
    if(source.schedule&&!advanced){status('Cần cập nhật Worker và database để dùng lịch mới.','error');return;}
    $('routine-form-title').textContent = item ? 'Sửa lời nhắc' : 'Tạo lời nhắc mới';
    $('routine-label').value = source.label || '';
    $('routine-title').value = source.title || '';
    $('routine-body').value = source.body || '';
    $('routine-time').value = source.time || '12:00';
    $('routine-enabled').checked = item ? item.enabled : true;
    setDays(source.days ?? everyDay);
    fillAdvanced(source);
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
    const session=generation;busy=true; status('Đang tải lịch…');
    try {
      const result = await api('/api/admin/routines');
      if(session!==generation)return;
      reminders = Array.isArray(result.routines) ? result.routines : [];
      advanced=result.advanced===true;syncAvailability();
      status();
    } catch(error) {
      if(session!==generation)return;
      status(error.status===404||error.status===503
        ? 'Lịch hằng ngày chưa có trên máy chủ. Cần kiểm tra Worker để sử dụng.'
        : error.message||'Không tải được lịch. Kiểm tra mạng rồi thử lại.','error');
    } finally {if(session===generation){busy=false;render();}}
  }
  async function saveRoutine(id,data,close=true) {
    if (busy) return;
    const session=generation;busy = true; formStatus('Đang lưu…');
    if($('routine-save')) $('routine-save').disabled=true;
    render();
    try {
      const result=await api(id?'/api/admin/routines/'+encodeURIComponent(id):'/api/admin/routines',{
        method:id?'PATCH':'POST',data
      });
      if(session!==generation)return;
      if(result.routine) reminders=id?reminders.map(r=>r.id===id?result.routine:r):[...reminders,result.routine];
      if (close) closeForm();
      busy=false;
      await load();
      if(session===generation)status('Đã lưu lời nhắc.','success');
    } catch(error) {
      if(session!==generation)return;
      formStatus(error.message||'Không lưu được. Thử lại nhé.','error');
      status(error.message||'Không lưu được lịch.','error');
    } finally { if(session===generation){busy=false;if($('routine-save')) $('routine-save').disabled=false;render();} }
  }

  $('routine-kind')?.addEventListener('change',syncFields);
  for(const id of ['routine-start','routine-end','routine-interval','routine-random-count','routine-date','routine-cycle']) {
    $(id)?.addEventListener('input',syncScheduleSummary);$(id)?.addEventListener('change',syncScheduleSummary);
  }
  $('routine-copy-mode')?.addEventListener('change',()=>{if(value('routine-copy-mode')==='random'&&!variantRows.length)addVariant();syncVariants();});
  $('routine-variant-add')?.addEventListener('click',()=>addVariant());

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
    const focusables=[...($('routine-form').querySelectorAll?.('button:not([disabled]):not([hidden]), input:not([disabled]),textarea:not([disabled]),select:not([disabled])')||[])].filter(el=>!el.closest?.('[hidden]'));
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
    if(data.schedule&&!validSchedule(data.schedule)){formStatus('Kiểm tra ngày, khung giờ, số lần nhắc và nội dung. Lịch ngẫu nhiên cần cách nhau ít nhất 15 phút.','error');return;}
    if(advanced&&value('routine-copy-mode')==='random'&&!data.schedule.messages.length){formStatus('Thêm ít nhất một nội dung khác hoặc chọn nội dung cố định.','error');return;}
    await saveRoutine(editing,data);
  });
  $('routine-delete').addEventListener('click',async()=>{
    if (!editing||busy||!window.confirm('Xóa lời nhắc này? Các lịch khác vẫn được giữ.')) return;
    const session=generation;busy=true;formStatus('Đang xóa…');
    try {
      await api('/api/admin/routines/'+encodeURIComponent(editing),{method:'DELETE',data:{}});
      if(session!==generation)return;
      reminders=reminders.filter(r=>r.id!==editing);closeForm();busy=false;await load();if(session===generation)status('Đã xóa lời nhắc.','success');
    } catch(error){if(session===generation)formStatus(error.message||'Chưa xóa được.','error');}
    finally{if(session===generation){busy=false;render();}}
  });
  return {
    ensureLoaded(){if(initialized)return;initialized=true;return load();},
    openNew(template){openForm(null,template);},
    setLegacySettings(settings) {
      const next=settings?{id:'legacy-water',legacy:true,label:'Nhắc lặp có sẵn',title:settings.notificationTitle,body:settings.reminderMessage,time:settings.start,days:127,enabled:!!settings.enabled,schedule:{kind:'repeat',start:settings.start,end:settings.end,interval:settings.interval}}:null;
      if(JSON.stringify(next)!==JSON.stringify(legacy)){legacy=next;render();}
    },
    reset(){generation++;busy=false;initialized=false;reminders=[];legacy=null;advanced=false;editing=null;variantRows=[];closeForm();syncAvailability();if($('routine-save'))$('routine-save').disabled=false;$('routine-list').replaceChildren();status();onChange([]);}
  };
}
