import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=await readFile(new URL('../apps-script/Bridge.html',import.meta.url),'utf8');
const client=await readFile(new URL('../service.js',import.meta.url),'utf8');
const protocol='m2-imei-bridge-v2',origin='https://harry6937.github.io',channel='00000000-0000-4000-8000-000000000001';
const googleOrigin='https://n-test-script.googleusercontent.com';
const plain=value=>JSON.parse(JSON.stringify(value));
function backend(mode='bridge'){
  const posted=[],invoked=[];let listener;
  const host={postMessage:(data,target)=>posted.push({data,target})};
  const top=mode==='popup'?{opener:host}:host;
  const context={window:{top,addEventListener:(_,fn)=>listener=fn},document:{getElementById:()=>({textContent:''})},setInterval:()=>1,clearInterval(){},google:{script:{run:{withSuccessHandler(success){return {withFailureHandler(){return Object.fromEntries(['getDashboard','getModelState','extractPair'].map(name=>[name,(...args)=>{invoked.push({name,args});success({ok:true});}]));}};}}}}};
  vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1].replace('__BRIDGE_CONFIG__',JSON.stringify({origin,channel,mode})),context);
  const send=(message,extra={})=>listener({origin,source:host,data:{protocol,channel,...message},...extra});
  return {posted,invoked,send,host};
}
for(const mode of ['bridge','popup']){
  const b=backend(mode);
  assert.equal(b.posted[0].target,origin);
  const call={type:'call',id:channel,method:'extractPair',args:['9',channel]};
  b.send(call);assert.equal(b.invoked.length,0);
  b.send({type:'connect'});
  b.send(call,{origin:'https://attacker.example'});
  b.send(call,{source:{}});
  b.send({...call,channel:'other'});
  b.send({...call,method:'verifyConnection',args:[]});
  b.send({...call,args:[{},channel]});
  assert.equal(b.invoked.length,0);
  b.send(call);assert.deepEqual(plain(b.invoked),[{name:'extractPair',args:['9',channel]}]);
  assert.ok(b.posted.every(p=>p.target===origin));
  console.log('PASS '+mode+' bridge rejects foreign origins, windows, channels, methods and malformed arguments');
}
function frontend(){
  const listeners=new Map(),timers=new Map(),frames=[],sent=[];let id=0,timerId=0;
  const peer={postMessage:(data,target)=>sent.push({data,target})};
  const popup={closed:false,close(){this.closed=true;}};
  const window={addEventListener:(name,fn)=>listeners.set(name,fn),dispatchEvent(){},open:()=>popup};
  const context={window,document:{createElement:()=>({setAttribute(){},remove(){}}),body:{appendChild:frame=>frames.push(frame)}},crypto:{randomUUID:()=>`00000000-0000-4000-8000-${String(++id).padStart(12,'0')}`},URL,CustomEvent:class{constructor(name,init){this.type=name;this.detail=init.detail;}},setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id)};
  vm.runInNewContext(client,context);
  const send=(data,extra={})=>listeners.get('message')({origin:googleOrigin,source:peer,data:{protocol,channel:new URL(frames[0].src).searchParams.get('channel'),...data},...extra});
  return {api:window.imeiService,send,peer,frames,sent,timers,popup};
}
const f=frontend();
const result=f.api.call('getDashboard');
assert.equal(f.frames.length,1);assert.equal(f.frames[0].hidden,true);
f.send({type:'ready'},{origin:'https://attacker.example'});assert.equal(f.sent.length,0);
f.send({type:'ready',channel:'wrong'});assert.equal(f.sent.length,0);
f.send({type:'ready'});assert.equal(f.sent[0].data.type,'connect');
f.send({type:'connected'});await Promise.resolve();
const request=f.sent.find(m=>m.data.type==='call');assert.ok(request);
f.send({type:'result',id:request.data.id,data:{injected:true}},{source:{}});
assert.equal(f.timers.size,1);
f.send({type:'result',id:request.data.id,data:{models:[]}});
assert.deepEqual(plain(await result),{models:[]});
assert.ok(f.sent.every(m=>m.target===googleOrigin));
console.log('PASS GitHub client authenticates the handshake and rejects a forged response window');
const slow=f.api.call('extractPair','9',channel);await Promise.resolve();
const slowError=assert.rejects(slow,/Retry to recover the same request/);
const timeout=[...f.timers.values()].find(t=>t.ms===45000);timeout.fn();await slowError;
const retry=f.api.call('extractPair','9',channel);await Promise.resolve();
const calls=f.sent.filter(m=>m.data.type==='call'&&m.data.method==='extractPair');
assert.equal(calls.length,2);assert.deepEqual(plain(calls[0].data.args),plain(calls[1].data.args));
f.send({type:'result',id:calls[1].data.id,data:{recovered:true}});assert.equal((await retry).recovered,true);
console.log('PASS timed-out extraction can reuse its original durable request ID');
const bundle=await readFile(new URL('../index.html',import.meta.url),'utf8');
assert.ok(!bundle.includes('location.replace'));assert.ok(bundle.includes('id="extract"'));assert.ok(bundle.includes('./service.js'));
console.log('PASS GitHub entry contains the full UI without a redirect');
