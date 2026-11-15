"use strict";

// TeamFlow modular build — generated from the verified granular API runtime.
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
  let activeDocId = null;
  let runtimeDocUrls = new Map();
  let quickMode = "clear";
  let activeView = "overview";
  let lastToday = "";
  let ticketDetailStack = [];
  let bulkMode = false;
  let bulkSelected = new Set();
  let selectedReleaseReadiness = "";
  let workflowOrderDraft = null;
  let storageAvailable = true;
  let teamFlowLocalStateInitialized = false;

  // The original single-file build relied on function hoisting across the entire IIFE.
  // In the modular build we defer this one-time state normalization until all modules
  // are loaded, preserving the exact same behavior without introducing new data logic.
  function initializeLocalStateAfterModules(){
    if(teamFlowLocalStateInitialized) return;
    teamFlowLocalStateInitialized = true;
    if(!Array.isArray(state.documents)) state.documents=[];
    if(!Array.isArray(state.statuses) || !state.statuses.length) state.statuses=clone(DEFAULT_STATUSES);
    if(!Array.isArray(state.members)) state.members=[];
    ensureMemberColors();
    if(!Array.isArray(state.releases)) state.releases=[];
    if(!state.members.some(m=>m.name===state.currentMember)) state.currentMember=state.members[0]?.name||"";
    if(!state.myWorkPrefsByMember || typeof state.myWorkPrefsByMember!=="object" || Array.isArray(state.myWorkPrefsByMember)) state.myWorkPrefsByMember={};
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
    activeDocId = state.documents[0]?.id || null;
    lastToday = localTodayISO();
  }

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
  let cloudBaselineState = null;
  let deltaSaveTimer = null;
  let deltaSaving = false;
  let deltaDirty = false;

