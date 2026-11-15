"use strict";

// TeamFlow modular build — generated from the verified granular API runtime.
  initializeLocalStateAfterModules();

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
      // Workflow identity may be created here, but its saved order is NOT changed here.
      // The admin must use the workflow drag editor and click Save order explicitly.
      workflowOrderDraft=null;
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
      // Imported workspace data is not allowed to redefine the shared workflow order.
      delete state.settings.workflowOrder;
      delete state.workflowOrder;
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


