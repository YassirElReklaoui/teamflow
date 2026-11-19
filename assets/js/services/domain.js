"use strict";

// TeamFlow modular build — generated from the verified granular API runtime.
  function unresolvedDependencies(ticket){
    const done=new Set(["done","deployed on sit","deprecated"]);
    return (ticket.dependencies||[]).map(id=>state.tickets.find(t=>t.id===id)).filter(t=>t && !done.has(String(t.status).toLowerCase()));
  }

  function isBlocked(ticket){
    return ticket.risk==="Blocked" || unresolvedDependencies(ticket).length>0;
  }

  function toast(message){
    const t = $("#toast");
    t.textContent = message;
    t.classList.remove("hidden");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(()=>t.classList.add("hidden"),2500);
  }

  function confirmAction(options={}){
    const root = $("#confirmRoot");
    const title = options.title || "Confirm action";
    const message = options.message || "This action changes your TeamFlow data.";
    const subject = options.subject || "";
    const confirmLabel = options.confirmLabel || "Delete";
    const cancelLabel = options.cancelLabel || "Cancel";
    const icon = options.icon || "!";
    const warning = options.warning || "This action cannot be undone automatically.";
    const details = Array.isArray(options.details) ? options.details.filter(Boolean) : [];
    return new Promise(resolve=>{
      const detailHtml = details.length ? `<ul class="confirm-details">${details.map(item=>`<li>${esc(item)}</li>`).join("")}</ul>` : "";
      const subjectHtml = subject ? `<div class="confirm-subject"><span class="confirm-subject-mark">${esc(icon)}</span><strong>${esc(subject)}</strong></div>` : "";
      root.innerHTML = `
        <div class="confirm-backdrop" role="alertdialog" aria-modal="true" aria-labelledby="confirmTitle" aria-describedby="confirmMessage">
          <div class="confirm-dialog">
            <div class="confirm-hero">
              <div class="confirm-icon">${esc(icon)}</div>
              <div><h2 class="confirm-title" id="confirmTitle">${esc(title)}</h2><p class="confirm-message" id="confirmMessage">${esc(message)}</p></div>
            </div>
            ${subjectHtml}
            ${detailHtml}
            ${warning ? `<div class="confirm-warning">${esc(warning)}</div>` : ""}
            <div class="confirm-actions">
              <button class="btn" id="confirmCancel" type="button">${esc(cancelLabel)}</button>
              <button class="btn danger" id="confirmProceed" type="button">${esc(confirmLabel)}</button>
            </div>
          </div>
        </div>`;
      let settled=false;
      const finish=value=>{
        if(settled) return;
        settled=true;
        document.removeEventListener("keydown",onKey);
        root.innerHTML="";
        resolve(value);
      };
      const onKey=e=>{if(e.key==="Escape") finish(false);};
      document.addEventListener("keydown",onKey);
      $("#confirmCancel").addEventListener("click",()=>finish(false));
      $("#confirmProceed").addEventListener("click",()=>finish(true));
      $(".confirm-backdrop",root).addEventListener("click",e=>{if(e.target===e.currentTarget) finish(false);});
      setTimeout(()=>$("#confirmCancel")?.focus(),0);
    });
  }


  function noticeAction(options={}){
    const root = $("#confirmRoot");
    const title = options.title || "TeamFlow";
    const message = options.message || "Please review this information.";
    const subject = options.subject || "";
    const icon = options.icon || "i";
    const buttonLabel = options.buttonLabel || "Got it";
    return new Promise(resolve=>{
      root.innerHTML = `
        <div class="notice-backdrop" role="dialog" aria-modal="true" aria-labelledby="noticeTitle">
          <div class="notice-dialog">
            <div class="notice-hero"><div class="notice-icon">${esc(icon)}</div><div><h2 id="noticeTitle">${esc(title)}</h2><p>${esc(message)}</p></div></div>
            ${subject?`<div class="notice-body"><div class="notice-subject">${esc(subject)}</div></div>`:""}
            <div class="notice-actions"><button class="btn primary" id="noticeOk" type="button">${esc(buttonLabel)}</button></div>
          </div>
        </div>`;
      let settled=false;
      const finish=()=>{if(settled)return;settled=true;document.removeEventListener("keydown",onKey);root.innerHTML="";resolve(true);};
      const onKey=e=>{if(e.key==="Escape"||e.key==="Enter")finish();};
      document.addEventListener("keydown",onKey);
      $("#noticeOk").addEventListener("click",finish);
      $(".notice-backdrop",root).addEventListener("click",e=>{if(e.target===e.currentTarget)finish();});
      setTimeout(()=>$("#noticeOk")?.focus(),0);
    });
  }


  function linkPreviewAction(linkText,rawUrl){
    const root=$("#confirmRoot");
    const url=safeHttpUrl(rawUrl);
    if(!url){toast("This link is not valid");return Promise.resolve(false);}
    const text=String(linkText||"").trim() || url;
    return new Promise(resolve=>{
      root.innerHTML=`
        <div class="notice-backdrop" role="dialog" aria-modal="true" aria-labelledby="linkPreviewTitle">
          <div class="notice-dialog">
            <div class="notice-hero"><div class="notice-icon">↗</div><div><h2 id="linkPreviewTitle">Open link</h2><p>Review the destination before opening it in a new tab.</p></div></div>
            <div class="notice-body">
              <div class="field"><label>Link text</label><input value="${esc(text)}" readonly /></div>
              <div class="field" style="margin-top:10px"><label>Link URL</label><input value="${esc(url)}" readonly /></div>
            </div>
            <div class="notice-actions"><button class="btn" id="linkPreviewClose" type="button">Close</button><button class="btn primary" id="linkPreviewOpen" type="button">Open Link ↗</button></div>
          </div>
        </div>`;
      let settled=false;
      const finish=value=>{if(settled)return;settled=true;document.removeEventListener("keydown",onKey);root.innerHTML="";resolve(value);};
      const onKey=e=>{if(e.key==="Escape")finish(false);};
      document.addEventListener("keydown",onKey);
      $("#linkPreviewClose").addEventListener("click",()=>finish(false));
      $("#linkPreviewOpen").addEventListener("click",()=>{window.open(url,"_blank","noopener,noreferrer");finish(true);});
      $(".notice-backdrop",root).addEventListener("click",e=>{if(e.target===e.currentTarget)finish(false);});
      setTimeout(()=>$("#linkPreviewOpen")?.focus(),0);
    });
  }


  function initials(name){
    const letters = String(name || "TM").split(/\s+/).map(x=>x[0]).join("").replace(/[^A-Za-z]/g,"");
    return (letters.slice(0,2) || "TM").toUpperCase();
  }

  function colorForName(name){
    const text=String(name||"Team member");
    let hash=0;
    for(let i=0;i<text.length;i++) hash=((hash<<5)-hash+text.charCodeAt(i))|0;
    return MEMBER_COLOR_PALETTE[Math.abs(hash)%MEMBER_COLOR_PALETTE.length];
  }

  function validMemberColor(value){
    const color=String(value||"").trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : "";
  }

  function ensureMemberColors(){
    state.members.forEach(m=>{if(!validMemberColor(m.color)) m.color=colorForName(m.name);});
  }

  const PERSONAL_PROFILE_KEY="teamflow-personal-profile-v1";
  function personalProfileStore(){try{return JSON.parse(localStorage.getItem(PERSONAL_PROFILE_KEY)||"{}")||{};}catch(err){tfLogError("Reading personal profile preferences failed",err);return {};}}
  function personalProfile(){const username=String(cloudUser?.username||"").trim().toLowerCase();if(!username)return {};return personalProfileStore()[username]||{};}
  function savePersonalProfile(profile){const username=String(cloudUser?.username||"").trim().toLowerCase();if(!username)return;const all=personalProfileStore();all[username]={...(all[username]||{}),...profile};try{localStorage.setItem(PERSONAL_PROFILE_KEY,JSON.stringify(all));}catch(err){tfLogError("Saving personal profile preferences failed",err);}renderViewAsAvatarMenu();refreshDataViews();}
  function linkedMemberForCurrentUser(){const username=String(cloudUser?.username||"").trim().toLowerCase();return username?state.members.find(m=>String(m.authUsername||"").trim().toLowerCase()===username):null;}
  function personalDisplayName(){const p=personalProfile();return String(p.displayName||cloudUser?.displayName||linkedMemberForCurrentUser()?.name||cloudUser?.username||"TeamFlow").trim();}

  function memberColor(name){
    const member=state.members.find(m=>m.name===name);
    const linked=linkedMemberForCurrentUser();
    if(linked&&member&&linked.id===member.id){const own=validMemberColor(personalProfile().color);if(own)return own;}
    return validMemberColor(member?.color) || colorForName(name);
  }

  function memberRole(name){
    return state.members.find(m=>m.name===name)?.role || "Team member";
  }

  function issueTypeColor(type){
    const colors={Task:"#8b5cf6",Bug:"#ef4444",Development:"#6366f1",Deployment:"#0ea5e9",Testing:"#f59e0b",Documentation:"#14b8a6"};
    return colors[type] || "#8b5cf6";
  }

  function safeHttpUrl(value){
    let raw=String(value||"").trim();
    if(!raw) return "";
    if(raw.startsWith("//")) raw="https:"+raw;
    else if(!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw="https://"+raw;
    try{
      const u=new URL(raw);
      return ["http:","https:"].includes(u.protocol)?u.toString():"";
    }catch(_){return "";}
  }

  function memberIdForName(name){
    return state.members.find(m=>m.name===name)?.id || "member:"+String(name||"unknown").toLowerCase();
  }

  function ensureMyWorkPrefs(memberName=state.currentMember){
    if(!state.myWorkPrefsByMember || typeof state.myWorkPrefsByMember!=="object" || Array.isArray(state.myWorkPrefsByMember)) state.myWorkPrefsByMember={};
    const key=memberIdForName(memberName);
    if(!state.myWorkPrefsByMember[key] || typeof state.myWorkPrefsByMember[key]!=="object"){
      state.myWorkPrefsByMember[key]={mode:"grid",order:clone(state.statuses),hidden:[]};
    }
    const prefs=state.myWorkPrefsByMember[key];
    if(!["grid","list"].includes(prefs.mode)) prefs.mode="grid";
    if(!Array.isArray(prefs.order)) prefs.order=[];
    if(!Array.isArray(prefs.hidden)) prefs.hidden=[];
    prefs.order=[...prefs.order.filter(x=>state.statuses.includes(x)),...state.statuses.filter(x=>!prefs.order.includes(x))];
    prefs.hidden=prefs.hidden.filter(x=>state.statuses.includes(x));
    return prefs;
  }

  function formatDate(dateString){
    if(!dateString) return "—";
    const parts = dateString.split("-").map(Number);
    if(parts.length !== 3 || parts.some(Number.isNaN)) return dateString;
    return new Intl.DateTimeFormat("en-GB",{day:"2-digit",month:"short"}).format(new Date(Date.UTC(parts[0],parts[1]-1,parts[2])));
  }

  function nowLabel(){
    return new Intl.DateTimeFormat("en-GB",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date());
  }

  function localTodayISO(){
    const d=new Date();
    const y=d.getFullYear();
    const m=String(d.getMonth()+1).padStart(2,"0");
    const day=String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${day}`;
  }

  function isOverdue(ticket){
    return Boolean(ticket.end && ticket.end < localTodayISO() && !["Done","Deployed on SIT","Deprecated"].includes(ticket.status));
  }

  function csvEscape(value,delimiter=","){
    const text=String(value == null ? "" : value);
    const needsQuote=text.includes('"') || text.includes("\n") || text.includes("\r") || text.includes(delimiter);
    return needsQuote ? '"'+text.replace(/"/g,'""')+'"' : text;
  }

  function detectCsvDelimiter(text){
    const sample=String(text||"").slice(0,25000);
    let comma=0,semicolon=0,tab=0,quoted=false;
    for(let i=0;i<sample.length;i++){
      const ch=sample[i];
      if(ch==='"'){
        if(quoted && sample[i+1]==='"'){i++;continue;}
        quoted=!quoted;continue;
      }
      if(quoted) continue;
      if(ch===',') comma++;
      else if(ch===';') semicolon++;
      else if(ch==='\t') tab++;
    }
    if(semicolon>=comma && semicolon>=tab && semicolon>0) return ';';
    if(tab>comma && tab>0) return '\t';
    return ',';
  }

  function parseCsv(text,delimiter=detectCsvDelimiter(text)){
    const rows=[];let row=[];let field="";let quoted=false;
    for(let i=0;i<text.length;i++){
      const ch=text[i];
      if(quoted){
        if(ch==='"' && text[i+1]==='"'){field+='"';i++;}
        else if(ch==='"'){quoted=false;}
        else field+=ch;
      }else{
        if(ch==='"') quoted=true;
        else if(ch===delimiter){row.push(field);field="";}
        else if(ch==='\n'){row.push(field);rows.push(row);row=[];field="";}
        else if(ch!=='\r') field+=ch;
      }
    }
    if(field.length || row.length){row.push(field);rows.push(row);}
    return rows.filter(r=>r.some(c=>String(c).trim()!==""));
  }

  function normalizeHeader(value){
    return String(value||"").replace(/^\uFEFF/,"").trim().toLowerCase().replace(/\s+/g," ");
  }

  function findCsvHeaderRow(rows){
    const aliases=["task","title","summary","activity","assigned to","assignee","owner","status","arch/be/fe","arch / be / fe","%","progress","start","end"];
    let best={index:-1,score:-1};
    rows.slice(0,80).forEach((row,index)=>{
      const headers=row.map(normalizeHeader);
      const score=aliases.reduce((n,a)=>n+(headers.includes(a)?1:0),0);
      const hasTask=headers.some(h=>["task","title","summary","activity"].includes(h));
      if(hasTask && score>best.score) best={index,score};
    });
    return best.index;
  }

  function normalizeProgress(value,fallback=0){
    const raw=String(value??"").trim().replace("%","").replace(",",".");
    const n=Number.parseFloat(raw);
    if(!Number.isFinite(n)) return Math.max(0,Math.min(100,Number(fallback)||0));
    return Math.max(0,Math.min(100,Math.round(n)));
  }

  function automaticProgressForStatusTransition(fromStatus,toStatus,currentProgress){
    const from=String(fromStatus||"").trim().toLowerCase();
    const to=String(toStatus||"").trim().toLowerCase();
    if(from==="to be started" && to==="ongoing") return 5;
    if(from==="ongoing" && to==="done") return 100;
    return normalizeProgress(currentProgress);
  }

  function normalizeWorkflowOrder(){
    // Identity cleanup only. NEVER writes or reorders workflow positions.
    if(!Array.isArray(state.statuses)||!state.statuses.length)state.statuses=clone(DEFAULT_STATUSES);
    const seen=new Set();
    state.statuses=state.statuses.map(x=>String(x||"").trim()).filter(name=>{if(!name)return false;const key=name.toLowerCase();if(seen.has(key))return false;seen.add(key);return true;});
  }

  function splitList(value){
    return String(value||"").split(/[;,|]+/).map(x=>x.trim()).filter(Boolean);
  }

  function splitAssigneeCell(value){
    const clean=String(value||"").trim();
    if(!clean) return [];
    if(/[;,|]/.test(clean)) return splitList(clean);
    const matches=clean.match(/[A-Za-zÀ-ÿ'’\-]+(?:\s+[A-Za-zÀ-ÿ'’\-]+)*\s+[A-Z]\./g);
    if(matches && matches.length>1){
      const compactMatches=matches.join("").replace(/\s+/g,"");
      const compactSource=clean.replace(/\s+/g,"");
      if(compactMatches===compactSource) return matches.map(x=>x.trim());
    }
    return [clean];
  }

  function encodeLinks(links){
    return (links||[]).map(l=>[l.title||"",l.url||"",l.chapter||""].map(x=>String(x).replace(/\|/g,"/")).join("|")).join(";;");
  }

  function decodeLinks(value){
    return String(value||"").split(';;').map(part=>part.trim()).filter(Boolean).map(part=>{
      const pieces=part.split('|');
      return {title:(pieces[0]||"").trim(),url:(pieces[1]||"").trim(),chapter:(pieces.slice(2).join('|')||"").trim()};
    }).filter(l=>l.url);
  }

  function importIdentityPart(value){
    return String(value||"").trim().toLowerCase().replace(/\s+/g," ");
  }

  function csvImportKey({title="",description="",assignee="",area="",start="",end=""}={}){
    return [title,assignee,area,start,end,description].map(importIdentityPart).join("|");
  }


  // Stable FNV-1a hash used only for backward-compatible CSV import identities.
  function spHash(value){
    const text=String(value ?? "");
    let hash=2166136261;
    for(let i=0;i<text.length;i++){
      hash^=text.charCodeAt(i);
      hash=Math.imul(hash,16777619);
    }
    return (hash>>>0).toString(36);
  }

  function findExistingCsvTicket(explicitId,importKey){
    if(explicitId){
      const byId=state.tickets.find(t=>String(t.id||"").toLowerCase()===String(explicitId).toLowerCase());
      if(byId) return byId;
    }
    if(!importKey) return null;
    const hashed=`hash:${spHash(importKey)}`;
    return state.tickets.find(t=>t.importKey===importKey || t.importKey===hashed || (!t.importKey && csvImportKey(t)===importKey)) || null;
  }

  function ensureMember(name){
    const clean=String(name||"").trim();
    if(!clean) return "";
    const found=state.members.find(m=>m.name.toLowerCase()===clean.toLowerCase());
    if(found) return found.name;
    state.members.push({id:"m"+Date.now()+Math.random().toString(36).slice(2,6),name:clean,role:"Imported from CSV",color:colorForName(clean)});
    return clean;
  }

  function normalizeDate(value){
    let v=String(value||"").trim();
    if(!v) return "";
    if(/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const prefixed=v.match(/(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/);
    if(prefixed) v=prefixed[1];
    const m=v.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})$/);
    if(m){
      let year=Number(m[3]);
      if(year<100) year+=2000;
      return `${year}-${String(m[2]).padStart(2,"0")}-${String(m[1]).padStart(2,"0")}`;
    }
    return v;
  }


  function ensureSharedWorkflowOrder(){
    // READ ONLY: rendering/normalization must never mutate saved workflow order.
    const settings=state.settings&&typeof state.settings==="object"&&!Array.isArray(state.settings)?state.settings:{};
    const identities=Array.isArray(state.statuses)&&state.statuses.length?state.statuses.map(x=>String(x)):clone(DEFAULT_STATUSES);
    const source=Array.isArray(settings.workflowOrder)&&settings.workflowOrder.length?settings.workflowOrder:(Array.isArray(state.workflowOrder)&&state.workflowOrder.length?state.workflowOrder:identities);
    const identityByLower=new Map(identities.map(name=>[name.toLowerCase(),name]));
    const seen=new Set();
    const order=[];
    source.forEach(value=>{const name=identityByLower.get(String(value||"").trim().toLowerCase());if(name&&!seen.has(name.toLowerCase())){seen.add(name.toLowerCase());order.push(name);}});
    identities.forEach(name=>{const key=name.toLowerCase();if(!seen.has(key)){seen.add(key);order.push(name);}});
    return order;
  }

  async function persistSharedWorkflowOrder(order){
    if(cloudUser?.role!=="admin")throw new Error("Administrator access required");
    const desired=order.slice();
    if(!cloudReady)throw new Error("TeamFlow must be connected to save workflow order");
    tfLog('info','Saving workflow order through dedicated admin endpoint',{admin:cloudUser?.username||'',order:desired});
    const result=await cloudRequest('/admin/workflows/order',{method:'PUT',body:{order:desired}});
    cloudVersion=Number(result.version||cloudVersion);cloudLastStamp=result.updatedAt||new Date().toISOString();
    state.statuses=desired.slice();
    state.workflowOrder=desired.slice();
    if(state.settings&&typeof state.settings==='object'&&!Array.isArray(state.settings))state.settings.workflowOrder=desired.slice();
    cloudBaselineState=clone(state);
    tfLog('info','Workflow order saved',{version:cloudVersion,order:desired});
    setSyncStatus('saved','Sync · saved',`Workflow order · version ${cloudVersion}`);
    return true;
  }

  function currentWorkflowOrderDraft(){
    const saved=ensureSharedWorkflowOrder().slice();
    if(!Array.isArray(workflowOrderDraft)) workflowOrderDraft=saved.slice();
    const allowed=new Set(saved);
    workflowOrderDraft=workflowOrderDraft.filter(name=>allowed.has(name));
    saved.forEach(name=>{if(!workflowOrderDraft.includes(name))workflowOrderDraft.push(name);});
    return workflowOrderDraft;
  }

  function workflowOrderDraftChanged(){
    if(!Array.isArray(workflowOrderDraft))return false;
    const saved=ensureSharedWorkflowOrder();
    return saved.length!==workflowOrderDraft.length || saved.some((name,index)=>name!==workflowOrderDraft[index]);
  }

  function moveWorkflowDraft(statusName,direction){
    if(cloudUser?.role!=="admin"){toast("Administrator access required");return false;}
    const order=currentWorkflowOrderDraft();
    const index=order.indexOf(statusName);if(index<0)return false;
    const nextIndex=direction==='up'?index-1:direction==='down'?index+1:index;
    if(nextIndex<0||nextIndex>=order.length||nextIndex===index)return false;
    [order[index],order[nextIndex]]=[order[nextIndex],order[index]];
    workflowOrderDraft=order.slice();
    tfLog('info','Workflow order draft changed',{admin:cloudUser?.username||'',order:[...workflowOrderDraft]});
    renderStatusEditor();
    return true;
  }

  async function saveWorkflowOrderDraft(){
    if(cloudUser?.role!=="admin"){toast("Administrator access required");return false;}
    if(!workflowOrderDraftChanged()){workflowOrderDraft=null;renderStatusEditor();return true;}
    const desired=currentWorkflowOrderDraft().slice();
    const button=$("#saveWorkflowOrder");if(button){button.disabled=true;button.textContent="Saving…";}
    try{
      await persistSharedWorkflowOrder(desired);
      workflowOrderDraft=null;
      renderStatusEditor();renderBoard();renderOverview();renderInsights();renderTimeline();
      toast("Workflow order saved for everyone");
      return true;
    }catch(err){
      tfLogError('Shared workflow order save failed',err,{order:desired});
      if(button){button.disabled=false;button.textContent="Save order";}
      toast("Workflow order could not be saved — see Console");
      return false;
    }
  }

  function discardWorkflowOrderDraft(){
    workflowOrderDraft=null;
    renderStatusEditor();
  }

  function ensureAdvancedState(){
    if(!Array.isArray(state.activity)) state.activity=[];
    if(!Array.isArray(state.favorites)) state.favorites=[];
    if(!Array.isArray(state.recentTickets)) state.recentTickets=[];
    if(!state.savedViewsByMember || typeof state.savedViewsByMember!=="object" || Array.isArray(state.savedViewsByMember)) state.savedViewsByMember={};
    if(!state.wipLimits || typeof state.wipLimits!=="object" || Array.isArray(state.wipLimits)) state.wipLimits={};
    if(!state.fontSizeByMember || typeof state.fontSizeByMember!=="object" || Array.isArray(state.fontSizeByMember)) state.fontSizeByMember={};
    if(!state.statusIcons || typeof state.statusIcons!=="object" || Array.isArray(state.statusIcons)) state.statusIcons={};
    if(!state.settings||typeof state.settings!=="object"||Array.isArray(state.settings))state.settings={};
    if(typeof state.settings.workspaceName!=="string"||!state.settings.workspaceName.trim())state.settings.workspaceName="Team Workspace";
    state.settings.workspaceName=state.settings.workspaceName.trim().slice(0,100);
    const cleanPrefix=String(state.settings.ticketPrefix||"TASK").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,12);
    state.settings.ticketPrefix=cleanPrefix.length>=2?cleanPrefix:"TASK";
    const pollMinutes=Number(state.settings.fallbackPollMinutes||5);
    state.settings.fallbackPollMinutes=[1,5,10,15].includes(pollMinutes)?pollMinutes:5;
    if(!state.releaseMeta||typeof state.releaseMeta!=="object"||Array.isArray(state.releaseMeta))state.releaseMeta={};
    (state.releases||[]).forEach(name=>{if(!state.releaseMeta[name])state.releaseMeta[name]={visibility:"active"};if(!["active","hidden","archived"].includes(state.releaseMeta[name].visibility))state.releaseMeta[name].visibility="active";});
    if(!Array.isArray(state.settings.workflowOrder))state.settings.workflowOrder=[];
    if(!Array.isArray(state.workflowOrder)) state.workflowOrder=[];
    if(!state.timelinePrefs || typeof state.timelinePrefs!=="object" || Array.isArray(state.timelinePrefs)) state.timelinePrefs={};
    const tp=state.timelinePrefs;
    if(!["gantt","list"].includes(tp.mode)) tp.mode="gantt";
    if(!["assignee","status","release","type"].includes(tp.group)) tp.group="assignee";
    if(!["week","2weeks","month","quarter"].includes(tp.zoom)) tp.zoom="2weeks";
    if(typeof tp.rangeStart!=="string") tp.rangeStart="";
    if(typeof tp.rangeEnd!=="string") tp.rangeEnd="";
    if(!tp.filters || typeof tp.filters!=="object" || Array.isArray(tp.filters)) tp.filters={};
    ["assignee","status","release","type"].forEach(k=>{if(typeof tp.filters[k]!=="string") tp.filters[k]="";});
    if(!tp.collapsed || typeof tp.collapsed!=="object" || Array.isArray(tp.collapsed)) tp.collapsed={};
    ensureSharedWorkflowOrder();
    state.statuses.forEach(status=>{if(!state.statusIcons[status]) state.statusIcons[status]=DEFAULT_STATUS_ICONS[status]||"circle";});
    Object.keys(state.statusIcons).forEach(status=>{if(!state.statuses.includes(status)) delete state.statusIcons[status];});
    state.tickets.forEach(t=>{
      if(!Array.isArray(t.subtasks)) t.subtasks=[];
      if(typeof t.autoProgress!=="boolean") t.autoProgress=false;
      if(typeof t.archived!=="boolean") t.archived=false;
      (t.comments||[]).forEach((c,i)=>{
        if(!c.id) c.id=`c_${String(t.id).replace(/[^a-z0-9]/gi,'')}_${i}_${Date.now().toString(36)}`;
        if(!c.reactions || typeof c.reactions!=="object") c.reactions={};
      });
    });
    state.statuses.forEach(s=>{if(!(s in state.wipLimits)) state.wipLimits[s]="";});
    Object.keys(state.wipLimits).forEach(s=>{if(!state.statuses.includes(s)) delete state.wipLimits[s];});
  }


  function workspaceName(){ensureAdvancedState();return state.settings.workspaceName||"Team Workspace";}
  function workspaceTicketPrefix(){ensureAdvancedState();return state.settings.ticketPrefix||"TASK";}
  function workspaceFallbackPollMinutes(){ensureAdvancedState();return Number(state.settings.fallbackPollMinutes||5);}
  function applyWorkspaceIdentity(){
    ensureAdvancedState();
    const name=workspaceName();
    document.title=`TeamFlow — ${name}`;
    const crumb=document.getElementById("workspaceBreadcrumb");if(crumb)crumb.textContent=name;
    const nameInput=document.getElementById("workspaceDisplayName");if(nameInput&&document.activeElement!==nameInput)nameInput.value=name;
    const prefixInput=document.getElementById("workspaceTicketPrefix");if(prefixInput&&document.activeElement!==prefixInput)prefixInput.value=workspaceTicketPrefix();
    const poll=document.getElementById("workspaceFallbackPoll");if(poll)poll.value=String(workspaceFallbackPollMinutes());
  }


  function unarchivedTickets(list=state.tickets){return (list||[]).filter(t=>!t.archived);}

  function releaseVisibility(name){ensureAdvancedState();return state.releaseMeta?.[name]?.visibility||'active';}
  function releaseVisibleOnBoard(name){return !name || releaseVisibility(name)==='active';}
  function setReleaseVisibility(name,visibility){
    ensureAdvancedState();
    if(!state.releaseMeta[name])state.releaseMeta[name]={visibility:'active'};
    state.releaseMeta[name].visibility=['active','hidden','archived'].includes(visibility)?visibility:'active';
  }
  function activeReleaseNames(){ensureAdvancedState();return (state.releases||[]).filter(name=>releaseVisibility(name)==='active');}

  function fontPrefKey(){
    const member=state.members.find(m=>m.name===state.currentMember) || state.members[0];
    return member?.id || "default";
  }
  function currentFontSize(){ensureAdvancedState();return state.fontSizeByMember[fontPrefKey()] || "medium";}
  function applyUserFontSize(size=currentFontSize(),persist=false){
    const allowed=["small","medium","large","xlarge"];
    const next=allowed.includes(size)?size:"medium";
    const delta={small:"-1px",medium:"0px",large:"1px",xlarge:"2px"}[next];
    document.documentElement.dataset.userFontSize=next;
    document.documentElement.style.setProperty("--app-font-delta",delta);
    $$(".font-size-option").forEach(btn=>btn.classList.toggle("active",btn.dataset.fontSize===next));
    if(persist){state.fontSizeByMember[fontPrefKey()]=next;saveState();}
  }

  function logActivity(kind,ticket,message){
    ensureAdvancedState();
    const t=typeof ticket==='string'?state.tickets.find(x=>x.id===ticket):ticket;
    state.activity.unshift({id:'a'+Date.now()+Math.random().toString(36).slice(2,5),kind:kind||'update',ticketId:t?.id||'',title:t?.title||'',by:state.currentMember||'Team member',message:message||'',ts:Date.now()});
    state.activity=state.activity.slice(0,250);
  }

  function rememberRecent(ticketId){
    ensureAdvancedState();
    state.recentTickets=[ticketId,...state.recentTickets.filter(id=>id!==ticketId)].slice(0,12);
    saveState();
  }

  function toggleFavorite(ticketId){
    ensureAdvancedState();
    if(state.favorites.includes(ticketId)) state.favorites=state.favorites.filter(id=>id!==ticketId);
    else state.favorites.unshift(ticketId);
    saveState();
  }

  function isFavorite(ticketId){ensureAdvancedState();return state.favorites.includes(ticketId);}

  function personalSavedViews(memberName=state.currentMember){
    ensureAdvancedState();
    const key=memberIdForName(memberName);
    if(!Array.isArray(state.savedViewsByMember[key])) state.savedViewsByMember[key]=[];
    return state.savedViewsByMember[key];
  }

  function currentBoardViewConfig(){
    return {q:$("#globalSearch").value,assignee:$("#assigneeFilter").value,status:$("#statusFilter").value,area:$("#areaFilter").value,priority:$("#priorityFilter").value,release:$("#releaseFilter").value,risk:$("#riskFilter").value,swimlane:$("#swimlaneFilter")?.value||""};
  }

  function applyBoardViewConfig(cfg={}){
    $("#globalSearch").value=cfg.q||"";$("#assigneeFilter").value=cfg.assignee||"";$("#statusFilter").value=cfg.status||"";$("#areaFilter").value=cfg.area||"";$("#priorityFilter").value=cfg.priority||"";$("#releaseFilter").value=cfg.release||"";$("#riskFilter").value=cfg.risk||"";if($("#swimlaneFilter"))$("#swimlaneFilter").value=cfg.swimlane||"";quickMode="clear";renderBoard();
  }

  function renderSavedViews(){
    const select=$("#savedViewSelect");if(!select)return;
    const views=personalSavedViews();const prev=select.value;
    select.innerHTML='<option value="">Saved views</option>'+views.map(v=>`<option value="${esc(v.id)}">${esc(v.name)}</option>`).join('');
    if(views.some(v=>v.id===prev))select.value=prev;
  }

  function openSaveViewModal(){
    $("#modalRoot").innerHTML=`<div class="modal-backdrop" role="dialog" aria-modal="true"><div class="modal" style="max-width:520px"><div class="modal-head"><h2>Save personal board view</h2><button id="closeModal" class="modal-close" type="button">×</button></div><div class="modal-body"><div class="field"><label>View name *</label><input id="savedViewName" placeholder="e.g. My high-priority SIT work" /></div><p class="note" style="margin-top:10px">This saves the current search, filters and swimlane only for <b>${esc(state.currentMember)}</b>.</p></div><div class="modal-actions"><div class="spacer"></div><button id="cancelSavedView" class="btn" type="button">Cancel</button><button id="confirmSavedView" class="btn primary" type="button">Save view</button></div></div></div>`;
    const close=()=>$("#modalRoot").innerHTML="";$("#closeModal").onclick=close;$("#cancelSavedView").onclick=close;
    $("#confirmSavedView").onclick=()=>{const name=$("#savedViewName").value.trim();if(!name){$("#savedViewName").focus();return;}const views=personalSavedViews();views.push({id:'v'+Date.now(),name,config:currentBoardViewConfig()});saveState();close();renderSavedViews();toast(`Saved view “${name}”`);};
    setTimeout(()=>$("#savedViewName")?.focus(),0);
  }

  function wipLimitFor(status){const n=Number(state.wipLimits?.[status]);return Number.isFinite(n)&&n>0?Math.floor(n):null;}

  function dueInfo(ticket){
    if(!ticket.end)return {text:'No due date',cls:''};
    const today=new Date(localTodayISO()+'T00:00:00');const end=new Date(ticket.end+'T00:00:00');const diff=Math.round((end-today)/86400000);
    if(["Done","Deployed on SIT","Deprecated"].includes(ticket.status))return {text:`Due ${formatDate(ticket.end)}`,cls:''};
    if(diff<0)return {text:`Overdue by ${Math.abs(diff)}d`,cls:'overdue'};
    if(diff===0)return {text:'Due today',cls:'today'};
    if(diff===1)return {text:'Due tomorrow',cls:'soon'};
    if(diff<=7)return {text:`Due in ${diff}d`,cls:'soon'};
    return {text:`Due ${formatDate(ticket.end)}`,cls:''};
  }

  function duplicateTicket(ticketId){
    const source=state.tickets.find(t=>t.id===ticketId);if(!source)return;
    const suggestedId=nextTicketId();
    $("#confirmRoot").innerHTML=`
      <div class="notice-backdrop" role="dialog" aria-modal="true" aria-label="Duplicate ticket">
        <div class="notice-dialog" style="width:min(560px,100%)">
          <div class="notice-hero">
            <div class="notice-icon">⧉</div>
            <div>
              <h2>Duplicate ticket</h2>
              <p>Create a new ticket from <strong>${esc(source.id)}</strong>. You can rename the copy before it is created.</p>
            </div>
          </div>
          <div class="notice-body">
            <div class="notice-subject" style="margin-bottom:14px">
              <strong>${esc(source.id)}</strong> · ${esc(source.title)}
            </div>
            <div class="field">
              <label>New ticket name *</label>
              <input id="duplicateTicketName" value="${esc(source.title)}" autocomplete="off" />
            </div>
            <div class="note" style="margin-top:10px">
              TeamFlow will create <strong>${esc(suggestedId)}</strong>. Progress and comments will reset, while the ticket details, labels, collaborators, links, dependencies, and checklist structure are copied.
            </div>
          </div>
          <div class="notice-actions" style="gap:8px">
            <button class="btn" id="duplicateTicketCancel" type="button">Cancel</button>
            <button class="btn primary" id="duplicateTicketConfirm" type="button">⧉ Duplicate Ticket</button>
          </div>
        </div>
      </div>`;

    const close=()=>$("#confirmRoot").innerHTML="";
    $("#duplicateTicketCancel").addEventListener("click",close);
    $(".notice-backdrop").addEventListener("click",e=>{if(e.target===e.currentTarget)close();});

    const confirmDuplicate=()=>{
      const input=$("#duplicateTicketName");
      const title=input.value.trim();
      if(!title){
        input.focus();
        input.style.borderColor="var(--danger)";
        input.style.boxShadow="0 0 0 4px color-mix(in srgb,var(--danger) 12%,transparent)";
        return;
      }
      const copy=clone(source);
      copy.id=nextTicketId();
      copy.title=title;
      copy.status=state.statuses[0]||source.status;
      copy.progress=0;
      copy.start=localTodayISO();
      copy.comments=[];
      copy.history=['Duplicated from '+source.id];
      copy.subtasks=(copy.subtasks||[]).map(x=>({...x,id:'st'+Date.now()+Math.random().toString(36).slice(2,5),done:false}));
      state.tickets.push(copy);
      logActivity('duplicate',copy,`Duplicated from ${source.id}`);
      saveState();
      refreshDataViews();
      close();
      toast(`${copy.id} created from ${source.id}`);
      openTicketDetails(copy.id);
    };

    $("#duplicateTicketConfirm").addEventListener("click",confirmDuplicate);
    $("#duplicateTicketName").addEventListener("keydown",e=>{
      if(e.key==='Enter'){e.preventDefault();confirmDuplicate();}
      if(e.key==='Escape'){e.preventDefault();close();}
    });
    setTimeout(()=>{
      const input=$("#duplicateTicketName");
      if(input){input.focus();input.select();}
    },0);
  }

  function subtaskRowsHtml(subtasks){
    const list=(subtasks&&subtasks.length)?subtasks:[{id:'',text:'',done:false}];
    return list.map(s=>`<div class="subtask-row"><input class="subtask-done" type="checkbox" ${s.done?'checked':''} /><input class="subtask-text" type="text" value="${esc(s.text||'')}" placeholder="Checklist item" /><button class="subtask-remove" type="button">×</button></div>`).join('');
  }

  function calcSubtaskProgress(subtasks){const list=(subtasks||[]).filter(s=>String(s.text||'').trim());return list.length?Math.round(list.filter(s=>s.done).length/list.length*100):0;}

  function formatCommentText(text){
    let safe=esc(text||'');
    const names=state.members.map(m=>m.name).sort((a,b)=>b.length-a.length);
    names.forEach(name=>{const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');safe=safe.replace(new RegExp('@'+escaped,'gi'),m=>`<span class="mention">${m}</span>`);});
    const ticketIds=(state.tickets||[]).map(t=>String(t.id||"").trim()).filter(Boolean).sort((a,b)=>b.length-a.length);
    if(ticketIds.length){
      const pattern=ticketIds.map(id=>id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
      safe=safe.replace(new RegExp(`(${pattern})`,'g'),'<span class="ticket-ref" data-comment-ticket="$1">$1</span>');
    }
    return safe.replace(/\n/g,'<br>');
  }

  function commentHtml(c,ticket){
    const likes=Array.isArray(c.reactions?.like)?c.reactions.like:[];const mine=likes.includes(state.currentMember);const own=c.by===state.currentMember;
    return `<div class="comment" data-comment-id="${esc(c.id)}"><span class="comment-avatar" style="--comment-color:${memberColor(c.by)}">${initials(c.by)}</span><div class="comment-content"><div class="comment-head"><strong>${esc(c.by)}</strong><small>${esc(c.at)}</small></div><p class="comment-body">${formatCommentText(c.text)}</p><div class="comment-actions"><button type="button" data-comment-like="${esc(c.id)}">${mine?'♥':'♡'} ${likes.length||''}</button>${own?`<button type="button" data-comment-edit="${esc(c.id)}">Edit</button><button type="button" data-comment-delete="${esc(c.id)}">Delete</button>`:''}</div></div></div>`;
  }

  function openCommentEditModal(ticketId,commentId){
    const ticket=state.tickets.find(t=>t.id===ticketId);const c=ticket?.comments?.find(x=>x.id===commentId);if(!c)return;
    $("#confirmRoot").innerHTML=`<div class="notice-backdrop" role="dialog" aria-modal="true"><div class="notice-dialog"><div class="notice-hero"><div class="notice-icon">✎</div><div><h2>Edit comment</h2><p>Update your comment text.</p></div></div><div class="notice-body"><div class="field"><label>Comment</label><textarea id="editCommentText" style="min-height:120px">${esc(c.text)}</textarea></div></div><div class="notice-actions"><button class="btn" id="editCommentCancel" type="button">Cancel</button><button class="btn primary" id="editCommentSave" type="button">Save</button></div></div></div>`;
    const close=()=>$("#confirmRoot").innerHTML="";$("#editCommentCancel").onclick=close;attachMentionAutocomplete($("#editCommentText"));$("#editCommentSave").onclick=()=>{const text=$("#editCommentText").value.trim();if(!text)return;c.text=text;c.at=nowLabel()+' · edited';logActivity('comment',ticket,'Edited a comment');saveState();close();openTicketDetails(ticketId,{preserveStack:true,activeTab:'comments'});};
  }

  function openImportDiagnostics(stats){
    $("#confirmRoot").innerHTML=`<div class="notice-backdrop" role="dialog" aria-modal="true"><div class="notice-dialog" style="width:min(620px,100%)"><div class="notice-hero"><div class="notice-icon">CSV</div><div><h2>Import complete</h2><p>TeamFlow analyzed the file and reconciled it with the current workspace.</p></div></div><div class="notice-body"><div class="import-summary">${[['Added',stats.added],['Already existed',stats.existing||0],['New members',stats.newMembers],['New workflows',stats.newStatuses],['Skipped rows',stats.skipped],['Dates normalized',stats.dateNormalized||0]].map(x=>`<div class="import-stat"><strong>${x[1]}</strong><span>${x[0]}</span></div>`).join('')}</div></div><div class="notice-actions"><button class="btn primary" id="importDiagClose" type="button">Done</button></div></div></div>`;$("#importDiagClose").onclick=()=>$("#confirmRoot").innerHTML="";
  }

  function openCommandPalette(){
    const root=$("#confirmRoot");
    root.innerHTML=`<div class="command-backdrop"><div class="command-palette"><input id="commandSearch" class="command-input" placeholder="Search tickets or type a command…" autocomplete="off" /><div id="commandResults" class="command-results"></div></div></div>`;
    const input=$("#commandSearch");const results=$("#commandResults");
    const actions=[{icon:'＋',name:'Create ticket',hint:'New issue',run:()=>openTicketModal()},{icon:'▦',name:'Open Board',hint:'Go to board',run:()=>switchView('board')},{icon:'⌂',name:'Project Overview',hint:'Go to overview',run:()=>switchView('overview')},{icon:'≋',name:'Timeline',hint:'Open Gantt timeline',run:()=>switchView('timeline')},{icon:'◈',name:'My Work',hint:`View ${state.currentMember}`,run:()=>switchView('mywork')},{icon:'▤',name:'Documents',hint:'Open document workspace',run:()=>switchView('documents')}];
    const close=()=>root.innerHTML='';
    function render(){const q=input.value.trim().toLowerCase();const items=[];actions.filter(a=>!q||`${a.name} ${a.hint}`.toLowerCase().includes(q)).forEach(a=>items.push({type:'action',...a}));state.tickets.filter(t=>!q||`${t.id} ${t.title} ${t.assignee}`.toLowerCase().includes(q)).slice(0,15).forEach(t=>items.push({type:'ticket',icon:'▣',name:`${t.id} · ${t.title}`,hint:`${t.status} · ${t.assignee}`,ticket:t}));results.innerHTML=items.length?items.map((x,i)=>`<button class="command-item ${i===0?'active':''}" data-command-index="${i}" type="button"><span>${x.icon}</span><span><strong>${esc(x.name)}</strong><small>${esc(x.hint)}</small></span></button>`).join(''):'<div class="empty">No matches</div>';$$('[data-command-index]',results).forEach(btn=>btn.onclick=()=>{const item=items[Number(btn.dataset.commandIndex)];close();if(item.type==='ticket')openTicketDetails(item.ticket.id);else item.run();});}
    const onKey=e=>{if(e.key==='Escape'){document.removeEventListener('keydown',onKey,true);close();}};document.addEventListener('keydown',onKey,true);input.oninput=render;$(".command-backdrop",root).onclick=e=>{if(e.target===e.currentTarget){document.removeEventListener('keydown',onKey,true);close();}};render();setTimeout(()=>input.focus(),0);
  }

