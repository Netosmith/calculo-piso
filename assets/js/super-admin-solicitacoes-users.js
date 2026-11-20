/* Super Admin > Perfis e Acessos: SOLICITAÇÕES por login e por transportadora. */
(function(){
 "use strict";
 const $=id=>document.getElementById(id);
 if(!$("solicUsersList"))return;
 const labels={
  "solicitacao-pedidos":"Solicitações / Chamados",
  "execucao-pedidos":"Execução de Solicitações / Chamados",
  "cadastro-solicitacoes":"Solicitação de Cadastro",
  "execucao-cadastros":"Execução de Cadastro",
  "solicitacao-troca-notas":"Solicitação de Troca de Notas",
  "execucao-troca-notas":"Execução de Troca de Notas"
 };
 const defaults=["solicitacao-pedidos","execucao-pedidos"];
 let all=Object.keys(labels);
 let loaded="",users={},dirty=false,saving=false,serial=0;
 const tenant=()=>selected?.id||"";
 const editable=()=>typeof canEditModules==="function"&&canEditModules();
 const status=message=>{$("solicUsersStatus").textContent=message;};
 function syncAvailable(keys){
  const root=$("solicUserModules");
  const known=new Set([...root.querySelectorAll("[data-solic-module]")].map(x=>x.dataset.solicModule));
  const companyModuleLabels=new Map((typeof MODULES!=="undefined"?MODULES:[]).map(([key,name])=>[key,name]));
  for(const key of keys){
   if(known.has(key))continue;
   labels[key]=companyModuleLabels.get(key)||key;
   const line=document.createElement("label");
   const checkbox=document.createElement("input");checkbox.type="checkbox";checkbox.dataset.solicModule=key;
   line.append(checkbox,document.createTextNode(" "+labels[key]));root.append(line);
  }
  all=[...keys];
 }
 function setChecked(modules){
  const selectedKeys=new Set(modules);
  document.querySelectorAll("[data-solic-module]").forEach(el=>{
   el.checked=selectedKeys.has(el.dataset.solicModule);
  });
 }
 function getChecked(){
  return [...document.querySelectorAll("[data-solic-module]:checked")].map(x=>x.dataset.solicModule);
 }
 function refreshButtons(){
  $("solicUserAssign").disabled=!loaded||!editable()||saving;
  $("solicUsersSave").disabled=!dirty||!loaded||!editable()||saving;
 }
 function draw(){
  const list=$("solicUsersList");list.replaceChildren();
  const people=Object.entries(users).sort(([a],[b])=>a.localeCompare(b));
  if(!people.length)list.append(document.createTextNode("Nenhum usuário deste perfil configurado."));
  for(const [name,modules] of people){
   const row=document.createElement("div");row.className="ped-exec-user";
   const summary=document.createElement("span");
   summary.textContent=name+" · "+modules.map(x=>labels[x]||x).join(", ");
   const button=document.createElement("button");
   button.type="button";button.className="ghost";button.textContent="Editar";
   button.onclick=()=>{$("solicUserName").value=name;setChecked(modules);status("Editando os acessos de "+name+".");};
   const remove=document.createElement("button");
   remove.type="button";remove.className="ghost";remove.textContent="Retirar perfil";
   remove.disabled=!editable()||saving;
   remove.onclick=()=>{
    if(!window.confirm("Retirar de "+name+" o perfil SOLICITAÇÕES nesta transportadora?"))return;
    delete users[name];dirty=true;draw();
    status("Remoção de "+name+" pendente. Clique em Salvar para aplicar.");
   };
   row.append(summary,button,remove);list.append(row);
  }
  refreshButtons();
 }
 async function reload(){
  const company=tenant(),id=++serial;
  loaded="";users={};dirty=false;setChecked(defaults);draw();
  if(!company)return status("Selecione uma transportadora.");
  status("Consultando acesso individual de "+company+"...");
  try{
   const data=await request("/v1/super-admin/transportadoras/"+
    encodeURIComponent(company)+"/solicitacoes-user-access");
   if(id!==serial||company!==tenant())return;
   if(!data?.usuarios||!Array.isArray(data.modules))throw Error("Configuração inválida.");
   syncAvailable(data.modules);
   users=Object.fromEntries(Object.entries(data.usuarios).map(([key,record])=>[key,record.modules||[]]));
   loaded=company;dirty=false;draw();
   status(data.configured?
    "Acessos individuais carregados. Atribua os módulos e salve para aplicar.":
    "Nenhuma personalização ainda. O novo perfil começa com Solicitações / Chamados e Execução.");
  }catch(e){if(id===serial)status("Não foi possível consultar os acessos: "+(e.message||"erro"));}
 }
 $("solicUserAssign").onclick=()=>{
  if(!editable()||!loaded||loaded!==tenant())return;
  const login=$("solicUserName").value.trim().toUpperCase();
  if(!/^[A-Z0-9][A-Z0-9._-]{1,79}$/.test(login))
   return status("Informe um login válido, por exemplo GEOVANNA.");
  const selectedModules=getChecked();
  if(!selectedModules.length)return status("Marque ao menos um módulo de solicitação ou execução.");
  users[login]=all.filter(x=>selectedModules.includes(x));
  dirty=true;draw();status("Acessos de "+login+" preparados. Clique em Salvar acessos dos usuários.");
 };
 $("solicUsersSave").onclick=async()=>{
  const company=tenant();
  if(!editable()||!loaded||loaded!==company||!dirty||saving)return;
  saving=true;refreshButtons();status("Gravando acessos individuais...");
  try{
   const result=await writeRequest("/v1/super-admin/transportadoras/"+
    encodeURIComponent(company)+"/solicitacoes-user-access","PUT",{usuarios:users});
   if(company!==tenant())return;
   if(result?.configured!==true||!result.usuarios)throw Error("Gravação não confirmada.");
   users=Object.fromEntries(Object.entries(result.usuarios).map(([key,record])=>[key,record.modules||[]]));
   dirty=false;draw();
   status("Permissões salvas. Cada usuário verá somente os módulos atribuídos e habilitados para sua transportadora.");
   if(typeof notice==="function")notice("Perfil SOLICITAÇÕES atualizado para "+(selected?.name||company)+".");
  }catch(e){status("Erro ao salvar: "+(e.message||"indisponível"));}
  finally{saving=false;refreshButtons();}
 };
 document.querySelector('[data-tab="profiles"]')?.addEventListener("click",()=>{
  if(loaded!==tenant())void reload();
 });
 window.addEventListener("superadmin:company-changed",()=>void reload());
 setChecked(defaults);
 draw();
})();