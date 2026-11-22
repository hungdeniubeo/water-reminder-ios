/** Small, self-contained editor for one-time-of-day reminders. */
const DAYS = [
  {day:1,label:'T2'}, {day:2,label:'T3'}, {day:3,label:'T4'},
  {day:4,label:'T5'}, {day:5,label:'T6'}, {day:6,label:'T7'}, {day:0,label:'CN'}
];
const everyDay = 127;
const weekdayMask = 62;
const describeDays = mask => mask === everyDay ? 'Hằng ngày' : mask === weekdayMask ? 'Thứ 2–6' :
  DAYS.filter(d => mask & (1 << d.day)).map(d => d.label).join(', ');

export function setupRoutinesAdmin({ $, api }) {
  let reminders = [];
  let initialized = false;
  let busy = false;
  let editing = null;
  const status = (value='',tone='') => {
    $('routines-status').textContent = value;
    $('routines-status').dataset.tone = tone;
  };
  const formStatus = (value='',tone='') => {
    $('routine-form-status').textContent = value;
    $('routine-form-status').dataset.tone = tone;
  };
  const weekdays = () => [...document.querySelectorAll('[data-routine-day]')];
  const checkedDays = () => weekdays().reduce((mask,item) => item.checked ? mask | (1 << Number(item.dataset.routineDay)) : mask,0);
  const setDays = mask => weekdays().forEach(box => { box.checked = !!(mask & (1 << Number(box.dataset.routineDay))); });
  const draft = () => ({
    label:$('routine-label').value.trim(),title:$('routine-title').value.trim(),
    body:$('routine-body').value.trim(),time:$('routine-time').value,
    days:checkedDays(),enabled:$('routine-enabled').checked
  });
  function render() {
    const list = $('routine-list');
    const fragment = document.createDocumentFragment();
    if (!reminders.length) {
      const empty = document.createElement('li');empty.className='routine-empty';
      empty.textContent='Chưa có lịch riêng. Bấm Thêm lời nhắc để tạo nhé.';fragment.append(empty);
    }
    for(const routine of reminders) {
      const item=document.createElement('li');item.className='routine-item';
      const copy=document.createElement('div');copy.className='routine-copy';
      const name=document.createElement('strong');name.textContent=routine.label;
      const meta=document.createElement('small');meta.textContent=routine.time+' · '+describeDays(routine.days);
      copy.append(name,meta);
      const actions=document.createElement('div');actions.className='routine-actions';
      const toggle=document.createElement('button');toggle.type='button';
      toggle.className='routine-toggle '+(routine.enabled?'is-on':'');
      toggle.textContent=routine.enabled?'Đang bật':'Đã tắt';
      toggle.setAttribute('aria-label',(routine.enabled?'Tắt ':'Bật ')+routine.label);
      toggle.disabled=busy;
      toggle.addEventListener('click',async()=>{
        if(busy)return;
        await saveRoutine(routine.id,{...routine,enabled:!routine.enabled},false);
      });
      const edit=document.createElement('button');edit.type='button';edit.className='inline-link';
      edit.textContent='Sửa';edit.disabled=busy;edit.setAttribute('aria-label','Sửa '+routine.label);
      edit.addEventListener('click',()=>{ if (!busy) openForm(routine); });
      actions.append(toggle,edit);item.append(copy,actions);fragment.append(item);
    }
    list.replaceChildren(fragment);
  }
  function openForm(item=null) {
    editing=item?.id||null;
    $('routine-form-title').textContent=item?'Sửa lời nhắc':'Thêm lời nhắc';
    $('routine-label').value=item?.label||'';
    $('routine-title').value=item?.title||'';
    $('routine-body').value=item?.body||'';
    $('routine-time').value=item?.time||'12:00';
    $('routine-enabled').checked=item?item.enabled:true;
    setDays(item?.days??everyDay);
    $('routine-delete').hidden=!item;
    $('routine-form').hidden=false;
    formStatus();status();
    $('routine-form').scrollIntoView?.({behavior:'smooth',block:'nearest'});
    $('routine-label').focus?.({preventScroll:true});
  }
  function closeForm(){$('routine-form').hidden=true;editing=null;formStatus();}
  async function load() {
    if(busy)return;
    busy=true;status('Đang tải lịch…');
    try {
      const result=await api('/api/admin/routines');
      reminders=Array.isArray(result.routines)?result.routines:[];
      status();
    } catch(error) {
      status(error.status===404||error.status===503
        ? 'Lịch mới chưa được triển khai trên Cloudflare. Lịch uống nước cũ vẫn hoạt động.'
        : error.message||'Không tải được lịch. Kiểm tra mạng rồi thử lại.','error');
    } finally {
      // Buttons must be rendered after busy is cleared, or they stay disabled.
      busy=false;
      render();
    }
  }
  async function saveRoutine(id,data,close=true) {
    if(busy)return;
    busy=true;formStatus('Đang lưu…');
    try {
      await api(id?'/api/admin/routines/'+encodeURIComponent(id):'/api/admin/routines',{
        method:id?'PATCH':'POST',data
      });
      if(close)closeForm();
      // Release the lock before reloading from the server.
      busy=false;
      await load();
      status('Đã lưu lịch nhắc ♡','success');
    } catch(error) {
      formStatus(error.message||'Không lưu được. Thử lại nhé.','error');
      status(error.message||'Không lưu được lịch.','error');
    } finally {busy=false;}
  }
  $('routine-add').addEventListener('click',()=>openForm());
  $('routine-cancel').addEventListener('click',closeForm);
  $('routine-refresh').addEventListener('click',load);
  $('routine-form').addEventListener('submit',async event=>{
    event.preventDefault();
    if(!$('routine-form').reportValidity())return;
    const data=draft();
    if(!data.days){formStatus('Chọn ít nhất một ngày trong tuần.','error');return;}
    await saveRoutine(editing,data);
  });
  $('routine-delete').addEventListener('click',async()=>{
    if(!editing||busy||!window.confirm('Xóa lời nhắc này? Lịch uống nước và các lịch khác vẫn được giữ.'))return;
    busy=true;formStatus('Đang xóa…');
    try {
      await api('/api/admin/routines/'+encodeURIComponent(editing),{method:'DELETE',data:{}});
      closeForm();busy=false;await load();status('Đã xóa lời nhắc.','success');
    } catch(error) {formStatus(error.message||'Chưa xóa được.','error');}
    finally{busy=false;}
  });
  return {
    ensureLoaded() {if(initialized)return;initialized=true;void load();},
    reset(){initialized=false;reminders=[];editing=null;closeForm();$('routine-list').replaceChildren();status();}
  };
}
