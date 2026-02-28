/* home-solicitacoes.js | NOVA FROTA (Home -> Solicitações via LocalStorage do Administrativo) */
(function(){
  "use strict";

  // ✅ mesma lista de filiais do Administrativo
  const FILIAIS = [
    "ITUMBIARA","RIO VERDE","JATAI","MINEIROS","CHAPADAO DO CEU","MONTIVIDIU",
    "INDIARA","BOM JESUS DE GO","VIANOPOLIS","ANAPOLIS","URUAÇU"
  ];

  // ✅ usa o MESMO storage do administrativo.js
  const LS_KEY_SOLIC = "nf_admin_solicitacoes_v1";

  const $ = (s)=>document.querySelector(s);

  function uid(){
    return "id_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
  }
  function upper(v){ return String(v ?? "").trim().toUpperCase(); }
  function safeText(v){ return String(v ?? "").trim(); }

  function todayBR(){
    const d = new Date();
    const dd = String(d.getDate()).padStart(2,"0");
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const yy = d.getFullYear();
    return `${dd}/${mm}/${yy}`;
  }

  function loadSolic(){
    try{
      const raw = localStorage.getItem(LS_KEY_SOLIC);
      if(!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    }catch{
      return [];
    }
  }
  function saveSolic(arr){
    try{ localStorage.setItem(LS_KEY_SOLIC, JSON.stringify(arr || [])); }catch{}
  }

  function openModal(){
    const modal = $("#homeSolicModal");
    if(!modal) return;
    modal.classList.add("isOpen");
    modal.setAttribute("aria-hidden","false");

    // defaults
    const d = $("#hsData");
    const s = $("#hsStatus");
    if(d && !d.value) d.value = todayBR();
    if(s && !s.value) s.value = "ABERTA";

    // solicitante
    const solicitante = $("#hsSolicitante");
    if(solicitante){
      const user = (window.getUser?.() || "").trim();
      solicitante.value = user ? user : "USUÁRIO";
    }
  }

  function closeModal(){
    const modal = $("#homeSolicModal");
    if(!modal) return;
    modal.classList.remove("isOpen");
    modal.setAttribute("aria-hidden","true");
  }

  function fillFiliais(){
    const sel = $("#hsFilial");
    if(!sel) return;
    sel.innerHTML = `<option value="">Selecione...</option>` + FILIAIS.map(f=>`<option value="${f}">${f}</option>`).join("");
  }

  function fillStatus(){
    const sel = $("#hsStatus");
    if(!sel) return;
    sel.innerHTML = `
      <option value="ABERTA">ABERTA</option>
      <option value="EM ANDAMENTO">EM ANDAMENTO</option>
      <option value="FINALIZADA">FINALIZADA</option>
    `;
  }

  function refreshKpi(){
    const arr = loadSolic();
    const abertas = arr.filter(x => upper(x.status) === "ABERTA").length;
    const el = $("#homeSolicOpen");
    if(el) el.textContent = String(abertas);
  }

  function sendSolic(){
    const filial = upper($("#hsFilial")?.value || "");
    const tipo = upper($("#hsTipo")?.value || "");
    const data = safeText($("#hsData")?.value || todayBR());
    const status = upper($("#hsStatus")?.value || "ABERTA");
    const obs = safeText($("#hsObs")?.value || "");
    const solicitante = safeText($("#hsSolicitante")?.value || (window.getUser?.() || "USUÁRIO"));

    if(!filial) return alert("Selecione a filial.");
    if(!tipo) return alert("Preencha o Tipo.");
    if(!obs) return alert("Escreva a observação.");

    const arr = loadSolic();

    // ✅ mesmo formato do administrativo (id/filial/tipo/observacao/status/data)
    arr.unshift({
      id: uid(),
      filial,
      tipo,
      observacao: obs,
      status,
      data,
      solicitante,
      createdAt: Date.now()
    });

    saveSolic(arr);

    // reset
    $("#hsFilial").value = "";
    $("#hsTipo").value = "";
    $("#hsObs").value = "";
    $("#hsStatus").value = "ABERTA";
    $("#hsData").value = todayBR();

    closeModal();
    refreshKpi();
    alert("Solicitação salva ✅ (já aparece no Administrativo)");
  }

  function bind(){
    $("#homeSolicCard")?.addEventListener("click", openModal);
    $("#homeSolicClose")?.addEventListener("click", closeModal);
    $("#homeSolicCancel")?.addEventListener("click", closeModal);
    $("#homeSolicSave")?.addEventListener("click", sendSolic);

    $("#homeSolicModal")?.addEventListener("click", (ev)=>{
      if(ev.target === $("#homeSolicModal")) closeModal();
    });
    document.addEventListener("keydown", (ev)=>{
      if(ev.key === "Escape") closeModal();
    });
  }

  window.addEventListener("DOMContentLoaded", ()=>{
    fillFiliais();
    fillStatus();
    refreshKpi();
    bind();
    setInterval(refreshKpi, 30000);
  });
})();
