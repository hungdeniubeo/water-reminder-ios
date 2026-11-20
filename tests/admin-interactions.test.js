import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createAdminFeatures} from '../admin-features.js';

const html=readFileSync(new URL('../admin.html',import.meta.url),'utf8');
const makeNode=()=>({
  textContent:'',value:'',disabled:false,hidden:false,dataset:{},children:[],listeners:{},
  classList:{toggle(name,yes){this[name]=yes;}},
  setAttribute(){},focus(){},scrollIntoView(){},
  append(...values){this.children.push(...values);},replaceChildren(...values){this.children=values;},
  addEventListener(name,fn){(this.listeners[name] ||= []).push(fn);}
});
const settle=async()=>{for(let i=0;i<3;i++)await new Promise(resolve=>setImmediate(resolve));};
async function withFeatures(run) {
  const ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
  const nodes=Object.fromEntries(ids.map(id=>[id,makeNode()]));
  const presets=[...html.matchAll(/<button[^>]+data-interval="(\d+)"[^>]*>/g)].map(m=>{
    const button=makeNode();button.dataset.interval=m[1];return button;
  });
  nodes['schedule-start'].value='09:00';
  nodes['schedule-end'].value='21:00';
  nodes['schedule-interval'].value='120';
  nodes['history-source'].value='all';
  nodes['history-status'].value='all';
  nodes['reminder-title'].value='Water ♡';
  nodes['reminder-body'].value='Beo ơi, nhớ uống nước nha em ♡';
  let state={settings:{
    recipientName:'Beo',notificationTitle:'Water ♡',reminderMessage:'Beo ơi, nhớ uống nước nha em ♡',
    enabled:true,start:'09:00',end:'21:00',interval:120
  },device:{paired:true,pushEnabled:true,lastSeenAt:1795172400},messages:[]};
  const calls=[];
  const api=async (path,opts)=>{
    calls.push({path,opts});
    if(path.startsWith('/api/admin/history?')){
      const q=new URL('https://example.test'+path).searchParams;
      const offset=Number(q.get('offset')||0);
      return {total:41,messages:[{id:'history-'+offset,title:'Đã nhắc Beo',body:'Uống nước nha em ♡',
        status:'received',source:'scheduled',createdAt:1795172400}]};
    }
    if(path==='/api/admin/device/disconnect'){
      state={...state,device:{paired:false,pushEnabled:false,lastSeenAt:0}};
      return {ok:true,paired:false};
    }
    throw new Error('Unexpected route: '+path);
  };
  let dirty=0,draft=null,refreshes=0;
  const refreshState=async()=>{refreshes++;features.onStateChange(state,false);};
  const originals=[['document',Object.getOwnPropertyDescriptor(globalThis,'document')],
    ['window',Object.getOwnPropertyDescriptor(globalThis,'window')]];
  Object.defineProperty(globalThis,'document',{configurable:true,value:{
    getElementById:id=>nodes[id],querySelectorAll:()=>presets,
    createDocumentFragment:makeNode,createElement:makeNode
  }});
  Object.defineProperty(globalThis,'window',{configurable:true,value:{confirm:()=>true}});
  const $=id=>nodes[id];
  let features;
  try {
    features=createAdminFeatures({$,api,getState:()=>state,markDirty:()=>dirty++,
      setSendDraft:value=>draft=value,dateLabel:()=> '20/11/2026',
      messageState:value=>({label:'iPhone đã nhận',tone:'received'}),refreshState});
    const fire=async (node,type)=>{for(const callback of (node.listeners[type]||[]))await callback();};
    await run({nodes,presets,features,calls,fire,state:()=>state,draft:()=>draft,dirty:()=>dirty,refreshes:()=>refreshes});
  } finally {
    for(const [name,original] of originals){
      if(original)Object.defineProperty(globalThis,name,original);
      else delete globalThis[name];
    }
  }
}

test('preset buttons and arbitrary custom inputs refresh the exact daily schedule without sending anything',async()=>{
  await withFeatures(async({nodes,presets,features,calls,fire,dirty})=>{
    await fire(presets.find(x=>x.dataset.interval==='5'),'click');
    assert.equal(nodes['schedule-interval'].value,'5');
    assert.equal(nodes['schedule-preview-count'].textContent,'145 lần/ngày');
    assert.match(nodes['schedule-preview-warning'].textContent,/145/);
    assert.ok(dirty()>0);
    nodes['schedule-interval'].value='13';
    await fire(nodes['schedule-interval'],'input');
    assert.equal(nodes['schedule-preview-count'].textContent,'56 lần/ngày');
    assert.equal(calls.length,0,'editing time must not save or send early');
    features.reset();
  });
});

test('copy mode preserves drafted fixed note and can stage a sample without actually sending push',async()=>{
  await withFeatures(async({nodes,features,fire,draft,calls})=>{
    features.onStateChange({settings:{
      notificationTitle:'Water ♡',reminderMessage:'Beo ơi, nhớ uống nước nha em ♡',enabled:true,
      start:'09:00',end:'21:00',interval:120
    },device:{paired:true,pushEnabled:true},messages:[]});
    await settle();
    await fire(nodes['mode-fixed'],'click');
    assert.equal(nodes['custom-copy-fields'].hidden,false);
    nodes['reminder-title'].value='Lời thương riêng';
    nodes['reminder-body'].value='Bé iu uống nước đi nè ♡';
    await fire(nodes['mode-auto'],'click');
    assert.equal(nodes['custom-copy-fields'].hidden,true);
    await fire(nodes['mode-fixed'],'click');
    assert.equal(nodes['reminder-title'].value,'Lời thương riêng');
    assert.equal(nodes['reminder-body'].value,'Bé iu uống nước đi nè ♡');
    await fire(nodes['schedule-to-send'],'click');
    assert.deepEqual(draft(),{title:'Lời thương riêng',body:'Bé iu uống nước đi nè ♡'});
    assert.equal(calls.some(x=>x.path==='/api/admin/send'),false);
  });
});

test('history supports filters and next-page loading, while device disconnect requires a server operation',async()=>{
  await withFeatures(async({nodes,features,fire,calls,refreshes})=>{
    features.onStateChange({settings:{
      notificationTitle:'Water ♡',reminderMessage:'Beo ơi, nhớ uống nước nha em ♡',
      enabled:true,start:'09:00',end:'21:00',interval:120
    },device:{paired:true,pushEnabled:true},messages:[]});
    await settle();
    assert.match(nodes['history-total'].textContent,/41/);
    assert.equal(nodes['history-next'].disabled,false);
    await fire(nodes['history-next'],'click');
    await settle();
    const latest=calls.filter(x=>x.path.startsWith('/api/admin/history?')).at(-1).path;
    assert.equal(new URL('https://example.test'+latest).searchParams.get('offset'),'30');
    assert.equal(nodes['history-page'].textContent,'Trang 2 / 2');
    nodes['history-status'].value='opened';
    await fire(nodes['history-status'],'change');
    await settle();
    const filtered=calls.filter(x=>x.path.startsWith('/api/admin/history?')).at(-1).path;
    assert.equal(new URL('https://example.test'+filtered).searchParams.get('status'),'opened');
    assert.equal(new URL('https://example.test'+filtered).searchParams.get('offset'),'0');
    await fire(nodes['disconnect-button'],'click');
    assert.equal(calls.filter(x=>x.path==='/api/admin/device/disconnect').length,1);
    assert.equal(refreshes(),1);
  });
});
