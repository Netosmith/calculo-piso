import {stagingPage} from "./staging-page.js";

// Dedicated Cloudflare Access UI for this isolated staging Worker.
// It never asks the owner to paste an OIDC token into the browser.
function required(html,from,to){
  if(!html.includes(from))throw new Error("Staging UI out of sync: "+from.slice(0,70));
  return html.replace(from,to);
}
export function stagingPanelHtml(){
  let html=stagingPage;
  html=required(html,"const API_BASE = 'https://api.portalfrete.net.br';","const API_BASE = '';");
  html=required(html,"location.assign('home.html')","location.assign('https://portalfrete.net.br/pages/home.html')");
  html=required(html,'const canEdit=()=>Boolean(writeReady&&mfaActive&&selected&&selected.id!=="nova-frota");','const canEdit=()=>Boolean(writeReady&&selected&&selected.id!=="nova-frota");');
  html=required(html,"const canEditMembership=()=>Boolean(canEdit()&&membershipReady&&mfaMembershipActive);","const canEditMembership=()=>Boolean(canEdit()&&membershipReady);");
  html=required(html,"const canEditBrand=()=>Boolean(canEdit()&&brandReady&&mfaBrandActive);","const canEditBrand=()=>Boolean(canEdit()&&brandReady);");
  html=required(html,"$('newCompany').disabled=!(writeReady&&mfaActive);","$('newCompany').disabled=!writeReady;");
  html=required(html,"$('adminAuth').hidden=!writeReady;","$('adminAuth').hidden=true;");
  html=required(html,"writeReady?'requer validação MFA':'não configurada'","writeReady?'liberada pelo Cloudflare Access':'não configurada'");
  html=required(html,"const ROLES=[", "let credentialReady=false,credentialProblem=\'\';\nconst ROLES=[");
  html=required(html,
   "brandReady=Boolean(capabilities.brandWrite);",
   "brandReady=Boolean(capabilities.brandWrite);credentialReady=Boolean(capabilities.credentialWrite);credentialProblem=Array.isArray(capabilities.credentialMissing)&&capabilities.credentialMissing.length?\'Definir senha indisponível: estrutura D1 incompleta (\'+capabilities.credentialMissing.join(\', \')+\').\':\'\';");
  html=required(html,
   "if(companies.length){selected=companies[0];render();",
   "if(credentialProblem)notice(credentialProblem);if(companies.length){selected=companies[0];render();");
  html=required(html,
   "actions.append(role,status);row.append(actions);",
   "actions.append(role,status);if(credentialReady){const passwordButton=document.createElement('button');passwordButton.type='button';passwordButton.textContent='Definir senha';passwordButton.onclick=()=>setTenantPassword(u);actions.append(passwordButton);}row.append(actions);");
  const start=html.indexOf("async function writeRequest(");
  const end=html.indexOf("async function refreshCompanies(",start);
  if(start<0||end<=start)throw new Error("Staging write form markers missing");
  html=html.slice(0,start)+
    "async function writeRequest(path,method,data,contentType='application/json'){\n"+
    " return request(path,{method,headers:{'Content-Type':contentType},body:contentType==='application/json'?JSON.stringify(data):data});\n"+
    "}\n"+html.slice(end);
  // Password never enters a prompt, URL, localStorage or logs.
  const method=`async function setTenantPassword(user){
    if(!credentialReady||!canEditMembership()||!user?.id||!selected?.id)return;
    const tenant=selected.id;
    const overlay=document.createElement('div');
    overlay.style.cssText='position:fixed;inset:0;background:#000b;display:grid;place-items:center;z-index:9999;padding:16px';
    const panel=document.createElement('form');panel.style.cssText='background:#10283f;border:1px solid #4a7496;padding:24px;border-radius:14px;width:min(460px,100%)';
    const title=document.createElement('h2');title.textContent='Definir senha: '+user.id;
    const note=document.createElement('p');note.textContent='Esta senha será usada no portal separado desta transportadora. Mínimo 12 caracteres. As sessões anteriores serão encerradas.';
    const password=document.createElement('input');password.type='password';password.required=true;password.minLength=12;password.maxLength=128;
    password.autocomplete='new-password';password.placeholder='Nova senha (12 caracteres ou mais)';
    password.style.cssText='width:100%;padding:12px;background:#081a2d;color:white;border:1px solid #577d9a;border-radius:8px';
    const actions=document.createElement('div');actions.style.cssText='display:flex;gap:12px;justify-content:flex-end;margin-top:16px';
    const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancelar';
    cancel.onclick=()=>{password.value='';overlay.remove();};
    const save=document.createElement('button');save.type='submit';save.textContent='Salvar senha';
    actions.append(cancel,save);panel.append(title,note,password,actions);overlay.append(panel);document.body.append(overlay);
    password.focus();
    panel.onsubmit=async event=>{
      event.preventDefault();save.disabled=true;
      try{
        await writeRequest('/v1/super-admin/transportadoras/'+encodeURIComponent(tenant)+'/usuarios/'+encodeURIComponent(user.id)+'/credenciais','PUT',{senha:password.value});
        password.value='';overlay.remove();await loadAudit();
        notice('Senha configurada e sessões anteriores encerradas. Oriente o usuário a acessar o Portal Frete da transportadora.');
      }catch(error){writeError(error);password.value='';}
      finally{save.disabled=false;}
    };
  }
`;
  html=required(html,"async function editMembership(user,field){",method+"\nasync function editMembership(user,field){");
  return html;
}
