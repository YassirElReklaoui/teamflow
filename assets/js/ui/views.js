"use strict";

// TeamFlow modular build — generated from the verified granular API runtime.
  function renderWipEditor(){
    ensureAdvancedState();const el=$("#wipEditor");if(!el)return;el.innerHTML=state.statuses.map(status=>`<div class="wip-row"><label>${esc(status)}</label><input class="control" data-wip-status="${esc(status)}" type="number" min="1" placeholder="No limit" value="${wipLimitFor(status)||''}" /></div>`).join('');$$('[data-wip-status]').forEach(input=>input.addEventListener('change',()=>{const v=Number(input.value);state.wipLimits[input.dataset.wipStatus]=Number.isFinite(v)&&v>0?Math.floor(v):'';saveState();renderBoard();toast(`${input.dataset.wipStatus}: ${wipLimitFor(input.dataset.wipStatus)||'No limit'}`);}));
  }

  function renderOverview(){
    ensureAdvancedState();
    const normal=unarchivedTickets();
    const total=normal.length;
    const delivered=normal.filter(t=>['Done','Deployed on SIT'].includes(t.status)).length;
    const overdue=normal.filter(isOverdue).length;
    const blocked=normal.filter(isBlocked).length;
    const active=activeTickets(normal).length;
    const avg=total?Math.round(normal.reduce((sum,t)=>sum+normalizeProgress(t.progress),0)/total):0;
    const dueSoon=normal.filter(t=>{const d=dueInfo(t);return ['today','soon'].includes(d.cls)}).length;
    const fav=state.favorites.map(id=>normal.find(t=>t.id===id)).filter(Boolean).slice(0,5);
    const recent=state.recentTickets.map(id=>normal.find(t=>t.id===id)).filter(Boolean).slice(0,5);
    const upcoming=normal.filter(t=>t.end&&!['Done','Deployed on SIT','Deprecated'].includes(t.status)).sort((a,b)=>a.end.localeCompare(b.end)).slice(0,6);
    const notificationActivity=(typeof window.teamFlowGetNotifications==='function'?window.teamFlowGetNotifications():[]).map(n=>({id:`notification:${n.id||''}`,kind:n.kind||'update',ticketId:n.ticketId||n.target?.ticketId||'',title:n.ticketTitle||'',by:n.actorDisplayName||'Team member',message:n.message||n.title||'Ticket updated',ts:new Date(n.createdAt||n.updatedAt||0).getTime()||0}));
    const activity=[...(state.activity||[]),...notificationActivity].sort((a,b)=>(Number(b.ts)||0)-(Number(a.ts)||0)).filter((a,index,list)=>index===list.findIndex(x=>String(x.id||'')===String(a.id||''))).slice(0,8);
    const focus=normal.filter(t=>isBlocked(t)||isOverdue(t)||t.risk==='At Risk').sort((a,b)=>Number(isBlocked(b))-Number(isBlocked(a))).slice(0,4);
    const statusMax=Math.max(1,...state.statuses.map(status=>normal.filter(t=>t.status===status).length));
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
    const statusBars=state.statuses.map(status=>{const n=normal.filter(t=>t.status===status).length;return `<div class="overview-flow-row"><span class="overview-flow-icon">${workflowIconSvg(workflowIconKey(status))}</span><span class="overview-flow-name" title="${esc(status)}">${esc(status)}</span><div class="overview-flow-track"><div class="overview-flow-fill" style="width:${Math.round(n/statusMax*100)}%"></div></div><strong>${n}</strong></div>`}).join('');
    const ticketRows=list=>list.length?list.map(t=>`<button class="overview-ticket modern" data-overview-ticket="${esc(t.id)}" type="button"><b>${esc(t.id)}</b><strong>${esc(t.title)}</strong><span class="overview-status-pill status-${esc(String(t.status).toLowerCase().replace(/[^a-z0-9]+/g,'-'))}">${esc(t.status)}</span><i>${svg.chevron}</i></button>`).join(''):'<div class="overview-empty-state"><span>⌑</span><strong>Nothing here yet</strong></div>';
    const focusRows=focus.length?focus.map(t=>`<button class="overview-focus-row" data-overview-ticket="${esc(t.id)}" type="button"><span class="overview-attention-dot ${isBlocked(t)?'blocked':isOverdue(t)?'overdue':'risk'}"></span><strong>${esc(t.id)} · ${esc(t.title)}</strong><span class="overview-attention-pill">${isBlocked(t)?'Blocked':isOverdue(t)?dueInfo(t).text:'At risk'}</span><i>${svg.chevron}</i></button>`).join(''):'<div class="overview-empty-state compact"><span>✓</span><strong>No critical attention items</strong></div>';
    const activityRows=activity.length?activity.map((a,index)=>`<div class="overview-activity-row"><div class="overview-activity-line ${index===activity.length-1?'last':''}"><span class="overview-activity-dot"></span></div><div class="overview-activity-icon">${a.kind==='comment'?'💬':a.kind==='move'?'↔':a.kind==='create'?'＋':'✦'}</div><div class="overview-activity-copy"><strong>${esc(a.by)} · ${esc(a.ticketId||'Workspace')}</strong><p>${esc(a.message||a.title||a.kind)}</p><time>${Number(a.ts)?new Date(Number(a.ts)).toLocaleString('en-GB'):''}</time></div></div>`).join(''):'<div class="overview-empty-state"><span>✦</span><strong>Activity will appear here</strong></div>';
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
    return unarchivedTickets().filter(t=>{
      if(!timelineParseDate(t.start||t.end)||!timelineParseDate(t.end||t.start))return false;
      if(f.assignee&&t.assignee!==f.assignee)return false;
      if(f.status&&t.status!==f.status)return false;
      if(f.release&&(t.release||'')!==f.release)return false;
      if(f.type&&(t.type||'Task')!==f.type)return false;
      return true;
    });
  }
  function timelineProjectRange(tickets){
    const list=tickets.length?tickets:unarchivedTickets().filter(t=>timelineParseDate(t.start||t.end)&&timelineParseDate(t.end||t.start));
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
    const list=unarchivedTickets().filter(t=>t.release===release);const complete=t=>['Done','Deployed on SIT','Deprecated'].includes(t.status)||normalizeProgress(t.progress)>=100;const checks=[['Development',!list.some(t=>(t.type==='Development'||t.area==='BE'||t.area==='FE')&&!complete(t))],['Code review',!list.some(t=>t.status==='Code Review')],['Testing',!list.some(t=>t.type==='Testing'&&!complete(t))],['Documentation',!list.some(t=>t.type==='Documentation'&&!complete(t))],['No blockers',!list.some(isBlocked)]];return `<div class="release-readiness"><div class="overview-card-head"><h3>${esc(release||'Release')} readiness</h3><span>${list.length} ticket${list.length===1?'':'s'}</span></div><div class="readiness-grid">${checks.map(([label,ok])=>`<div class="readiness-item ${ok?'done':''}"><strong>${ok?'✓':'○'} ${label}</strong><span>${ok?'Ready':'Needs attention'}</span></div>`).join('')}</div></div>`;
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
      const boardReleases=activeReleaseNames();release.innerHTML='<option value="">Release: All</option>'+boardReleases.map(r=>`<option>${esc(r)}</option>`).join("");
      if(boardReleases.includes(prevRelease)) release.value=prevRelease;
    }
    if($("#bulkStatus")) $("#bulkStatus").innerHTML='<option value="">Keep current</option>'+state.statuses.map(x=>`<option>${esc(x)}</option>`).join("");
    if($("#bulkAssignee")) $("#bulkAssignee").innerHTML='<option value="">Keep current</option>'+state.members.map(x=>`<option>${esc(x.name)}</option>`).join("");
    if($("#bulkRelease")) $("#bulkRelease").innerHTML='<option value="">Keep current</option>'+activeReleaseNames().map(x=>`<option>${esc(x)}</option>`).join("");
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
    const visible=state.tickets.filter(t=>!t.archived&&releaseVisibleOnBoard(t.release));
    const total=visible.length;
    const done=visible.filter(t=>t.status==='Done').length;
    const inProgress=visible.filter(t=>['Ongoing','Code Review'].includes(t.status)).length;
    const onHold=visible.filter(t=>t.status==='On hold').length;
    const overdue=visible.filter(isOverdue).length;
    const progress=total?Math.round(visible.reduce((sum,t)=>sum+normalizeProgress(t.progress,0),0)/total):0;
    if($('#heroTotal'))$('#heroTotal').textContent=total;
    if($('#heroProgress'))$('#heroProgress').textContent=progress+'%';
    if($('#heroProgressRing'))$('#heroProgressRing').style.setProperty('--progress',progress);
    if($('#heroInProgress'))$('#heroInProgress').textContent=inProgress;
    if($('#heroDone'))$('#heroDone').textContent=done;
    if($('#heroOnHold'))$('#heroOnHold').textContent=onHold;
    if($('#heroOverdue'))$('#heroOverdue').textContent=overdue;
  }

  function ticketMatches(ticket){
    if(ticket?.archived) return false;
    if(ticket?.release && !releaseVisibleOnBoard(ticket.release)) return false;
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
        const tickets=list.filter(t=>t.status===statusName);const limit=wipLimitFor(statusName);const exceeded=limit&&tickets.length>limit;const col=document.createElement('section');col.className='column'+(exceeded?' wip-exceeded':'');col.dataset.status=statusName;col.innerHTML=`<div class="column-head">${workflowIcon(statusName)}<strong>${esc(statusName)}</strong><span class="count">${tickets.length}${limit?` / ${limit}`:''}</span>${exceeded?'<span class="wip-warning">WIP exceeded</span>':''}${bulkMode&&tickets.length?`<button class="bulk-column-select" type="button" title="Select all tickets in ${esc(statusName)}">Select all</button>`:''}<button class="add" type="button" aria-label="Add ticket">＋</button></div><div class="cards"></div>`;$('.add',col).onclick=()=>openTicketModal(null,statusName);const bulkCol=$('.bulk-column-select',col);if(bulkCol)bulkCol.onclick=(e)=>{e.stopPropagation();const all=tickets.every(t=>bulkSelected.has(t.id));tickets.forEach(t=>all?bulkSelected.delete(t.id):bulkSelected.add(t.id));renderBoard();toast(all?`${statusName} selection cleared`:`${tickets.length} ${statusName} ticket${tickets.length===1?'':'s'} selected`);};const cards=$('.cards',col);tickets.forEach(t=>cards.appendChild(makeTicket(t)));if(!tickets.length)cards.innerHTML='<div class="empty">No matching tickets</div>';
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


  function renderArchivedTickets(){
    const root=$("#archiveTickets");if(!root)return;
    const tickets=(state.tickets||[]).filter(t=>t.archived);
    if($("#archiveCount"))$("#archiveCount").textContent=tickets.length;
    const priorityTone=p=>String(p||'').toLowerCase()==='high'?'high':String(p||'').toLowerCase()==='low'?'low':'medium';
    root.innerHTML=tickets.length?tickets.map(t=>`<article class="archive-ticket-card" data-archive-ticket="${esc(t.id)}">
      <div class="archive-ticket-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 7h16v13H4zM3 4h18v3H3zM9 11h6"/></svg></div>
      <div class="archive-ticket-main">
        <div class="archive-ticket-top"><span class="archive-id">${esc(t.id)}</span><span class="archive-status">${workflowIcon(t.status||'To be started')} ${esc(t.status||'—')}</span></div>
        <strong class="archive-title">${esc(t.title||'Untitled ticket')}</strong>
        <div class="archive-ticket-meta"><span>${esc(t.assignee||'Unassigned')}</span><span>${esc(t.release||'No release')}</span><span class="archive-priority ${priorityTone(t.priority)}">${esc(t.priority||'Medium')}</span></div>
      </div>
      <div class="archive-ticket-actions"><button class="btn small" type="button" data-open-archived="${esc(t.id)}">Open</button><button class="btn small primary" type="button" data-restore-archived="${esc(t.id)}">Restore</button></div>
    </article>`).join(''):'<div class="archive-empty"><span class="archive-empty-icon">✓</span><strong>No archived tickets</strong><span>Archived tickets will appear here without changing their workflow or release.</span></div>';
    $$('[data-open-archived]').forEach(btn=>btn.addEventListener('click',()=>openTicketModal(btn.dataset.openArchived)));
    $$('[data-restore-archived]').forEach(btn=>btn.addEventListener('click',()=>{const t=state.tickets.find(x=>x.id===btn.dataset.restoreArchived);if(!t)return;t.archived=false;t.history=t.history||[];t.history.unshift('Ticket restored from archive');logActivity('update',t,'Restored ticket from archive');saveState();refreshDataViews();renderArchivedTickets();toast(`${t.id} restored`);}));
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

  function workflowSettingsVisual(statusName){
    const key=workflowIconKey(statusName);
    const palette={play:'blue',activity:'green',pulse:'green',pause:'amber',code:'indigo',check:'violet',deploy:'pink',rocket:'pink',archive:'slate',clock:'sky',review:'cyan',shield:'teal',flag:'orange',database:'purple',star:'yellow',circle:'violet'};
    return {key,tone:palette[key]||'violet',label:WORKFLOW_ICON_LIBRARY[key]?.label||'General'};
  }

  function renderStatusEditor(){
    const savedOrder=ensureSharedWorkflowOrder();
    const isAdmin=cloudUser?.role==="admin";
    const order=isAdmin?currentWorkflowOrderDraft():savedOrder;
    const dirty=isAdmin&&workflowOrderDraftChanged();
    $("#statusEditor").innerHTML = `<div class="workflow-card-strip">${order.map((statusName,i)=>{
      const count=state.tickets.filter(t=>t.status===statusName&&!t.archived).length;
      const sharedIndex=state.statuses.indexOf(statusName);
      const visual=workflowSettingsVisual(statusName);
      return `<article class="workflow-setting-card workflow-tone-${visual.tone}" draggable="${isAdmin?'true':'false'}" data-workflow-card="${esc(statusName)}">
        <div class="workflow-card-top"><span class="workflow-card-icon" title="${esc(visual.label)}" aria-label="${esc(visual.label)}">${workflowIconSvg(visual.key)}</span>${isAdmin?'<span class="workflow-drag-handle" title="Drag to reorder" aria-label="Drag to reorder">•••</span>':''}</div>
        <strong class="workflow-card-name">${esc(statusName)}</strong>
        <div class="workflow-card-count"><span class="workflow-ticket-mark">▮</span><span>${count} ticket${count===1?'':'s'}</span></div>
        <div class="workflow-card-position"><span class="workflow-position-dot"></span><span>${dirty?'Draft':'Saved'} position: ${i+1}</span></div>
        ${isAdmin?`<button class="workflow-remove-action" type="button" data-remove-status="${sharedIndex}" ${state.statuses.length<=1?'disabled':''}>Remove</button>`:''}
      </article>`;
    }).join('')}</div>${isAdmin?`<div class="workflow-order-savebar ${dirty?'dirty':''}"><div><strong>${dirty?'Workflow order changed':'Workflow order saved'}</strong><span>${dirty?'Drop cards into the preferred order, then save once to share it with everyone.':'Drag any workflow card to start a new order.'}</span></div><div>${dirty?'<button class="btn" id="discardWorkflowOrder" type="button">Discard</button><button class="btn primary" id="saveWorkflowOrder" type="button">✓ Save order</button>':''}</div></div>`:''}`;

    if(isAdmin){
      let dragged='';
      $$('[data-workflow-card]').forEach(card=>{
        card.addEventListener('dragstart',e=>{dragged=card.dataset.workflowCard||'';card.classList.add('dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',dragged);});
        card.addEventListener('dragend',()=>{card.classList.remove('dragging');$$('[data-workflow-card]').forEach(x=>x.classList.remove('drag-over'));dragged='';});
        card.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='move';if(card.dataset.workflowCard!==dragged)card.classList.add('drag-over');});
        card.addEventListener('dragleave',()=>card.classList.remove('drag-over'));
        card.addEventListener('drop',e=>{e.preventDefault();card.classList.remove('drag-over');const source=e.dataTransfer.getData('text/plain')||dragged,target=card.dataset.workflowCard;if(!source||!target||source===target)return;const next=currentWorkflowOrderDraft().slice();const from=next.indexOf(source),to=next.indexOf(target);if(from<0||to<0)return;next.splice(from,1);next.splice(to,0,source);workflowOrderDraft=next;tfLog('info','Workflow order draft changed by drag',{order:[...next]});renderStatusEditor();});
      });
    }
    $("#saveWorkflowOrder")?.addEventListener("click",saveWorkflowOrderDraft);
    $("#discardWorkflowOrder")?.addEventListener("click",discardWorkflowOrderDraft);
    $$('[data-remove-status]').forEach(btn=>btn.addEventListener("click",()=>openRemoveWorkflowModal(Number(btn.dataset.removeStatus))));
    renderSettingsSummary();
  }
