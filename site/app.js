'use strict';

// Every record comes from the catalog's CSV files, which the build copies into data/.
const TASK_STYLES = {
  analyze_data: {color:'#bb8c27',species:'Nautilus',shape:'nautilus',short:'Data'},
  browse_web: {color:'#3fa6c9',species:'Pufferfish',shape:'puffer',short:'Web'},
  handle_customer_support: {color:'#c05a88',species:'Dolphin',shape:'dolphin',short:'Support'},
  operate_computer: {color:'#579362',species:'Crab',shape:'crab',short:'Computer'},
  research_topic: {color:'#208f9e',species:'Manta ray',shape:'manta',short:'Research'},
  review_code: {color:'#d07a3c',species:'Jellyfish',shape:'jelly',short:'Review'},
  write_code: {color:'#8064d2',species:'Octopus',shape:'octopus',short:'Code'},
  write_document: {color:'#3e7ec8',species:'Clownfish',shape:'clownfish',short:'Docs'}
};
const NO_TASK = {color:'#7f8ea3',species:'Minnow',shape:'minnow',short:'None'};
const NONE = 'none';
const SHAPES = {
  octopus:'M46 58C42 38 51 17 78 16C104 15 115 36 112 58C106 74 50 74 46 58ZM54 67C52 80 32 82 31 94M65 69C63 84 50 87 49 100M77 70V101M89 69C95 85 106 86 107 99M101 66C108 79 126 80 130 94M58 46H98V61H58Z',
  manta:'M80 27C62 50 35 61 10 48C28 80 58 72 80 81C102 72 131 80 151 48C126 61 99 50 80 27ZM70 38L68 21M91 38L93 21M80 81C74 93 82 99 92 105M66 49H95V61H66Z',
  dolphin:'M14 62C34 42 53 39 63 38C75 20 86 18 99 21L84 38C103 35 121 41 133 51L151 35L147 55L151 75L131 62C111 75 89 79 62 75C43 76 28 70 24 65L10 65M68 74C69 86 78 92 88 95M37 48H65V62H37Z',
  nautilus:'M61 54C61 33 75 18 96 18C117 18 132 34 132 55C132 76 117 91 96 91C75 91 61 76 61 54ZM96 54C86 41 74 50 76 62C78 79 104 80 114 64C126 44 107 27 90 31C75 34 70 46 71 55M62 55C43 48 40 79 63 79M47 60H61M46 68H61M45 56L22 48M43 64L16 63M47 73L24 84',
  clownfish:'M23 55C23 17 130 17 130 55C130 92 23 92 23 55ZM124 50L151 32L146 56L151 80L125 65M60 29L56 81M86 27L86 83M109 34L112 77M28 46H52V63H28ZM59 29C69 15 84 20 96 28M62 79C75 96 88 87 95 80',
  crab:'M38 54C38 23 123 23 123 54C123 85 38 85 38 54ZM42 47L24 37L19 22M119 47L137 35L143 21M49 69L39 85L25 96M66 74L60 94L56 103M81 77V105M96 73L104 92L111 103M111 68L124 84L138 95M17 27L7 18L13 10L19 19L27 10L31 19L23 29M141 27L132 18L137 10L144 19L151 10L157 19L148 30M55 33L54 19M88 31L91 17M50 46H86V64H50Z',
  puffer:'M50 55C50 30 110 30 110 55C110 80 50 80 50 55ZM110 55L130 40L126 55L130 70ZM80 30V18M64 34L58 24M96 34L102 24M80 80V92M64 76L58 86M96 76L102 86M52 44L42 36M52 66L42 74M58 47H90V62H58Z',
  jelly:'M40 58C40 22 120 22 120 58C110 64 50 64 40 58ZM52 62C48 76 58 86 52 102M68 63C70 80 62 90 68 106M84 63C82 80 90 90 84 106M100 62C104 76 94 86 100 102M62 42H98V56H62Z',
  minnow:'M30 55C50 32 104 32 124 55C104 78 50 78 30 55ZM124 55L146 40V70ZM70 34L80 22L92 34M60 46H92V62H60Z'
};
const AGENT_COLUMNS = ['agent_id','name','url','description','organization','source_url','first_seen','created_on','stars','main_task','license','pricing_model'];
const PUBLISHERS = [['Organization','#4779be'],['Personal account','#8b67cc'],['Product website','#239ba4'],['Marketplace listing','#c9874a']];
const MARKETPLACE = 'https://aws.amazon.com/marketplace/';
const HABITAT_SIZE = 36;
let TASKS = [];
let DATA = [];
let CLAIMS = 0;
let ACTIVITY_TITLES = new Map();
let OCCUPATIONS = [];
const $ = s=>document.querySelector(s);
const $$ = s=>Array.from(document.querySelectorAll(s));
const esc = value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const pad = n=>String(n).padStart(2,'0');
const agentCount = n=>`${n} agent${n===1?'':'s'}`;

function styleFor(taskId){
  if(!taskId||taskId===NONE)return NO_TASK;
  return TASK_STYLES[taskId]||{...NO_TASK,species:'Fish',short:taskName(taskId)};
}
const taskName = taskId=>taskId===NONE?'No documented task':(TASKS.find(t=>t.task_id===taskId)?.name||taskId);
function fishSVG(taskId){
  const s=styleFor(taskId);
  return `<svg viewBox="0 0 160 110" fill="none" style="color:${s.color}" aria-hidden="true"><path d="${SHAPES[s.shape]}" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/><path d="M65 53h6m7 0h6" stroke="currentColor" stroke-width="2.5"/><circle cx="131" cy="91" r="2" fill="currentColor" opacity=".45"/></svg>`;
}

