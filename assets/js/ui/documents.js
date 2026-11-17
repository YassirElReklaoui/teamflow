"use strict";

// TeamFlow modular build — generated from the verified granular API runtime.
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
      addDocument({id:"d"+Date.now(),name,kind:"blank",text:"",richHtml:""});
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
    const mine=unarchivedTickets().filter(t=>t.assignee===state.currentMember);
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
    const normal=unarchivedTickets();
    const total=normal.length;
    const done=normal.filter(t=>["Done","Deployed on SIT"].includes(t.status)).length;
    const overdue=normal.filter(isOverdue).length;
    const blocked=normal.filter(isBlocked).length;
    const avg=total?Math.round(normal.reduce((sum,t)=>sum+normalizeProgress(t.progress),0)/total):0;
    const deliveredPct=total?Math.round(done/total*100):0;
    const attention=blocked+overdue;
    const maxStatus=Math.max(1,...state.statuses.map(status=>normal.filter(t=>t.status===status).length));
    const maxMember=Math.max(1,...state.members.map(member=>activeTickets(normal.filter(t=>t.assignee===member.name)).length));
    const statusRows=state.statuses.map(status=>{
      const count=normal.filter(t=>t.status===status).length;
      return `<div class="insight-bar-row"><span>${esc(status)}</span><div class="insight-bar-track"><div class="insight-bar-fill" style="width:${Math.round(count/maxStatus*100)}%"></div></div><strong>${count}</strong></div>`;
    }).join('');
    const releaseRows=state.releases.map(release=>{
      const list=normal.filter(t=>t.release===release);
      const progress=list.length?Math.round(list.reduce((sum,t)=>sum+normalizeProgress(t.progress),0)/list.length):0;
      return `<div class="insight-bar-row"><span>${esc(release)}</span><div class="insight-bar-track"><div class="insight-bar-fill" style="width:${progress}%"></div></div><strong>${progress}%</strong></div>`;
    }).join('');
    const memberRows=state.members.map(member=>{
      const count=activeTickets(normal.filter(t=>t.assignee===member.name)).length;
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
    ensureAdvancedState();
    const releases=state.releases||[];
    const counts={active:0,hidden:0,archived:0};
    releases.forEach(r=>{const v=releaseVisibility(r);counts[v]=(counts[v]||0)+1;});
    const stateCopy={
      active:{label:'Active',hint:'Visible on the Board',icon:'●'},
      hidden:{label:'Hidden',hint:'Tickets hidden from Board',icon:'◐'},
      archived:{label:'Archived',hint:'Milestone retired',icon:'◇'}
    };
    const cards=releases.map((r,i)=>{
      const visibility=releaseVisibility(r);
      const used=state.tickets.filter(t=>t.release===r).length;
      const archivedTickets=state.tickets.filter(t=>t.release===r&&t.archived).length;
      const openTickets=Math.max(0,used-archivedTickets);
      const meta=stateCopy[visibility]||stateCopy.active;
      const actions=visibility==='active'
        ? `<button class="release-action secondary" data-release-action="hide" data-release-name="${esc(r)}" type="button">Hide</button><button class="release-action warning" data-release-action="archive" data-release-name="${esc(r)}" type="button">Archive</button>`
        : visibility==='hidden'
          ? `<button class="release-action success" data-release-action="active" data-release-name="${esc(r)}" type="button">Activate</button><button class="release-action warning" data-release-action="archive" data-release-name="${esc(r)}" type="button">Archive</button>`
          : `<button class="release-action success" data-release-action="active" data-release-name="${esc(r)}" type="button">Restore</button><button class="release-action secondary" data-release-action="hide" data-release-name="${esc(r)}" type="button">Hide</button>`;
      return `<article class="release-lifecycle-card ${visibility}">
        <div class="release-card-accent"></div>
        <div class="release-card-top">
          <div class="release-card-identity"><span class="release-card-icon">${meta.icon}</span><div><strong>${esc(r)}</strong><small>${meta.hint}</small></div></div>
          <span class="release-state-chip ${visibility}">${meta.label}</span>
        </div>
        <div class="release-card-metrics">
          <div><b>${used}</b><span>tickets</span></div>
          <div><b>${openTickets}</b><span>visible data</span></div>
          <div><b>${archivedTickets}</b><span>ticket archives</span></div>
        </div>
        <div class="release-card-foot">
          <div class="release-card-impact"><span class="release-impact-dot"></span>${used?`${used} ticket${used===1?'':'s'} linked`:'No tickets linked'}</div>
          <div class="release-card-actions">${actions}<button class="release-action danger" type="button" data-remove-release="${i}">Remove</button></div>
        </div>
      </article>`;
    }).join('');
    el.innerHTML=`<div class="release-overview-strip">
      <div class="release-overview-item active"><span></span><b>${counts.active||0}</b><small>Active</small></div>
      <div class="release-overview-item hidden"><span></span><b>${counts.hidden||0}</b><small>Hidden</small></div>
      <div class="release-overview-item archived"><span></span><b>${counts.archived||0}</b><small>Archived</small></div>
    </div><div class="release-card-grid">${cards||'<div class="release-empty-state"><b>No milestones yet</b><span>Create the first release above.</span></div>'}</div>`;
    $$('[data-release-action]').forEach(btn=>btn.addEventListener('click',()=>{const name=btn.dataset.releaseName;const next=btn.dataset.releaseAction;setReleaseVisibility(name,next);saveState();renderReleaseEditor();renderMemberSelects();renderBoard();toast(`${name} is now ${next}`);}));
    $$('[data-remove-release]').forEach(btn=>btn.addEventListener('click',async()=>{
      const index=Number(btn.dataset.removeRelease);
      const r=state.releases[index];
      const used=state.tickets.filter(t=>t.release===r);
      if(used.length){toast(`Release “${r}” is still used by ${used.length} ticket${used.length===1?'':'s'}`);return;}
      const ok=await confirmAction({title:'Remove this release?',message:'This release or milestone will be removed from TeamFlow.',subject:r,confirmLabel:'Remove release',icon:'−',warning:'No tickets currently use this release.'});
      if(!ok)return;
      state.releases.splice(index,1);if(state.releaseMeta)delete state.releaseMeta[r];saveState();renderReleaseEditor();renderMemberSelects();toast(`${r} removed`);
    }));
    renderSettingsSummary();
  }

  function renderBackups(){
    const el=$("#backupList"); if(!el) return;
    const isAdmin=cloudUser?.role==="admin";
    const backupCard=el.closest('.backup-settings');if(backupCard)backupCard.style.display=isAdmin?'':'none';
    if(!isAdmin){el.innerHTML='';return;}
    const backups=getBackups();
    el.innerHTML=backups.length?backups.map(b=>`<article class="backup-card">
      <div class="backup-card-icon">↶</div>
      <div class="backup-card-main"><div class="backup-card-top"><strong>${esc(b.label||'Workspace backup')}</strong><span>${new Date(b.createdAt||b.ts).toLocaleString('en-GB')}</span></div><div class="backup-card-meta"><span>by ${esc(b.createdBy||'admin')}</span><span>${Number(b.counts?.tickets||0)} tickets</span><span>${Number(b.counts?.members||0)} members</span><span>${Number(b.counts?.documents||0)} documents</span></div></div>
      <button class="btn small" type="button" data-restore-backup-id="${esc(b.id)}">Restore</button>
    </article>`).join(''):'<div class="backup-empty"><span>↶</span><strong>No backups yet</strong><small>Create a full workspace snapshot before major imports, bulk edits or configuration changes.</small></div>';
    $$('[data-restore-backup-id]').forEach(btn=>btn.addEventListener('click',async()=>{
      const b=getBackups().find(x=>String(x.id)===String(btn.dataset.restoreBackupId));if(!b)return;
      const ok=await confirmAction({title:'Restore this backup?',message:'TeamFlow will replace the current shared workspace with this server snapshot.',subject:b.label||new Date(b.createdAt).toLocaleString('en-GB'),confirmLabel:'Restore backup',icon:'↶',details:[new Date(b.createdAt).toLocaleString('en-GB'),`Created by ${b.createdBy||'admin'}`,`${b.counts?.tickets||0} tickets · ${b.counts?.members||0} members`],warning:'Current shared data will be replaced. Create a new backup first if you may need the current state.'});
      if(!ok)return;btn.disabled=true;btn.textContent='Restoring…';try{await restoreWorkspaceBackup(b.id);refreshDataViews();renderTeam();renderStatusEditor();renderReleaseEditor();toast('Workspace restored from backup');}catch(err){tfLogError('Backup restore failed',err,{backupId:b.id});toast('Backup could not be restored');}finally{btn.disabled=false;btn.textContent='Restore';}
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
    renderArchivedTickets();
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
    if(name==="archive") renderArchivedTickets();
    if(name==="settings"){renderStatusEditor();renderWipEditor();renderReleaseEditor();renderBackups();renderSettingsSummary();if(cloudUser?.role==="admin")loadBackups({quiet:true}).then(()=>{renderBackups();renderSettingsSummary();});}
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


  function attachRichEditorMentions(editor,onCommit){
    if(!editor||editor.dataset.richMentionsReady==='1')return;
    editor.dataset.richMentionsReady='1';
    const menu=document.createElement('div');menu.className='mention-menu mention-portal hidden rich-mention-menu';document.body.appendChild(menu);
    let matches=[],active=0,context=null;
    const hide=()=>{menu.classList.add('hidden');matches=[];context=null;};
    const getContext=()=>{
      const sel=window.getSelection();if(!sel||!sel.rangeCount||!sel.isCollapsed)return null;
      const range=sel.getRangeAt(0);if(!editor.contains(range.startContainer))return null;
      const node=range.startContainer;if(node.nodeType!==Node.TEXT_NODE)return null;
      const before=(node.textContent||'').slice(0,range.startOffset);
      const match=before.match(/(?:^|\s)@([^@\n]{0,80})$/);if(!match)return null;
      return {node,start:range.startOffset-(match[1].length+1),end:range.startOffset,query:match[1].trim().toLowerCase(),range};
    };
    const position=()=>{
      const sel=window.getSelection();if(!sel||!sel.rangeCount)return;const r=sel.getRangeAt(0).cloneRange();const rect=r.getBoundingClientRect();
      const width=Math.min(360,window.innerWidth-24);menu.style.width=`${width}px`;menu.style.left=`${Math.max(12,Math.min(window.innerWidth-width-12,rect.left))}px`;menu.style.top=`${Math.min(window.innerHeight-250,rect.bottom+8)}px`;
    };
    const choose=member=>{
      if(!context||!member)return;const range=document.createRange();range.setStart(context.node,context.start);range.setEnd(context.node,context.end);range.deleteContents();
      const token=document.createElement('span');token.className='rich-mention-token';token.dataset.mentionName=member.name;token.contentEditable='false';token.textContent=`@${member.name}`;token.style.setProperty('--member-color',member.color||memberColor(member.name));
      const spacer=document.createTextNode(' ');const fragment=document.createDocumentFragment();fragment.append(token,spacer);range.insertNode(fragment);range.setStartAfter(spacer);range.collapse(true);const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);hide();editor.focus();onCommit?.();
    };
    const render=()=>{
      context=getContext();if(!context){hide();return;}
      matches=(state.members||[]).filter(m=>!context.query||String(m.name||'').toLowerCase().includes(context.query)).slice(0,8);active=0;
      if(!matches.length){hide();return;}
      menu.innerHTML=matches.map((m,i)=>`<button class="mention-option ${i===0?'active':''}" type="button" data-rich-mention="${i}" style="--member-color:${esc(m.color||memberColor(m.name))}"><span class="mention-avatar">${esc(initials(m.name))}</span><span class="mention-copy"><strong>${esc(m.name)}</strong><small>${esc(m.role||'Team member')}</small></span></button>`).join('');
      menu.classList.remove('hidden');position();menu.querySelectorAll('[data-rich-mention]').forEach(btn=>btn.addEventListener('pointerdown',e=>{e.preventDefault();choose(matches[Number(btn.dataset.richMention)]);}));
    };
    editor.addEventListener('input',render);
    editor.addEventListener('keyup',e=>{if(!['ArrowUp','ArrowDown','Enter','Escape'].includes(e.key))render();});
    editor.addEventListener('keydown',e=>{if(menu.classList.contains('hidden')||!matches.length)return;if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();active=(active+(e.key==='ArrowDown'?1:-1)+matches.length)%matches.length;menu.querySelectorAll('.mention-option').forEach((b,i)=>b.classList.toggle('active',i===active));}else if(e.key==='Enter'){e.preventDefault();choose(matches[active]);}else if(e.key==='Escape'){e.preventDefault();hide();}});
    editor.addEventListener('blur',()=>setTimeout(hide,160));
    window.addEventListener('resize',()=>{if(!menu.classList.contains('hidden'))position();});
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
      <div class="rich-editor-footer"><span class="rich-save-dot" data-save-dot></span><span data-save-status>Saved</span><span class="rich-editor-mode">Rich text · tables · links · @mentions</span><button class="btn primary small rich-document-save" data-document-save type="button" disabled>Save changes</button></div>
    </div></div>`;

    const shell=$(".rich-editor-shell",content);
    const editor=$("[data-rich-editor]",shell);
    const saveStatus=$("[data-save-status]",shell);
    const saveButton=$("[data-document-save]",shell);
    const saveDot=$("[data-save-dot]",shell);
    let lastRange=null;
    let dirty=false;

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
    const markDirty=()=>{
      if(dirty)return;dirty=true;saveStatus.textContent="Unsaved changes";saveButton.disabled=false;shell.classList.add('has-unsaved-changes');saveDot?.classList.add('unsaved');
    };
    const saveDocument=()=>{
      if(!dirty)return;doc.richHtml=sanitizeRichHtml(editor.innerHTML);doc.text=editor.innerText;doc.updatedAt=new Date().toISOString();saveState();dirty=false;saveStatus.textContent="Saved";saveButton.disabled=true;shell.classList.remove('has-unsaved-changes');saveDot?.classList.remove('unsaved');toast(`${doc.name} saved`);
    };
    saveButton.addEventListener('click',saveDocument);
    attachRichEditorMentions(editor,markDirty);

    const exec=(cmd,value=null)=>{
      restoreRange();
      try{document.execCommand(cmd,false,value);}catch(_){ }
      captureRange();markDirty();
    };
    const currentCell=()=>{
      const node=lastRange?.startContainer || window.getSelection()?.anchorNode;
      const el=node?.nodeType===1?node:node?.parentElement;
      return el?.closest?.("td,th") || null;
    };

    editor.addEventListener("input",markDirty);
    editor.addEventListener("mouseup",captureRange);
    editor.addEventListener("keyup",captureRange);
    editor.addEventListener("focus",captureRange);
    editor.addEventListener("paste",()=>setTimeout(()=>{editor.innerHTML=sanitizeRichHtml(editor.innerHTML);captureRange();markDirty();},0));
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
      linkPop.classList.add("hidden");captureRange();markDirty();
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
      tableMenu.classList.add("hidden");captureRange();markDirty();
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
        <span>${d.kind==="html"?"⌘":(d.kind==="pdf"||d.kind==="pdf-local")?"PDF":d.kind==="sharepoint"?"W":"＋"}</span>
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
        details:[doc.kind==="sharepoint"?"The SharePoint / Word source remains unchanged.":doc.storageKey?"The stored file will also be removed from TeamFlow file storage.":doc.kind==="pdf-local"?"The original PDF file on your device remains unchanged.":doc.kind==="html"?"The original HTML file on your device remains unchanged.":"Any notes stored only in this TeamFlow page will be removed."],
        warning:doc.kind==="blank"?"Blank-page notes cannot be restored unless they exist in a backup or export.":doc.storageKey?"This removes the shared file for all TeamFlow users.":"The source file itself is not deleted."
      });
      if(!ok) return;
      if(runtimeDocUrls.has(doc.id)){
        URL.revokeObjectURL(runtimeDocUrls.get(doc.id));
        runtimeDocUrls.delete(doc.id);
      }
      if(doc.storageKey){
        try{
          await window.teamFlowCloudFileRequest(`/documents/${encodeURIComponent(doc.id)}`,{method:"DELETE"});
          state.documents=state.documents.filter(d=>d.id!==doc.id);
          activeDocId=state.documents[0]?.id||null;
          await loadRemoteWorkspace({quiet:true});
          renderDocuments();toast(`${doc.name} removed`);
        }catch(err){tfLogError("Document delete failed",err,{documentId:doc.id});toast(err?.message||"Could not remove document");}
        return;
      }
      state.documents=state.documents.filter(d=>d.id!==doc.id);
      activeDocId=state.documents[0]?.id||null;
      saveState();renderDocuments();toast(`${doc.name} removed`);
    });

    const content=$("#docContent");
    if(doc.storageKey && (doc.kind==="html"||doc.kind==="pdf")){
      content.innerHTML=`<div class="doc-empty">Loading ${doc.kind.toUpperCase()}…</div>`;
      (async()=>{
        try{
          let objectUrl=runtimeDocUrls.get(doc.id);
          if(!objectUrl){
            const response=await window.teamFlowCloudFileRequest(`/documents/${encodeURIComponent(doc.id)}/content`);
            const blob=await response.blob();
            objectUrl=URL.createObjectURL(blob);
            runtimeDocUrls.set(doc.id,objectUrl);
          }
          if(activeDocId!==doc.id)return;
          const current=$("#docContent");if(!current)return;
          current.innerHTML=doc.kind==="html"
            ? `<iframe sandbox="allow-forms allow-scripts allow-modals" src="${esc(objectUrl)}" title="${esc(doc.name)}"></iframe>`
            : `<iframe src="${esc(objectUrl)}" title="${esc(doc.name)}"></iframe>`;
        }catch(err){
          tfLogError("Document preview failed",err,{documentId:doc.id});
          if(activeDocId===doc.id&&$("#docContent"))$("#docContent").innerHTML=`<div class="doc-empty">Could not load this document. ${esc(err?.message||"")}</div>`;
        }
      })();
    }else if(doc.kind==="html"){
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

