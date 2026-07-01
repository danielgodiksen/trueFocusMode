/* Auto-generated from cortical-load_2.html. The app's script, compiled into the
   plugin bundle so it runs as normal code (never gated by page CSP). It is run
   against an isolated same-origin iframe: window -> iframe window (only used for
   window.storage), document -> iframe document. Do not edit by hand. */
/* eslint-disable */
// @ts-nocheck
export function runCorticalApp(window: any, document: any) {

"use strict";

/* ================= default schema ================= */
const DEFAULT_SCHEMA = {
  layers: [
    {id:"L1", name:"Processing Engine", sub:"cognitive deceleration", loc:"lPFC compute"},
    {id:"L2", name:"Reward Core",       sub:"behavioral & motivational", loc:"inhibition"},
    {id:"L3", name:"Systemic Load",     sub:"physiological & somatic",   loc:"motor tone"},
  ],
  symptoms: [
    {id:"wm",   layerId:"L1", label:"Working memory decay", desc:"Forget a sentence by its end; can't hold 3–4 variables at once.", weight:1, critical:false},
    {id:"loop", layerId:"L1", label:"Looping thoughts",     desc:"Re-reading the same paragraph without encoding a word.", weight:1, critical:false},
    {id:"sem",  layerId:"L1", label:"Semantic blurring",    desc:"Technical terms lose their sharp definitions.", weight:1, critical:false},
    {id:"lat",  layerId:"L1", label:"Response latency",     desc:"A 2–3s lag to route even a simple answer.", weight:1, critical:false},
    {id:"dist", layerId:"L2", label:"Micro-distraction pull",   desc:"Notifications, itches, specks suddenly demand attention.", weight:1, critical:false},
    {id:"fric", layerId:"L2", label:"Friction intolerance",     desc:"Visceral irritation the moment a task needs real thought.", weight:1, critical:false},
    {id:"fix",  layerId:"L2", label:"Low-effort hyper-fixation", desc:"Urge to tidy, sort inbox, format — anything but thinking.", weight:1, critical:false},
    {id:"ocu",  layerId:"L3", label:"Oculomotor fatigue", desc:"Eyes struggle to track lines; burning, extra blinking.", weight:1, critical:false},
    {id:"pos",  layerId:"L3", label:"Postural collapse",  desc:"Slouching, head on hand, heavy limbs.", weight:1, critical:false},
    {id:"ten",  layerId:"L3", label:"Frontal tension",    desc:"Tight, dull pressure behind the forehead / temples.", weight:1, critical:false},
  ],
  redflags: [
    {id:"phone", label:"Phone-check without noticing", desc:"You picked up your phone mid-block and only realized after — the lPFC has already down-regulated.", weight:5, critical:true},
  ],
  ready: [
    {id:"sleep",     label:"Slept enough last night", desc:"Restores glycogen and clears adenosine — your starting reserve.", weight:1},
    {id:"recovered", label:"Recovered since last block", desc:"The gradient had time to reset; not starting depleted.", weight:1},
    {id:"fueled",    label:"Fuelled & hydrated", desc:"Systemic support for astrocytic glycogen.", weight:1},
    {id:"clear",     label:"Mind is clear", desc:"Low competing stress or executive load pulling at the lPFC.", weight:1},
    {id:"noresid",   label:"No symptoms carried in", desc:"No frontal tension, eye strain, or brain-fog right now.", weight:1},
    {id:"rested",    label:"Eyes & body feel rested", desc:"Low baseline somatic load before you start.", weight:1},
  ],
  motivationFactors: [
    {id:"mf_goal",  label:"Clear goal for the block", desc:"Knowing exactly what 'done' looks like.", sign:1},
    {id:"mf_int",   label:"Interesting material", desc:"The topic itself pulls you in.", sign:1},
    {id:"mf_dead",  label:"Deadline pressure", desc:"Exam or due date is close.", sign:1},
    {id:"mf_bore",  label:"Boring / dry material", desc:"Low intrinsic pull.", sign:-1},
    {id:"mf_tired", label:"Already tired", desc:"Starting on a depleted tank.", sign:-1},
    {id:"mf_dist",  label:"Competing worries", desc:"Something else is on your mind.", sign:-1},
  ],
  triggers: [
    {id:"tg_dense",  label:"Dense / abstract passage", desc:"A section that needs many variables held at once."},
    {id:"tg_notif",  label:"A notification", desc:"An external interrupt broke the thread."},
    {id:"tg_long",   label:"Long unbroken stretch", desc:"No micro-pause for too long."},
    {id:"tg_screen", label:"Screen glare / small text", desc:"Visual strain accumulating."},
  ],
  vulnerabilities: [
    {id:"vu_lowsleep", label:"Under-slept today", desc:"Lower glycogen reserve; faster onset.", symptomIds:["wm","ten","ocu"]},
    {id:"vu_late",     label:"Late in the day", desc:"Cumulative load from earlier blocks.", symptomIds:["pos","ocu"]},
    {id:"vu_hunger",   label:"Hungry / low fuel", desc:"Metabolic support is thin.", symptomIds:["fric","dist"]},
  ],
};

/* ================= default settings ================= */
const DEFAULT_SETTINGS = {
  weightThreshold:5, strainGap:1, breadthRule:true, minSamples:3,
  wake:"07:00", sleep:"23:00", blockHours:2,
  autoDownloadBackup:false, lastBackup:null
};

/* ================= storage keys ================= */
const K_SCHEMA="clog:schema:v2", K_SETTINGS="clog:settings:v2", K_READINGS="clog:readings:v2",
      K_ACTIVE="clog:active:v2", K_DRAFT="clog:draft:v2", K_UNDO="clog:undo:v2", K_BACKUP="clog:backup:v2";
const K_OLD_READINGS="clog:readings:v1", K_OLD_SETTINGS="clog:settings:v1";

const HAS_STORE=(typeof window!=="undefined" && window.storage && typeof window.storage.get==="function");
const mem={};
async function storeGet(k){ if(HAS_STORE){ try{const r=await window.storage.get(k);return r?r.value:null;}catch(e){return null;} } return (k in mem)?mem[k]:null; }
async function storeSet(k,v){ pulseSave(); if(HAS_STORE){ try{await window.storage.set(k,v);return true;}catch(e){return false;} } mem[k]=v;return true; }
async function storeDel(k){ if(HAS_STORE){ try{await window.storage.delete(k);}catch(e){} } else delete mem[k]; }

/* ================= state ================= */
let schema=clone(DEFAULT_SCHEMA);
let settings={...DEFAULT_SETTINGS};
let readings=[];
let active=null;
let undoStack=[];
let anaRange="all";
let elapsedTimer=null, editFocusSnapped=false;

let current={ checked:new Set(), flags:new Set(), notes:"", outcome:null, actualLen:25, actualTouched:false, breakLen:10, triggers:new Set() };
let pre={ ready:new Set(), planned:25, motivation:50, motFactors:new Set(), vulns:new Set() };

/* ================= util ================= */
function clone(o){ return JSON.parse(JSON.stringify(o)); }
function uid(p){ return (p||"x")+"_"+Date.now().toString(36)+Math.random().toString(36).slice(2,5); }
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const esc=s=>(s||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const nowTime=()=>new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
const todayStr=()=>new Date().toLocaleDateString("en-CA");
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
const pct=x=>Math.round(x*100);
const fmtW=w=> Number.isInteger(w)? String(w) : w.toFixed(1);
function symById(id){ return schema.symptoms.find(s=>s.id===id); }
function flagById(id){ return schema.redflags.find(f=>f.id===id); }
function itemLabel(id){ const s=symById(id); if(s)return s.label; const f=flagById(id); if(f)return f.label; return id; }
function totalWeight(){ const w=schema.symptoms.concat(schema.redflags).reduce((a,x)=>a+(+x.weight||0),0); return Math.max(w,1); }
function nonEmptyLayerCount(){ return new Set(schema.symptoms.map(s=>s.layerId)).size; }
function nextSessionForToday(){ const t=todayStr(); const td=readings.filter(r=>r.date===t); return td.length?Math.max(...td.map(r=>r.session||1))+1:1; }

/* ================= weighted evaluation ================= */
function evaluate(checkedSet, flagSet){
  const sx=schema.symptoms.filter(s=>checkedSet.has(s.id));
  const rf=schema.redflags.filter(f=>flagSet.has(f.id));
  const act=[...sx,...rf];
  const weight=act.reduce((a,x)=>a+(+x.weight||0),0);
  const nonEmpty=nonEmptyLayerCount();
  const layersActive=new Set(sx.map(s=>s.layerId)).size;
  const critHit=act.filter(x=>x.critical);
  const overrideHit=critHit.length>0;
  const countHit=weight>=settings.weightThreshold;
  const breadthHit=settings.breadthRule && nonEmpty>=2 && layersActive>=nonEmpty;
  let state="stable"; const reasons=[];
  if(overrideHit||countHit||breadthHit){
    state="collapse";
    critHit.forEach(x=>reasons.push({k:"hot",txt:"critical · "+x.label.toLowerCase()}));
    if(countHit) reasons.push({k:"hot",txt:`load ${fmtW(weight)} ≥ ${settings.weightThreshold} threshold`});
    if(breadthHit) reasons.push({k:"hot",txt:"all layers active"});
  } else {
    const near=weight>0 && weight>=settings.weightThreshold-settings.strainGap;
    const twoLayers=layersActive>=2;
    if(near||twoLayers){ state="strained";
      if(near) reasons.push({k:"warm",txt:`load ${fmtW(weight)} · near threshold`});
      if(twoLayers) reasons.push({k:"warm",txt:`${layersActive} layers active`});
    } else if(weight>0){ reasons.push({k:"",txt:`load ${fmtW(weight)} · 1 layer`}); }
    else reasons.push({k:"",txt:"no symptoms logged"});
  }
  return {state,weight,layersActive,overrideHit,reasons};
}
const PROTO={
  stable:null,
  strained:{head:"What's happening",
    what:"The Na⁺/K⁺ gradient is starting to lag — astrocytic glycogen is drawing down and glutamate clearance is slowing.",
    reset:"<b>Finish the current thought</b> — don't open a new hard one — then take the break. Catching it here keeps you out of full collapse."},
  collapse:{head:"The Collapse",
    what:"lPFC down-regulated. EAATs are lagging, extracellular glutamate is rising, and your brain is forcing a low-effort strategy to avoid excitotoxic load. This isn't a discipline problem.",
    reset:"<b>Reset now.</b> Drop executive load: NSDR, a short sleep, or sensory quiet. ~10–20 min lets astrocytes restore the gradient and run the glutamate→glutamine cycle, then refuel glycogen."}
};
function endWeight(r){
  let w=0; (r.symptoms||[]).forEach(id=>{const s=symById(id); if(s)w+=(+s.weight||0);});
  (r.flags||[]).forEach(id=>{const f=flagById(id); if(f)w+=(+f.weight||0);});
  return w;
}

/* ================= dynamic time blocks ================= */
function parseHM(s){ const p=String(s==null?"0:0":s).split(":"); return (parseInt(p[0],10)||0)*60+(parseInt(p[1],10)||0); }
function fmtHM(min){ min=((Math.round(min)%1440)+1440)%1440; const h=Math.floor(min/60), m=min%60; return String(h).padStart(2,"0")+":"+String(m).padStart(2,"0"); }
function wakingSpan(){ const w=parseHM(settings.wake), s=parseHM(settings.sleep); let span=s-w; if(span<=0) span+=1440; return [w,span]; }
function buildBlocks(){
  const [w,span]=wakingSpan(); const step=Math.max(1,settings.blockHours)*60; const out=[];
  for(let off=0; off<span; off+=step){
    const start=(w+off)%1440; const end=(w+Math.min(off+step,span))%1440;
    out.push({id:"b"+start, startMin:start, label:fmtHM(start)+"–"+fmtHM(end)});
  }
  return out;
}
function blockIdForDate(d){
  const min=d.getHours()*60+d.getMinutes(); const [w,span]=wakingSpan();
  let off=min-w; if(off<0) off+=1440; if(off>=span) return "offhours";
  const step=Math.max(1,settings.blockHours)*60; const idx=Math.floor(off/step);
  return "b"+((w+idx*step)%1440);
}
function blockLabel(id){ if(id==="offhours")return "Off-hours"; const b=buildBlocks().find(x=>x.id===id); return b?b.label:id; }
function blockShort(id){ if(id==="offhours")return "off-hrs"; const b=buildBlocks().find(x=>x.id===id); return b?fmtHM(b.startMin):id; }
const blockOf=r=> blockIdForDate(new Date(r.startTs||r.ts));

/* ================= persistence (auto-save everything) ================= */
let pipTimer=null;
function pulseSave(){
  const pip=$("#savePip"); if(!pip)return;
  pip.querySelector(".d").style.transform="scale(1.6)";
  clearTimeout(pipTimer); pipTimer=setTimeout(()=>{ const d=pip.querySelector(".d"); if(d)d.style.transform="scale(1)"; },180);
}
const saveSchema   = ()=>storeSet(K_SCHEMA,schema);
const saveSettings = ()=>storeSet(K_SETTINGS,settings);
const saveReadings = ()=>storeSet(K_READINGS,readings);
const saveActive   = ()=> active? storeSet(K_ACTIVE,active) : storeDel(K_ACTIVE);
const saveUndo     = ()=>storeSet(K_UNDO,undoStack);
function saveDraft(){
  const d={
    pre:{ ready:[...pre.ready], planned:pre.planned, motivation:pre.motivation, motFactors:[...pre.motFactors], vulns:[...pre.vulns] },
    reading:{ checked:[...current.checked], flags:[...current.flags], notes:current.notes, outcome:current.outcome,
      actualLen:current.actualLen, actualTouched:current.actualTouched, breakLen:current.breakLen, triggers:[...current.triggers] }
  };
  return storeSet(K_DRAFT,d);
}
async function writeAutoBackup(){
  const backup={ app:"cortical-load", version:2, exportedAt:new Date().toISOString(), schema, settings, readings };
  await storeSet(K_BACKUP,backup);
  settings.lastBackup=new Date().toISOString(); await saveSettings();
  renderSavePip();
  if(settings.autoDownloadBackup){ download(`cortical-load-backup-${todayStr()}.json`, JSON.stringify(backup,null,2), "application/json"); }
}

/* ================= undo ================= */
function pushUndo(label){
  undoStack.push({label, ts:Date.now(), schema:clone(schema), settings:clone(settings)});
  if(undoStack.length>60) undoStack.shift();
  saveUndo(); renderUndo();
}
async function doUndo(){
  if(!undoStack.length) return;
  const snap=undoStack.pop();
  schema=clone(snap.schema); settings=clone(snap.settings);
  await saveSchema(); await saveSettings(); await saveUndo();
  // prune draft selections that no longer exist
  current.checked.forEach(id=>{ if(!symById(id)) current.checked.delete(id); });
  current.flags.forEach(id=>{ if(!flagById(id)) current.flags.delete(id); });
  current.triggers.forEach(id=>{ if(!schema.triggers.find(t=>t.id===id)) current.triggers.delete(id); });
  pre.ready.forEach(id=>{ if(!schema.ready.find(r=>r.id===id)) pre.ready.delete(id); });
  pre.motFactors.forEach(id=>{ if(!schema.motivationFactors.find(m=>m.id===id)) pre.motFactors.delete(id); });
  pre.vulns.forEach(id=>{ if(!schema.vulnerabilities.find(v=>v.id===id)) pre.vulns.delete(id); });
  rebuildAll();
  renderUndo(); toast(`Undid: ${snap.label}`,"violet");
}
function renderUndo(){
  const has=undoStack.length>0;
  const last=has?undoStack[undoStack.length-1].label:"none yet";
  ["#undoBtn","#undoBtn2"].forEach(s=>{ const b=$(s); if(b) b.disabled=!has; });
  const lbl=$("#undoLabel"); if(lbl) lbl.textContent= has? `${last}  ·  ${undoStack.length} step${undoStack.length>1?"s":""} back` : "none yet";
}
/* ================= shared predicates ================= */
const isOverload=r=> r.outcome==="break"||r.outcome==="quit";
const hasLen=r=> typeof r.actualLen==="number" && r.actualLen>0;
function blockStats(blockId){
  const recs=readings.filter(r=>hasLen(r) && blockOf(r)===blockId);
  const cont=recs.filter(r=>r.outcome==="continued");
  const over=recs.filter(isOverload);
  return {n:recs.length, contN:cont.length,
    sustainableMean: cont.length? mean(cont.map(r=>r.actualLen)):null,
    overloadRate: recs.length? over.length/recs.length:null };
}

/* ================= generic tag chips ================= */
function buildChips(hostSel, items, selSet, classFn){
  const host=$(hostSel); host.innerHTML="";
  if(!items.length){ host.innerHTML=`<div class="chips-empty">none defined — add in Configure</div>`; return; }
  items.forEach(it=>{
    const b=document.createElement("button");
    b.className="chip-tag "+(classFn?classFn(it):"");
    b.textContent=it.label;
    if(selSet.has(it.id)) b.classList.add("on");
    b.addEventListener("click",()=>{ if(selSet.has(it.id))selSet.delete(it.id); else selSet.add(it.id); b.classList.toggle("on"); saveDraft(); });
    host.appendChild(b);
  });
}
function buildContextChips(){
  buildChips("#motChips", schema.motivationFactors, pre.motFactors, it=> it.sign>0?"pos":"neg");
  buildChips("#vulChips", schema.vulnerabilities, pre.vulns, ()=>"");
  buildChips("#trigChips", schema.triggers, current.triggers, ()=>"trig");
}

/* ================= pre-study: readiness ================= */
function buildReady(){
  const host=$("#readyRows"); host.innerHTML="";
  if(!schema.ready.length){ host.innerHTML=`<div class="chips-empty" style="padding:10px 12px">No checklist items — add some in Configure.</div>`; updateReadyScore(); return; }
  schema.ready.forEach(it=>{
    const b=document.createElement("button");
    b.className="row"+(pre.ready.has(it.id)?" on":""); b.setAttribute("role","checkbox"); b.setAttribute("aria-checked",pre.ready.has(it.id)?"true":"false");
    b.innerHTML=`<span class="box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>
      <span class="txt"><span class="t">${esc(it.label)}</span><span class="d">${esc(it.desc)}</span></span>
      <span class="wbadge">w ${fmtW(+it.weight||1)}</span>`;
    b.addEventListener("click",()=>{
      if(pre.ready.has(it.id))pre.ready.delete(it.id); else pre.ready.add(it.id);
      const on=pre.ready.has(it.id); b.classList.toggle("on",on); b.setAttribute("aria-checked",on?"true":"false");
      updateReadyScore(); renderPreVerdict(); saveDraft();
    });
    host.appendChild(b);
  });
  updateReadyScore();
}
function readyFraction(){
  const tot=schema.ready.reduce((a,r)=>a+(+r.weight||0),0); if(tot<=0) return 0;
  const got=schema.ready.filter(r=>pre.ready.has(r.id)).reduce((a,r)=>a+(+r.weight||0),0);
  return got/tot;
}
function updateReadyScore(){
  const f=readyFraction();
  $("#readyFill").style.width=(f*100)+"%";
  $("#readyFill").style.background= f>=.66?"var(--teal)":f>=.34?"var(--amber)":"var(--red)";
  $("#readyN").textContent=`${pre.ready.size}/${schema.ready.length} · ${pct(f)}%`;
}
function setMotivation(v){
  pre.motivation=Math.max(0,Math.min(100,v));
  $("#motRange").value=pre.motivation; $("#motNum").textContent=pre.motivation; $("#motVal").textContent=pre.motivation;
  saveDraft();
}
function setPlanned(v){
  pre.planned=Math.max(5,Math.min(120,v));
  $("#lenRange").value=pre.planned; $("#lenBig").innerHTML=`${pre.planned}<small>m</small>`;
  const id=blockIdForDate(new Date());
  $("#lenBlockNote").textContent = id==="offhours"? "Right now · outside your waking window" : `Right now · ${blockLabel(id)}`;
  const st=blockStats(id);
  $("#lenCtx").textContent = st.contN>=settings.minSamples ? `sustainable here ≈ ${Math.round(st.sustainableMean)}m` : "no calibration here yet";
  renderPreVerdict(); saveDraft();
}

/* ================= pre-study verdict ================= */
function readinessVerdict(){
  const planned=pre.planned, score=readyFraction();
  const id=blockIdForDate(new Date()), st=blockStats(id);
  const base=(st.contN>=settings.minSamples)? st.sustainableMean : null;
  const mult=0.7+0.4*score, eff=base!=null? base*mult : null;
  const nums=[["Time block", id==="offhours"?"Off-hours":blockLabel(id)],["Readiness", `${pct(score)}% · ×${mult.toFixed(2)}`],["Motivation", String(pre.motivation)]];
  let kind,state,line,suggest=null;
  if(eff!=null){
    nums.push(["Sustainable here", `~${Math.round(base)}m · n=${st.contN}`]);
    nums.push(["Adjusted for today", `~${Math.round(eff)}m`]);
    if(st.overloadRate!=null) nums.push(["Overload rate here", `${pct(st.overloadRate)}%`]);
    const r=planned/eff;
    if(r<=1.0){ kind="pv-go"; state="Good to go"; line=`<b>${planned}m</b> sits inside your sustainable range for this slot (~${Math.round(eff)}m adjusted). Clear to start.`; }
    else if(r<=1.15){ kind="pv-caution"; state="Pushing it"; line=`<b>${planned}m</b> is just over your ~${Math.round(eff)}m mark right now. Fine if you watch for early symptoms — or trim it.`; suggest=Math.round(eff); }
    else { kind="pv-over"; state="Overload likely"; line=`<b>${planned}m</b> is well past your ~${Math.round(eff)}m sustainable length for this slot. Sessions this long here have tended to end in a break or quit.`; suggest=Math.round(eff); }
  } else {
    kind="pv-unknown"; state="Calibrating";
    nums.push(["History here", `n=${st.contN} (need ${settings.minSamples})`]);
    if(score<0.5){ line=`Not enough history in this slot yet, and readiness is low (<b>${pct(score)}%</b>). Start conservative — ~20m — so this first reading calibrates cleanly.`; suggest=20; }
    else line=`Not enough history in this slot yet. Readiness looks solid (<b>${pct(score)}%</b>). Pick a length you can hold; the verdict sharpens with each logged session.`;
  }
  return {kind,state,line,nums,suggest};
}
function renderPreVerdict(){
  const v=readinessVerdict(), card=$("#preVerdict");
  card.className="card pre-verdict "+v.kind;
  $("#pvState").textContent=v.state; $("#pvLine").innerHTML=v.line;
  $("#pvNums").innerHTML=v.nums.map(([k,val])=>`<div class="pv-num"><span>${esc(k)}</span><b>${esc(val)}</b></div>`).join("");
  const sg=$("#pvSuggest");
  if(v.suggest && v.suggest!==pre.planned){ sg.classList.add("show"); sg.textContent=`Use ~${v.suggest}m instead`; sg.dataset.v=v.suggest; } else sg.classList.remove("show");
}

/* ================= reading: intake ================= */
function buildIntake(){
  const host=$("#layers"); host.innerHTML="";
  const used=new Set();
  const renderLayer=(name,sub,loc,syms)=>{
    if(!syms.length) return;
    const sec=document.createElement("div"); sec.className="layer";
    sec.innerHTML=`<div class="layer-head"><span class="name">${esc(name)}</span><span class="sub">${esc(sub||"")}${loc?` · <span class="loc">${esc(loc)}</span>`:""}</span></div><div class="rows"></div>`;
    const rows=sec.querySelector(".rows");
    syms.forEach(sx=>{
      used.add(sx.id);
      const b=document.createElement("button");
      b.className="row"+(current.checked.has(sx.id)?" on":""); b.setAttribute("role","checkbox"); b.setAttribute("aria-checked",current.checked.has(sx.id)?"true":"false"); b.dataset.sx=sx.id;
      b.innerHTML=`<span class="box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span><span class="txt"><span class="t">${esc(sx.label)}</span><span class="d">${esc(sx.desc)}</span></span><span class="wbadge">w ${fmtW(+sx.weight||1)}${sx.critical?" ·!":""}</span>`;
      b.addEventListener("click",()=>toggleSx(sx.id,b));
      rows.appendChild(b);
    });
    host.appendChild(sec);
  };
  schema.layers.forEach(l=> renderLayer(l.name,l.sub,l.loc, schema.symptoms.filter(s=>s.layerId===l.id)));
  const orphan=schema.symptoms.filter(s=>!used.has(s.id));
  if(orphan.length) renderLayer("Other","uncategorized","", orphan);
}
function buildRedflags(){
  const host=$("#flagRows"); host.innerHTML="";
  if(!schema.redflags.length){ host.innerHTML=`<div class="chips-empty" style="padding:8px 12px">No red flags defined.</div>`; return; }
  schema.redflags.forEach(f=>{
    const b=document.createElement("button");
    b.className="row flag"+(current.flags.has(f.id)?" on":""); b.setAttribute("role","checkbox"); b.setAttribute("aria-checked",current.flags.has(f.id)?"true":"false");
    b.innerHTML=`<span class="box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span><span class="glyph">⚑</span><span class="txt"><span class="t">${esc(f.label)}</span><span class="d">${esc(f.desc)}</span></span><span class="wbadge">w ${fmtW(+f.weight||1)}${f.critical?" ·!":""}</span>`;
    b.addEventListener("click",()=>toggleFlag(f.id,b));
    host.appendChild(b);
  });
}
function toggleSx(id,el){ if(current.checked.has(id))current.checked.delete(id); else current.checked.add(id); const on=current.checked.has(id); el.classList.toggle("on",on); el.setAttribute("aria-checked",on?"true":"false"); updateLive(); saveDraft(); }
function toggleFlag(id,el){ if(current.flags.has(id))current.flags.delete(id); else current.flags.add(id); const on=current.flags.has(id); el.classList.toggle("on",on); el.setAttribute("aria-checked",on?"true":"false"); updateLive(); saveDraft(); }

function buildGaugeStatics(){
  const ticks=$("#ticks"); ticks.innerHTML="";
  const tot=totalWeight(); const lines=Math.min(Math.round(tot),14);
  for(let i=1;i<lines;i++){ const el=document.createElement("i"); el.style.bottom=(i/lines*100)+"%"; ticks.appendChild(el); }
  positionThreshold();
}
function positionThreshold(){
  const tot=totalWeight();
  $("#threshLine").style.bottom=(Math.min(settings.weightThreshold,tot)/tot*100)+"%";
  $("#countOf").textContent=`/ ${settings.weightThreshold} thr`;
}
function updateLive(){
  const ev=evaluate(current.checked,current.flags), v=$("#verdict"), tot=totalWeight();
  v.classList.remove("s-stable","s-strained","s-collapse","override");
  v.classList.add("s-"+ev.state); if(ev.overrideHit)v.classList.add("override");
  $("#fill").style.height=Math.min(100, ev.weight/tot*100)+"%";
  $("#countN").textContent=fmtW(ev.weight);
  $("#pulse").style.background= ev.state==="collapse"?"var(--red)":ev.state==="strained"?"var(--amber)":"var(--teal)";
  const WORD={stable:"STABLE",strained:"STRAINED",collapse:"COLLAPSE"};
  const ACT={stable:"Gradient intact. Clear to keep going.",strained:"Gradient lagging. Wind down this block.",collapse:"Down-regulated. Reset before the next block."};
  $("#stateWord").textContent=WORD[ev.state]; $("#stateAction").textContent=ACT[ev.state];
  const why=$("#whyList"); why.innerHTML="";
  ev.reasons.forEach(r=>{ const c=document.createElement("span"); c.className="chip"+(r.k?(" "+r.k):""); c.innerHTML=`<span class="dot"></span>${esc(r.txt)}`; why.appendChild(c); });
  const p=$("#protocol"), pd=PROTO[ev.state];
  if(pd){ p.classList.add("show"); $("#protoHead").textContent=pd.head; $("#protoWhat").innerHTML=pd.what; $("#protoReset").innerHTML=pd.reset; } else p.classList.remove("show");
}

/* ================= end-block ================= */
function setOutcome(o){ current.outcome=o; $$(".ob").forEach(b=>b.classList.toggle("sel", b.dataset.outcome===o)); $("#breakRow").style.display=o==="break"?"flex":"none"; saveDraft(); }
function setActual(v){ current.actualLen=Math.max(1,v); current.actualTouched=true; $("#actVal").textContent=current.actualLen+"m"; saveDraft(); }
function setBreak(v){ current.breakLen=Math.max(1,v); $("#brkVal").textContent=current.breakLen+"m"; saveDraft(); }

/* ================= active session + elapsed ================= */
function elapsedMin(){ return active? Math.max(0, Math.round((Date.now()-new Date(active.startTs).getTime())/60000)) : 0; }
function renderActiveBar(){
  const bar=$("#activeBar");
  if(!active){ bar.classList.remove("show","over"); if(elapsedTimer){clearInterval(elapsedTimer);elapsedTimer=null;} return; }
  bar.classList.add("show"); $("#abStart").textContent=active.startTime; $("#abPlanned").textContent=active.planned+"m";
  tickElapsed(); if(!elapsedTimer) elapsedTimer=setInterval(tickElapsed,15000);
}
function tickElapsed(){
  if(!active)return; const e=elapsedMin();
  $("#abElapsed").textContent=e+"m"; $("#activeBar").classList.toggle("over", e>active.planned);
  if(!current.actualTouched){ current.actualLen=Math.max(1,e); $("#actVal").textContent=current.actualLen+"m"; $("#lenSource").textContent="from clock"; }
}
async function startSession(){
  if(active){ toast("A session is already active","amber"); return; }
  active={ startTs:new Date().toISOString(), startTime:nowTime(), planned:pre.planned,
    readiness:{items:[...pre.ready], score:readyFraction()},
    motivation:pre.motivation, motFactors:[...pre.motFactors], vulns:[...pre.vulns],
    block:blockIdForDate(new Date()) };
  await saveActive();
  current.actualTouched=false; current.actualLen=pre.planned; $("#actVal").textContent=current.actualLen+"m"; $("#lenSource").textContent="from clock";
  renderActiveBar(); saveDraft();
  toast(`Session started · planned ${active.planned}m`,"teal"); switchTab("reading");
}
function discardActive(){
  showConfirm("Discard this session?","The running session is dropped without saving. Your logged history is untouched.","Discard",async()=>{
    active=null; await saveActive(); current.actualTouched=false; $("#lenSource").textContent="manual"; renderActiveBar(); toast("Session discarded","amber");
  });
}

/* ================= save / clear ================= */
async function saveReading(){
  if(!current.outcome){ toast("Pick how the block ended first","amber"); return; }
  const ev=evaluate(current.checked,current.flags);
  const start=active;
  const startTs=start?start.startTs:new Date().toISOString();
  const reading={
    id:uid("r"), ts:new Date().toISOString(), date:todayStr(), time:nowTime(),
    session:nextSessionForToday(),
    startTs, startTime:start?start.startTime:nowTime(), block:blockIdForDate(new Date(startTs)),
    plannedLen:start?start.planned:null, actualLen:current.actualLen,
    outcome:current.outcome, breakLen:current.outcome==="break"?current.breakLen:null,
    readiness:start?start.readiness:{items:[...pre.ready],score:readyFraction()},
    motivation:start?start.motivation:pre.motivation,
    motFactors:start?start.motFactors:[...pre.motFactors],
    vulns:start?start.vulns:[...pre.vulns],
    triggers:[...current.triggers],
    symptoms:[...current.checked], flags:[...current.flags],
    state:ev.state, weight:ev.weight, layers:ev.layersActive,
    notes:current.notes.trim()
  };
  readings.push(reading);
  await saveReadings();
  active=null; await saveActive();
  await writeAutoBackup();

  const ow={continued:"continued",break:"recovery break",quit:"quit"}[reading.outcome];
  toast(`Saved · ${reading.actualLen}m · ${ow} · ${reading.state.toUpperCase()}`, reading.outcome==="continued"?"teal":reading.outcome==="break"?"amber":"red");

  current={ checked:new Set(), flags:new Set(), notes:"", outcome:null, actualLen:pre.planned, actualTouched:false, breakLen:10, triggers:new Set() };
  $("#notes").value="";
  $$(".row.on").forEach(r=>{r.classList.remove("on");r.setAttribute("aria-checked","false");});
  $$(".ob").forEach(b=>b.classList.remove("sel"));
  $$("#trigChips .chip-tag.on").forEach(c=>c.classList.remove("on"));
  $("#breakRow").style.display="none"; $("#brkVal").textContent="10m"; $("#actVal").textContent=current.actualLen+"m"; $("#lenSource").textContent="manual";
  await saveDraft();
  renderActiveBar(); updateLive(); renderAnalytics(); renderLog();
}
function clearChecks(){
  current.checked.clear(); current.flags.clear();
  $$("#layers .row.on,#flagRows .row.on").forEach(r=>{r.classList.remove("on");r.setAttribute("aria-checked","false");});
  updateLive(); saveDraft();
}

/* ================= draft restore ================= */
function applyDraft(d){
  if(!d) return;
  if(d.pre){ pre.ready=new Set((d.pre.ready||[]).filter(id=>schema.ready.find(r=>r.id===id)));
    pre.planned=d.pre.planned||25; pre.motivation=(d.pre.motivation==null?50:d.pre.motivation);
    pre.motFactors=new Set((d.pre.motFactors||[]).filter(id=>schema.motivationFactors.find(m=>m.id===id)));
    pre.vulns=new Set((d.pre.vulns||[]).filter(id=>schema.vulnerabilities.find(v=>v.id===id))); }
  if(d.reading){ current.checked=new Set((d.reading.checked||[]).filter(id=>symById(id)));
    current.flags=new Set((d.reading.flags||[]).filter(id=>flagById(id)));
    current.notes=d.reading.notes||""; current.outcome=d.reading.outcome||null;
    current.actualLen=d.reading.actualLen||pre.planned; current.actualTouched=!!d.reading.actualTouched;
    current.breakLen=d.reading.breakLen||10; current.triggers=new Set((d.reading.triggers||[]).filter(id=>schema.triggers.find(t=>t.id===id))); }
}

/* ================= analytics: data ================= */
function inRange(r){ if(anaRange==="all")return true; const days=anaRange==="7d"?7:30; return new Date(r.ts).getTime()>=Date.now()-days*864e5; }
function anaRecs(){ return readings.filter(inRange); }
function byBlock(){
  const recs=anaRecs().filter(hasLen); const map={};
  recs.forEach(r=>{ const id=blockOf(r); (map[id]=map[id]||[]).push(r); });
  return Object.keys(map).sort((a,b)=>(a==="offhours"?99999:parseInt(a.slice(1)))-(b==="offhours"?99999:parseInt(b.slice(1))))
    .map(id=>{ const inB=map[id], cont=inB.filter(r=>r.outcome==="continued"), over=inB.filter(isOverload);
      return {id, label:blockShort(id), full:blockLabel(id), n:inB.length,
        sus:cont.length?Math.round(mean(cont.map(r=>r.actualLen))):null,
        all:Math.round(mean(inB.map(r=>r.actualLen))), overRate:over.length/inB.length}; });
}
function byLengthBucket(){
  const recs=anaRecs().filter(r=>hasLen(r)&&r.outcome); const bk=[[0,15],[15,25],[25,35],[35,45],[45,9999]];
  return bk.map(([lo,hi])=>{ const inBk=recs.filter(r=>r.actualLen>=lo&&r.actualLen<hi);
    const c=inBk.filter(r=>r.outcome==="continued").length, b=inBk.filter(r=>r.outcome==="break").length, q=inBk.filter(r=>r.outcome==="quit").length;
    return {label:hi===9999?`${lo}+ m`:`${lo}–${hi} m`, n:inBk.length, c, b, q, overRate:inBk.length?(b+q)/inBk.length:null}; }).filter(x=>x.n>0);
}
function byOrdinal(){
  const recs=anaRecs().filter(hasLen); const maxOrd=Math.max(1,...recs.map(r=>r.session||1)); const out=[];
  for(let o=1;o<=Math.min(maxOrd,8);o++){ const inO=recs.filter(r=>(r.session||1)===o); if(!inO.length)continue;
    out.push({o, n:inO.length, mean:Math.round(mean(inO.map(r=>r.actualLen))), overRate:inO.filter(isOverload).length/inO.length}); }
  return out;
}
function plannedVsActual(){
  const recs=anaRecs().filter(r=>hasLen(r)&&typeof r.plannedLen==="number"); if(!recs.length)return null;
  const cut=recs.filter(r=>r.actualLen<r.plannedLen-1).length;
  return {n:recs.length, mp:Math.round(mean(recs.map(r=>r.plannedLen))), ma:Math.round(mean(recs.map(r=>r.actualLen))), over:Math.round(mean(recs.map(r=>r.plannedLen-r.actualLen))), cutRate:cut/recs.length};
}
function freqInOverload(field, items){
  const over=anaRecs().filter(isOverload); if(!over.length)return {n:0,list:[]};
  return {n:over.length, list:items.map(it=>{ const c=over.filter(r=>(r[field]||[]).includes(it.id)).length; return {label:it.label,c,rate:c/over.length}; }).filter(x=>x.c>0).sort((a,b)=>b.c-a.c).slice(0,8)};
}
function symptomsInOverload(){
  const over=anaRecs().filter(isOverload); if(!over.length)return {n:0,list:[]};
  const tally={}; over.forEach(r=>{ (r.symptoms||[]).forEach(id=>tally[id]=(tally[id]||0)+1); (r.flags||[]).forEach(id=>tally[id]=(tally[id]||0)+1); });
  return {n:over.length, list:Object.entries(tally).map(([id,c])=>({label:itemLabel(id),c,rate:c/over.length})).sort((a,b)=>b.c-a.c).slice(0,8)};
}
function tagOverloadStats(field, items){
  const recs=anaRecs().filter(r=>r.outcome);
  return items.map(it=>{ const has=recs.filter(r=>(r[field]||[]).includes(it.id)); return {label:it.label, n:has.length, rate:has.length?has.filter(isOverload).length/has.length:null}; })
    .filter(x=>x.n>0).sort((a,b)=>(b.rate||0)-(a.rate||0));
}
function trends(){
  const days=[...new Set(anaRecs().map(r=>r.date))].sort();
  return days.map(d=>{ const rs=anaRecs().filter(r=>r.date===d);
    const len=rs.filter(r=>r.outcome==="continued"&&hasLen(r)).map(r=>r.actualLen);
    const out=rs.filter(r=>r.outcome), mot=rs.filter(r=>typeof r.motivation==="number").map(r=>r.motivation), load=rs.map(endWeight);
    return {label:d.slice(5), sus:len.length?Math.round(mean(len)):null, overRate:out.length?out.filter(isOverload).length/out.length:null, mot:mot.length?Math.round(mean(mot)):null, load:load.length?+mean(load).toFixed(1):null};
  }).slice(-30);
}

/* ================= analytics: render ================= */
function bar(k, sub, segs, valLabel, maxV){
  const total=segs.reduce((s,x)=>s+x.v,0), norm=maxV!=null?maxV:(total||1);
  const seg=segs.map(s=> s.v>0?`<div class="seg ${s.c}" style="width:${Math.min(100,(s.v/norm)*100)}%"></div>`:"").join("");
  return `<div class="barh"><div class="k">${esc(k)}${sub?`<small>${esc(sub)}</small>`:""}</div><div class="track">${seg}</div><div class="v">${esc(valLabel)}</div></div>`;
}
function svgLine(series, opt){
  opt=opt||{}; const w=480,h=150,color=opt.color||"var(--teal)";
  const pad={l:36,r:10,t:12,b:22}, iw=w-pad.l-pad.r, ih=h-pad.t-pad.b;
  const vals=series.filter(p=>p.v!=null).map(p=>p.v);
  if(vals.length<2) return `<div class="chart-empty">Need ≥2 days with data in range.</div>`;
  let mx=opt.yMax!=null?opt.yMax:Math.max(...vals), mn=opt.yMin!=null?opt.yMin:Math.min(...vals,0); if(mx===mn)mx=mn+1;
  const n=series.length, X=i=>pad.l+(n<=1?iw/2:i/(n-1)*iw), Y=v=>pad.t+ih-(v-mn)/(mx-mn)*ih;
  let path="",started=false,dots="";
  series.forEach((p,i)=>{ if(p.v==null){started=false;return;} const x=X(i),y=Y(p.v); path+=(started?"L":"M")+x.toFixed(1)+" "+y.toFixed(1)+" "; started=true; dots+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.4" fill="${color}"/>`; });
  const gy=[mn,(mn+mx)/2,mx];
  const grid=gy.map(g=>{ const y=Y(g); return `<line class="lc-grid" x1="${pad.l}" y1="${y.toFixed(1)}" x2="${w-pad.r}" y2="${y.toFixed(1)}"/><text class="lc-lbl" x="${pad.l-5}" y="${(y+3).toFixed(1)}" text-anchor="end">${opt.fmtY?opt.fmtY(g):Math.round(g)}</text>`; }).join("");
  const xl=`<text class="lc-lbl" x="${pad.l}" y="${h-6}">${esc(series[0].label||"")}</text>`+(n>1?`<text class="lc-lbl" x="${w-pad.r}" y="${h-6}" text-anchor="end">${esc(series[n-1].label||"")}</text>`:"");
  return `<div class="lc-wrap"><svg class="lc-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">${grid}<path d="${path}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${dots}${xl}</svg></div>`;
}
function lineCard(title, note, series, opt){
  return `<div class="card chart-card"><h4>${title}</h4><p class="cn">${note}</p>${svgLine(series,opt)}</div>`;
}
function renderTrends(){
  const host=$("#trendCharts"); const tr=trends();
  const mk=(metric)=>tr.map(r=>({label:r.label, v:r[metric]}));
  const overSeries=tr.map(r=>({label:r.label, v:r.overRate==null?null:Math.round(r.overRate*100)}));
  host.innerHTML =
    lineCard("Sustainable length","Continued-block average per day (min).", mk("sus"), {color:"var(--teal)", yMin:0, fmtY:v=>Math.round(v)}) +
    lineCard("Motivation","Average logged motivation per day (0–100).", mk("mot"), {color:"var(--violet)", yMin:0, yMax:100}) +
    lineCard("Overload rate","Share of blocks ending in break/quit, per day.", overSeries, {color:"var(--red)", yMin:0, yMax:100, fmtY:v=>Math.round(v)+"%"}) +
    lineCard("End-of-block load","Average weighted fatigue at block end, per day.", mk("load"), {color:"var(--amber)", yMin:0, fmtY:v=>v.toFixed(1)});
}
function renderBars(){
  const host=$("#charts"); host.innerHTML="";
  const blk=byBlock();

  let c1=`<div class="card chart-card"><h4>Sustainable length · time of day</h4><p class="cn">Average length of blocks you <b>continued</b>, by clock-time slot. Your safe length per part of the day.</p>`;
  if(blk.length){ const maxV=Math.max(...blk.map(x=>x.sus||x.all||0),1);
    c1+=blk.map(x=>{ const val=x.sus!=null?x.sus:x.all, lab=x.sus!=null?`${x.sus}m`:`~${x.all}m*`;
      return bar(x.label, `${x.full} · n=${x.n}`, [{v:val||0,c:x.sus!=null?"seg-teal":"seg-blue"}], lab, maxV); }).join("");
    if(blk.some(x=>x.sus==null)) c1+=`<p class="cn" style="margin:10px 0 0">* no fully-continued block yet — all-session average.</p>`;
  } else c1+=`<div class="chart-empty">No timed sessions yet. Start a block from Pre-study, then log its end.</div>`;
  c1+=`</div>`;

  const lb=byLengthBucket();
  let c2=`<div class="card chart-card"><h4>Overload ceiling · by length</h4><p class="cn">How blocks ended, grouped by length. Where amber/red takes over is your desirable-difficulty ceiling.</p>`;
  if(lb.length){ c2+=lb.map(x=>bar(x.label,`n=${x.n}`,[{v:x.c,c:"seg-teal"},{v:x.b,c:"seg-amber"},{v:x.q,c:"seg-red"}], x.overRate!=null?`${pct(x.overRate)}%`:"—")).join("");
    c2+=`<div class="legend"><span><i class="seg-teal"></i>continued</span><span><i class="seg-amber"></i>break</span><span><i class="seg-red"></i>quit</span></div><p class="cn" style="margin:8px 0 0">value = share ending in break/quit.</p>`;
  } else c2+=`<div class="chart-empty">Need sessions with a recorded outcome and length.</div>`;
  c2+=`</div>`;

  let c3=`<div class="card chart-card"><h4>Overload rate · time of day</h4><p class="cn">Share of blocks ending in break/quit, by slot. When you're most vulnerable.</p>`;
  if(blk.length){ c3+=blk.map(x=>bar(x.label,`${x.full} · n=${x.n}`,[{v:x.overRate||0,c:"seg-red"}], `${pct(x.overRate)}%`,1)).join(""); }
  else c3+=`<div class="chart-empty">No timed sessions yet.</div>`;
  c3+=`</div>`;

  const ord=byOrdinal();
  let c4=`<div class="card chart-card"><h4>Within-day decay · by session #</h4><p class="cn">Average block length by its order in the day. The cumulative drop from morning reserve.</p>`;
  if(ord.length){ const maxV=Math.max(...ord.map(x=>x.mean),1);
    c4+=ord.map(x=>bar(`Session ${x.o}`,`n=${x.n}`,[{v:x.mean,c:x.overRate>=.5?"seg-red":x.overRate>0?"seg-amber":"seg-teal"}], `${x.mean}m`, maxV)).join("");
  } else c4+=`<div class="chart-empty">Log sessions across a day to see decay.</div>`;
  c4+=`</div>`;

  const pa=plannedVsActual();
  let c5=`<div class="card chart-card"><h4>Planned vs actual</h4><p class="cn">Whether you plan longer than you sustain. A persistent gap means recalibrate.</p>`;
  if(pa){ const maxV=Math.max(pa.mp,pa.ma,1);
    c5+=bar("Planned","average",[{v:pa.mp,c:"seg-blue"}],`${pa.mp}m`,maxV)+bar("Actual","average",[{v:pa.ma,c:"seg-teal"}],`${pa.ma}m`,maxV);
    c5+=`<p class="cn" style="margin:11px 0 0">Cut short <b style="color:var(--text)">${pct(pa.cutRate)}%</b> of the time${pa.over>0?`, by ~<b style="color:var(--text)">${pa.over}m</b> on average`:""} · n=${pa.n}.</p>`;
  } else c5+=`<div class="chart-empty">Start sessions from Pre-study (sets a planned length) to compare.</div>`;
  c5+=`</div>`;

  const so=symptomsInOverload();
  let c6=`<div class="card chart-card"><h4>Symptoms in overload</h4><p class="cn">Which symptoms appear in blocks you broke or quit. Your most reliable stop signals.</p>`;
  if(so.list.length){ c6+=so.list.map(x=>bar(x.label,"",[{v:x.rate,c:"seg-amber"}],`${pct(x.rate)}%`,1)).join("");
    c6+=`<p class="cn" style="margin:8px 0 0">% of your ${so.n} break/quit blocks containing each.</p>`;
  } else c6+=`<div class="chart-empty">No break/quit sessions logged yet.</div>`;
  c6+=`</div>`;

  const tg=freqInOverload("triggers", schema.triggers);
  let c7=`<div class="card chart-card"><h4>Triggers in overload</h4><p class="cn">What you tagged as setting symptoms off, in blocks that overloaded.</p>`;
  if(tg.list.length){ c7+=tg.list.map(x=>bar(x.label,"",[{v:x.rate,c:"seg-red"}],`${pct(x.rate)}%`,1)).join("");
    c7+=`<p class="cn" style="margin:8px 0 0">% of ${tg.n} break/quit blocks with each trigger.</p>`;
  } else c7+=`<div class="chart-empty">Tag triggers on the Reading screen to populate this.</div>`;
  c7+=`</div>`;

  const mf=tagOverloadStats("motFactors", schema.motivationFactors);
  let c8=`<div class="card chart-card"><h4>Motivation factors → overload</h4><p class="cn">Overload rate on blocks where each factor was present. High = risk; low = protective.</p>`;
  if(mf.length){ c8+=mf.map(x=>bar(x.label,`n=${x.n}`,[{v:x.rate||0,c:"seg-violet"}], x.rate!=null?`${pct(x.rate)}%`:"—",1)).join(""); }
  else c8+=`<div class="chart-empty">Tag motivation factors in Pre-study to populate this.</div>`;
  c8+=`</div>`;

  const vu=tagOverloadStats("vulns", schema.vulnerabilities);
  let c9=`<div class="card chart-card"><h4>Vulnerabilities → overload</h4><p class="cn">Overload rate on blocks where you carried each vulnerability in.</p>`;
  if(vu.length){ c9+=vu.map(x=>bar(x.label,`n=${x.n}`,[{v:x.rate||0,c:"seg-amber"}], x.rate!=null?`${pct(x.rate)}%`:"—",1)).join(""); }
  else c9+=`<div class="chart-empty">Tag vulnerabilities in Pre-study to populate this.</div>`;
  c9+=`</div>`;

  host.innerHTML=c1+c2+c3+c4+c5+c6+c7+c8+c9;
}
function renderInsight(){
  const el=$("#insight"); const timed=anaRecs().filter(hasLen);
  if(timed.length<2){ el.innerHTML=`Log a handful of sessions — start a block from <b>Pre-study</b>, then record its length and outcome on <b>Reading</b>. Once a few exist, this line summarises where your overload boundary sits.`; return; }
  const parts=[]; const blk=byBlock().filter(x=>x.sus!=null).sort((a,b)=>b.sus-a.sus);
  if(blk.length>=2) parts.push(`Longest sustainable blocks come at <span class="em">${esc(blk[0].full)}</span> (~${blk[0].sus}m); shortest at <span class="em">${esc(blk[blk.length-1].full)}</span> (~${blk[blk.length-1].sus}m).`);
  else if(blk.length===1) parts.push(`So far your continued blocks average <span class="em">~${blk[0].sus}m</span> (${esc(blk[0].full)}).`);
  const lb=byLengthBucket(); const ceil=lb.find(x=>x.overRate!=null&&x.overRate>=0.5&&x.n>=2);
  if(ceil) parts.push(`Past <span class="em">${ceil.label}</span>, blocks end in break/quit ${pct(ceil.overRate)}% of the time — your ceiling.`);
  const cont=anaRecs().filter(r=>r.outcome==="continued"&&typeof r.motivation==="number").map(r=>r.motivation);
  const over=anaRecs().filter(isOverload).map(r=>r.motivation).filter(v=>typeof v==="number");
  if(cont.length>=2&&over.length>=2){ const dc=Math.round(mean(cont)), dov=Math.round(mean(over)); if(Math.abs(dc-dov)>=8) parts.push(`Motivation averages <span class="em">${dc}</span> on continued blocks vs <span class="em">${dov}</span> on overloaded ones.`); }
  const so=symptomsInOverload(); if(so.list.length&&so.list[0].rate>=0.5) parts.push(`<b>${esc(so.list[0].label)}</b> precedes ${pct(so.list[0].rate)}% of overloads — treat it as an early stop signal.`);
  el.innerHTML = parts.length?parts.join(" "):`Keep logging — patterns sharpen as the time-of-day and length buckets fill in.`;
}
function renderAnalytics(){ renderInsight(); renderTrends(); renderBars(); }

/* ================= log ================= */
function renderLog(){
  const sorted=[...readings].sort((a,b)=>b.ts.localeCompare(a.ts));
  $("#logMeta").textContent=readings.length?`${readings.length} total`:"";
  const list=$("#logList");
  if(!readings.length){ list.innerHTML=`<div class="log-empty">Your saved blocks appear here.<br>Each is one study block: when, how long, how it ended, and the fatigue reading.</div>`; return; }
  list.className="log-list";
  list.innerHTML=sorted.map(r=>{
    const o=r.outcome||"none", ow={continued:"CONT",break:"BREAK",quit:"QUIT",none:"—"}[o];
    const len=hasLen(r)?`${r.actualLen}m`:"—", plan=typeof r.plannedLen==="number"?` (plan ${r.plannedLen}m)`:"";
    const blk=blockShort(blockOf(r));
    const sx=(r.symptoms||[]).map(id=>itemLabel(id)); (r.flags||[]).forEach(id=>sx.push("⚑ "+itemLabel(id)));
    const sxLine=sx.length?sx.join(" · "):`${r.state||"—"} · no symptoms`;
    const ctx=[]; if(typeof r.motivation==="number")ctx.push(`mot ${r.motivation}`); if((r.triggers||[]).length)ctx.push(`${r.triggers.length} trig`);
    return `<div class="log-row" data-id="${r.id}"><span class="tag o-${o}">${ow}</span>
      <div class="mid"><div class="l1"><b>S${r.session||"?"}</b> · ${esc(r.date)} ${esc(r.startTime||r.time)} · ${esc(blk)} · <b>${len}</b>${plan} · ${r.state||"—"}${ctx.length?" · "+esc(ctx.join(" · ")):""}</div>
      <div class="l2">${esc(sxLine)}${r.outcome==="break"&&r.breakLen?` · break ${r.breakLen}m`:""}</div>${r.notes?`<div class="l3">${esc(r.notes)}</div>`:""}</div>
      <button class="log-del" data-del="${r.id}" title="Delete">✕</button></div>`;
  }).join("");
}
async function deleteReading(id){ readings=readings.filter(r=>r.id!==id); await saveReadings(); await writeAutoBackup(); renderAnalytics(); renderLog(); toast("Block deleted","amber"); }

/* ================= configure / editor ================= */
const SECTIONS=[
  {key:"layers", title:"Layers", desc:"Systems your symptoms group under."},
  {key:"symptoms", title:"Symptoms", desc:"Fatigue read-outs you tick during a block. Weight feeds the gauge."},
  {key:"redflags", title:"Red flags", desc:"Severe signals. Mark critical for an instant COLLAPSE override."},
  {key:"ready", title:"Pre-study checklist", desc:"Readiness items. Weight sets each one's share of your reserve score."},
  {key:"motivationFactors", title:"Motivation factors", desc:"Things that push motivation up (+) or down (−)."},
  {key:"triggers", title:"Triggers", desc:"What set a symptom off during a block."},
  {key:"vulnerabilities", title:"Vulnerabilities", desc:"States you carry in that predispose certain symptoms."},
];
const debounce=(fn,ms)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};};
const saveSchemaDeb=debounce(saveSchema,300);
let typedSnap=false;
function txt(val, ph, multiline, onIn){
  const i=document.createElement(multiline?"textarea":"input"); i.className="ed-in"; i.value=val||""; i.placeholder=ph||"";
  i.addEventListener("input",()=>{ if(!typedSnap){ pushUndo("edit "+ph); typedSnap=true; } onIn(i.value); saveSchemaDeb(); refreshConsumersLight(); });
  i.addEventListener("blur",()=>{ typedSnap=false; });
  return i;
}
function weightStepper(getV,setV){
  const wrap=document.createElement("div"); wrap.className="stepper sm";
  const mk=(t,fn)=>{const b=document.createElement("button");b.textContent=t;b.onclick=fn;return b;};
  const span=document.createElement("span"); span.className="v"; span.textContent="w "+fmtW(getV());
  wrap.appendChild(mk("–",()=>chg(-1))); wrap.appendChild(span); wrap.appendChild(mk("+",()=>chg(1)));
  function chg(d){ pushUndo("weight"); setV(Math.max(0,Math.round((getV()+d)*10)/10)); saveSchema(); span.textContent="w "+fmtW(getV()); refreshConsumersFull(); }
  return wrap;
}
function critToggle(getV,setV){
  const b=document.createElement("button"); b.className="crit-toggle"; render();
  b.onclick=()=>{ pushUndo("toggle critical"); setV(!getV()); saveSchema(); render(); refreshConsumersFull(); };
  function render(){ b.innerHTML=`<span style="width:11px;height:11px;border-radius:3px;border:1.5px solid ${getV()?"var(--red)":"var(--line)"};background:${getV()?"var(--red)":"transparent"};display:inline-block"></span> critical override`; }
  return b;
}
function layerSelect(sym){
  const s=document.createElement("select"); s.className="ed-sel";
  schema.layers.forEach(l=>{ const o=document.createElement("option"); o.value=l.id; o.textContent=l.name; if(l.id===sym.layerId)o.selected=true; s.appendChild(o); });
  s.onchange=()=>{ pushUndo("move symptom"); sym.layerId=s.value; saveSchema(); refreshConsumersFull(); };
  return s;
}
function signSeg(item){
  const w=document.createElement("div"); w.className="sign-seg";
  [["1","+ raises"],["-1","− lowers"]].forEach(([v,t])=>{ const b=document.createElement("button"); b.dataset.sign=v; b.textContent=t; if(String(item.sign)===v)b.classList.add("on");
    b.onclick=()=>{ pushUndo("factor sign"); item.sign=parseInt(v,10); saveSchema(); [...w.children].forEach(c=>c.classList.toggle("on",c.dataset.sign===v)); buildContextChips(); }; w.appendChild(b); });
  return w;
}
function linkChips(vul){
  const w=document.createElement("div"); w.className="linkwrap";
  schema.symptoms.forEach(s=>{ const b=document.createElement("button"); b.className="linkchip"+((vul.symptomIds||[]).includes(s.id)?" on":""); b.textContent=s.label;
    b.onclick=()=>{ pushUndo("link symptom"); vul.symptomIds=vul.symptomIds||[]; const i=vul.symptomIds.indexOf(s.id); if(i<0)vul.symptomIds.push(s.id); else vul.symptomIds.splice(i,1); saveSchema(); b.classList.toggle("on"); }; w.appendChild(b); });
  return w;
}
function metaRow(){ const r=document.createElement("div"); r.className="ed-meta"; return r; }
function lbl(t){ const s=document.createElement("span"); s.className="ml"; s.textContent=t; return s; }
function renderEditor(){
  const host=$("#editorHost"); host.innerHTML="";
  SECTIONS.forEach(sec=>{
    const list=schema[sec.key]||[];
    const wrap=document.createElement("div"); wrap.className="ed-sec";
    const eh=document.createElement("div"); eh.className="eh";
    eh.innerHTML=`<h4>${esc(sec.title)}</h4><span class="cnt">${list.length}</span>`;
    wrap.appendChild(eh);
    const d=document.createElement("p"); d.className="edesc"; d.textContent=sec.desc; wrap.appendChild(d);

    list.forEach(item=>{
      const it=document.createElement("div"); it.className="ed-item";
      const r1=document.createElement("div"); r1.className="ed-r1";
      const labelKey=sec.key==="layers"?"name":"label";
      r1.appendChild(txt(item[labelKey], sec.key==="layers"?"Layer name":"Name", false, v=>item[labelKey]=v));
      const del=document.createElement("button"); del.className="ed-del"; del.textContent="✕"; del.title="Remove";
      del.onclick=()=>{ pushUndo("remove "+(item[labelKey]||sec.title)); schema[sec.key]=schema[sec.key].filter(x=>x.id!==item.id); saveSchema(); renderEditor(); refreshConsumersFull(); };
      r1.appendChild(del); it.appendChild(r1);

      if(sec.key==="layers"){
        it.appendChild(txt(item.sub,"Subtitle (e.g. cognitive deceleration)",false,v=>item.sub=v));
        it.appendChild(txt(item.loc,"Locus tag (optional)",false,v=>item.loc=v));
      } else {
        it.appendChild(txt(item.desc,"Description",true,v=>item.desc=v));
        const m=metaRow();
        if(sec.key==="symptoms"||sec.key==="redflags"||sec.key==="ready"){ m.appendChild(lbl("weight")); m.appendChild(weightStepper(()=>+item.weight||0,v=>item.weight=v)); }
        if(sec.key==="symptoms"){ m.appendChild(lbl("layer")); m.appendChild(layerSelect(item)); }
        if(sec.key==="symptoms"||sec.key==="redflags"){ m.appendChild(critToggle(()=>!!item.critical,v=>item.critical=v)); }
        if(sec.key==="motivationFactors"){ m.appendChild(lbl("effect")); m.appendChild(signSeg(item)); }
        if(m.children.length) it.appendChild(m);
        if(sec.key==="vulnerabilities"){ const ll=lbl("predisposes to"); ll.style.display="block"; it.appendChild(ll); it.appendChild(linkChips(item)); }
      }
      wrap.appendChild(it);
    });

    const add=document.createElement("button"); add.className="ed-add"; add.textContent=`+ Add ${sec.title.replace(/s$/,"").toLowerCase()}`;
    add.onclick=()=>{ pushUndo("add "+sec.title);
      const nid=uid(sec.key.slice(0,3));
      const base={layers:{id:nid,name:"New layer",sub:"",loc:""},
        symptoms:{id:nid,layerId:(schema.layers[0]||{}).id||"L1",label:"New symptom",desc:"",weight:1,critical:false},
        redflags:{id:nid,label:"New red flag",desc:"",weight:3,critical:true},
        ready:{id:nid,label:"New item",desc:"",weight:1},
        motivationFactors:{id:nid,label:"New factor",desc:"",sign:1},
        triggers:{id:nid,label:"New trigger",desc:""},
        vulnerabilities:{id:nid,label:"New vulnerability",desc:"",symptomIds:[]}}[sec.key];
      schema[sec.key]=schema[sec.key]||[]; schema[sec.key].push(base); saveSchema(); renderEditor(); refreshConsumersFull(); };
    wrap.appendChild(add);
    host.appendChild(wrap);
  });
}
function refreshConsumersLight(){ buildIntake(); buildRedflags(); buildReady(); buildContextChips(); updateReadyScore(); updateLive(); renderPreVerdict(); }
function refreshConsumersFull(){ refreshConsumersLight(); buildGaugeStatics(); setPlanned(pre.planned); renderAnalytics(); }

/* ================= rebuild everything ================= */
function rebuildAll(){
  buildReady(); buildIntake(); buildRedflags(); buildContextChips(); buildGaugeStatics();
  updateReadyScore(); setMotivation(pre.motivation); setPlanned(pre.planned); updateLive();
  renderEditor(); renderAnalytics(); renderLog(); renderSavePip();
}

/* ================= export / import / notion / csv ================= */
function download(fn,text,mime){ try{ const b=new Blob([text],{type:mime||"text/plain"}); const u=URL.createObjectURL(b); const a=document.createElement("a"); a.href=u;a.download=fn;document.body.appendChild(a);a.click(); setTimeout(()=>{URL.revokeObjectURL(u);a.remove();},200); return true; }catch(e){return false;} }
function exportJson(){ const payload=JSON.stringify({app:"cortical-load",version:2,exportedAt:new Date().toISOString(),schema,settings,readings},null,2);
  const ok=download(`cortical-load-backup-${todayStr()}.json`,payload,"application/json"); if(ok)toast("Backup downloaded","teal"); else showCopyModal("Backup","Download blocked here. Copy and save as a .json file.",payload); }
function importJson(file){ const rd=new FileReader();
  rd.onload=async()=>{ try{ const data=JSON.parse(rd.result);
    if(data&&data.schema&&typeof data.schema==="object"){ schema=normalizeSchema(data.schema); await saveSchema(); }
    if(data&&data.settings&&typeof data.settings==="object"){ settings={...DEFAULT_SETTINGS,...data.settings}; await saveSettings(); }
    const incoming=Array.isArray(data)?data:(data.readings||[]); const have=new Set(readings.map(r=>r.id)); let added=0;
    (incoming||[]).forEach(r=>{ if(r&&r.id&&!have.has(r.id)){readings.push(migrateOldReading(r));have.add(r.id);added++;} });
    await saveReadings(); rebuildAll(); toast(`Restored · ${added} new block${added!==1?"s":""}, model + settings applied`,"teal");
  }catch(e){ toast("Couldn't read that file","red"); } }; rd.readAsText(file); }
function notionTable(){
  const head=`| Date | Start | Slot | Planned | Actual | Outcome | Break | State | Load | Layers | Motivation | Readiness | Symptoms | Triggers | Note |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|`;
  const rows=[...readings].sort((a,b)=>a.ts.localeCompare(b.ts)).map(r=>{
    const sx=(r.symptoms||[]).map(itemLabel).concat((r.flags||[]).map(id=>"⚑"+itemLabel(id))).join("; ")||"—";
    const tg=(r.triggers||[]).map(id=>{const t=schema.triggers.find(x=>x.id===id);return t?t.label:id;}).join("; ")||"—";
    const rdy=r.readiness?`${(r.readiness.items||[]).length}/${schema.ready.length}`:"—";
    const note=(r.notes||"").replace(/\|/g,"\\|").replace(/\n/g," ");
    return `| ${r.date} | ${r.startTime||r.time} | ${blockShort(blockOf(r))} | ${r.plannedLen??"—"} | ${hasLen(r)?r.actualLen:"—"} | ${r.outcome||"—"} | ${r.breakLen??"—"} | ${r.state||"—"} | ${fmtW(endWeight(r))} | ${r.layers??"—"} | ${r.motivation??"—"} | ${rdy} | ${sx} | ${tg} | ${note} |`;
  }).join("\n");
  return head+"\n"+rows;
}
function csv(){
  const H=["Date","Start","Slot","PlannedMin","ActualMin","Outcome","BreakMin","State","Load","Layers","Motivation","ReadinessChecked","Symptoms","Triggers","Vulnerabilities","MotivationFactors","Note"];
  const q=v=>`"${String(v).replace(/"/g,'""')}"`; const lines=[H.join(",")];
  const nm=(arr,list)=>(arr||[]).map(id=>{const x=(schema[list]||[]).find(y=>y.id===id);return x?x.label:id;}).join("; ");
  [...readings].sort((a,b)=>a.ts.localeCompare(b.ts)).forEach(r=>{
    const sx=(r.symptoms||[]).map(itemLabel).concat((r.flags||[]).map(itemLabel)).join("; ");
    lines.push([r.date,r.startTime||r.time,blockShort(blockOf(r)),r.plannedLen??"",hasLen(r)?r.actualLen:"",r.outcome||"",r.breakLen??"",r.state||"",fmtW(endWeight(r)),r.layers??"",r.motivation??"",r.readiness?(r.readiness.items||[]).length:"",sx,nm(r.triggers,"triggers"),nm(r.vulns,"vulnerabilities"),nm(r.motFactors,"motivationFactors"),(r.notes||"")].map(q).join(","));
  });
  return lines.join("\n");
}
async function copyClip(text){ try{ await navigator.clipboard.writeText(text); return true; }catch(e){ try{ const ta=document.createElement("textarea"); ta.value=text; ta.style.position="fixed"; ta.style.opacity="0"; document.body.appendChild(ta); ta.select(); const ok=document.execCommand("copy"); ta.remove(); return ok; }catch(_){return false;} } }
async function copyNotion(){ if(!readings.length){toast("No blocks to copy yet","amber");return;} const t=notionTable(); const ok=await copyClip(t); if(ok)toast("Notion table copied","teal"); else showCopyModal("Copy for Notion","Copy this, paste into Notion, then ‘Turn into database’.",t); }
function downloadCsv(){ if(!readings.length){toast("No blocks to export yet","amber");return;} const ok=download(`cortical-load-${todayStr()}.csv`,csv(),"text/csv"); if(ok)toast("CSV downloaded","teal"); else showCopyModal("CSV","Download blocked here. Copy and save as .csv.",csv()); }
function clearAll(){ showConfirm("Clear all data?","This removes every saved block. Your model/settings stay. Export a backup first if unsure.","Clear blocks",async()=>{ readings=[]; await saveReadings(); await writeAutoBackup(); renderAnalytics(); renderLog(); setPlanned(pre.planned); toast("All blocks cleared","amber"); }); }

/* ================= settings ================= */
function openSettings(){
  openModal(`<h3>Thresholds &amp; settings</h3><div class="mbody">
    <div class="set-section-label">Fatigue thresholds (weighted)</div>
    <div class="set-row"><div class="lbl"><div class="t">Weight threshold</div><div class="d">Summed weight of active items that triggers COLLAPSE. STRAINED kicks in at threshold − gap.</div></div><div class="stepper"><button id="thrMinus">–</button><span class="v" id="thrVal">${settings.weightThreshold}</span><button id="thrPlus">+</button></div></div>
    <div class="set-row"><div class="lbl"><div class="t">Strain gap</div><div class="d">How far below threshold STRAINED begins.</div></div><div class="stepper"><button id="sgMinus">–</button><span class="v" id="sgVal">${settings.strainGap}</span><button id="sgPlus">+</button></div></div>
    <div class="set-row"><div class="lbl"><div class="t">Breadth trigger</div><div class="d">Symptoms across all layers → COLLAPSE.</div></div><label class="switch"><input type="checkbox" id="breadthSw" ${settings.breadthRule?"checked":""}><span class="sl"></span></label></div>
    <div class="set-row"><div class="lbl"><div class="t">Calibration sample size</div><div class="d">Continued blocks needed in a slot before Pre-study trusts its average.</div></div><div class="stepper"><button id="msMinus">–</button><span class="v" id="msVal">${settings.minSamples}</span><button id="msPlus">+</button></div></div>
    <div class="set-section-label">Day window &amp; time blocks</div>
    <div class="set-row"><div class="lbl"><div class="t">Wake time</div><div class="d">Start of your day. Analytics ignore sessions before this.</div></div><input type="time" class="time-in" id="wakeIn" value="${esc(settings.wake)}"></div>
    <div class="set-row"><div class="lbl"><div class="t">Sleep time</div><div class="d">End of your day (can be after midnight).</div></div><input type="time" class="time-in" id="sleepIn" value="${esc(settings.sleep)}"></div>
    <div class="set-row"><div class="lbl"><div class="t">Block size</div><div class="d">Hours per time-of-day slot. Smaller = finer 09:00-vs-11:00 resolution.</div></div><div class="stepper"><button id="bhMinus">–</button><span class="v" id="bhVal">${settings.blockHours}h</span><button id="bhPlus">+</button></div></div>
    <div class="set-section-label">Backup</div>
    <div class="set-row"><div class="lbl"><div class="t">Auto-download backup</div><div class="d">Also save a .json file to disk each time a session ends (in addition to in-app auto-backup).</div></div><label class="switch"><input type="checkbox" id="adSw" ${settings.autoDownloadBackup?"checked":""}><span class="sl"></span></label></div>
  </div><div class="mfoot"><button class="btn" id="setReset">Reset defaults</button><button class="btn" id="setDone" style="border-color:var(--teal-line);color:var(--teal)">Done</button></div>`);
  const save=async(blocksChanged)=>{ await saveSettings(); positionThreshold(); buildGaugeStatics(); updateLive(); setPlanned(pre.planned); if(blocksChanged)renderAnalytics(); };
  $("#thrMinus").onclick=async()=>{settings.weightThreshold=Math.max(1,settings.weightThreshold-1);$("#thrVal").textContent=settings.weightThreshold;await save();};
  $("#thrPlus").onclick=async()=>{settings.weightThreshold=settings.weightThreshold+1;$("#thrVal").textContent=settings.weightThreshold;await save();};
  $("#sgMinus").onclick=async()=>{settings.strainGap=Math.max(0,settings.strainGap-1);$("#sgVal").textContent=settings.strainGap;await save();};
  $("#sgPlus").onclick=async()=>{settings.strainGap=settings.strainGap+1;$("#sgVal").textContent=settings.strainGap;await save();};
  $("#msMinus").onclick=async()=>{settings.minSamples=Math.max(1,settings.minSamples-1);$("#msVal").textContent=settings.minSamples;await save(true);};
  $("#msPlus").onclick=async()=>{settings.minSamples=Math.min(20,settings.minSamples+1);$("#msVal").textContent=settings.minSamples;await save(true);};
  $("#bhMinus").onclick=async()=>{settings.blockHours=Math.max(1,settings.blockHours-1);$("#bhVal").textContent=settings.blockHours+"h";await save(true);};
  $("#bhPlus").onclick=async()=>{settings.blockHours=Math.min(8,settings.blockHours+1);$("#bhVal").textContent=settings.blockHours+"h";await save(true);};
  $("#breadthSw").onchange=async e=>{settings.breadthRule=e.target.checked;await save();};
  $("#adSw").onchange=async e=>{settings.autoDownloadBackup=e.target.checked;await save();};
  $("#wakeIn").onchange=async e=>{settings.wake=e.target.value||"07:00";await save(true);};
  $("#sleepIn").onchange=async e=>{settings.sleep=e.target.value||"23:00";await save(true);};
  $("#setReset").onclick=async()=>{ settings={...DEFAULT_SETTINGS}; await save(true); closeModal(); openSettings(); toast("Defaults restored","teal"); };
  $("#setDone").onclick=closeModal;
}

/* ================= modals / toast ================= */
function openModal(html){ $("#modalBox").innerHTML=html; $("#modalBg").classList.add("show"); }
function closeModal(){ $("#modalBg").classList.remove("show"); }
$("#modalBg").addEventListener("click",e=>{ if(e.target.id==="modalBg")closeModal(); });
document.addEventListener("keydown",e=>{ if(e.key==="Escape")closeModal(); });
function showCopyModal(title,lead,text){ openModal(`<h3>${esc(title)}</h3><div class="mbody"><p class="lead">${esc(lead)}</p><textarea id="copyArea" readonly>${esc(text)}</textarea></div><div class="mfoot"><button class="btn" id="mClose">Close</button><button class="btn" id="mCopy" style="border-color:var(--teal-line);color:var(--teal)">Copy</button></div>`);
  $("#mClose").onclick=closeModal; $("#mCopy").onclick=async()=>{ const a=$("#copyArea"); a.select(); await copyClip(a.value); toast("Copied","teal"); }; }
function showConfirm(title,lead,label,onYes){ openModal(`<h3>${esc(title)}</h3><div class="mbody"><p class="lead">${esc(lead)}</p></div><div class="mfoot"><button class="btn" id="cNo">Cancel</button><button class="btn danger" id="cYes" style="border-color:var(--red-line);color:var(--red)">${esc(label)}</button></div>`);
  $("#cNo").onclick=closeModal; $("#cYes").onclick=()=>{ closeModal(); onYes(); }; }
let toastTimer=null;
function toast(msg,tone){ $("#toastMsg").textContent=msg; document.querySelector("#toast .ts-dot").style.background= tone==="red"?"var(--red)":tone==="amber"?"var(--amber)":tone==="blue"?"var(--blue)":tone==="violet"?"var(--violet)":"var(--teal)"; const t=$("#toast"); t.classList.add("show"); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove("show"),2700); }
function renderSavePip(){ const t=$("#savePipTxt"); if(!t)return; const pip=$("#savePip"); pip.classList.toggle("mem",!HAS_STORE);
  const lb=settings.lastBackup?new Date(settings.lastBackup).toLocaleString([], {month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}):"—";
  t.innerHTML= HAS_STORE?`Auto-saving on every change · auto-backup last ${esc(lb)}`:`In-memory only here — use Backup (.json). Auto-backup last ${esc(lb)}`; }

/* ================= tabs ================= */
function switchTab(name){ $$(".tab").forEach(t=>t.classList.toggle("active",t.dataset.tab===name)); $$(".view").forEach(v=>v.classList.toggle("active",v.id==="view-"+name));
  if(name==="analytics")renderAnalytics(); if(name==="pre")setPlanned(pre.planned); if(name==="configure")renderEditor(); }

/* ================= migration ================= */
function normalizeSchema(sc){
  const out=clone(DEFAULT_SCHEMA);
  Object.keys(DEFAULT_SCHEMA).forEach(k=>{ if(Array.isArray(sc[k])) out[k]=sc[k]; });
  out.symptoms=(out.symptoms||[]).map(s=>({id:s.id||uid("sym"),layerId:s.layerId||"L1",label:s.label||"Symptom",desc:s.desc||"",weight:(s.weight==null?1:+s.weight),critical:!!s.critical}));
  out.redflags=(out.redflags||[]).map(f=>({id:f.id||uid("rf"),label:f.label||"Red flag",desc:f.desc||"",weight:(f.weight==null?3:+f.weight),critical:f.critical!==false}));
  out.ready=(out.ready||[]).map(r=>({id:r.id||uid("rdy"),label:r.label||"Item",desc:r.desc||"",weight:(r.weight==null?1:+r.weight)}));
  out.layers=(out.layers||[]).map(l=>({id:l.id||uid("lay"),name:l.name||"Layer",sub:l.sub||"",loc:l.loc||""}));
  out.motivationFactors=(out.motivationFactors||[]).map(m=>({id:m.id||uid("mf"),label:m.label||"Factor",desc:m.desc||"",sign:m.sign<0?-1:1}));
  out.triggers=(out.triggers||[]).map(t=>({id:t.id||uid("tg"),label:t.label||"Trigger",desc:t.desc||""}));
  out.vulnerabilities=(out.vulnerabilities||[]).map(v=>({id:v.id||uid("vu"),label:v.label||"Vulnerability",desc:v.desc||"",symptomIds:Array.isArray(v.symptomIds)?v.symptomIds:[]}));
  return out;
}
function migrateOldReading(r){
  const o={...r};
  if(!Array.isArray(o.flags)) o.flags = o.flag? ["phone"] : [];
  delete o.flag;
  if(!Array.isArray(o.symptoms)) o.symptoms=[];
  if(typeof o.weight!=="number") o.weight=endWeight(o);
  if(!o.id) o.id=uid("r");
  return o;
}

/* ================= wiring ================= */
$("#openSettings").addEventListener("click",openSettings);
$("#undoBtn").addEventListener("click",doUndo);
$("#undoBtn2").addEventListener("click",doUndo);
$$(".tab").forEach(t=>t.addEventListener("click",()=>switchTab(t.dataset.tab)));
$("#lenRange").addEventListener("input",e=>setPlanned(parseInt(e.target.value,10)));
$("#motRange").addEventListener("input",e=>setMotivation(parseInt(e.target.value,10)));
$("#pvSuggest").addEventListener("click",e=>setPlanned(parseInt(e.currentTarget.dataset.v,10)));
$("#startBtn").addEventListener("click",startSession);
$("#abEnd").addEventListener("click",()=>switchTab("reading"));
$("#abDiscard").addEventListener("click",discardActive);
$("#saveBtn").addEventListener("click",saveReading);
$("#clearChecks").addEventListener("click",clearChecks);
$("#notes").addEventListener("input",e=>{ current.notes=e.target.value; saveDraft(); });
$$(".ob").forEach(b=>b.addEventListener("click",()=>setOutcome(b.dataset.outcome)));
$("#actMinus").addEventListener("click",()=>setActual(current.actualLen-5));
$("#actPlus").addEventListener("click",()=>setActual(current.actualLen+5));
$("#brkMinus").addEventListener("click",()=>setBreak(current.breakLen-5));
$("#brkPlus").addEventListener("click",()=>setBreak(current.breakLen+5));
$("#btnExport").addEventListener("click",exportJson);
$("#btnImport").addEventListener("click",()=>$("#fileInput").click());
$("#fileInput").addEventListener("change",e=>{ if(e.target.files[0]){importJson(e.target.files[0]);e.target.value="";} });
$("#btnNotion").addEventListener("click",copyNotion);
$("#btnCsv").addEventListener("click",downloadCsv);
$("#btnClear").addEventListener("click",clearAll);
$("#rangeToggle").addEventListener("click",e=>{ const b=e.target.closest("[data-range]"); if(!b)return; anaRange=b.dataset.range; $$("#rangeToggle button").forEach(x=>x.classList.toggle("on",x===b)); renderAnalytics(); });
$("#logList").addEventListener("click",e=>{ const d=e.target.closest("[data-del]"); if(d)showConfirm("Delete this block?","Removes the single saved block. Can't be undone.","Delete",()=>deleteReading(d.dataset.del)); });

/* ================= boot ================= */
async function boot(){
  const sc=await storeGet(K_SCHEMA), se=await storeGet(K_SETTINGS), rd=await storeGet(K_READINGS);
  schema = sc? normalizeSchema(sc) : clone(DEFAULT_SCHEMA);
  if(se&&typeof se==="object") settings={...DEFAULT_SETTINGS,...se};
  if(Array.isArray(rd)) readings=rd;

  if(!rd){ // migrate v1 (build 1 & 2 data) on first v2 run
    const old=await storeGet(K_OLD_READINGS);
    if(Array.isArray(old)&&old.length){ readings=old.map(migrateOldReading); await saveReadings(); }
    const oldS=await storeGet(K_OLD_SETTINGS);
    if(oldS&&typeof oldS==="object"){ if(typeof oldS.countThreshold==="number")settings.weightThreshold=oldS.countThreshold; if(typeof oldS.minSamples==="number")settings.minSamples=oldS.minSamples; if(typeof oldS.breadthRule==="boolean")settings.breadthRule=oldS.breadthRule; if(Array.isArray(oldS.critical))oldS.critical.forEach(id=>{const s=symById(id); if(s)s.critical=true;}); await saveSettings(); await saveSchema(); }
  }
  const us=await storeGet(K_UNDO); if(Array.isArray(us)) undoStack=us;
  const ac=await storeGet(K_ACTIVE); if(ac&&ac.startTs) active=ac;
  const df=await storeGet(K_DRAFT); applyDraft(df);
  if(active) pre.planned=active.planned||pre.planned;

  if(!HAS_STORE){ const b=$("#storageBanner"); b.className="banner warn show"; b.textContent="Auto-save isn't available in this view — your log won't persist on reload here. Use Backup (.json) to keep data, Restore to bring it back."; }

  $("#loading").style.display="none"; $("#shell").style.display="block";
  rebuildAll(); renderUndo(); renderActiveBar();
  if(active){ switchTab("reading"); current.actualTouched=current.actualTouched||false; $("#actVal").textContent=current.actualLen+"m"; $("#lenSource").textContent="from clock"; }
}
boot();

}
