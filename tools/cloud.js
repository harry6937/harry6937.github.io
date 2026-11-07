(function(){
  'use strict';
  const pending=new Map();let peer=null,peerOrigin='',channel='',frame=null,popup=null,attempt=null;
  function originAllowed(origin){return /^https:\/\/(?:[a-z0-9-]+-)?script\.googleusercontent\.com$/.test(origin)||origin==='https://script.google.com'}
  function reset(){peer=null;peerOrigin='';for(const {reject,timer} of pending.values()){clearTimeout(timer);reject(Error('云端连接已重置'))}pending.clear()}
  window.addEventListener('message',event=>{
    const m=event.data;if(!m||m.namespace!=='m2-hub'||!originAllowed(event.origin)||m.channel!==channel)return;
    if(m.type==='ready'&&attempt){
      // A random per-connection channel is delivered only through the owner-only Google deployment URL.
      // Google nests the bridge in its sandbox frame; bind to the first exact responding peer.
      if(peer&&event.source!==peer)return;
      peer=event.source;peerOrigin=event.origin;peer.postMessage({namespace:'m2-hub',channel,type:'ack'},peerOrigin);clearTimeout(attempt.timer);attempt.resolve();attempt=null;
    } else if(m.type==='result'&&event.source===peer&&event.origin===peerOrigin&&pending.has(m.id)){
      const p=pending.get(m.id);pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(m.error)):p.resolve(m.result);
    }
  });
  function connect(usePopup=false){
    if(peer&&!usePopup)return Promise.resolve();
    if(attempt&&!usePopup)return attempt.promise;
    if(!window.M2_CONFIG.cloudUrl)return Promise.reject(Error('云端服务尚未完成部署，当前修改先保存在本机。'));
    if(attempt){clearTimeout(attempt.timer);attempt.reject(Error('正在重新连接'));attempt=null}reset();
    channel=crypto.randomUUID();const u=new URL(window.M2_CONFIG.cloudUrl);u.searchParams.set('channel',channel);u.searchParams.set('origin',location.origin);u.searchParams.set('mode',usePopup?'popup':'frame');
    let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});
    attempt={promise,resolve,reject,timer:setTimeout(()=>{attempt=null;reject(Error('请点击“连接 Google 云端”，完成 Google 登录后保留连接窗口。'))},45000)};
    if(usePopup){popup=window.open(u.href,'m2-cloud-connection','popup,width=460,height=570');if(!popup){clearTimeout(attempt.timer);attempt=null;reject(Error('浏览器拦截了连接窗口，请允许本站弹出窗口后重试。'))}}
    else{if(frame)frame.remove();frame=document.createElement('iframe');frame.hidden=true;frame.title='Google 云端同步连接';frame.src=u.href;document.body.append(frame)}
    return promise;
  }
  function call(method,payload){return new Promise((resolve,reject)=>{
    if(!peer)return reject(Error('请先连接 Google 云端'));
    const id=crypto.randomUUID();const timer=setTimeout(()=>{pending.delete(id);reject(Error('同步超时，本机修改已保留，请重试。'))},25000);
    pending.set(id,{resolve,reject,timer});peer.postMessage({namespace:'m2-hub',channel,id,type:'request',method,payload},peerOrigin);
  })}
  window.M2Cloud={connect,call,get connected(){return !!peer},reset};
})();
