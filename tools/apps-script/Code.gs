// M2 工具中心 · owner-only cloud synchronization.
// Deploy as yourself, access ONLY MYSELF. No credentials are published in GitHub.
function setupToolCenter() {
  var props=PropertiesService.getScriptProperties();
  var owner=Session.getEffectiveUser().getEmail();
  if(!owner)throw new Error('请使用项目所有者账号运行初始化。');
  if(props.getProperty('OWNER')&&props.getProperty('OWNER')!==owner)throw new Error('仅所有者可初始化。');
  var id=props.getProperty('SHEET_ID');
  if(!id){var book=SpreadsheetApp.create('M2 工具中心 · 云端清单');var sheet=book.getSheets()[0];sheet.setName('版本记录');sheet.getRange(1,1,1,4).setValues([['版本','保存时间','请求编号','清单快照（系统管理，请勿手动修改）']]);sheet.setFrozenRows(1);id=book.getId();props.setProperties({OWNER:owner,SHEET_ID:id});}
  var url=SpreadsheetApp.openById(id).getUrl();console.log('云端清单已准备：'+url);return {url:url};
}
function assertOwner_(){var owner=PropertiesService.getScriptProperties().getProperty('OWNER');var active=Session.getActiveUser().getEmail();if(!owner||!active||active!==owner)throw new Error('请使用工具中心所有者的 Google 账号登录。');}
function book_(){return SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID'));}
function latest_(sheet){var last=sheet.getLastRow();if(last<2)return {version:0,data:null,lastRequestId:''};var row=sheet.getRange(last,1,1,sheet.getLastColumn()).getValues()[0];var encoded=row.slice(3).filter(function(x){return x!==''}).join('');var decoded=Utilities.newBlob(Utilities.base64Decode(encoded)).getDataAsString('UTF-8');var data=validate_(JSON.parse(decoded));return {version:Number(row[0]),updatedAt:String(row[1]),lastRequestId:String(row[2]),data:data};}
function hubRead(){assertOwner_();var lock=LockService.getScriptLock();lock.waitLock(15000);try{return latest_(book_().getSheetByName('版本记录'));}finally{lock.releaseLock();}}
function validate_(data){
  if(!data||data.schema!==1||!Array.isArray(data.tools)||data.tools.length>500||!Array.isArray(data.categories)||data.categories.length>50)throw new Error('清单格式不正确');
  function str(v,n,required){if(typeof v!=='string'||v.length>n||(required&&!v.trim()))throw new Error('清单字段不正确');return v;}
  function url(v){str(v,2000,true);if(!/^https?:\/\/[^\s/@]+(?::\d+)?(?:[/?#]|$)/i.test(v)||/[\u0000-\u0020]/.test(v))throw new Error('网址不受支持');return v;}
  var seen={};data.categories.forEach(function(x){str(x,24,true)});
  data.tools.forEach(function(t){str(t.id,100,true);if(seen['id:'+t.id])throw new Error('工具编号重复');seen['id:'+t.id]=true;str(t.name,60,true);str(t.category,24,true);url(t.url);str(t.description,120,false);str(t.status,20,false);str(t.icon,24,true);if(t.repository)url(t.repository);if(typeof t.order!=='number'||!isFinite(t.order))throw new Error('排序不正确');if(data.categories.indexOf(t.category)<0)throw new Error('分类不存在');});
  if(JSON.stringify(data).length>750000)throw new Error('清单过大');return data;
}
function hubSave(payload){
  assertOwner_();if(!payload||!/^[-a-f0-9]{36}$/.test(String(payload.requestId))||!Number.isInteger(payload.baseVersion)||payload.baseVersion<0)throw new Error('保存请求不正确');var data=validate_(payload.data);
  var lock=LockService.getScriptLock();lock.waitLock(15000);
  try{var sheet=book_().getSheetByName('版本记录'),current=latest_(sheet);
    if(current.lastRequestId===payload.requestId)return {version:current.version,duplicate:true};
    if(current.version!==payload.baseVersion)return Object.assign({conflict:true},current);
    var next=current.version+1;var encoded=Utilities.base64Encode(JSON.stringify(data),Utilities.Charset.UTF_8);var chunks=encoded.match(/.{1,30000}/g)||[''];var row=[next,new Date().toISOString(),payload.requestId].concat(chunks);
    if(sheet.getMaxColumns()<row.length)sheet.insertColumnsAfter(sheet.getMaxColumns(),row.length-sheet.getMaxColumns());
    // One append-only snapshot write commits both the revision and complete data.
    sheet.getRange(sheet.getLastRow()+1,1,1,row.length).setValues([row]);SpreadsheetApp.flush();return {version:next};
  }finally{lock.releaseLock();}
}
function doGet(e){
  var params=(e&&e.parameter)||{};var allowed=['https://harry6937.github.io','http://127.0.0.1:8892'];var origin=allowed.indexOf(params.origin)>=0?params.origin:allowed[0];var channel=/^[-a-f0-9]{36}$/.test(params.channel||'')?params.channel:'';
  var config={origin:origin,channel:channel,mode:params.mode==='popup'?'popup':'frame'};
  return HtmlService.createHtmlOutput(BRIDGE_HTML_.replace('__BRIDGE_CONFIG__',JSON.stringify(config))).setTitle('M2 工具中心 · Google 云端连接').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
// BRIDGE_HTML_ is appended by build_backend.py from Bridge.html.
