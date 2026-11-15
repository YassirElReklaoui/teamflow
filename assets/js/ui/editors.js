"use strict";

// TeamFlow modular build — generated from the verified granular API runtime.
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
    $("#closeModal").addEventListener("click",()=>close(false));
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
      // Do not update workflow order here. Only the explicit admin Save order action may do that.
      workflowOrderDraft=null;
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

  function collaboratorPickerHtml(selected){
    const set=new Set(selected||[]);
    const selectedMembers=state.members.filter(m=>set.has(m.name));
    return `<div class="editor-collab-picker" id="editorCollabPicker">
      <button class="editor-collab-trigger" id="editorCollabTrigger" type="button" aria-expanded="false">
        <span class="editor-collab-trigger-copy"><small>Team members</small><strong id="editorCollabSummary">${selectedMembers.length?`${selectedMembers.length} selected`:'Select collaborators…'}</strong></span><span class="editor-collab-chevron">⌄</span>
      </button>
      <div class="editor-collab-menu hidden" id="editorCollabMenu">
        <div class="editor-collab-options">${state.members.map(m=>`<label class="editor-collab-option" data-collab-search="${esc(String(m.name||'').toLowerCase())}"><input type="checkbox" name="collab" value="${esc(m.name)}" ${set.has(m.name)?'checked':''}/><span class="editor-collab-avatar" style="--member-color:${esc(m.color||memberColor(m.name))}">${esc(initials(m.name))}</span><span class="editor-collab-option-copy"><strong>${esc(m.name)}</strong><small>${esc(m.role||'Team member')}</small></span><span class="editor-collab-check">✓</span></label>`).join('')}</div>
        <div class="editor-collab-search-wrap"><input id="editorCollabSearch" type="search" placeholder="Search team members…" autocomplete="off" /></div>
      </div>
      <div class="editor-collab-selected" id="editorCollabSelected">${selectedMembers.length?selectedMembers.map(m=>`<span class="editor-selected-person" style="--member-color:${esc(m.color||memberColor(m.name))}"><span>${esc(initials(m.name))}</span><strong>${esc(m.name)}</strong></span>`).join(''):'<span class="note">No collaborators selected</span>'}</div>
    </div>`;
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
    const assigneeMember=state.members.find(m=>m.name===ticket.assignee);
    const selfMember=linkedMemberForCurrentUser();
    const assigneeInitials=initials(ticket.assignee||"Unassigned");
    const assigneeColor=assigneeMember?.color||memberColor(ticket.assignee||"Unassigned");
    const semanticClass=value=>String(value||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
    return `
      <div class="editor-detail-layout">
        <div class="editor-primary-column">
          <section class="editor-card editor-card-template editor-section-card">
            <div class="editor-section-heading">${editorIcon('layers')}<strong>Template / Issue type & Release</strong></div>
            <div class="editor-two editor-two-top">
              <div class="field editor-field">
                <label>${editorIcon('layers')}<span>Template / Issue type</span></label>
                <select id="ticketType">${Object.keys(TICKET_TEMPLATES).map(v=>`<option ${v===(ticket.type||"Task")?"selected":""}>${esc(v)}</option>`).join("")}</select>
              </div>
              <div class="field editor-field">
                <label>${editorIcon('flag')}<span>Release / Milestone</span></label>
                <select id="ticketRelease"><option value="">No release</option>${state.releases.map(v=>`<option ${v===(ticket.release||"")?"selected":""}>${esc(v)}</option>`).join("")}</select>
              </div>
            </div>
            <div class="editor-template-note"><span>i</span> Templates can prefill priority, area, labels and description for new tickets.</div>
          </section>

          <section class="editor-card editor-card-copy editor-section-card">
            <div class="field editor-field editor-title-field">
              <label>${editorIcon('title')}<span>Title *</span></label>
              <input id="ticketTitle" value="${esc(ticket.title||"")}" placeholder="Describe the task" />
            </div>
            <div class="field editor-field">
              <label>${editorIcon('file')}<span>Description</span></label>
              <textarea id="ticketDescription" placeholder="Add details, context, acceptance notes...">${esc(ticket.description||"")}</textarea>
            </div>
          </section>

          <section class="editor-card editor-list-card editor-section-card">
            <div class="editor-section-heading">${editorIcon('check')}<strong>Checklist / Subtasks</strong><span class="editor-section-meta">${(ticket.subtasks||[]).filter(x=>x.text&&x.done).length} / ${(ticket.subtasks||[]).filter(x=>x.text).length}</span></div>
            <div id="subtaskRows" class="subtask-list editor-subtask-list">${subtaskRowsHtml(ticket.subtasks||[])}</div>
            <div class="editor-card-footer">
              <button id="addSubtaskRow" class="editor-link-button" type="button">+ Add checklist item</button>
              <label class="editor-auto-progress"><input id="autoProgress" type="checkbox" ${ticket.autoProgress?'checked':''} /><span>Calculate progress from checklist</span></label>
            </div>
          </section>

          <section class="editor-card editor-dependency-card editor-section-card">
            <div class="field editor-field">
              <label>${editorIcon('link')}<span>Depends on / Blocked by</span></label>
              ${dependencyPickerHtml(ticket,otherTickets)}
              <div class="dependency-note">Search and check one or more tickets. Any unfinished dependency automatically marks this ticket as blocked.</div>
            </div>
          </section>

          <section class="editor-card editor-list-card editor-section-card">
            <div class="editor-section-heading">${editorIcon('link')}<strong>Documentation Links</strong></div>
            <div id="linkRows" class="link-rows editor-link-rows">${linkRowsHtml(ticket.links||[])}</div>
            <div class="editor-card-footer editor-doc-footer"><button id="addDocLinkRow" class="editor-link-button" type="button">+ Add documentation link</button><span class="note">Add the URL plus a chapter, section, page, or reference.</span></div>
          </section>
        </div>

        <aside class="editor-properties-column">
          <section class="editor-side-card editor-assignee-card">
            <div class="editor-side-heading">${editorIcon('user')}<strong>Assigned to</strong></div>
            <div class="editor-assignee-control" style="--editor-member-color:${esc(assigneeColor)}">
              <span class="editor-assignee-avatar" id="ticketAssigneeAvatar">${esc(assigneeInitials)}</span>
              <div class="editor-assignee-copy"><div class="editor-assignee-label-row"><small>Owner</small>${selfMember?`<button id="assignTicketToMe" class="editor-assign-me" type="button">Assign to me</button>`:''}</div><select id="ticketAssignee">${state.members.length?state.members.map(m=>`<option ${m.name===ticket.assignee?"selected":""}>${esc(m.name)}</option>`).join(""):`<option value="">Unassigned</option>`}</select></div>
            </div>
          </section>

          <section class="editor-side-card editor-key-details-card">
            <div class="editor-side-heading">${editorIcon('details')}<strong>Key details</strong></div>
            <div class="editor-key-details">
              <div class="editor-key-row"><label>${editorIcon('status')}<span>Status</span></label><select id="ticketStatus" class="editor-semantic-select semantic-status-${semanticClass(ticket.status)}">${state.statuses.map(s=>`<option ${s===ticket.status?"selected":""}>${esc(s)}</option>`).join("")}</select></div>
              <div class="editor-key-row"><label>${editorIcon('flag')}<span>Priority</span></label><select id="ticketPriority" class="editor-semantic-select semantic-priority-${semanticClass(ticket.priority)}">${["High","Medium","Low"].map(v=>`<option ${v===ticket.priority?"selected":""}>${v}</option>`).join("")}</select></div>
              <div class="editor-key-row"><label>${editorIcon('area')}<span>Area / ARCH / BE / FE</span></label><select id="ticketArea">${["ARCH","BE","FE","QA"].map(v=>`<option ${v===ticket.area?"selected":""}>${v}</option>`).join("")}</select></div>
              <div class="editor-key-row"><label>${editorIcon('alert')}<span>Risk / Delivery flag</span></label><select id="ticketRisk" class="editor-semantic-select semantic-risk-${semanticClass(ticket.risk||"None")}">${["None","At Risk","Blocked"].map(v=>`<option ${v===(ticket.risk||"None")?"selected":""}>${v}</option>`).join("")}</select></div>
              <div class="editor-key-row editor-key-row-progress"><label>${editorIcon('chart')}<span>Progress</span></label><div class="progress-editor editor-side-progress"><input id="ticketProgressRange" type="range" min="0" max="100" step="1" value="${normalizeProgress(ticket.progress)}" /><div class="progress-number"><input id="ticketProgress" type="number" min="0" max="100" step="1" value="${normalizeProgress(ticket.progress)}" /><span>%</span></div></div></div>
              <div class="editor-key-row"><label>${editorIcon('calendar')}<span>Start date</span></label><input id="ticketStart" type="date" value="${esc(ticket.start||"")}" /></div>
              <div class="editor-key-row"><label>${editorIcon('calendar')}<span>Expected end date</span></label><input id="ticketEnd" type="date" value="${esc(ticket.end||"")}" /></div>
            </div>
            <div class="field editor-field editor-blocker-field">
              <label>${editorIcon('tag')}<span>Blocker / Risk Note</span></label>
              <textarea id="ticketBlockerNote" placeholder="What is blocking or putting delivery at risk?">${esc(ticket.blockerNote||"")}</textarea>
            </div>
          </section>

          <section class="editor-side-card editor-labels-card">
            <div class="editor-side-heading">${editorIcon('tag')}<strong>Labels</strong></div>
            <div class="field editor-field"><input id="ticketLabels" value="${esc((ticket.labels||[]).join(", "))}" placeholder="e.g. API, backend, performance" /></div>
            <div class="editor-label-preview">${(ticket.labels||[]).length?(ticket.labels||[]).map((label,i)=>`<span class="editor-label-chip label-tone-${i%4}">${esc(label)}</span>`).join(""):'<span class="note">No labels yet</span>'}</div>
          </section>

          <section class="editor-side-card editor-collaborator-card">
            <div class="editor-side-heading">${editorIcon('users')}<strong>Collaborators</strong><span class="editor-side-count" id="editorCollabCount">${(ticket.collaborators||[]).length}</span></div>
            ${collaboratorPickerHtml(ticket.collaborators)}
          </section>
        </aside>
      </div>
    `;
  }


  function editorDraftCommentHtml(c){
    return `<div class="editor-comment-card" data-comment-id="${esc(c.id||'')}"><span class="comment-avatar" style="--comment-color:${memberColor(c.by)}">${esc(initials(c.by))}</span><div class="editor-comment-content"><div class="comment-head"><strong>${esc(c.by)}</strong><small>${esc(c.at)}</small></div><p class="comment-body">${formatCommentText(c.text)}</p></div></div>`;
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
    const initialDetailTab=options.activeTab||"details";
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
                <span class="detail-status-control semantic-status-${semanticClass(t.status)}">${esc(t.status)}</span>
                <span class="detail-status-sep"></span>
                <span class="detail-status-meta">◆ ${esc(t.release||"No release")}</span>
                <span class="detail-status-meta">${esc(t.area||"—")}</span>
              </div>
            </div>
            <div class="detail-hero-right">
              <span class="detail-priority-large semantic-priority-${semanticClass(t.priority)}">${dIcons.flag}${esc(t.priority)}</span>
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

              <section class="detail-section detail-flat-tab-section detail-attachments-view" id="detailDocsSection">
                <div class="detail-tab-toolbar"><span class="detail-tab-count">${docs.length} ${docs.length===1?"reference":"references"}</span><span class="detail-tab-hint">Links, files and documentation related to this ticket</span></div>
                <div class="detail-section-content detail-flat-content">
                  <div class="detail-attachment-grid">${docs.length?docs.map((d,i)=>`<article class="detail-attachment-card"><div class="detail-attachment-card-icon">↗</div><div class="detail-attachment-card-copy"><strong title="${esc(d.title||"Documentation")}">${esc(d.title||"Documentation")}</strong><span>${esc(d.chapter||"Reference")}</span><small title="${esc(d.url||"")}">${esc(d.url||"No URL")}</small></div><div class="detail-attachment-card-actions"><button class="detail-attachment-open" data-doc-index="${i}" type="button">Open ↗</button><button class="detail-attachment-remove" data-remove-doc-index="${i}" type="button" aria-label="Remove attachment">×</button></div></article>`).join(""):'<div class="detail-empty-state-wide"><div class="detail-empty-state-icon">↗</div><strong>No references yet</strong><span>Add a useful document, URL or chapter reference below.</span></div>'}</div>
                  <div class="detail-attachment-composer"><div class="detail-attachment-composer-head"><span>＋ Add reference</span><small>Keep useful context close to the ticket</small></div><div class="detail-attachment-add"><input id="detailAttachmentTitle" placeholder="Document title"/><input id="detailAttachmentUrl" placeholder="Paste URL"/><input id="detailAttachmentChapter" placeholder="Chapter / section"/><button id="detailAddAttachment" class="btn primary small" type="button">Add</button></div></div>
                </div>
              </section>

              <section class="detail-section detail-comments-section detail-flat-tab-section detail-conversation-view" id="detailCommentsSection">
                <div class="detail-tab-toolbar"><span class="detail-tab-count">${(t.comments||[]).length} ${(t.comments||[]).length===1?"comment":"comments"}</span><span class="detail-tab-hint">Oldest at the top · newest at the bottom</span></div>
                <div class="detail-section-content detail-flat-content detail-comments-content"><div class="comments detail-comments-list">${(t.comments||[]).length?(t.comments||[]).map(c=>commentHtml(c,t)).join(""):'<div class="detail-empty-state-wide"><div class="detail-empty-state-icon">💬</div><strong>No comments yet</strong><span>Start the conversation below.</span></div>'}</div><div class="detail-comment-compose" style="--member-color:${memberColor(state.currentMember)}"><span class="compose-avatar">${initials(state.currentMember)}</span><textarea id="detailCommentText" rows="1" placeholder="Write a comment… Use @ to mention someone"></textarea><button id="detailSendComment" class="detail-send" type="button" aria-label="Send comment">${dIcons.send}</button></div></div>
              </section>

              <section class="detail-section detail-flat-tab-section detail-history-view" id="detailHistorySection">
                <div class="detail-tab-toolbar"><span class="detail-tab-count">${history.length} ${history.length===1?"event":"events"}</span><span class="detail-tab-hint">Latest activity for this ticket</span></div>
                <div class="detail-section-content detail-flat-content"><div class="detail-history-list">${history.length?history.slice(0,40).map(h=>`<div class="detail-history-item"><span class="detail-history-dot"></span><div class="detail-history-copy"><span>${esc(h)}</span></div></div>`).join(''):'<div class="detail-empty-state-wide"><div class="detail-empty-state-icon">↺</div><strong>No history yet</strong><span>Ticket activity will appear here.</span></div>'}</div></div>
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
                  <div><small>Status</small><strong><span class="detail-fact-pill semantic-status-${semanticClass(t.status)}">${esc(t.status)}</span></strong></div>
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
    $("#closeModal").addEventListener("click",()=>close(false));
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
        if(key==='comments'){const list=$('.detail-comments-list');if(list)list.scrollTop=list.scrollHeight;$('#detailCommentText')?.focus();}
      });
    };
    $$('[data-detail-nav]').forEach(btn=>btn.addEventListener('click',()=>setDetailTab(btn.dataset.detailNav)));
    setDetailTab(initialDetailTab);
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
      saveState();openTicketDetails(t.id,{preserveStack:true,activeTab:'comments'});
    }));
    $$('[data-comment-edit]').forEach(btn=>btn.addEventListener('click',()=>openCommentEditModal(t.id,btn.dataset.commentEdit)));
    $$('[data-comment-delete]').forEach(btn=>btn.addEventListener('click',async()=>{
      const c=(t.comments||[]).find(x=>x.id===btn.dataset.commentDelete);if(!c)return;
      const ok=await confirmAction({title:'Delete this comment?',message:'The comment will be removed from this ticket.',subject:c.text.slice(0,100),confirmLabel:'Delete comment',icon:'×'});if(!ok)return;
      t.comments=t.comments.filter(x=>x.id!==c.id);logActivity('comment',t,'Deleted a comment');saveState();openTicketDetails(t.id,{preserveStack:true,activeTab:'comments'});
    }));
    $$('[data-comment-ticket]').forEach(ref=>ref.addEventListener('click',()=>{
      const match=state.tickets.find(x=>x.id.toLowerCase()===ref.dataset.commentTicket.toLowerCase());if(match){ticketDetailStack.push(t.id);openTicketDetails(match.id,{preserveStack:true});}
    }));
    $$('[data-detail-ticket]').forEach(btn=>btn.addEventListener('click',()=>{ticketDetailStack.push(ticketId);openTicketDetails(btn.dataset.detailTicket,{preserveStack:true});}));
    $$('[data-doc-index]').forEach(btn=>btn.addEventListener('click',()=>{const link=docs[Number(btn.dataset.docIndex)];const url=safeHttpUrl(link?.url);if(url)window.open(url,'_blank','noopener');else toast('This documentation URL is not valid.');}));
    $$('[data-remove-doc-index]').forEach(btn=>btn.addEventListener('click',async()=>{const idx=Number(btn.dataset.removeDocIndex);const link=(t.links||[])[idx];if(!link)return;const ok=await confirmAction({title:'Remove this attachment?',message:'The ticket reference will be removed.',subject:link.title||link.url,confirmLabel:'Remove',icon:'×'});if(!ok)return;t.links.splice(idx,1);t.history=t.history||[];t.history.unshift(`Attachment removed: ${link.title||link.url}`);saveState();refreshDataViews();openTicketDetails(ticketId,{preserveStack:true,activeTab:'attachments'});}));
    $('#detailAddAttachment')?.addEventListener('click',()=>{const title=$('#detailAttachmentTitle').value.trim();const raw=$('#detailAttachmentUrl').value.trim();const chapter=$('#detailAttachmentChapter').value.trim();if(!raw){$('#detailAttachmentUrl').focus();return;}const url=safeHttpUrl(raw);if(!url){toast('Please enter a valid attachment URL');$('#detailAttachmentUrl').focus();return;}t.links=t.links||[];t.links.push({title:title||'Documentation',url,chapter});t.history=t.history||[];t.history.unshift(`Attachment added: ${title||url}`);saveState();refreshDataViews();openTicketDetails(ticketId,{preserveStack:true,activeTab:'attachments'});});
    attachMentionAutocomplete($("#detailCommentText"));
    $("#detailSendComment").addEventListener("click",()=>{const text=$("#detailCommentText").value.trim();if(!text)return;t.comments=t.comments||[];t.comments.push({id:"c"+Date.now()+Math.random().toString(36).slice(2,5),by:state.currentMember||"Team member",at:nowLabel(),text,reactions:{}});t.history=t.history||[];t.history.unshift("Comment added");logActivity('comment',t,`Commented: ${text.slice(0,80)}`);saveState();refreshDataViews();openTicketDetails(ticketId,{preserveStack:true,activeTab:'comments'});});
    $("#detailCommentText")?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$("#detailSendComment")?.click();}});
  }

  function openTicketEditor(ticketId=null,presetStatus="To be started"){
    const existing = ticketId ? state.tickets.find(t=>t.id===ticketId) : null;
    const draft = existing ? clone(existing) : {
      id:nextTicketId(),title:"",description:"",assignee:state.currentMember || state.members[0]?.name || "",
      collaborators:[],area:"BE",priority:"Medium",status:presetStatus,sprint:"",start:localTodayISO(),end:"",progress:0,
      type:"Task",release:state.releases[0]||"",risk:"None",blockerNote:"",dependencies:[],
      labels:[],links:[],comments:[],history:["Ticket created"]
    };

    beginSharedDraft();

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
            <div id="pane-comments" class="tab-pane editor-comments-pane">
              <div class="editor-comments-flat">
                <div class="editor-comments-meta"><strong>${(draft.comments||[]).length} comment${(draft.comments||[]).length===1?'':'s'}</strong><span>Oldest first</span></div>
                <div class="comments editor-comments-list">
                  ${(draft.comments||[]).length ? draft.comments.map(editorDraftCommentHtml).join("") : '<div class="detail-empty editor-comments-empty">No comments yet</div>'}
                </div>
                <div class="editor-comment-compose" style="--member-color:${memberColor(state.currentMember)}">
                  <span class="compose-avatar">${initials(state.currentMember)}</span>
                  <textarea id="commentText" rows="1" placeholder="Write a comment… Use @ to mention someone"></textarea>
                  <button id="sendComment" class="editor-comment-send" type="button" aria-label="Add comment to draft"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 4 16 8-16 8 3-8-3-8Z"/><path d="M7 12h13"/></svg></button>
                </div>
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
    let collaboratorOutsideHandler=null;
    let draftSessionClosed=false;
    const close = (commit=false)=>{
      if(draftSessionClosed)return;
      draftSessionClosed=true;
      if(dependencyOutsideHandler) document.removeEventListener("pointerdown",dependencyOutsideHandler,true);
      if(collaboratorOutsideHandler) document.removeEventListener("pointerdown",collaboratorOutsideHandler,true);
      const floatingMenu=$("#editorCollabMenu");if(floatingMenu&&floatingMenu.parentElement===document.body)floatingMenu.remove();
      endSharedDraft({commit});
      $("#modalRoot").innerHTML="";
    };
    $("#closeModal").addEventListener("click",()=>close(false));
    $("#cancelTicket").addEventListener("click",()=>close(false));
    $(".modal-backdrop").addEventListener("click",e=>{if(e.target===e.currentTarget) close(false);});

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

    const semanticSlug=value=>String(value||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
    const refreshSemanticSelect=(select,prefix)=>{if(!select)return;[...select.classList].filter(c=>c.startsWith(prefix)).forEach(c=>select.classList.remove(c));select.classList.add(prefix+semanticSlug(select.value));};
    const statusSelect=$("#ticketStatus"),prioritySelect=$("#ticketPriority"),riskSelect=$("#ticketRisk");
    statusSelect?.addEventListener("change",()=>refreshSemanticSelect(statusSelect,"semantic-status-"));
    prioritySelect?.addEventListener("change",()=>refreshSemanticSelect(prioritySelect,"semantic-priority-"));
    riskSelect?.addEventListener("change",()=>refreshSemanticSelect(riskSelect,"semantic-risk-"));
    const assigneeSelect=$("#ticketAssignee"),assigneeAvatar=$("#ticketAssigneeAvatar");
    assigneeSelect?.addEventListener("change",()=>{const member=state.members.find(m=>m.name===assigneeSelect.value);const wrap=assigneeSelect.closest(".editor-assignee-control");if(assigneeAvatar)assigneeAvatar.textContent=initials(assigneeSelect.value||"Unassigned");if(wrap)wrap.style.setProperty("--editor-member-color",member?.color||memberColor(assigneeSelect.value||"Unassigned"));});
    $("#assignTicketToMe")?.addEventListener("click",()=>{const self=linkedMemberForCurrentUser();if(!self||!assigneeSelect)return;assigneeSelect.value=self.name;assigneeSelect.dispatchEvent(new Event("change",{bubbles:true}));toast(`Assigned to ${self.name}`);});

    const collabPicker=$("#editorCollabPicker"),collabTrigger=$("#editorCollabTrigger"),collabMenu=$("#editorCollabMenu"),collabSearch=$("#editorCollabSearch");
    const collabSelectedBox=$("#editorCollabSelected");
    const selectedCollaboratorInputs=()=>collabMenu?$$('input[name="collab"]:checked',collabMenu):[];
    const refreshCollaboratorSummary=()=>{
      if(!collabPicker)return;const selected=selectedCollaboratorInputs();
      const count=$("#editorCollabCount");if(count)count.textContent=String(selected.length);
      const summary=$("#editorCollabSummary");if(summary)summary.textContent=selected.length?`${selected.length} selected`:'Select collaborators…';
      const box=$("#editorCollabSelected");if(box)box.innerHTML=selected.length?selected.map(input=>{const m=state.members.find(x=>x.name===input.value);return `<span class="editor-selected-person" style="--member-color:${esc(m?.color||memberColor(input.value))}"><span>${esc(initials(input.value))}</span><strong>${esc(input.value)}</strong></span>`;}).join(''):'<span class="note">No collaborators selected</span>';
    };
    const positionCollaboratorMenu=()=>{
      if(!collabMenu||!collabTrigger||collabMenu.classList.contains('hidden'))return;
      const r=collabTrigger.getBoundingClientRect();
      collabMenu.style.width=`${Math.max(280,r.width)}px`;
      collabMenu.style.left=`${Math.min(Math.max(10,r.left),window.innerWidth-Math.max(280,r.width)-10)}px`;
      collabMenu.style.visibility='hidden';
      collabMenu.style.top='10px';
      requestAnimationFrame(()=>{const h=Math.min(collabMenu.scrollHeight,360);const above=r.top-10;const top=above>=h?r.top-h-8:Math.min(window.innerHeight-h-10,r.bottom+8);collabMenu.style.top=`${Math.max(10,top)}px`;collabMenu.style.visibility='visible';});
    };
    const closeCollaboratorMenu=()=>{
      if(!collabMenu)return;collabMenu.classList.add("hidden");collabMenu.classList.remove('editor-collab-floating');collabMenu.removeAttribute('style');
      if(collabPicker&&collabSelectedBox)collabPicker.insertBefore(collabMenu,collabSelectedBox);
      collabTrigger?.setAttribute("aria-expanded","false");
    };
    if(collabPicker&&collabTrigger&&collabMenu){
      collabTrigger.addEventListener("click",()=>{const opening=collabMenu.classList.contains("hidden");if(opening){document.body.appendChild(collabMenu);collabMenu.classList.add('editor-collab-floating');collabMenu.classList.remove("hidden");collabTrigger.setAttribute("aria-expanded","true");positionCollaboratorMenu();setTimeout(()=>collabSearch?.focus(),0);}else closeCollaboratorMenu();});
      collabSearch?.addEventListener("input",()=>{const q=collabSearch.value.trim().toLowerCase();$$('.editor-collab-option',collabMenu).forEach(row=>row.classList.toggle('hidden',q&&!row.dataset.collabSearch.includes(q)));});
      $$('input[name="collab"]',collabMenu).forEach(input=>input.addEventListener('change',refreshCollaboratorSummary));
      collaboratorOutsideHandler=e=>{if(!collabMenu.classList.contains("hidden")&&!collabPicker.contains(e.target)&&!collabMenu.contains(e.target))closeCollaboratorMenu();};
      document.addEventListener("pointerdown",collaboratorOutsideHandler,true);
      window.addEventListener('resize',positionCollaboratorMenu,{passive:true});
      refreshCollaboratorSummary();
    }

    const typeSelect=$("#ticketType");
    if(typeSelect && !existing){
      typeSelect.addEventListener("change",()=>{
        const template=TICKET_TEMPLATES[typeSelect.value]||TICKET_TEMPLATES.Task;
        $("#ticketPriority").value=template.priority||"Medium";
        refreshSemanticSelect($("#ticketPriority"),"semantic-priority-");
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
      draft.comments = draft.comments || [];
      draft.comments.push({id:"c"+Date.now()+Math.random().toString(36).slice(2,5),by:state.currentMember || "Team member",at:nowLabel(),text,reactions:{}});
      draft.history = draft.history || [];
      draft.history.unshift("Comment added");
      $("#commentText").value="";
      const commentsBox=$("#pane-comments .comments");
      if(commentsBox){commentsBox.innerHTML=draft.comments.map(editorDraftCommentHtml).join("");commentsBox.scrollTop=commentsBox.scrollHeight;}
      const commentsMeta=$(".editor-comments-head small",$("#pane-comments"));if(commentsMeta)commentsMeta.textContent=`${draft.comments.length} comment${draft.comments.length===1?'':'s'}`;
      const commentTab=$('.tab[data-tab="comments"] span');if(commentTab)commentTab.textContent=`Comments (${draft.comments.length})`;
      toast("Comment added to draft — save the ticket to publish it");
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
        close(true);
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
      const selectedCollabs = selectedCollaboratorInputs().map(x=>x.value);
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
      close(true);
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
    $("#closeModal").addEventListener("click",()=>close(false));
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

