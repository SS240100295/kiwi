const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const core=fs.readFileSync(path.join(__dirname,'../dist/app.js'),'utf8');
const studio=fs.readFileSync(path.join(__dirname,'../dist/studio.js'),'utf8');
function setup(data){
 const ctx=vm.createContext({document:{querySelector:()=>({value:''})},localStorage:{getItem:()=>JSON.stringify(data)},crypto:require('node:crypto'),Intl,Date,structuredClone,assert});
 vm.runInContext(core.slice(0,core.indexOf('function save()')),ctx);
 vm.runInContext(core.slice(core.indexOf('function validateBackup('),core.indexOf("$('#restore').onchange")),ctx);
 const sections=[['const photoSafe=', 'const picture='],['function migrateStudio(', 'function commitStudio('],['function monthlyData(', 'function chartPanel('],['function receiptHTML(', 'function showReceipt('],['const oldValidate=', 'save();render();']];
 for(const [start,end]of sections){let a=studio.indexOf(start);vm.runInContext(studio.slice(a,studio.indexOf(end,a)),ctx)}
 return script=>vm.runInContext(script,ctx);
}
function fixture(){return {purchases:[{id:'wire',name:'Wire',buyer:'Me',date:'2026-10-01',qty:10,unit:'metres',price:100}],orders:[{id:'order',customer:'A < B',item:'Bracelet',notes:'',qty:2,date:'2026-10-02',due:'2026-10-30',status:'Pending',sale:500,paid:100,labour:40,other:10,uses:[{id:'wire',qty:2}]}]}}
test('legacy balances become undated entries without changing money or consuming more stock',()=>{const run=setup(fixture());run(`migrateStudio(db);assert.equal(db.orders[0].payments[0].amount,100);assert.equal(db.orders[0].payments[0].date,null);assert.equal(db.purchases[0].lowStock,2);assert.equal(used('wire'),2);assert.equal(cost(db.orders[0]),70);migrateStudio(db);assert.equal(db.orders[0].payments.length,1)`)});
test('monthly charts handle profit and loss separately by order month',()=>{const run=setup(fixture());run(`db.orders.push({...db.orders[0],id:'loss',date:'2026-11-03',sale:20});let months=monthlyData(db.orders);assert.equal(months[0].profit,430);assert.equal(months[1].profit,-50);assert.equal(months[0].key,'2026-10')`)});
test('backup validation accepts old data and rejects inconsistent payments, stock and recipe references',()=>{const run=setup(fixture());run(`assert.equal(validateBackup(structuredClone(db)).orders[0].payments[0].date,null);let bad=validateBackup(structuredClone(db));bad.orders[0].payments[0].amount=999;assert.throws(()=>validateBackup(bad));bad=structuredClone(db);bad.orders[0].uses[0].qty=11;assert.throws(()=>validateBackup(bad));bad=validateBackup(structuredClone(db));bad.recipes=[{id:'r',name:'Recipe',sale:100,labour:10,other:0,photo:'',uses:[{id:'missing',qty:1}]}];assert.throws(()=>validateBackup(bad))`)});
test('recipes and embedded photos survive backups; invalid image sources are rejected',()=>{const run=setup(fixture());run(`migrateStudio(db);db.recipes=[{id:'r',name:'Bracelet',sale:250,labour:20,other:5,photo:'data:image/jpeg;base64,AAAA',uses:[{id:'wire',qty:1}]}];assert.equal(validateBackup(structuredClone(db)).recipes[0].uses[0].qty,1);db.recipes[0].photo='javascript:alert(1)';assert.throws(()=>validateBackup(db))`)});
test('customer receipt escapes names and never discloses production costs',()=>{const run=setup(fixture());run(`migrateStudio(db);let html=receiptHTML(db.orders[0]);assert.ok(html.includes('A &lt; B'));assert.ok(html.includes('Rs 400'));assert.ok(html.includes('Not recorded'));assert.ok(!html.includes('Labour'));assert.ok(!html.includes('Production cost'));assert.ok(!html.includes('Rs 70'))`)});
test('This month excludes earlier and later months; custom ranges include both endpoints',()=>{const run=setup(fixture());run(`const month=today().slice(0,7);period='month';assert.equal(inRange(month+'-01'),true);assert.equal(inRange('2020-01-01'),false);assert.equal(inRange('2099-01-01'),false);document.querySelector=s=>({value:s==='#from'?'2026-09-01':'2026-09-30'});period='custom';assert.equal(inRange('2026-09-01'),true);assert.equal(inRange('2026-09-30'),true);assert.equal(inRange('2026-10-01'),false);period='all';assert.equal(inRange('2020-01-01'),true)`)});