/** RFC 4180 CSV text -> row objects keyed by the header. */
function parseCsv(text,path){
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c!=='"')field+=c;else if(text[i+1]==='"'){field+='"';i++;}else quoted=false;}
    else if(c==='"')quoted=true;
    else if(c===','){row.push(field);field='';}
    else if(c==='\n'){row.push(field);rows.push(row);row=[];field='';}
    else if(c!=='\r')field+=c;
  }
  if(field||row.length){row.push(field);rows.push(row);}
  if(!rows.length)throw new Error(`${path} is empty`);
  const [header,...body]=rows;
  return body.map(r=>Object.fromEntries(header.map((h,i)=>[h,r[i]??''])));
}
async function fetchTable(path){
  const response=await fetch(path,{cache:'no-cache'});
  if(!response.ok)throw new Error(`${path}: HTTP ${response.status}`);
  return parseCsv(await response.text(),path);
}
function publisherOf(agent){
  const source=new URL(agent.source_url);
  if(agent.source_url.startsWith(MARKETPLACE))return {kind:'Marketplace listing',name:agent.organization};
  if(source.hostname!=='github.com')return {kind:'Product website',name:agent.organization||source.hostname.replace(/^www\./,'')};
  return {kind:agent.organization?'Organization':'Personal account',name:agent.organization||source.pathname.split('/')[1]};
}
const groupBy=(rows,key)=>{const map=new Map();for(const row of rows){if(!map.has(row[key]))map.set(row[key],[]);map.get(row[key]).push(row);}return map;};
async function loadCatalog(){
  const tables=['agents','tasks','agent_tasks','agent_attributes','agent_activities','agent_packages','agent_results','occupation_coverage'];
  const [[agents,tasks,links,attributes,activities,packages,results,occupations],dwaText]=await Promise.all([
    Promise.all(tables.map(t=>fetchTable(`data/${t}.csv`))),
    fetch('data/onet_dwa_reference.txt',{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error(`O*NET activities: HTTP ${r.status}`);return r.text();})
  ]);
  TASKS=tasks;
  CLAIMS=links.length;
  OCCUPATIONS=occupations;
  // O*NET's tab-separated file: Element ID, IWA ID, DWA ID, DWA Title.
  ACTIVITY_TITLES=new Map(dwaText.split(/\r?\n/).slice(1).filter(Boolean).map(line=>line.split('\t')).map(f=>[f[2],f[3]]));
  const order=new Map(tasks.map((t,i)=>[t.task_id,i]));
  const byAgent=groupBy(links,'agent_id'),attributesOf=groupBy(attributes,'agent_id'),activitiesOf=groupBy(activities,'agent_id');
  const packagesOf=groupBy(packages,'agent_id'),resultsOf=groupBy(results,'agent_id');
  DATA=agents.map(agent=>{
    const claims=(byAgent.get(agent.agent_id)||[]).sort((a,b)=>order.get(a.task_id)-order.get(b.task_id));
    const publisher=publisherOf(agent);
    return {...agent,id:agent.agent_id,claims,taskIds:claims.map(c=>c.task_id),kind:publisher.kind,publisher:publisher.name,
      attributes:attributesOf.get(agent.agent_id)||[],activities:activitiesOf.get(agent.agent_id)||[],
      packages:(packagesOf.get(agent.agent_id)||[]).sort((a,b)=>(Number(b.downloads_last_month)||0)-(Number(a.downloads_last_month)||0)),
      results:(resultsOf.get(agent.agent_id)||[]).sort((a,b)=>b.date.localeCompare(a.date))};
  });
}
const isMarketplace = d=>d.kind==='Marketplace listing';
// Tasks that at least one agent claims, in vocabulary order, then agents with no task.
function presentTasks(){
  const ids=TASKS.map(t=>t.task_id).filter(id=>DATA.some(d=>d.taskIds.includes(id)));
  return DATA.some(d=>!d.taskIds.length)?[...ids,NONE]:ids;
}
const agentsWith = taskId=>taskId==='All'?DATA:taskId===NONE?DATA.filter(d=>!d.taskIds.length):DATA.filter(d=>d.taskIds.includes(taskId));
const mainTask = d=>d.main_task||NONE;
const starsOf = d=>Number(d.stars)||0;
const starLabel = n=>n>=1e6?(n/1e6).toFixed(1).replace(/\.0$/,'')+'M':n>=1000?(n/1000).toFixed(n>=10000?0:1).replace(/\.0$/,'')+'k':String(n);
// Position of an agent's stars between the catalog's least and most starred agents, on a log scale.
function starShare(d){
  const logs=DATA.filter(starsOf).map(a=>Math.log10(starsOf(a)));
  const lo=Math.min(...logs),hi=Math.max(...logs);
  return starsOf(d)&&hi>lo?(Math.log10(starsOf(d))-lo)/(hi-lo):0;
}
function shuffled(list){const copy=list.slice();for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}return copy;}
function sourceLink(url,label){
  return /^https?:\/\//.test(url)?`<a class="inline-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`:esc(label);
}
function shortUrl(url){const u=new URL(url);const text=u.hostname.replace(/^www\./,'')+u.pathname.replace(/\/$/,'');return text.length>48?text.slice(0,47)+'…':text;}

let activeSpecies='All';
let habitatPaused=false;
const reducedQuery=window.matchMedia('(prefers-reduced-motion: reduce)');
let motionPaused=reducedQuery.matches;
let page=0;
const pageSize=6;
let sortBy='stars',sortDirection=-1;
let activeSection=0;
const sections=$$('.depth-section');
const depths=sections.map(el=>Number(el.dataset.depth));
const levelNavigationQuery=window.matchMedia('(min-width: 801px) and (min-height: 650px) and (hover: hover) and (pointer: fine)');
let diveFrame=0;
let diveAnimating=false;
let settleTimer=0;
let lastWheelAt=0;
let gestureDirection=0;
let gestureActive=false;
let pointerDown=false;

function cancelDive(){
  if(diveFrame)cancelAnimationFrame(diveFrame);
  clearTimeout(settleTimer);
  diveFrame=0;diveAnimating=false;
}

function navigateToSection(index,{settling=false}={}){
  const section=sections[Math.max(0,Math.min(sections.length-1,index))];
  const start=window.scrollY;
  const destination=Math.min(section.offsetTop,document.documentElement.scrollHeight-window.innerHeight);
  const distance=destination-start;
  cancelDive();
  if(!settling)gestureActive=false;
  if(reducedQuery.matches||Math.abs(distance)<2){window.scrollTo(0,destination);gestureActive=false;updateScroll();return;}
  const duration=settling?Math.min(460,Math.max(140,Math.abs(distance)*.43)):Math.min(650,420+Math.abs(distance)/12);
  const began=performance.now();
  diveAnimating=true;
  function glide(now){
    const progress=Math.min(1,(now-began)/duration);
    const eased=1-Math.pow(1-progress,3);
    window.scrollTo(0,start+distance*eased);
    if(progress<1)diveFrame=requestAnimationFrame(glide);
    else{diveFrame=0;diveAnimating=false;gestureActive=false;updateScroll();}
  }
  diveFrame=requestAnimationFrame(glide);
}

function useLevelNavigation(){
  document.documentElement.classList.toggle('level-navigation',levelNavigationQuery.matches&&!reducedQuery.matches);
  gestureActive=false;
  clearTimeout(settleTimer);
}

function settleAtLevel(){
  if(!gestureActive||diveAnimating||pointerDown||!levelNavigationQuery.matches||reducedQuery.matches||$$('dialog[open]').length)return;
  const position=window.scrollY;
  let nearest=0,distance=Infinity;
  sections.forEach((section,i)=>{const d=Math.abs(section.offsetTop-position);if(d<distance){distance=d;nearest=i;}});
  // Passive wheel events may arrive after the compositor has already scrolled.
  // Choose from the visible interval and input direction, never a sampled start Y.
  const threshold=Math.min(48,window.innerHeight*.05);
  for(let i=0;i<sections.length-1;i++){
    const lower=sections[i].offsetTop,upper=sections[i+1].offsetTop;
    if(position>=lower&&position<upper){
      if(gestureDirection>0&&position-lower>=threshold)nearest=i+1;
      if(gestureDirection<0&&upper-position>=threshold)nearest=i;
      break;
    }
  }
  navigateToSection(nearest,{settling:true});
}

function scheduleSettle(){
  clearTimeout(settleTimer);
  if(gestureActive&&!diveAnimating&&!pointerDown)settleTimer=setTimeout(settleAtLevel,150);
}

// Wheel input always scrolls natively. Only after the gesture and its inertia
// finish do we gently align the page. Every new input immediately cancels alignment.
function onDiveWheel(event){
  if(event.ctrlKey||event.shiftKey||Math.abs(event.deltaX)>Math.abs(event.deltaY)||!event.deltaY||$$('dialog[open]').length)return;
  const target=event.target instanceof Element?event.target:null;
  if(target?.closest('select,textarea,[contenteditable="true"]'))return;
  const now=performance.now();
  const wasAligning=diveAnimating;
  cancelDive();
  if(!gestureActive||wasAligning||now-lastWheelAt>250){
    gestureActive=true;
  }
  gestureDirection=Math.sign(event.deltaY);
  lastWheelAt=now;
  scheduleSettle();
}

