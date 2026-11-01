import {readFile,writeFile,mkdir} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const code=(await readFile(new URL('../apps-script/Code.gs',import.meta.url),'utf8'))
  .replace(/^const SPREADSHEET_ID = .+;$/m,"const SPREADSHEET_ID = 'test-source';")
  .replace(/^const USAGE_SHEET_ID = .+;$/m,'const USAGE_SHEET_ID = 7;');
async function optionalFixture(name){try{return JSON.parse(await readFile(new URL('../outputs/'+name,import.meta.url),'utf8'));}catch(error){if(error.code==='ENOENT')return [];throw error;}}
const fixtures=await optionalFixture('real-fixtures.local.json');
const prior=await optionalFixture('desktop-usage.local.json');
const headers=['Request ID','Used at (UTC)','Model ID','Model','IMEI 1','IMEI 2'];
export function environment(models,used=[]) {
  let lockHeld=false, denyLock=false, failWrite=false, failFlush=false;
  const props=new Map();
  const makeSheet=(id,name,rows)=>({id,name,rows,maxRows:1000,
    getSheetId(){return this.id},getName(){return this.name},isSheetHidden(){return false},
    getLastRow(){return this.rows.length},getMaxRows(){return this.maxRows},getMaxColumns(){return 26},
    insertRowsAfter(_,n){this.maxRows+=n},
    getRange(row,col,height,width){const sheet=this;return {
      getValues(){return Array.from({length:height},(_,r)=>Array.from({length:width},(_,c)=>sheet.rows[row-1+r]?.[col-1+c]??''));},
      getDisplayValues(){return this.getValues().map(r=>r.map(String));},
      setNumberFormat(){return this;},
      setValues(values){if(failWrite)throw Error('Write failed'); for(let r=0;r<values.length;r++){sheet.rows[row-1+r]??=[];for(let c=0;c<values[r].length;c++)sheet.rows[row-1+r][col-1+c]=values[r][c].replace(/^'/,'');}return this;}
    }}
  });
  const sheets=models.map((m,i)=>makeSheet(i+1,m.model,[['IMEI'],...m.numbers.map(n=>[n])]));
  const ledger=makeSheet(7,'_Usage',[[...headers],...used.map(r=>[...r])]);
  const source={getSheets:()=>sheets,getUrl:()=> 'https://docs.google.com/spreadsheets/d/test/edit'};
  const history={getSheetById:id=>id===7?ledger:null};
  const ctx=vm.createContext({console,SpreadsheetApp:{openById:id=>id==='test-source'?source:history,flush(){if(failFlush)throw Error('Response lost');}},
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v)})},
    LockService:{getScriptLock:()=>({tryLock(){if(lockHeld||denyLock)return false;lockHeld=true;return true;},releaseLock(){lockHeld=false;}})}});
  vm.runInContext(code,ctx);
  return {ctx,sheets,ledger,props,set denyLock(v){denyLock=v},set failWrite(v){failWrite=v},set failFlush(v){failFlush=v},get locked(){return lockHeld}};
}
const plain=value=>JSON.parse(JSON.stringify(value));
let count=0;
function check(name,fn){fn();count++;console.log('PASS '+name)}
check('15-digit parsing preserves leading zero and rejects overlong numbers',()=>{
  const e=environment([]);
  for(const [input,expected] of [['001234567890123',['001234567890123']],['1234567890123456',[]],['1.23456789012345e14',['123456789012345']],['123 456 789 012 345',['123456789012345']],[true,[]],['IMEI:123456789012345 / 223456789012345',['123456789012345','223456789012345']]])assert.deepEqual(plain(e.ctx.parseImeis_(input)),expected);
});
check('pair extraction, idempotent retry, odd last value and exhaustion',()=>{
  const e=environment([{model:'Test',numbers:['001234567890123','123456789012345','223456789012345']}]);
  const id=randomUUID(),first=e.ctx.extractPair('1',id);
  assert.equal(first.numbers.length,2);assert.equal(first.stats.remaining,1);
  assert.deepEqual(plain(e.ctx.extractPair('1',id).numbers),plain(first.numbers));assert.equal(e.ledger.rows.length,2);
  const last=e.ctx.extractPair('1',randomUUID());assert.equal(last.numbers.length,1);assert.equal(last.stats.remaining,0);
  assert.equal(e.ctx.extractPair('1',randomUUID()).numbers.length,0);
});
check('global deduplication survives model rename and reordered source',()=>{
  const n=['123456789012345','223456789012345','323456789012345'];
  const e=environment([{model:'A',numbers:[n[0],n[0],n[1]]},{model:'B',numbers:n}]);
  assert.equal(e.ctx.getDashboard().models[0].duplicates,1);
  e.ctx.extractPair('1',randomUUID());e.sheets[0].name='Renamed';e.sheets[1].rows.reverse();
  assert.deepEqual(plain(e.ctx.extractPair('2',randomUUID()).numbers),[n[2]]);
});
check('write failures, lost responses and contention do not reserve another pair',()=>{
  const e=environment([{model:'A',numbers:['123456789012345','223456789012345','323456789012345']}]);
  const id=randomUUID();e.denyLock=true;assert.throws(()=>e.ctx.extractPair('1',id),/progress/);assert.equal(e.ledger.rows.length,1);
  e.denyLock=false;e.failWrite=true;assert.throws(()=>e.ctx.extractPair('1',id),/Write failed/);assert.equal(e.locked,false);assert.equal(e.ledger.rows.length,1);
  e.failWrite=false;e.failFlush=true;assert.throws(()=>e.ctx.extractPair('1',id),/Response lost/);assert.equal(e.ledger.rows.length,2);
  e.failFlush=false;assert.equal(e.ctx.extractPair('1',id).numbers.length,2);assert.equal(e.ledger.rows.length,2);assert.equal(e.ctx.getModelState('1',id).result.recovered,true);
});
check('deleted or corrupt usage history stops extraction',()=>{
  const e=environment([{model:'A',numbers:['123456789012345','223456789012345']}]);
  e.ctx.extractPair('1',randomUUID());e.ledger.rows.pop();assert.throws(()=>e.ctx.extractPair('1',randomUUID()),/shortened/);
  e.ledger.rows[0][0]='Wrong';assert.throws(()=>e.ctx.getDashboard(),/missing or changed/);
});
if(fixtures.length)check('all real Excel fixtures exhaust without repeating, including old desktop history',()=>{
  const e=environment(fixtures,prior),allUsed=new Set(prior.flatMap(r=>[r[4],r[5]]).filter(Boolean));
  let issued=0;
  for(let i=0;i<fixtures.length;i++){
    const expected=fixtures[i].numbers.filter(n=>!allUsed.has(n));
    const observed=[];
    while(e.ctx.getModelState(String(i+1),'').stats.remaining){
      const pair=e.ctx.extractPair(String(i+1),randomUUID());assert.ok(pair.numbers.length>0 && pair.numbers.length<=2);
      for(const n of pair.numbers){assert.ok(!allUsed.has(n));allUsed.add(n);observed.push(n);issued++;}
    }
    assert.deepEqual(observed,expected);assert.equal(e.ctx.extractPair(String(i+1),randomUUID()).numbers.length,0);
  }
  console.log('Real fixture results:',JSON.stringify({models:fixtures.length,source:fixtures.reduce((n,f)=>n+f.numbers.length,0),prior:prior.length,issued}));
});
const result={passed:count,realModels:fixtures.length,realImeis:fixtures.reduce((n,f)=>n+f.numbers.length,0),priorUsage:prior.length};
await mkdir(new URL('../outputs/',import.meta.url),{recursive:true});
await writeFile(new URL('../outputs/test-result.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
