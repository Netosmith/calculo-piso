// Shared private-entry login for Portal Frete transportadoras.
// A tenant's path provides a fixed login context, never data authorization.
// The signed API session remains the only source of permissions and company data.
(function(){
  "use strict";
  const tenantId=document.body.dataset.tenantId||"";
  const form=document.getElementById("tenantLoginForm");
  const user=document.getElementById("user");
  const pass=document.getElementById("pass");
  const button=document.getElementById("btnLogin");
  const errorBox=document.getElementById("err");
  if(!form || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(tenantId))return;

  function showError(message){
    errorBox.textContent=message||"Não foi possível entrar.";
    errorBox.hidden=false;
    errorBox.style.display="block";
  }
  function hideError(){errorBox.hidden=true;errorBox.style.display="none";}
  function saveReturnPath(){
    // Never accept a tenant or return path from search params or untrusted redirects.
    const path=location.pathname;
    if(/^\/pages\/[a-z0-9-]{3,64}\/login\.html$/.test(path)){
      try{sessionStorage.setItem("pf:tenant-login-path",path);}catch(_){}
    }
  }
  async function existingSession(){
    try{
      const result=await window.PortalAPI.session();
      const session=result?.session;
      if(session?.tenantMode===true && session.transportadoraId===tenantId){
        saveReturnPath();
        window.location.replace("./home.html");
      }
    }catch(_){/* Sem sessão ativa. */}
  }
  form.addEventListener("submit",async(event)=>{
    event.preventDefault();hideError();
    const usuario=(user.value||"").trim();
    const senha=pass.value||"";
    if(!usuario||!senha){showError("Informe usuário e senha.");return;}
    button.disabled=true;button.textContent="Validando...";
    try{
      const result=await window.PortalAPI.login(usuario,senha,tenantId);
      const session=result?.session;
      if(session?.tenantMode!==true||session?.transportadoraId!==tenantId){
        throw new Error("Sessão de transportadora inválida.");
      }
      if(typeof window.mirrorServerSession==="function")window.mirrorServerSession(session);
      else{
        // auth.js also exposes this function in the script global scope
        mirrorServerSession(session);
      }
      saveReturnPath();
      pass.value="";
      window.location.replace("./home.html");
    }catch(error){
      showError(error?.message||"Usuário ou senha inválidos.");
    }finally{
      button.disabled=false;button.textContent="Entrar";
    }
  });
  // Avoid changing the brand's shared Home or running a second login flow.
  void existingSession();
})();