// Colour a creature by the task being filtered on, so every fish in a filtered view matches the chip.
const shownTask = d=>activeSpecies!=='All'&&d.taskIds.includes(activeSpecies)?activeSpecies:mainTask(d);
function setSpecies(fn){
  activeSpecies=fn;
  $$('.species-chip').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.function===fn)));
  renderCreatures();
}
function renderCreatures(){
  const pool=agentsWith(activeSpecies);
  // Biggest first, so smaller fish stay on top and clickable.
  const shown=shuffled(pool).slice(0,HABITAT_SIZE).sort((a,b)=>starsOf(b)-starsOf(a));
  const narrow=window.innerWidth<580;
  $('#creatures').innerHTML=shown.length?shown.map((d,i)=>{
    const duration=65+(i*11)%49;
    const x=(i*37+7)%95;
    const reverse=i%3===1;
    const progress=reverse?(x+24)/130:(106-x)/130;
    // A steeper curve than plain log, so the few very popular agents stand out from the many with a few thousand stars.
    const grow=starShare(d)**1.4;
    // Marketplace listings have no stars, so they swim at one fixed size with a dashed outline.
    const size=isMarketplace(d)?(narrow?64:96):narrow?36+124*grow:48+232*grow;
    const task=shownTask(d),style=styleFor(task);
    const stars=starsOf(d)?` · ★ ${starLabel(starsOf(d))}`:isMarketplace(d)?' · marketplace listing':'';
    return `<div class="creature-lane ${reverse?'reverse':''}" data-function="${esc(task)}" style="--y:${2+(i*23)%72}%;--duration:${duration}s;--delay:${-progress*duration}s;--static-x:${x}%;--size:${size.toFixed(1)}px;--bob-duration:${3.1+i%5*.5}s;--bob-delay:${-i*.7}s;--creature-color:${style.color}"><button class="creature${isMarketplace(d)?' marketplace':''}" data-agent="${esc(d.id)}" aria-label="Inspect ${esc(d.name)}, ${esc(taskName(task))}, ${esc(style.species)}${starsOf(d)?`, ${starsOf(d)} GitHub stars`:isMarketplace(d)?', AWS Marketplace listing':''}">${fishSVG(task)}<span class="creature-label">${esc(d.name)}${stars}</span></button></div>`;
  }).join(''):`<p class="habitat-empty mono">${DATA.length?'NO AGENTS CLAIM THIS TASK':'THE DAILY COLLECTION HAS NOT PUBLISHED ANY AGENTS YET'}</p>`;
  $$('.creature').forEach(b=>b.addEventListener('click',()=>showSpecimen(b.dataset.agent)));
  $('#habitat-count').textContent=shown.length;
  $('#habitat-pool').textContent=`OF ${pool.length} ${activeSpecies==='All'?'IN THE CATALOG':'WITH THIS TASK'}`;
  $('#habitat-shuffle').hidden=pool.length<=HABITAT_SIZE;
}
function renderHabitat(){
  $('#species-filters').innerHTML=['All',...presentTasks()].map(fn=>`<button class="species-chip" data-function="${esc(fn)}" aria-pressed="${fn==='All'}" style="--species-color:${fn==='All'?'#c3d9df':styleFor(fn).color}"><span class="color-dot"></span>${esc(fn==='All'?'All':taskName(fn))}</button>`).join('');
  $$('.species-chip').forEach(b=>b.addEventListener('click',()=>setSpecies(b.dataset.function)));
  renderCreatures();
}

function renderScenery(){
  const kelp=`<path d="M53 231C76 185 25 176 54 134C81 96 36 73 58 28C44 71 98 91 73 137C46 183 88 195 69 231Z"/><path d="M37 231C15 202 40 181 23 152C6 125 30 100 23 78C47 105 25 131 41 153C58 181 31 205 49 231Z"/><path d="M79 231C97 210 72 179 91 157C111 133 89 108 105 79C102 110 132 133 110 163C91 186 116 216 94 231Z"/><path d="M60 230C56 199 70 178 61 163C44 146 59 129 55 110C77 134 60 147 77 167C91 189 67 204 74 231Z"/>`;
  const fan=`<g fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"><path d="M65 232Q62 185 68 152T57 82Q48 54 58 21"/><path d="M64 174Q41 162 30 135T22 86M63 191Q92 179 102 148T111 100M66 146Q91 133 92 98T104 57M59 102Q33 91 27 58M91 112Q115 102 123 80M31 135Q12 129 9 108M100 157Q119 149 126 126M57 59Q79 49 83 25M28 80Q9 71 12 50"/></g><g fill="currentColor"><circle cx="58" cy="21" r="3.4"/><circle cx="104" cy="57" r="3"/><circle cx="83" cy="25" r="3"/><circle cx="12" cy="50" r="2.7"/></g>`;
  const sprigs=`<g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M48 232Q33 202 45 175T43 122M59 232Q71 208 62 183T70 142M70 232Q89 214 82 192T95 155M34 232Q14 214 26 191M78 232Q112 218 105 198"/></g>`;
  const plants=[{x:-2,w:130,h:185,c:'#64cecf',p:kelp,o:.34},{x:6,w:75,h:120,c:'#6094dc',p:sprigs,o:.34},{x:13,w:90,h:154,c:'#a28be8',p:fan,o:.32},{x:23,w:64,h:93,c:'#64cecf',p:kelp,o:.23},{x:37,w:47,h:68,c:'#7a99dd',p:sprigs,o:.26},{x:61,w:61,h:83,c:'#64cecf',p:sprigs,o:.24},{x:73,w:97,h:154,c:'#a28be8',p:fan,o:.35},{x:83,w:74,h:132,c:'#629ddb',p:kelp,o:.33},{x:91,w:124,h:206,c:'#64cecf',p:kelp,o:.36}];
  $('#seabed').innerHTML=`<svg class="seafloor" viewBox="0 0 1200 180" preserveAspectRatio="none" aria-hidden="true"><path d="M0 115Q170 143 320 151T630 162Q870 122 1200 138V180H0Z" fill="#17264b" opacity=".24"/><path d="M0 145Q180 128 340 164Q520 176 720 157Q965 141 1200 158V180H0Z" fill="#121e3d" opacity=".7"/><path d="M0 146Q160 130 340 164M720 157Q965 141 1200 158" stroke="#668bc0" opacity=".11" fill="none"/><ellipse cx="182" cy="174" rx="39" ry="11" fill="#263553" opacity=".4"/><ellipse cx="1008" cy="174" rx="49" ry="12" fill="#263553" opacity=".4"/></svg>`+plants.map((d,i)=>`<svg viewBox="0 0 135 235" style="left:${d.x}%;width:${d.w}px;height:${d.h}px;color:${d.c};opacity:${d.o};animation-duration:${4.5+i*.7}s;animation-delay:${-i*.8}s" aria-hidden="true" fill="currentColor">${d.p}</svg>`).join('');
  let bubbles=$('.habitat-bubbles');
  if(!bubbles){bubbles=document.createElement('div');bubbles.className='habitat-bubbles';bubbles.setAttribute('aria-hidden','true');$('#habitat-ocean').append(bubbles);}
  bubbles.innerHTML=Array.from({length:12},(_,i)=>`<span class="habitat-bubble" style="--bubble-left:${5+(i*31)%92}%;--bubble-size:${2+i%3}px;--bubble-duration:${8+i%5*1.7}s;--bubble-delay:${-i*2.3}s"></span>`).join('');
}

