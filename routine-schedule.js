// Shared, deterministic schedule calculation for Admin previews and Worker delivery.
export const validTime = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
export const toMinute = value => Number(value.slice(0,2))*60 + Number(value.slice(3,5));
export const toTime = value => String(Math.floor(value/60)).padStart(2,'0') + ':' + String(value%60).padStart(2,'0');
export const validDate = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value+'T00:00:00Z');
  return Number.isFinite(+d) && d.toISOString().slice(0,10) === value && value.slice(0,4) !== '0000';
};
export const MIN_RANDOM_GAP = 15;
export const MAX_RANDOM_COUNT = 10;
export const MAX_MESSAGE_VARIANTS = 10;
export const TYPES = ['fixed','repeat','random','date'];
const dayNumber = day => Math.floor(Date.parse(day+'T00:00:00Z')/86400000);
function hash(value) {
  let n=2166136261;
  for (let i=0;i<value.length;i++) { n ^= value.charCodeAt(i); n=Math.imul(n,16777619); }
  return n >>> 0;
}
function rng(seed) {
  let n=hash(seed);
  return max => {
    n=(Math.imul(n,1664525)+1013904223)>>>0;
    return Math.floor(n/4294967296*max);
  };
}
const textOK = (value, max, multiline=false) => typeof value==='string' && value.trim().length>0 &&
  value.length<=max && !/[\u0000-\u0008\u000b-\u001f\u007f]/.test(value) &&
  (multiline || !/[\r\n\t]/.test(value));
export function validSchedule(schedule) {
  if (!schedule || typeof schedule!=='object' || Array.isArray(schedule) || !TYPES.includes(schedule.kind)) return false;
  const {kind,start,end,interval,count,date,cycle,messages=[]}=schedule;
  if (!Array.isArray(messages) || messages.length>=MAX_MESSAGE_VARIANTS ||
      !messages.every(m=>m && textOK(m.title,70) && textOK(m.body,150,true))) return false;
  if (kind==='fixed') return true;
  if (kind==='date') return validDate(date) && ['once','monthly','yearly'].includes(cycle);
  if (!validTime(start)||!validTime(end)||start>=end) return false;
  if (kind==='repeat') return Number.isInteger(interval)&&interval>=5&&interval<=720;
  return Number.isInteger(count)&&count>=1&&count<=MAX_RANDOM_COUNT &&
    toMinute(end)-toMinute(start)>=(count-1)*MIN_RANDOM_GAP;
}
export function cleanSchedule(s) {
  const result={kind:s.kind,messages:(s.messages||[]).map(m=>({title:m.title.trim(),body:m.body.trim()}))};
  if (s.kind==='repeat'||s.kind==='random') Object.assign(result,{start:s.start,end:s.end});
  if (s.kind==='repeat') result.interval=s.interval;
  if (s.kind==='random') result.count=s.count;
  if (s.kind==='date') Object.assign(result,{date:s.date,cycle:s.cycle});
  return result;
}
export function slotsForDay(routine,day) {
  if (!routine?.enabled || !validDate(day)) return [];
  const s=routine.schedule||{kind:'fixed'};
  if (!validSchedule(s)) return [];
  if (s.kind==='date') {
    if (day<s.date || !validTime(routine.time)) return [];
    const matches=s.cycle==='once'?day===s.date:s.cycle==='monthly'?day.slice(8)===s.date.slice(8):day.slice(5)===s.date.slice(5);
    return matches?[toMinute(routine.time)]:[];
  }
  const weekday=new Date(day+'T00:00:00Z').getUTCDay();
  if (!(Number(routine.days)&(1<<weekday))) return [];
  if (s.kind==='fixed') return validTime(routine.time)?[toMinute(routine.time)]:[];
  const first=toMinute(s.start),last=toMinute(s.end);
  if (s.kind==='repeat') {
    const slots=[];
    for(let minute=first;minute<=last;minute+=s.interval) slots.push(minute);
    return slots;
  }
  // Sample distinct compressed positions; expand them to guarantee a 15-minute gap.
  // The same ID/date/config yields the same times, even after reload or retry.
  const width=last-first+1-(s.count-1)*(MIN_RANDOM_GAP-1);
  const random=rng(String(routine.id)+'|'+day+'|'+s.start+'|'+s.end+'|'+s.count);
  const picked=new Set();
  while(picked.size<s.count) picked.add(random(width));
  return [...picked].sort((a,b)=>a-b).map((n,i)=>first+n+i*(MIN_RANDOM_GAP-1));
}
export function copyForSlot(routine,slot) {
  const pool=[{title:routine.title,body:routine.body},...(routine.schedule?.messages||[])];
  if(pool.length===1) return pool[0];
  const day=slot.slice(0,10),minute=toMinute(slot.slice(11));
  const slots=slotsForDay(routine,day);
  const random=rng(String(routine.id)+'|copy|'+day);
  for(let i=pool.length-1;i>0;i--) { const j=random(i+1); [pool[i],pool[j]]=[pool[j],pool[i]]; }
  const ordinal=Math.max(0,slots.indexOf(minute));
  return pool[ordinal%pool.length];
}
