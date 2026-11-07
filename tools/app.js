(() => {
  'use strict';
  const $=id=>document.getElementById(id),C=window.M2Core,KEY='m2-hub:v1',RECENT='m2-hub:recent',PREF='m2-hub:preferences';
  const paths={scan:'M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3M7 12h10',phone:'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm3 17h2',truck:'M1 4h13v13H1zm13 5h4l4 5v3h-8M5 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4m13 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4',store:'M3 9v12h18V9M2 9l2-6h16l2 6M2 9c0 4 5 4 5 0 0 4 5 4 5 0 0 4 5 4 5 0 0 4 5 4 5 0M9 21v-7h6v7',exchange:'M20 7A9 9 0 0 0 4 5L2 8m0-5v5h5m-3 9a9 9 0 0 0 16 2l2-3m0 5v-5h-5M12 6v12m3-9c-3-3-7 1-3 3s4 5-3 3',calculator:'M5 2h14v20H5zM8 6h8M8 11h1m6 0h1M8 15h1m6 0h1M8 19h1m6 0h1',gold:'M8 3h8l2 7H6zM3 13h7l2 8H1zm11 0h7l2 8H12z',file:'M6 2h9l5 5v15H6zM14 2v6h6M9 12h8M9 16h8',wallet:'M3 6h18v15H3zM3 6V3h15v3m3 5h-7v5h7m-4-3h1',calendar:'M3 5h18v17H3zM7 2v6m10-6v6M3 11h18m-14 4h2m6 0h2m-10 4h2',qr:'M3 3h6v6H3zm12 0h6v6h-6zM3 15h6v6H3zm12 0h3v3h3v3h-6zm6-3v2M3 12h8m1-9v8m0 4v6',gift:'M2 8h20v5H2zm2 5h16v9H4zm8-5v14M12 8C2 8 4 0 8 3l4 5c10 0 8-8 4-5z',code:'m8 5-6 7 6 7m8-14 6 7-6 7M14 3l-4 18',folder:'M2 6V3h7l3 3h10v15H2z',grid:'M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z',star:'m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z',clock:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 7v6l4 2',search:'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0m-2 5 6 6',more:'M5 12h.01M12 12h.01M19 12h.01',trash:'M3 6h18M8 6V3h8v3M5 6l1 15h12l1-15M10 10v7m4-7v7'};
  const labels={scan:'扫码',phone:'手机',truck:'运输',store:'门店',exchange:'汇率',calculator:'计算器',gold:'黄金',file:'文档',wallet:'账本',calendar:'日历',qr:'二维码',gift:'活动',code:'代码',folder:'项目'};
  const svg=name=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]||paths.folder}"/></svg>`;
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon=t=>`<span class="tool-icon ${['phone','wallet'].includes(t.icon)?'blue':['truck','gold','calculator'].includes(t.icon)?'amber':['store','file','gift','calendar'].includes(t.icon)?'purple':['folder','code'].includes(t.icon)?'gray':''}">${svg(t.icon)}</span>`;
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))||fallback}catch{return fallback}};
  let envelope=read(KEY,null),data,storageError=false;
  try{data=C.normalize(envelope?.data||window.M2_SEED)}catch{data=C.normalize(window.M2_SEED);storageError=true;envelope=null}
  envelope=envelope||{version:0,dirty:false,generation:0,data};envelope.data=data;
  let recent=read(RECENT,[]),preferences=read(PREF,{openMode:'auto'}),view='all',category='全部',query='',syncing=false,syncTimer,toastTimer,remoteConflict=null,editorGeneration=0,lastCloudTime='',connected=false;
  if(!Array.isArray(recent))recent=[];
  function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),4300)}
  function persist(){try{localStorage.setItem(KEY,JSON.stringify(envelope));return true}catch{toast('浏览器存储空间不足，请立即导出备份。');return false}}
  function cloudStatus(label,kind=''){ $('cloud-label').textContent=label;$('cloud-button').className='sync-pill '+kind;$('cloud-detail').textContent=lastCloudTime?'上次同步：'+lastCloudTime:'尚未同步。未连接时，修改保存在当前浏览器。'}
  function mutate(action){
    // Re-read before mutations so another tab cannot silently lose its latest edits.
    const latest=read(KEY,null);if(latest&&latest.generation!==envelope.generation){try{envelope=latest;data=C.normalize(latest.data)}catch{}}
    const copy=structuredClone(data);action(copy);try{data=C.normalize(copy)}catch(e){toast(e.message);return false}
    envelope={...envelope,data,dirty:true,generation:crypto.randomUUID()};persist();render();cloudStatus(connected?'等待同步':'本机保存','pending');clearTimeout(syncTimer);if(connected)syncTimer=setTimeout(sync,700);return true;
  }
  function toolLink(t,content,className){let target=preferences.openMode==='new'||(preferences.openMode==='auto'&&matchMedia('(min-width:761px)').matches)?' target="_blank"':'';return `<a class="${className}" href="${esc(t.url)}" data-open="${esc(t.id)}"${target} rel="noopener noreferrer">${content}</a>`}
  function setView(next,cat='全部'){view=next;category=cat;render();window.scrollTo({top:0,behavior:'instant'})}
  function render(){
    const nav=[['all','grid','全部工具'],['favorites','star','我的收藏'],['recent','clock','最近使用']];
    $('desktop-nav').innerHTML=nav.map(([v,i,n])=>`<button data-view="${v}" class="${view===v&&category==='全部'?'active':''}">${svg(i)}${n}</button>`).join('')+`<div class="nav-caption">工具分类</div>`+data.categories.map(c=>`<button data-category="${esc(c)}" class="${category===c?'active':''}">${svg(({手机业务:'phone',计算工具:'calculator',门店管理:'store',日常工具:'folder',营销活动:'gift'})[c]||'folder')}${esc(c)}</button>`).join('');
    document.querySelector('.bottom-nav').innerHTML=nav.map(([v,i,n])=>`<button data-view="${v}" class="${view===v?'active':''}">${svg(i)}<span>${({all:'工具',favorites:'收藏',recent:'最近'})[v]}</span></button>`).join('');
    $('filters').innerHTML=['全部',...data.categories].map(c=>`<button data-filter="${esc(c)}" class="filter ${category===c?'active':''}" aria-pressed="${category===c}">${esc(c)}</button>`).join('');
    $('list-title').textContent=({all:'全部工具',favorites:'我的收藏',recent:'最近使用',manage:'管理工具',trash:'回收站'})[view];
    $('manage-button').textContent=view==='manage'||view==='trash'?'完成':'管理';$('manage-note').hidden=view!=='manage';
    const quick=C.filter(data,{view:'favorites'}).slice(0,4);$('favorites-section').hidden=view!=='all'||query!==''||category!=='全部'||quick.length===0;
    $('quick-tools').innerHTML=quick.map(t=>toolLink(t,icon(t)+`<span>${esc(t.name.replace('手机标签 OCR','标签 OCR').replace('IMEI 领取工作台','IMEI 领取'))}</span>`,'quick-card')).join('');
    const list=C.filter(data,{view,category,query,recent});$('tool-count').textContent=list.length;
    $('tools-grid').innerHTML=list.map(t=>`<article class="tool-card ${view==='manage'||view==='trash'?'managing':''}" data-id="${esc(t.id)}">${toolLink(t,icon(t)+`<div class="card-copy"><h3>${esc(t.name)}</h3><p>${esc(t.description)}</p></div>`,'card-main')}<button class="favorite-button ${t.favorite?'selected':''}" data-favorite="${esc(t.id)}" aria-label="${t.favorite?'取消收藏':'收藏'} ${esc(t.name)}" aria-pressed="${t.favorite}">${svg('star')}</button><div class="card-bottom"><span class="category-tag">${esc(t.hidden?'已隐藏':(['空仓库','项目源码','素材仓库','未完成','另一版本'].includes(t.status)?t.status:t.category))}</span><span class="open-label">打开 ↗</span></div><button class="card-menu" data-edit="${esc(t.id)}" aria-label="编辑 ${esc(t.name)}">${svg('more')}</button>${view==='manage'?`<div class="management"><button data-edit="${esc(t.id)}">编辑</button><button data-hide="${esc(t.id)}">${t.hidden?'显示':'隐藏'}</button><button data-move="${esc(t.id)}" data-dir="-1" aria-label="上移 ${esc(t.name)}">↑</button><button data-move="${esc(t.id)}" data-dir="1" aria-label="下移 ${esc(t.name)}">↓</button><button data-delete="${esc(t.id)}">删除</button></div>`:view==='trash'?`<div class="management"><button data-restore="${esc(t.id)}">恢复工具</button></div>`:''}</article>`).join('');
    $('empty-state').hidden=list.length>0;$('empty-text').textContent=view==='recent'?'打开过的工具会出现在这里。':view==='trash'?'删除的入口会保留在这里，可以随时恢复。':view==='favorites'?'点击工具卡片上的星标，即可加入收藏。':'换个关键词试试，或添加一个新工具。';
    $('category-options').innerHTML=data.categories.map(c=>`<option value="${esc(c)}"></option>`).join('');
    $('category-manager').innerHTML=data.categories.map(c=>`<div class="category-row"><input value="${esc(c)}" maxlength="24" aria-label="分类 ${esc(c)}"><button class="secondary" data-rename-category="${esc(c)}">改名</button><button class="secondary" data-remove-category="${esc(c)}">删除</button></div>`).join('');
  }
  function editor(id){const t=data.tools.find(x=>x.id===id);editorGeneration=envelope.generation;$('editor-title').textContent=t?'编辑工具':'添加工具';$('edit-id').value=t?.id||'';$('edit-name').value=t?.name||'';$('edit-url').value=t?.url||'';$('edit-category').value=t?.category||'日常工具';$('edit-icon').value=t?.icon||'folder';$('edit-description').value=t?.description||'';$('edit-status').value=t?.status||'网页';$('edit-favorite').checked=t?.favorite||false;$('edit-error').textContent='';$('editor').showModal()}
  function confirmAction(title,text){$('confirm-title').textContent=title;$('confirm-text').textContent=text;$('confirm-dialog').showModal();return new Promise(resolve=>{const done=value=>{$('confirm-dialog').close();$('confirm-no').onclick=null;$('confirm-yes').onclick=null;resolve(value)};$('confirm-no').onclick=()=>done(false);$('confirm-yes').onclick=()=>done(true);$('confirm-dialog').oncancel=e=>{e.preventDefault();done(false)}})}
  function exportData(){const blob=new Blob([JSON.stringify({...data,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='M2工具中心-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),10000);toast('备份已导出')}
  function adoptRemote(remote){data=C.normalize(remote.data);envelope={version:remote.version,dirty:false,generation:crypto.randomUUID(),data};persist();render();lastCloudTime=new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});cloudStatus('已同步','connected')}
  function conflict(remote){remoteConflict=remote;try{localStorage.setItem('m2-hub:conflict-backup',JSON.stringify({local:envelope,remote}))}catch{}$('conflict-text').textContent=`本机有 ${data.tools.filter(t=>!t.deleted).length} 个入口，云端有 ${remote.data.tools.filter(t=>!t.deleted).length} 个入口。`;cloudStatus('版本待选择','error');if(!$('conflict-dialog').open)$('conflict-dialog').showModal()}
  async function sync(){
    if(syncing||remoteConflict||!connected)return;
    syncing=true;cloudStatus('同步中…','pending');
    try{
      const remote=await M2Cloud.call('read',null);
      const latest=read(KEY,null);if(latest&&latest.generation!==envelope.generation){envelope=latest;data=C.normalize(latest.data)}
      if(remote.data&&envelope.request?.id===remote.lastRequestId){envelope.version=remote.version;envelope.dirty=envelope.generation!==envelope.request.generation;delete envelope.request;persist()}
      if(remote.data&&envelope.dirty&&remote.version!==envelope.version){conflict(remote);return}
      if(!envelope.dirty&&remote.data){if(remote.version!==envelope.version||envelope.version===0)adoptRemote(remote);else{lastCloudTime=new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});cloudStatus('已同步','connected')}return}
      const snapshot=structuredClone(data),generation=envelope.generation;
      // Stable request identity is retained across response loss and retry.
      const previous=envelope.request;
      const request=previous&&previous.generation===generation?previous:{id:crypto.randomUUID(),generation,baseVersion:remote.version,data:snapshot};
      envelope.request=request;persist();
      const saved=await M2Cloud.call('save',{requestId:request.id,baseVersion:request.baseVersion,data:request.data});
      if(saved.conflict){conflict(saved);return}
      const after=read(KEY,null);if(after&&after.generation!==envelope.generation){envelope=after;data=C.normalize(after.data)}
      envelope.version=saved.version;envelope.dirty=envelope.generation!==generation;delete envelope.request;persist();lastCloudTime=new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});cloudStatus(envelope.dirty?'等待同步':'已同步',envelope.dirty?'pending':'connected');if(envelope.dirty)syncTimer=setTimeout(sync,500);
    }catch(e){cloudStatus('同步未完成','error');$('cloud-detail').textContent=e.message;toast(e.message)}finally{syncing=false}
  }
  async function connect(popup=false){try{cloudStatus('连接中…','pending');await M2Cloud.connect(popup);connected=true;await sync()}catch(e){connected=false;cloudStatus('未连接云端','error');$('cloud-detail').textContent=e.message;if(popup)toast(e.message)}}
  document.addEventListener('click',async e=>{
    const b=e.target.closest('button,a');if(!b)return;const d=b.dataset;
    if(d.close)$(d.close).close();
    if(d.view)setView(d.view);
    if(d.category)setView('all',d.category);
    if(d.filter){category=d.filter;render()}
    if(d.open){recent=[d.open,...recent.filter(x=>x!==d.open)].slice(0,40);try{localStorage.setItem(RECENT,JSON.stringify(recent))}catch{}}
    if(d.favorite)mutate(s=>{const t=s.tools.find(x=>x.id===d.favorite);if(t)t.favorite=!t.favorite});
    if(d.edit)editor(d.edit);
    if(d.hide)mutate(s=>{const t=s.tools.find(x=>x.id===d.hide);if(t)t.hidden=!t.hidden});
    if(d.delete&&await confirmAction('移入回收站？','仅移除工具中心的入口，原网页、业务数据和 GitHub 仓库不会删除。可在回收站恢复。')){mutate(s=>{const t=s.tools.find(x=>x.id===d.delete);if(t)t.deleted=true});toast('已移入回收站')}
    if(d.restore){mutate(s=>{const t=s.tools.find(x=>x.id===d.restore);if(t){t.deleted=false;t.hidden=false}});toast('工具已恢复')}
    if(d.move)mutate(s=>{const list=C.filter(s,{view:'manage',category,query});const i=list.findIndex(t=>t.id===d.move),j=i+Number(d.dir);if(j>=0&&j<list.length){const a=s.tools.find(t=>t.id===list[i].id),z=s.tools.find(t=>t.id===list[j].id);[a.order,z.order]=[z.order,a.order]}});
    if(d.renameCategory){const name=b.parentElement.querySelector('input').value.trim();if(!name){toast('分类名称不能为空');return}if(data.categories.includes(name)&&name!==d.renameCategory){toast('已有同名分类');return}mutate(s=>{s.categories=s.categories.map(c=>c===d.renameCategory?name:c);s.tools.forEach(t=>{if(t.category===d.renameCategory)t.category=name})});if(category===d.renameCategory)category=name;render()}
    if(d.removeCategory){if(d.removeCategory==='其他项目'){toast('“其他项目”用于接收未分类入口，请保留');return}if(await confirmAction('删除分类？','这个分类中的工具会移到“其他项目”，工具本身保留。')){mutate(s=>{s.categories=s.categories.filter(c=>c!==d.removeCategory);if(!s.categories.includes('其他项目'))s.categories.push('其他项目');s.tools.forEach(t=>{if(t.category===d.removeCategory)t.category='其他项目'})});category='全部';render()}}
  });
  $('edit-form').onsubmit=e=>{e.preventDefault();const latest=read(KEY,null);if(latest&&latest.generation!==editorGeneration){$('edit-error').textContent='另一页面或设备更新了清单。请关闭后重新编辑，以免覆盖新的修改。';return}let url;try{url=C.safeUrl($('edit-url').value)}catch(err){$('edit-error').textContent=err.message;return}const id=$('edit-id').value||crypto.randomUUID();const item={id,name:$('edit-name').value.trim(),url,category:$('edit-category').value.trim(),icon:$('edit-icon').value,description:$('edit-description').value.trim(),status:$('edit-status').value.trim(),favorite:$('edit-favorite').checked};if(!item.name||!item.category){$('edit-error').textContent='请填写名称和分类';return}const success=mutate(s=>{const existing=s.tools.find(t=>t.id===id);if(existing)Object.assign(existing,item);else s.tools.push({...item,repository:'',hidden:false,deleted:false,order:Math.max(-1,...s.tools.map(t=>t.order))+1});if(!s.categories.includes(item.category))s.categories.push(item.category)});if(success){$('editor').close();toast(connected?'已保存，正在同步':'已保存在本机，连接云端后同步')}};
  $('add-button').onclick=$('empty-add').onclick=()=>editor();$('show-favorites').onclick=()=>setView('favorites');$('manage-button').onclick=()=>setView(view==='manage'||view==='trash'?'all':'manage');$('search').oninput=e=>{query=e.target.value;render()};
  document.querySelectorAll('.settings-trigger').forEach(b=>b.onclick=()=>{$('open-mode').value=preferences.openMode;$('settings').showModal()});$('cloud-button').onclick=()=>{$('settings').showModal()};
  $('connect-cloud').onclick=()=>connect(true);$('sync-now').onclick=()=>connected?sync():connect(true);$('open-mode').onchange=e=>{preferences.openMode=e.target.value;try{localStorage.setItem(PREF,JSON.stringify(preferences))}catch{}render()};
  $('export-button').onclick=$('conflict-export').onclick=exportData;$('trash-button').onclick=()=>{$('settings').close();setView('trash')};
  $('add-category-form').onsubmit=e=>{e.preventDefault();const name=$('new-category').value.trim();if(!name||data.categories.includes(name)){toast('请填写未使用的分类名称');return}if(mutate(s=>s.categories.push(name)))$('new-category').value=''};
  async function importBackup(text){try{if(text.length>2_000_000)throw Error('备份不能超过 2 MB');const parsed=C.normalize(JSON.parse(text));if(await confirmAction('导入工具备份？',`将以备份中的 ${parsed.tools.length} 个入口替换当前清单。当前清单会先自动下载备份，连接云端后同步。`)){exportData();mutate(s=>Object.assign(s,parsed));$('backup-text').value='';toast('备份已导入')}}catch(err){toast(err.message)}}
  $('import-file').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;if(f.size>2_000_000){toast('备份不能超过 2 MB');return}await importBackup(await f.text())};
  $('import-text-button').onclick=()=>importBackup($('backup-text').value);
  $('use-remote').onclick=()=>{if(!remoteConflict)return;adoptRemote(remoteConflict);remoteConflict=null;$('conflict-dialog').close()};
  $('use-local').onclick=async()=>{if(!remoteConflict)return;if(await confirmAction('用本机版本更新云端？','云端版本已经保存在本机冲突备份中。确认后，其他设备将读取这份本机清单。')){envelope.version=remoteConflict.version;envelope.dirty=true;delete envelope.request;persist();remoteConflict=null;$('conflict-dialog').close();sync()}};
  $('conflict-dialog').addEventListener('cancel',e=>e.preventDefault());
  window.addEventListener('storage',e=>{if(e.key===KEY&&e.newValue){try{const n=JSON.parse(e.newValue);data=C.normalize(n.data);envelope=n;render();cloudStatus(n.dirty?'等待同步':'已保存',n.dirty?'pending':'connected')}catch{}}});
  document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('search').focus()}});
  window.addEventListener('online',()=>{if(connected)sync()});document.addEventListener('visibilitychange',()=>{if(!document.hidden&&connected)sync()});setInterval(()=>{if(connected&&!document.hidden)sync()},45000);
  $('search-icon').innerHTML=svg('search');$('edit-icon').innerHTML=C.ICONS.map(i=>`<option value="${i}">${labels[i]}</option>`).join('');render();if(!envelope.generation)envelope.generation=crypto.randomUUID();persist();
  if(storageError)toast('原本机缓存格式异常，已显示初始工具清单。');
  if(window.M2_CONFIG.cloudUrl)connect();else{$('cloud-description').textContent='云端服务正在准备。当前可使用全部工具，修改先保存在本机；部署完成后即可连接 Google 同步。';cloudStatus('本机保存')}
})();