// The last eight creation years, with every earlier year in one first column.
function creationYears(){
  const years=DATA.filter(d=>d.created_on).map(d=>Number(d.created_on.slice(0,4)));
  if(!years.length)return [];
  const last=Math.max(...years),first=Math.max(Math.min(...years),last-7);
  const buckets=[];
  for(let y=first;y<=last;y++)buckets.push({label:y===first&&Math.min(...years)<first?`≤${y}`:String(y),has:d=>{const n=Number(d.created_on.slice(0,4));return y===first?n<=y:n===y;}});
  return buckets;
}
function renderFigures(){
  const tasks=presentTasks();
  const order=tasks.slice().sort((a,b)=>agentsWith(b).length-agentsWith(a).length);
  const max=Math.max(1,...order.map(t=>agentsWith(t).length));
  $('#findings-tag').textContent=`${DATA.length} AGENTS · ${CLAIMS} QUOTED CLAIMS`;
  $('#function-chart').innerHTML=order.map(t=>{const n=agentsWith(t).length;return `<button class="bar-row" data-function="${esc(t)}" aria-label="Explore ${esc(taskName(t))}: ${agentCount(n)}"><span class="bar-label">${fishSVG(t)}<span>${esc(taskName(t))}</span></span><span class="bar-track"><span class="bar-fill" style="--bar-color:${styleFor(t).color};width:${n/max*100}%"></span></span><span class="bar-number">${n}</span></button>`;}).join('');
  $('#function-axis').innerHTML=`<span>0</span><span>${agentCount(max)}</span>`;
  $$('.bar-row').forEach(b=>b.addEventListener('click',()=>{setSpecies(b.dataset.function);navigateToSection(1);}));
  const top=order[0];
  $('#function-highlight').innerHTML=top?fishSVG(top)+`<span><strong>${esc(taskName(top))} / ${esc(styleFor(top).species)}</strong>The most documented task: ${agentsWith(top).length} of ${agentCount(DATA.length)}.</span>`:'';
  const years=creationYears();
  const perYear=year=>DATA.filter(d=>d.created_on&&year.has(d));
  const yearMax=Math.max(1,...years.map(y=>perYear(y).length));
  $('#time-chart').innerHTML=years.map(year=>{
    const agents=perYear(year);
    return `<div class="time-column" style="--total-height:${agents.length/yearMax*85}%" role="img" aria-label="${year.label}: ${agentCount(agents.length)} created">${tasks.map(t=>{
      const n=agents.filter(d=>mainTask(d)===t).length;
      return n?`<div class="time-segment" title="${year.label} · ${esc(taskName(t))}: ${n}" style="height:${n/yearMax*85}%;background:${styleFor(t).color}"></div>`:'';
    }).join('')}<span class="cohort-total">${agents.length}</span></div>`;
  }).join('');
  $('#time-labels').innerHTML=years.map(y=>`<span>${esc(y.label)}</span>`).join('');
  $('#time-legend').innerHTML=tasks.map(t=>`<span class="legend-item"><i class="legend-dot" style="background:${styleFor(t).color}"></i>${esc(taskName(t))}</span>`).join('');
  $('#owner-chart').innerHTML=tasks.map(t=>{
    const agents=agentsWith(t);
    return `<div class="owner-row"><span class="owner-row-label">${esc(taskName(t))}</span><div class="owner-track" role="img" aria-label="${esc(taskName(t))} publishers: ${PUBLISHERS.map(([kind])=>kind+' '+Math.round(agents.filter(d=>d.kind===kind).length/agents.length*100)+'%').join(', ')}">${PUBLISHERS.map(([kind,color])=>{
      const n=agents.filter(d=>d.kind===kind).length;
      return n?`<span class="owner-segment" style="flex:${n};background:${color}" title="${esc(kind)}: ${n} of ${agents.length}"></span>`:'';
    }).join('')}</div></div>`;
  }).join('');
  $('#owner-legend').innerHTML=PUBLISHERS.map(([kind,color])=>`<span class="legend-item"><i class="legend-dot" style="background:${color}"></i>${esc(kind)}</span>`).join('');
}

function getFiltered(){
  const q=$('#catalog-search').value.trim().toLowerCase();
  const fn=$('#catalog-function').value;
  const text=d=>[d.name,d.description,d.publisher,d.kind,...d.taskIds,...d.taskIds.map(taskName)].join(' ').toLowerCase();
  const byName=(a,b)=>a.name.localeCompare(b.name);
  const compare={stars:(a,b)=>starsOf(a)-starsOf(b),created:(a,b)=>a.created_on.localeCompare(b.created_on),name:()=>0}[sortBy];
  return agentsWith(fn).filter(d=>!q||text(d).includes(q)).sort((a,b)=>sortDirection*(compare(a,b)||byName(a,b)));
}
function renderTable(){
  const filtered=getFiltered();
  const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize));
  page=Math.min(page,totalPages-1);
  const rows=filtered.slice(page*pageSize,(page+1)*pageSize);
  $('#catalog-body').innerHTML=rows.map(d=>{const color=styleFor(mainTask(d)).color;return `<tr style="--row-color:${color}"><td><button class="agent-link" data-agent="${esc(d.id)}">${fishSVG(mainTask(d))}${esc(d.name)}</button></td><td><span class="function-badge" style="--badge-color:${color}">${{'Product website':'Website','Marketplace listing':'AWS'}[d.kind]||'GitHub'}</span></td><td>${d.taskIds.map(t=>`<span class="task-tag">${esc(t)}</span>`).join('')||'<span class="task-tag">none</span>'}</td><td>${esc(d.publisher)}</td><td>${starsOf(d)?esc(starLabel(starsOf(d))):'—'}</td><td>${esc(d.created_on||'—')}</td></tr>`;}).join('');
  $('#empty-state').textContent=DATA.length?'No agents match this search. Try another name or task.':'The daily collection has not published any agents yet.';
  $('#empty-state').hidden=filtered.length>0;
  $('#catalog-count').textContent=filtered.length?`${page*pageSize+1}–${Math.min((page+1)*pageSize,filtered.length)} OF ${filtered.length} AGENTS`:'0 AGENTS';
  $('#page-number').textContent=`${page+1} / ${totalPages}`;
  $('#previous-page').disabled=page===0;
  $('#next-page').disabled=page>=totalPages-1;
  for(const key of ['name','stars','created']){
    $(`#sort-${key}`).closest('th').setAttribute('aria-sort',sortBy===key?(sortDirection===1?'ascending':'descending'):'none');
    $(`#sort-${key} span`).textContent=sortBy===key?(sortDirection===1?'↑':'↓'):'↕';
  }
  $$('.agent-link').forEach(b=>b.addEventListener('click',()=>showSpecimen(b.dataset.agent)));
}

