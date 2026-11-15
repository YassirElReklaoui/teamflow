  let notificationItems=[];
  let notificationFilter="all";
  let notificationDropdownOpen=false;

  function notificationSvg(kind){
    const paths={
      bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
      assigned:'<circle cx="9" cy="8" r="3"/><path d="M3.5 20c.6-3.8 2.5-5.7 5.5-5.7s4.9 1.9 5.5 5.7M17 7v6M14 10h6"/>',
      status:'<path d="M4 12h5l2-5 3 10 2-5h4"/><path d="M18 4v4h-4"/>',
      checklist:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8 12 2.5 2.5L16 9"/>',
      created:'<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>',
      dependency:'<path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/>',
      comment:'<path d="M4 5h16v11H9l-5 4V5Z"/>',
      mention:'<path d="M12 4a8 8 0 1 0 5.7 13.6"/><path d="M16 8v5a3 3 0 0 1-6 0v-2a3 3 0 0 1 6 0v2"/>',
      documentation:'<path d="M6 3h8l4 4v14H6zM14 3v5h5M9 13h6M9 17h5"/>',
      updated:'<path d="M12 3a9 9 0 1 0 8.5 6M20 3v6h-6"/>'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[kind]||paths.updated}</svg>`;
  }

  function notificationTime(value){
    const d=new Date(value||0);if(Number.isNaN(d.getTime()))return "";
    const seconds=Math.max(0,Math.floor((Date.now()-d.getTime())/1000));
    if(seconds<60)return "now";if(seconds<3600)return `${Math.floor(seconds/60)} min ago`;
    if(seconds<86400)return `${Math.floor(seconds/3600)} h ago`;
    if(seconds<604800)return `${Math.floor(seconds/86400)} d ago`;
    return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'});
  }

  function ensureNotificationUi(){
    if(!document.getElementById('notificationBell')){
      const sync=document.getElementById('cloudSyncStatus');
      const button=document.createElement('button');
      button.id='notificationBell';button.type='button';button.className='notification-bell';button.setAttribute('aria-label','Notifications');button.setAttribute('aria-expanded','false');
      button.innerHTML=`<span class="notification-bell-icon">${notificationSvg('bell')}</span><span id="notificationBadge" class="notification-badge hidden">0</span>`;
      sync?.parentNode?.insertBefore(button,sync);
      const dropdown=document.createElement('div');dropdown.id='notificationDropdown';dropdown.className='notification-dropdown hidden';dropdown.innerHTML=notificationDropdownShell();document.body.appendChild(dropdown);
      button.addEventListener('click',e=>{e.stopPropagation();toggleNotificationDropdown();});
      document.addEventListener('pointerdown',e=>{if(notificationDropdownOpen&&!dropdown.contains(e.target)&&!button.contains(e.target))closeNotificationDropdown();},true);
      document.addEventListener('keydown',e=>{if(e.key==='Escape')closeNotificationDropdown();});
    }
    if(!document.getElementById('notificationsView')){
      const section=document.createElement('section');section.id='notificationsView';section.className='view';section.innerHTML=`
        <div class="panel notifications-page-shell">
          <div class="notifications-page-hero">
            <div class="notifications-page-icon">${notificationSvg('updated')}</div>
            <div><h2>Notifications</h2><p>Updates that need your attention across tickets assigned or linked to you.</p></div>
            <button class="btn" id="notificationPageMarkAll" type="button">✓ Mark all as read</button>
          </div>
          <div class="notification-page-tabs" id="notificationPageTabs">${notificationFilterButtons()}</div>
          <div id="notificationPageList" class="notification-page-list"></div>
        </div>`;
      document.querySelector('.content')?.appendChild(section);
    }
    bindNotificationControls();
  }

  function notificationFilterButtons(){
    return [
      ['all','All'],['unread','Unread'],['assigned','Assigned to me'],['updates','Updates']
    ].map(([key,label])=>`<button class="notification-filter ${notificationFilter===key?'active':''}" type="button" data-notification-filter="${key}">${label}</button>`).join('');
  }

  function notificationDropdownShell(){
    return `<div class="notification-drop-head"><div><strong>Notifications</strong><span id="notificationUnreadText">No unread notifications</span></div><button id="notificationMarkAll" type="button">✓ Mark all as read</button></div>
      <div class="notification-drop-tabs" id="notificationDropTabs">${notificationFilterButtons()}</div>
      <div id="notificationDropList" class="notification-drop-list"></div>
      <button id="notificationViewAll" class="notification-view-all" type="button">View all notifications <span>→</span></button>`;
  }

  function bindNotificationControls(){
    document.querySelectorAll('[data-notification-filter]').forEach(btn=>{if(btn.dataset.notificationBound)return;btn.dataset.notificationBound='1';btn.addEventListener('click',()=>{notificationFilter=btn.dataset.notificationFilter||'all';renderNotifications();});});
    const mark=document.getElementById('notificationMarkAll');if(mark&&!mark.dataset.bound){mark.dataset.bound='1';mark.addEventListener('click',()=>markAllNotificationsRead());}
    const pageMark=document.getElementById('notificationPageMarkAll');if(pageMark&&!pageMark.dataset.bound){pageMark.dataset.bound='1';pageMark.addEventListener('click',()=>markAllNotificationsRead());}
    const all=document.getElementById('notificationViewAll');if(all&&!all.dataset.bound){all.dataset.bound='1';all.addEventListener('click',()=>{closeNotificationDropdown();openNotificationsPage();});}
  }

  function filteredNotifications(){
    return notificationItems.filter(n=>notificationFilter==='all'?true:notificationFilter==='unread'?!n.readAt:notificationFilter==='assigned'?n.category==='assigned':n.category==='updates');
  }

  function notificationRowHtml(n,compact=false){
    const unread=!n.readAt;
    return `<button class="notification-row ${unread?'unread':''}" type="button" data-notification-id="${esc(n.id||'')}">
      <span class="notification-kind kind-${esc(n.kind||'updated')}">${notificationSvg(n.kind)}</span>
      <span class="notification-copy"><strong>${esc(n.title||'Ticket updated')}</strong><small>${esc(n.message||[n.ticketId,n.ticketTitle].filter(Boolean).join(' — '))}</small>${compact?'':`<em>${esc(n.actorDisplayName||'Team member')}</em>`}</span>
      <span class="notification-meta"><time>${notificationTime(n.createdAt||n.updatedAt)}</time>${unread?'<i></i>':''}</span>
    </button>`;
  }

  function renderNotifications(){
    ensureNotificationUi();
    const unread=notificationItems.filter(n=>!n.readAt).length;
    const badge=document.getElementById('notificationBadge');if(badge){badge.textContent=unread>99?'99+':String(unread);badge.classList.toggle('hidden',unread===0);}
    const unreadText=document.getElementById('notificationUnreadText');if(unreadText)unreadText.textContent=unread?`${unread} unread notification${unread===1?'':'s'}`:'You’re all caught up';
    const tabs=notificationFilterButtons();const dt=document.getElementById('notificationDropTabs');if(dt)dt.innerHTML=tabs;const pt=document.getElementById('notificationPageTabs');if(pt)pt.innerHTML=tabs;
    bindNotificationControls();
    const list=filteredNotifications();
    const drop=document.getElementById('notificationDropList');if(drop)drop.innerHTML=list.slice(0,7).map(n=>notificationRowHtml(n,true)).join('')||'<div class="notification-empty"><span>✓</span><strong>No notifications here</strong><small>New ticket activity will appear automatically.</small></div>';
    const page=document.getElementById('notificationPageList');if(page)page.innerHTML=list.map(n=>notificationRowHtml(n,false)).join('')||'<div class="notification-page-empty">No notifications match this filter.</div>';
    document.querySelectorAll('[data-notification-id]').forEach(btn=>btn.addEventListener('click',()=>openNotification(btn.dataset.notificationId)));
  }

  async function fetchNotifications({quiet=true}={}){
    if(!cloudReady||!getCloudToken())return [];
    try{
      const data=await cloudRequest('/notifications?limit=120');
      notificationItems=Array.isArray(data.notifications)?data.notifications:[];
      renderNotifications();return notificationItems;
    }catch(err){if(!quiet)tfLogError('Loading notifications failed',err);return notificationItems;}
  }

  async function markNotificationsRead(ids){
    if(!ids?.length)return;
    try{await cloudRequest('/notifications/read',{method:'POST',body:{ids}});const now=new Date().toISOString();notificationItems.forEach(n=>{if(ids.includes(n.id))n.readAt=n.readAt||now;});renderNotifications();}
    catch(err){tfLogError('Mark notification read failed',err,{ids});toast('Could not update notification');}
  }

  async function markAllNotificationsRead(){
    const unread=notificationItems.filter(n=>!n.readAt);if(!unread.length)return;
    try{await cloudRequest('/notifications/read',{method:'POST',body:{all:true}});const now=new Date().toISOString();notificationItems.forEach(n=>n.readAt=n.readAt||now);renderNotifications();toast('Notifications marked as read');}
    catch(err){tfLogError('Mark all notifications read failed',err);toast('Could not update notifications');}
  }

  function toggleNotificationDropdown(){notificationDropdownOpen?closeNotificationDropdown():openNotificationDropdown();}
  function openNotificationDropdown(){ensureNotificationUi();notificationDropdownOpen=true;const bell=document.getElementById('notificationBell'),drop=document.getElementById('notificationDropdown');bell?.setAttribute('aria-expanded','true');drop?.classList.remove('hidden');positionNotificationDropdown();fetchNotifications();}
  function closeNotificationDropdown(){notificationDropdownOpen=false;document.getElementById('notificationBell')?.setAttribute('aria-expanded','false');document.getElementById('notificationDropdown')?.classList.add('hidden');}
  function positionNotificationDropdown(){const bell=document.getElementById('notificationBell'),drop=document.getElementById('notificationDropdown');if(!bell||!drop)return;const r=bell.getBoundingClientRect();drop.style.top=`${Math.min(window.innerHeight-20,r.bottom+9)}px`;drop.style.right=`${Math.max(12,window.innerWidth-r.right)}px`;}

  function openNotificationsPage(){ensureNotificationUi();switchView('notifications');renderNotifications();}

  async function openNotification(id){
    const n=notificationItems.find(x=>String(x.id)===String(id));if(!n)return;
    if(!n.readAt)markNotificationsRead([n.id]);
    if(!n.target?.view){toast(n.title||'Notification');return;}
    closeNotificationDropdown();
    if(n.target.view==='ticket'&&n.target.ticketId){
      switchView('board');
      if(typeof clearAllBoardFilters==='function')clearAllBoardFilters();
      renderBoard();
      setTimeout(()=>{
        if(typeof openTicketDetails==='function')openTicketDetails(n.target.ticketId);
        setTimeout(()=>{
          if(n.target.tab==='comments')document.querySelector('[data-detail-nav="comments"]')?.click();
          setTimeout(()=>highlightNotificationComment(n.target.commentId),80);
        },80);
      },70);
      return;
    }
    if(n.target.view==='documents'&&n.target.documentId){
      activeDocId=n.target.documentId;
      switchView('documents');
      if(typeof renderDocuments==='function')renderDocuments();
      setTimeout(()=>highlightNotificationDocument(n.target.documentId),100);
      return;
    }
    if(n.target.view==='board'&&n.target.ticketId){
      switchView('board');
      if(typeof clearAllBoardFilters==='function')clearAllBoardFilters();
      renderBoard();
      setTimeout(()=>highlightNotificationTicket(n.target.ticketId),80);
      return;
    }
    switchView(n.target.view);
  }


  function highlightNotificationComment(commentId){
    if(!commentId)return;
    const el=document.querySelector(`[data-comment-id="${CSS.escape(String(commentId))}"]`);
    if(!el){toast('The mentioned comment is no longer available');return;}
    el.scrollIntoView({behavior:'smooth',block:'center'});
    el.classList.remove('notification-comment-focus');void el.offsetWidth;el.classList.add('notification-comment-focus');
    setTimeout(()=>el.classList.remove('notification-comment-focus'),3600);
  }

  function highlightNotificationDocument(documentId){
    const item=document.querySelector(`[data-doc-id="${CSS.escape(String(documentId))}"]`);
    const target=document.querySelector('.rich-editor-shell')||document.getElementById('docViewer')||item;
    item?.scrollIntoView({behavior:'smooth',block:'nearest'});
    if(!target){toast('The mentioned document is no longer available');return;}
    target.classList.remove('notification-document-focus');void target.offsetWidth;target.classList.add('notification-document-focus');
    setTimeout(()=>target.classList.remove('notification-document-focus'),3600);
  }

  function highlightNotificationTicket(ticketId){
    const ticket=[...document.querySelectorAll('.ticket')].find(el=>String(el.dataset.id)===String(ticketId));
    if(!ticket){toast(`${ticketId} is no longer visible on the Board`);return;}
    ticket.scrollIntoView({behavior:'smooth',block:'center',inline:'center'});
    ticket.classList.remove('notification-ticket-focus');void ticket.offsetWidth;ticket.classList.add('notification-ticket-focus');
    setTimeout(()=>ticket.classList.remove('notification-ticket-focus'),3600);
    toast(`Opened ${ticketId} — ticket highlighted`);
  }

  function initNotifications(){
    ensureNotificationUi();renderNotifications();
    setTimeout(()=>fetchNotifications(),1200);
    window.teamFlowNotificationsOnVersionChanged=()=>fetchNotifications({quiet:true});
    window.teamFlowNotificationsOnConnected=()=>fetchNotifications({quiet:true});
    window.addEventListener('resize',()=>{if(notificationDropdownOpen)positionNotificationDropdown();});
  }

  document.addEventListener('DOMContentLoaded',initNotifications);
