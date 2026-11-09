/* Nova Frota | bloqueio complementar por módulo.
   O PIN não fica no HTML ou no JavaScript público, somente no Worker. */
(()=>{
"use strict";
const API="https://api.portalfrete.net.br/v1/module-pin";
const MODULES={funcionarios:"Funcionários","custo-filial":"Custo / Filial","custo-frota":"Cálculo Frota"};
let modal=null,busy=false;
const css=document.createElement("style");
css.textContent=[
 "html.pf-pin-locked body > :not(#pfModulePinModal){visibility:hidden!important;pointer-events:none!important}",
 "#pfModulePinModal{position:fixed;inset:0;z-index:2147483640;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(6,23,42,.91);backdrop-filter:blur(7px);font-family:Inter,Arial,sans-serif;box-sizing:border-box}",
 "#pfModulePinModal[hidden]{display:none!important}",
 "#pfModulePinModal *{box-sizing:border-box}",
 ".pf-pin-card{width:min(430px,100%);padding:30px 26px;border:1px solid #c8dbed;border-radius:20px;background:#fff;color:#173c64;box-shadow:0 24px 80px rgba(0,0,0,.25)}",
 ".pf-pin-lock{width:54px;height:54px;border-radius:16px;margin:0 auto 15px;display:flex;align-items:center;justify-content:center;font-size:27px;background:#e8f3ff;color:#0d5489}",
 ".pf-pin-card h2{font-size:22px;text-align:center;margin:0 0 8px;font-weight:800;color:#103b67}",
 ".pf-pin-card p{font-size:13px;line-height:1.55;color:#526d83;margin:0 0 18px;text-align:center}",
 ".pf-pin-card label{font-size:12px;color:#24577a;font-weight:800;display:block;margin-bottom:7px}",
 "#pfPinInput{width:100%;height:52px;border:1px solid #b7cddd;border-radius:11px;font-size:22px;letter-spacing:.22em;text-align:center;color:#173a61;background:#fff}",
 "#pfPinInput:focus{outline:3px solid #b8defb;border-color:#3986bb}",
 ".pf-pin-actions{display:flex;gap:9px;margin-top:13px}",
 ".pf-pin-actions button{flex:1;min-width:0;text-align:center;border:0;border-radius:11px;padding:12px 10px;font-size:13px;font-weight:850;cursor:pointer}",
 "#pfPinSubmit{background:#0876bc;color:#fff}#pfPinCancel{background:#eaf2f8;color:#2c5776}",
 "#pfPinError{min-height:22px;color:#af3046;font-size:12px;margin-top:10px;text-align:center;font-weight:700}",
 ".pf-pin-note{font-size:11px!important;margin-top:12px!important;color:#698096!important}"
].join("");
document.head.append(css);
async function request(endpoint,options={}){
  const response=await fetch(API+endpoint,{credentials:"include",cache:"no-store",...options,
    headers:{"Accept":"application/json",...(options.headers||{})}});
  const body=await response.json().catch(()=>({ok:false}));
  if(!response.ok||body.ok!==true)throw Error(body.error||"Falha na verificação de acesso.");
  return body;
}
async function unlocked(module){
  if(!Object.hasOwn(MODULES,module))return false;
  return (await request("/status?module="+encodeURIComponent(module))).unlocked===true;
}
async function unlock(module,pin){
  if(!Object.hasOwn(MODULES,module))throw Error("Módulo não reconhecido.");
  return request("/unlock",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({module,pin})});
}
function ensureModal(){
  if(modal)return modal;
  modal=document.createElement("div");modal.id="pfModulePinModal";
  modal.hidden=true;modal.setAttribute("role","dialog");
  modal.setAttribute("aria-modal","true");modal.setAttribute("aria-labelledby","pfPinTitle");
  modal.innerHTML=[
    '<div class="pf-pin-card">',
      '<div class="pf-pin-lock" aria-hidden="true">🔒</div>',
      '<h2 id="pfPinTitle">Acesso protegido</h2>',
      '<p id="pfPinText">Informe a senha para abrir o módulo.</p>',
      '<form id="pfPinForm" autocomplete="off">',
        '<label for="pfPinInput">Senha de acesso</label>',
        '<input id="pfPinInput" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required autocomplete="off" aria-describedby="pfPinError">',
        '<div class="pf-pin-actions">',
          '<button type="submit" id="pfPinSubmit">Liberar acesso</button>',
          '<button type="button" id="pfPinCancel">Cancelar</button>',
        '</div>',
        '<div id="pfPinError" role="alert" aria-live="polite"></div>',
      '</form>',
      '<p class="pf-pin-note">Além da senha, seu perfil precisa ter permissão para este módulo.</p>',
    '</div>'
  ].join("");
  document.body.append(modal);return modal;
}
function promptPin(module,{page=false}={}){
  return new Promise(resolve=>{
    const ui=ensureModal();ui.hidden=false;
    const form=ui.querySelector("#pfPinForm"),input=ui.querySelector("#pfPinInput"),
      error=ui.querySelector("#pfPinError"),submit=ui.querySelector("#pfPinSubmit"),
      cancel=ui.querySelector("#pfPinCancel");
    ui.querySelector("#pfPinTitle").textContent=MODULES[module];
    ui.querySelector("#pfPinText").textContent="Informe a senha para acessar "+MODULES[module]+".";
    input.value="";error.textContent="";
    const complete=ok=>{form.onsubmit=null;cancel.onclick=null;ui.hidden=true;resolve(ok);};
    cancel.onclick=()=>{complete(false);if(page)location.replace("./home.html");};
    form.onsubmit=async ev=>{
      ev.preventDefault();if(busy)return;
      if(!/^[0-9]{4}$/.test(input.value)){error.textContent="Informe os 4 dígitos.";return;}
      busy=true;submit.disabled=true;cancel.disabled=true;error.textContent="";
      try{await unlock(module,input.value);input.value="";complete(true);}
      catch(e){input.value="";error.textContent=e.message||"Senha incorreta.";input.focus();}
      finally{busy=false;submit.disabled=false;cancel.disabled=false;}
    };
    requestAnimationFrame(()=>input.focus());
  });
}
async function authorize(module,{page=false}={}){
  if(!Object.hasOwn(MODULES,module))return false;
  const session=window.portalAuthReady?await Promise.resolve(window.portalAuthReady).catch(()=>null):null;
  if(!session||session.tenantMode===true){
    if(page)location.replace("./home.html");return false;
  }
  try{if(await unlocked(module))return true;}
  catch(e){
    if(page){
      const ui=ensureModal();ui.hidden=false;
      ui.querySelector("#pfPinTitle").textContent="Acesso indisponível";
      ui.querySelector("#pfPinText").textContent=e.message;
      ui.querySelector("#pfPinForm").hidden=true;
      const cancel=document.createElement("a");cancel.href="./home.html";
      cancel.textContent="Voltar à Home";
      cancel.style.cssText="display:block;text-align:center;padding:12px;color:#0876bc;font-weight:800";
      ui.querySelector(".pf-pin-card").append(cancel);
    }else alert(e.message);
    return false;
  }
  return promptPin(module,{page});
}
function guardPage(module){
  if(!Object.hasOwn(MODULES,module))return;
  document.documentElement.classList.add("pf-pin-locked");
  const run=async()=>{
    let hasGrant=false;
    try{hasGrant=await unlocked(module);}catch{}
    const permitted=await authorize(module,{page:true}).catch(()=>false);
    if(!permitted)return;
    if(!hasGrant){location.reload();return;}
    document.documentElement.classList.remove("pf-pin-locked");
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",run,{once:true});
  else run();
}
function bindHomeCards(){
  document.querySelectorAll('a.nf-tool[data-feature="funcionarios"],a.nf-tool[data-feature="custo-filial"],a.nf-tool[data-feature="custo-frota"]')
  .forEach(card=>card.addEventListener("click",async event=>{
    if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return;
    event.preventDefault();
    const module=card.dataset.feature;
    if(typeof canAccessFeature==="function"&&!canAccessFeature(module)){
      alert("Módulo não disponível para seu perfil.");return;
    }
    const permitted=await authorize(module).catch(err=>{alert(err.message);return false;});
    if(permitted)location.assign(card.href);
  }));
}
window.PortalModulePin={guardPage,bindHomeCards,authorize,unlocked,unlock};
})();