const quoted=(head,c,color)=>`<li style="--evidence-color:${color}">${head}<blockquote>“${esc(c.evidence_quote)}”</blockquote>${sourceLink(c.source_url,'Quoted from '+shortUrl(c.source_url)+' →')}</li>`;
const words=value=>value.replaceAll('_',' ');
function profileRows(d){
  const one=name=>d.attributes.find(a=>a.attribute===name)?.value;
  const tools=d.attributes.filter(a=>a.attribute==='tool_class').map(a=>words(a.value));
  const top=d.packages.find(p=>p.downloads_last_month);
  const rows=[
    ['Autonomy',one('autonomy')&&esc(words(one('autonomy')))],
    ['Audience',one('audience')&&esc(words(one('audience')))],
    ['Tools',tools.length&&esc(tools.join(', '))],
    ['Pricing model',d.pricing_model&&esc(d.pricing_model.split(';').join(', '))],
    ['License',d.license&&esc(d.license)],
    ['Downloads',top&&`${Number(top.downloads_last_month).toLocaleString('en-US')} last month · ${esc(top.ecosystem)} ${sourceLink(top.source_url,top.package)}${d.packages.length>1?` · ${d.packages.length-1} more package${d.packages.length>2?'s':''} name this repository`:''}`],
    ['SWE-bench',d.results.length&&d.results.map(r=>sourceLink(r.source_url,`${r.benchmark.replace('swe-bench-','')}: ${r.resolved_instances} resolved · ${r.date}`)).join('<br>')]
  ];
  return rows.filter(([,value])=>value).map(([label,value])=>`<div><dt>${label}</dt><dd>${value}</dd></div>`).join('');
}
function showSpecimen(id){
  const d=DATA.find(d=>d.id===id);if(!d)return;
  const task=shownTask(d);
  const claims=d.claims.length?`<ol class="evidence-list">${d.claims.map(c=>quoted(`<span class="task-tag">${esc(c.task_id)}</span> <strong>${esc(taskName(c.task_id))}</strong>${c.task_id===d.main_task?' <span class="task-tag main-tag">MAIN TASK</span>':''}`,c,styleFor(c.task_id).color)).join('')}</ol>`:'<p class="specimen-summary">The text the collection saved supported none of the tasks in the vocabulary.</p>';
  const profile=d.attributes.length?`<div class="specimen-tasks"><h3>HOW IT WORKS · ${d.attributes.length}</h3><ol class="evidence-list">${d.attributes.map(a=>quoted(`<span class="task-tag">${esc(a.attribute)}</span> <strong>${esc(words(a.value))}</strong>`,a,'#7f8ea3')).join('')}</ol></div>`:'';
  const activities=d.activities.length?`<div class="specimen-tasks"><h3>WORK ACTIVITIES · O*NET 29.2 · ${d.activities.length}</h3><ol class="evidence-list">${d.activities.map(a=>quoted(`<span class="task-tag">${esc(a.dwa_id)}</span> <strong>${esc(ACTIVITY_TITLES.get(a.dwa_id)||a.dwa_id)}</strong>`,a,'#3fa6c9')).join('')}</ol></div>`:'';
  $('#specimen-details').innerHTML=`<div class="specimen-hero">${fishSVG(task)}<div><p class="eyebrow">${esc(d.id)} / ${esc(styleFor(task).species)}</p><h2 id="specimen-title">${esc(d.name)}</h2></div></div><p class="specimen-summary">${esc(d.description)}</p><dl class="specimen-data"><div><dt>Homepage</dt><dd>${sourceLink(d.url,shortUrl(d.url))}</dd></div><div><dt>Source</dt><dd>${sourceLink(d.source_url,shortUrl(d.source_url))}</dd></div><div><dt>Publisher</dt><dd>${esc(d.publisher)} · ${esc(d.kind)}</dd></div>${d.created_on?`<div><dt>Repository created</dt><dd>${esc(d.created_on)}</dd></div>`:''}${starsOf(d)?`<div><dt>GitHub stars</dt><dd>${starsOf(d).toLocaleString('en-US')}</dd></div>`:''}${profileRows(d)}</dl><div class="specimen-tasks"><h3>DOCUMENTED TASKS · ${d.claims.length}</h3>${claims}</div>${profile}${activities}<p class="specimen-disclaimer">Each quote is copied word for word from the source text the daily collection saved. It records what the project says it does, not a measured capability. Downloads and SWE-bench results are measured by their sources.</p>`;
  $('#specimen-dialog').showModal();
}

function downloadCSV(){
  const rows=getFiltered();
  const quote=v=>/[",\n\r]/.test(v)?'"'+v.replaceAll('"','""')+'"':v;
  const content=[AGENT_COLUMNS,...rows.map(d=>AGENT_COLUMNS.map(c=>d[c]))].map(row=>row.map(quote).join(',')).join('\n')+'\n';
  const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='agentarium-agents.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
  const toast=$('#toast');toast.textContent=`Downloaded ${rows.length} agents`;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),3000);
}

function updateScroll(){
  const position=window.scrollY;
  const max=Math.max(1,document.documentElement.scrollHeight-window.innerHeight);
  const progression=Math.max(0,Math.min(1,position/max));
  document.documentElement.style.setProperty('--ocean-depth',(progression*.84).toFixed(3));
  $('#dive-progress').style.width=(progression*100).toFixed(2)+'%';
  let closest=0,distance=Infinity;
  sections.forEach((section,i)=>{const d=Math.abs(section.getBoundingClientRect().top);if(d<distance){distance=d;closest=i;}});
  activeSection=closest;
  document.body.dataset.tone=sections[closest].dataset.tone||'dark';
  let depth=depths[closest];
  for(let i=0;i<sections.length-1;i++){
    const top=sections[i].offsetTop,next=sections[i+1].offsetTop;
    if(position>=top&&position<=next){const fraction=(position-top)/(next-top);depth=Math.round(depths[i]+(depths[i+1]-depths[i])*fraction);break;}
  }
  $('#depth-value').textContent=String(closest+1).padStart(2,'0');
  $('#depth-label').textContent=sections[closest].dataset.label;
  $('#level-number').textContent=`${String(closest+1).padStart(2,'0')} / ${pad(sections.length)}`;
  $('#next-label').textContent=closest===sections.length-1?'OVERVIEW ↑':'CONTINUE ↓';
  $('#next-depth').setAttribute('aria-label',closest===sections.length-1?'Return to overview':'Continue to '+sections[closest+1].dataset.label);
  const ids=['surface','habitat','functions','functions','functions','functions','functions','catalog','method'];
  $$('.site-header nav a').forEach(a=>{if(a.hash==='#'+ids[closest])a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});
}

