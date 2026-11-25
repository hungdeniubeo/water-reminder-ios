import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setupRoutinesAdmin,describeRoutine} from '../routines-admin.js';

test('the slim admin has independently editable daily reminders',()=>{
  const html=readFileSync(new URL('../admin.html',import.meta.url),'utf8');
  const ids=['routine-list','routine-add','routine-form','routine-time','routine-title',
    'routine-body','routine-delete','routine-enabled','routine-cancel','routine-save'];
  for(const id of ids) assert.match(html,new RegExp('id="'+id+'"'),id);
  assert.match(html,/id="schedule-section"/);
  assert.match(html,/id="overview-section"/);
  assert.equal((html.match(/data-routine-day="/g)||[]).length,7);
  assert.match(html,/id="routine-form"[^>]*hidden/);
});
test('reminder editor starts without sending or saving before an admin click',()=>{
  const html=readFileSync(new URL('../admin.html',import.meta.url),'utf8');
  const elements=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(x=>[
    x[1],{value:'',textContent:'',hidden:false,listeners:{},dataset:{},
      addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);},
      replaceChildren(){},classList:{toggle(){}},}
  ]));
  const original=globalThis.document;
  globalThis.document={querySelectorAll:()=>[],getElementById:id=>elements[id]};
  let invoked=false;
  try {
    const app=setupRoutinesAdmin({$:id=>elements[id],api:async()=>{invoked=true;return {routines:[]};}});
    assert.equal(typeof app.ensureLoaded,'function');
    assert.equal(invoked,false,'no API calls before signed-in state is loaded');
  } finally {globalThis.document=original;}
});

function mockElement() {
  return {
    children:[],listeners:{},dataset:{},disabled:false,checked:false,
    textContent:'',value:'',hidden:false,
    classList:{toggle(){}},attributes:{},setAttribute(name,value){this.attributes[name]=value;},
    addEventListener(kind,fn){(this.listeners[kind] ||= []).push(fn);},
    append(...items){this.children.push(...items);},
    replaceChildren(...items){this.children=items.flatMap(x=>x.isFragment?x.children:[x]);},
    scrollIntoView(){this.scrolled=true;},focus(){this.focused=true;}
  };
}
async function fixture(t) {
  const ids=['routines-status','routine-form-status','routine-list','routine-form','routine-form-title',
    'routine-label','routine-title','routine-body','routine-time','routine-enabled','routine-delete',
    'routine-add','routine-cancel','routine-refresh','routine-save','routine-schedule-summary'];
  const nodes=Object.fromEntries(ids.map(id=>[id,mockElement()]));
  const days=[1,2,3,4,5,6,0].map(day=>{const e=mockElement();e.dataset.routineDay=String(day);return e;});
  const presets=[127,62,65].map(mask=>{const e=mockElement();e.dataset.routinePreset=String(mask);return e;});
  const original=globalThis.document;
  globalThis.document={
    querySelectorAll:selector=>selector==='[data-routine-day]'?days:selector==='[data-routine-preset]'?presets:[],createDocumentFragment:()=>Object.assign(mockElement(),{isFragment:true}),
    createElement:()=>mockElement()
  };
  t.after(()=>{globalThis.document=original;});
  let reminders=[
    {id:'lunch',label:'Ăn trưa',title:'BEO ĂN TRƯA ♡',body:'Ăn trưa nha',time:'11:50',days:127,enabled:false},
    {id:'sleep',label:'Đi ngủ',title:'ĐI NGỦ THÔI ♡',body:'Ngủ ngon nha',time:'21:34',days:127,enabled:true}
  ];
  const patches=[];
  const api=async(path,{method,data}={})=>{
    if(path==='/api/admin/routines')return{routines:reminders};
    if(method==='PATCH'){
      const id=path.split('/').at(-1);
      reminders=reminders.map(r=>r.id===id?{...r,...data}:r);
      patches.push({id,...data});
      return {routine:reminders.find(r=>r.id===id)};
    }
    throw new Error('Unexpected '+path);
  };
  setupRoutinesAdmin({$:id=>nodes[id],api}).ensureLoaded();
  await new Promise(resolve=>setImmediate(resolve));
  return {nodes,days,presets,patches};
}
test('Edit and enable buttons are active after initial list load',async t=>{
  const {nodes}=await fixture(t);
  const items=nodes['routine-list'].children;
  assert.equal(items.length,2);
  for(const item of items){
    assert.equal(item.children[1].children[0].disabled,false,'toggle must be active');
    assert.equal(item.children[1].children[1].disabled,false,'Edit must be active');
  }
});
test('Edit opens the matching scheduled reminder and scrolls to form',async t=>{
  const {nodes,days}=await fixture(t);
  const button=nodes['routine-list'].children[0].children[1].children[1];
  await button.listeners.click[0]();
  assert.equal(nodes['routine-form'].hidden,false);
  assert.equal(nodes['routine-form-title'].textContent,'Sửa lời nhắc');
  assert.equal(nodes['routine-label'].value,'Ăn trưa');
  assert.equal(nodes['routine-time'].value,'11:50');
  assert.equal(nodes['routine-title'].value,'BEO ĂN TRƯA ♡');
  assert.equal(nodes['routine-enabled'].checked,false);
  assert.equal(days.every(x=>x.checked),true);
  assert.equal(nodes['routine-form'].scrolled,true);
  assert.equal(nodes['routine-label'].focused,true);
});
test('Enable button updates only the selected reminder',async t=>{
  const {nodes,patches}=await fixture(t);
  const button=nodes['routine-list'].children[0].children[1].children[0];
  await button.listeners.click[0]();
  assert.equal(patches.length,1);
  assert.equal(patches[0].id,'lunch');
  assert.equal(patches[0].enabled,true);
  assert.equal(nodes['routine-list'].children.length,2);
  assert.equal(nodes['routine-list'].children[0].children[1].children[0].disabled,false);
});

