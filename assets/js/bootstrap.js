"use strict";

// TeamFlow modular build — generated from the verified granular API runtime.
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