// The introduction has exactly three large ASCII fish. The text forms their bodies.
const asciiCanvas=$('#ascii-fish'),asciiCtx=asciiCanvas.getContext('2d');
let asciiSize={w:0,h:0};
const planktonCanvas=$('#plankton'),planktonCtx=planktonCanvas.getContext('2d');
let planktonSize={w:0,h:0};
function resizeCanvas(canvas,ctx){
  const rect=canvas.getBoundingClientRect();const dpr=Math.min(window.devicePixelRatio||1,1.5);
  canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);return {w:rect.width,h:rect.height};
}
function resize(){asciiSize=resizeCanvas(asciiCanvas,asciiCtx);planktonSize=resizeCanvas(planktonCanvas,planktonCtx);updateScroll();}
const seeded=(i,k)=>{const v=Math.sin(i*12.9898+k*78.233)*43758.5453;return v-Math.floor(v);};
function drawAscii(t){
  const {w,h}=asciiSize;if(!w||!h)return;
  asciiCtx.clearRect(0,0,w,h);
  const narrow=w<600;
  const fishes=narrow?[{x:.12,y:.12,l:125,c:'#77cfe9',rx:50,ry:13,speed:.48,phase:0},{x:.92,y:.49,l:150,c:'#b6a0f1',rx:45,ry:22,speed:.42,phase:2.3},{x:.25,y:.88,l:110,c:'#84b7f2',rx:65,ry:14,speed:.38,phase:4.8}]:[{x:.18,y:.19,l:210,c:'#77cfe9',rx:Math.min(w*.12,165),ry:26,speed:.43,phase:0},{x:.88,y:.77,l:245,c:'#b6a0f1',rx:Math.min(w*.09,130),ry:28,speed:.36,phase:2.3},{x:.27,y:.83,l:170,c:'#84b7f2',rx:Math.min(w*.17,225),ry:22,speed:.32,phase:4.8}];
  const ramp='.:=+*#%@';
  const font=narrow?7:9;
  const cw=font*.61,ch=font*1.1;
  asciiCtx.font=`${font}px ${getComputedStyle(document.body).getPropertyValue('--mono')}`;
  asciiCtx.textAlign='center';asciiCtx.textBaseline='middle';
  fishes.forEach((f,fi)=>{
    const a=f.l/2;
    const phase=t*f.speed+f.phase;
    const dir=Math.cos(phase)>=0?1:-1;
    const px=f.x*w+Math.sin(phase)*f.rx;
    const py=f.y*h+Math.sin(phase*1.6+fi)*f.ry;
    const turn=.68+Math.abs(Math.cos(phase))*.32;
    const top=Math.floor((py-a*.63)/ch),bottom=Math.ceil((py+a*.63)/ch);
    const left=Math.floor((px-a*1.25)/cw),right=Math.ceil((px+a*1.25)/cw);
    for(let r=top;r<bottom;r++)for(let c=left;c<right;c++){
      let u=((c+.5)*cw-px)/(a*turn)*dir;
      let v=((r+.5)*ch-py)/a;
      v-=Math.sin(t*3.2+u*3+fi)*.018;
      const bodyX=(u-.10)/.84;
      let density=0;
      const ellipse=bodyX*bodyX+Math.pow(v/.43,2);
      if(ellipse<1)density=.25+(1-ellipse)*.65;
      const wag=Math.sin(t*3+fi)*.1;
      if(u<-.58&&u>-1.15){const tail=(-.58-u)/.57;const av=Math.abs(v-wag*tail);if(av<tail*.37&&av>tail*.055)density=.45;}
      if(u>-.23&&u<.38){const dorsal=-.43*Math.sqrt(Math.max(0,1-bodyX*bodyX));const fin=.19*(1-Math.abs(u-.02)/.36);if(v<dorsal&&v>dorsal-fin)density=.36;}
      if(u>-.05&&u<.30&&v>.36&&v<.49-Math.abs(u-.13)*.35)density=.32;
      if(!density)continue;
      const vx=(u-.48)/.28,vy=(v+.025)/.19;
      const face=vx*vx+vy*vy;
      if(face<1)density=.12;
      const eye=Math.pow((u-.54)/.07,2)+Math.pow((v+.035)/.075,2);
      if(eye<1)density=1;
      const glint=Math.pow((u-.17)/.40,2)+Math.pow((v+.24)/.07,2);if(glint<1)density=.75;
      const variation=seeded(c+fi*100,r)*.1;
      const index=Math.min(ramp.length-1,Math.max(0,Math.floor((density+variation)*(ramp.length-1))));
      asciiCtx.fillStyle=f.c;asciiCtx.globalAlpha=(narrow?.4:.64)*(density>.9?1.4:1);
      asciiCtx.fillText(ramp[index],(c+.5)*cw,(r+.5)*ch);
    }
  });asciiCtx.globalAlpha=1;
}
function drawPlankton(t){
  const {w,h}=planktonSize;if(!w||!h)return;
  planktonCtx.clearRect(0,0,w,h);
  const n=w<600?30:65;
  for(let i=0;i<n;i++){
    const x=(seeded(i,1)*w+Math.sin(t*.04+i)*9);
    const y=((seeded(i,2)*h-t*(1.4+seeded(i,3)*2))%h+h)%h;
    planktonCtx.globalAlpha=.08+seeded(i,4)*.18;
    planktonCtx.fillStyle=i%4===0?'#b9a3ff':'#8acdd2';
    const s=i%9===0?1.5:.7;
    planktonCtx.fillRect(x,y,s,s);
  }planktonCtx.globalAlpha=1;
}
let simTime=0,lastFrame=0,lastDraw=0;
function animation(now){
  const dt=lastFrame?Math.min(.05,(now-lastFrame)/1000):0;lastFrame=now;
  if(!motionPaused&&!document.hidden)simTime+=dt;
  if(now-lastDraw>30&&!document.hidden){
    if(window.scrollY<sections[0].offsetHeight)drawAscii(simTime);
    drawPlankton(simTime);lastDraw=now;
  }
  requestAnimationFrame(animation);
}
function applyMotion(){
  document.body.classList.toggle('motion-paused',motionPaused);
}

function renderCatalog(){
  $('#overview-agents').textContent=pad(DATA.length);
  $('#overview-tasks').textContent=pad(TASKS.length);
  $('#overview-claims').textContent=pad(CLAIMS);
  presentTasks().forEach(t=>{const option=document.createElement('option');option.value=t;option.textContent=taskName(t);$('#catalog-function').append(option);});
  renderHabitat();renderFigures();renderObservationField();renderOccupations();renderGroups();renderProfiles();renderTable();
}
function showLoadError(error){
  $('#creatures').innerHTML='<p class="habitat-empty mono">THE CATALOG COULD NOT BE LOADED. PLEASE RELOAD THE PAGE.</p>';
  const toast=$('#toast');toast.textContent=`Could not load the catalog: ${error.message}`;toast.classList.add('show');
  console.error(error);
}

renderScenery();applyMotion();useLevelNavigation();resize();requestAnimationFrame(animation);
loadCatalog().then(renderCatalog,showLoadError);
$('#habitat-shuffle').addEventListener('click',renderCreatures);
reducedQuery.addEventListener('change',e=>{motionPaused=e.matches;applyMotion();cancelDive();useLevelNavigation();});
levelNavigationQuery.addEventListener('change',()=>{cancelDive();useLevelNavigation();});
$('#habitat-pause').addEventListener('click',()=>{habitatPaused=!habitatPaused;$('#habitat-ocean').classList.toggle('is-paused',habitatPaused);$('#habitat-pause').textContent=habitatPaused?'> Resume habitat':'II Pause habitat';$('#habitat-pause').setAttribute('aria-pressed',String(habitatPaused));});
$('#catalog-search').addEventListener('input',()=>{page=0;renderTable();});
$('#catalog-function').addEventListener('change',()=>{page=0;renderTable();});
$('#previous-page').addEventListener('click',()=>{page=Math.max(0,page-1);renderTable();});
$('#next-page').addEventListener('click',()=>{page++;renderTable();});
for(const [key,first] of [['name',1],['stars',-1],['created',-1]])$(`#sort-${key}`).addEventListener('click',()=>{sortDirection=sortBy===key?-sortDirection:first;sortBy=key;page=0;renderTable();});
$('#download-csv').addEventListener('click',downloadCSV);
$('#wage-plot').addEventListener('click',e=>{const c=e.target.closest('circle[data-soc]');if(c)showOccupation(c);});
$('#wage-plot').addEventListener('keydown',e=>{const c=e.target.closest('circle[data-soc]');if(c&&(e.key==='Enter'||e.key===' ')){e.preventDefault();showOccupation(c);}});
$('#schema-button').addEventListener('click',()=>$('#schema-dialog').showModal());
$$('dialog').forEach(dialog=>{
  dialog.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
});
$('#next-depth').addEventListener('click',()=>navigateToSection(activeSection===sections.length-1?0:activeSection+1));
$$('a[href^="#"]').forEach(link=>link.addEventListener('click',event=>{
  const target=document.getElementById(link.hash.slice(1));
  const section=target?.closest('.depth-section');
  if(!section)return;
  event.preventDefault();
  if(location.hash!==link.hash)history.pushState(null,'',link.hash);
  navigateToSection(sections.indexOf(section));
  if(link.classList.contains('skip-link')){target.setAttribute('tabindex','-1');target.focus({preventScroll:true});}
}));
window.addEventListener('popstate',()=>{const target=document.getElementById(location.hash.slice(1))||sections[0];const section=target.closest('.depth-section');if(section)navigateToSection(sections.indexOf(section));});
window.addEventListener('wheel',onDiveWheel,{passive:true});
window.addEventListener('touchstart',()=>{cancelDive();gestureActive=false;},{passive:true});
window.addEventListener('pointerdown',()=>{pointerDown=true;cancelDive();gestureActive=false;},{passive:true});
window.addEventListener('pointerup',()=>{pointerDown=false;},{passive:true});
window.addEventListener('scroll',()=>{updateScroll();scheduleSettle();},{passive:true});
window.addEventListener('resize',resize,{passive:true});
document.addEventListener('keydown',event=>{
  if($$('dialog[open]').length||/INPUT|SELECT|TEXTAREA|BUTTON/.test(document.activeElement.tagName))return;
  if(!['PageDown','PageUp','ArrowDown','ArrowUp',' ','Home','End'].includes(event.key))return;
  cancelDive();
  gestureActive=true;
  gestureDirection=event.key==='PageUp'||event.key==='ArrowUp'||event.key==='Home'||(event.key===' '&&event.shiftKey)?-1:1;
  lastWheelAt=performance.now();
  scheduleSettle();
});