test('quick day filters select all, weekdays or weekends without saving until submit',async t=>{
  const {nodes,days,presets,patches}=await fixture(t);
  const edit=nodes['routine-list'].children[0].children[1].children[1];
  await edit.listeners.click[0]();
  assert.match(nodes['routine-schedule-summary'].textContent,/11:50.*Hằng ngày/);
  await presets[1].listeners.click[0]();
  assert.deepEqual(days.map(d=>d.checked),[true,true,true,true,true,false,false]);
  assert.equal(presets[1].attributes['aria-pressed'],'true');
  assert.match(nodes['routine-schedule-summary'].textContent,/Thứ 2–6/);
  await presets[2].listeners.click[0]();
  assert.deepEqual(days.map(d=>d.checked),[false,false,false,false,false,true,true]);
  assert.equal(presets[2].attributes['aria-pressed'],'true');
  assert.equal(presets[1].attributes['aria-pressed'],'false');
  assert.equal(patches.length,0,'quick filters must not call backend');
});

test('manual day changes clear quick selection and clock updates live summary',async t=>{
  const {nodes,days,presets,patches}=await fixture(t);
  await nodes['routine-add'].listeners.click[0]();
  assert.equal(presets[0].attributes['aria-pressed'],'true');
  days[0].checked=false;
  await days[0].listeners.change[0]();
  assert.equal(presets.every(p=>p.attributes['aria-pressed']==='false'),true);
  nodes['routine-time'].value='18:45';
  await nodes['routine-time'].listeners.input[0]();
  assert.match(nodes['routine-schedule-summary'].textContent,/18:45/);
  assert.equal(patches.length,0);
});

test('new effects and day filters are confined to reminder form markup',()=>{
  const html=readFileSync(new URL('../admin.html',import.meta.url),'utf8');
  assert.equal((html.match(/data-routine-preset="/g)||[]).length,3);
  assert.match(html,/id="routine-schedule-summary"/);
  assert.match(html,/class="routine-switch"/);
  const css=readFileSync(new URL('../admin.css',import.meta.url),'utf8');
  assert.match(css,/#routine-form\.routine-editor/);
  assert.match(css,/@media \(prefers-reduced-motion: reduce\)/);
});

test('flexible schedule list labels and advanced fields are available',()=>{
 const base={time:'08:00',days:127};
 assert.match(describeRoutine({...base,schedule:{kind:'repeat',start:'08:00',end:'20:00',interval:60}}).meta,/60 phút/);
 assert.match(describeRoutine({...base,schedule:{kind:'random',start:'09:00',end:'21:00',count:3}}).meta,/Ngẫu nhiên/);
 assert.match(describeRoutine({...base,schedule:{kind:'date',date:'2026-12-25',cycle:'yearly'}}).meta,/25\/12\/2026.*Hằng năm/);
 const html=readFileSync(new URL('../admin.html',import.meta.url),'utf8');
 for(const id of ['routine-kind','routine-window-fields','routine-random-count','routine-date','routine-cycle','routine-copy-mode','routine-variants']) assert.match(html,new RegExp('id="'+id+'"'));
});
