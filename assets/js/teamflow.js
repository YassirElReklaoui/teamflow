(function(){
  "use strict";

  const STORAGE_KEY = "teamflow-single-html-v3-clean";
  const BACKUP_KEY = "teamflow-backups-v2-clean";
  const DEFAULT_STATUSES = ["To be started","Ongoing","On hold","Code Review","Done","Deployed on SIT","Deprecated"];
  const WORKFLOW_ICON_LIBRARY = {
    play:{label:"Play",path:'<path d="M9 7.5 16 12l-7 4.5z"/>'},
    pulse:{label:"Activity",path:'<path d="M3.5 12h3l2-5 3.5 10 2.4-6 1.8 3H21"/>'},
    pause:{label:"Pause",path:'<path d="M9 7v10M15 7v10"/>'},
    code:{label:"Code",path:'<path d="m9 8-4 4 4 4M15 8l4 4-4 4M13 6l-2 12"/>'},
    check:{label:"Check",path:'<path d="m7 12 3 3 7-7"/>'},
    rocket:{label:"Deploy",path:'<path d="M12 3c3 2 5 5 5 8l-5 3-5-3c0-3 2-6 5-8Z"/><path d="M9 14l-2 4 5-2 5 2-2-4"/>'},
    archive:{label:"Archive",path:'<path d="M6 7h12M9 7V5h6v2M8 10v7M12 10v7M16 10v7M7 7l1 13h8l1-13"/>'},
    clock:{label:"Clock",path:'<circle cx="12" cy="12" r="7"/><path d="M12 8v4l3 2"/>'},
    eye:{label:"Review",path:'<path d="M3.5 12s3-5 8.5-5 8.5 5 8.5 5-3 5-8.5 5-8.5-5-8.5-5Z"/><circle cx="12" cy="12" r="2.2"/>'},
    shield:{label:"Shield",path:'<path d="M12 3 19 6v5c0 4.6-3 7.7-7 10-4-2.3-7-5.4-7-10V6l7-3Z"/><path d="m9 12 2 2 4-4"/>'},
    flag:{label:"Flag",path:'<path d="M5 20V5m0 1h10l-1 4 1 4H5"/>'},
    database:{label:"Database",path:'<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>'},
    star:{label:"Star",path:'<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>'},
    circle:{label:"General",path:'<circle cx="12" cy="12" r="7"/><path d="M12 8v8M8 12h8"/>'}
  };
  const DEFAULT_STATUS_ICONS = {
    "To be started":"play","Ongoing":"pulse","On hold":"pause","Code Review":"code",
    "Done":"check","Deployed on SIT":"rocket","Deprecated":"archive"
  };
  const DEFAULT_RELEASES = [];
  const MEMBER_COLOR_PALETTE = ["#7c3aed","#0ea5e9","#14b8a6","#f97316","#ec4899","#84cc16","#06b6d4","#eab308","#ef4444","#6366f1","#8b5cf6","#10b981"];
  const TICKET_TEMPLATES = {
    "Task":{priority:"Medium",area:"BE",labels:["Task"]},
    "Bug":{priority:"High",area:"BE",labels:["Bug"],description:"Problem / impact:\n\nSteps / evidence:\n\nExpected result:"},
    "Development":{priority:"Medium",area:"BE",labels:["Development"],description:"Implementation scope:\n\nAcceptance criteria:"},
    "Deployment":{priority:"High",area:"QA",labels:["Deploy"],description:"Deployment scope:\n\nPre-checks:\n\nValidation / rollback:"},
    "Testing":{priority:"Medium",area:"QA",labels:["QA"],description:"Test scope:\n\nExpected result:\n\nEvidence:"},
    "Documentation":{priority:"Low",area:"FE",labels:["Docs"],description:"Document / chapter to update:\n\nRequired change:"}
  };
  const DEFAULT_MEMBERS = [];
  const DEFAULT_TICKETS = [];

  const $ = (s,root=document) => root.querySelector(s);
  const $$ = (s,root=document) => Array.from(root.querySelectorAll(s));
  const clone = obj => JSON.parse(JSON.stringify(obj));


  /* -------------------------------------------------------------------------
     TeamFlow diagnostics
     Keep user-facing messages concise while preserving technical details in
     DevTools so failures can be diagnosed without changing the UI flow.
     ------------------------------------------------------------------------- */
  const TF_LOG_PREFIX = "[TeamFlow]";

  function tfLog(level,context,details){
    const method=console[level] || console.log;
    const stamp=new Date().toISOString();
    if(details===undefined) method.call(console,`${TF_LOG_PREFIX} ${stamp} ${context}`);
    else method.call(console,`${TF_LOG_PREFIX} ${stamp} ${context}`,details);
  }

  function tfLogError(context,error,extra){
    const err=error instanceof Error ? error : new Error(String(error ?? "Unknown error"));
    const details={
      name:err.name,
      message:err.message,
      stack:err.stack,
      ...(extra&&typeof extra==="object"?extra:{})
    };
    tfLog("error",context,details);
    return err;
  }

  window.addEventListener("error",event=>{
    tfLogError("Uncaught JavaScript error",event.error || event.message,{
      source:event.filename||"",
      line:event.lineno||0,
      column:event.colno||0
    });
  });

  window.addEventListener("unhandledrejection",event=>{
    tfLogError("Unhandled promise rejection",event.reason);
  });

  function esc(v){
    return String(v == null ? "" : v).replace(/[&<>"']/g, ch => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    })[ch]);
  }

  function loadState(){
    let prefs={};
    try{prefs=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null")||{};}catch(_){}
    return {
      tickets:[],members:[],statuses:clone(DEFAULT_STATUSES),releases:[],documents:[],activity:[],favorites:[],recentTickets:[],
      theme:prefs.theme||"light",currentMember:"",savedViewsByMember:{},myWorkPrefsByMember:{},wipLimits:{},
      fontSizeByMember:prefs.fontSizeByMember&&typeof prefs.fontSizeByMember==="object"?prefs.fontSizeByMember:{},statusIcons:{},timelinePrefs:prefs.timelinePrefs&&typeof prefs.timelinePrefs==="object"?prefs.timelinePrefs:{},settings:{workflowOrder:clone(DEFAULT_STATUSES)},workflowOrder:clone(DEFAULT_STATUSES)
    };
  }

  let state = loadState();
  if(!Array.isArray(state.documents)) state.documents=[];
  if(!Array.isArray(state.statuses) || !state.statuses.length) state.statuses=clone(DEFAULT_STATUSES);
  if(!Array.isArray(state.members)) state.members=[];
  ensureMemberColors();
  if(!Array.isArray(state.releases)) state.releases=[];
  if(!state.members.some(m=>m.name===state.currentMember)) state.currentMember=state.members[0]?.name||"";
  if(!state.myWorkPrefsByMember || typeof state.myWorkPrefsByMember!=="object" || Array.isArray(state.myWorkPrefsByMember)) state.myWorkPrefsByMember={};
  // Migrate the older single My Work preference to the currently selected member once.
  if(state.myWorkPrefs && typeof state.myWorkPrefs==="object" && !Array.isArray(state.myWorkPrefs)){
    const current=state.members.find(m=>m.name===state.currentMember) || state.members[0];
    if(current && !state.myWorkPrefsByMember[current.id]) state.myWorkPrefsByMember[current.id]=clone(state.myWorkPrefs);
    delete state.myWorkPrefs;
  }
  state.tickets.forEach(t=>{
    if(!t.type) t.type="Task";
    if(!t.release) t.release=t.sprint||state.releases[0]||"";
    if(!t.risk) t.risk="None";
    if(!t.blockerNote) t.blockerNote="";
    if(!Array.isArray(t.dependencies)) t.dependencies=[];
  });
  let activeDocId = state.documents[0]?.id || null;
  let runtimeDocUrls = new Map();
  let quickMode = "clear";
  let activeView = "overview";
  let lastToday = localTodayISO();
  let ticketDetailStack = [];
  let bulkMode = false;
  let bulkSelected = new Set();
  let selectedReleaseReadiness = "";
  let workflowOrderDraft = null;

  let storageAvailable = true;

  /* -------------------------------------------------------------------------
     TeamFlow secure shared synchronization
     ------------------------------------------------------------------------- */
  const TEAMFLOW_CLOUD_DEFAULTS = {
    apiBaseUrl: "",
    workspaceId: "",
    pollMs: 10000
  };
  const CLOUD_CONFIG_KEY = "teamflow-cloud-config-v1";
  const CLOUD_SESSION_KEY = "teamflow-cloud-session-v1";
  const CLOUD_REMEMBER_KEY = "teamflow-cloud-session-remember-v1";
  let cloudConfig = loadCloudConfig();
  let cloudUser = null;
  let cloudReady = false;
  let cloudSaving = false;
  let cloudApplyingRemote = false;
  let cloudDirty = false;
  let cloudSaveTimer = null;
  let cloudPollTimer = null;
  let cloudVersion = 0;
  let cloudLastStamp = "";
  let cloudLastError = "";

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
    const response=await fetch(`${normalizedApiBase(cloudConfig.apiBaseUrl)}${path}`,{
      method,
      headers:{"Content-Type":"application/json",...(auth&&token?{Authorization:`Bearer ${token}`}:{ }),...headers},
      body:body===undefined?undefined:JSON.stringify(body),
      cache:"no-store"
    });
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

  function normalizeCloudState(remote){
    const next=remote&&typeof remote==="object"?clone(remote):{};
    if(!Array.isArray(next.tickets))next.tickets=[];if(!Array.isArray(next.members))next.members=[];
    if(!Array.isArray(next.statuses)||!next.statuses.length)next.statuses=clone(DEFAULT_STATUSES);
    if(!Array.isArray(next.releases))next.releases=[];if(!Array.isArray(next.documents))next.documents=[];
    if(!Array.isArray(next.activity))next.activity=[];if(!Array.isArray(next.favorites))next.favorites=[];if(!Array.isArray(next.recentTickets))next.recentTickets=[];
    if(!next.savedViewsByMember||typeof next.savedViewsByMember!=="object")next.savedViewsByMember={};
    if(!next.myWorkPrefsByMember||typeof next.myWorkPrefsByMember!=="object")next.myWorkPrefsByMember={};
    if(!next.fontSizeByMember||typeof next.fontSizeByMember!=="object")next.fontSizeByMember={};
    if(!next.timelinePrefs||typeof next.timelinePrefs!=="object")next.timelinePrefs={};
    if(!next.wipLimits||typeof next.wipLimits!=="object")next.wipLimits={};
    if(!next.statusIcons||typeof next.statusIcons!=="object")next.statusIcons={};
    if(!next.settings||typeof next.settings!=="object"||Array.isArray(next.settings))next.settings={};
    if(!Array.isArray(next.settings.workflowOrder)||!next.settings.workflowOrder.length){
      next.settings.workflowOrder=Array.isArray(next.workflowOrder)&&next.workflowOrder.length?next.workflowOrder.slice():(Array.isArray(next.statuses)&&next.statuses.length?next.statuses.slice():clone(DEFAULT_STATUSES));
    }
    const remoteStatuses=Array.isArray(next.statuses)&&next.statuses.length?next.statuses.slice():clone(DEFAULT_STATUSES);
    const requestedOrder=next.settings.workflowOrder.slice();
    const reconciled=[];const seenWorkflow=new Set();
    requestedOrder.forEach(value=>{const name=remoteStatuses.find(x=>String(x).toLowerCase()===String(value||"").trim().toLowerCase());if(name&&!seenWorkflow.has(String(name).toLowerCase())){seenWorkflow.add(String(name).toLowerCase());reconciled.push(name);}});
    remoteStatuses.forEach(name=>{if(!seenWorkflow.has(String(name).toLowerCase())){seenWorkflow.add(String(name).toLowerCase());reconciled.push(name);}});
    next.settings.workflowOrder=reconciled.slice();
    next.workflowOrder=reconciled.slice();
    next.statuses=reconciled.slice();
    next.theme=next.theme||state.theme||"light";
    next.tickets.forEach(t=>{if(!t.type)t.type="Task";if(!t.risk)t.risk="None";if(!t.blockerNote)t.blockerNote="";if(!Array.isArray(t.dependencies))t.dependencies=[];if(!Array.isArray(t.comments))t.comments=[];if(!Array.isArray(t.subtasks))t.subtasks=[];if(!Array.isArray(t.links))t.links=[];t.start=normalizeDate(t.start);t.end=normalizeDate(t.end);});
    return next;
  }
  function syncCurrentMemberToAuthenticatedUser(){
    if(!cloudUser)return false;
    const username=String(cloudUser.username||"").trim().toLowerCase();
    let member=state.members.find(m=>String(m.authUsername||"").trim().toLowerCase()===username);
    let changed=false;
    // Never guess a link from display name. Imported member identities such as
    // Y.ELREKLAOUI remain stable until an administrator explicitly links them.
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
    setTheme(state.theme);ensureMemberColors();ensureAdvancedState();normalizeWorkflowOrder();applyUserFontSize();renderMemberSelects();renderBoard();renderTeam();renderStatusEditor();renderWipEditor();renderReleaseEditor();renderDocuments();renderOverview();renderTimeline();renderBackups();
    if(activeView==="mywork")renderMyWork();if(activeView==="insights")renderInsights();syncCustomSelects();
  }
  async function loadRemoteWorkspace({quiet=false}={}){
    try{
      const data=await cloudRequest("/workspace");cloudApplyingRemote=true;state=normalizeCloudState(data.state);cloudApplyingRemote=false;
      workflowOrderDraft=null;
      cloudVersion=Number(data.version||0);cloudLastStamp=data.updatedAt||"";cloudLastError="";
      const identityChanged=syncCurrentMemberToAuthenticatedUser();
      tfLog('info','Shared workflow order loaded',{version:cloudVersion,order:[...(state.workflowOrder||[])]});
      const globalSearch=document.getElementById("globalSearch");if(globalSearch)globalSearch.value="";
      activeDocId=state.documents.some(d=>d.id===activeDocId)?activeDocId:(state.documents[0]?.id||null);
      renderAfterSharedUpdate();
      if(identityChanged&&cloudReady)scheduleRemoteSave();
      if(!quiet)toast("TeamFlow updated");
      setSyncStatus("updated","Sync · updated",`Version ${cloudVersion}${cloudLastStamp?` · ${new Date(cloudLastStamp).toLocaleTimeString()}`:""}`);
      setTimeout(()=>{if(!cloudSaving)setSyncStatus("connected","Sync · connected");},1200);
      return data;
    }catch(err){cloudApplyingRemote=false;cloudLastError=String(err?.message||err);tfLogError("Loading shared workspace failed",err,{quiet,cloudVersion});setSyncStatus("error","Sync · error",cloudLastError);if(err.status===401){clearCloudToken();cloudReady=false;showAuthGate("Your TeamFlow session expired. Sign in again.");}else if(!quiet)toast("Sync unavailable");return null;}
  }
  function serializableCloudState(){
    // Only the last SAVED workflow order is serialized. The admin draft lives outside state.
    ensureSharedWorkflowOrder();
    const copy=clone(state);
    copy.settings=copy.settings&&typeof copy.settings==="object"?copy.settings:{};
    copy.settings.workflowOrder=ensureSharedWorkflowOrder().slice();
    copy.workflowOrder=copy.settings.workflowOrder.slice();
    copy.statuses=copy.settings.workflowOrder.slice();
    copy.documents=(copy.documents||[]).filter(d=>d.kind!=="pdf-local").map(d=>{delete d.runtimeUrl;return d;});
    return copy;
  }
  async function saveRemoteWorkspace(){
    if(!cloudReady||cloudApplyingRemote)return false;
    if(cloudSaving){cloudDirty=true;return false;}
    cloudSaving=true;cloudDirty=false;setSyncStatus("saving","Sync · saving…");
    try{
      let outgoing=serializableCloudState();
      if(cloudUser?.role!=="admin"){
        try{
          const latestForSettings=await cloudRequest('/workspace');
          const latestState=normalizeCloudState(latestForSettings.state);
          const protectedOrder=(latestState.settings?.workflowOrder||latestState.workflowOrder||latestState.statuses||clone(DEFAULT_STATUSES)).slice();
          outgoing.settings=outgoing.settings||{};outgoing.settings.workflowOrder=protectedOrder.slice();outgoing.workflowOrder=protectedOrder.slice();outgoing.statuses=protectedOrder.slice();
          state.settings=state.settings||{};state.settings.workflowOrder=protectedOrder.slice();state.workflowOrder=protectedOrder.slice();state.statuses=protectedOrder.slice();
        }catch(settingsErr){tfLogError('Could not refresh protected workflow settings before save',settingsErr);}
      }
      const result=await cloudRequest("/workspace",{method:"PUT",body:{version:cloudVersion,state:outgoing}});
      cloudVersion=Number(result.version||cloudVersion+1);cloudLastStamp=result.updatedAt||new Date().toISOString();cloudLastError="";
      setSyncStatus("saved","Sync · saved",`Version ${cloudVersion} · ${new Date(cloudLastStamp).toLocaleTimeString()}`);
      setTimeout(()=>{if(!cloudSaving)setSyncStatus("connected","Sync · connected");},1200);return true;
    }catch(err){
      cloudLastError=String(err?.message||err);
      if(err.status===409){setSyncStatus("error","Sync · newer data found","Another user saved first. TeamFlow is reloading the latest shared version to prevent an overwrite.");toast("Newer shared changes found — reloading");await loadRemoteWorkspace({quiet:true});}
      else if(err.status===401){clearCloudToken();cloudReady=false;showAuthGate("Your session expired. Sign in again.");}
      else{tfLogError("Saving shared workspace failed",err,{cloudVersion});setSyncStatus("error","Sync · save failed",cloudLastError);toast("Could not save shared changes");}
      return false;
    }finally{cloudSaving=false;if(cloudDirty&&cloudReady){cloudDirty=false;scheduleRemoteSave();}}
  }
  function scheduleRemoteSave(){if(!cloudReady||cloudApplyingRemote)return;cloudDirty=true;clearTimeout(cloudSaveTimer);cloudSaveTimer=setTimeout(()=>saveRemoteWorkspace(),700);}
  async function pollCloud(){
    if(document.hidden||cloudSaving||cloudApplyingRemote||cloudDirty||!cloudReady)return;
    try{const info=await cloudRequest(`/changes?since=${encodeURIComponent(cloudVersion)}`);if(info.changed)await loadRemoteWorkspace({quiet:true});}
    catch(err){cloudLastError=String(err?.message||err);tfLogError("Cloud polling failed",err,{cloudVersion});if(err.status===401){clearCloudToken();cloudReady=false;showAuthGate("Your session expired. Sign in again.");}else setSyncStatus("error","Sync · error",cloudLastError);}
  }
  async function connectCloudWorkspace(){
    setSyncStatus("connecting","Sync · connecting…");
    try{
      const me=await cloudRequest("/auth/me");cloudUser=me.user;cloudReady=true;
      const loaded=await loadRemoteWorkspace({quiet:true});if(!loaded)throw new Error(cloudLastError||"Could not load workspace");
      setSyncStatus("connected","Sync · connected",`Signed in as ${cloudUser.displayName||cloudUser.username}`);
      clearInterval(cloudPollTimer);cloudPollTimer=setInterval(pollCloud,Number(cloudConfig.pollMs||10000));
      updateCloudSettingsCard();
    }catch(err){tfLogError("Connecting to shared workspace failed",err);cloudReady=false;clearCloudToken();showAuthGate(err.message||"Sign in to TeamFlow");setSyncStatus("error","Sync · sign in required",String(err?.message||err));}
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
  function emptySecureState(){return {tickets:[],members:[],statuses:clone(DEFAULT_STATUSES),releases:[],theme:state?.theme||"light",currentMember:"",documents:[],activity:[],favorites:[],recentTickets:[],savedViewsByMember:{},myWorkPrefsByMember:{},wipLimits:{},fontSizeByMember:state?.fontSizeByMember||{},statusIcons:{},timelinePrefs:{},settings:{workflowOrder:clone(DEFAULT_STATUSES)},workflowOrder:clone(DEFAULT_STATUSES)};}

  function updateCloudSettingsCard(){
    const apiEl=document.getElementById("cloudSettingsApi"),wsEl=document.getElementById("cloudSettingsWorkspace"),userEl=document.getElementById("cloudSettingsUser"),stateEl=document.getElementById("cloudSettingsState"),manage=document.getElementById("cloudManageUsers");
    if(apiEl)apiEl.textContent=apiConfigured()?normalizedApiBase(cloudConfig.apiBaseUrl):"Not configured";
    if(wsEl)wsEl.textContent=cloudConfig.workspaceId||"—";
    if(userEl)userEl.textContent=cloudUser?`${cloudUser.displayName||cloudUser.username} · ${cloudUser.role}`:"Signed out";
    if(stateEl)stateEl.textContent=cloudReady?`Connected · v${cloudVersion}`:"Disconnected";
    if(manage)manage.style.display=cloudUser?.role==="admin"?"inline-flex":"none";
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

  function getBackups(){return [];}
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

  function normalizeWorkflowOrder(){
    // Workflow identity is shared by name; visual order is a separate admin-controlled list.
    if(!Array.isArray(state.statuses)||!state.statuses.length)state.statuses=clone(DEFAULT_STATUSES);
    const seen=new Set();
    state.statuses=state.statuses.map(x=>String(x||"").trim()).filter(name=>{if(!name)return false;const key=name.toLowerCase();if(seen.has(key))return false;seen.add(key);return true;});
    ensureSharedWorkflowOrder();
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
    if(!state.settings||typeof state.settings!=="object"||Array.isArray(state.settings))state.settings={};
    const identities=Array.isArray(state.statuses)&&state.statuses.length?state.statuses.slice():clone(DEFAULT_STATUSES);
    let order=Array.isArray(state.settings.workflowOrder)&&state.settings.workflowOrder.length?state.settings.workflowOrder.slice():(Array.isArray(state.workflowOrder)&&state.workflowOrder.length?state.workflowOrder.slice():identities.slice());
    const identityByLower=new Map(identities.map(name=>[String(name).toLowerCase(),String(name)]));
    const seen=new Set();
    order=order.map(name=>identityByLower.get(String(name).toLowerCase())).filter(name=>{if(!name)return false;const k=name.toLowerCase();if(seen.has(k))return false;seen.add(k);return true;});
    identities.forEach(name=>{const k=String(name).toLowerCase();if(!seen.has(k)){order.push(String(name));seen.add(k);}});
    state.settings.workflowOrder=order.slice();
    state.workflowOrder=order.slice();
    state.statuses=order.slice();
    return order.slice();
  }

  async function persistSharedWorkflowOrder(order){
    if(cloudUser?.role!=="admin")throw new Error("Administrator access required");
    const desired=order.slice();
    if(!cloudReady){state.settings=state.settings||{};state.settings.workflowOrder=desired.slice();state.workflowOrder=desired.slice();state.statuses=desired.slice();saveState();return true;}
    tfLog('info','Persisting shared workflow order',{admin:cloudUser?.username||'',order:desired});
    const latest=await cloudRequest('/workspace');
    const remote=normalizeCloudState(latest.state);
    remote.settings=remote.settings||{};remote.settings.workflowOrder=desired.slice();remote.workflowOrder=desired.slice();remote.statuses=desired.slice();
    const result=await cloudRequest('/workspace',{method:'PUT',body:{version:Number(latest.version||0),state:remote}});
    cloudVersion=Number(result.version||Number(latest.version||0)+1);cloudLastStamp=result.updatedAt||new Date().toISOString();
    state.settings=state.settings||{};state.settings.workflowOrder=desired.slice();state.workflowOrder=desired.slice();state.statuses=desired.slice();
    tfLog('info','Shared workflow order persisted',{version:cloudVersion,order:desired});
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
      if(button){button.disabled=false;button.textContent="Save workflow order";}
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
      (t.comments||[]).forEach((c,i)=>{
        if(!c.id) c.id=`c_${String(t.id).replace(/[^a-z0-9]/gi,'')}_${i}_${Date.now().toString(36)}`;
        if(!c.reactions || typeof c.reactions!=="object") c.reactions={};
      });
    });
    state.statuses.forEach(s=>{if(!(s in state.wipLimits)) state.wipLimits[s]="";});
    Object.keys(state.wipLimits).forEach(s=>{if(!state.statuses.includes(s)) delete state.wipLimits[s];});
  }

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
    safe=safe.replace(/\b(GIS-\d+)\b/gi,'<span class="ticket-ref" data-comment-ticket="$1">$1</span>');
    return safe.replace(/\n/g,'<br>');
  }

  function commentHtml(c,ticket){
    const likes=Array.isArray(c.reactions?.like)?c.reactions.like:[];const mine=likes.includes(state.currentMember);const own=c.by===state.currentMember;
    return `<div class="comment" data-comment-id="${esc(c.id)}"><span class="comment-avatar" style="--comment-color:${memberColor(c.by)}">${initials(c.by)}</span><div class="comment-content"><div class="comment-head"><strong>${esc(c.by)}</strong><small>${esc(c.at)}</small></div><p class="comment-body">${formatCommentText(c.text)}</p><div class="comment-actions"><button type="button" data-comment-like="${esc(c.id)}">${mine?'♥':'♡'} ${likes.length||''}</button>${own?`<button type="button" data-comment-edit="${esc(c.id)}">Edit</button><button type="button" data-comment-delete="${esc(c.id)}">Delete</button>`:''}</div></div></div>`;
  }

  function openCommentEditModal(ticketId,commentId){
    const ticket=state.tickets.find(t=>t.id===ticketId);const c=ticket?.comments?.find(x=>x.id===commentId);if(!c)return;
    $("#confirmRoot").innerHTML=`<div class="notice-backdrop" role="dialog" aria-modal="true"><div class="notice-dialog"><div class="notice-hero"><div class="notice-icon">✎</div><div><h2>Edit comment</h2><p>Update your comment text.</p></div></div><div class="notice-body"><div class="field"><label>Comment</label><textarea id="editCommentText" style="min-height:120px">${esc(c.text)}</textarea></div></div><div class="notice-actions"><button class="btn" id="editCommentCancel" type="button">Cancel</button><button class="btn primary" id="editCommentSave" type="button">Save</button></div></div></div>`;
    const close=()=>$("#confirmRoot").innerHTML="";$("#editCommentCancel").onclick=close;attachMentionAutocomplete($("#editCommentText"));$("#editCommentSave").onclick=()=>{const text=$("#editCommentText").value.trim();if(!text)return;c.text=text;c.at=nowLabel()+' · edited';logActivity('comment',ticket,'Edited a comment');saveState();close();openTicketDetails(ticketId,{preserveStack:true});};
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

  function renderWipEditor(){
    ensureAdvancedState();const el=$("#wipEditor");if(!el)return;el.innerHTML=state.statuses.map(status=>`<div class="wip-row"><label>${esc(status)}</label><input class="control" data-wip-status="${esc(status)}" type="number" min="1" placeholder="No limit" value="${wipLimitFor(status)||''}" /></div>`).join('');$$('[data-wip-status]').forEach(input=>input.addEventListener('change',()=>{const v=Number(input.value);state.wipLimits[input.dataset.wipStatus]=Number.isFinite(v)&&v>0?Math.floor(v):'';saveState();renderBoard();toast(`${input.dataset.wipStatus}: ${wipLimitFor(input.dataset.wipStatus)||'No limit'}`);}));
  }

  function renderOverview(){
    ensureAdvancedState();
    const total=state.tickets.length;
    const delivered=state.tickets.filter(t=>['Done','Deployed on SIT'].includes(t.status)).length;
    const overdue=state.tickets.filter(isOverdue).length;
    const blocked=state.tickets.filter(isBlocked).length;
    const active=activeTickets(state.tickets).length;
    const avg=total?Math.round(state.tickets.reduce((sum,t)=>sum+normalizeProgress(t.progress),0)/total):0;
    const dueSoon=state.tickets.filter(t=>{const d=dueInfo(t);return ['today','soon'].includes(d.cls)}).length;
    const fav=state.favorites.map(id=>state.tickets.find(t=>t.id===id)).filter(Boolean).slice(0,5);
    const recent=state.recentTickets.map(id=>state.tickets.find(t=>t.id===id)).filter(Boolean).slice(0,5);
    const upcoming=state.tickets.filter(t=>t.end&&!['Done','Deployed on SIT','Deprecated'].includes(t.status)).sort((a,b)=>a.end.localeCompare(b.end)).slice(0,6);
    const activity=state.activity.slice(0,3);
    const focus=state.tickets.filter(t=>isBlocked(t)||isOverdue(t)||t.risk==='At Risk').sort((a,b)=>Number(isBlocked(b))-Number(isBlocked(a))).slice(0,4);
    const statusMax=Math.max(1,...state.statuses.map(status=>state.tickets.filter(t=>t.status===status).length));
    const svg={
      layers:'<svg viewBox="0 0 24 24"><path d="m12 3 8 4-8 4-8-4 8-4Z"/><path d="m4 12 8 4 8-4"/><path d="m4 17 8 4 8-4"/></svg>',
      alert:'<svg viewBox="0 0 24 24"><path d="M12 4 3.5 19h17L12 4Z"/><path d="M12 9v4"/><path d="M12 16h.01"/></svg>',
      shield:'<svg viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 4.6 2.8 8 7 10 4.2-2 7-5.4 7-10V6l-7-3Z"/></svg>',
      calendar:'<svg viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="14" rx="2"/><path d="M8 3v6M16 3v6M4 10h16"/></svg>',
      pulse:'<svg viewBox="0 0 24 24"><path d="M3 12h4l2-5 4 10 2-5h6"/></svg>',
      star:'<svg viewBox="0 0 24 24"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/></svg>',
      clock:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2"/></svg>',
      chart:'<svg viewBox="0 0 24 24"><path d="M5 20V10M12 20V4M19 20v-7"/></svg>',
      chevron:'<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>'
    };
    const statusBars=state.statuses.map(status=>{const n=state.tickets.filter(t=>t.status===status).length;return `<div class="overview-flow-row"><span class="overview-flow-icon">${workflowIconSvg(workflowIconKey(status))}</span><span class="overview-flow-name" title="${esc(status)}">${esc(status)}</span><div class="overview-flow-track"><div class="overview-flow-fill" style="width:${Math.round(n/statusMax*100)}%"></div></div><strong>${n}</strong></div>`}).join('');
    const ticketRows=list=>list.length?list.map(t=>`<button class="overview-ticket modern" data-overview-ticket="${esc(t.id)}" type="button"><b>${esc(t.id)}</b><strong>${esc(t.title)}</strong><span class="overview-status-pill status-${esc(String(t.status).toLowerCase().replace(/[^a-z0-9]+/g,'-'))}">${esc(t.status)}</span><i>${svg.chevron}</i></button>`).join(''):'<div class="overview-empty-state"><span>⌑</span><strong>Nothing here yet</strong></div>';
    const focusRows=focus.length?focus.map(t=>`<button class="overview-focus-row" data-overview-ticket="${esc(t.id)}" type="button"><span class="overview-attention-dot ${isBlocked(t)?'blocked':isOverdue(t)?'overdue':'risk'}"></span><strong>${esc(t.id)} · ${esc(t.title)}</strong><span class="overview-attention-pill">${isBlocked(t)?'Blocked':isOverdue(t)?dueInfo(t).text:'At risk'}</span><i>${svg.chevron}</i></button>`).join(''):'<div class="overview-empty-state compact"><span>✓</span><strong>No critical attention items</strong></div>';
    const activityRows=activity.length?activity.map((a,index)=>`<div class="overview-activity-row"><div class="overview-activity-line ${index===activity.length-1?'last':''}"><span class="overview-activity-dot"></span></div><div class="overview-activity-icon">${a.kind==='comment'?'💬':a.kind==='move'?'↔':a.kind==='create'?'＋':'✦'}</div><div class="overview-activity-copy"><strong>${esc(a.by)} · ${esc(a.ticketId||'Workspace')}</strong><p>${esc(a.message||a.title||a.kind)}</p><time>${new Date(a.ts).toLocaleString('en-GB')}</time></div></div>`).join(''):'<div class="overview-empty-state"><span>✦</span><strong>Activity will appear here</strong></div>';
    $("#overviewContent").innerHTML=`
      <div class="overview-spotlight">
        <div class="overview-hero-card">
          <span class="overview-hero-accent"></span>
          <div class="overview-hero-copy"><small>Delivery pulse</small><h3>${delivered} of ${total} tickets delivered</h3><p>TeamFlow is tracking ${active} active tickets across ${state.statuses.length} workflows. ${blocked||overdue?`${blocked} blocked and ${overdue} overdue item${blocked+overdue===1?' needs':'s need'} attention.`:'Delivery currently has no overdue or blocked tickets.'}</p></div>
          <div class="overview-progress-ring" style="--overview-angle:${avg*3.6}deg"><div><strong>${avg}%</strong><span>overall<br>progress</span></div></div>
        </div>
        <div class="overview-focus-card"><div class="overview-card-head reference"><h3>${svg.alert}<span>Needs attention</span></h3></div><div class="overview-focus-list">${focusRows}</div></div>
      </div>
      <div class="overview-hero-grid">
        <div class="overview-metric metric-open"><span class="overview-metric-icon">${svg.layers}</span><div><small>Open workload</small><strong>${active}</strong><span>currently active tickets</span></div></div>
        <div class="overview-metric metric-overdue"><span class="overview-metric-icon">${svg.alert}</span><div><small>Overdue</small><strong>${overdue}</strong><span>past expected end date</span></div></div>
        <div class="overview-metric metric-blocked"><span class="overview-metric-icon">${svg.shield}</span><div><small>Blocked / risk</small><strong>${blocked}</strong><span>dependency or risk attention</span></div></div>
        <div class="overview-metric metric-due"><span class="overview-metric-icon">${svg.calendar}</span><div><small>Due soon</small><strong>${dueSoon}</strong><span>today or within 7 days</span></div></div>
      </div>
      <div class="overview-grid overview-main-grid">
        <div class="overview-card workflow-pulse-card"><div class="overview-card-head reference"><h3>${svg.chart}<span>Workflow pulse</span></h3><span class="overview-count-pill">${total} tickets</span></div><div class="overview-flow-list">${statusBars}</div></div>
        <div class="overview-card due-next-card"><div class="overview-card-head reference"><h3>${svg.calendar}<span>Due next</span></h3></div><div class="overview-ticket-list">${ticketRows(upcoming)}</div></div>
        <div class="overview-card recent-activity-card"><div class="overview-card-head reference"><h3>${svg.pulse}<span>Recent activity</span></h3><span class="overview-count-pill">Latest ${activity.length}</span></div><div class="overview-activity-feed">${activityRows}</div></div>
        <div class="overview-side-stack">
          <div class="overview-card"><div class="overview-card-head reference"><h3>${svg.star}<span>Favorites</span></h3></div><div class="overview-ticket-list">${ticketRows(fav)}</div></div>
          <div class="overview-card"><div class="overview-card-head reference"><h3>${svg.clock}<span>Recently opened</span></h3></div><div class="overview-ticket-list">${ticketRows(recent)}</div></div>
        </div>
      </div>`;
    $$('[data-overview-ticket]').forEach(b=>b.onclick=()=>openTicketDetails(b.dataset.overviewTicket));
  }

  function timelineParseDate(value){
    const v=normalizeDate(value||"");
    const m=String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m)return null;
    const d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));
    return Number.isFinite(d.getTime())?d:null;
  }
  function timelineISO(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;}
  function timelineAddDays(date,days){const d=new Date(date.getFullYear(),date.getMonth(),date.getDate());d.setDate(d.getDate()+days);return d;}
  function timelineDiffDays(a,b){return Math.round((new Date(b.getFullYear(),b.getMonth(),b.getDate())-new Date(a.getFullYear(),a.getMonth(),a.getDate()))/86400000);}
  function timelineDateLabel(date,withYear=true){return date.toLocaleDateString('en-US',withYear?{month:'short',day:'numeric',year:'numeric'}:{day:'numeric',month:'short'});}
  function timelinePrefs(){ensureAdvancedState();return state.timelinePrefs;}
  function timelineZoomConfig(){
    const zoom=timelinePrefs().zoom;
    return {week:{dayWidth:52,tick:1,shift:7},'2weeks':{dayWidth:34,tick:3,shift:14},month:{dayWidth:22,tick:7,shift:30},quarter:{dayWidth:12,tick:14,shift:60}}[zoom]||{dayWidth:34,tick:3,shift:14};
  }
  function timelineFilteredTickets(){
    const p=timelinePrefs(),f=p.filters||{};
    return state.tickets.filter(t=>{
      if(!timelineParseDate(t.start||t.end)||!timelineParseDate(t.end||t.start))return false;
      if(f.assignee&&t.assignee!==f.assignee)return false;
      if(f.status&&t.status!==f.status)return false;
      if(f.release&&(t.release||'')!==f.release)return false;
      if(f.type&&(t.type||'Task')!==f.type)return false;
      return true;
    });
  }
  function timelineProjectRange(tickets){
    const list=tickets.length?tickets:state.tickets.filter(t=>timelineParseDate(t.start||t.end)&&timelineParseDate(t.end||t.start));
    if(!list.length){const today=timelineParseDate(localTodayISO())||new Date();return [timelineAddDays(today,-14),timelineAddDays(today,28)];}
    const starts=list.map(t=>timelineParseDate(t.start||t.end)).filter(Boolean),ends=list.map(t=>timelineParseDate(t.end||t.start)).filter(Boolean);
    return [timelineAddDays(new Date(Math.min(...starts.map(d=>d.getTime()))),-2),timelineAddDays(new Date(Math.max(...ends.map(d=>d.getTime()))),2)];
  }
  function timelineVisibleRange(tickets){
    const p=timelinePrefs();let start=timelineParseDate(p.rangeStart),end=timelineParseDate(p.rangeEnd);
    if(!start||!end||end<start){[start,end]=timelineProjectRange(tickets);p.rangeStart=timelineISO(start);p.rangeEnd=timelineISO(end);}
    return [start,end];
  }
  function timelineGroupValue(ticket,groupBy){return groupBy==='status'?ticket.status:groupBy==='release'?(ticket.release||'No release'):groupBy==='type'?(ticket.type||'Task'):(ticket.assignee||'Unassigned');}
  function timelineGroupOrder(groups,groupBy){
    const known=groupBy==='assignee'?state.members.map(m=>m.name):groupBy==='status'?state.statuses:groupBy==='release'?state.releases:['Task','Bug','Development','Deployment','Testing','Documentation'];
    return [...known.filter(x=>groups.includes(x)),...groups.filter(x=>!known.includes(x)).sort((a,b)=>a.localeCompare(b))];
  }
  function timelineGroupSymbol(group,groupBy){
    if(groupBy==='assignee')return `<span class="timeline-group-avatar" style="--member-color:${memberColor(group)}">${initials(group)}</span>`;
    if(groupBy==='status')return `<span class="timeline-group-symbol">${workflowIconSvg(workflowIconFor(group))}</span>`;
    if(groupBy==='release')return `<span class="timeline-group-symbol"><svg viewBox="0 0 24 24"><path d="M6 21V4m0 1h10l-2 3 2 3H6"/></svg></span>`;
    return `<span class="timeline-group-symbol" style="color:${issueTypeColor(group)}"><svg viewBox="0 0 24 24"><path d="M5 5h6v6H5zM13 5h6v6h-6zM5 13h6v6H5zM13 13h6v6h-6z"/></svg></span>`;
  }
  function timelinePopulateControls(){
    const p=timelinePrefs();
    const populate=(id,items,placeholder,value)=>{const s=$(id);if(!s)return;const current=value??s.value;s.innerHTML=`<option value="">${esc(placeholder)}</option>`+items.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');s.value=items.includes(current)?current:"";};
    populate('#timelineAssigneeFilter',state.members.map(m=>m.name),'All assignees',p.filters.assignee);
    populate('#timelineStatusFilter',state.statuses,'All workflows',p.filters.status);
    populate('#timelineReleaseFilter',state.releases,'All releases',p.filters.release);
    const types=[...new Set(['Task','Bug','Development','Deployment','Testing','Documentation',...state.tickets.map(t=>t.type||'Task')])];populate('#timelineTypeFilter',types,'All issue types',p.filters.type);
    const group=$('#timelineGroup');if(group)group.value=p.group;
    const zoom=$('#timelineZoom');if(zoom)zoom.value=p.zoom;
    const gantt=$('#timelineModeGantt'),list=$('#timelineModeList');if(gantt)gantt.classList.toggle('active',p.mode==='gantt');if(list)list.classList.toggle('active',p.mode==='list');
  }
  function timelineRenderFilterChips(){
    const p=timelinePrefs(),chips=$('#timelineFilterChips'),count=$('#timelineFilterCount');if(!chips)return;
    const labels={assignee:'Assignee',status:'Workflow',release:'Release',type:'Type'};const active=Object.entries(p.filters||{}).filter(([,v])=>v);
    chips.innerHTML=active.map(([k,v])=>`<span class="timeline-filter-chip">${labels[k]}: ${esc(v)} <button type="button" data-timeline-clear-filter="${k}" aria-label="Remove ${labels[k]} filter">×</button></span>`).join('');
    if(count){count.textContent=String(active.length);count.classList.toggle('hidden',!active.length);}
    $$('[data-timeline-clear-filter]').forEach(btn=>btn.onclick=()=>{p.filters[btn.dataset.timelineClearFilter]="";saveState();renderTimeline();});
  }
  function timelineRangeText(start,end){return `${timelineDateLabel(start,true)} – ${timelineDateLabel(end,true)}`;}
  function timelineRenderGantt(tickets,start,end){
    const groupBy=timelinePrefs().group,config=timelineZoomConfig(),dayWidth=config.dayWidth,span=Math.max(1,timelineDiffDays(start,end)+1),totalWidth=span*dayWidth,today=timelineParseDate(localTodayISO());
    const overlap=t=>{const s=timelineParseDate(t.start||t.end),e=timelineParseDate(t.end||t.start);return s&&e&&e>=start&&s<=end;};
    const visible=tickets.filter(overlap),groupNames=timelineGroupOrder([...new Set(visible.map(t=>timelineGroupValue(t,groupBy)))],groupBy);
    const monthSegments=[];let cursor=new Date(start.getFullYear(),start.getMonth(),1);if(cursor<start)cursor=new Date(start.getFullYear(),start.getMonth(),1);
    let segStart=new Date(start);while(segStart<=end){const nextMonth=new Date(segStart.getFullYear(),segStart.getMonth()+1,1);const segEnd=nextMonth<=end?timelineAddDays(nextMonth,-1):end;const left=Math.max(0,timelineDiffDays(start,segStart))*dayWidth;const width=(timelineDiffDays(segStart,segEnd)+1)*dayWidth;monthSegments.push(`<div class="timeline-month-segment" style="left:${left}px;width:${width}px">${segStart.toLocaleDateString('en-US',{month:'short',year:'numeric'})}</div>`);segStart=timelineAddDays(segEnd,1);}
    const ticks=[];for(let i=0;i<span;i+=config.tick){const d=timelineAddDays(start,i);ticks.push(`<div class="timeline-tick" style="left:${i*dayWidth}px">${d.toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</div>`);}
    const weekends=[];if(span<=730){for(let i=0;i<span;i++){const d=timelineAddDays(start,i);if(d.getDay()===0||d.getDay()===6)weekends.push(`<span class="timeline-weekend" style="left:${i*dayWidth}px;width:${dayWidth}px"></span>`);}}
    const gridLines=[];for(let i=0;i<=span;i++)gridLines.push(`<span class="timeline-grid-line" style="left:${i*dayWidth}px"></span>`);
    const todayInside=today&&today>=start&&today<=end,todayX=todayInside?(timelineDiffDays(start,today)+.5)*dayWidth:0;
    const todayHeader=todayInside?`<span class="timeline-today-label" style="left:${todayX}px">Today</span>`:'';
    const groupsHtml=groupNames.length?groupNames.map(group=>{
      const groupTickets=visible.filter(t=>timelineGroupValue(t,groupBy)===group).sort((a,b)=>(a.start||a.end||'').localeCompare(b.start||b.end||''));
      const key=`${groupBy}|${group}`,collapsed=Boolean(timelinePrefs().collapsed[key]);
      const laneHeight=collapsed?60:Math.max(66,groupTickets.length*40+14);
      const bars=collapsed?'':groupTickets.map((t,index)=>{
        const rawStart=timelineParseDate(t.start||t.end),rawEnd=timelineParseDate(t.end||t.start),clipStart=rawStart<start?start:rawStart,clipEnd=rawEnd>end?end:rawEnd,left=Math.max(0,timelineDiffDays(start,clipStart))*dayWidth,width=Math.max(dayWidth,(timelineDiffDays(clipStart,clipEnd)+1)*dayWidth),progress=normalizeProgress(t.progress),color=issueTypeColor(t.type||'Task');
        return `<button class="timeline-task-bar" data-timeline-ticket="${esc(t.id)}" style="--type-color:${color};left:${left}px;top:${8+index*40}px;width:${width}px" title="${esc(`${t.id} · ${t.title} · ${formatDate(t.start)} → ${formatDate(t.end)}`)}"><span class="timeline-task-bar-progress" style="width:${progress}%"></span><span class="timeline-task-icon"><svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 9h6M9 13h4"/></svg></span><span class="timeline-task-text">${esc(t.id)} – ${esc(t.title)}</span></button>`;
      }).join('');
      return `<div class="timeline-gantt-group" style="min-height:${laneHeight}px"><div class="timeline-gantt-group-label"><button class="timeline-collapse-btn ${collapsed?'collapsed':''}" type="button" data-timeline-toggle-group="${esc(key)}" aria-label="${collapsed?'Expand':'Collapse'} ${esc(group)}"><svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></button>${timelineGroupSymbol(group,groupBy)}<div class="timeline-group-copy"><strong title="${esc(group)}">${esc(group)}</strong><small>${groupTickets.length} ticket${groupTickets.length===1?'':'s'}</small></div></div><div class="timeline-gantt-lane" style="width:${totalWidth}px;height:${laneHeight}px">${weekends.join('')}${gridLines.join('')}${todayInside?`<span class="timeline-today-line" style="left:${todayX}px"></span>`:''}${bars}</div></div>`;
    }).join(''):`<div class="timeline-no-group">No tickets match the current timeline filters and date range.</div>`;
    return `<div class="timeline-gantt-scroll"><div class="timeline-gantt-grid"><div class="timeline-gantt-header"><div class="timeline-gantt-corner">${groupBy==='assignee'?'Assignee':groupBy==='status'?'Workflow':groupBy==='release'?'Release':'Issue Type'}</div><div class="timeline-calendar-header" style="width:${totalWidth}px"><div class="timeline-month-row">${monthSegments.join('')}</div><div class="timeline-tick-row">${ticks.join('')}</div>${todayHeader}</div></div>${groupsHtml}</div></div>`;
  }
  function timelineRenderList(tickets,start,end){
    const groupBy=timelinePrefs().group,visible=tickets.filter(t=>{const s=timelineParseDate(t.start||t.end),e=timelineParseDate(t.end||t.start);return s&&e&&e>=start&&s<=end;});
    const groups=timelineGroupOrder([...new Set(visible.map(t=>timelineGroupValue(t,groupBy)))],groupBy);
    const rows=groups.map(group=>{const list=visible.filter(t=>timelineGroupValue(t,groupBy)===group).sort((a,b)=>(a.start||'').localeCompare(b.start||''));return `<tr class="timeline-list-group-row"><td colspan="7">${esc(group)} · ${list.length} ticket${list.length===1?'':'s'}</td></tr>${list.map(t=>`<tr data-timeline-ticket="${esc(t.id)}"><td><div class="timeline-list-ticket" style="--type-color:${issueTypeColor(t.type||'Task')}"><span class="dot"></span><span>${esc(t.id)} – ${esc(t.title)}</span></div></td><td><div class="timeline-list-member" style="--member-color:${memberColor(t.assignee)}"><span class="timeline-list-avatar">${initials(t.assignee)}</span><span>${esc(t.assignee||'Unassigned')}</span></div></td><td>${esc(t.status||'—')}</td><td>${esc(formatDate(t.start))}</td><td>${esc(formatDate(t.end))}</td><td><div class="timeline-list-progress"><span><i style="width:${normalizeProgress(t.progress)}%"></i></span><b>${normalizeProgress(t.progress)}%</b></div></td><td>${esc(t.release||'—')}</td></tr>`).join('')}`;}).join('');
    return `<div class="timeline-list-view"><table class="timeline-list-table"><thead><tr><th>Ticket</th><th>Assignee</th><th>Workflow</th><th>Start</th><th>Expected end</th><th>Progress</th><th>Release</th></tr></thead><tbody>${rows||'<tr><td colspan="7" class="timeline-no-group">No tickets match the current timeline filters and date range.</td></tr>'}</tbody></table></div>`;
  }
  function renderTimeline(){
    const root=$('#timelineContent');if(!root)return;const p=timelinePrefs();timelinePopulateControls();const tickets=timelineFilteredTickets();const [start,end]=timelineVisibleRange(tickets);
    const rangeText=$('#timelineRangeText');if(rangeText)rangeText.textContent=timelineRangeText(start,end);const rs=$('#timelineRangeStart'),re=$('#timelineRangeEnd');if(rs)rs.value=timelineISO(start);if(re)re.value=timelineISO(end);timelineRenderFilterChips();
    root.innerHTML=p.mode==='list'?timelineRenderList(tickets,start,end):timelineRenderGantt(tickets,start,end);
    $$('[data-timeline-ticket]',root).forEach(el=>el.addEventListener('click',()=>openTicketDetails(el.dataset.timelineTicket)));
    $$('[data-timeline-toggle-group]',root).forEach(btn=>btn.addEventListener('click',()=>{const key=btn.dataset.timelineToggleGroup;p.collapsed[key]=!p.collapsed[key];saveState();renderTimeline();}));
    syncCustomSelects();
  }
  function timelineShiftRange(direction){const p=timelinePrefs(),tickets=timelineFilteredTickets(),[start,end]=timelineVisibleRange(tickets),step=timelineZoomConfig().shift*direction;p.rangeStart=timelineISO(timelineAddDays(start,step));p.rangeEnd=timelineISO(timelineAddDays(end,step));saveState();renderTimeline();}
  function timelineGoToday(){const p=timelinePrefs(),tickets=timelineFilteredTickets(),[start,end]=timelineVisibleRange(tickets),today=timelineParseDate(localTodayISO()),span=Math.max(1,timelineDiffDays(start,end));if(today<start||today>end){const half=Math.floor(span/2);p.rangeStart=timelineISO(timelineAddDays(today,-half));p.rangeEnd=timelineISO(timelineAddDays(today,span-half));saveState();renderTimeline();}setTimeout(()=>{const scroll=$('.timeline-gantt-scroll');if(!scroll||p.mode!=='gantt')return;const s=timelineParseDate(p.rangeStart),x=(timelineDiffDays(s,today)+.5)*timelineZoomConfig().dayWidth;scroll.scrollLeft=Math.max(0,x-scroll.clientWidth/2+125);},30);}

  function releaseReadinessHtml(release){
    const list=state.tickets.filter(t=>t.release===release);const complete=t=>['Done','Deployed on SIT','Deprecated'].includes(t.status)||normalizeProgress(t.progress)>=100;const checks=[['Development',!list.some(t=>(t.type==='Development'||t.area==='BE'||t.area==='FE')&&!complete(t))],['Code review',!list.some(t=>t.status==='Code Review')],['Testing',!list.some(t=>t.type==='Testing'&&!complete(t))],['Documentation',!list.some(t=>t.type==='Documentation'&&!complete(t))],['No blockers',!list.some(isBlocked)]];return `<div class="release-readiness"><div class="overview-card-head"><h3>${esc(release||'Release')} readiness</h3><span>${list.length} ticket${list.length===1?'':'s'}</span></div><div class="readiness-grid">${checks.map(([label,ok])=>`<div class="readiness-item ${ok?'done':''}"><strong>${ok?'✓':'○'} ${label}</strong><span>${ok?'Ready':'Needs attention'}</span></div>`).join('')}</div></div>`;
  }

  function renderQuickFilters(){
    $$("[data-quick]").forEach(btn=>btn.classList.toggle("active",btn.dataset.quick===quickMode));
    const mine=state.tickets.filter(t=>t.assignee===state.currentMember).length;
    const overdue=state.tickets.filter(isOverdue).length;
    if($("#mineCount")) $("#mineCount").textContent=mine;
    if($("#allCount")) $("#allCount").textContent=state.tickets.length;
    if($("#overdueCount")) $("#overdueCount").textContent=overdue;
  }

  function setQuickFiltersAvailability(viewName){
    const enabled=viewName==="board";
    $$('[data-quick]').forEach(btn=>{
      btn.disabled=!enabled;
      btn.setAttribute('aria-disabled',String(!enabled));
      btn.title=enabled?'':'Quick Filters are available on the Board only';
    });
    const title=$("#quickFiltersTitle");
    if(title) title.classList.toggle("disabled",!enabled);
  }

  function setTheme(theme){
    state.theme = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = state.theme;
    const dark=state.theme==="dark";
    $$(".theme-switch").forEach(toggle=>{
      toggle.classList.toggle("is-dark",dark);
      toggle.setAttribute("title",dark?"Switch to light mode":"Switch to dark mode");
      toggle.setAttribute("aria-label",dark?"Switch to light mode":"Switch to dark mode");
    });
    saveState();
  }

  function renderMemberSelects(){
    ensureMemberColors();
    const viewAs = $("#viewAs");
    syncCurrentMemberToAuthenticatedUser();
    const names = state.members.map(m=>m.name);
    const currentName = state.currentMember && names.includes(state.currentMember) ? state.currentMember : (cloudUser?"":(names[0]||""));
    state.currentMember = currentName;
    if(viewAs)viewAs.innerHTML = currentName?`<option selected>${esc(currentName)}</option>`:"";
    renderViewAsAvatarMenu();

    const assignee = $("#assigneeFilter");
    const prev = assignee.value;
    assignee.innerHTML = '<option value="">Assignee: All</option>' + names.map(n=>`<option>${esc(n)}</option>`).join("");
    if(names.includes(prev)) assignee.value = prev;

    const status = $("#statusFilter");
    const prevStatus = status.value;
    status.innerHTML = '<option value="">Status: All</option>' + state.statuses.map(s=>`<option>${esc(s)}</option>`).join("");
    if(state.statuses.includes(prevStatus)) status.value = prevStatus;

    const release=$("#releaseFilter");
    if(release){
      const prevRelease=release.value;
      release.innerHTML='<option value="">Release: All</option>'+state.releases.map(r=>`<option>${esc(r)}</option>`).join("");
      if(state.releases.includes(prevRelease)) release.value=prevRelease;
    }
    if($("#bulkStatus")) $("#bulkStatus").innerHTML='<option value="">Keep current</option>'+state.statuses.map(x=>`<option>${esc(x)}</option>`).join("");
    if($("#bulkAssignee")) $("#bulkAssignee").innerHTML='<option value="">Keep current</option>'+state.members.map(x=>`<option>${esc(x.name)}</option>`).join("");
    if($("#bulkRelease")) $("#bulkRelease").innerHTML='<option value="">Keep current</option>'+state.releases.map(x=>`<option>${esc(x)}</option>`).join("");
    renderSavedViews();
  }

  function renderViewAsAvatarMenu(){
    const btn=$("#viewAsAvatarBtn"),avatar=$("#viewAsAvatar"),menu=$("#viewAsAvatarMenu"),nameEl=$("#connectedUserName"),roleEl=$("#connectedUserRole");
    if(!btn||!avatar)return;
    syncCurrentMemberToAuthenticatedUser();
    const current=linkedMemberForCurrentUser();
    const display=personalDisplayName();
    avatar.textContent=initials(display);
    avatar.style.setProperty('--member-color',current?memberColor(current.name):(validMemberColor(personalProfile().color)||colorForName(display)));
    if(nameEl)nameEl.textContent=display;
    if(roleEl)roleEl.textContent=current?`${cloudUser?.role==="admin"?"Administrator":"Member"} · ${current.name}`:(cloudUser?"Account not linked":"Signed out");
    btn.title=current?`Signed in as ${display} · linked to ${current.name}`:`Signed in as ${display} · account not linked to a Team member`;
    btn.setAttribute('role','button');btn.setAttribute('tabindex','0');
    if(menu)menu.classList.add("hidden");
  }

  function openPersonalProfileModal(){
    if(!cloudUser){toast("Sign in first");return;}
    const p=personalProfile(),linked=linkedMemberForCurrentUser(),display=personalDisplayName(),color=validMemberColor(p.color)||memberColor(linked?.name||display);
    $("#modalRoot").innerHTML=`<div class="modal-backdrop" role="dialog" aria-modal="true"><div class="modal" style="max-width:540px"><div class="modal-head"><h2>My profile</h2><button id="closeModal" class="modal-close" type="button">×</button></div><div class="modal-body"><div class="form-grid"><div class="field full"><label>My display name</label><input id="personalDisplayName" value="${esc(display)}" /></div><div class="field full"><label>My color</label><div class="member-color-picker"><div id="personalColorPreview" class="member-color-preview" style="--member-color:${color}">${initials(display)}</div><div class="member-color-controls"><input id="personalColor" type="color" value="${color}" /> <div class="color-swatches">${MEMBER_COLOR_PALETTE.map(c=>`<button class="color-swatch" type="button" data-personal-color="${c}" style="--swatch:${c}"></button>`).join('')}</div></div></div></div><div class="field full"><div class="note">These are your personal display preferences. ${linked?`Your account is linked to shared member <b>${esc(linked.name)}</b>.`:'Your login is not linked to a Team member yet.'}</div></div></div></div><div class="modal-actions"><div class="spacer"></div><button id="cancelPersonalProfile" class="btn" type="button">Cancel</button><button id="savePersonalProfile" class="btn primary" type="button">Save my profile</button></div></div></div>`;
    const close=()=>$("#modalRoot").innerHTML="";$("#closeModal").onclick=close;$("#cancelPersonalProfile").onclick=close;
    const refresh=()=>{const name=$("#personalDisplayName").value.trim()||display;$("#personalColorPreview").textContent=initials(name);$("#personalColorPreview").style.setProperty('--member-color',$("#personalColor").value);};
    $("#personalDisplayName").oninput=refresh;$("#personalColor").oninput=refresh;$$('[data-personal-color]').forEach(b=>b.onclick=()=>{$("#personalColor").value=b.dataset.personalColor;refresh();});
    $("#savePersonalProfile").onclick=()=>{const nextName=$("#personalDisplayName").value.trim();if(!nextName){$("#personalDisplayName").focus();return;}savePersonalProfile({displayName:nextName,color:$("#personalColor").value});close();toast("Your profile preferences were updated");};
  }

  function renderBoardHeroStats(){
    const total=state.tickets.length;
    const done=state.tickets.filter(t=>t.status==='Done').length;
    const inProgress=state.tickets.filter(t=>['Ongoing','Code Review'].includes(t.status)).length;
    const onHold=state.tickets.filter(t=>t.status==='On hold').length;
    const overdue=state.tickets.filter(isOverdue).length;
    const progress=total?Math.round(state.tickets.reduce((sum,t)=>sum+normalizeProgress(t.progress,0),0)/total):0;
    if($('#heroTotal'))$('#heroTotal').textContent=total;
    if($('#heroProgress'))$('#heroProgress').textContent=progress+'%';
    if($('#heroProgressRing'))$('#heroProgressRing').style.setProperty('--progress',progress);
    if($('#heroInProgress'))$('#heroInProgress').textContent=inProgress;
    if($('#heroDone'))$('#heroDone').textContent=done;
    if($('#heroOnHold'))$('#heroOnHold').textContent=onHold;
    if($('#heroOverdue'))$('#heroOverdue').textContent=overdue;
  }

  function ticketMatches(ticket){
    const q = $("#globalSearch").value.trim().toLowerCase();
    const af = $("#assigneeFilter").value;
    const sf = $("#statusFilter").value;
    const area = $("#areaFilter").value;
    const pr = $("#priorityFilter").value;
    const rel = $("#releaseFilter") ? $("#releaseFilter").value : "";
    const risk = $("#riskFilter") ? $("#riskFilter").value : "";

    if(q){
      const linkText=(ticket.links||[]).map(l=>`${l.title||""} ${l.url||""} ${l.chapter||""}`);
      const hay = [ticket.id,ticket.title,ticket.description,ticket.assignee,ticket.area,ticket.type,ticket.release,ticket.risk,ticket.blockerNote,...(ticket.dependencies||[]),...(ticket.labels||[]),...(ticket.collaborators||[]),...linkText].join(" ").toLowerCase();
      if(!hay.includes(q)) return false;
    }
    if(quickMode==="mine" && ticket.assignee!==state.currentMember) return false;
    if(quickMode==="overdue" && !isOverdue(ticket)) return false;
    if(af && ticket.assignee !== af) return false;
    if(sf && ticket.status !== sf) return false;
    if(area && ticket.area !== area) return false;
    if(pr && ticket.priority !== pr) return false;
    if(rel && ticket.release !== rel) return false;
    if(risk && (risk==="Blocked" ? !isBlocked(ticket) : ticket.risk!==risk)) return false;
    return true;
  }


  function boardFilterState(){
    return [
      {key:'search',label:'Search',value:$('#globalSearch')?.value.trim()||'',cls:'search'},
      {key:'assignee',label:'Assignee',value:$('#assigneeFilter')?.value||'',cls:'assignee'},
      {key:'status',label:'Workflow',value:$('#statusFilter')?.value||'',cls:'status'},
      {key:'area',label:'Area',value:$('#areaFilter')?.value||'',cls:'view'},
      {key:'priority',label:'Priority',value:$('#priorityFilter')?.value||'',cls:'priority'},
      {key:'release',label:'Release',value:$('#releaseFilter')?.value||'',cls:'release'},
      {key:'risk',label:'Risk',value:$('#riskFilter')?.value||'',cls:'risk'},
      {key:'swimlane',label:'Swimlane',value:$('#swimlaneFilter')?.value||'',display:$('#swimlaneFilter')?.selectedOptions?.[0]?.text||'',cls:'view'},
      {key:'quick',label:'Quick',value:quickMode==='mine'?'Assigned to selected member':quickMode==='overdue'?'Overdue':'',cls:'quick'}
    ].filter(x=>x.value);
  }

  function clearBoardFilter(key){
    const map={assignee:'assigneeFilter',status:'statusFilter',area:'areaFilter',priority:'priorityFilter',release:'releaseFilter',risk:'riskFilter',swimlane:'swimlaneFilter'};
    if(key==='search' && $('#globalSearch')) $('#globalSearch').value='';
    else if(key==='quick') quickMode='clear';
    else if(map[key] && $('#'+map[key])) $('#'+map[key]).value='';
    renderBoard();
  }

  function clearAllBoardFilters(){
    ['assigneeFilter','statusFilter','areaFilter','priorityFilter','releaseFilter','riskFilter','swimlaneFilter'].forEach(id=>{if($('#'+id))$('#'+id).value='';});
    if($('#globalSearch'))$('#globalSearch').value='';
    quickMode='clear';
    renderBoard();
  }

  function renderActiveFilters(){
    const items=boardFilterState();
    const root=$('#activeFilterChips');
    if(root){root.innerHTML=items.map(x=>`<span class="filter-chip ${x.cls}" title="${esc(x.label+': '+(x.display||x.value))}"><span>${esc(x.label)}: ${esc(x.display||x.value)}</span><button type="button" data-clear-filter="${esc(x.key)}" aria-label="Remove ${esc(x.label)} filter">×</button></span>`).join('');$$('[data-clear-filter]',root).forEach(btn=>btn.addEventListener('click',()=>clearBoardFilter(btn.dataset.clearFilter)));}
    if($('#filterCount')){$('#filterCount').textContent=items.length;$('#filterCount').classList.toggle('hidden',!items.length);}
    if($('#clearFiltersBtn'))$('#clearFiltersBtn').classList.toggle('hidden',!items.length);
    if($('#filterMenuBtn'))$('#filterMenuBtn').classList.toggle('active',!!items.length);
    if(typeof syncCustomSelects==='function') syncCustomSelects();
  }

  function renderSettingsSummary(){
    if($('#settingsWorkflowCount'))$('#settingsWorkflowCount').textContent=state.statuses.length;
    if($('#settingsReleaseCount'))$('#settingsReleaseCount').textContent=state.releases.length;
    if($('#settingsBackupCount'))$('#settingsBackupCount').textContent=getBackups().length;
  }

  function attachMentionAutocomplete(textarea){
    if(!textarea || textarea.dataset.mentionsReady==='1')return;
    textarea.dataset.mentionsReady='1';
    const host=textarea.parentElement;host.classList.add('mention-host');
    const menu=document.createElement('div');menu.className='mention-menu mention-portal hidden';document.body.appendChild(menu);
    let matches=[],active=0,token=null,blurTimer=null,suppressDraw=false;
    const positionMenu=()=>{
      if(menu.classList.contains('hidden'))return;
      const rect=textarea.getBoundingClientRect(), margin=10;
      const width=Math.min(Math.max(rect.width,260),360,window.innerWidth-margin*2);
      menu.style.width=width+'px';
      const left=Math.min(Math.max(margin,rect.left),window.innerWidth-width-margin);
      const menuH=Math.min(menu.scrollHeight||220,230), below=window.innerHeight-rect.bottom-margin;
      const top=below>=Math.min(menuH,160)?rect.bottom+6:Math.max(margin,rect.top-menuH-6);
      menu.style.left=left+'px';menu.style.top=top+'px';
    };
    const hide=()=>{menu.classList.add('hidden');menu.innerHTML='';matches=[];token=null;};
    const select=(member)=>{if(!token)return;suppressDraw=true;const value=textarea.value,insert='@'+member.name+' ';textarea.value=value.slice(0,token.at)+insert+value.slice(token.caret);const pos=token.at+insert.length;hide();textarea.focus();textarea.setSelectionRange(pos,pos);textarea.dispatchEvent(new Event('input',{bubbles:true}));setTimeout(()=>{suppressDraw=false;hide();},0);};
    const draw=()=>{
      if(suppressDraw){hide();return;}
      const caret=textarea.selectionStart??textarea.value.length,before=textarea.value.slice(0,caret),m=before.match(/(^|\s)@([^@\n]*)$/);
      if(!m){hide();return;}
      const query=m[2].trim().toLowerCase(),at=caret-m[2].length-1;token={at,caret};
      matches=state.members.filter(member=>!query||member.name.toLowerCase().includes(query)).slice(0,7);active=0;if(!matches.length){hide();return;}
      menu.innerHTML=matches.map((member,i)=>`<button class="mention-option ${i===active?'active':''}" type="button" data-mention-index="${i}" style="--member-color:${memberColor(member.name)}"><span class="mention-avatar">${initials(member.name)}</span><span class="mention-copy"><strong>${esc(member.name)}</strong><small>${esc(member.role||'Team member')}</small></span></button>`).join('');
      menu.classList.remove('hidden');positionMenu();$$('[data-mention-index]',menu).forEach(btn=>{const choose=e=>{e.preventDefault();e.stopPropagation();const member=matches[Number(btn.dataset.mentionIndex)];select(member);};btn.addEventListener('pointerdown',choose,{once:true});});
    };
    textarea.addEventListener('input',draw);textarea.addEventListener('click',draw);textarea.addEventListener('keyup',e=>{if(!['ArrowDown','ArrowUp','Enter','Escape'].includes(e.key))draw();});
    textarea.addEventListener('keydown',e=>{if(menu.classList.contains('hidden')||!matches.length)return;if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();active=(active+(e.key==='ArrowDown'?1:-1)+matches.length)%matches.length;$$('.mention-option',menu).forEach((b,i)=>b.classList.toggle('active',i===active));}else if(e.key==='Enter'){e.preventDefault();select(matches[active]);}else if(e.key==='Escape'){e.preventDefault();hide();}});
    textarea.addEventListener('blur',()=>{clearTimeout(blurTimer);blurTimer=setTimeout(hide,160);});
    window.addEventListener('resize',positionMenu);window.addEventListener('scroll',positionMenu,true);
  }


  function workflowIconKey(statusName){
    return state.statusIcons?.[statusName] || DEFAULT_STATUS_ICONS[statusName] || "circle";
  }

  function workflowIconSvg(iconKey){
    const icon=WORKFLOW_ICON_LIBRARY[iconKey] || WORKFLOW_ICON_LIBRARY.circle;
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${icon.path}</svg>`;
  }

  function workflowIcon(statusName){
    const key=workflowIconKey(statusName);
    return `<span class="workflow-icon" aria-hidden="true" title="${esc(WORKFLOW_ICON_LIBRARY[key]?.label||'Workflow')}">${workflowIconSvg(key)}</span>`;
  }

  function workflowIconPickerHtml(selectedKey="circle"){
    return `<div class="workflow-icon-picker" id="workflowIconPicker" role="radiogroup" aria-label="Workflow icon">${Object.entries(WORKFLOW_ICON_LIBRARY).map(([key,icon])=>`<button class="workflow-icon-option ${key===selectedKey?'selected':''}" type="button" data-workflow-icon="${esc(key)}" role="radio" aria-checked="${key===selectedKey?'true':'false'}" title="${esc(icon.label)}"><span>${workflowIconSvg(key)}</span><small>${esc(icon.label)}</small></button>`).join('')}</div>`;
  }

  function ticketMetaIcon(kind){
    const icons={
      ticket:'<path d="M5 7h14v3a2 2 0 0 0 0 4v3H5v-3a2 2 0 0 0 0-4z"/><path d="M9 7v10"/>',
      flag:'<path d="M5 20V5m0 1h10l-1 4 1 4H5"/>',
      layers:'<path d="m12 3 8 4-8 4-8-4 8-4Z"/><path d="m4 12 8 4 8-4M4 17l8 4 8-4"/>',
      comment:'<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>',
      link:'<path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/>',
      check:'<path d="M5 12l4 4L19 6"/>'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[kind]||icons.ticket}</svg>`;
  }

  function renderBoard(){
    ensureAdvancedState();renderSavedViews();renderBoardHeroStats();
    const board=$("#board");board.innerHTML="";board.className="board";
    const swimlane=$("#swimlaneFilter")?.value||"";
    const filtered=state.tickets.filter(ticketMatches);
    const lanes=swimlane?[...new Set(filtered.map(t=>swimlane==='assignee'?(t.assignee||'Unassigned'):swimlane==='priority'?(t.priority||'None'):swimlane==='release'?(t.release||'No release'):(t.type||'Task')))]:[""];
    if(swimlane)board.className="swimlane-board";

    function makeTicket(t){
      const due=dueInfo(t);const el=document.createElement('article');el.className='ticket'+(bulkMode?' bulk-enabled':'')+(bulkSelected.has(t.id)?' bulk-selected':'');el.style.setProperty('--type-color',issueTypeColor(t.type||'Task'));el.style.setProperty('--member-color',memberColor(t.assignee));el.draggable=!bulkMode;el.tabIndex=0;el.dataset.id=t.id;
      el.innerHTML=`${bulkMode?`<input class="bulk-select" type="checkbox" aria-label="Select ${esc(t.id)}" ${bulkSelected.has(t.id)?'checked':''} />`:''}<div class="ticket-top"><span class="ticket-id-wrap">${ticketMetaIcon('ticket')}<span># ${esc(t.id)}</span></span><span class="priority ${esc(t.priority)}">${ticketMetaIcon('flag')}${esc(t.priority)}</span></div><h3>${esc(t.title)}</h3><div class="flag-row"><span class="flag type">${ticketMetaIcon('layers')}${esc(t.type||'Task')}</span>${t.release?`<span class="flag release">${ticketMetaIcon('flag')}${esc(t.release)}</span>`:''}${isBlocked(t)?`<span class="flag blocked">⛔ BLOCKED${unresolvedDependencies(t).length?` · ${unresolvedDependencies(t).length} dep.`:''}</span>`:(t.risk==='At Risk'?'<span class="flag risk">⚠ AT RISK</span>':'')}</div><div class="tags">${(t.labels||[]).map(tag=>`<span class="tag">${esc(tag)}</span>`).join('')}</div><div class="progress-block"><div class="progress-head"><span>Progress</span><strong>${normalizeProgress(t.progress)}%</strong></div><div class="progress-track"><div class="progress-fill" style="width:${normalizeProgress(t.progress)}%"></div></div></div><div class="assignee-feature" title="Assigned to ${esc(t.assignee)}"><span class="mini-avatar">${initials(t.assignee)}</span><span class="assignee-feature-copy"><small>Assigned to</small><strong>${esc(t.assignee||'Unassigned')}</strong><em>${esc(memberRole(t.assignee))}</em></span></div><div class="ticket-footer"><div class="ticket-stats"><span class="due-chip ${due.cls}">${esc(due.text)}</span><span class="stat-chip">${ticketMetaIcon('comment')}<span>${(t.comments||[]).length}</span></span>${(t.links||[]).length?`<span class="stat-chip">${ticketMetaIcon('link')}<span>${(t.links||[]).length}</span></span>`:''}${(t.subtasks||[]).filter(x=>x.text).length?`<span class="stat-chip">${ticketMetaIcon('check')}<span>${(t.subtasks||[]).filter(x=>x.done).length}/${(t.subtasks||[]).filter(x=>x.text).length}</span></span>`:''}${isFavorite(t.id)?'<span class="favorite-star" title="Favorite">★</span>':''}</div></div>`;
      if(bulkMode){const cb=$('.bulk-select',el);cb.addEventListener('click',e=>e.stopPropagation());cb.addEventListener('change',()=>{if(cb.checked)bulkSelected.add(t.id);else bulkSelected.delete(t.id);updateBulkBar();el.classList.toggle('bulk-selected',cb.checked);});el.addEventListener('click',e=>{if(e.target===cb)return;cb.checked=!cb.checked;cb.dispatchEvent(new Event('change'));});}
      else{el.addEventListener('click',()=>openTicketModal(t.id));el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openTicketModal(t.id);}});el.addEventListener('dragstart',e=>{el.classList.add('dragging');e.dataTransfer.setData('text/plain',t.id);e.dataTransfer.effectAllowed='move';});el.addEventListener('dragend',()=>el.classList.remove('dragging'));}
      return el;
    }

    function buildColumns(list,container){
      const boardOrder=ensureSharedWorkflowOrder();
      boardOrder.forEach(statusName=>{
        const tickets=list.filter(t=>t.status===statusName);const limit=wipLimitFor(statusName);const exceeded=limit&&tickets.length>limit;const col=document.createElement('section');col.className='column'+(exceeded?' wip-exceeded':'');col.dataset.status=statusName;col.innerHTML=`<div class="column-head">${workflowIcon(statusName)}<strong>${esc(statusName)}</strong><span class="count">${tickets.length}${limit?` / ${limit}`:''}</span>${exceeded?'<span class="wip-warning">WIP exceeded</span>':''}<button class="add" type="button" aria-label="Add ticket">＋</button></div><div class="cards"></div>`;$('.add',col).onclick=()=>openTicketModal(null,statusName);const cards=$('.cards',col);tickets.forEach(t=>cards.appendChild(makeTicket(t)));if(!tickets.length)cards.innerHTML='<div class="empty">No matching tickets</div>';
        if(!bulkMode){col.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='move';col.classList.add('drag-over');});col.addEventListener('dragleave',e=>{if(!col.contains(e.relatedTarget))col.classList.remove('drag-over');});col.addEventListener('drop',e=>{e.preventDefault();col.classList.remove('drag-over');const id=e.dataTransfer.getData('text/plain');const ticket=state.tickets.find(t=>t.id===id);if(ticket&&ticket.status!==statusName){const old=ticket.status;ticket.status=statusName;ticket.history=ticket.history||[];ticket.history.unshift(`Status changed to ${statusName}`);logActivity('move',ticket,`Moved ${old} → ${statusName}`);saveState();refreshDataViews();toast(`${id} moved to ${statusName}`);}});}
        container.appendChild(col);
      });
    }

    if(swimlane){lanes.forEach(lane=>{const wrap=document.createElement('section');wrap.className='swimlane';const list=filtered.filter(t=>(swimlane==='assignee'?(t.assignee||'Unassigned'):swimlane==='priority'?(t.priority||'None'):swimlane==='release'?(t.release||'No release'):(t.type||'Task'))===lane);wrap.innerHTML=`<div class="swimlane-head"><strong>${esc(lane)}</strong><span>${list.length} ticket${list.length===1?'':'s'}</span></div><div class="board"></div>`;buildColumns(list,$('.board',wrap));board.appendChild(wrap);});}else buildColumns(filtered,board);
    renderQuickFilters();renderActiveFilters();updateBulkBar();
  }

  function updateBulkBar(){
    const bar=$("#bulkBar"),btn=$("#bulkModeBtn"),count=bulkSelected.size;
    if(!bar||!btn)return;
    bar.classList.toggle('hidden',!bulkMode);
    bar.classList.toggle('empty-selection',count===0);
    $("#bulkCount").textContent=count;
    if($("#bulkApplyCount"))$("#bulkApplyCount").textContent=count;
    const badge=$("#bulkModeBadge");if(badge){badge.textContent=count;badge.classList.toggle('hidden',!bulkMode||count===0);}
    const apply=$("#applyBulk");if(apply)apply.disabled=count===0;
    const visibleIds=state.tickets.filter(ticketMatches).map(t=>t.id),allVisible=visibleIds.length>0&&visibleIds.every(id=>bulkSelected.has(id));
    const selectVisible=$("#bulkSelectVisible");if(selectVisible)selectVisible.textContent=allVisible?'Deselect visible':`Select visible${visibleIds.length?` (${visibleIds.length})`:''}`;
    btn.classList.toggle('active',bulkMode);btn.setAttribute('aria-pressed',String(bulkMode));
    const title=$('.bulk-mode-copy strong',btn),hint=$('.bulk-mode-copy small',btn);
    if(title)title.textContent=bulkMode?'Bulk mode active':'Bulk edit';
    if(hint)hint.textContent=bulkMode?(count?`${count} ticket${count===1?'':'s'} selected`:'Select tickets on the board'):'Multi-select tickets';
  }

  function renderTeam(){
    const isAdmin=cloudUser?.role==="admin";
    const linkedSelf=linkedMemberForCurrentUser();
    $("#teamGrid").innerHTML = state.members.map(m=>`
      <div class="member-card" style="--member-color:${memberColor(m.name)}">
        <div class="member-avatar">${initials(m.name)}</div>
        <div class="member-info">
          <strong>${esc(m.name)}</strong>
          <small>${esc(m.role || "Team member")}</small>
          <div class="member-color-line"><span class="member-color-dot"></span><span>${m.authUsername?`Linked to @${esc(m.authUsername)}`:'Not linked to a login user'}</span></div>
        </div>
        <button class="btn small" type="button" data-edit-member="${esc(m.id)}">${isAdmin?'Manage':linkedSelf?.id===m.id?'My profile':'View'}</button>
      </div>
    `).join("");
    $$('[data-edit-member]').forEach(btn=>btn.addEventListener('click',()=>{const member=state.members.find(m=>m.id===btn.dataset.editMember);if(!member)return;if(isAdmin)openMemberModal(member.id);else if(linkedSelf?.id===member.id)openPersonalProfileModal();else openMemberModal(member.id,{readOnly:true});}));
  }

  function renderStatusEditor(){
    const savedOrder=ensureSharedWorkflowOrder();
    const isAdmin=cloudUser?.role==="admin";
    const order=isAdmin?currentWorkflowOrderDraft():savedOrder;
    const dirty=isAdmin&&workflowOrderDraftChanged();
    $("#statusEditor").innerHTML = order.map((statusName,i)=>{
      const count=state.tickets.filter(t=>t.status===statusName).length;
      const sharedIndex=state.statuses.indexOf(statusName);
      return `
      <div class="status-setting-row">
        <div class="status-setting-main"><span class="settings-workflow-icon">${workflowIconSvg(workflowIconKey(statusName))}</span><div><strong>${esc(statusName)}</strong><small>${count} ticket${count===1?"":"s"} · ${esc(WORKFLOW_ICON_LIBRARY[workflowIconKey(statusName)]?.label||"General")} · ${dirty?`Draft position ${i+1}`:`Saved position ${i+1}`}</small></div></div>
        <div class="work-order-actions">
          ${isAdmin?`<button class="btn small" type="button" data-board-status-move="up" data-board-status="${esc(statusName)}" ${i===0?"disabled":""} title="Move workflow left in draft">←</button>
          <button class="btn small" type="button" data-board-status-move="down" data-board-status="${esc(statusName)}" ${i===order.length-1?"disabled":""} title="Move workflow right in draft">→</button>`:'<span class="note">Admin controlled</span>'}
          ${isAdmin?`<button class="btn small status-remove-btn" type="button" data-remove-status="${sharedIndex}" ${state.statuses.length<=1?"disabled":""}>Remove</button>`:''}
        </div>
      </div>`;
    }).join("") + (isAdmin?`<div class="workflow-order-savebar" style="display:flex;align-items:center;gap:10px;justify-content:flex-end;padding:14px 2px 2px;border-top:1px solid var(--border);margin-top:10px"><span class="note" style="margin-right:auto">${dirty?'Workflow order has unsaved changes. Other users still see the last saved order.':'Workflow order is saved and shared with everyone.'}</span>${dirty?'<button class="btn" id="discardWorkflowOrder" type="button">Discard</button><button class="btn primary" id="saveWorkflowOrder" type="button">Save workflow order</button>':''}</div>`:'');

    $$('[data-board-status-move]').forEach(btn=>btn.addEventListener('click',()=>moveWorkflowDraft(btn.dataset.boardStatus,btn.dataset.boardStatusMove)));
    $("#saveWorkflowOrder")?.addEventListener("click",saveWorkflowOrderDraft);
    $("#discardWorkflowOrder")?.addEventListener("click",discardWorkflowOrderDraft);
    $$('[data-remove-status]').forEach(btn=>btn.addEventListener("click",()=>openRemoveWorkflowModal(Number(btn.dataset.removeStatus))));
    renderSettingsSummary();
  }

  function openRemoveWorkflowModal(index){
    if(cloudUser?.role!=="admin"){toast("Administrator access required");return;}
    const workflow=state.statuses[index];
    if(!workflow) return;
    const alternatives=state.statuses.filter((_,i)=>i!==index);
    if(!alternatives.length){toast("Keep at least one workflow status");return;}
    const affected=state.tickets.filter(t=>t.status===workflow);
    const suggested=alternatives[Math.min(index,alternatives.length-1)] || alternatives[0];
    const preview=affected.slice(0,5);
    $("#modalRoot").innerHTML=`
      <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Remove workflow">
        <div class="modal" style="max-width:650px">
          <div class="modal-head"><h2>Remove workflow</h2><button id="closeModal" class="modal-close" type="button">×</button></div>
          <div class="modal-body">
            <div class="workflow-remove-hero">
              <div class="workflow-remove-icon">↯</div>
              <div><strong>Remove “${esc(workflow)}”?</strong><p>${affected.length?`${affected.length} ticket${affected.length===1?" is":"s are"} currently in this workflow. TeamFlow will move ${affected.length===1?"it":"them"} before removing the column.`:"No tickets currently use this workflow. You can remove it safely."}</p></div>
            </div>
            ${affected.length?`
              <div class="workflow-migration">
                <div class="workflow-node"><small>From</small><strong>${esc(workflow)} · ${affected.length} ticket${affected.length===1?"":"s"}</strong></div>
                <div class="workflow-arrow">→</div>
                <div class="workflow-node"><small>Move tickets to</small><select id="workflowDestination" class="control" style="width:100%">${alternatives.map(s=>`<option ${s===suggested?"selected":""}>${esc(s)}</option>`).join("")}</select></div>
              </div>
              <div class="workflow-ticket-list">${preview.map(t=>`<div class="workflow-ticket-row"><b>${esc(t.id)}</b><strong>${esc(t.title)}</strong><span>${normalizeProgress(t.progress)}%</span></div>`).join("")}${affected.length>preview.length?`<div class="note">+ ${affected.length-preview.length} more ticket${affected.length-preview.length===1?"":"s"} will be moved.</div>`:""}</div>
              <p class="note" style="margin-top:11px">Each migrated ticket will receive a history entry showing that “${esc(workflow)}” was removed and which workflow it moved to.</p>
            `:`<p class="note" style="margin-top:12px">This only removes the workflow column. Other TeamFlow data is unchanged.</p>`}
          </div>
          <div class="modal-actions"><div class="spacer"></div><button id="cancelWorkflowRemove" class="btn" type="button">Cancel</button><button id="confirmWorkflowRemove" class="btn danger" type="button">${affected.length?`Move ${affected.length} & remove workflow`:"Remove workflow"}</button></div>
        </div>
      </div>`;
    const close=()=>$("#modalRoot").innerHTML="";
    $("#closeModal").addEventListener("click",close);
    $("#cancelWorkflowRemove").addEventListener("click",close);
    $(".modal-backdrop").addEventListener("click",e=>{if(e.target===e.currentTarget)close();});
    $("#confirmWorkflowRemove").addEventListener("click",()=>{
      const destination=affected.length?$("#workflowDestination").value:"";
      if(affected.length && !alternatives.includes(destination)){toast("Choose a destination workflow");return;}
      affected.forEach(ticket=>{
        ticket.status=destination;
        ticket.history=ticket.history||[];
        ticket.history.unshift(`Workflow "${workflow}" removed; moved to ${destination}`);
      });
      state.statuses.splice(index,1);
      state.settings=state.settings||{};state.settings.workflowOrder=ensureSharedWorkflowOrder().filter(name=>name!==workflow);state.workflowOrder=state.settings.workflowOrder.slice();state.statuses=state.settings.workflowOrder.slice();
      if(state.statusIcons) delete state.statusIcons[workflow];
      ensureMyWorkPrefs();
      saveState();
      close();
      renderMemberSelects();
      renderStatusEditor();
      renderWipEditor();
      refreshDataViews();
      toast(affected.length?`${affected.length} ticket${affected.length===1?"":"s"} moved to ${destination}; ${workflow} removed`:`${workflow} removed`);
    });
  }

  function nextTicketId(){
    const nums = state.tickets.map(t=>{
      const match = String(t.id).match(/\d+/);
      return match ? Number(match[0]) : 0;
    });
    return "GIS-" + String(Math.max(100,...nums)+1).padStart(3,"0");
  }

  function collaboratorChecks(selected){
    const set = new Set(selected || []);
    return state.members.map(m=>`
      <label class="check">
        <input type="checkbox" name="collab" value="${esc(m.name)}" ${set.has(m.name)?"checked":""} />
        <span>${esc(m.name)}</span>
      </label>
    `).join("");
  }

  function linkRowsHtml(links){
    const rows=(links&&links.length?links:[{title:"",url:"",chapter:""}]);
    return rows.map(l=>`<div class="link-row">
      <input class="doc-link-title" placeholder="Document title" value="${esc(l.title||"")}" />
      <input class="doc-link-url" type="text" inputmode="url" placeholder="google.com or https://..." value="${esc(l.url||"")}" />
      <input class="doc-link-chapter" placeholder="Chapter / section" value="${esc(l.chapter||"")}" />
      <button class="link-open" type="button" title="Open documentation" ${l.url?'':'disabled'}>Open</button>
      <button class="link-remove" type="button" title="Remove link">×</button>
    </div>`).join("");
  }

  function dependencyPickerHtml(ticket,otherTickets){
    const selected=new Set(ticket.dependencies||[]);
    const selectedTickets=otherTickets.filter(t=>selected.has(t.id));
    return `
      <div class="dependency-picker" id="dependencyPicker">
        <button class="dependency-trigger" id="dependencyTrigger" type="button" aria-expanded="false">
          <span><b>Linked blockers</b><small id="dependencySummary">${selected.size?`${selected.size} ticket${selected.size===1?"":"s"} selected`:"No dependencies selected"}</small></span>
          <span class="dependency-chevron">⌄</span>
        </button>
        <div id="dependencySelected" class="dependency-selected">${selectedTickets.map(t=>`<span class="dependency-pill" data-dep-pill="${esc(t.id)}"><b>${esc(t.id)}</b><span>${esc(t.title)}</span></span>`).join("") || '<span class="dependency-empty">Nothing selected</span>'}</div>
        <div class="dependency-menu hidden" id="dependencyMenu">
          <div class="dependency-search-wrap"><span>⌕</span><input id="dependencySearch" type="search" placeholder="Search ticket ID or title..." /></div>
          <div id="dependencyOptions" class="dependency-options">
            ${otherTickets.map(t=>`<label class="dependency-option" data-dep-search="${esc((t.id+" "+t.title+" "+t.status).toLowerCase())}"><input type="checkbox" name="dependencyChoice" value="${esc(t.id)}" ${selected.has(t.id)?"checked":""} /><span class="dependency-check">✓</span><span class="dependency-option-copy"><b>${esc(t.id)}</b><strong>${esc(t.title)}</strong><small>${esc(t.status)} · ${normalizeProgress(t.progress)}%</small></span></label>`).join("")}
          </div>
        </div>
      </div>`;
  }

  function editorIcon(name){
    const paths={
      layers:'<path d="M12 3 3.5 7.5 12 12l8.5-4.5L12 3Z"/><path d="m3.5 12 8.5 4.5 8.5-4.5"/>',
      flag:'<path d="M5 21V4"/><path d="M5 4h10l-1 4 1 4H5"/>',
      title:'<path d="M4 6h16"/><path d="M9 6v12"/><path d="M15 6v12"/>',
      file:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h5"/>',
      user:'<circle cx="12" cy="8" r="3"/><path d="M5 21c.8-4 3.1-6 7-6s6.2 2 7 6"/>',
      status:'<path d="M4 12h5l2-5 3 10 2-5h4"/>',
      area:'<path d="M12 3 4 7l8 4 8-4-8-4Z"/><path d="m4 12 8 4 8-4"/><path d="m4 17 8 4 8-4"/>',
      priority:'<path d="m7 15 5-6 5 6"/><path d="M12 9v11"/>',
      alert:'<path d="M12 4 3 20h18L12 4Z"/><path d="M12 9v5"/><path d="M12 17h.01"/>',
      bolt:'<path d="m13 2-8 12h6l-1 8 9-13h-6z"/>',
      link:'<path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/>',
      chart:'<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20v-4"/>',
      tag:'<path d="M20 13 13 20l-9-9V4h7l9 9Z"/><circle cx="8.5" cy="8.5" r="1.2"/>',
      calendar:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>',
      check:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8 12 2.5 2.5L16 9"/>',
      users:'<circle cx="9" cy="8" r="3"/><path d="M3 20c.6-3.6 2.6-5.5 6-5.5s5.4 1.9 6 5.5"/><circle cx="17" cy="9" r="2"/><path d="M15 15c3.2-.2 5.2 1.5 6 5"/>',
      comment:'<path d="M4 5h16v11H9l-5 4V5Z"/>',
      history:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
      details:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>'
    };
    return `<span class="editor-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name]||paths.details}</svg></span>`;
  }

  function ticketForm(ticket){
    const otherTickets=state.tickets.filter(t=>t.id!==ticket.id);
    return `
      <div class="editor-layout">
        <section class="editor-card editor-card-template">
          <div class="editor-two editor-two-top">
            <div class="field editor-field">
              <label>${editorIcon('layers')}<span>Template / Issue type</span></label>
              <select id="ticketType">${Object.keys(TICKET_TEMPLATES).map(v=>`<option ${v===(ticket.type||"Task")?"selected":""}>${esc(v)}</option>`).join("")}</select>
            </div>
            <div class="field editor-field">
              <label>${editorIcon('flag')}<span>Release / Milestone</span></label>
              <select id="ticketRelease">${state.releases.map(v=>`<option ${v===(ticket.release||"")?"selected":""}>${esc(v)}</option>`).join("")}</select>
            </div>
          </div>
          <div class="editor-template-note"><span>i</span> Templates can prefill priority, area, labels and description for new tickets.</div>
        </section>

        <section class="editor-card editor-card-copy">
          <div class="field editor-field">
            <label>${editorIcon('title')}<span>Title *</span></label>
            <input id="ticketTitle" value="${esc(ticket.title||"")}" placeholder="Describe the task" />
          </div>
          <div class="field editor-field">
            <label>${editorIcon('file')}<span>Description</span></label>
            <textarea id="ticketDescription" placeholder="Add details, context, acceptance notes...">${esc(ticket.description||"")}</textarea>
          </div>
        </section>

        <section class="editor-card editor-paired-card">
          <div class="editor-two editor-two-fields">
            <div class="editor-stack">
              <div class="field editor-field">
                <label>${editorIcon('user')}<span>Assignee</span></label>
                <select id="ticketAssignee">${state.members.length?state.members.map(m=>`<option ${m.name===ticket.assignee?"selected":""}>${esc(m.name)}</option>`).join(""):`<option value="">Unassigned</option>`}</select>
              </div>
              <div class="field editor-field">
                <label>${editorIcon('area')}<span>Area / ARCH / BE / FE</span></label>
                <select id="ticketArea">${["ARCH","BE","FE","QA"].map(v=>`<option ${v===ticket.area?"selected":""}>${v}</option>`).join("")}</select>
              </div>
              <div class="field editor-field">
                <label>${editorIcon('alert')}<span>Risk / Delivery flag</span></label>
                <select id="ticketRisk">${["None","At Risk","Blocked"].map(v=>`<option ${v===(ticket.risk||"None")?"selected":""}>${v}</option>`).join("")}</select>
              </div>
            </div>
            <div class="editor-stack">
              <div class="field editor-field">
                <label>${editorIcon('status')}<span>Status</span></label>
                <select id="ticketStatus">${state.statuses.map(s=>`<option ${s===ticket.status?"selected":""}>${esc(s)}</option>`).join("")}</select>
              </div>
              <div class="field editor-field">
                <label>${editorIcon('flag')}<span>Priority</span></label>
                <select id="ticketPriority">${["High","Medium","Low"].map(v=>`<option ${v===ticket.priority?"selected":""}>${v}</option>`).join("")}</select>
              </div>
              <div class="field editor-field">
                <label>${editorIcon('bolt')}<span>Sprint / Wave</span></label>
                <input id="ticketSprint" value="${esc(ticket.sprint||"")}" />
              </div>
            </div>
          </div>
        </section>

        <section class="editor-card editor-single-row">
          <div class="field editor-field">
            <label>${editorIcon('tag')}<span>Blocker / Risk Note</span></label>
            <input id="ticketBlockerNote" value="${esc(ticket.blockerNote||"")}" placeholder="What is blocking or putting delivery at risk?" />
          </div>
        </section>

        <section class="editor-card editor-dependency-card">
          <div class="field editor-field">
            <label>${editorIcon('link')}<span>Depends on / Blocked by</span></label>
            ${dependencyPickerHtml(ticket,otherTickets)}
            <div class="dependency-note">Search and check one or more tickets. Any unfinished dependency automatically marks this ticket as blocked.</div>
          </div>
        </section>

        <section class="editor-card editor-progress-card">
          <div class="editor-two editor-two-fields">
            <div class="editor-stack">
              <div class="field editor-field">
                <label>${editorIcon('chart')}<span>Progress</span></label>
                <div class="progress-editor">
                  <input id="ticketProgressRange" type="range" min="0" max="100" step="1" value="${normalizeProgress(ticket.progress)}" />
                  <div class="progress-number"><input id="ticketProgress" type="number" min="0" max="100" step="1" value="${normalizeProgress(ticket.progress)}" /><span>%</span></div>
                </div>
              </div>
              <div class="field editor-field">
                <label>${editorIcon('calendar')}<span>Start date</span></label>
                <input id="ticketStart" type="date" value="${esc(ticket.start||"")}" />
              </div>
            </div>
            <div class="editor-stack">
              <div class="field editor-field">
                <label>${editorIcon('tag')}<span>Labels (comma-separated)</span></label>
                <input id="ticketLabels" value="${esc((ticket.labels||[]).join(", "))}" placeholder="e.g. API, backend, performance" />
              </div>
              <div class="field editor-field">
                <label>${editorIcon('calendar')}<span>Expected end date</span></label>
                <input id="ticketEnd" type="date" value="${esc(ticket.end||"")}" />
              </div>
            </div>
          </div>
        </section>

        <section class="editor-card editor-list-card">
          <div class="editor-section-heading">${editorIcon('check')}<strong>Checklist / Subtasks</strong></div>
          <div id="subtaskRows" class="subtask-list editor-subtask-list">${subtaskRowsHtml(ticket.subtasks||[])}</div>
          <div class="editor-card-footer">
            <button id="addSubtaskRow" class="editor-link-button" type="button">+ Add checklist item</button>
            <label class="editor-auto-progress"><input id="autoProgress" type="checkbox" ${ticket.autoProgress?'checked':''} /><span>Calculate progress from checklist</span></label>
          </div>
        </section>

        <section class="editor-card editor-list-card">
          <div class="editor-section-heading">${editorIcon('link')}<strong>Documentation Links</strong></div>
          <div id="linkRows" class="link-rows editor-link-rows">${linkRowsHtml(ticket.links||[])}</div>
          <div class="editor-card-footer editor-doc-footer"><button id="addDocLinkRow" class="editor-link-button" type="button">+ Add documentation link</button><span class="note">Add the URL plus a chapter, section, page, or reference.</span></div>
        </section>

        <section class="editor-card editor-list-card editor-collaborator-card">
          <div class="editor-section-heading">${editorIcon('users')}<strong>Team Members / Collaborators</strong></div>
          <div class="check-grid editor-collab-grid">${collaboratorChecks(ticket.collaborators)}</div>
        </section>
      </div>
    `;
  }

  function openTicketModal(ticketId=null,presetStatus="To be started"){
    if(ticketId){
      ticketDetailStack=[];
      return openTicketDetails(ticketId,{preserveStack:true});
    }
    return openTicketEditor(null,presetStatus);
  }

  function openQuickChecklistModal(ticketId){
    const ticket=state.tickets.find(t=>t.id===ticketId);if(!ticket)return;
    const root=$('#confirmRoot');
    root.innerHTML=`<div class="notice-backdrop" role="dialog" aria-modal="true" aria-label="Add checklist item"><div class="notice-dialog" style="width:min(480px,100%)"><div class="notice-hero"><div class="notice-icon">✓</div><div><h2>Add checklist item</h2><p>Add a new subtask to ${esc(ticket.id)} without leaving Ticket Details.</p></div></div><div class="notice-body"><div class="field"><label>Checklist item</label><input id="quickChecklistText" class="control" placeholder="e.g. Validate SIT deployment" /></div></div><div class="notice-actions"><button class="btn" id="quickChecklistCancel" type="button">Cancel</button><button class="btn primary" id="quickChecklistSave" type="button">Add item</button></div></div></div>`;
    const close=()=>{root.innerHTML='';};
    $('#quickChecklistCancel').onclick=close;
    $('#quickChecklistSave').onclick=()=>{const text=$('#quickChecklistText').value.trim();if(!text){$('#quickChecklistText').focus();return;}ticket.subtasks=ticket.subtasks||[];ticket.subtasks.push({id:'st'+Date.now()+Math.random().toString(36).slice(2,5),text,done:false});if(ticket.autoProgress)ticket.progress=calcSubtaskProgress(ticket.subtasks);ticket.history=ticket.history||[];ticket.history.unshift(`Checklist item added: ${text}`);logActivity('update',ticket,`Checklist item added: ${text}`);saveState();close();refreshDataViews();openTicketDetails(ticketId,{preserveStack:true});toast('Checklist item added');};
    $('.notice-backdrop',root).addEventListener('click',e=>{if(e.target===e.currentTarget)close();});
    $('#quickChecklistText').addEventListener('keydown',e=>{if(e.key==='Enter'){$('#quickChecklistSave').click();}});
    setTimeout(()=>$('#quickChecklistText')?.focus(),0);
  }

  function openTicketDetails(ticketId,options={}){
    if(!options.preserveStack) ticketDetailStack=[];
    const t=state.tickets.find(x=>x.id===ticketId);
    if(!t) return;
    ensureAdvancedState();rememberRecent(ticketId);
    const deps=(t.dependencies||[]).map(id=>state.tickets.find(x=>x.id===id)).filter(Boolean);
    const downstream=state.tickets.filter(x=>x.id!==t.id && (x.dependencies||[]).includes(t.id));
    const progress=normalizeProgress(t.progress);
    const typeColor=issueTypeColor(t.type||"Task");
    const docs=(t.links||[]);
    const collaborators=(t.collaborators||[]);
    const checklistItems=(t.subtasks||[]).filter(x=>x.text);
    const completedChecklist=checklistItems.filter(x=>x.done).length;
    const checklistPct=checklistItems.length?Math.round((completedChecklist/checklistItems.length)*100):0;
    const history=(t.history||[]);
    const dIcon=inner=>`<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
    const dIcons={
      ticket:dIcon('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3.5h6v4H9zM9 12h6M9 16h4"/>'),
      favorite:dIcon('<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.4l6.1-.9z"/>'),
      duplicate:dIcon('<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>'),
      edit:dIcon('<path d="M4 20h4l11-11-4-4L4 16v4zM13.5 6.5l4 4"/>'),
      description:dIcon('<path d="M6 3h9l3 3v15H6zM14 3v4h4M9 11h6M9 15h6"/>'),
      checklist:dIcon('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="m7 10 2 2 4-4M14 11h3M7 16h10"/>'),
      dependency:dIcon('<path d="M9 7H6a4 4 0 0 0 0 8h3M15 7h3a4 4 0 0 1 0 8h-3M8 11h8"/>'),
      blocking:dIcon('<path d="M12 3v14M7 8l5-5 5 5M5 21h14"/>'),
      docs:dIcon('<path d="M14 3h5v5M19 3l-8 8M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'),
      comments:dIcon('<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>'),
      user:dIcon('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
      info:dIcon('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>'),
      labels:dIcon('<path d="M3 11V5a2 2 0 0 1 2-2h6l10 10-8 8L3 11z"/><circle cx="8" cy="8" r="1"/>'),
      collaborators:dIcon('<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M14 20a5 5 0 0 1 7 0"/>'),
      flag:dIcon('<path d="M5 21V4M5 5h10l-2 4 2 4H5"/>'),
      chevron:dIcon('<path d="m7 14 5-5 5 5"/>'),
      send:dIcon('<path d="m3 11 17-8-7 18-2-7-8-3zM11 14l4-4"/>'),
      close:dIcon('<path d="M6 6l12 12M18 6 6 18"/>'),
      delete:dIcon('<path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/>')
    };
    const riskBlocked=isBlocked(t);
    const backTicketId=ticketDetailStack[ticketDetailStack.length-1]||"";
    const backTicket=backTicketId?state.tickets.find(x=>x.id===backTicketId):null;
    $("#modalRoot").innerHTML=`
      <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Ticket ${esc(t.id)} details">
        <div class="modal detail-modal" data-detail-view="details" style="--type-color:${typeColor};--member-color:${memberColor(t.assignee)}">
          <div class="detail-windowbar">
            <div class="detail-window-icon">${dIcons.ticket}</div>
            <div class="detail-window-title">Ticket Details</div>
            <div class="detail-window-actions">
              <button id="detailHeaderEdit" class="detail-icon-action" type="button" title="Edit ticket">${dIcons.edit}</button>
              <button id="detailHeaderFavorite" class="detail-icon-action" type="button" title="${isFavorite(t.id)?'Remove from favorites':'Add to favorites'}">${dIcons.favorite}</button>
              <button id="detailHeaderDuplicate" class="detail-icon-action" type="button" title="Duplicate ticket">${dIcons.duplicate}</button>
              <button id="closeModal" class="detail-icon-action detail-x" type="button" aria-label="Close">${dIcons.close}</button>
            </div>
          </div>

          <div class="detail-hero">
            <div class="detail-hero-main">
              ${backTicket?`<button id="detailBack" class="detail-back" type="button">← Back to ${esc(backTicket.id)} · ${esc(backTicket.title)}</button>`:""}
              <div class="detail-eyebrow"><span class="ticket-id">${esc(t.id)}</span><span class="detail-type">${esc(t.type||"Task")}</span>${riskBlocked?'<span class="flag blocked">⛔ BLOCKED</span>':t.risk==="At Risk"?'<span class="flag risk">⚠ AT RISK</span>':''}</div>
              <div class="detail-title-line"><h2>${esc(t.title)}</h2></div>
              <div class="detail-status-row">
                <span class="detail-status-control">${esc(t.status)}</span>
                <span class="detail-status-sep"></span>
                <span class="detail-status-meta">◆ ${esc(t.release||"No release")}</span>
                <span class="detail-status-meta">${esc(t.area||"—")}</span>
                <span class="detail-status-meta">${esc(t.sprint||"—")}</span>
              </div>
            </div>
            <div class="detail-hero-right">
              <span class="detail-priority-large">${dIcons.flag}${esc(t.priority)}</span>
              <div class="progress-orb" style="--progress-angle:${progress*3.6}deg"><div><strong>${progress}%</strong><small>Progress</small></div></div>
            </div>
          </div>

          <div class="detail-tabsbar">
            <button class="detail-tab active" data-detail-nav="details" type="button">${dIcons.description}<span>Details</span></button>
            <button class="detail-tab" data-detail-nav="comments" type="button">${dIcons.comments}<span>Comments (${(t.comments||[]).length})</span></button>
            <button class="detail-tab" data-detail-nav="attachments" type="button">${dIcons.docs}<span>Attachments (${docs.length})</span></button>
            <button class="detail-tab" data-detail-nav="history" type="button">${dIcons.ticket}<span>History</span></button>
          </div>

          <div class="detail-body">
            <div class="detail-main" id="detailMainColumn">
              <section class="detail-section" id="detailDescriptionSection">
                <button class="detail-section-head" data-detail-collapse type="button"><span class="detail-section-icon">${dIcons.description}</span><h3>Description</h3><span class="detail-chevron">${dIcons.chevron}</span></button>
                <div class="detail-section-content"><div class="detail-description">${esc(t.description||"No description provided.").replace(/\n/g,"<br>")}</div></div>
              </section>

              <section class="detail-section" id="detailChecklistSection">
                <button class="detail-section-head" data-detail-collapse type="button"><span class="detail-section-icon">${dIcons.checklist}</span><h3>Checklist</h3><span class="detail-check-summary">${completedChecklist} / ${checklistItems.length}${checklistItems.length?` (${checklistPct}%)`:''}<span class="detail-check-progress"><span style="width:${checklistPct}%"></span></span></span><span class="detail-chevron">${dIcons.chevron}</span></button>
                <div class="detail-section-content"><div class="subtask-list">${checklistItems.length?checklistItems.map(s=>`<label class="subtask-detail ${s.done?'done':''}"><input data-detail-subtask="${esc(s.id)}" type="checkbox" ${s.done?'checked':''} /><span>${esc(s.text)}</span></label>`).join(''):'<div class="detail-empty detail-empty-with-icon"><span class="detail-empty-icon">✓</span><span>No checklist items yet</span></div>'}</div><button class="detail-add-inline detail-add-after-list" data-detail-add-checklist type="button">＋ Add checklist item</button></div>
              </section>

              <section class="detail-section" id="detailDependencySection">
                <button class="detail-section-head" data-detail-collapse type="button"><span class="detail-section-icon">${dIcons.dependency}</span><h3>Depends on / Blocked by</h3><span class="section-count">${deps.length}</span><span class="detail-chevron">${dIcons.chevron}</span></button>
                <div class="detail-section-content"><div class="detail-relation-note">These tickets must progress or finish before this ticket is considered unblocked.</div><div class="detail-deps">${deps.length?deps.map(d=>`<button class="detail-dependency" data-detail-ticket="${esc(d.id)}" type="button"><span class="dependency-state ${["Done","Deployed on SIT","Deprecated"].includes(d.status)?"done":"open"}"></span><span><b>${esc(d.id)}</b><strong>${esc(d.title)}</strong><small>${esc(d.status)} · ${normalizeProgress(d.progress)}%</small></span></button>`).join(""):'<div class="detail-empty-action"><span class="detail-empty-icon">↗</span><button class="detail-add-inline" data-detail-edit-section type="button">＋ Add dependency</button></div>'}</div></div>
              </section>

              <section class="detail-section" id="detailBlockingSection">
                <button class="detail-section-head" data-detail-collapse type="button"><span class="detail-section-icon">${dIcons.blocking}</span><h3>This ticket is blocking</h3><span class="section-count">${downstream.length}</span><span class="detail-chevron">${dIcons.chevron}</span></button>
                <div class="detail-section-content"><div class="detail-relation-note">These downstream tickets list ${esc(t.id)} as a dependency.</div><div class="detail-deps">${downstream.length?downstream.map(d=>`<button class="detail-dependency" data-detail-ticket="${esc(d.id)}" type="button"><span class="dependency-state ${["Done","Deployed on SIT","Deprecated"].includes(d.status)?"done":"open"}"></span><span><b>${esc(d.id)}</b><strong>${esc(d.title)}</strong><small>${esc(d.status)} · ${normalizeProgress(d.progress)}%</small></span></button>`).join(""):'<div class="detail-empty detail-empty-with-icon"><span class="detail-empty-icon">⌘</span><span>No tickets currently depend on this one</span></div>'}</div></div>
              </section>

              <section class="detail-section" id="detailDocsSection">
                <button class="detail-section-head" data-detail-collapse type="button"><span class="detail-section-icon">${dIcons.docs}</span><h3>Attachments & Documentation</h3><span class="section-count">${docs.length}</span><span class="detail-chevron">${dIcons.chevron}</span></button>
                <div class="detail-section-content"><div class="detail-docs">${docs.length?docs.map((d,i)=>`<button class="detail-doc" data-doc-index="${i}" type="button"><span class="detail-doc-icon">↗</span><span><strong>${esc(d.title||"Documentation")}</strong><small>${esc(d.chapter||"Open reference")}</small></span></button>`).join(""):'<button class="detail-add-inline" data-detail-edit-section type="button">＋ Add documentation link</button>'}</div></div>
              </section>

              <section class="detail-section detail-comments-section" id="detailCommentsSection">
                <div class="detail-section-head detail-comments-top"><span class="detail-section-icon">${dIcons.comments}</span><h3>Comments</h3><span class="section-count">${(t.comments||[]).length}</span><span class="detail-sort-chip">Newest</span></div>
                <div class="detail-section-content"><div class="comments">${(t.comments||[]).length?(t.comments||[]).slice().reverse().map(c=>commentHtml(c,t)).join(""):'<div class="detail-empty">No comments yet</div>'}</div><div class="detail-comment-compose" style="--member-color:${memberColor(state.currentMember)}"><span class="compose-avatar">${initials(state.currentMember)}</span><textarea id="detailCommentText" placeholder="Add a comment..."></textarea><button id="detailSendComment" class="detail-send" type="button" aria-label="Send comment">${dIcons.send}</button></div></div>
              </section>

              <section class="detail-section" id="detailHistorySection">
                <button class="detail-section-head" data-detail-collapse type="button"><span class="detail-section-icon">${dIcons.ticket}</span><h3>History</h3><span class="section-count">${history.length}</span><span class="detail-chevron">${dIcons.chevron}</span></button>
                <div class="detail-section-content"><div class="detail-history-list">${history.length?history.slice(0,20).map(h=>`<div class="detail-history-item">${esc(h)}</div>`).join(''):'<div class="detail-empty">No history yet</div>'}</div></div>
              </section>
            </div>

            <aside class="detail-side">
              <div class="detail-assignee-card">
                <div class="detail-side-title">${dIcons.user}<span>Assigned to</span></div>
                <div class="detail-assignee" style="--member-color:${memberColor(t.assignee)}"><span class="member-avatar">${initials(t.assignee)}</span><div><strong title="${esc(t.assignee||"Unassigned")}">${esc(t.assignee||"Unassigned")}</strong><span>${esc(memberRole(t.assignee))}</span></div><span class="detail-assignee-caret">⌄</span></div>
              </div>

              <div class="detail-key-card">
                <div class="detail-key-header">${dIcons.info}<span>Key details</span></div>
                <div class="detail-facts">
                  <div><small>Status</small><strong><span class="detail-fact-pill status">${esc(t.status)}</span></strong></div>
                  <div><small>Priority</small><strong><span class="detail-fact-pill ${String(t.priority).toLowerCase()}">${esc(t.priority)}</span></strong></div>
                  <div><small>Start date</small><strong>${formatDate(t.start)}</strong></div>
                  <div><small>Expected end</small><strong>${formatDate(t.end)}</strong></div>
                  <div><small>Release</small><strong>${esc(t.release||"—")}</strong></div>
                  <div><small>Area</small><strong>${esc(t.area||"—")}</strong></div>
                </div>
              </div>

              ${isOverdue(t)?'<div class="detail-alert overdue">⚠ This ticket is overdue.</div>':''}
              ${t.blockerNote?`<div class="detail-alert blocker"><small>Blocker / risk note</small><strong>${esc(t.blockerNote)}</strong></div>`:''}

              <div class="detail-side-section">
                <div class="detail-side-title">${dIcons.labels}<span>Labels</span><button class="detail-mini-add" data-detail-edit-section type="button" aria-label="Edit labels">＋</button></div>
                <div class="tags">${(t.labels||[]).map(x=>`<span class="tag">${esc(x)}</span>`).join("")||'<span class="muted">None</span>'}</div>
              </div>

              <div class="detail-side-section">
                <div class="detail-side-title">${dIcons.collaborators}<span>Collaborators (${collaborators.length})</span><button class="detail-mini-add" data-detail-edit-section type="button" aria-label="Edit collaborators">＋</button></div>
                <div class="collab-stack">${collaborators.length?collaborators.map(name=>`<span class="collab-person" title="${esc(name)}" style="--member-color:${memberColor(name)}"><span class="collab-avatar">${initials(name)}</span><span class="collab-copy"><strong>${esc(name)}</strong><small>${esc(memberRole(name))}</small></span></span>`).join(""):'<span class="muted">None</span>'}</div>
              </div>
            </aside>
          </div>

          <div class="modal-actions detail-actions"><button id="detailDelete" class="btn danger detail-footer-btn" type="button">${dIcons.delete}<span>Delete</span></button><button id="detailFavorite" class="btn detail-footer-btn" type="button">${dIcons.favorite}<span>${isFavorite(t.id)?'Favorite':'Favorite'}</span></button><button id="detailDuplicate" class="btn detail-footer-btn" type="button">${dIcons.duplicate}<span>Duplicate</span></button><div class="spacer"></div><button id="detailCloseBtn" class="btn" type="button">Close</button><button id="detailEdit" class="btn primary detail-footer-btn" type="button">${dIcons.edit}<span>Edit Ticket</span></button></div>
        </div>
      </div>`;
    const close=()=>{ticketDetailStack=[];$("#modalRoot").innerHTML="";};
    $("#closeModal").addEventListener("click",close);
    $("#detailCloseBtn").addEventListener("click",close);
    $(".modal-backdrop").addEventListener("click",e=>{if(e.target===e.currentTarget)close();});
    $$('[data-detail-collapse]').forEach(btn=>btn.addEventListener('click',()=>btn.closest('.detail-section')?.classList.toggle('collapsed')));
    const setDetailTab=(key)=>{
      const modal=$('.detail-modal');
      if(!modal)return;
      modal.dataset.detailView=key||'details';
      $$('.detail-tab').forEach(x=>x.classList.toggle('active',x.dataset.detailNav===key));
      const sectionMap={comments:'#detailCommentsSection',attachments:'#detailDocsSection',history:'#detailHistorySection'};
      const target=sectionMap[key]?$(sectionMap[key]):null;
      if(target)target.classList.remove('collapsed');
      const body=$('.detail-body');
      if(body)body.scrollTop=0;
      requestAnimationFrame(()=>{
        if(key==='comments')$('#detailCommentText')?.focus();
      });
    };
    $$('[data-detail-nav]').forEach(btn=>btn.addEventListener('click',()=>setDetailTab(btn.dataset.detailNav)));
    setDetailTab('details');
    $$('[data-detail-edit-section]').forEach(btn=>btn.addEventListener('click',()=>{$('#modalRoot').innerHTML='';openTicketEditor(ticketId);}));
    $$('[data-detail-add-checklist]').forEach(btn=>btn.addEventListener('click',()=>openQuickChecklistModal(ticketId)));
    if($('#detailHeaderEdit')) $('#detailHeaderEdit').addEventListener('click',()=>$('#detailEdit')?.click());
    if($('#detailHeaderFavorite')) $('#detailHeaderFavorite').addEventListener('click',()=>$('#detailFavorite')?.click());
    if($('#detailHeaderDuplicate')) $('#detailHeaderDuplicate').addEventListener('click',()=>$('#detailDuplicate')?.click());
    if($("#detailBack")) $("#detailBack").addEventListener("click",()=>{const previous=ticketDetailStack.pop();if(previous)openTicketDetails(previous,{preserveStack:true});});
    $("#detailEdit").addEventListener("click",()=>{$("#modalRoot").innerHTML="";openTicketEditor(ticketId);});
    $("#detailDelete").addEventListener("click",async()=>{
      const ok=await confirmAction({
        title:"Delete this ticket?",
        message:"The ticket and its comments, links, progress and history will be removed from this TeamFlow workspace.",
        subject:`${t.id} · ${t.title}`,
        confirmLabel:"Delete ticket",
        icon:"×",
        details:[`Status: ${t.status}`,`Assigned to: ${t.assignee||"Unassigned"}`,t.dependencies?.length?`${t.dependencies.length} linked dependenc${t.dependencies.length===1?"y":"ies"}`:""]
      });
      if(!ok) return;
      logActivity('delete',t,`Deleted ticket ${t.id} · ${t.title}`);state.tickets=state.tickets.filter(x=>x.id!==ticketId);saveState();refreshDataViews();
      const previous=ticketDetailStack.pop();
      if(previous && state.tickets.some(x=>x.id===previous)) openTicketDetails(previous,{preserveStack:true}); else close();
      toast(`${ticketId} deleted`);
    });
    $$('[data-detail-subtask]').forEach(input=>input.addEventListener('change',()=>{
      const st=(t.subtasks||[]).find(x=>x.id===input.dataset.detailSubtask);if(!st)return;
      st.done=input.checked;if(t.autoProgress)t.progress=calcSubtaskProgress(t.subtasks);
      t.history=t.history||[];t.history.unshift(`Checklist item ${st.done?"completed":"reopened"}: ${st.text}`);
      logActivity('update',t,`Checklist: ${st.text} ${st.done?"completed":"reopened"}`);saveState();refreshDataViews();openTicketDetails(t.id,{preserveStack:true});
    }));
    if($('#detailFavorite')) $('#detailFavorite').addEventListener('click',()=>{toggleFavorite(t.id);logActivity('favorite',t,isFavorite(t.id)?'Added to favorites':'Removed from favorites');saveState();renderOverview();openTicketDetails(t.id,{preserveStack:true});});
    if($('#detailDuplicate')) $('#detailDuplicate').addEventListener('click',()=>duplicateTicket(t.id));
    $$('[data-comment-like]').forEach(btn=>btn.addEventListener('click',()=>{
      const c=(t.comments||[]).find(x=>x.id===btn.dataset.commentLike);if(!c)return;c.reactions=c.reactions||{};c.reactions.like=Array.isArray(c.reactions.like)?c.reactions.like:[];
      if(c.reactions.like.includes(state.currentMember))c.reactions.like=c.reactions.like.filter(x=>x!==state.currentMember);else c.reactions.like.push(state.currentMember);
      saveState();openTicketDetails(t.id,{preserveStack:true});
    }));
    $$('[data-comment-edit]').forEach(btn=>btn.addEventListener('click',()=>openCommentEditModal(t.id,btn.dataset.commentEdit)));
    $$('[data-comment-delete]').forEach(btn=>btn.addEventListener('click',async()=>{
      const c=(t.comments||[]).find(x=>x.id===btn.dataset.commentDelete);if(!c)return;
      const ok=await confirmAction({title:'Delete this comment?',message:'The comment will be removed from this ticket.',subject:c.text.slice(0,100),confirmLabel:'Delete comment',icon:'×'});if(!ok)return;
      t.comments=t.comments.filter(x=>x.id!==c.id);logActivity('comment',t,'Deleted a comment');saveState();openTicketDetails(t.id,{preserveStack:true});
    }));
    $$('[data-comment-ticket]').forEach(ref=>ref.addEventListener('click',()=>{
      const match=state.tickets.find(x=>x.id.toLowerCase()===ref.dataset.commentTicket.toLowerCase());if(match){ticketDetailStack.push(t.id);openTicketDetails(match.id,{preserveStack:true});}
    }));
    $$('[data-detail-ticket]').forEach(btn=>btn.addEventListener('click',()=>{ticketDetailStack.push(ticketId);openTicketDetails(btn.dataset.detailTicket,{preserveStack:true});}));
    $$('[data-doc-index]').forEach(btn=>btn.addEventListener('click',()=>{const link=docs[Number(btn.dataset.docIndex)];const url=safeHttpUrl(link?.url);if(url)window.open(url,'_blank','noopener');else toast('This documentation URL is not valid.');}));
    attachMentionAutocomplete($("#detailCommentText"));
    $("#detailSendComment").addEventListener("click",()=>{const text=$("#detailCommentText").value.trim();if(!text)return;t.comments=t.comments||[];t.comments.push({id:"c"+Date.now()+Math.random().toString(36).slice(2,5),by:state.currentMember||"Team member",at:nowLabel(),text,reactions:{}});t.history=t.history||[];t.history.unshift("Comment added");logActivity('comment',t,`Commented: ${text.slice(0,80)}`);saveState();refreshDataViews();openTicketDetails(ticketId,{preserveStack:true});});
  }

  function openTicketEditor(ticketId=null,presetStatus="To be started"){
    const existing = ticketId ? state.tickets.find(t=>t.id===ticketId) : null;
    const draft = existing ? clone(existing) : {
      id:nextTicketId(),title:"",description:"",assignee:state.currentMember || state.members[0]?.name || "",
      collaborators:[],area:"BE",priority:"Medium",status:presetStatus,sprint:"",start:localTodayISO(),end:"",progress:0,
      type:"Task",release:state.releases[0]||"",risk:"None",blockerNote:"",dependencies:[],
      labels:[],links:[],comments:[],history:["Ticket created"]
    };

    $("#modalRoot").innerHTML = `
      <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="${existing?"Edit ticket":"Create ticket"}">
        <div class="modal ticket-editor-modal">
          <div class="modal-head editor-modal-head">
            <span class="editor-modal-title-icon" aria-hidden="true">${existing?'✎':'+'}</span>
            <h2>${existing?"Edit Ticket":"Create New Ticket"}</h2>
            <button id="closeModal" class="modal-close" type="button" aria-label="Close">×</button>
          </div>
          <div class="tabs editor-tabs">
            <button class="tab active" data-tab="details" type="button">${editorIcon('details')}<span>Details</span></button>
            <button class="tab" data-tab="comments" type="button">${editorIcon('comment')}<span>Comments (${(draft.comments||[]).length})</span></button>
            <button class="tab" data-tab="history" type="button">${editorIcon('history')}<span>History</span></button>
          </div>
          <div class="modal-body editor-modal-body">
            <div id="pane-details" class="tab-pane active">${ticketForm(draft)}</div>
            <div id="pane-comments" class="tab-pane">
              <div class="comments">
                ${(draft.comments||[]).length
                  ? draft.comments.map(c=>`<div class="comment"><div class="comment-head"><strong>${esc(c.by)}</strong><small>${esc(c.at)}</small></div><p class="comment-body">${formatCommentText(c.text)}</p></div>`).join("")
                  : '<div class="empty">No comments yet</div>'}
              </div>
              <div class="comment-compose">
                <textarea id="commentText" placeholder="Write a comment..."></textarea>
                <button id="sendComment" class="btn primary" type="button">Send</button>
              </div>
            </div>
            <div id="pane-history" class="tab-pane">
              <div class="history">
                ${(draft.history||[]).length
                  ? (draft.history||[]).map(h=>`<div class="history-item">${esc(h)}<small>${existing?"Saved activity":"Draft activity"}</small></div>`).join("")
                  : '<div class="empty">No history yet</div>'}
              </div>
            </div>
          </div>
          <div class="modal-actions editor-modal-actions">
            ${existing?'<button id="deleteTicket" class="btn danger" type="button">Delete</button>':""}
            <div class="spacer"></div>
            <button id="cancelTicket" class="btn" type="button">Cancel</button>
            <button id="saveTicket" class="btn primary" type="button">${existing?"✓ Update Ticket":"✓ Create Ticket"}</button>
          </div>
        </div>
      </div>
    `;

    let dependencyOutsideHandler=null;
    const close = ()=>{
      if(dependencyOutsideHandler) document.removeEventListener("pointerdown",dependencyOutsideHandler,true);
      $("#modalRoot").innerHTML="";
    };
    $("#closeModal").addEventListener("click",close);
    $("#cancelTicket").addEventListener("click",close);
    $(".modal-backdrop").addEventListener("click",e=>{if(e.target===e.currentTarget) close();});

    $$(".tab").forEach(btn=>{
      btn.addEventListener("click",()=>{
        $$(".tab").forEach(x=>x.classList.remove("active"));
        $$(".tab-pane").forEach(x=>x.classList.remove("active"));
        btn.classList.add("active");
        $("#pane-"+btn.dataset.tab).classList.add("active");
      });
    });


    const bindSubtaskRow=row=>{const remove=$('.subtask-remove',row);remove.addEventListener('click',()=>{const rows=$$('.subtask-row',$('#subtaskRows'));if(rows.length===1){$('.subtask-text',row).value='';$('.subtask-done',row).checked=false;}else row.remove();});};
    $$('.subtask-row',$('#subtaskRows')).forEach(bindSubtaskRow);
    $('#addSubtaskRow').addEventListener('click',()=>{const row=document.createElement('div');row.className='subtask-row';row.innerHTML='<input class="subtask-done" type="checkbox" /><input class="subtask-text" type="text" placeholder="Checklist item" /><button class="subtask-remove" type="button">×</button>';$('#subtaskRows').appendChild(row);bindSubtaskRow(row);$('.subtask-text',row).focus();});

    const bindLinkRow = row => {
      const open=$(".link-open",row);
      if(open) open.addEventListener("click",()=>{
        const raw=$(".doc-link-url",row).value.trim();
        if(!raw){toast("Add a documentation URL first");return;}
        const url=safeHttpUrl(raw);
        if(url) window.open(url,"_blank","noopener,noreferrer");
        else toast("Invalid documentation URL");
      });
      const remove=$(".link-remove",row);
      if(remove) remove.addEventListener("click",async()=>{
        const title=$(".doc-link-title",row).value.trim();
        const url=$(".doc-link-url",row).value.trim();
        const chapter=$(".doc-link-chapter",row).value.trim();
        if(title || url || chapter){
          const ok=await confirmAction({
            title:"Remove documentation link?",
            message:"This reference will be removed from the ticket form.",
            subject:title || url || "Documentation reference",
            confirmLabel:"Remove link",
            icon:"↗",
            warning:"The external document itself will not be deleted."
          });
          if(!ok) return;
        }
        const rows=$$(".link-row",$("#linkRows"));
        if(rows.length===1){
          $(".doc-link-title",row).value="";
          $(".doc-link-url",row).value="";
          $(".doc-link-chapter",row).value="";
        }else row.remove();
      });
    };
    const progressRange=$("#ticketProgressRange");
    const progressNumber=$("#ticketProgress");
    const syncProgress=(source,target)=>{
      const value=normalizeProgress(source.value);
      source.value=value;target.value=value;
    };
    progressRange.addEventListener("input",()=>syncProgress(progressRange,progressNumber));
    progressNumber.addEventListener("input",()=>syncProgress(progressNumber,progressRange));

    const typeSelect=$("#ticketType");
    if(typeSelect && !existing){
      typeSelect.addEventListener("change",()=>{
        const template=TICKET_TEMPLATES[typeSelect.value]||TICKET_TEMPLATES.Task;
        $("#ticketPriority").value=template.priority||"Medium";
        $("#ticketArea").value=template.area||"BE";
        if(!$("#ticketLabels").value.trim()) $("#ticketLabels").value=(template.labels||[]).join(", ");
        if(!$("#ticketDescription").value.trim() && template.description) $("#ticketDescription").value=template.description;
        toast(`${typeSelect.value} template applied`);
      });
    }

    const depPicker=$("#dependencyPicker");
    if(depPicker){
      const depTrigger=$("#dependencyTrigger");
      const depMenu=$("#dependencyMenu");
      const depSearch=$("#dependencySearch");
      const closeDependencyMenu=()=>{depMenu.classList.add("hidden");depTrigger.setAttribute("aria-expanded","false");};
      const refreshDependencySummary=()=>{
        const checked=$$('input[name="dependencyChoice"]:checked',depPicker);
        $("#dependencySummary").textContent=checked.length?`${checked.length} ticket${checked.length===1?"":"s"} selected`:"No dependencies selected";
        const selectedBox=$("#dependencySelected");
        selectedBox.innerHTML=checked.length?checked.map(input=>{const t=state.tickets.find(x=>x.id===input.value);return `<span class="dependency-pill"><b>${esc(input.value)}</b><span>${esc(t?.title||"")}</span></span>`;}).join(""):'<span class="dependency-empty">Nothing selected</span>';
      };
      depTrigger.addEventListener("click",()=>{const opening=depMenu.classList.contains("hidden");if(opening){depMenu.classList.remove("hidden");depTrigger.setAttribute("aria-expanded","true");setTimeout(()=>depSearch.focus(),0);}else closeDependencyMenu();});
      depSearch.addEventListener("input",()=>{const q=depSearch.value.trim().toLowerCase();$$('.dependency-option',depPicker).forEach(row=>row.classList.toggle('hidden',q&&!row.dataset.depSearch.includes(q)));});
      $$('input[name="dependencyChoice"]',depPicker).forEach(input=>input.addEventListener('change',refreshDependencySummary));
      dependencyOutsideHandler=e=>{if(!depMenu.classList.contains("hidden") && !depPicker.contains(e.target)) closeDependencyMenu();};
      document.addEventListener("pointerdown",dependencyOutsideHandler,true);
    }

    $$(".link-row",$("#linkRows")).forEach(bindLinkRow);
    $("#addDocLinkRow").addEventListener("click",()=>{
      const wrap=$("#linkRows");
      const row=document.createElement("div");
      row.className="link-row";
      row.innerHTML='<input class="doc-link-title" placeholder="Document title" /><input class="doc-link-url" type="text" inputmode="url" placeholder="google.com or https://..." /><input class="doc-link-chapter" placeholder="Chapter / section" /><button class="link-open" type="button" title="Open documentation">Open</button><button class="link-remove" type="button" title="Remove link">×</button>';
      wrap.appendChild(row);bindLinkRow(row);$(".doc-link-title",row).focus();
    });

    attachMentionAutocomplete($("#commentText"));
    $("#sendComment").addEventListener("click",()=>{
      const text = $("#commentText").value.trim();
      if(!text) return;
      const target = existing ? state.tickets.find(t=>t.id===ticketId) : draft;
      target.comments = target.comments || [];
      target.comments.push({id:"c"+Date.now()+Math.random().toString(36).slice(2,5),by:state.currentMember || "Team member",at:nowLabel(),text,reactions:{}});
      target.history = target.history || [];
      target.history.unshift("Comment added");
      if(existing) logActivity('comment',target,`Commented: ${text.slice(0,80)}`);
      if(existing){
        saveState();
        close();
        renderBoard();
        openTicketModal(ticketId);
      }else{
        $("#commentText").value="";
        toast("Comment will be saved with the new ticket");
      }
    });

    if(existing){
      $("#deleteTicket").addEventListener("click",async()=>{
        const current=state.tickets.find(t=>t.id===ticketId);
        const ok=await confirmAction({
          title:"Delete this ticket?",
          message:"You are editing this ticket. Deleting it removes the saved ticket from TeamFlow immediately.",
          subject:current?`${current.id} · ${current.title}`:ticketId,
          confirmLabel:"Delete ticket",
          icon:"×",
          details:current?[`Status: ${current.status}`,`Assigned to: ${current.assignee||"Unassigned"}`]:[]
        });
        if(!ok) return;
        state.tickets = state.tickets.filter(t=>t.id!==ticketId);
        saveState();
        close();
        refreshDataViews();
        toast(`${ticketId} deleted`);
      });
    }

    $("#saveTicket").addEventListener("click",()=>{
      const title = $("#ticketTitle").value.trim();
      if(!title){
        $("#ticketTitle").focus();
        toast("Ticket title is required");
        return;
      }
      const selectedCollabs = $$('input[name="collab"]:checked').map(x=>x.value);
      const links=$$(".link-row",$("#linkRows")).map(row=>({
        title:$(".doc-link-title",row).value.trim(),
        url:$(".doc-link-url",row).value.trim(),
        chapter:$(".doc-link-chapter",row).value.trim()
      })).filter(l=>l.url);
      for(const link of links){
        const normalized=safeHttpUrl(link.url);
        if(!normalized){toast(`Invalid documentation URL: ${link.url}`);return;}
        link.url=normalized;
      }
      const updated = {
        ...draft,
        title,
        description:$("#ticketDescription").value.trim(),
        assignee:$("#ticketAssignee").value,
        collaborators:selectedCollabs,
        links,
        status:$("#ticketStatus").value,
        area:$("#ticketArea").value,
        priority:$("#ticketPriority").value,
        type:$("#ticketType").value,
        release:$("#ticketRelease").value,
        risk:$("#ticketRisk").value,
        blockerNote:$("#ticketBlockerNote").value.trim(),
        dependencies:$$('input[name="dependencyChoice"]:checked').map(o=>o.value),
        subtasks:$$('.subtask-row',$('#subtaskRows')).map((row,i)=>({id:(draft.subtasks?.[i]?.id)||('st'+Date.now()+i),text:$('.subtask-text',row).value.trim(),done:$('.subtask-done',row).checked})).filter(x=>x.text),
        autoProgress:$("#autoProgress").checked,
        sprint:$("#ticketSprint").value.trim(),
        progress:normalizeProgress($("#ticketProgress").value),
        labels:$("#ticketLabels").value.split(",").map(x=>x.trim()).filter(Boolean),
        start:$("#ticketStart").value,
        end:$("#ticketEnd").value
      };

      if(updated.autoProgress) updated.progress=calcSubtaskProgress(updated.subtasks);
      if(existing){
        const original = state.tickets.find(t=>t.id===ticketId);
        const oldStatus = original.status;
        Object.assign(original,updated);
        original.history = original.history || [];
        original.history.unshift("Ticket updated");
        if(oldStatus !== updated.status) original.history.unshift(`Status changed to ${updated.status}`);
        logActivity('update',original,oldStatus!==updated.status?`Updated ticket · ${oldStatus} → ${updated.status}`:'Updated ticket details');
      }else{
        state.tickets.push(updated);
        logActivity('create',updated,'Created ticket');
      }
      saveState();
      close();
      renderMemberSelects();
      renderBoard();
      toast(`${updated.id} ${existing?"updated":"created"} successfully`);
    });
  }

  function suggestedUsernameFromMember(member){return String(member?.name||"").toLowerCase().replace(/[^a-z0-9]+/g,'.').replace(/^\.+|\.+$/g,'').slice(0,40)||"member";}

  async function openMemberAccountLinkModal(memberId){
    if(cloudUser?.role!=="admin"){toast("Administrator access required");return;}
    const member=state.members.find(m=>m.id===memberId);if(!member)return;
    let users=[];try{users=(await cloudRequest("/admin/users")).users||[];}catch(err){tfLogError("Loading login users for member linking failed",err,{memberId});toast(err.message);return;}
    const linkedElsewhere=new Map(state.members.filter(m=>m.id!==member.id&&m.authUsername).map(m=>[String(m.authUsername).toLowerCase(),m.name]));
    const available=users.filter(u=>!linkedElsewhere.has(String(u.username||'').toLowerCase())||String(u.username||'').toLowerCase()===String(member.authUsername||'').toLowerCase());
    $("#modalRoot").innerHTML=`<div class="modal-backdrop" role="dialog" aria-modal="true"><div class="modal" style="max-width:560px"><div class="modal-head"><h2>Link login user</h2><button id="closeModal" class="modal-close" type="button">×</button></div><div class="modal-body"><p class="panel-sub">Link <strong>${esc(member.name)}</strong> to one authentication account. Tickets remain assigned to the member name; the linked account receives “Assigned to me” and My Work ownership.</p><div class="field"><label>Login account</label><select id="memberLoginAccount"><option value="">Choose an account…</option>${available.map(u=>`<option value="${esc(u.username)}" ${String(u.username).toLowerCase()===String(member.authUsername||'').toLowerCase()?'selected':''}>${esc(u.displayName||u.username)} (@${esc(u.username)})</option>`).join('')}</select></div>${!available.length?'<div class="note" style="margin-top:10px">No unlinked login accounts are available. Create one for this member instead.</div>':''}</div><div class="modal-actions"><button id="createUserForMember" class="btn" type="button">＋ Create user for member</button><div class="spacer"></div><button id="cancelMemberLink" class="btn" type="button">Cancel</button><button id="saveMemberLink" class="btn primary" type="button">Link account</button></div></div></div>`;
    const close=()=>$("#modalRoot").innerHTML="";$("#closeModal").onclick=close;$("#cancelMemberLink").onclick=close;
    $("#createUserForMember").onclick=()=>openCloudUsersModal({linkMemberId:member.id,prefill:{username:suggestedUsernameFromMember(member),displayName:member.name,role:"member"}});
    $("#saveMemberLink").onclick=()=>{const username=$("#memberLoginAccount").value.trim().toLowerCase();if(!username){$("#memberLoginAccount").focus();return;}if(state.members.some(m=>m.id!==member.id&&String(m.authUsername||'').toLowerCase()===username)){toast("That login account is already linked to another Team member");return;}member.authUsername=username;saveState();syncCurrentMemberToAuthenticatedUser();renderTeam();renderMemberSelects();refreshDataViews();close();toast(`${member.name} linked to @${username}`);};
  }

  function openMemberModal(memberId=null,options={}){
    const existing = memberId ? state.members.find(m=>m.id===memberId) : null;
    const readOnly=!!options.readOnly;
    const isAdmin=cloudUser?.role==="admin";
    const initialColor=validMemberColor(existing?.color) || colorForName(existing?.name || `member-${state.members.length+1}`);
    const initialName=existing?.name||"";
    $("#modalRoot").innerHTML = `
      <div class="modal-backdrop" role="dialog" aria-modal="true">
        <div class="modal" style="max-width:560px">
          <div class="modal-head">
            <h2>${existing?"Edit Team Member":"Add Team Member"}</h2>
            <button id="closeModal" class="modal-close" type="button">×</button>
          </div>
          <div class="modal-body">
            <div class="form-grid">
              <div class="field full"><label>Name *</label><input id="memberName" value="${esc(initialName)}" /></div>
              <div class="field full"><label>Role</label><input id="memberRole" value="${esc(existing?.role||"")}" placeholder="Developer, QA, Architect..." /></div>
              ${existing&&isAdmin?`<div class="field full"><label>Login account link</label><div class="note">${existing.authUsername?`Linked to <b>@${esc(existing.authUsername)}</b>`:'Not linked to a login user.'}</div><div style="display:flex;gap:8px;margin-top:8px"><button id="linkMemberAccount" class="btn small" type="button">${existing.authUsername?'Change link':'Link existing user'}</button><button id="createMemberLogin" class="btn small" type="button">＋ Create user</button>${existing.authUsername?'<button id="unlinkMemberAccount" class="btn small danger" type="button">Unlink</button>':''}</div></div>`:''}
              <div class="field full">
                <label>Preferred ticket identity color</label>
                <div class="member-color-picker">
                  <div id="memberColorPreview" class="member-color-preview" style="--member-color:${initialColor}">${initials(initialName||"TM")}</div>
                  <div class="member-color-controls">
                    <input id="memberColor" type="color" value="${initialColor}" aria-label="Preferred member color" />
                    <div class="color-swatches">${MEMBER_COLOR_PALETTE.map(c=>`<button class="color-swatch" type="button" data-member-color="${c}" style="--swatch:${c}" title="${c}"></button>`).join("")}</div>
                  </div>
                </div>
                <div class="note">This color identifies the user on ticket avatars. Issue type colors remain separate and are used for the ticket's left accent bar.</div>
              </div>
            </div>
          </div>
          <div class="modal-actions">
            ${existing&&isAdmin?'<button id="removeMember" class="btn danger" type="button">Remove</button>':""}
            <div class="spacer"></div>
            <button id="cancelMember" class="btn" type="button">Cancel</button>
            ${readOnly?"":`<button id="saveMember" class="btn primary" type="button">${existing?"Save Changes":"Add Member"}</button>`}
          </div>
        </div>
      </div>
    `;
    const close=()=>$("#modalRoot").innerHTML="";
    const updatePreview=()=>{
      const color=validMemberColor($("#memberColor").value)||initialColor;
      const name=$("#memberName").value.trim()||"TM";
      $("#memberColorPreview").style.setProperty("--member-color",color);
      $("#memberColorPreview").textContent=initials(name);
    };
    $("#closeModal").addEventListener("click",close);
    $("#cancelMember").addEventListener("click",close);
    $("#memberColor").addEventListener("input",updatePreview);
    $("#memberName").addEventListener("input",updatePreview);
    $$('[data-member-color]').forEach(btn=>btn.addEventListener('click',()=>{$("#memberColor").value=btn.dataset.memberColor;updatePreview();}));
    if(readOnly){["memberName","memberRole","memberColor"].forEach(id=>{const el=$("#"+id);if(el)el.disabled=true;});}
    if(existing&&isAdmin){
      $("#linkMemberAccount")?.addEventListener("click",()=>openMemberAccountLinkModal(existing.id));
      $("#createMemberLogin")?.addEventListener("click",()=>openCloudUsersModal({linkMemberId:existing.id,prefill:{username:suggestedUsernameFromMember(existing),displayName:existing.name,role:"member"}}));
      $("#unlinkMemberAccount")?.addEventListener("click",()=>{const old=existing.authUsername||"";existing.authUsername="";if(String(cloudUser?.username||"").toLowerCase()===String(old).toLowerCase())state.currentMember="";saveState();renderTeam();renderMemberSelects();refreshDataViews();close();toast(`${existing.name} unlinked from @${old}`);});
    }
    $("#saveMember")?.addEventListener("click",()=>{
      const name=$("#memberName").value.trim();
      if(!name){$("#memberName").focus();toast("Member name is required");return;}
      const role=$("#memberRole").value.trim() || "Team member";
      const color=validMemberColor($("#memberColor").value) || colorForName(name);
      if(existing){
        const old=existing.name;
        existing.name=name; existing.role=role; existing.color=color;
        state.tickets.forEach(t=>{
          if(t.assignee===old) t.assignee=name;
          t.collaborators=(t.collaborators||[]).map(c=>c===old?name:c);
        });
        if(state.currentMember===old) state.currentMember=name;
      }else{
        state.members.push({id:"m"+Date.now(),name,role,color});
      }
      saveState();close();renderTeam();renderMemberSelects();refreshDataViews();toast(existing?"Team member updated":"Team member added");
    });
    if(existing){
      $("#removeMember").addEventListener("click",async()=>{
        if(state.tickets.some(t=>t.assignee===existing.name)){const assigned=state.tickets.filter(t=>t.assignee===existing.name).length;await noticeAction({title:"Reassign tickets first",message:`${existing.name} is still assigned to ${assigned} ticket${assigned===1?"":"s"}. Move those tickets to another team member before removing this person.`,subject:"Open TeamFlow Board or My Work and change the assignee.",icon:"↔"});return;}
        const ok=await confirmAction({
          title:"Remove this team member?",
          message:"The member will disappear from TeamFlow assignment and collaborator choices.",
          subject:`${existing.name} · ${existing.role||"Team member"}`,
          confirmLabel:"Remove member",
          icon:"−",
          details:["Their preferred identity color will be removed.","They will be removed from collaborator lists on existing tickets."],
          warning:"This does not delete a Microsoft or SharePoint account."
        });
        if(!ok) return;
        state.members=state.members.filter(m=>m.id!==existing.id);
        state.tickets.forEach(t=>t.collaborators=(t.collaborators||[]).filter(c=>c!==existing.name));
        if(state.currentMember===existing.name) state.currentMember=state.members[0]?.name||"";
        saveState();close();renderTeam();renderMemberSelects();refreshDataViews();toast("Team member removed");
      });
    }
  }

  function openSharePointModal(){
    $("#modalRoot").innerHTML=`
      <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Add SharePoint document">
        <div class="modal" style="max-width:600px">
          <div class="modal-head"><h2>Add SharePoint / Word Online</h2><button id="closeModal" class="modal-close" type="button">×</button></div>
          <div class="modal-body">
            <div class="form-grid">
              <div class="field full"><label>Display name</label><input id="spName" placeholder="Architecture document" /></div>
              <div class="field full"><label>SharePoint / Word URL *</label><input id="spUrl" type="text" inputmode="url" placeholder="yourtenant.sharepoint.com/..." /></div>
              <div class="field full"><div class="note">TeamFlow will try to preview the page inside the Documents tab. Microsoft may block iframe preview depending on your tenant permissions; the document will still have an <b>Open in SharePoint</b> button.</div></div>
            </div>
          </div>
          <div class="modal-actions"><div class="spacer"></div><button id="cancelSp" class="btn" type="button">Cancel</button><button id="saveSp" class="btn primary" type="button">Add Document</button></div>
        </div>
      </div>`;
    const close=()=>$("#modalRoot").innerHTML="";
    $("#closeModal").addEventListener("click",close);$("#cancelSp").addEventListener("click",close);
    $("#saveSp").addEventListener("click",()=>{
      const raw=$("#spUrl").value.trim();if(!raw){$("#spUrl").focus();toast("SharePoint URL is required");return;}
      const url=safeHttpUrl(raw);if(!url){toast("Please enter a valid SharePoint / Word URL");return;}
      const name=$("#spName").value.trim() || "SharePoint / Word document";
      addDocument({id:"d"+Date.now(),name,kind:"sharepoint",url});close();switchView("documents");toast("SharePoint document added");
    });
  }

  

  function openBlankPageModal(){
    $("#modalRoot").innerHTML=`
      <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Create blank note">
        <div class="modal" style="max-width:590px">
          <div class="modal-head"><span class="ticket-id">NOTE</span><h2>Create Blank Note</h2><button id="closeModal" class="modal-close" type="button">×</button></div>
          <div class="modal-body">
            <div class="form-grid">
              <div class="field full"><label>Page name *</label><input id="blankPageName" value="Project Notes" placeholder="e.g. SIT Release Notes" /></div>
              <div class="field full"><label>Start with some content (optional)</label><textarea id="blankPageText" placeholder="Meeting notes, decisions, checklist, useful links..."></textarea></div>
              <div class="field full"><div class="note">This note stays inside TeamFlow and is saved with your local workspace/export. It does not create a SharePoint document.</div></div>
            </div>
          </div>
          <div class="modal-actions"><div class="spacer"></div><button id="cancelBlankPage" class="btn" type="button">Cancel</button><button id="createBlankPage" class="btn primary" type="button">＋ Create Note</button></div>
        </div>
      </div>`;
    const close=()=>$("#modalRoot").innerHTML="";
    $("#closeModal").addEventListener("click",close);
    $("#cancelBlankPage").addEventListener("click",close);
    $(".modal-backdrop").addEventListener("click",e=>{if(e.target===e.currentTarget)close();});
    $("#createBlankPage").addEventListener("click",()=>{
      const name=$("#blankPageName").value.trim();
      if(!name){$("#blankPageName").focus();toast("Page name is required");return;}
      const text=$("#blankPageText").value;
      addDocument({id:"d"+Date.now(),name,kind:"blank",text,richHtml:textToRichHtml(text)});
      close();switchView("documents");toast(`${name} created`);
    });
    setTimeout(()=>$("#blankPageName")?.select(),0);
  }

  function activeTickets(list){return list.filter(t=>!["Done","Deployed on SIT","Deprecated"].includes(t.status));}

  function myWorkCardHtml(t){
    return `<article class="work-card" data-work-ticket="${esc(t.id)}" style="--type-color:${issueTypeColor(t.type||"Task")};--member-color:${memberColor(t.assignee)}">
      <div class="work-card-top"><span class="ticket-id">${esc(t.id)}</span><span class="detail-type compact">${esc(t.type||"Task")}</span><span class="priority ${esc(t.priority)}">${esc(t.priority)}</span></div>
      <h3>${esc(t.title)}</h3>
      <div class="work-card-meta"><span>◆ ${esc(t.release||"No release")}</span><span>◷ ${formatDate(t.end)}</span></div>
      <div class="progress-block"><div class="progress-head"><span>${esc(t.status)}</span><strong>${normalizeProgress(t.progress)}%</strong></div><div class="progress-track"><div class="progress-fill" style="width:${normalizeProgress(t.progress)}%"></div></div></div>
      <div class="work-card-bottom">${isBlocked(t)?'<span class="flag blocked">BLOCKED</span>':isOverdue(t)?'<span class="overdue-badge">OVERDUE</span>':'<span class="flag release">On track</span>'}<span class="work-assignee"><span class="work-avatar">${initials(t.assignee)}</span><span title="${esc(t.assignee)}">${esc(t.assignee)}</span></span></div>
    </article>`;
  }

  function openMyWorkLayoutModal(){
    const prefs=ensureMyWorkPrefs();
    $("#modalRoot").innerHTML=`<div class="modal-backdrop" role="dialog" aria-modal="true"><div class="modal" style="max-width:650px"><div class="modal-head"><h2>Customize My Work</h2><button id="closeModal" class="modal-close" type="button">×</button></div><div class="modal-body"><p class="panel-sub">Reorder status sections and choose which ones are visible for <strong>${esc(state.currentMember)}</strong>. This personal layout follows your signed-in TeamFlow account and does not change the global board.</p><div id="workOrderEditor" class="work-order-editor">${prefs.order.map((status,i)=>`<div class="work-order-row" data-work-status="${esc(status)}"><div class="work-order-handle">⋮⋮</div><div class="work-order-name"><strong>${esc(status)}</strong><small>${state.tickets.filter(t=>t.assignee===state.currentMember&&t.status===status).length} ticket(s)</small></div><label class="work-visible"><input type="checkbox" ${prefs.hidden.includes(status)?"":"checked"}/> Visible</label><div class="work-order-actions"><button class="btn small" data-move="up" type="button" ${i===0?"disabled":""}>↑</button><button class="btn small" data-move="down" type="button" ${i===prefs.order.length-1?"disabled":""}>↓</button></div></div>`).join("")}</div></div><div class="modal-actions"><div class="spacer"></div><button id="cancelWorkLayout" class="btn" type="button">Cancel</button><button id="saveWorkLayout" class="btn primary" type="button">Save layout</button></div></div></div>`;
    const close=()=>$("#modalRoot").innerHTML="";
    $("#closeModal").addEventListener("click",close);$("#cancelWorkLayout").addEventListener("click",close);
    $("#workOrderEditor").addEventListener("click",e=>{const btn=e.target.closest('[data-move]');if(!btn)return;const row=btn.closest('.work-order-row');const parent=row.parentElement;if(btn.dataset.move==='up'&&row.previousElementSibling)parent.insertBefore(row,row.previousElementSibling);if(btn.dataset.move==='down'&&row.nextElementSibling)parent.insertBefore(row.nextElementSibling,row);});
    $("#saveWorkLayout").addEventListener("click",()=>{const rows=$$('.work-order-row');prefs.order=rows.map(r=>r.dataset.workStatus);prefs.hidden=rows.filter(r=>!$('input[type="checkbox"]',r).checked).map(r=>r.dataset.workStatus);saveState();close();renderMyWork();toast('My Work layout updated');});
  }

  function renderMyWork(){
    const prefs=ensureMyWorkPrefs();
    const mine=state.tickets.filter(t=>t.assignee===state.currentMember);
    const open=activeTickets(mine);
    const overdue=mine.filter(isOverdue);
    const blocked=mine.filter(isBlocked);
    const avg=mine.length?Math.round(mine.reduce((sum,t)=>sum+normalizeProgress(t.progress),0)/mine.length):0;
    const visibleStatuses=prefs.order.filter(s=>!prefs.hidden.includes(s));
    const sections=visibleStatuses.map(status=>{
      const list=mine.filter(t=>t.status===status).sort((a,b)=>(isOverdue(b)-isOverdue(a))||(isBlocked(b)-isBlocked(a))||String(a.end||'9999').localeCompare(String(b.end||'9999')));
      if(prefs.mode==='list') return `<section class="work-status-section list-mode" data-work-status="${esc(status)}"><div class="work-status-head" draggable="true" title="Drag to reorder this workflow for ${esc(state.currentMember)}"><span class="work-drag-handle">⋮⋮</span><span class="status-dot-small"></span><strong>${esc(status)}</strong><span class="work-status-count">${list.length}</span></div><div class="work-status-list">${list.length?list.map(myWorkCardHtml).join(''):'<div class="work-empty">No tickets</div>'}</div></section>`;
      return `<section class="work-status-section" data-work-status="${esc(status)}"><div class="work-status-head" draggable="true" title="Drag to reorder this workflow for ${esc(state.currentMember)}"><span class="work-drag-handle">⋮⋮</span><span class="status-dot-small"></span><strong>${esc(status)}</strong><span class="work-status-count">${list.length}</span></div><div class="work-status-grid">${list.length?list.map(myWorkCardHtml).join(''):'<div class="work-empty">No tickets</div>'}</div></section>`;
    }).join('');
    $("#myWorkContent").innerHTML=`
      <div class="my-work-toolbar"><div><strong>${esc(state.currentMember)}</strong><span>${mine.length} assigned ticket${mine.length===1?'':'s'}</span></div><div class="my-work-actions"><div class="segmented"><button class="${prefs.mode==='grid'?'active':''}" data-work-mode="grid" type="button">▦ Grid</button><button class="${prefs.mode==='list'?'active':''}" data-work-mode="list" type="button">☷ List</button></div><button class="btn small" id="customizeMyWork" type="button">⚙ Customize layout</button></div></div>
      <div class="dashboard-grid"><div class="metric"><small>Open work</small><strong>${open.length}</strong><span>active tickets</span></div><div class="metric"><small>Overdue</small><strong>${overdue.length}</strong><span>past expected end</span></div><div class="metric"><small>Blocked</small><strong>${blocked.length}</strong><span>dependency / risk</span></div><div class="metric"><small>Average progress</small><strong>${avg}%</strong><span>all assigned work</span></div></div>
      <div class="work-board ${prefs.mode}">${sections||'<div class="empty">No visible status sections. Use Customize layout to show one.</div>'}</div>`;
    $$('[data-work-mode]').forEach(btn=>btn.addEventListener('click',()=>{prefs.mode=btn.dataset.workMode;saveState();renderMyWork();}));
    $("#customizeMyWork").addEventListener('click',openMyWorkLayoutModal);
    $$('[data-work-ticket]').forEach(el=>el.addEventListener('click',()=>openTicketDetails(el.dataset.workTicket)));

    // Reordering here is personal to the authenticated TeamFlow user.
    // It changes only that member's My Work presentation, never the global workflow or ticket statuses.
    const workBoard=$('.work-board');
    $$('.work-status-section',workBoard).forEach(section=>{
      const header=$('.work-status-head',section);
      header.addEventListener('dragstart',e=>{
        e.dataTransfer.setData('text/teamflow-workflow',section.dataset.workStatus);
        e.dataTransfer.effectAllowed='move';
        section.classList.add('workflow-dragging');
      });
      header.addEventListener('dragend',()=>{
        section.classList.remove('workflow-dragging');
        $$('.work-status-section',workBoard).forEach(x=>x.classList.remove('workflow-drop-target'));
      });
      section.addEventListener('dragover',e=>{
        if(!e.dataTransfer.types.includes('text/teamflow-workflow')) return;
        e.preventDefault();
        e.dataTransfer.dropEffect='move';
        section.classList.add('workflow-drop-target');
      });
      section.addEventListener('dragleave',e=>{if(!section.contains(e.relatedTarget))section.classList.remove('workflow-drop-target');});
      section.addEventListener('drop',e=>{
        const from=e.dataTransfer.getData('text/teamflow-workflow');
        const to=section.dataset.workStatus;
        if(!from || !to || from===to) return;
        e.preventDefault();
        const order=prefs.order.filter(s=>s!==from);
        const targetIndex=order.indexOf(to);
        if(targetIndex<0) return;
        const rect=section.getBoundingClientRect();
        const after=prefs.mode==='grid' ? e.clientX>rect.left+rect.width/2 : e.clientY>rect.top+rect.height/2;
        order.splice(targetIndex+(after?1:0),0,from);
        prefs.order=order;
        saveState();
        renderMyWork();
        toast(`${from} moved for ${state.currentMember}'s My Work view`);
      });
    });
  }


  function renderInsights(){
    ensureAdvancedState();
    const total=state.tickets.length;
    const done=state.tickets.filter(t=>["Done","Deployed on SIT"].includes(t.status)).length;
    const overdue=state.tickets.filter(isOverdue).length;
    const blocked=state.tickets.filter(isBlocked).length;
    const avg=total?Math.round(state.tickets.reduce((sum,t)=>sum+normalizeProgress(t.progress),0)/total):0;
    const deliveredPct=total?Math.round(done/total*100):0;
    const attention=blocked+overdue;
    const maxStatus=Math.max(1,...state.statuses.map(status=>state.tickets.filter(t=>t.status===status).length));
    const maxMember=Math.max(1,...state.members.map(member=>activeTickets(state.tickets.filter(t=>t.assignee===member.name)).length));
    const statusRows=state.statuses.map(status=>{
      const count=state.tickets.filter(t=>t.status===status).length;
      return `<div class="insight-bar-row"><span>${esc(status)}</span><div class="insight-bar-track"><div class="insight-bar-fill" style="width:${Math.round(count/maxStatus*100)}%"></div></div><strong>${count}</strong></div>`;
    }).join('');
    const releaseRows=state.releases.map(release=>{
      const list=state.tickets.filter(t=>t.release===release);
      const progress=list.length?Math.round(list.reduce((sum,t)=>sum+normalizeProgress(t.progress),0)/list.length):0;
      return `<div class="insight-bar-row"><span>${esc(release)}</span><div class="insight-bar-track"><div class="insight-bar-fill" style="width:${progress}%"></div></div><strong>${progress}%</strong></div>`;
    }).join('');
    const memberRows=state.members.map(member=>{
      const count=activeTickets(state.tickets.filter(t=>t.assignee===member.name)).length;
      return `<div class="insight-bar-row"><span title="${esc(member.name)}">${esc(member.name)}</span><div class="insight-bar-track"><div class="insight-bar-fill" style="width:${Math.round(count/maxMember*100)}%"></div></div><strong>${count}</strong></div>`;
    }).join('');
    selectedReleaseReadiness=selectedReleaseReadiness&&state.releases.includes(selectedReleaseReadiness)?selectedReleaseReadiness:(state.releases[0]||'');
    const ring=`conic-gradient(var(--accent) ${avg*3.6}deg, color-mix(in srgb,var(--accent) 12%,var(--panel-3)) 0)`;
    $('#insightsContent').innerHTML=`
      <div class="insights-kpis">
        <div class="insight-kpi insight-kpi-total"><div class="insight-kpi-icon"><svg viewBox="0 0 24 24"><path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Zm-8 9 8 4.5 8-4.5M4 16.5 12 21l8-4.5"/></svg></div><div class="insight-kpi-copy"><small>Total tickets</small><strong>${total}</strong><span>${done} completed / deployed</span></div><svg class="insight-spark" viewBox="0 0 120 52" preserveAspectRatio="none"><path d="M2 46 C16 44,18 30,31 34 S50 11,63 19 S79 28,88 12 S105 20,118 5"/></svg></div>
        <div class="insight-kpi"><div class="insight-kpi-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 7a5 5 0 1 0 5 5"/><path d="M16 5v4h4"/></svg></div><div class="insight-kpi-copy"><small>Overall progress</small><strong>${avg}%</strong><span>average ticket completion</span></div><div class="insight-ring" style="background:${ring}"><div><b>${avg}%</b></div></div></div>
        <div class="insight-kpi insight-kpi-overdue"><div class="insight-kpi-icon warm"><svg viewBox="0 0 24 24"><path d="M12 4 21 20H3L12 4Z"/><path d="M12 9v5M12 17h.01"/></svg></div><div class="insight-kpi-copy"><small>Overdue</small><strong>${overdue}</strong><span>past expected end date</span></div></div>
        <div class="insight-kpi insight-kpi-blocked"><div class="insight-kpi-icon green"><svg viewBox="0 0 24 24"><rect x="6" y="10" width="12" height="10" rx="2"/><path d="M8.5 10V7a3.5 3.5 0 0 1 7 0v3"/></svg></div><div class="insight-kpi-copy"><small>Blocked</small><strong>${blocked}</strong><span>risk or unresolved dependency</span></div></div>
      </div>
      <div class="insights-grid insights-grid-ref">
        <section class="insight-card insight-panel"><div class="insight-card-title"><span class="insight-title-icon purple">⌘</span><h3>Workflow distribution</h3></div><div class="insight-bars">${statusRows}</div></section>
        <section class="insight-card insight-panel"><div class="insight-card-title"><span class="insight-title-icon purple">⚑</span><h3>Release progress</h3></div><div class="insight-bars">${releaseRows}</div></section>
        <section class="insight-card insight-panel"><div class="insight-card-title"><span class="insight-title-icon purple">♧</span><h3>Open workload by assignee</h3></div><div class="insight-bars">${memberRows}</div></section>
        <section class="insight-card insight-panel"><div class="insight-card-title"><span class="insight-title-icon purple">⌁</span><h3>Delivery health</h3></div><div class="delivery-health-grid"><div class="delivery-health-card purple"><div class="delivery-health-icon">▣</div><div><strong>${deliveredPct}% delivered</strong><span>Done + Deployed on SIT compared with all tickets.</span></div></div><div class="delivery-health-card amber"><div class="delivery-health-icon">♢</div><div><strong>${attention} attention item(s)</strong><span>Combined blockers and overdue tickets; a ticket can appear in both categories.</span></div></div></div></section>
      </div>
      <section class="insight-card readiness-panel"><div class="readiness-panel-head"><div class="insight-card-title"><span class="insight-title-icon purple">⌁</span><h3>Release readiness</h3></div><select id="readinessRelease" class="control readiness-select">${state.releases.map(r=>`<option ${r===selectedReleaseReadiness?'selected':''}>${esc(r)}</option>`).join('')}</select><span class="readiness-count">${state.tickets.filter(t=>t.release===selectedReleaseReadiness).length} tickets</span></div>${releaseReadinessHtml(selectedReleaseReadiness)}</section>`;
    $('#readinessRelease')?.addEventListener('change',e=>{selectedReleaseReadiness=e.target.value;renderInsights();});
  }

  function renderReleaseEditor(){
    const el=$("#releaseEditor"); if(!el) return;
    el.innerHTML=state.releases.map((r,i)=>`<div class="release-row"><strong>${esc(r)}</strong><button class="btn small" type="button" data-remove-release="${i}">Remove</button></div>`).join('');
    $$('[data-remove-release]').forEach(btn=>btn.addEventListener('click',async()=>{
      const index=Number(btn.dataset.removeRelease);
      const r=state.releases[index];
      const used=state.tickets.filter(t=>t.release===r);
      if(used.length){toast(`Release “${r}” is still used by ${used.length} ticket${used.length===1?"":"s"}`);return;}
      const ok=await confirmAction({
        title:"Remove this release?",
        message:"This release or milestone will be removed from TeamFlow filters and ticket choices.",
        subject:r,
        confirmLabel:"Remove release",
        icon:"−",
        warning:"No tickets currently use this release."
      });
      if(!ok) return;
      state.releases.splice(index,1);saveState();renderReleaseEditor();renderMemberSelects();toast(`${r} removed`);
    }));
    renderSettingsSummary();
  }

  function renderBackups(){
    const el=$("#backupList"); if(!el) return;
    const backups=getBackups();
    el.innerHTML=backups.length?backups.map((b,i)=>`<div class="backup-row"><div style="min-width:0;flex:1"><strong>${new Date(b.ts).toLocaleString('en-GB')}</strong><small>${esc(b.label||'Snapshot')}</small></div><button class="btn small" type="button" data-restore-backup="${i}">Restore</button></div>`).join(''):'<div class="note">Browser snapshots are disabled in secure mode. Shared recovery is handled by server-side history and TeamFlow activity.</div>';
    $$('[data-restore-backup]').forEach(btn=>btn.addEventListener('click',async()=>{
      const b=getBackups()[Number(btn.dataset.restoreBackup)];if(!b)return;
      const ok=await confirmAction({title:"Restore this snapshot?",message:"Your current TeamFlow data will be replaced by the selected saved snapshot.",subject:new Date(b.ts).toLocaleString('en-GB'),confirmLabel:"Restore snapshot",icon:"↶",details:[b.label||"Snapshot","Current unsaved differences will be replaced."],warning:"Export the current board first if you may need it later."});
      if(!ok)return;
      try{state=JSON.parse(b.data);if(!Array.isArray(state.releases))state.releases=[];state.tickets.forEach(t=>{if(!t.type)t.type='Task';if(!t.release)t.release=t.sprint||state.releases[0]||'';if(!t.risk)t.risk='None';if(!Array.isArray(t.dependencies))t.dependencies=[];});saveState();renderMemberSelects();renderBoard();renderTeam();renderStatusEditor();renderReleaseEditor();renderBackups();toast('Snapshot restored');}catch(err){tfLogError('Snapshot restore failed',err);await noticeAction({title:'Snapshot could not be restored',message:'The saved snapshot is invalid or incomplete, so TeamFlow left your current workspace unchanged.',icon:'↶'});}
    }));
    renderSettingsSummary();
  }

  function refreshDataViews(){
    ensureAdvancedState();
    renderQuickFilters();
    renderBoard();
    renderMyWork();
    renderInsights();
    renderOverview();
    renderTimeline();
  }

  function switchView(name){
    activeView=name;
    $$(".view").forEach(v=>v.classList.remove("active"));
    $("#"+name+"View").classList.add("active");
    $$(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
    if($("#mobileViewSelect")) $("#mobileViewSelect").value=name;
    setQuickFiltersAvailability(name);
    if(name==="team") renderTeam();
    if(name==="documents") renderDocuments();
    if(name==="overview") renderOverview();
    if(name==="timeline") renderTimeline();
    if(name==="mywork") renderMyWork();
    if(name==="insights") renderInsights();
    if(name==="settings"){renderStatusEditor();renderWipEditor();renderReleaseEditor();renderBackups();renderSettingsSummary();}
  }

  function addDocument(doc){
    state.documents.push(doc);
    activeDocId = doc.id;
    saveState();
    renderDocuments();
  }

  function textToRichHtml(text){
    const safe=esc(text||"");
    if(!safe.trim()) return "";
    return safe.split(/\n{2,}/).map(block=>`<p>${block.replace(/\n/g,"<br>")}</p>`).join("");
  }

  function sanitizeRichHtml(html){
    const template=document.createElement("template");
    template.innerHTML=String(html||"");
    template.content.querySelectorAll("script,iframe,object,embed,style,link,meta,base,form,input,button,textarea,select").forEach(el=>el.remove());
    template.content.querySelectorAll("*").forEach(el=>{
      [...el.attributes].forEach(attr=>{
        const n=attr.name.toLowerCase();
        const v=String(attr.value||"").trim().toLowerCase();
        if(n.startsWith("on") || n==="srcdoc" || ((n==="href"||n==="src") && v.startsWith("javascript:"))) el.removeAttribute(attr.name);
      });
      if(el.tagName==="A"){
        el.setAttribute("target","_blank");
        el.setAttribute("rel","noopener noreferrer");
      }
    });
    return template.innerHTML;
  }

  function renderRichBlankEditor(doc,content){
    if(!doc.richHtml) doc.richHtml=textToRichHtml(doc.text||"");
    content.innerHTML=`<div class="blank-pad"><div class="rich-editor-shell">
      <div class="rich-toolbar" role="toolbar" aria-label="Document formatting">
        <select class="rich-tool-select" data-editor-format title="Text style"><option value="p">Normal</option><option value="h1">Heading 1</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option><option value="pre">Code block</option></select>
        <span class="rich-sep"></span>
        <button class="rich-tool" data-editor-cmd="bold" type="button" title="Bold"><b>B</b></button>
        <button class="rich-tool" data-editor-cmd="italic" type="button" title="Italic"><i>I</i></button>
        <button class="rich-tool" data-editor-cmd="underline" type="button" title="Underline"><u>U</u></button>
        <button class="rich-tool" data-editor-cmd="strikeThrough" type="button" title="Strikethrough"><s>S</s></button>
        <span class="rich-sep"></span>
        <button class="rich-tool" data-editor-cmd="insertUnorderedList" type="button" title="Bulleted list">•≡</button>
        <button class="rich-tool" data-editor-cmd="insertOrderedList" type="button" title="Numbered list">1≡</button>
        <button class="rich-tool" data-editor-quote type="button" title="Quote">❞</button>
        <span class="rich-sep"></span>
        <button class="rich-tool" data-editor-link type="button" title="Insert link">🔗</button>
        <button class="rich-tool" data-editor-code type="button" title="Code block">&lt;/&gt;</button>
        <input class="rich-tool-color" data-editor-color type="color" value="#6f4cff" title="Text color" />
        <button class="rich-tool" data-editor-cmd="removeFormat" type="button" title="Clear formatting">Tx</button>
        <span class="rich-sep"></span>
        <div class="rich-table-wrap"><button class="rich-tool" data-table-toggle type="button" title="Table actions">▦ ▾</button><div class="rich-table-menu hidden" data-table-menu>
          <button type="button" data-table-action="insert">▦ Insert 2 × 2 table</button>
          <button type="button" data-table-action="row">＋ Insert row below</button>
          <button type="button" data-table-action="column">＋ Insert column right</button>
          <button type="button" data-table-action="delete-row">− Delete current row</button>
          <button type="button" data-table-action="delete-column">− Delete current column</button>
          <button type="button" data-table-action="delete-table">× Delete table</button>
        </div></div>
      </div>
      <div class="rich-link-pop hidden" data-link-pop>
        <div class="rich-link-grid"><input data-link-label placeholder="Link text (optional)" /><input data-link-url type="text" inputmode="url" placeholder="google.com or https://..." /></div>
        <div class="rich-link-actions"><button class="btn small" data-link-cancel type="button">Cancel</button><button class="btn primary small" data-link-apply type="button">Insert link</button></div>
      </div>
      <div class="rich-editor-body" contenteditable="true" spellcheck="true" data-rich-editor data-placeholder="Start typing your notes, decisions, documentation, or meeting summary…">${sanitizeRichHtml(doc.richHtml)}</div>
      <div class="rich-editor-footer"><span class="rich-save-dot"></span><span data-save-status>Saved in TeamFlow</span><span style="margin-left:auto">Rich text · tables · links</span></div>
    </div></div>`;

    const shell=$(".rich-editor-shell",content);
    const editor=$("[data-rich-editor]",shell);
    const saveStatus=$("[data-save-status]",shell);
    let lastRange=null;
    let saveTimer=null;

    const captureRange=()=>{
      const sel=window.getSelection();
      if(!sel || !sel.rangeCount) return;
      const range=sel.getRangeAt(0);
      if(editor.contains(range.commonAncestorContainer)) lastRange=range.cloneRange();
    };
    const restoreRange=()=>{
      editor.focus();
      if(!lastRange) return;
      const sel=window.getSelection();
      sel.removeAllRanges();
      sel.addRange(lastRange);
    };
    const persist=()=>{
      doc.richHtml=sanitizeRichHtml(editor.innerHTML);
      doc.text=editor.innerText;
      doc.updatedAt=new Date().toISOString();
      saveStatus.textContent="Saving…";
      clearTimeout(saveTimer);
      saveTimer=setTimeout(()=>{saveState();saveStatus.textContent=storageAvailable?"Saved in TeamFlow":"Saved for this session";},450);
    };
    const exec=(cmd,value=null)=>{
      restoreRange();
      try{document.execCommand(cmd,false,value);}catch(_){ }
      captureRange();persist();
    };
    const currentCell=()=>{
      const node=lastRange?.startContainer || window.getSelection()?.anchorNode;
      const el=node?.nodeType===1?node:node?.parentElement;
      return el?.closest?.("td,th") || null;
    };

    editor.addEventListener("input",persist);
    editor.addEventListener("mouseup",captureRange);
    editor.addEventListener("keyup",captureRange);
    editor.addEventListener("focus",captureRange);
    editor.addEventListener("paste",()=>setTimeout(()=>{doc.richHtml=sanitizeRichHtml(editor.innerHTML);editor.innerHTML=doc.richHtml;persist();},0));
    editor.addEventListener("click",e=>{
      const link=e.target.closest?.("a");
      if(!link || !editor.contains(link)) return;
      e.preventDefault();
      e.stopPropagation();
      captureRange();
      linkPreviewAction(link.textContent.trim(),link.getAttribute("href")||"");
    });

    $$("[data-editor-cmd]",shell).forEach(btn=>{
      btn.addEventListener("mousedown",e=>{e.preventDefault();captureRange();});
      btn.addEventListener("click",()=>exec(btn.dataset.editorCmd));
    });
    $("[data-editor-format]",shell).addEventListener("change",e=>exec("formatBlock",e.target.value));
    $("[data-editor-color]",shell).addEventListener("input",e=>exec("foreColor",e.target.value));
    $("[data-editor-quote]",shell).addEventListener("mousedown",e=>{e.preventDefault();captureRange();});
    $("[data-editor-quote]",shell).addEventListener("click",()=>exec("formatBlock","blockquote"));
    $("[data-editor-code]",shell).addEventListener("mousedown",e=>{e.preventDefault();captureRange();});
    $("[data-editor-code]",shell).addEventListener("click",()=>exec("formatBlock","pre"));

    const linkPop=$("[data-link-pop]",shell);
    $("[data-editor-link]",shell).addEventListener("mousedown",e=>{e.preventDefault();captureRange();});
    $("[data-editor-link]",shell).addEventListener("click",()=>{
      const selected=lastRange && !lastRange.collapsed ? lastRange.toString() : "";
      $("[data-link-label]",shell).value=selected;
      $("[data-link-url]",shell).value="";
      linkPop.classList.remove("hidden");
      $("[data-link-url]",shell).focus();
    });
    $("[data-link-cancel]",shell).addEventListener("click",()=>linkPop.classList.add("hidden"));
    $("[data-link-apply]",shell).addEventListener("click",()=>{
      const url=$("[data-link-url]",shell).value.trim();
      const label=$("[data-link-label]",shell).value.trim();
      if(!url){$("[data-link-url]",shell).focus();return;}
      const valid=safeHttpUrl(url);
      if(!valid){toast("Please enter a valid web address");return;}
      restoreRange();
      const sel=window.getSelection();
      if(lastRange && !lastRange.collapsed){
        try{document.execCommand("createLink",false,valid);}catch(_){ }
        const anchor=(sel.anchorNode?.nodeType===1?sel.anchorNode:sel.anchorNode?.parentElement)?.closest?.("a");
        if(anchor){anchor.href=valid;anchor.target="_blank";anchor.rel="noopener noreferrer";}
      }else{
        document.execCommand("insertHTML",false,`<a href="${esc(valid)}" target="_blank" rel="noopener noreferrer">${esc(label||valid)}</a>`);
      }
      linkPop.classList.add("hidden");captureRange();persist();
    });

    const tableMenu=$("[data-table-menu]",shell);
    $("[data-table-toggle]",shell).addEventListener("mousedown",e=>{e.preventDefault();captureRange();});
    $("[data-table-toggle]",shell).addEventListener("click",e=>{
      e.stopPropagation();tableMenu.classList.toggle("hidden");
      if(!tableMenu.classList.contains("hidden")) setTimeout(()=>document.addEventListener("click",()=>tableMenu.classList.add("hidden"),{once:true}),0);
    });
    tableMenu.addEventListener("click",e=>e.stopPropagation());
    $$("[data-table-action]",shell).forEach(btn=>btn.addEventListener("click",()=>{
      const action=btn.dataset.tableAction;
      if(action==="insert"){
        restoreRange();
        document.execCommand("insertHTML",false,'<table><tbody><tr><td><br></td><td><br></td></tr><tr><td><br></td><td><br></td></tr></tbody></table><p><br></p>');
      }else{
        const cell=currentCell();
        if(!cell){toast("Place the cursor inside a table first");tableMenu.classList.add("hidden");return;}
        const row=cell.closest("tr");const table=cell.closest("table");const index=[...row.cells].indexOf(cell);
        if(action==="row"){
          const newRow=row.cloneNode(false);[...row.cells].forEach(()=>{const c=document.createElement("td");c.innerHTML="<br>";newRow.appendChild(c);});row.after(newRow);
        }else if(action==="column"){
          [...table.rows].forEach(r=>{const c=r.insertCell(Math.min(index+1,r.cells.length));c.innerHTML="<br>";});
        }else if(action==="delete-row"){
          if(table.rows.length<=1)table.remove();else row.remove();
        }else if(action==="delete-column"){
          if(row.cells.length<=1)table.remove();else [...table.rows].forEach(r=>{if(r.cells[index])r.deleteCell(index);});
        }else if(action==="delete-table") table.remove();
      }
      tableMenu.classList.add("hidden");captureRange();persist();
    }));
  }

  function renderDocuments(){
    const list=$("#docList");
    const viewer=$("#docViewer");

    if(!state.documents.length){
      list.innerHTML='<div class="note" style="padding:10px">No documents yet.</div>';
      viewer.innerHTML='<div class="doc-empty">Add an HTML page, PDF, SharePoint/Word link, or blank page.</div>';
      return;
    }
    if(!state.documents.some(d=>d.id===activeDocId)) activeDocId=state.documents[0].id;

    list.innerHTML=state.documents.map(d=>`
      <button class="doc-item ${d.id===activeDocId?"active":""}" data-doc-id="${esc(d.id)}" type="button">
        <span>${d.kind==="html"?"⌘":d.kind==="pdf-local"?"PDF":d.kind==="sharepoint"?"W":"＋"}</span>
        <span class="doc-name">${esc(d.name)}</span>
      </button>
    `).join("");

    $$(".doc-item").forEach(btn=>btn.addEventListener("click",()=>{activeDocId=btn.dataset.docId;renderDocuments();}));

    const doc=state.documents.find(d=>d.id===activeDocId);
    if(!doc) return;

    const openAction = doc.kind==="sharepoint"
      ? `<a class="btn small doc-open" href="${esc(doc.url)}" target="_blank" rel="noopener">Open in SharePoint</a>`
      : "";
    viewer.innerHTML=`<div class="doc-toolbar"><div class="doc-title">${esc(doc.name)}</div>${openAction}<button class="btn small doc-focus-btn" id="docFocusBtn" type="button" title="Focus preview"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg><span>Focus view</span></button><button class="btn danger small" id="removeDoc" type="button">Remove</button></div><div id="docContent"></div>`;
    $("#docFocusBtn").addEventListener("click",()=>{
      const active=viewer.classList.toggle("doc-focus-mode");
      document.body.classList.toggle("doc-focus-active",active);
      $("#docFocusBtn span").textContent=active?"Exit focus":"Focus view";
      $("#docFocusBtn").classList.toggle("active",active);
    });
    $("#removeDoc").addEventListener("click",async()=>{
      const ok=await confirmAction({
        title:"Remove this document from TeamFlow?",
        message:"The document tab and its TeamFlow reference will be removed from this workspace.",
        subject:doc.name,
        confirmLabel:"Remove document",
        icon:"−",
        details:[doc.kind==="sharepoint"?"The SharePoint / Word source remains unchanged.":doc.kind==="pdf-local"?"The original PDF file on your device remains unchanged.":doc.kind==="html"?"The original HTML file on your device remains unchanged.":"Any notes stored only in this TeamFlow page will be removed."],
        warning:doc.kind==="blank"?"Blank-page notes cannot be restored unless they exist in a backup or export.":"The source file itself is not deleted."
      });
      if(!ok) return;
      if(runtimeDocUrls.has(doc.id)){
        URL.revokeObjectURL(runtimeDocUrls.get(doc.id));
        runtimeDocUrls.delete(doc.id);
      }
      state.documents=state.documents.filter(d=>d.id!==doc.id);
      activeDocId=state.documents[0]?.id||null;
      saveState();renderDocuments();toast(`${doc.name} removed`);
    });

    const content=$("#docContent");
    if(doc.kind==="html"){
      content.innerHTML=`<iframe sandbox="allow-forms allow-scripts allow-modals" title="${esc(doc.name)}"></iframe>`;
      $("iframe",content).srcdoc=doc.html||"";
    }else if(doc.kind==="pdf-local"){
      const url=runtimeDocUrls.get(doc.id);
      content.innerHTML=url
        ? `<iframe src="${esc(url)}" title="${esc(doc.name)}"></iframe>`
        : `<div class="doc-empty">This PDF was loaded only for the current browser session. Re-upload the PDF to preview it again.</div>`;
    }else if(doc.kind==="sharepoint"){
      content.innerHTML=`<iframe src="${esc(doc.url)}" title="${esc(doc.name)}"></iframe>`;
    }else{
      renderRichBlankEditor(doc,content);
    }
  }

  $("#mainNav").addEventListener("click",e=>{
    const btn=e.target.closest("[data-view]");
    if(btn) switchView(btn.dataset.view);
  });


  // UI-only sidebar collapse preference. No board data is changed.
  (function initSidebarCollapse(){
    const appEl=document.querySelector('.app');
    const toggle=document.getElementById('sidebarToggle');
    if(!appEl||!toggle) return;
    let collapsed=false;
    try{collapsed=localStorage.getItem('teamflow-sidebar-collapsed')==='1';}catch(_){collapsed=false;}
    const apply=value=>{
      collapsed=!!value;
      appEl.classList.toggle('sidebar-collapsed',collapsed);
      toggle.setAttribute('aria-label',collapsed?'Expand sidebar':'Collapse sidebar');
      toggle.setAttribute('title',collapsed?'Expand sidebar':'Collapse sidebar');
      try{localStorage.setItem('teamflow-sidebar-collapsed',collapsed?'1':'0');}catch(_){}
    };
    apply(collapsed);
    toggle.addEventListener('click',()=>apply(!collapsed));
  })();

  function createWorkflowStep(options={}){
    if(cloudUser?.role!=="admin"){toast("Administrator access required");return;}
    ensureAdvancedState();
    const prefill=String(options.prefillName||"").trim();
    let selectedIcon=options.iconKey && WORKFLOW_ICON_LIBRARY[options.iconKey] ? options.iconKey : "circle";
    $("#modalRoot").innerHTML=`
      <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Add workflow step">
        <div class="modal workflow-create-modal" style="max-width:650px">
          <div class="modal-head"><h2>Add Workflow Step</h2><button id="closeModal" class="modal-close" type="button">×</button></div>
          <div class="modal-body">
            <div class="workflow-create-hero"><span class="workflow-create-preview" id="workflowCreatePreview">${workflowIconSvg(selectedIcon)}</span><div><strong>Create a workflow stage</strong><p>Choose a name, position and icon. The icon is saved with this workflow and appears on the Board.</p></div></div>
            <div class="form-grid" style="margin-top:14px">
              <div class="field full"><label>Step name *</label><input id="workflowName" value="${esc(prefill)}" placeholder="e.g. Ready for UAT" /></div>
              <div class="field full"><label>Insert after</label><select id="workflowAfter"><option value="__end__">At the end</option>${state.statuses.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join("")}</select></div>
              <div class="field full"><label>Workflow icon</label>${workflowIconPickerHtml(selectedIcon)}<span class="note">Pick an icon that makes this stage easy to recognize at a glance.</span></div>
            </div>
          </div>
          <div class="modal-actions"><div class="spacer"></div><button id="cancelWorkflow" class="btn" type="button">Cancel</button><button id="saveWorkflow" class="btn primary" type="button">Add Step</button></div>
        </div>
      </div>`;
    const close=()=>$("#modalRoot").innerHTML="";
    $("#closeModal").addEventListener("click",close);
    $("#cancelWorkflow").addEventListener("click",close);
    $$("[data-workflow-icon]").forEach(btn=>btn.addEventListener("click",()=>{
      selectedIcon=btn.dataset.workflowIcon;
      $$("[data-workflow-icon]").forEach(other=>{const active=other===btn;other.classList.toggle("selected",active);other.setAttribute("aria-checked",String(active));});
      const preview=$("#workflowCreatePreview");if(preview)preview.innerHTML=workflowIconSvg(selectedIcon);
    }));
    $("#saveWorkflow").addEventListener("click",()=>{
      const clean=$("#workflowName").value.trim();
      if(!clean){$("#workflowName").focus();toast("Workflow step name is required");return;}
      if(state.statuses.some(s=>s.toLowerCase()===clean.toLowerCase())){toast("That workflow step already exists");return;}
      const after=$("#workflowAfter").value;
      if(after==="__end__") state.statuses.push(clean);
      else{
        const index=state.statuses.indexOf(after);
        state.statuses.splice(index>=0?index+1:state.statuses.length,0,clean);
      }
      const sharedOrder=ensureSharedWorkflowOrder();
      const existingPos=sharedOrder.indexOf(clean);if(existingPos>=0)sharedOrder.splice(existingPos,1);
      if(after==="__end__")sharedOrder.push(clean);
      else{const sharedAfter=sharedOrder.indexOf(after);sharedOrder.splice(sharedAfter>=0?sharedAfter+1:sharedOrder.length,0,clean);}
      state.settings=state.settings||{};state.settings.workflowOrder=sharedOrder.slice();
      state.workflowOrder=sharedOrder.slice();
      state.statuses=sharedOrder.slice();
      if(!state.statusIcons||typeof state.statusIcons!=="object") state.statusIcons={};
      state.statusIcons[clean]=selectedIcon;
      normalizeWorkflowOrder();
      ensureAdvancedState();saveState();close();
      if(options.clearSettingsInput && $("#newStatusName")) $("#newStatusName").value="";
      renderMemberSelects();renderStatusEditor();renderWipEditor();renderBoard();toast(`Workflow step "${clean}" added`);
    });
    $("#workflowName").focus();
  }


  $('#filterMenuBtn')?.addEventListener('click',e=>{e.stopPropagation();const pop=$('#filterPopover');const opening=pop.classList.contains('hidden');pop.classList.toggle('hidden',!opening);$('#filterMenuBtn').setAttribute('aria-expanded',String(opening));});
  $('#closeFilterPopover')?.addEventListener('click',()=>{$('#filterPopover')?.classList.add('hidden');$('#filterMenuBtn')?.setAttribute('aria-expanded','false');});
  $('#clearFiltersBtn')?.addEventListener('click',clearAllBoardFilters);
  document.addEventListener('mousedown',e=>{const wrap=e.target.closest?.('.filter-menu-wrap');if(!wrap){$('#filterPopover')?.classList.add('hidden');$('#filterMenuBtn')?.setAttribute('aria-expanded','false');}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('doc-focus-active')){const viewer=$('#docViewer');viewer?.classList.remove('doc-focus-mode');document.body.classList.remove('doc-focus-active');const btn=$('#docFocusBtn');if(btn){btn.classList.remove('active');const label=$('span',btn);if(label)label.textContent='Focus view';}}});

  $('#overviewGoBoard')?.addEventListener('click',()=>switchView('board'));
  $('#overviewCreateTicket')?.addEventListener('click',()=>openTicketModal());
  $('#timelineGroup')?.addEventListener('change',()=>{const p=timelinePrefs();p.group=$('#timelineGroup').value;saveState();renderTimeline();});
  $('#timelineModeGantt')?.addEventListener('click',()=>{const p=timelinePrefs();p.mode='gantt';saveState();renderTimeline();});
  $('#timelineModeList')?.addEventListener('click',()=>{const p=timelinePrefs();p.mode='list';saveState();renderTimeline();});
  $('#timelineAddTicket')?.addEventListener('click',()=>openTicketModal());
  $('#timelineZoom')?.addEventListener('change',()=>{const p=timelinePrefs();p.zoom=$('#timelineZoom').value;saveState();renderTimeline();});
  $('#timelinePrev')?.addEventListener('click',()=>timelineShiftRange(-1));
  $('#timelineNext')?.addEventListener('click',()=>timelineShiftRange(1));
  $('#timelineToday')?.addEventListener('click',timelineGoToday);
  $('#timelineFilterBtn')?.addEventListener('click',e=>{e.stopPropagation();const pop=$('#timelineFilterPopover'),opening=pop.classList.contains('hidden');pop.classList.toggle('hidden',!opening);$('#timelineFilterBtn').setAttribute('aria-expanded',String(opening));$('#timelineRangePopover')?.classList.add('hidden');});
  $('#timelineFilterClose')?.addEventListener('click',()=>{$('#timelineFilterPopover')?.classList.add('hidden');$('#timelineFilterBtn')?.setAttribute('aria-expanded','false');});
  ['assignee','status','release','type'].forEach(key=>{$(`#timeline${key[0].toUpperCase()+key.slice(1)}Filter`)?.addEventListener('change',()=>{const p=timelinePrefs();p.filters[key]=$(`#timeline${key[0].toUpperCase()+key.slice(1)}Filter`).value;saveState();renderTimeline();});});
  $('#timelineClearFilters')?.addEventListener('click',()=>{const p=timelinePrefs();p.filters={assignee:'',status:'',release:'',type:''};saveState();renderTimeline();});
  $('#timelineRangeBtn')?.addEventListener('click',e=>{e.stopPropagation();const pop=$('#timelineRangePopover'),opening=pop.classList.contains('hidden');pop.classList.toggle('hidden',!opening);$('#timelineRangeBtn').setAttribute('aria-expanded',String(opening));$('#timelineFilterPopover')?.classList.add('hidden');});
  $('#timelineRangeClose')?.addEventListener('click',()=>{$('#timelineRangePopover')?.classList.add('hidden');$('#timelineRangeBtn')?.setAttribute('aria-expanded','false');});
  $('#timelineRangeApply')?.addEventListener('click',()=>{const start=timelineParseDate($('#timelineRangeStart').value),end=timelineParseDate($('#timelineRangeEnd').value);if(!start||!end||end<start){toast('Choose a valid timeline date range');return;}const p=timelinePrefs();p.rangeStart=timelineISO(start);p.rangeEnd=timelineISO(end);saveState();$('#timelineRangePopover')?.classList.add('hidden');renderTimeline();});
  $('#timelineProjectRange')?.addEventListener('click',()=>{const p=timelinePrefs(),tickets=timelineFilteredTickets(),range=timelineProjectRange(tickets);p.rangeStart=timelineISO(range[0]);p.rangeEnd=timelineISO(range[1]);saveState();$('#timelineRangePopover')?.classList.add('hidden');renderTimeline();});
  document.addEventListener('mousedown',e=>{if(!e.target.closest?.('.timeline-filter-wrap')){$('#timelineFilterPopover')?.classList.add('hidden');$('#timelineFilterBtn')?.setAttribute('aria-expanded','false');}if(!e.target.closest?.('.timeline-range-wrap')){$('#timelineRangePopover')?.classList.add('hidden');$('#timelineRangeBtn')?.setAttribute('aria-expanded','false');}});
  $('#commandPaletteBtn')?.addEventListener('click',openCommandPalette);
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){const tag=document.activeElement?.tagName?.toLowerCase();if(['input','textarea','select'].includes(tag))return;e.preventDefault();openCommandPalette();}});
  $('#saveCurrentView')?.addEventListener('click',openSaveViewModal);
  $('#savedViewSelect')?.addEventListener('change',()=>{const view=personalSavedViews().find(v=>v.id===$('#savedViewSelect').value);if(view)applyBoardViewConfig(view.config);});
  $('#deleteSavedView')?.addEventListener('click',async()=>{const id=$('#savedViewSelect').value;if(!id){toast('Choose a saved view first');return;}const views=personalSavedViews();const view=views.find(v=>v.id===id);const ok=await confirmAction({title:'Delete this saved view?',message:'Only the personal filter preset will be removed. Tickets are unchanged.',subject:view?.name||'Saved view',confirmLabel:'Delete view',icon:'×'});if(!ok)return;const key=memberIdForName(state.currentMember);state.savedViewsByMember[key]=views.filter(v=>v.id!==id);saveState();renderSavedViews();});
  $('#bulkModeBtn')?.addEventListener('click',()=>{bulkMode=!bulkMode;if(!bulkMode)bulkSelected.clear();renderBoard();if(bulkMode)setTimeout(()=>$('#bulkBar')?.scrollIntoView({behavior:'smooth',block:'nearest'}),40);});
  $('#cancelBulk')?.addEventListener('click',()=>{bulkMode=false;bulkSelected.clear();renderBoard();});
  $('#bulkSelectVisible')?.addEventListener('click',()=>{const visible=state.tickets.filter(ticketMatches),allSelected=visible.length>0&&visible.every(t=>bulkSelected.has(t.id));visible.forEach(t=>allSelected?bulkSelected.delete(t.id):bulkSelected.add(t.id));renderBoard();toast(allSelected?'Visible selection cleared':`${visible.length} visible ticket${visible.length===1?'':'s'} selected`);});
  $('#bulkClearSelection')?.addEventListener('click',()=>{bulkSelected.clear();renderBoard();});
  $('#applyBulk')?.addEventListener('click',()=>{if(!bulkSelected.size){toast('Select at least one ticket');return;}const values={status:$('#bulkStatus').value,assignee:$('#bulkAssignee').value,release:$('#bulkRelease').value,priority:$('#bulkPriority').value,progress:$('#bulkProgress').value,end:$('#bulkEnd').value};let changed=0;state.tickets.filter(t=>bulkSelected.has(t.id)).forEach(t=>{const changes=[];if(values.status){changes.push(`status ${t.status} → ${values.status}`);t.status=values.status;}if(values.assignee)t.assignee=values.assignee;if(values.release)t.release=values.release;if(values.priority)t.priority=values.priority;if(values.progress!=='')t.progress=normalizeProgress(values.progress);if(values.end)t.end=values.end;t.history=t.history||[];t.history.unshift('Bulk updated');logActivity('update',t,`Bulk updated${changes.length?' · '+changes.join(', '):''}`);changed++;});saveState();bulkSelected.clear();bulkMode=false;refreshDataViews();toast(`${changed} ticket${changed===1?'':'s'} updated`);});

  $('#dataMenuBtn')?.addEventListener('click',e=>{
    e.stopPropagation();
    const menu=$('#dataMenu');
    const opening=menu.classList.contains('hidden');
    menu.classList.toggle('hidden',!opening);
    $('#dataMenuBtn').setAttribute('aria-expanded',String(opening));
  });
  document.addEventListener('mousedown',e=>{
    if(!e.target.closest?.('.data-menu-wrap')){
      $('#dataMenu')?.classList.add('hidden');
      $('#dataMenuBtn')?.setAttribute('aria-expanded','false');
    }
  });
  $$('.font-size-option').forEach(btn=>btn.addEventListener('click',()=>{
    applyUserFontSize(btn.dataset.fontSize,true);
    toast(`Font size saved for ${state.currentMember}`);
  }));

  $("#addWorkflowStep").addEventListener("click",createWorkflowStep);
  $("#createTicket").addEventListener("click",()=>openTicketModal());
  $("#addMember").addEventListener("click",()=>openMemberModal());

  $("#themeToggle").addEventListener("click",()=>setTheme(state.theme==="dark"?"light":"dark"));
  $("#settingsTheme").addEventListener("click",()=>setTheme(state.theme==="dark"?"light":"dark"));
  $("#settingsMembersShortcut")?.addEventListener("click",()=>switchView("team"));
  $("#settingsArchiveShortcut")?.addEventListener("click",()=>{switchView("board");setTimeout(()=>{const sf=$("#statusFilter");if(sf){sf.value="Deprecated";sf.dispatchEvent(new Event("change",{bubbles:true}));}},0);});
  $("#settingsBackupShortcut")?.addEventListener("click",()=>$(".backup-settings")?.scrollIntoView({behavior:"smooth",block:"center"}));

  // Identity follows the authenticated TeamFlow account; there is no manual "Viewing as" switch.
  renderViewAsAvatarMenu();

  ["globalSearch","assigneeFilter","statusFilter","areaFilter","priorityFilter","releaseFilter","riskFilter","swimlaneFilter"].forEach(id=>{
    const el=$("#"+id);
    el.addEventListener(id==="globalSearch"?"input":"change",()=>{quickMode="clear";renderBoard();});
  });

  $$("[data-quick]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      if(activeView!=="board") return;
      quickMode=btn.dataset.quick;
      if(quickMode==="clear"){
        $("#assigneeFilter").value="";
        $("#statusFilter").value="";
        $("#areaFilter").value="";
        $("#priorityFilter").value="";
        if($("#releaseFilter")) $("#releaseFilter").value="";
        if($("#riskFilter")) $("#riskFilter").value="";
        $("#globalSearch").value="";
      }
      renderBoard();
      if(quickMode==="overdue") toast(`${state.tickets.filter(isOverdue).length} overdue ticket(s) as of ${localTodayISO()}`);
    });
  });

  $("#exportCsv").addEventListener("click",()=>{$('#dataMenu')?.classList.add('hidden');
    const delimiter=";";
    const headers=["ID","TASK","NOTE","TYPE","ASSIGNED TO","COLLABORATORS","ARCH/BE/FE","PRIORITY","STATUS","RISK","BLOCKER NOTE","DEPENDS ON","RELEASE","%","SPRINT","START","END","LABELS","DOCUMENTATION LINKS","CHECKLIST","AUTO PROGRESS"];
    const rows=state.tickets.map(t=>[
      t.id,t.title,t.description,t.type||"Task",t.assignee,(t.collaborators||[]).join(", "),t.area,t.priority,t.status,t.risk||"None",t.blockerNote||"",(t.dependencies||[]).join(", "),t.release||"",normalizeProgress(t.progress)+"%",t.sprint,t.start,t.end,(t.labels||[]).join(", "),encodeLinks(t.links||[]),(t.subtasks||[]).map(s=>`${s.done?'[x]':'[ ]'} ${s.text}`).join(" | "),t.autoProgress?"Yes":"No"
    ]);
    const csv=[headers,...rows].map(row=>row.map(v=>csvEscape(v,delimiter)).join(delimiter)).join("\r\n");
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");
    a.href=url;a.download="teamflow-board.csv";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });

  $("#importCsv").addEventListener("change",async e=>{$('#dataMenu')?.classList.add('hidden');
    const file=e.target.files[0];if(!file)return;
    tfLog("info","CSV import started",{name:file.name,size:file.size,type:file.type||"unknown"});
    try{
      const buffer=await file.arrayBuffer();
      let text;let encoding="utf-8";
      try{text=new TextDecoder("utf-8",{fatal:true}).decode(buffer);}
      catch(err){encoding="windows-1252";tfLog("warn","CSV UTF-8 decode failed; using Windows-1252 fallback",{name:file.name,message:err?.message||String(err)});text=new TextDecoder("windows-1252").decode(buffer);}
      const delimiter=detectCsvDelimiter(text);
      const rows=parseCsv(text,delimiter);
      tfLog("info","CSV parsed",{name:file.name,encoding,delimiter:delimiter==="\t"?"TAB":delimiter,rowCount:rows.length});
      if(rows.length<2) throw new Error("CSV has no task rows");
      const headerRow=findCsvHeaderRow(rows);
      if(headerRow<0) throw new Error('Could not find the task header row. Expected a column such as "TASK", "Title" or "Summary".');
      const headers=rows[headerRow].map(normalizeHeader);
      tfLog("info","CSV header detected",{headerRow:headerRow+1,headers});
      const col=(...names)=>{for(const n of names){const i=headers.indexOf(normalizeHeader(n));if(i>=0)return i;}return -1;};
      const idx={
        id:col("id","ticket id","key"),
        title:col("task","title","summary","activity","attività"),
        description:col("note","notes","description","details"),
        type:col("type","issue type","template"),
        assignee:col("assigned to","assignee","owner"),
        collaborators:col("collaborators","team members","team"),
        area:col("arch/be/fe","arch / be / fe","area"),
        priority:col("priority"),
        status:col("status"),
        risk:col("risk","risk flag"),
        blockerNote:col("blocker note","blocker","risk note"),
        dependencies:col("depends on","dependencies","blocked by"),
        release:col("release","milestone"),
        progress:col("%","progress","completion","percent","percentage"),
        sprint:col("sprint","wave","sprint / wave"),
        start:col("start","start date"),
        end:col("end","end date","expected end date","due date"),
        labels:col("labels","tags"),
        links:col("documentation links","links","documentation"),
        checklist:col("checklist","subtasks","sub-tasks"),
        autoProgress:col("auto progress","calculate progress")
      };
      if(idx.title<0) throw new Error('Could not find the task title column. Your file should contain "TASK", "Title" or "Summary".');
      let added=0,existingRows=0,newMembers=0,newStatuses=0,skipped=0,dateNormalized=0;
      for(const r of rows.slice(headerRow+1)){
        const val=k=>idx[k]>=0?String(r[idx[k]]||"").trim():"";
        const title=val("title");
        if(!title){skipped++;continue;}
        const hasTaskData=["assignee","status","area","progress","start","end"].some(k=>val(k)!=="");
        if(!hasTaskData){skipped++;continue;}

        const rawStart=val("start"),rawEnd=val("end"),normStart=normalizeDate(rawStart),normEnd=normalizeDate(rawEnd);
        if(rawStart&&normStart!==rawStart)dateNormalized++;
        if(rawEnd&&normEnd!==rawEnd)dateNormalized++;

        const rawId=val("id");
        const explicitId=rawId && !/^\d+$/.test(rawId) ? rawId : "";
        const importKey=csvImportKey({title,description:val("description"),assignee:splitAssigneeCell(val("assignee"))[0]||"",area:val("area"),start:normStart,end:normEnd});
        if(findExistingCsvTicket(explicitId,importKey)){existingRows++;continue;}

        const assigneeCandidates=splitAssigneeCell(val("assignee"));
        const assigneeRaw=assigneeCandidates[0] || state.currentMember || "";
        const collaboratorRaw=[...splitList(val("collaborators")),...assigneeCandidates.slice(1)];
        const beforeMembers=state.members.length;
        const assignee=ensureMember(assigneeRaw);
        const collaborators=[...new Set(collaboratorRaw.map(ensureMember).filter(Boolean))];
        newMembers+=state.members.length-beforeMembers;
        if(!state.currentMember && state.members.length) state.currentMember=state.members[0].name;

        const statusRaw=val("status") || state.statuses[0] || "To be started";
        let status=state.statuses.find(s=>s.toLowerCase()===statusRaw.toLowerCase());
        if(!status){status=statusRaw;state.statuses.push(status);newStatuses++;}
        const importedRelease=val("release")||val("sprint");
        if(importedRelease && !state.releases.some(r=>r.toLowerCase()===importedRelease.toLowerCase())) state.releases.push(importedRelease);

        const id=explicitId || nextTicketId();
        const fallbackProgress=["Done","Deployed on SIT"].includes(status)?100:0;
        const checklist=String(val("checklist")||"").split("|").map(x=>x.trim()).filter(Boolean).map((text,i)=>({id:'stcsv'+Date.now()+i,text:text.replace(/^\[(x| )\]\s*/i,''),done:/^\[x\]/i.test(text)}));
        const ticket={
          id,importKey,title,description:val("description"),type:val("type")||"Task",assignee,collaborators,area:val("area")||"BE",priority:val("priority")||"Medium",
          status,risk:["At Risk","Blocked"].includes(val("risk"))?val("risk"):"None",blockerNote:val("blockerNote"),dependencies:splitList(val("dependencies")),release:val("release")||val("sprint")||"",sprint:val("sprint"),progress:normalizeProgress(val("progress"),fallbackProgress),start:normStart||localTodayISO(),end:normEnd,
          labels:splitList(val("labels")),links:decodeLinks(val("links")),subtasks:checklist,autoProgress:/^(yes|true|1)$/i.test(val("autoProgress")),comments:[],history:["Imported from CSV"]
        };
        state.tickets.push(ticket);
        added++;
      }
      normalizeWorkflowOrder();
      saveState();renderMemberSelects();renderTeam();renderStatusEditor();renderReleaseEditor();renderBackups();renderBoard();
      logActivity('import',null,`CSV import: ${added} new ticket(s), ${existingRows} existing row(s) skipped`);saveState();
      tfLog("info","CSV import completed",{file:file.name,added,existing:existingRows,newMembers,newStatuses,skipped,dateNormalized});
      openImportDiagnostics({added,existing:existingRows,newMembers,newStatuses,skipped,dateNormalized});
    }catch(err){tfLogError("CSV import failed",err,{file:file.name,size:file.size});await noticeAction({title:"CSV import could not be completed",message:err.message||"The CSV format could not be read.",subject:"Check the browser Console for the technical error details.",icon:"CSV"});}
    finally{e.target.value="";}
  });

  $("#exportData").addEventListener("click",()=>{$('#dataMenu')?.classList.add('hidden');
    const data={...state,documents:state.documents.filter(d=>d.kind!=="pdf-local")};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download="teamflow-data.json";document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  });

  $("#importData").addEventListener("change",async e=>{$('#dataMenu')?.classList.add('hidden');
    const file=e.target.files[0];if(!file)return;
    tfLog("info","JSON workspace import started",{name:file.name,size:file.size,type:file.type||"unknown"});
    try{
      const imported=JSON.parse(await file.text());
      if(!Array.isArray(imported.tickets)||!Array.isArray(imported.members)||!Array.isArray(imported.statuses)) throw new Error("Invalid format");
      state={...state,...imported,documents:Array.isArray(imported.documents)?imported.documents:[]};
      if(!Array.isArray(state.releases)) state.releases=[];
      if(!state.settings||typeof state.settings!=="object"||Array.isArray(state.settings))state.settings={};
      if(!Array.isArray(state.settings.workflowOrder)||!state.settings.workflowOrder.length)state.settings.workflowOrder=Array.isArray(state.workflowOrder)&&state.workflowOrder.length?state.workflowOrder.slice():state.statuses.slice();
      state.workflowOrder=state.settings.workflowOrder.slice();state.statuses=state.settings.workflowOrder.slice();
      state.tickets.forEach(t=>{if(!t.type)t.type="Task";if(!t.release)t.release=t.sprint||state.releases[0]||"";if(!t.risk)t.risk="None";if(!Array.isArray(t.dependencies))t.dependencies=[];});
      activeDocId=state.documents[0]?.id||null;ensureAdvancedState();
      saveState();setTheme(state.theme);renderMemberSelects();renderBoard();renderTeam();renderStatusEditor();renderWipEditor();renderReleaseEditor();renderBackups();renderDocuments();renderOverview();renderTimeline();
      tfLog("info","JSON workspace import completed",{file:file.name,tickets:state.tickets.length,members:state.members.length,statuses:state.statuses.length});
      toast("TeamFlow data imported");
    }catch(err){
      tfLogError("JSON workspace import failed",err,{file:file.name,size:file.size});
      await noticeAction({title:"Invalid TeamFlow JSON",message:"This file does not contain a valid TeamFlow workspace export, so nothing was imported.",subject:"Check the browser Console for technical error details.",icon:"{}"});
    }finally{
      e.target.value="";
    }
  });

  $("#htmlUpload").addEventListener("change",async e=>{
    const file=e.target.files[0];if(!file)return;
    const html=await file.text();
    addDocument({id:"d"+Date.now(),name:file.name,kind:"html",html});
    e.target.value="";
  });

  $("#pdfUpload").addEventListener("change",e=>{
    const file=e.target.files[0];if(!file)return;
    const id="d"+Date.now();
    const url=URL.createObjectURL(file);
    runtimeDocUrls.set(id,url);
    state.documents.push({id,name:file.name,kind:"pdf-local"});
    activeDocId=id;
    renderDocuments();
    e.target.value="";
  });

  $("#addWordLink").addEventListener("click",openSharePointModal);

  $("#addBlankPage").addEventListener("click",openBlankPageModal);

  $("#addStatus").addEventListener("click",()=>{
    const name=$("#newStatusName").value.trim();
    createWorkflowStep({prefillName:name,clearSettingsInput:true});
  });

  $("#addRelease").addEventListener("click",()=>{
    const name=$("#newReleaseName").value.trim();
    if(!name)return;
    if(state.releases.some(r=>r.toLowerCase()===name.toLowerCase())){toast("That release already exists");return;}
    state.releases.push(name);$("#newReleaseName").value="";saveState();renderReleaseEditor();renderMemberSelects();toast(`Release "${name}" added`);
  });

  $("#resetData").addEventListener("click",async()=>{
    const ok=await confirmAction({title:"Clear the TeamFlow workspace?",message:"This clears the shared TeamFlow data for everyone. Personal browser preferences such as theme and font size are kept.",subject:"Shared TeamFlow workspace",confirmLabel:"Clear workspace",icon:"↺",details:[`${state.tickets.length} ticket${state.tickets.length===1?"":"s"} will be removed.`,`${state.members.length} team member${state.members.length===1?"":"s"} will be removed.`,"Default workflow columns will remain available for the next CSV import."],warning:"Export JSON or CSV first if you want to keep a copy. This shared change will sync to other signed-in users."});
    if(!ok)return;
    state={
      tickets:[],members:[],statuses:clone(DEFAULT_STATUSES),releases:[],theme:state.theme,currentMember:"",documents:[],
      activity:[],favorites:[],recentTickets:[],savedViewsByMember:{},wipLimits:{},fontSizeByMember:{},statusIcons:{},timelinePrefs:{},settings:{workflowOrder:clone(DEFAULT_STATUSES)},workflowOrder:clone(DEFAULT_STATUSES)
    };
    activeDocId=null;
    try{localStorage.removeItem(BACKUP_KEY);}catch(_){}
    ensureAdvancedState();saveState();renderMemberSelects();renderBoard();renderTeam();renderStatusEditor();renderWipEditor();renderReleaseEditor();renderBackups();renderDocuments();renderOverview();renderTimeline();toast("Workspace cleared");
  });


  /* TeamFlow custom select UI -------------------------------------------------
     Keeps every native <select> as the source of truth, then mirrors it with a
     consistent popup so existing change handlers/data logic are untouched. */
  let tfOpenSelect=null;
  let tfSelectPortal=null;
  function tfSelectText(select){
    const opt=select.selectedOptions?.[0] || select.options?.[select.selectedIndex] || select.options?.[0];
    return opt?.textContent?.trim() || "Select…";
  }
  function closeCustomSelect(){
    if(tfOpenSelect?.button) tfOpenSelect.button.setAttribute('aria-expanded','false');
    tfOpenSelect=null;
    if(tfSelectPortal){tfSelectPortal.remove();tfSelectPortal=null;}
  }
  function positionCustomSelectMenu(){
    if(!tfOpenSelect||!tfSelectPortal)return;
    const rect=tfOpenSelect.button.getBoundingClientRect();
    const margin=8;
    const width=Math.max(rect.width,Math.min(320,tfOpenSelect.select.dataset.dropdownWidth?Number(tfOpenSelect.select.dataset.dropdownWidth):rect.width));
    tfSelectPortal.style.width=Math.min(width,window.innerWidth-margin*2)+'px';
    const menuH=Math.min(tfSelectPortal.scrollHeight,290);
    const below=window.innerHeight-rect.bottom-margin;
    const above=rect.top-margin;
    const top=(below>=Math.min(menuH,180)||below>=above)?rect.bottom+5:Math.max(margin,rect.top-menuH-5);
    let left=rect.left;
    if(left+parseFloat(tfSelectPortal.style.width)>window.innerWidth-margin)left=window.innerWidth-margin-parseFloat(tfSelectPortal.style.width);
    tfSelectPortal.style.left=Math.max(margin,left)+'px';
    tfSelectPortal.style.top=Math.max(margin,top)+'px';
  }
  function openCustomSelect(select,button){
    if(select.disabled)return;
    if(tfOpenSelect?.select===select){closeCustomSelect();return;}
    closeCustomSelect();
    const portal=document.createElement('div');portal.className='tf-select-menu-portal';portal.setAttribute('role','listbox');
    [...select.options].forEach((opt,index)=>{
      const item=document.createElement('button');item.type='button';item.className='tf-select-option'+(opt.selected?' selected':'');item.disabled=opt.disabled;item.dataset.value=opt.value;item.setAttribute('role','option');item.setAttribute('aria-selected',String(opt.selected));
      item.innerHTML=`<span>${esc(opt.textContent.trim())}</span><span class="tf-option-check">✓</span>`;
      item.addEventListener('click',()=>{if(opt.disabled)return;select.selectedIndex=index;select.dispatchEvent(new Event('change',{bubbles:true}));button.querySelector('.tf-select-label').textContent=tfSelectText(select);closeCustomSelect();button.focus();});
      portal.appendChild(item);
    });
    document.body.appendChild(portal);tfSelectPortal=portal;tfOpenSelect={select,button};button.setAttribute('aria-expanded','true');positionCustomSelectMenu();
    const selected=portal.querySelector('.selected');if(selected)selected.scrollIntoView({block:'nearest'});
  }
  function enhanceSelect(select){
    if(!select||select.dataset.noCustom==='1'||select.dataset.tfSelectReady==='1'||select.multiple||Number(select.size)>1)return;
    select.dataset.tfSelectReady='1';select.classList.add('tf-native-select');
    const wrap=document.createElement('div');wrap.className='tf-select';
    select.parentNode.insertBefore(wrap,select);wrap.appendChild(select);
    const button=document.createElement('button');button.type='button';button.className='tf-select-button';button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');button.innerHTML=`<span class="tf-select-label"></span><span class="tf-select-chevron" aria-hidden="true"></span>`;wrap.appendChild(button);
    const update=()=>{const label=button.querySelector('.tf-select-label');const next=tfSelectText(select);if(label&&label.textContent!==next)label.textContent=next;button.disabled=select.disabled;};update();
    button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openCustomSelect(select,button);});
    button.addEventListener('keydown',e=>{if(['Enter',' ','ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();openCustomSelect(select,button);}else if(e.key==='Escape')closeCustomSelect();});
    select.addEventListener('change',update);
    new MutationObserver(update).observe(select,{childList:true,subtree:true,attributes:true,attributeFilter:['selected','disabled','label']});
  }
  function syncCustomSelects(){
    document.querySelectorAll('select').forEach(enhanceSelect);
    document.querySelectorAll('select[data-tf-select-ready="1"]').forEach(select=>{
      const btn=select.parentElement?.querySelector('.tf-select-button');if(btn){const label=btn.querySelector('.tf-select-label');const next=tfSelectText(select);if(label&&label.textContent!==next)label.textContent=next;btn.disabled=select.disabled;}
    });
  }
  document.addEventListener('mousedown',e=>{if(tfOpenSelect&&!e.target.closest('.tf-select')&&!e.target.closest('.tf-select-menu-portal'))closeCustomSelect();});
  window.addEventListener('resize',closeCustomSelect);window.addEventListener('scroll',()=>{if(tfOpenSelect)positionCustomSelectMenu();},true);
  new MutationObserver(()=>syncCustomSelects()).observe(document.body,{childList:true,subtree:true});


  tfLog("info","TeamFlow JavaScript initialized",{version:"diagnostics-1",location:window.location.href});
  normalizeWorkflowOrder();
  ensureAdvancedState();
  state.tickets.forEach(t=>{
    if(!Array.isArray(t.links))t.links=[];
    if(!Array.isArray(t.collaborators))t.collaborators=[];
    t.start=normalizeDate(t.start);t.end=normalizeDate(t.end);
    const inferred=["Done","Deployed on SIT"].includes(t.status)?100:0;
    t.progress=normalizeProgress(t.progress,inferred);
    if(!Array.isArray(t.subtasks))t.subtasks=[];t.subtasks.forEach((st,i)=>{if(!st.id)st.id=`st${t.id.replace(/[^a-z0-9]/gi,'')}_${i}`;});
    if(typeof t.autoProgress!=="boolean")t.autoProgress=false;
    (t.comments||[]).forEach((c,i)=>{if(!c.id)c.id=`c${t.id.replace(/[^a-z0-9]/gi,'')}_${i}`;if(!c.reactions)c.reactions={};});
  });
  setInterval(()=>{
    const today=localTodayISO();
    if(today!==lastToday){lastToday=today;refreshDataViews();}
  },60000);

  setTheme(state.theme);
  applyUserFontSize();
  setQuickFiltersAvailability("overview");
  renderMemberSelects();
  renderBoard();
  renderTeam();
  renderStatusEditor();
  renderWipEditor();
  renderReleaseEditor();
  renderBackups();
  renderDocuments();
  renderOverview();
  renderTimeline();
  syncCustomSelects();
  // Start secure cloud synchronization after the first local render. This preserves
  // the current imported workspace as the seed if no shared state exists yet.
  setTimeout(()=>initCloudSync(),0);
})();