// Scatter of every GitHub agent: repository creation date across, stars up on a log scale, colour = main task.
function renderObservationField(){
  const svg=document.querySelector('#field-plot');if(!svg)return;
  const left=58,right=522,top=22,bottom=300;
  const plotted=DATA.filter(d=>d.created_on&&starsOf(d));
  const yearOf=d=>{const t=new Date(d.created_on+'T00:00:00Z');return t.getUTCFullYear()+(t-Date.UTC(t.getUTCFullYear(),0,1))/31557600000;};
  const axis='fill="#7f94ad" font-size="12" font-family="monospace"';
  $('#field-count').textContent=`${agentCount(plotted.length)}`;
  let html='<title>Agents by repository creation date and GitHub stars</title><desc>One point per agent. Horizontal position is the year its repository was created; vertical position is its GitHub stars on a log scale; colour is its main task. Select a point to inspect the agent.</desc>';
  if(!plotted.length){
    svg.innerHTML=html+`<text x="290" y="165" text-anchor="middle" ${axis}>NO AGENTS PUBLISHED YET</text>`;
    return;
  }
  const firstYear=Math.floor(Math.min(...plotted.map(yearOf))),lastYear=Math.floor(Math.max(...plotted.map(yearOf)))+1;
  const lowExp=Math.floor(Math.log10(Math.min(...plotted.map(starsOf)))),highExp=Math.ceil(Math.log10(Math.max(...plotted.map(starsOf))));
  // Most agents are recent, so years before the last four share a narrow band at the left.
  const split=Math.max(firstYear,lastYear-4),band=split>firstYear?46:0;
  const x=year=>year<split?left+(year-firstYear)/(split-firstYear)*(band-10):left+band+(year-split)/(lastYear-split)*(right-left-band);
  const y=stars=>bottom-(Math.log10(stars)-lowExp)/(highExp-lowExp)*(bottom-top);
  for(let e=lowExp;e<=highExp;e++){
    html+=`<line x1="${left}" y1="${y(10**e)}" x2="${right}" y2="${y(10**e)}" stroke="#c9d9ec" opacity="${e===lowExp?.22:.07}"/><text x="${left-8}" y="${y(10**e)+3}" text-anchor="end" ${axis}>${starLabel(10**e)}</text>`;
  }
  if(band)html+=`<line x1="${left+band-5}" y1="${top}" x2="${left+band-5}" y2="${bottom}" stroke="#c9d9ec" opacity=".25" stroke-dasharray="2 3"/><text x="${left+(band-10)/2}" y="${bottom+18}" text-anchor="middle" ${axis}>≤${split-1}</text>`;
  for(let year=split;year<lastYear;year++)html+=`<text x="${x(year+.5)}" y="${bottom+18}" text-anchor="middle" ${axis}>${year}</text>`;
  html+=`<text x="${left}" y="${top-8}" ${axis} letter-spacing="1">↑ GITHUB STARS</text><text x="${right}" y="${bottom+38}" text-anchor="end" ${axis} letter-spacing="1">REPOSITORY CREATED →</text>`;
  $('#field-legend').innerHTML=presentTasks().map(t=>`<span class="legend-item"><i class="legend-dot" style="background:${styleFor(t).color}"></i>${esc(taskName(t))}</span>`).join('');
  for(const d of plotted){
    const cx=x(yearOf(d)).toFixed(1),cy=y(starsOf(d)).toFixed(1),style=styleFor(mainTask(d));
    html+=`<a href="#" class="observation-point" data-agent="${esc(d.id)}" aria-label="Inspect ${esc(d.name)}, ${starsOf(d)} stars, created ${esc(d.created_on)}"><title>${esc(d.name)} · ★ ${starLabel(starsOf(d))} · ${esc(d.created_on)} · ${esc(taskName(mainTask(d)))}</title><circle cx="${cx}" cy="${cy}" r="5" fill="transparent"/><circle cx="${cx}" cy="${cy}" r="2.6" fill="${style.color}" opacity=".85"/></a>`;
  }
  svg.innerHTML=html;
  svg.querySelectorAll('a').forEach(a=>a.addEventListener('click',event=>{event.preventDefault();showSpecimen(a.dataset.agent);}));
}

