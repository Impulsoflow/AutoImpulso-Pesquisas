(function(){
"use strict";
const config=window.AUTOIMPULSO_SURVEY_CONFIG;
if(!config)return;
const $=id=>document.getElementById(id);
const options=config.options||[[0,"Nunca"],[1,"Raramente"],[2,"Às vezes"],[3,"Frequentemente"],[4,"Sempre"]];
let questions=[],answers=[],index=0,result=null;
function participant(){return {name:$("name").value.trim(),email:$("email").value.trim(),whatsapp:$("whatsapp").value.trim(),age:$("age").value.trim(),occupation:$("occupation").value.trim(),education:$("education").value.trim()};}
function validEmail(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);}
function esc(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}
function startTest(){
 const p=participant(),age=Number(p.age),error=$("start-error");error.textContent="";
 if(!p.name||!validEmail(p.email)||!p.whatsapp||!p.occupation||!p.education||!Number.isInteger(age)||age<10||age>120){error.textContent="Confira os dados complementares antes de iniciar.";return;}
 if(!window.ImpulsoResearchAccess){error.textContent="Abra esta pesquisa pelo portal AutoImpulso para validar sua conta.";return;}
 const button=$(config.startButtonId||"start-btn");
 window.ImpulsoResearchAccess.start({researchId:config.id,name:p.name,email:p.email,whatsapp:p.whatsapp,button,onAllowed:begin});
}
function begin(){questions=config.questions.map(q=>Object.assign({},q));if(config.randomize)questions.sort(()=>Math.random()-.5);answers=new Array(questions.length).fill(null);index=0;$("intro").hidden=true;$("quiz").hidden=false;renderQuestion();}
function renderQuestion(){
 const q=questions[index],answered=answers[index]!==null;
 $("progress-label").textContent="Pergunta "+(index+1)+" de "+questions.length;
 $("progress-fill").style.width=Math.round(index/questions.length*100)+"%";
 $("question-text").textContent=q.text;
 $("options").innerHTML=options.map(o=>'<button class="ai-option" type="button" aria-pressed="'+(answers[index]===o[0])+'"><strong>'+esc(o[0])+'</strong><small>'+esc(o[1])+"</small></button>").join("");
 Array.from($("options").querySelectorAll("button")).forEach((button,i)=>button.addEventListener("click",()=>selectAnswer(options[i][0])));
 $("back-btn").disabled=index===0;$("finish-btn").disabled=!(answered&&index===questions.length-1);
}
function selectAnswer(value){answers[index]=value;if(index<questions.length-1)window.setTimeout(()=>{index+=1;renderQuestion()},120);else renderQuestion();}
function previousQuestion(){if(index>0){index-=1;renderQuestion();}}
function groupValues(){
 const groups={};
 questions.forEach((q,i)=>{
  const max=options[options.length-1][0],min=options[0][0],raw=Number(answers[i]??min);
  const value=q.reverse?max-(raw-min):raw;
  (groups[q.dimension]||(groups[q.dimension]={sum:0,count:0})).sum+=value-min;
  groups[q.dimension].count+=1;
 });
 return groups;
}
function normalizeBars(groups){
 const keys=Object.keys(groups),raw=keys.map(k=>({label:k,value:groups[k].sum,maximum:groups[k].count*(options[options.length-1][0]-options[0][0]||1)}));
 return raw.map(x=>({label:x.label,value:Math.max(0,Math.min(100,Math.round((x.value/Math.max(1,x.maximum))*100))),maximum:100}));
}
function compute(){
 const groups=groupValues(),keys=Object.keys(groups);
 if(config.mode==="resiliencia"){
  const raw={Proativo:0,Reativo:0,Submisso:0};
  questions.forEach((q,i)=>{raw[q.dimension]+=Number(answers[i]||0);});
  const total=Object.values(raw).reduce((a,b)=>a+b,0)||1;
  const bars=Object.keys(raw).map(k=>({label:k,value:Math.round(raw[k]/total*100),maximum:100}));
  const leader=Object.keys(raw).sort((a,b)=>raw[b]-raw[a])[0];
  const tied=Object.values(raw).filter(v=>v===raw[leader]).length>1;
  return {raw,bars,headline:tied?"Sem predominância":leader,score:Math.round(bars.reduce((a,b)=>a+b.value,0)/bars.length)};
 }
 if(config.mode==="disc"){
  const rawBars=normalizeBars(groups),total=rawBars.reduce((a,b)=>a+b.value,0)||1,values=rawBars.map(x=>Math.round(x.value/total*100));
  values[values.length-1]=Math.max(0,100-values.slice(0,-1).reduce((a,b)=>a+b,0));
  const bars=rawBars.map((x,i)=>({label:x.label,value:values[i],maximum:100}));
  const high=Math.max(...values),leaders=bars.filter(x=>x.value===high);
  return {bars,headline:leaders.length===1?leaders[0].label+" "+high+"%":"Sem predominância",score:high};
 }
 if(config.mode==="gestao-tempo"){
  const sums=keys.map(k=>groups[k].sum),total=sums.reduce((a,b)=>a+b,0)||1;
  const bars=keys.map((k,i)=>({label:k,value:Number((sums[i]/total*100).toFixed(1)),maximum:100}));
  const leader=bars.reduce((a,b)=>b.value>a.value?b:a,bars[0]);
  return {bars,headline:leader.label+" em destaque",score:Math.round(leader.value)};
 }
 const bars=normalizeBars(groups),leader=bars.reduce((a,b)=>b.value>a.value?b:a,bars[0]);
 return {bars,headline:leader.label+" · "+leader.value+"%",score:Math.round(bars.reduce((a,b)=>a+b.value,0)/bars.length)};
}
function renderResult(){
 $("score").textContent=result.score+"%";$("profile-title").textContent=result.headline;
 $("profile-text").textContent=config.resultText||"Este resultado é uma leitura descritiva das respostas desta aplicação. Observe exemplos concretos e use as dimensões como convites a experimentar novos comportamentos.";
 $("bars").innerHTML=result.bars.map(x=>'<div><div class="ai-bar-head"><span>'+esc(x.label)+'</span><span>'+x.value+'%</span></div><div class="ai-bar-track"><span style="width:'+Math.max(0,Math.min(100,x.value))+'%"></span></div></div>').join("");
}
function buildPdf(){
 if(!window.jspdf||!window.jspdf.jsPDF)throw Error("Gerador de PDF indisponível.");
 const doc=new window.jspdf.jsPDF({unit:"mm",format:"a4"}),p=participant(),left=16;
 doc.setFillColor(11,94,168);doc.rect(0,0,210,26,"F");doc.setTextColor(255,255,255);doc.setFont("helvetica","bold");doc.setFontSize(16);doc.text("AutoImpulso — "+config.title,left,13);doc.setFont("helvetica","normal");doc.setFontSize(9);doc.text("Relatório educativo · aplicação autenticada",left,19);
 doc.setTextColor(22,50,75);doc.setFontSize(11);doc.setFont("helvetica","bold");doc.text("Participante",left,40);doc.setFont("helvetica","normal");doc.setFontSize(10);doc.text(p.name,left,47);doc.text(p.email,left,53);doc.text("Idade: "+p.age+" · "+p.occupation,left,59);doc.text("Escolaridade: "+p.education,left,65);
 doc.setFont("helvetica","bold");doc.setFontSize(25);doc.setTextColor(11,94,168);doc.text(result.score+"%",left,86);doc.setFontSize(11);doc.setTextColor(22,50,75);doc.text(result.headline,left,95);
 let y=115;doc.setFont("helvetica","bold");doc.text("Dimensões observadas",left,y);y+=10;
 result.bars.forEach(x=>{doc.setFont("helvetica","normal");doc.setFontSize(10);doc.setTextColor(22,50,75);doc.text(x.label,left,y);doc.text(x.value+"%",190,y,{align:"right"});doc.setFillColor(226,237,246);doc.roundedRect(left,y+3,178,5,2,2,"F");doc.setFillColor(11,94,168);doc.roundedRect(left,y+3,Math.max(2,178*x.value/100),5,2,2,"F");y+=16;if(y>260){doc.addPage();y=25;}});
 doc.setFontSize(8);doc.setTextColor(88,113,138);doc.text(config.disclaimer||"Instrumento educativo e descritivo; não constitui diagnóstico clínico.",left,282);
 return doc;
}
async function persist(){
 const bridge=window.ImpulsoAccountBridge;
 if(!bridge?.started){$("save-status").textContent="Resultado pronto. Retorne ao portal para concluir a aplicação autorizada.";return;}
 $("save-status").textContent="Salvando resultado e PDF na conta AutoImpulso…";
 try{
  const doc=buildPdf(),base64=doc.output("datauristring").split(",")[1];await bridge.saveReportPdf(base64);
  let saved=false;
  if(config.mode==="resiliencia")saved=await bridge.saveMiniSummary({proativo:result.raw.Proativo,reativo:result.raw.Reativo,submisso:result.raw.Submisso});
  else if(config.mode==="gestao-tempo"){const m=Object.fromEntries(result.bars.map(x=>[x.label,x.value]));saved=await bridge.saveMiniSummary({circunstancia:m.Circunstância,importancia:m.Importância,urgencia:m.Urgência,headline:result.headline});}
  else saved=await bridge.saveMiniSummary({summary:{headline:result.headline,bars:result.bars}});
  if(!saved)throw Error("O resumo não foi confirmado pela conta.");
  $("save-status").textContent="Resultado e PDF salvos na sua conta AutoImpulso.";
 }catch(error){$("save-status").textContent=error.message||"PDF pronto, mas o salvamento automático precisa ser repetido.";}
}
function finishTest(){if(answers.some(x=>x===null))return;result=compute();$("quiz").hidden=true;$("result").hidden=false;renderResult();persist();}
function downloadPdf(){try{buildPdf().save("AutoImpulso-"+config.id+"-"+participant().name.replace(/\s+/g,"_")+".pdf");}catch(error){$("save-status").textContent=error.message;}}
window.startTest=startTest;window.previousQuestion=previousQuestion;window.finishTest=finishTest;window.downloadPdf=downloadPdf;
window.__AUTOIMPULSO_SURVEY_RUNTIME__={config};
})();
