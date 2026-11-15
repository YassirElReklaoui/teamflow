"use strict";

// TeamFlow modular build — generated from the verified granular API runtime.
  function loadCloudConfig(){
    try{
      const saved=JSON.parse(localStorage.getItem(CLOUD_CONFIG_KEY)||"null")||{};
      return {...TEAMFLOW_CLOUD_DEFAULTS,...saved};
    }catch(_){return {...TEAMFLOW_CLOUD_DEFAULTS};}
  }
  function saveCloudConfig(){
    try{localStorage.setItem(CLOUD_CONFIG_KEY,JSON.stringify(cloudConfig));}catch(_){}
  }
  function normalizedApiBase(value){return String(value||"").trim().replace(/\/+$/,"");}
  function apiConfigured(){return /^https:\/\//i.test(normalizedApiBase(cloudConfig.apiBaseUrl));}
  function getCloudToken(){
    try{return sessionStorage.getItem(CLOUD_SESSION_KEY)||localStorage.getItem(CLOUD_REMEMBER_KEY)||"";}catch(_){return "";}
  }
  function storeCloudToken(token,remember){
    try{
      sessionStorage.removeItem(CLOUD_SESSION_KEY);localStorage.removeItem(CLOUD_REMEMBER_KEY);
      (remember?localStorage:sessionStorage).setItem(remember?CLOUD_REMEMBER_KEY:CLOUD_SESSION_KEY,token);
    }catch(_){}
  }
  function clearCloudToken(){
    try{sessionStorage.removeItem(CLOUD_SESSION_KEY);localStorage.removeItem(CLOUD_REMEMBER_KEY);}catch(_){}
  }

  let cloudReconnectTimer=0;
  function isExpiredSessionError(err){return Number(err?.status||0)===401;}
  function isTransientServiceError(err){
    const status=Number(err?.status||0);
    return status===0||status===503||status>=500||err?.name==="TypeError";
  }
  function scheduleCloudReconnect(delay=5000){
    clearTimeout(cloudReconnectTimer);
    if(!getCloudToken())return;
    cloudReconnectTimer=setTimeout(()=>{
      if(!getCloudToken())return;
      if(cloudReady)pollCloud();
      else connectCloudWorkspace();
    },delay);
  }
  function handleTemporaryServiceFailure(err,context="TeamFlow service"){
    cloudLastError=String(err?.message||err||"Temporary service error");
    tfLogError(`${context} temporarily unavailable`,err,{cloudVersion});
    setSyncStatus("connecting","Sync · reconnecting…","Temporary server/storage problem. Your session is kept and TeamFlow will retry automatically.");
    scheduleCloudReconnect();
  }

  function ensureSyncBadge(){
    let badge=document.getElementById("cloudSyncStatus");
    if(!badge){
      badge=document.createElement("div");badge.id="cloudSyncStatus";badge.className="topbar-sync connecting";
      badge.innerHTML='<span class="dot" aria-hidden="true"></span><span class="label">Sync · sign in</span><button type="button" class="cloud-sync-check-btn" title="Check sync">↻</button>';
      (document.querySelector(".topbar")||document.body).appendChild(badge);
    }
    if(!badge.dataset.bound){badge.dataset.bound="1";badge.querySelector("button")?.addEventListener("click",()=>runCloudSyncCheck());}
    return badge;
  }
  function setSyncStatus(kind,label,title){
    const badge=ensureSyncBadge();badge.className=`topbar-sync ${kind||""}`.trim();
    const el=badge.querySelector(".label");if(el)el.textContent=label||"Sync · connected";
    badge.title=title||label||"TeamFlow sync";
    updateCloudSettingsCard();
  }

  async function cloudRequest(path,{method="GET",body,auth=true,headers={}}={}){
    if(!apiConfigured())throw Object.assign(new Error("Server URL is not configured"),{status:0});
    const token=getCloudToken();
    let response;
    try{
      response=await fetch(`${normalizedApiBase(cloudConfig.apiBaseUrl)}${path}`,{
        method,
        headers:{"Content-Type":"application/json",...(auth&&token?{Authorization:`Bearer ${token}`}:{ }),...headers},
        body:body===undefined?undefined:JSON.stringify(body),
        cache:"no-store"
      });
    }catch(fetchErr){
      const err=Object.assign(new Error("Network unavailable"),{status:0,code:"NETWORK_ERROR",cause:fetchErr});
      tfLogError("API network request failed",err,{path,method});
      throw err;
    }
    const text=await response.text();let data={};
    try{data=text?JSON.parse(text):{};}catch(err){tfLogError("API response JSON parsing failed",err,{path,status:response.status,responseText:text.slice(0,500)});data={error:text||`HTTP ${response.status}`};}
    if(!response.ok){const err=Object.assign(new Error(data.error||`HTTP ${response.status}`),{status:response.status,data});tfLogError("API request failed",err,{path,method,status:response.status});throw err;}
    return data;
  }

  function showAuthGate(message=""){
    const gate=document.getElementById("teamflowAuthGate");if(!gate)return;
    gate.classList.remove("hidden");
    document.body.classList.add("teamflow-locked");
    const apiInput=document.getElementById("tfAuthApiUrl"),wsInput=document.getElementById("tfAuthWorkspace");
    if(apiInput)apiInput.value=cloudConfig.apiBaseUrl||"";if(wsInput)wsInput.value=cloudConfig.workspaceId||"";
    hideAuthTooltip();
  }
  function hideAuthGate(){document.getElementById("teamflowAuthGate")?.classList.add("hidden");document.body.classList.remove("teamflow-locked");hideAuthTooltip();}
  let authTooltipAnchor=null;
  function hideAuthTooltip(){
    const el=document.getElementById("tfAuthTooltip");if(!el)return;clearTimeout(hideAuthTooltip.timer);el.classList.remove("show");el.classList.add("hidden");
  }
  function authStatus(message,type="",anchor=authTooltipAnchor){
    const el=document.getElementById("tfAuthTooltip");if(!el||!message||!anchor)return;
    clearTimeout(hideAuthTooltip.timer);el.textContent=message;el.dataset.type=type||"";el.classList.remove("hidden");
    const rect=anchor.getBoundingClientRect();const width=Math.min(360,Math.max(230,rect.width+70));el.style.width=`${width}px`;
    requestAnimationFrame(()=>{
      const tipRect=el.getBoundingClientRect();let left=rect.left+(rect.width-tipRect.width)/2;left=Math.max(12,Math.min(left,window.innerWidth-tipRect.width-12));
      let top=rect.bottom+10;if(top+tipRect.height>window.innerHeight-12)top=Math.max(12,rect.top-tipRect.height-10);
      const arrow=Math.max(16,Math.min(rect.left+rect.width/2-left-5,tipRect.width-26));el.style.left=`${left}px`;el.style.top=`${top}px`;el.style.setProperty("--tooltip-arrow-left",`${arrow}px`);el.classList.add("show");
    });
    hideAuthTooltip.timer=setTimeout(hideAuthTooltip,type==="error"?4200:2600);
  }
  function setSetupMode(enabled){
    document.getElementById("tfSetupPanel")?.classList.toggle("hidden",!enabled);
    document.getElementById("tfLoginPanel")?.classList.toggle("hidden",enabled);
  }
  async function checkCloudHealth({quiet=false}={}){
    if(!apiConfigured())throw new Error("Enter the Server URL first.");
    const data=await cloudRequest(`/health`,{auth:false});
    if(data.workspaceId&&cloudConfig.workspaceId&&data.workspaceId!==cloudConfig.workspaceId)throw new Error("The server belongs to a different Team ID.");
    setSetupMode(!!data.setupRequired);
    if(!quiet)authStatus(data.setupRequired?"First-time activation required. Create the first administrator account.":"Server connected. Enter your TeamFlow credentials.","ok");
    return data;
  }
  async function cloudLogin(){
    const username=document.getElementById("tfAuthUsername")?.value.trim()||"";
    const password=document.getElementById("tfAuthPassword")?.value||"";
    const remember=!!document.getElementById("tfAuthRemember")?.checked;
    if(!username||!password){authStatus(!username&&!password?"Enter your username and password to sign in.":(!username?"Enter your username to continue.":"Enter your password to continue."),"error");return;}
    if(!apiConfigured()||!String(cloudConfig.workspaceId||"").trim()){authStatus("Configure the Server URL and Workspace ID under Connection settings first.","error");return;}
    authStatus("Signing in…");
    try{
      const data=await cloudRequest("/auth/login",{method:"POST",auth:false,body:{workspaceId:cloudConfig.workspaceId,username,password,remember}});
      storeCloudToken(data.token,remember);cloudUser=data.user;hideAuthGate();
      await connectCloudWorkspace();toast(`Signed in as ${cloudUser.displayName||cloudUser.username}`);
    }catch(err){tfLogError("Authentication login failed",err,{workspaceId:cloudConfig.workspaceId||""});authStatus(err.message||"Sign-in failed","error");}
  }
  async function cloudBootstrap(){
    const setupKey=document.getElementById("tfSetupKey")?.value||"";
    const username=document.getElementById("tfSetupUsername")?.value.trim()||"";
    const displayName=document.getElementById("tfSetupDisplayName")?.value.trim()||"";
    const password=document.getElementById("tfSetupPassword")?.value||"";
    const confirm=document.getElementById("tfSetupPassword2")?.value||"";
    if(!setupKey||!username||!displayName||!password||!confirm){authStatus("Complete all activation fields before continuing.","error");return;}
    if(password!==confirm){authStatus("Passwords do not match.","error");return;}
    authStatus("Activating TeamFlow…");
    try{
      const data=await cloudRequest("/setup/bootstrap",{method:"POST",auth:false,body:{workspaceId:cloudConfig.workspaceId,setupKey,username,displayName,password,remember:true}});
      storeCloudToken(data.token,true);cloudUser=data.user;hideAuthGate();await connectCloudWorkspace();toast("TeamFlow activated");
    }catch(err){tfLogError("Workspace bootstrap failed",err,{workspaceId:cloudConfig.workspaceId||""});authStatus(err.message||"Setup failed","error");}
  }
  function saveConnectionFromGate(){
    const api=normalizedApiBase(document.getElementById("tfAuthApiUrl")?.value||"");
    const workspace=(document.getElementById("tfAuthWorkspace")?.value||"").trim();
    if(!api||!workspace){authStatus(!api&&!workspace?"Enter the Server URL and Workspace ID first.":(!api?"Enter the Server URL first.":"Enter your Workspace ID first."),"error");return;}
    cloudConfig={...cloudConfig,apiBaseUrl:api,workspaceId:workspace};saveCloudConfig();
    clearCloudToken();cloudUser=null;cloudReady=false;setSyncStatus("connecting","Sync · configured");authStatus("Connection settings saved. Testing…");
    checkCloudHealth().catch(err=>{tfLogError("Connection health check failed",err,{apiBaseUrl:normalizedApiBase(cloudConfig.apiBaseUrl),workspaceId:cloudConfig.workspaceId||""});authStatus(err.message,"error");});
  }

  function parseWorkflowSettingRecord(entry,index=0){
    let value=entry;
    if(value&&typeof value==="object"&&!Array.isArray(value)&&Object.prototype.hasOwnProperty.call(value,"json")){
      value=value.json;
    }
    if(typeof value==="string"){
      const trimmed=value.trim();
      if(trimmed.startsWith("{")&&trimmed.endsWith("}")){
        try{value=JSON.parse(trimmed);}catch(_){}
      }
    }
    if(!value||typeof value!=="object"||Array.isArray(value))return null;
    const name=String(value.name||value.status||value.workflow||"").trim();
    if(!name)return null;
    const rawOrder=value.order;
    const orderNumber=Number(rawOrder);
    const hasExplicitOrder=rawOrder!==undefined&&rawOrder!==null&&rawOrder!==""&&Number.isFinite(orderNumber);
    return {
      name,
      order:hasExplicitOrder?orderNumber:index,
      hasExplicitOrder,
      icon:String(value.icon||"").trim(),
      wip:value.wip??"",
      source:entry
    };
  }

  function extractOrderedWorkflowSettings(remote){
    const candidates=[
      ["settings",remote?.settings],
      ["settings.workflows",remote?.settings?.workflows],
      ["settings.workflowRows",remote?.settings?.workflowRows],
      ["workflowSettings",remote?.workflowSettings],
      ["workflowRows",remote?.workflowRows],
      ["settingsRows",remote?.settingsRows],
      ["workflows",remote?.workflows],
      ["statuses",remote?.statuses]
    ];
    for(const [label,source] of candidates){
      if(!Array.isArray(source)||!source.length)continue;
      const records=source.map((entry,index)=>parseWorkflowSettingRecord(entry,index)).filter(Boolean);
      if(!records.length||!records.some(record=>record.hasExplicitOrder))continue;
      records.sort((a,b)=>a.order-b.order||a.name.localeCompare(b.name));
      tfLog("info","Workflow settings loaded and sorted by stored order",{source:label,records:records.map(({name,order,icon,wip})=>({name,order,icon,wip}))});
      return {source:label,records};
    }
    return null;
  }

  function normalizeCloudState(remote){
    const next=remote&&typeof remote==="object"?clone(remote):{};
    const orderedWorkflowSettings=extractOrderedWorkflowSettings(next);
    const rawSettingsRows=Array.isArray(next.settings)?next.settings.slice():null;
    if(!Array.isArray(next.tickets))next.tickets=[];if(!Array.isArray(next.members))next.members=[];
    if(!Array.isArray(next.statuses)||!next.statuses.length)next.statuses=clone(DEFAULT_STATUSES);
    if(!Array.isArray(next.releases))next.releases=[];if(!next.releaseMeta||typeof next.releaseMeta!=="object"||Array.isArray(next.releaseMeta))next.releaseMeta={};if(!Array.isArray(next.documents))next.documents=[];
    if(!Array.isArray(next.activity))next.activity=[];if(!Array.isArray(next.favorites))next.favorites=[];if(!Array.isArray(next.recentTickets))next.recentTickets=[];
    if(!next.savedViewsByMember||typeof next.savedViewsByMember!=="object")next.savedViewsByMember={};
    if(!next.myWorkPrefsByMember||typeof next.myWorkPrefsByMember!=="object")next.myWorkPrefsByMember={};
    if(!next.fontSizeByMember||typeof next.fontSizeByMember!=="object")next.fontSizeByMember={};
    if(!next.timelinePrefs||typeof next.timelinePrefs!=="object")next.timelinePrefs={};
    if(!next.wipLimits||typeof next.wipLimits!=="object")next.wipLimits={};
    if(!next.statusIcons||typeof next.statusIcons!=="object"||Array.isArray(next.statusIcons))next.statusIcons={};
    if(!next.wipLimits||typeof next.wipLimits!=="object"||Array.isArray(next.wipLimits))next.wipLimits={};
    if(!next.settings||typeof next.settings!=="object"||Array.isArray(next.settings))next.settings={};
    if(rawSettingsRows)next.settings.workflowRows=rawSettingsRows;

    if(orderedWorkflowSettings){
      const orderedNames=orderedWorkflowSettings.records.map(record=>record.name);
      next.settings.workflowOrder=orderedNames.slice();
      next.workflowOrder=orderedNames.slice();
      next.statuses=orderedNames.slice();
      orderedWorkflowSettings.records.forEach(record=>{
        if(record.icon)next.statusIcons[record.name]=record.icon;
        if(record.wip!==undefined&&record.wip!==null)next.wipLimits[record.name]=record.wip;
      });
    }else if(!Array.isArray(next.settings.workflowOrder)||!next.settings.workflowOrder.length){
      next.settings.workflowOrder=Array.isArray(next.workflowOrder)&&next.workflowOrder.length?next.workflowOrder.slice():(Array.isArray(next.statuses)&&next.statuses.length?next.statuses.slice():clone(DEFAULT_STATUSES));
    }
    const remoteStatuses=Array.isArray(next.statuses)&&next.statuses.length?next.statuses.map(x=>String(x)).slice():clone(DEFAULT_STATUSES);
    const requestedOrder=next.settings.workflowOrder.map(x=>String(x));
    const reconciled=[];const seenWorkflow=new Set();
    requestedOrder.forEach(value=>{const name=remoteStatuses.find(x=>String(x).toLowerCase()===String(value||"").trim().toLowerCase());if(name&&!seenWorkflow.has(String(name).toLowerCase())){seenWorkflow.add(String(name).toLowerCase());reconciled.push(name);}});
    remoteStatuses.forEach(name=>{if(!seenWorkflow.has(String(name).toLowerCase())){seenWorkflow.add(String(name).toLowerCase());reconciled.push(name);}});
    next.settings.workflowOrder=reconciled.slice();
    next.workflowOrder=reconciled.slice();
    next.statuses=reconciled.slice();
    tfLog("info","Canonical workflow order after cloud normalization",{order:reconciled.slice(),source:orderedWorkflowSettings?.source||"workspace arrays"});
    next.theme=next.theme||state.theme||"light";
    next.tickets.forEach(t=>{if(!t.type)t.type="Task";if(!t.risk)t.risk="None";if(!t.blockerNote)t.blockerNote="";if(!Array.isArray(t.dependencies))t.dependencies=[];if(!Array.isArray(t.comments))t.comments=[];if(!Array.isArray(t.subtasks))t.subtasks=[];if(!Array.isArray(t.links))t.links=[];if(typeof t.archived!=="boolean")t.archived=false;t.start=normalizeDate(t.start);t.end=normalizeDate(t.end);});
    return next;
  }
  function syncCurrentMemberToAuthenticatedUser(){
    if(!cloudUser)return false;
    const username=String(cloudUser.username||"").trim().toLowerCase();
    let member=state.members.find(m=>String(m.authUsername||"").trim().toLowerCase()===username);
    let changed=false;
    // Never guess a link from display name. Imported member identities remain stable
    // until an administrator explicitly links them to an authenticated account.
    if(!member && state.members.length===0 && username){
      const displayName=String(cloudUser.displayName||cloudUser.username||"Team member").trim();
      member={id:`auth-${username}`,name:displayName,role:cloudUser.role==="admin"?"Administrator":"Team member",color:colorForName(displayName),authUsername:username};
      state.members.push(member);changed=true;
    }
    const nextName=member?.name||"";
    if(state.currentMember!==nextName){state.currentMember=nextName;changed=true;}
    return changed;
  }

  function renderAfterSharedUpdate(){
    setTheme(state.theme);ensureMemberColors();ensureAdvancedState();normalizeWorkflowOrder();applyUserFontSize();renderMemberSelects();renderBoard();renderTeam();renderStatusEditor();renderWipEditor();renderReleaseEditor();renderDocuments();renderOverview();renderTimeline();renderArchivedTickets();renderBackups();
    if(activeView==="mywork")renderMyWork();if(activeView==="insights")renderInsights();syncCustomSelects();
  }
  async function loadRemoteWorkspace({quiet=false}={}){
    try{
      const data=await cloudRequest("/workspace");cloudApplyingRemote=true;state=normalizeCloudState(data.state);cloudApplyingRemote=false;
      workflowOrderDraft=null;
      cloudVersion=Number(data.version||0);cloudLastStamp=data.updatedAt||"";cloudLastError="";
      syncCurrentMemberToAuthenticatedUser();
      cloudBaselineState=clone(state);
      tfLog('info','Shared workflow order loaded',{version:cloudVersion,order:[...(state.workflowOrder||[])]});
      const globalSearch=document.getElementById("globalSearch");if(globalSearch)globalSearch.value="";
      activeDocId=state.documents.some(d=>d.id===activeDocId)?activeDocId:(state.documents[0]?.id||null);
      renderAfterSharedUpdate();
      tfLog('info','Workspace loaded read-only; no save scheduled',{user:cloudUser?.username||'',version:cloudVersion,currentMember:state.currentMember||''});
      // IMPORTANT: loading/refreshing/syncing is read-only. Never PUT just because
      // the signed-in user's local identity differs from shared workspace state.
      if(!quiet)toast("TeamFlow updated");
      setSyncStatus("updated","Sync · updated",`Version ${cloudVersion}${cloudLastStamp?` · ${new Date(cloudLastStamp).toLocaleTimeString()}`:""}`);
      setTimeout(()=>{if(!cloudSaving)setSyncStatus("connected","Sync · connected");},1200);
      return data;
    }catch(err){
      cloudApplyingRemote=false;cloudLastError=String(err?.message||err);tfLogError("Loading shared workspace failed",err,{quiet,cloudVersion});
      if(isExpiredSessionError(err)){clearCloudToken();cloudReady=false;showAuthGate("Your TeamFlow session expired. Sign in again.");setSyncStatus("error","Sync · sign in required",cloudLastError);}
      else if(isTransientServiceError(err)){handleTemporaryServiceFailure(err,"Workspace loading");if(!quiet)toast("Connection temporarily unavailable — retrying");}
      else{setSyncStatus("error","Sync · error",cloudLastError);if(!quiet)toast("Sync unavailable");}
      return null;
    }
  }
  function jsonEqual(a,b){return JSON.stringify(a)===JSON.stringify(b);}
  function coreTicket(t){
    const copy=clone(t||{});delete copy.comments;delete copy.subtasks;delete copy.links;delete copy.dependencies;delete copy.history;return copy;
  }
  function mapBy(items,keyFn){const m=new Map();(items||[]).forEach((v,i)=>m.set(String(keyFn(v,i)),v));return m;}
  function changedFields(before,after,blocked=[]){
    const out={},keys=new Set([...Object.keys(before||{}),...Object.keys(after||{})]);
    keys.forEach(k=>{if(blocked.includes(k))return;if(!jsonEqual(before?.[k],after?.[k]))out[k]=after?.[k]});return out;
  }
  function linkKey(ticketId,link,index){return `${ticketId}__${link?.id||spHash(`${link?.url||''}|${link?.title||''}|${index}`)}`;}
  function buildMinimalMutations(before,after){
    const ops=[];
    before=before||{};after=after||{};

    const bt=mapBy(before.tickets,t=>t.id), at=mapBy(after.tickets,t=>t.id);
    at.forEach((t,id)=>{
      if(!bt.has(id)) ops.push({type:'ticket.create',id,value:coreTicket(t)});
      else {const changes=changedFields(coreTicket(bt.get(id)),coreTicket(t),['id']);if(Object.keys(changes).length)ops.push({type:'ticket.patch',id,changes});}
    });
    bt.forEach((_,id)=>{if(!at.has(id))ops.push({type:'ticket.delete',id});});

    function diffChildren(kind,prop,keyFn,wrap){
      const b=new Map(),a=new Map();
      (before.tickets||[]).forEach(t=>(t[prop]||[]).forEach((v,i)=>b.set(keyFn(t,v,i),wrap(t,v))));
      (after.tickets||[]).forEach(t=>(t[prop]||[]).forEach((v,i)=>a.set(keyFn(t,v,i),wrap(t,v))));
      a.forEach((v,id)=>{if(!b.has(id)||!jsonEqual(b.get(id),v))ops.push({type:`${kind}.upsert`,id,value:v});});
      b.forEach((_,id)=>{if(!a.has(id))ops.push({type:`${kind}.delete`,id});});
    }
    diffChildren('comment','comments',(t,c,i)=>`${t.id}__${c.id||spHash(JSON.stringify(c)+i)}`,(t,c)=>({ticketId:t.id,comment:c}));
    diffChildren('checklist','subtasks',(t,s,i)=>`${t.id}__${s.id||spHash(JSON.stringify(s)+i)}`,(t,s)=>({ticketId:t.id,item:s}));
    diffChildren('doclink','links',(t,l,i)=>linkKey(t.id,l,i),(t,l)=>({ticketId:t.id,link:l}));
    diffChildren('dependency','dependencies',(t,d)=>`${t.id}__${d}`,(t,d)=>({ticketId:t.id,dependsOn:d}));

    const bm=mapBy(before.members,m=>m.id||m.email||spHash(m.name||'')), am=mapBy(after.members,m=>m.id||m.email||spHash(m.name||''));
    am.forEach((m,id)=>{if(!bm.has(id)||!jsonEqual(bm.get(id),m))ops.push({type:'member.upsert',id,value:m});});
    bm.forEach((_,id)=>{if(!am.has(id))ops.push({type:'member.delete',id});});

    const br=mapBy(before.releases,(r,i)=>typeof r==='string'?spHash(r):(r.id||spHash(r.name||String(i)))), ar=mapBy(after.releases,(r,i)=>typeof r==='string'?spHash(r):(r.id||spHash(r.name||String(i))));
    ar.forEach((r,id)=>{
      const name=typeof r==='string'?r:r.name;
      const meta=(after.releaseMeta&&after.releaseMeta[name])||{};
      const value=typeof r==='string'?{name:r,order:(after.releases||[]).indexOf(r),visibility:meta.visibility||'active'}:{...r,visibility:r.visibility||meta.visibility||'active'};
      const beforeRaw=br.get(id);
      const beforeName=typeof beforeRaw==='string'?beforeRaw:beforeRaw?.name;
      const beforeMeta=(before.releaseMeta&&before.releaseMeta[beforeName])||{};
      const beforeValue=beforeRaw===undefined?undefined:(typeof beforeRaw==='string'?{name:beforeRaw,order:(before.releases||[]).indexOf(beforeRaw),visibility:beforeMeta.visibility||'active'}:{...beforeRaw,visibility:beforeRaw.visibility||beforeMeta.visibility||'active'});
      if(!br.has(id)||!jsonEqual(beforeValue,value))ops.push({type:'release.upsert',id,value});
    });
    br.forEach((_,id)=>{if(!ar.has(id))ops.push({type:'release.delete',id});});

    const bd=mapBy((before.documents||[]).filter(d=>d.kind!=='pdf-local'),d=>d.id||spHash(d.name||'')), ad=mapBy((after.documents||[]).filter(d=>d.kind!=='pdf-local'),d=>d.id||spHash(d.name||''));
    ad.forEach((d,id)=>{const value=clone(d);delete value.runtimeUrl;if(!bd.has(id)||!jsonEqual(bd.get(id),d))ops.push({type:'document.upsert',id,value});});
    bd.forEach((_,id)=>{if(!ad.has(id))ops.push({type:'document.delete',id});});

    const ba=mapBy(before.activity,a=>a.id), aa=mapBy(after.activity,a=>a.id);
    aa.forEach((a,id)=>{if(id&&(!ba.has(id)||!jsonEqual(ba.get(id),a)))ops.push({type:'activity.upsert',id,value:a});});

    // Workflow identity/icon/WIP may change only through admin UI actions.
    // ORDER is intentionally excluded here and can only be sent by Save workflow order.
    if(cloudUser?.role==='admin'){
      const bs=new Set(before.statuses||[]),as=new Set(after.statuses||[]);
      (after.statuses||[]).forEach(name=>{
        const id=spHash(name),oldIcon=before.statusIcons?.[name]||'',newIcon=after.statusIcons?.[name]||'',oldWip=before.wipLimits?.[name]||'',newWip=after.wipLimits?.[name]||'';
        if(!bs.has(name)||oldIcon!==newIcon||String(oldWip)!==String(newWip))ops.push({type:'workflow.upsert',id,value:{name,icon:newIcon,wip:newWip}});
      });
      (before.statuses||[]).forEach(name=>{if(!as.has(name))ops.push({type:'workflow.delete',id:spHash(name)});});
    }

    const userFields=['theme','favorites','recentTickets','savedViewsByMember','myWorkPrefsByMember','fontSizeByMember','timelinePrefs'];
    const userChanges={};userFields.forEach(k=>{if(!jsonEqual(before?.[k],after?.[k]))userChanges[k]=clone(after?.[k]);});
    if(Object.keys(userChanges).length)ops.push({type:'userState.patch',changes:userChanges});
    return ops;
  }

  let sharedDraftDepth=0;
  let sharedDraftPendingSave=false;

  function beginSharedDraft(){
    sharedDraftDepth+=1;
    tfLog('info','Shared draft started',{depth:sharedDraftDepth});
  }

  function endSharedDraft({commit=false}={}){
    sharedDraftDepth=Math.max(0,sharedDraftDepth-1);
    tfLog('info','Shared draft ended',{depth:sharedDraftDepth,commit,pending:sharedDraftPendingSave});
    if(sharedDraftDepth>0)return;
    if(commit&&sharedDraftPendingSave){
      sharedDraftPendingSave=false;
      scheduleRemoteSave({force:true});
    }else if(!commit){
      sharedDraftPendingSave=false;
    }
  }

  function sharedDraftActive(){return sharedDraftDepth>0;}

  async function saveMinimalChanges(){
    if(!cloudReady||cloudApplyingRemote||deltaSaving)return false;
    const snapshot=clone(state);
    const operations=buildMinimalMutations(cloudBaselineState||{},snapshot);
    if(!operations.length){deltaDirty=false;return true;}
    deltaSaving=true;deltaDirty=false;setSyncStatus('saving','Sync · saving…');
    try{
      tfLog('info','Sending minimal mutations',{count:operations.length,operations:operations.map(o=>({type:o.type,id:o.id,fields:o.changes?Object.keys(o.changes):undefined}))});
      const result=await cloudRequest('/mutations',{method:'POST',body:{operations}});
      cloudVersion=Number(result.version||cloudVersion);cloudLastStamp=result.updatedAt||new Date().toISOString();cloudLastError='';
      cloudBaselineState=snapshot;
      setSyncStatus('saved','Sync · saved',`Version ${cloudVersion} · ${operations.length} change${operations.length===1?'':'s'}`);
      setTimeout(()=>{if(!deltaSaving)setSyncStatus('connected','Sync · connected');},900);
      return true;
    }catch(err){
      cloudLastError=String(err?.message||err);tfLogError('Minimal mutation save failed',err,{operations});
      if(isExpiredSessionError(err)){clearCloudToken();cloudReady=false;showAuthGate('Your session expired. Sign in again.');setSyncStatus('error','Sync · sign in required',cloudLastError);}
      else if(isTransientServiceError(err)){
        deltaDirty=true;
        handleTemporaryServiceFailure(err,'Saving changes');
        setTimeout(()=>{if(getCloudToken()&&cloudReady)scheduleRemoteSave({force:true});},4500);
      }else{setSyncStatus('error','Sync · save failed',cloudLastError);toast('Could not save changes — see Console');}
      return false;
    }finally{deltaSaving=false;if(deltaDirty&&cloudReady){deltaDirty=false;scheduleRemoteSave();}}
  }
  function saveRemoteWorkspace(){return saveMinimalChanges();}
  function scheduleRemoteSave({force=false}={}){
    if(!cloudReady||cloudApplyingRemote)return;
    if(sharedDraftActive()&&!force){
      sharedDraftPendingSave=true;
      tfLog('info','Remote save held by open ticket draft');
      return;
    }
    deltaDirty=true;clearTimeout(deltaSaveTimer);deltaSaveTimer=setTimeout(()=>saveMinimalChanges(),450);
  }
  async function bulkPatchTickets(ticketIds,changes){
    const ids=[...new Set((ticketIds||[]).map(id=>String(id||'').trim()).filter(Boolean))];
    const patch=Object.fromEntries(Object.entries(changes||{}).filter(([,v])=>v!==undefined));
    if(!ids.length)throw new Error('Select at least one ticket');
    if(!Object.keys(patch).length)throw new Error('Choose at least one field to update');
    if(!cloudReady)throw Object.assign(new Error('TeamFlow is not connected'),{status:0});
    setSyncStatus('saving','Sync · bulk updating…',`${ids.length} tickets`);
    try{
      tfLog('info','Sending one bulk ticket patch',{count:ids.length,fields:Object.keys(patch)});
      const result=await cloudRequest('/tickets/bulk',{method:'PATCH',body:{ticketIds:ids,changes:patch}});
      for(const ticket of (state.tickets||[])){
        if(!ids.includes(String(ticket.id)))continue;
        Object.assign(ticket,patch);
        if(Object.prototype.hasOwnProperty.call(patch,'progress'))ticket.progress=normalizeProgress(patch.progress);
      }
      cloudVersion=Number(result.version||cloudVersion);
      cloudLastStamp=result.updatedAt||new Date().toISOString();
      cloudLastError='';
      cloudBaselineState=clone(state);
      deltaDirty=false;
      setSyncStatus('saved','Sync · bulk saved',`${Number(result.updated||ids.length)} tickets · version ${cloudVersion}`);
      setTimeout(()=>{if(!deltaSaving)setSyncStatus('connected','Sync · connected');},900);
      return result;
    }catch(err){
      cloudLastError=String(err?.message||err);
      tfLogError('Bulk ticket update failed',err,{count:ids.length,fields:Object.keys(patch)});
      if(isExpiredSessionError(err)){
        clearCloudToken();cloudReady=false;showAuthGate('Your session expired. Sign in again.');setSyncStatus('error','Sync · sign in required',cloudLastError);
      }else if(isTransientServiceError(err)){
        handleTemporaryServiceFailure(err,'Bulk update');
      }else{
        setSyncStatus('error','Sync · bulk update failed',cloudLastError);
      }
      throw err;
    }
  }

  async function pollCloud(){
    if(document.hidden||deltaSaving||cloudApplyingRemote||deltaDirty||!cloudReady)return;
    try{const info=await cloudRequest(`/changes?since=${encodeURIComponent(cloudVersion)}`);if(info.changed){const loaded=await loadRemoteWorkspace({quiet:true});if(loaded)window.teamFlowNotificationsOnVersionChanged?.(info);}}
    catch(err){
      cloudLastError=String(err?.message||err);tfLogError("Cloud polling failed",err,{cloudVersion});
      if(isExpiredSessionError(err)){clearCloudToken();cloudReady=false;showAuthGate("Your session expired. Sign in again.");setSyncStatus("error","Sync · sign in required",cloudLastError);}
      else if(isTransientServiceError(err)){handleTemporaryServiceFailure(err,"Cloud polling");}
      else setSyncStatus("error","Sync · error",cloudLastError);
    }
  }
  async function connectCloudWorkspace(){
    setSyncStatus("connecting","Sync · connecting…");
    try{
      const me=await cloudRequest("/auth/me");cloudUser=me.user;cloudReady=true;
      const loaded=await loadRemoteWorkspace({quiet:true});if(!loaded)throw new Error(cloudLastError||"Could not load workspace");
      if(cloudUser?.role==="admin")await loadBackups({quiet:true});
      setSyncStatus("connected","Sync · connected",`Signed in as ${cloudUser.displayName||cloudUser.username}`);
      clearInterval(cloudPollTimer);cloudPollTimer=setInterval(pollCloud,Number(cloudConfig.pollMs||300000));
      updateCloudSettingsCard();
      window.teamFlowNotificationsOnConnected?.();
    }catch(err){
      tfLogError("Connecting to shared workspace failed",err);cloudReady=false;
      if(isExpiredSessionError(err)){clearCloudToken();showAuthGate("Your session expired. Sign in again.");setSyncStatus("error","Sync · sign in required",String(err?.message||err));}
      else if(isTransientServiceError(err)){hideAuthGate();handleTemporaryServiceFailure(err,"Connection");}
      else{showAuthGate(err.message||"Sign in to TeamFlow");setSyncStatus("error","Sync · connection failed",String(err?.message||err));}
    }
  }
  async function runCloudSyncCheck(){
    ensureSyncBadge();setSyncStatus("connecting","Sync · checking…");
    try{
      const health=await checkCloudHealth({quiet:true});
      if(!getCloudToken()){setSyncStatus("error","Sync · sign in required","API is reachable but no TeamFlow session is active.");showAuthGate("API is reachable. Sign in to continue.");return;}
      const me=await cloudRequest("/auth/me");const changes=await cloudRequest(`/changes?since=${encodeURIComponent(cloudVersion)}`);
      console.table([{API:normalizedApiBase(cloudConfig.apiBaseUrl),Workspace:health.workspaceId,User:me.user?.username,Role:me.user?.role,Version:changes.version,Changed:changes.changed}]);
      setSyncStatus("connected","Sync · connected",`Server, authentication and shared storage are reachable. Version ${changes.version}.`);toast("Connection check passed");
    }catch(err){cloudLastError=String(err?.message||err);setSyncStatus("error","Sync · check failed",cloudLastError);tfLogError("Connection check failed",err,{apiBaseUrl:normalizedApiBase(cloudConfig.apiBaseUrl),workspaceId:cloudConfig.workspaceId||""});toast("Connection check failed — see Console");}
  }
  window.teamFlowSyncCheck=runCloudSyncCheck;window.teamFlowConnectionCheck=runCloudSyncCheck;

  async function cloudLogout(){
    try{if(getCloudToken())await cloudRequest("/auth/logout",{method:"POST"});}catch(err){tfLogError("Logout request failed",err);}
    clearCloudToken();cloudUser=null;cloudReady=false;clearInterval(cloudPollTimer);state=emptySecureState();renderAfterSharedUpdate();showAuthGate("Signed out. Shared data was removed from this browser view.");setSyncStatus("connecting","Sync · sign in");
  }
  function emptySecureState(){return {tickets:[],members:[],statuses:clone(DEFAULT_STATUSES),releases:[],releaseMeta:{},theme:state?.theme||"light",currentMember:"",documents:[],activity:[],favorites:[],recentTickets:[],savedViewsByMember:{},myWorkPrefsByMember:{},wipLimits:{},fontSizeByMember:state?.fontSizeByMember||{},statusIcons:{},timelinePrefs:{},settings:{workflowOrder:clone(DEFAULT_STATUSES)},workflowOrder:clone(DEFAULT_STATUSES)};}

  function updateCloudSettingsCard(){
    const apiEl=document.getElementById("cloudSettingsApi"),wsEl=document.getElementById("cloudSettingsWorkspace"),userEl=document.getElementById("cloudSettingsUser"),stateEl=document.getElementById("cloudSettingsState"),manage=document.getElementById("cloudManageUsers");
    if(apiEl)apiEl.textContent=apiConfigured()?normalizedApiBase(cloudConfig.apiBaseUrl):"Not configured";
    if(wsEl)wsEl.textContent=cloudConfig.workspaceId||"—";
    if(userEl)userEl.textContent=cloudUser?`${cloudUser.displayName||cloudUser.username} · ${cloudUser.role}`:"Signed out";
    if(stateEl)stateEl.textContent=cloudReady?`Connected · v${cloudVersion}`:"Disconnected";
    const isAdmin=cloudUser?.role==="admin";
    if(manage)manage.style.display=isAdmin?"inline-flex":"none";
    [document.getElementById("addStatus"),document.getElementById("addWorkflowStep"),document.getElementById("settingsBackupShortcut"),document.getElementById("createBackupNow")].forEach(el=>{if(el)el.style.display=isAdmin?"inline-flex":"none";});
    const settingsView=document.getElementById("settingsView");if(settingsView)settingsView.classList.toggle("is-non-admin",!isAdmin);
    const localDataCard=document.querySelector("#settingsView .local-settings");if(localDataCard)localDataCard.style.display=isAdmin?"":"none";
    const nameInput=document.getElementById("newStatusName");if(nameInput)nameInput.disabled=!isAdmin;
  }

  async function openCloudUsersModal(options={}){
    if(cloudUser?.role!=="admin"){toast("Administrator access required");return;}
    let users=[];try{users=(await cloudRequest("/admin/users")).users||[];}catch(err){tfLogError("Loading member access list failed",err);toast(err.message);return;}
    const root=document.getElementById("modalRoot");
    root.innerHTML=`<div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="TeamFlow member access"><div class="modal access-manager"><div class="modal-head"><div><h2>Team access</h2><div class="note">Create sign-in accounts, set roles and control who can access this TeamFlow workspace.</div></div><button id="closeCloudUsers" class="modal-close" type="button">×</button></div><div class="modal-body"><div class="access-manager-layout"><section class="access-create-panel"><div class="access-panel-title"><h3>Add or update member</h3></div><div class="form-grid"><div class="field"><label>Username</label><input id="cloudUserName" autocomplete="off" placeholder="e.g. john.smith" /></div><div class="field"><label>Display name</label><input id="cloudUserDisplay" autocomplete="off" placeholder="Full name" /></div><div class="field"><label>Role</label><select id="cloudUserRole"><option value="member">Member</option><option value="admin">Administrator</option></select></div><div class="field"><label>Password</label><input id="cloudUserPassword" type="password" autocomplete="new-password" placeholder="Min. 10 characters" /></div></div><div class="note" style="margin:9px 0 13px">For an existing account, leave Password blank to keep the current password.</div><button id="cloudSaveUser" class="btn primary" type="button">＋ Save member</button></section><section class="access-members-panel"><div class="access-panel-title"><h3>Members with access</h3><span class="note" id="cloudUsersCount"></span></div><div id="cloudUsersList" class="access-member-list"></div></section></div></div></div></div>`;
    const prefill=options.prefill||{};
    if(prefill.username)document.getElementById("cloudUserName").value=prefill.username;
    if(prefill.displayName)document.getElementById("cloudUserDisplay").value=prefill.displayName;
    if(prefill.role)document.getElementById("cloudUserRole").value=prefill.role;
    const renderUsers=()=>{
      const box=document.getElementById("cloudUsersList"),count=document.getElementById("cloudUsersCount");if(!box)return;if(count)count.textContent=`${users.length} account${users.length===1?"":"s"}`;
      box.innerHTML=users.map(u=>`<div class="access-member-card" style="--member-color:${memberColor(u.displayName||u.username)}"><span class="access-member-avatar">${initials(u.displayName||u.username)}</span><div class="access-member-copy"><strong>${esc(u.displayName||u.username)}</strong><small>@${esc(u.username)}</small><span class="access-role-badge ${u.active?"":"disabled"}">${u.active?esc(u.role==="admin"?"Administrator":"Member"):"Disabled"}</span></div><div class="access-member-actions"><button class="btn small cloud-edit-user" data-user="${esc(u.username)}" type="button">Edit</button><button class="btn small cloud-toggle-user" data-user="${esc(u.username)}" data-active="${u.active?"1":"0"}" type="button">${u.active?"Disable":"Enable"}</button></div></div>`).join("")||'<div class="note">No accounts yet.</div>';
      box.querySelectorAll(".cloud-edit-user").forEach(btn=>btn.addEventListener("click",()=>{const u=users.find(x=>x.username===btn.dataset.user);if(!u)return;document.getElementById("cloudUserName").value=u.username||"";document.getElementById("cloudUserDisplay").value=u.displayName||"";document.getElementById("cloudUserRole").value=u.role||"member";document.getElementById("cloudUserPassword").value="";document.getElementById("cloudUserDisplay").focus();}));
      box.querySelectorAll(".cloud-toggle-user").forEach(btn=>btn.addEventListener("click",async()=>{const u=users.find(x=>x.username===btn.dataset.user);if(!u)return;try{const data=await cloudRequest("/admin/users",{method:"POST",body:{username:u.username,displayName:u.displayName,role:u.role,active:btn.dataset.active!=="1"}});users=data.users||[];renderUsers();toast(u.active?"Member disabled":"Member enabled");}catch(err){tfLogError("Updating member active state failed",err,{username:u.username});toast(err.message);}}));
    };
    renderUsers();
    document.getElementById("closeCloudUsers")?.addEventListener("click",()=>root.innerHTML="");root.querySelector(".modal-backdrop")?.addEventListener("click",e=>{if(e.target===e.currentTarget)root.innerHTML="";});
    document.getElementById("cloudSaveUser")?.addEventListener("click",async()=>{
      const username=document.getElementById("cloudUserName")?.value.trim()||"",displayName=document.getElementById("cloudUserDisplay")?.value.trim()||"",role=document.getElementById("cloudUserRole")?.value||"member",password=document.getElementById("cloudUserPassword")?.value||"";
      try{
        const data=await cloudRequest("/admin/users",{method:"POST",body:{username,displayName,role,password,active:true}});users=data.users||[];
        const normalizedUsername=username.toLowerCase();
        if(options.linkMemberId){
          const member=state.members.find(m=>m.id===options.linkMemberId);
          if(!member)throw new Error("The Team member to link no longer exists.");
          const other=state.members.find(m=>m.id!==member.id&&String(m.authUsername||"").toLowerCase()===normalizedUsername);
          if(other)throw new Error(`@${username} is already linked to ${other.name}.`);
          member.authUsername=normalizedUsername;
          saveState();syncCurrentMemberToAuthenticatedUser();renderTeam();renderMemberSelects();refreshDataViews();
          root.innerHTML="";toast(`${member.name} linked to @${username}`);return;
        }
        const memberName=displayName||username;let member=state.members.find(m=>String(m.authUsername||"").toLowerCase()===normalizedUsername);
        if(!member){state.members.push({id:`auth-${normalizedUsername}`,name:memberName,role:role==="admin"?"Administrator":"Team member",color:colorForName(memberName),authUsername:normalizedUsername});saveState();renderTeam();renderMemberSelects();}
        document.getElementById("cloudUserName").value="";document.getElementById("cloudUserDisplay").value="";document.getElementById("cloudUserPassword").value="";document.getElementById("cloudUserRole").value="member";renderUsers();toast("Member access saved");
      }catch(err){tfLogError("Saving member access failed",err,{username});toast(err.message);}
    });
  }

  function bindCloudUi(){
    const saveConnectionBtn=document.getElementById("tfAuthSaveConnection"),testConnectionBtn=document.getElementById("tfAuthTestConnection"),loginBtn=document.getElementById("tfLoginButton"),setupBtn=document.getElementById("tfSetupButton");
    saveConnectionBtn?.addEventListener("click",()=>{authTooltipAnchor=saveConnectionBtn;saveConnectionFromGate();});
    testConnectionBtn?.addEventListener("click",()=>{authTooltipAnchor=testConnectionBtn;saveConnectionFromGate();});
    loginBtn?.addEventListener("click",()=>{authTooltipAnchor=loginBtn;cloudLogin();});
    document.getElementById("tfAuthPassword")?.addEventListener("keydown",e=>{if(e.key==="Enter"){authTooltipAnchor=loginBtn;cloudLogin();}});
    setupBtn?.addEventListener("click",()=>{authTooltipAnchor=setupBtn;cloudBootstrap();});
    document.getElementById("tfShowLogin")?.addEventListener("click",()=>setSetupMode(false));
    document.getElementById("cloudTestConnection")?.addEventListener("click",runCloudSyncCheck);
    document.getElementById("cloudLogout")?.addEventListener("click",cloudLogout);
    document.getElementById("cloudManageUsers")?.addEventListener("click",openCloudUsersModal);
    const profileBtn=document.getElementById("viewAsAvatarBtn");profileBtn?.addEventListener("click",openPersonalProfileModal);profileBtn?.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openPersonalProfileModal();}});
  }

  async function initCloudSync(){
    bindCloudUi();ensureSyncBadge();updateCloudSettingsCard();
    const token=getCloudToken();
    if(!token){showAuthGate();if(apiConfigured())checkCloudHealth({quiet:true}).then(h=>setSetupMode(!!h.setupRequired)).catch(()=>{});return;}
    hideAuthGate();await connectCloudWorkspace();
    document.addEventListener("visibilitychange",()=>{if(!document.hidden)pollCloud();});
  }

  let serverBackups=[];
  function getBackups(){return serverBackups;}
  async function loadBackups({quiet=true}={}){
    if(!cloudReady||cloudUser?.role!=="admin"){serverBackups=[];return serverBackups;}
    try{const data=await cloudRequest('/admin/backups');serverBackups=Array.isArray(data.backups)?data.backups:[];return serverBackups;}
    catch(err){if(!quiet)tfLogError('Loading backups failed',err);return serverBackups;}
  }
  async function createWorkspaceBackup(label='Manual backup'){
    if(cloudUser?.role!=="admin"){toast('Administrator access required');return null;}
    try{setSyncStatus('saving','Backup · creating…');const data=await cloudRequest('/admin/backups',{method:'POST',body:{label}});serverBackups=Array.isArray(data.backups)?data.backups:serverBackups;renderBackups();renderSettingsSummary();setSyncStatus('connected','Sync · connected');toast('Workspace backup created');return data.backup||null;}
    catch(err){tfLogError('Creating workspace backup failed',err);setSyncStatus('error','Backup · failed',err.message);toast('Backup could not be created');return null;}
  }
  async function restoreWorkspaceBackup(id){
    if(cloudUser?.role!=="admin")throw new Error('Administrator access required');
    const result=await cloudRequest(`/admin/backups/${encodeURIComponent(id)}/restore`,{method:'POST'});
    cloudVersion=Number(result.version||cloudVersion);cloudLastStamp=result.updatedAt||new Date().toISOString();
    await loadRemoteWorkspace({quiet:true});await loadBackups({quiet:true});renderBackups();renderSettingsSummary();return result;
  }
  async function clearSharedWorkspace(){
    if(cloudUser?.role!=="admin")throw Object.assign(new Error("Administrator access required"),{status:403});
    const result=await cloudRequest('/admin/workspace',{method:'DELETE'});
    cloudVersion=Number(result.version||cloudVersion);cloudLastStamp=result.updatedAt||new Date().toISOString();
    await loadRemoteWorkspace({quiet:true});
    return result;
  }
  function rememberPreviousState(){/* Shared data is intentionally not persisted in browser storage. */}
  function saveState(){
    let localOk=true;
    try{
      localStorage.setItem(STORAGE_KEY,JSON.stringify({theme:state.theme||"light",fontSizeByMember:state.fontSizeByMember||{},timelinePrefs:state.timelinePrefs||{}}));
      storageAvailable=true;
    }catch(err){storageAvailable=false;localOk=false;tfLogError("Saving local TeamFlow preferences failed",err);}
    scheduleRemoteSave();
    return localOk||cloudReady;
  }

