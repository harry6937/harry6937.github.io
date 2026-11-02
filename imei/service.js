/* The GitHub page owns the UI. This authenticated bridge carries only API messages. */
(() => {
  'use strict';
  const endpoint = 'https://script.google.com/macros/s/AKfycbxE9oRHachMw5xfeuAyS7P-EMiG-zTSLo7kx7XHwhzgm1uIPWxPgxhBtSaBozSe-zGo/exec';
  const protocol = 'm2-imei-bridge-v2';
  const allowedOrigin = origin => /^https:\/\/[a-z0-9-]+-script\.googleusercontent\.com$/.test(origin);
  let frame, popup, channel, peer, peerOrigin, connecting, connectionResolve, connectionReject, connectionTimer;
  const calls = new Map();
  const connectionError = () => new Error('Google Sheets needs a connection. Click Connect Google Sheets and sign in with the account that owns this desk.');
  function fail(error) {
    clearTimeout(connectionTimer);
    if(connectionReject) connectionReject(error);
    connectionResolve = connectionReject = null; connecting = null;
    for(const item of calls.values()) { clearTimeout(item.timer); item.reject(error); }
    calls.clear(); peer = null; peerOrigin = null;
    window.dispatchEvent(new CustomEvent('imei-service-state',{detail:{connected:false,message:error.message}}));
  }
  function start(mode) {
    fail(connectionError());
    if(frame) frame.remove(); frame = null;
    if(popup && !popup.closed) popup.close(); popup = null;
    channel = crypto.randomUUID();
    connecting = new Promise((resolve,reject) => { connectionResolve=resolve; connectionReject=reject; });
    const result = connecting;
    const url = new URL(endpoint); url.searchParams.set('mode',mode); url.searchParams.set('channel',channel);
    connectionTimer=setTimeout(()=>fail(connectionError()),mode==='popup'?180000:15000);
    if(mode==='popup') {
      popup=window.open(url.href,'m2-imei-connection','popup,width=560,height=620');
      if(!popup) fail(new Error('The connection window was blocked. Allow pop-ups for this site, then click Connect Google Sheets again.'));
    } else {
      frame=document.createElement('iframe'); frame.title='Private Google Sheets connection';
      frame.hidden=true; frame.setAttribute('aria-hidden','true'); frame.src=url.href;
      document.body.appendChild(frame);
    }
    return result;
  }
  window.addEventListener('message',event => {
    const message=event.data;
    if(!message || message.protocol!==protocol || message.channel!==channel || !allowedOrigin(event.origin) || !event.source) return;
    if(message.type==='ready') {
      if(peer && (event.source!==peer || event.origin!==peerOrigin)) return;
      peer=event.source; peerOrigin=event.origin;
      peer.postMessage({protocol,channel,type:'connect'},peerOrigin); return;
    }
    if(event.source!==peer || event.origin!==peerOrigin) return;
    if(message.type==='connected' && connectionResolve) {
      clearTimeout(connectionTimer); connectionResolve(); connectionResolve=connectionReject=null;
      window.dispatchEvent(new CustomEvent('imei-service-state',{detail:{connected:true}}));
    } else if(message.type==='result') {
      const item=calls.get(message.id); if(!item) return;
      clearTimeout(item.timer); calls.delete(message.id);
      if(message.error) item.reject(new Error(String(message.error))); else item.resolve(message.data);
    }
  });
  async function call(method,...args) {
    if(!['getDashboard','getModelState','extractPair'].includes(method)) throw new Error('Unsupported request.');
    if(popup && popup.closed) fail(connectionError());
    if(!peer || connectionResolve) await (connecting || start('bridge'));
    return new Promise((resolve,reject) => {
      const id=crypto.randomUUID();
      const timer=setTimeout(()=>{calls.delete(id);reject(new Error('Google Sheets took too long to respond. Retry to recover the same request.'));},45000);
      calls.set(id,{resolve,reject,timer});
      try { peer.postMessage({protocol,channel,type:'call',id,method,args},peerOrigin); }
      catch(error) {clearTimeout(timer);calls.delete(id);reject(error);fail(connectionError());}
    });
  }
  window.imeiService={call,connect:()=>start('popup')};
})();
