(function(root){
  'use strict';
  const ICONS=['scan','phone','truck','store','exchange','calculator','gold','file','wallet','calendar','qr','gift','code','folder'];
  function safeUrl(value){
    if(typeof value!=='string'||value.length>2000)throw Error('网址过长或格式不正确');
    let u;try{u=new URL(value.trim())}catch{throw Error('请输入完整网址，例如 https://example.com')}
    if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error('只支持不含账号密码的 http / https 网址');
    return u.href;
  }
  function text(value,max,required=false){if(typeof value!=='string'||value.length>max)throw Error('字段格式或长度不正确');const v=value.trim();if(required&&!v)throw Error('请填写必填内容');return v}
  function normalize(data){
    if(!data||data.schema!==1||!Array.isArray(data.tools)||data.tools.length>500||!Array.isArray(data.categories)||data.categories.length>50)throw Error('备份格式不正确，最多支持 500 个工具和 50 个分类');
    const ids=new Set();const categories=[...new Set(data.categories.map(x=>text(x,24,true)))];
    const tools=data.tools.map((t,i)=>{
      const id=text(t.id,100,true);if(ids.has(id))throw Error('工具编号重复');ids.add(id);
      const category=text(t.category,24,true);if(!categories.includes(category))categories.push(category);
      return {id,name:text(t.name,60,true),url:safeUrl(t.url),category,icon:ICONS.includes(t.icon)?t.icon:'folder',description:text(t.description||'',120),status:text(t.status||'',20),favorite:!!t.favorite,hidden:!!t.hidden,deleted:!!t.deleted,order:Number.isFinite(t.order)?t.order:i,repository:t.repository?safeUrl(t.repository):''};
    });
    if(categories.length>50)throw Error('分类数量超过 50 个');
    return {schema:1,categories,tools};
  }
  function filter(data,{view='all',category='全部',query='',recent=[]}={}){
    const q=query.trim().toLowerCase();
    let result=data.tools.filter(t=>view==='trash'?t.deleted:!t.deleted&&(view==='manage'||!t.hidden));
    if(view==='favorites')result=result.filter(t=>t.favorite);
    if(view==='recent')result=result.filter(t=>recent.includes(t.id));
    if(category!=='全部')result=result.filter(t=>t.category===category);
    if(q)result=result.filter(t=>[t.name,t.description,t.category,t.status].join(' ').toLowerCase().includes(q));
    return result.sort(view==='recent'?(a,b)=>recent.indexOf(a.id)-recent.indexOf(b.id):(a,b)=>a.order-b.order||a.id.localeCompare(b.id));
  }
  root.M2Core={ICONS,safeUrl,normalize,filter};
})(typeof window==='undefined'?globalThis:window);