// Occupation coverage, from data/occupation_coverage.csv: the share of each occupation's O*NET tasks that agents claim.
const OCCUPATION_ROWS = 12;
const shareOf = o=>Number(o.tasks_claimed)/Number(o.tasks);
const percent = share=>`${(share*100).toFixed(share&&share<.1?1:0)}%`;
function renderOccupations(){
  const claimed=OCCUPATIONS.filter(o=>Number(o.tasks_claimed));
  $('#occupation-tag').textContent=`${claimed.length} of ${OCCUPATIONS.length} occupations have a claimed task.`;
  const axis='fill="#7f94ad" font-size="12" font-family="monospace"';
  if(!claimed.length){
    $('#occupation-chart').innerHTML='<p class="habitat-empty mono">NO WORK ACTIVITIES ARE LINKED YET</p>';
    $('#wage-plot').innerHTML=`<text x="270" y="165" text-anchor="middle" ${axis}>NO WORK ACTIVITIES ARE LINKED YET</text>`;
    return;
  }
  const top=claimed.slice().sort((a,b)=>shareOf(b)-shareOf(a)||Number(b.tasks_claimed)-Number(a.tasks_claimed)).slice(0,OCCUPATION_ROWS);
  $('#occupation-chart').innerHTML=top.map(o=>`<div class="occupation-row" title="${esc(o.title)}: ${o.tasks_claimed} of ${o.tasks} tasks, claimed by ${agentCount(Number(o.agents))}"><span class="occupation-label">${esc(o.title)}</span><span class="occupation-track"><span style="width:${shareOf(o)*100}%"></span></span><span class="occupation-number mono">${percent(shareOf(o))}</span></div>`).join('');

  const plotted=OCCUPATIONS.filter(o=>Number(o.annual_mean_wage)&&Number(o.employment));
  const left=58,right=522,plotTop=18,bottom=282;
  const wages=plotted.map(o=>Math.log10(Number(o.annual_mean_wage)));
  const lo=Math.min(...wages),hi=Math.max(...wages),shareMax=Math.max(...plotted.map(shareOf));
  const yMax=Math.ceil(shareMax*4)/4||.25;
  const x=wage=>left+(Math.log10(wage)-lo)/(hi-lo)*(right-left);
  const y=share=>bottom-share/yMax*(bottom-plotTop);
  const maxEmployment=Math.max(...plotted.map(o=>Number(o.employment)));
  let html='<title>Occupations by mean annual wage and share of tasks claimed by agents</title><desc>One circle per occupation. Horizontal position is its mean annual wage on a log scale; vertical position is the share of its O*NET tasks that at least five agents claim; circle area is its employment.</desc>';
  for(let s=0;s<=yMax+1e-9;s+=yMax/4)html+=`<line x1="${left}" y1="${y(s)}" x2="${right}" y2="${y(s)}" stroke="#20324826"/><text x="${left-8}" y="${y(s)+4}" text-anchor="end" ${axis}>${percent(s)}</text>`;
  for(const wage of [25000,50000,100000,200000])if(Math.log10(wage)>=lo&&Math.log10(wage)<=hi)html+=`<text x="${x(wage)}" y="${bottom+18}" text-anchor="middle" ${axis}>$${wage/1000}k</text>`;
  html+=`<text x="${left}" y="${plotTop-6}" ${axis} letter-spacing="1">↑ SHARE OF TASKS CLAIMED</text><text x="${right}" y="${bottom+38}" text-anchor="end" ${axis} letter-spacing="1">MEAN ANNUAL WAGE →</text>`;
  // Largest first, so small occupations stay visible on top.
  for(const o of plotted.slice().sort((a,b)=>Number(b.employment)-Number(a.employment))){
    // Area proportional to employment; the smallest occupations are drawn at a minimum size so they stay visible.
    const r=Math.max(1.5,12*Math.sqrt(Number(o.employment)/maxEmployment));
    html+=`<circle data-soc="${esc(o.soc_code)}" tabindex="0" role="button" aria-label="${esc(o.title)}" cx="${x(Number(o.annual_mean_wage)).toFixed(1)}" cy="${y(shareOf(o)).toFixed(1)}" r="${r.toFixed(1)}" fill="${Number(o.tasks_claimed)?'#3e7ec8':'#9aa7b6'}" fill-opacity="${Number(o.tasks_claimed)?.45:.18}" stroke="${Number(o.tasks_claimed)?'#3e7ec8':'none'}" stroke-width=".8"><title>${esc(o.title)} · $${Number(o.annual_mean_wage).toLocaleString('en-US')} · ${Number(o.employment).toLocaleString('en-US')} employed · ${percent(shareOf(o))} of tasks claimed</title></circle>`;
  }
  $('#wage-plot').innerHTML=html;
  $('#wage-detail').textContent='Select a circle to see its occupation.';
}
function showOccupation(circle){
  const o=OCCUPATIONS.find(row=>row.soc_code===circle.dataset.soc);
  $$('#wage-plot circle.selected').forEach(c=>c.classList.remove('selected'));
  circle.classList.add('selected');
  circle.parentNode.append(circle);
  $('#wage-detail').innerHTML=`<strong>${esc(o.title)}</strong> (SOC ${esc(o.soc_code)}) · $${Number(o.annual_mean_wage).toLocaleString('en-US')} mean wage · ${Number(o.employment).toLocaleString('en-US')} employed · ${o.tasks_claimed} of ${o.tasks} tasks claimed (${percent(shareOf(o))}) by ${agentCount(Number(o.agents))}`;
}

// Titles of the 2018 Standard Occupational Classification major groups, by the first two digits of a SOC code.
const MAJOR_GROUPS = {
  11:'Management',13:'Business and Financial Operations',15:'Computer and Mathematical',17:'Architecture and Engineering',
  19:'Life, Physical, and Social Science',21:'Community and Social Service',23:'Legal',25:'Educational Instruction and Library',
  27:'Arts, Design, Entertainment, Sports, and Media',29:'Healthcare Practitioners and Technical',31:'Healthcare Support',
  33:'Protective Service',35:'Food Preparation and Serving Related',37:'Building and Grounds Cleaning and Maintenance',
  39:'Personal Care and Service',41:'Sales and Related',43:'Office and Administrative Support',45:'Farming, Fishing, and Forestry',
  47:'Construction and Extraction',49:'Installation, Maintenance, and Repair',51:'Production',53:'Transportation and Material Moving'
};
// Occupation coverage pooled by major group: tasks claimed over tasks, summed across the group's occupations.
function renderGroups(){
  const groups=new Map();
  for(const o of OCCUPATIONS){
    const code=o.soc_code.slice(0,2);
    if(!MAJOR_GROUPS[code])throw new Error(`occupation_coverage.csv: no major group title for SOC code ${o.soc_code}`);
    if(!groups.has(code))groups.set(code,{title:MAJOR_GROUPS[code],tasks:0,tasks_claimed:0,employment:0});
    const g=groups.get(code);
    g.tasks+=Number(o.tasks);g.tasks_claimed+=Number(o.tasks_claimed);g.employment+=Number(o.employment);
  }
  const rows=[...groups.values()].sort((a,b)=>shareOf(b)-shareOf(a));
  $('#group-chart').style.setProperty('--rows',Math.ceil(rows.length/2));
  $('#group-chart').innerHTML=rows.map(g=>`<div class="occupation-row" title="${esc(g.title)}: ${g.tasks_claimed} of ${g.tasks} tasks · ${g.employment.toLocaleString('en-US')} employed in its occupations with a BLS estimate"><span class="occupation-label">${esc(g.title)}</span><span class="occupation-track"><span style="width:${shareOf(g)*100}%"></span></span><span class="occupation-number mono">${percent(shareOf(g))}</span></div>`).join('');
}

// Agent profiles, from agent_attributes.csv: among agents whose text states an attribute, the share with each value.
const AUDIENCES = [['practitioner','#4779be'],['non_expert','#c9874a'],['organization','#239ba4']];
// From most to least user control.
const AUTONOMY_LEVELS = [['operator','#c9d8ec'],['collaborator','#9dbbe0'],['consultant','#6f9bd1'],['approver','#3e7ec8'],['observer','#24487a']];
function renderMix(attribute,values,name){
  const valueOf=d=>d.attributes.find(a=>a.attribute===attribute)?.value;
  const sources=[['All agents',DATA],['GitHub and websites',DATA.filter(d=>!isMarketplace(d))],['AWS Marketplace',DATA.filter(isMarketplace)]];
  const byTask=presentTasks().map(t=>[taskName(t),DATA.filter(d=>mainTask(d)===t)]);
  const row=([label,agents],i,list)=>{
    const counts=values.map(([value])=>agents.filter(d=>valueOf(d)===value).length);
    const total=counts.reduce((sum,n)=>sum+n,0);
    if(!total)return '';
    const shares=values.map(([value],k)=>`${words(value)} ${Math.round(counts[k]/total*100)}%`).join(', ');
    return `<div class="owner-row${list===byTask&&i===0?' mix-break':''}"><span class="owner-row-label">${esc(label)}</span><div class="owner-track" role="img" aria-label="${esc(label)}, ${agentCount(total)}: ${esc(shares)}">${values.map(([value,color],k)=>counts[k]?`<span class="owner-segment" style="flex:${counts[k]};background:${color}" title="${esc(words(value))}: ${counts[k]} of ${total}"></span>`:'').join('')}</div><span class="mix-count mono">${total}</span></div>`;
  };
  $(`#${name}-chart`).innerHTML=sources.map(row).join('')+byTask.map(row).join('')||'<p class="habitat-empty mono">NO AGENT STATES THIS YET</p>';
  $(`#${name}-legend`).innerHTML=values.map(([value,color])=>`<span class="legend-item"><i class="legend-dot" style="background:${color}"></i>${esc(words(value))}</span>`).join('');
}
function renderProfiles(){
  renderMix('audience',AUDIENCES,'audience');
  renderMix('autonomy',AUTONOMY_LEVELS,'autonomy');
}
