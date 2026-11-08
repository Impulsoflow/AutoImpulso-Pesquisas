const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const html=readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const inline=Array.from(html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)).map(m=>m[1]).find(x=>x.includes('async function autoSendWithPdf'));

test('script integral da pesquisa permanece sintaticamente válido',()=>{
 assert.ok(inline);
 assert.doesNotThrow(()=>new vm.Script(inline,{filename:'GestaoNoTempo/index.html'}));
});
test('conta autenticada grava no AutoImpulso sem URL Google, e o retry conserva PDF e grant',()=>{
 assert.match(inline,/if \(central\?\.active\)/);
 assert.match(inline,/result = await persistGestaoInAutoImpulso\(payload\)/);
 assert.match(inline,/if \(!WEB_APP_URL\)/);
 assert.match(inline,/pendingCentralPayload = payload/);
 assert.match(inline,/persistGestaoInAutoImpulso\(pendingCentralPayload\)/);
 assert.match(html,/id="retry-account-sync"/);
 const retry=inline.split("async function retryPendingCentralSync() {")[1].split("document.getElementById(\"retry-account-sync\").addEventListener")[0];
 assert.doesNotMatch(retry,/autoSendWithPdf\(/);
});
test('confirmação direta exige recibo de PDF e resumo, sem simular email enviado',async()=>{
 const a=inline.indexOf('async function persistGestaoInAutoImpulso(payload) {');
 const b=inline.indexOf('  function showGestaoAutoImpulsoConfirmed()',a);
 assert.ok(a>=0&&b>a);
 const fn=vm.runInNewContext(`(function(){ ${inline.slice(a,b)}; return persistGestaoInAutoImpulso })()`,{window:{ImpulsoAccountBridge:{active:true,started:true,
   saveReportPdf:async x=>({pdfAvailable:x==='PDFAQUI'}),
   saveMiniSummary:async x=>x.circunstancia===38.9&&x.importancia===31.5&&x.urgencia===29.6
 }}});
 const outcome=await fn({pdfBase64:'PDFAQUI',percCircunstancia:'38.9%',percImportancia:'31.5%',percUrgencia:'29.6%',perfil:'Planejamento'});
 assert.equal(outcome.autoImpulso,true);
 assert.equal(outcome.pdfAvailable,true);
 assert.equal(outcome.summarySaved,true);
 assert.equal(outcome.emailSent,undefined);
});
