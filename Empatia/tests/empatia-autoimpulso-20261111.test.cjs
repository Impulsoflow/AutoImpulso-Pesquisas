const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../empatia-360.html'),'utf8');
const scripts=[...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const app=scripts.find(x=>x.includes('async function transmitAutomaticResult'));
function simulate(account){
 const nodes=new Map(); const eventLog=[];
 function node(id){if(!nodes.has(id)){
  const classes=new Set(['hidden']);
  nodes.set(id,{id,value:'',dataset:{},style:{},textContent:'',classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)},addEventListener(){},setAttribute(){},focus(){}});
 }return nodes.get(id)}
 const context={
  document:{getElementById:node,querySelector(){return null},querySelectorAll(){return []}},
  window:{ImpulsoAccountBridge:account,addEventListener(){},scrollTo(){},innerWidth:1200},
  console:{log(){},warn(){},error(){}},
  setTimeout(){return 1},clearTimeout(){},Math,Date,Promise,Number,String,Array,Error,JSON,RegExp,
 };
 vm.createContext(context);
 vm.runInContext(app,context,{timeout:2000});
 vm.runInContext(`reportData={person:{name:'Teste Portal',email:'teste@example.org',whatsapp:'11999999999',age:'30',profession:'Analista',education:'Superior Completo'},teq:35,dims:[12,10,9,11,13]};savedPdfObject={filename:'Empatia360_teste.pdf',doc:{output:()=> 'data:application/pdf;base64,' + 'A'.repeat(2400)}};ANSWERS.fill(2);`,context);
 return {context,nodes,eventLog,run:()=>vm.runInContext('transmitAutomaticResult()',context)};
}
test('HTML/JavaScript da Empatia 360 é válido e preserva o questionário de 36 itens',()=>{
 assert.ok(app);
 scripts.filter(Boolean).forEach((s,i)=>assert.doesNotThrow(()=>new vm.Script(s,{filename:'empatia-inline-'+i+'.js'})));
 assert.match(source,/Array\(36\)\.fill\(null\)/);
 assert.match(source,/const TEQ_QUESTIONS = \[/);
 assert.match(source,/const EXT_QUESTIONS = \[/);
 assert.match(source,/if\(!CONFIG.resultEndpoint&&!window.ImpulsoAccountBridge\?\.active\)/);
});
test('registro primeiro no ADM, PDF integral depois, e-mail não é declarado enviado sem recibo',async()=>{
 const calls=[];
 const account={active:true,started:true,researchId:'empatia-360',
  async saveMiniSummary(summary){calls.push(['summary',summary]);return true},
  async saveReportPdf(data){calls.push(['pdf',data]);return {ok:true,pdfAvailable:true}}};
 const sim=simulate(account);await sim.run();
 assert.deepEqual(calls.map(x=>x[0]),['summary','pdf']);
 assert.equal(calls[0][1].bars.length,5);
 assert.deepEqual(Array.from(calls[0][1].bars.map(x=>x.value)),[12,10,9,11,13]);
 assert.match(sim.nodes.get('delivery-message').textContent,/e-mail depende de confirmação separada/);
 assert.equal(sim.nodes.get('delivery-panel').dataset.kind,'pending');
 await sim.run();assert.equal(calls.length,2,'repetição após sucesso não cria nova submissão');
});
test('falha de PDF mantém o mesmo relatório para tentativa idempotente sem reaplicar as 36 questões',async()=>{
 const calls=[];
 let failing=true;
 const account={active:true,started:true,researchId:'empatia-360',
  async saveMiniSummary(summary){calls.push(['summary',summary]);return true},
  async saveReportPdf(data){calls.push(['pdf',data]);if(failing)throw Error('simulated network failure');return {pdfAvailable:true}}};
 const sim=simulate(account);
 await sim.run();
 assert.equal(sim.nodes.get('delivery-panel').dataset.kind,'error');
 assert.equal(sim.nodes.get('retry-send-btn').classList.contains('hidden'),false);
 const samePayload=vm.runInContext('currentSubmissionId',sim.context);
 failing=false;await sim.run();
 assert.equal(vm.runInContext('currentSubmissionId',sim.context),samePayload);
 assert.deepEqual(calls.map(x=>x[0]),['summary','pdf','summary','pdf']);
 assert.equal(sim.nodes.get('delivery-panel').dataset.kind,'pending');
});
test('conta que não iniciou não salva resultado ou PDF',async()=>{
 const calls=[];
 const sim=simulate({active:true,started:false,researchId:'empatia-360',
  saveMiniSummary:async()=>calls.push('summary'),saveReportPdf:async()=>calls.push('pdf')});
 await sim.run();assert.deepEqual(calls,[]);
 assert.equal(sim.nodes.get('delivery-panel').dataset.kind,'error');
});
test('preço, autorização e entrega são descritos conforme a Central, sem prometer gratuidade nem PDF anexado',()=>{
 for(const phrase of ['Pix de R$ 35,00','Primeira aplicação gratuita','a primeira aplicação é gratuita','relatório em PDF por e-mail'])assert.equal(source.includes(phrase),false,phrase);
 assert.match(source,/A Central AUTOIMPULSO verifica a autorização da sua conta/);
 assert.match(source,/relatório PDF será arquivado na conta/);
 assert.match(source,/a notificação por e-mail será confirmada separadamente/);
});
