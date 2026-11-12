/* Editor de acessos por perfil, visível somente após /v1/super-admin/me. */
(function(){
 "use strict";
 const $=id=>document.getElementById(id);
 const roleNames={
  ADMINISTRADOR:"ADMINISTRADOR",
  COMERCIAL:"COMERCIAL",
  OPERACIONAL:"OPERACIONAL",
  GOADM:"GOADM",
  PISO:"PISO"
 };
 let loadedFor="", requestNumber=0, currentRole="OPERACIONAL";
 let profiles=null, defaults=null, registry=null, dirty=false, saving=false;
 const adminCanEdit=()=>typeof canEditModules==="function"&&canEditModules();
 const tenant=()=>typeof selected==="object"&&selected?.id||"";
 const rowNames=()=>{
  const extras=tenant()==="nova-frota"
   ?[["fretes2","Fretes MT (exclusivo Nova Frota)"],
     ["funcionarios","Funcionários (exclusivo Nova Frota)"],
     ["relatorio","Relatório (exclusivo Nova Frota)"]]:[];
  return [...MODULES,...extras];
 };
 function status(text){const el=$("profileAccessStatus");if(el)el.textContent=text;}
 function editable(key){
  return currentRole!=="ADMINISTRADOR"&&
   !(currentRole==="PISO"&&key!=="piso2")&&
   !(currentRole==="COMERCIAL"&&["cadastros","funcionarios"].includes(key));
 }
 function render(){
  const container=$("profileModuleGrid");if(!container)return;
  container.replaceChildren();
  $("profileRole").value=currentRole;
  $("profileRoleHelp").textContent={
   ADMINISTRADOR:"Recebe automaticamente TODOS os módulos liberados para esta transportadora. Somente o Super Admin pode alterar a liberação global.",
   COMERCIAL:"Por padrão acessa todos os módulos liberados, exceto Cadastro e Funcionários. Você pode desmarcar outros módulos.",
   OPERACIONAL:"Selecione os módulos usados na operação. Fretes por estado podem ser habilitados separadamente.",
   GOADM:"Por padrão, somente Administrativo. Outros cards só aparecem se forem selecionados explicitamente aqui.",
   PISO:"Restrição permanente: somente Piso 2 (ANTT). O restante da Home e os dados operacionais continuam ocultos."
  }[currentRole]||"";
  const enabled=new Set(selected?.modules||[]);
  const userModules=new Set(profiles?.[currentRole]||[]);
  for(const [key,label] of rowNames()){
   const item=document.createElement("label");
   item.className="profile-access-item";
   const checkbox=document.createElement("input");
   checkbox.type="checkbox";checkbox.checked=userModules.has(key);
   checkbox.disabled=!adminCanEdit()||!editable(key)||!profiles||saving;
   checkbox.dataset.profileModule=key;
   const description=document.createElement("span");
   description.className="profile-access-item-title";
   description.textContent=label;
   const global=document.createElement("small");
   global.className=enabled.has(key)?"profile-access-enabled":"profile-access-disabled";
   global.textContent=enabled.has(key)?"Módulo habilitado na empresa":"Módulo desativado em Cards e módulos";
   description.append(global);
   item.append(checkbox,description);container.append(item);
   checkbox.addEventListener("change",()=>{
    if(!profiles)return;
    const set=new Set(profiles[currentRole]||[]);
    if(checkbox.checked)set.add(key);else set.delete(key);
    profiles[currentRole]=[...set];
    dirty=true;
    status("Alterações não salvas. Clique em Salvar perfis e acessos.");
    updateButtons();
   });
  }
  updateButtons();
 }
 function updateButtons(){
  const working=!adminCanEdit()||!profiles||saving;
  $("saveProfileAccess").disabled=working||!dirty;
  $("resetProfileAccess").disabled=working||currentRole==="ADMINISTRADOR";
  $("allowProfileAll").disabled=working||currentRole==="ADMINISTRADOR";
  $("denyProfileAll").disabled=working||currentRole==="ADMINISTRADOR";
 }
 function changeRole(){
  currentRole=$("profileRole").value;
  render();
 }
 $("profileRole").addEventListener("change",changeRole);
 async function reload(){
  if(!tenant())return;
  const company=tenant(),serial=++requestNumber;
  loadedFor="";profiles=null;defaults=null;registry=null;dirty=false;
  status("Carregando permissões de "+(selected?.name||"transportadora")+"...");
  render();
  try{
   const data=await request("/v1/super-admin/transportadoras/"+encodeURIComponent(company)+"/profile-access");
   if(serial!==requestNumber||tenant()!==company)return;
   if(!data?.profiles||!data?.defaults||!Array.isArray(data?.modules))
    throw Error("Resposta de acessos inválida.");
   profiles=structuredClone(data.profiles);
   defaults=structuredClone(data.defaults);
   registry=new Set(data.modules);
   loadedFor=company;
   status(data.configured?"Permissões personalizadas salvas no servidor.":"Perfis padrão carregados. Ajuste os módulos e salve quando desejar.");
   render();
  }catch(error){
   if(serial!==requestNumber||tenant()!==company)return;
   profiles=null;status("Não foi possível consultar permissões: "+(error.message||"erro"));
   render();
  }
 }
 $("resetProfileAccess").addEventListener("click",()=>{
  if(!profiles||!defaults||!adminCanEdit())return;
  profiles[currentRole]=[...(defaults[currentRole]||[])];
  dirty=true;render();status("Padrão do perfil "+currentRole+" recuperado. Clique em Salvar para aplicar.");
 });
 function setRoleAll(allow){
  if(!profiles||!registry||!adminCanEdit())return;
  profiles[currentRole]=rowNames().map(([key])=>key).filter(key=>
   registry.has(key)&&editable(key)&&(allow||false));
  dirty=true;render();status("Seleção de "+currentRole+" alterada. Clique em Salvar para aplicar.");
 }
 $("allowProfileAll").addEventListener("click",()=>setRoleAll(true));
 $("denyProfileAll").addEventListener("click",()=>setRoleAll(false));
 $("saveProfileAccess").addEventListener("click",async()=>{
  if(!profiles||!adminCanEdit()||!dirty||saving||loadedFor!==tenant())return;
  const company=tenant();
  saving=true;updateButtons();status("Gravando a matriz de perfis no servidor...");
  try{
   const saved=await writeRequest("/v1/super-admin/transportadoras/"+
    encodeURIComponent(company)+"/profile-access","PUT",{profiles});
   if(tenant()!==company)return;
   if(!saved?.configured||!saved?.profiles)throw Error("A gravação não foi confirmada.");
   profiles=structuredClone(saved.profiles);
   dirty=false;
   status("Perfis salvos para "+(selected?.name||company)+". Novas sessões e atualizações de página usam estas permissões.");
   if(typeof notice==="function")notice("Permissões por perfil gravadas no servidor para "+(selected?.name||company)+".");
   render();
   if(typeof loadAudit==="function")void loadAudit();
  }catch(error){status(error?.message||"Erro ao salvar perfis.");}
  finally{saving=false;updateButtons();}
 });
 document.querySelector('[data-tab="profiles"]')?.addEventListener("click",()=>{
  if(loadedFor!==tenant()||!profiles)void reload();
 });
 window.addEventListener("superadmin:company-changed",()=>{
  loadedFor="";profiles=null;dirty=false;
  if(!$("profiles")?.hidden)void reload();
  else{status("Selecione a aba Perfis e Acessos para carregar a transportadora.");render();}
 });
})();