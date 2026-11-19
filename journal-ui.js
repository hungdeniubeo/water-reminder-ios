import { localDayKey, dayKeyOffset, totalForDay } from './logic.js';
import { BODY_NOTES_KEY, BODY_SYMPTOMS, BODY_CONTEXTS, cleanBodyNotes, completedDaySummary, recentGoalStreak, monthlyCalendar, dateWithinJournal } from './hydration-insights.js';

// The journal is separate from the couple/push feature. No symptom data leaves the phone.
export function createJournal({getState, getLanguage, t, number, amountLabel, formatDate, formatTime, openHistory, addEntry, deleteEntry, showToast}) {
  const el = id => document.getElementById(id);
  const getDay = day => new Date(day+'T12:00:00');
  let chosenDay=localDayKey();
  let month=new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12);
  let notes;
  try { notes=cleanBodyNotes(JSON.parse(localStorage.getItem(BODY_NOTES_KEY)||'{}')); }
  catch { notes={}; }
  let symptoms=new Set();
  let contexts=new Set();
  const hasLog=(day)=>getState().logs.some(item=>item.day===day);
  const dayTotal=(day)=>totalForDay(getState().logs,day);
  const localDate=(day,opts)=>formatDate(getDay(day),getLanguage(),opts);
  const isToday=day=>day===localDayKey();

  function saveNotes(){
    try {localStorage.setItem(BODY_NOTES_KEY,JSON.stringify(notes));return true;}
    catch {showToast(t('storageProblem'));return false;}
  }

  function renderWeek(){
    const box=el('home-week-days');box.replaceChildren();
    for(let n=-6;n<=0;n++){
      const day=dayKeyOffset(n), logged=hasLog(day), total=dayTotal(day), date=getDay(day);
      const b=document.createElement('button');b.type='button';
      b.className='week-day'+(n===0?' is-today':'')+(logged?' has-water':'')+(logged && total>=getState().goal?' is-complete':'');
      const label=document.createElement('small');label.textContent=formatDate(date,getLanguage(),{weekday:'short'}).replace('.','');
      const digit=document.createElement('strong');digit.textContent=String(date.getDate());
      const mark=document.createElement('span');mark.className='week-indicator';mark.textContent=logged?'•':'·';
      b.append(label,digit,mark);
      b.setAttribute('aria-label',localDate(day,{day:'numeric',month:'long'})+', '+(logged?amountLabel(total):t('v3NoEntryShort')));
      b.addEventListener('click',()=>{selectDay(day);openHistory();});box.append(b);
    }
  }

  function renderStory(){
    const total=dayTotal(localDayKey()), goal=getState().goal;
    const h=el('daily-story-title'),p=el('daily-story-text');
    if(!total){h.textContent=t('v3DailyStart');p.textContent=t('v3DailyStartBody');}
    else if(total>=goal){h.textContent=t('v3DailyComplete');p.textContent=t('v3DailyCompleteBody');}
    else{h.textContent=t('v3DailyInProgress');p.textContent=t('v3DailyInProgressBody',{amount:number(total)});}
  }

  function renderCalendar(){
    el('calendar-month').textContent=formatDate(month,getLanguage(),{month:'long',year:'numeric'});
    const now=new Date(),current=now.getFullYear()*12+now.getMonth(),visible=month.getFullYear()*12+month.getMonth();
    el('calendar-next').disabled=visible>=current;
    el('calendar-prev').disabled=visible<=2020*12;
    const weekdays=el('calendar-weekdays');weekdays.replaceChildren();
    for(let n=0;n<7;n++){
      const day=new Date(2026,10,16+n,12);const label=document.createElement('span');
      label.textContent=formatDate(day,getLanguage(),{weekday:'short'}).replace('.','');weekdays.append(label);
    }
    const grid=el('calendar-grid');grid.replaceChildren();
    for(const day of monthlyCalendar(month)){
      if(!day){const blank=document.createElement('span');blank.className='calendar-blank';grid.append(blank);continue;}
      const total=dayTotal(day.key),logged=hasLog(day.key);
      const b=document.createElement('button');b.type='button';b.textContent=String(day.day);
      b.className='calendar-date'+(logged?' recorded':'')+(logged&&total>=getState().goal?' goal-reached':'')+(day.key===chosenDay?' picked':'')+(isToday(day.key)?' today-date':'');
      b.disabled=day.future;
      b.setAttribute('aria-label',localDate(day.key,{day:'numeric',month:'long',year:'numeric'})+', '+(logged?amountLabel(total):t('v3NoEntryShort')));
      if(day.key===chosenDay)b.setAttribute('aria-pressed','true');
      b.addEventListener('click',()=>selectDay(day.key));grid.append(b);
    }
  }

  function selectDay(day){
    if(!dateWithinJournal(day))return;
    chosenDay=day;const d=getDay(day);month=new Date(d.getFullYear(),d.getMonth(),1,12);
    render();
  }

  function renderSelectedDay(){
    el('journal-day-title').textContent=localDate(chosenDay,{weekday:'long',day:'numeric',month:'short'});
    const entries=getState().logs.filter(item=>item.day===chosenDay).sort((a,b)=>b.at.localeCompare(a.at));
    const total=dayTotal(chosenDay),logged=entries.length>0;
    el('journal-day-total').textContent=logged?amountLabel(total):t('v3NoEntryShort');
    el('journal-day-message').textContent=logged?t('v3DateGoalNote',{amount:number(total),goal:number(getState().goal)}):t('v3MissingDayNote');
    const list=el('journal-day-entries');list.replaceChildren();
    for(const entry of entries){
      const row=document.createElement('div');row.className='journal-entry';
      const dot=document.createElement('span');dot.className='journal-entry-bullet';dot.textContent='◉';
      const detail=document.createElement('div');detail.className='journal-entry-text';
      const amount=document.createElement('strong');amount.textContent=amountLabel(entry.amount);
      const time=document.createElement('small');time.textContent=localDayKey(new Date(entry.at))===entry.day?formatTime(new Date(entry.at),getLanguage()):t('v3Backfilled');
      detail.append(amount,time);
      const del=document.createElement('button');del.type='button';del.className='journal-delete';del.textContent='×';del.setAttribute('aria-label',t('removeEntry',{amount:number(entry.amount),time:time.textContent}));del.addEventListener('click',()=>deleteEntry(entry.id));
      row.append(dot,detail,del);list.append(row);
    }
  }

  function averageLogged(){
    const average=completedDaySummary(getState().logs,getState().goal).averageLogged;
    return average===null?'—':amountLabel(average);
  }

  function renderPatterns(){
    const stats=completedDaySummary(getState().logs,getState().goal);
    el('insight-average').textContent=stats.averageLogged===null?'—':amountLabel(stats.averageLogged);
    el('insight-goals').textContent=stats.goalDays+' / '+stats.loggedDays;
    el('insight-log-days').textContent=t('v3RecordedDays',{count:stats.loggedDays});
    const box=el('insight-pattern');box.replaceChildren();
    const heading=document.createElement('strong'),desc=document.createElement('p');
    if(stats.loggedDays===0){heading.textContent=t('v3EmptyPatternTitle');desc.textContent=t('v3EmptyPatternBody');}
    else if(stats.loggedDays<3){heading.textContent=t('v3FewDaysTitle');desc.textContent=t('v3FewDaysBody',{count:stats.loggedDays});}
    else if(stats.lowerDays>=Math.ceil(stats.loggedDays/2)){
      heading.textContent=t('v3BelowPatternTitle');desc.textContent=t('v3BelowPatternBody',{count:stats.lowerDays,total:stats.loggedDays});
    }else{heading.textContent=t('v3SteadyTitle');desc.textContent=t('v3SteadyBody',{count:stats.goalDays,total:stats.loggedDays});}
    box.append(heading,desc);
    const streak=recentGoalStreak(getState().logs,getState().goal);
    if(streak>=2){const text=document.createElement('small');text.textContent=t('v3GoalStreak',{count:streak});box.append(text);}
  }
  function renderBodyFeedback(){
    const box=el('body-feedback');box.replaceChildren();
    const title=document.createElement('strong'),body=document.createElement('p');
    const noted=hasLog(chosenDay),below=noted && dayTotal(chosenDay)<getState().goal;
    if(symptoms.has('dizziness')||symptoms.has('darkUrine')){
      title.textContent=t('v3FeedbackWatchTitle');
      body.textContent=t('v3FeedbackWatchBody');
    }else if(symptoms.size){
      title.textContent=t('v3FeedbackSymptomTitle');
      body.textContent=t('v3FeedbackSymptomBody');
    }else if(contexts.has('hotWeather')||contexts.has('exercise')){
      title.textContent=t('v3FeedbackHotTitle');
      body.textContent=t('v3FeedbackHotBody');
    }else if(below){
      title.textContent=t('v3FeedbackLowTitle');
      body.textContent=t('v3FeedbackLowBody');
    }else{
      title.textContent=t('v3FeedbackStartTitle');
      body.textContent=t('v3FeedbackStartBody');
    }
    box.append(title,body);
  }

  function renderCheckin(){
    const saved=notes[chosenDay]||{symptoms:[],contexts:[]};
    symptoms=new Set(saved.symptoms);contexts=new Set(saved.contexts);
    function build(id,keys,active,prefix){
      const box=el(id);box.replaceChildren();
      for(const name of keys){
        const b=document.createElement('button');b.type='button';b.className='checkin-chip'+(active.has(name)?' selected':'');
        b.textContent=t(prefix+name);b.setAttribute('aria-pressed',String(active.has(name)));
        b.addEventListener('click',()=>{
          active.has(name)?active.delete(name):active.add(name);
          b.classList.toggle('selected',active.has(name));b.setAttribute('aria-pressed',String(active.has(name)));renderBodyFeedback();
        });box.append(b);
      }
    }
    build('body-symptoms',BODY_SYMPTOMS,symptoms,'v3Symptom_');
    build('body-contexts',BODY_CONTEXTS,contexts,'v3Context_');
    renderBodyFeedback();
  }

  function render(){renderCalendar();renderSelectedDay();renderPatterns();renderCheckin();}

  el('open-journal').addEventListener('click',()=>{selectDay(localDayKey());openHistory();});
  el('daily-story-link').addEventListener('click',openHistory);
  el('calendar-prev').addEventListener('click',()=>{const y=month.getFullYear(),m=month.getMonth();month=new Date(y,m-1,1,12);renderCalendar();});
  el('calendar-next').addEventListener('click',()=>{const y=month.getFullYear(),m=month.getMonth();month=new Date(y,m+1,1,12);renderCalendar();});
  document.querySelectorAll('[data-journal-preset]').forEach(button=>button.addEventListener('click',()=>{
    el('journal-amount').value=button.dataset.journalPreset;
    document.querySelectorAll('[data-journal-preset]').forEach(item=>item.classList.toggle('selected',item===button));
  }));
  el('journal-amount').addEventListener('input',()=>document.querySelectorAll('[data-journal-preset]').forEach(item=>item.classList.toggle('selected',item.dataset.journalPreset===el('journal-amount').value)));
  el('journal-add-form').addEventListener('submit',event=>{
    event.preventDefault();const amount=Number(el('journal-amount').value);
    if(!dateWithinJournal(chosenDay)){showToast(t('v3FutureNotAllowed'));return;}
    if(!Number.isInteger(amount)||amount<20||amount>2000){showToast(t('amountInvalid'));return;}
    // The log's day is the day the user recalls; at is the true entry timestamp.
    // Never fabricate an earlier clock time for a backfilled glass of water.
    addEntry(chosenDay,amount);
  });
  el('save-body-checkin').addEventListener('click',()=>{
    if(!dateWithinJournal(chosenDay))return;
    if(symptoms.size||contexts.size)notes[chosenDay]={symptoms:[...symptoms],contexts:[...contexts]};
    else delete notes[chosenDay];
    if(saveNotes())showToast(t('v3BodySaved'));
  });

  return {
    render,renderWeek,renderStory,averageLogged,selectDay,
    exportNotes:()=>notes,
    restoreNotes:input=>{notes=cleanBodyNotes(input);saveNotes();render();}
  };
}