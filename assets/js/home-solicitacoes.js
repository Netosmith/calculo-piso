// =====================================================
// home-solicitacoes.js | PORTAL FRETE
// Solicitações da Home via Cloudflare Worker
// =====================================================
(function(){
  "use strict";

  const FILIAIS = [
    "ITUMBIARA","RIO VERDE","JATAI","MINEIROS","CHAPADAO DO CEU","MONTIVIDIU",
    "INDIARA","BOM JESUS DE GO","VIANOPOLIS","ANAPOLIS","URUAÇU","FORMOSA",
    "ARAGUARI","CRISTALINA","UBERLANDIA"
  ];

  const $ = (selector) => document.querySelector(selector);

  function upper(value){
    return String(value ?? "").trim().toUpperCase();
  }

  function safeText(value){
    return String(value ?? "").trim();
  }

  function todayBR(){
    const date = new Date();
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}/${date.getFullYear()}`;
  }

  async function portalCall(action, params = {}){
    const api = typeof ensurePortalApi === "function"
      ? await ensurePortalApi()
      : window.PortalAPI;

    if(!api){
      throw new Error("API segura do Portal indisponível.");
    }

    return api.call("administrativo", action, {
      ...params,
      resource: "solicitacoes"
    });
  }

  function ensureLoading(){
    if(document.getElementById("homeSolicLoading")) return;

    const element = document.createElement("div");
    element.id = "homeSolicLoading";
    element.innerHTML = `
      <div class="homeSolicLoadingBox">
        <div class="homeSolicSpinner"></div>
        <div class="homeSolicLoadingText">Salvando solicitação...</div>
      </div>
    `;
    document.body.appendChild(element);

    const style = document.createElement("style");
    style.id = "homeSolicLoadingStyle";
    style.textContent = `
      #homeSolicLoading{
        position:fixed; inset:0; display:none; align-items:center; justify-content:center;
        background:rgba(3,8,20,.58); backdrop-filter:blur(8px); z-index:10050;
      }
      #homeSolicLoading.isOpen{display:flex}
      .homeSolicLoadingBox{
        width:min(280px,88vw); padding:28px 20px; border-radius:22px;
        border:1px solid rgba(255,255,255,.14); background:rgba(17,26,51,.92);
        box-shadow:0 22px 60px rgba(0,0,0,.42); display:flex; flex-direction:column;
        align-items:center; gap:16px;
      }
      .homeSolicSpinner{
        width:58px; height:58px; border-radius:999px;
        border:5px solid rgba(255,255,255,.10); border-top-color:rgba(79,209,255,.95);
        border-right-color:rgba(79,209,255,.65); animation:homeSolicSpin .8s linear infinite;
      }
      .homeSolicLoadingText{color:#e9eefc;font-size:15px;font-weight:800;text-align:center}
      @keyframes homeSolicSpin{to{transform:rotate(360deg)}}
    `;
    document.head.appendChild(style);
  }

  function showLoading(){
    ensureLoading();
    $("#homeSolicLoading")?.classList.add("isOpen");
  }

  function hideLoading(){
    $("#homeSolicLoading")?.classList.remove("isOpen");
  }

  function fillFiliais(){
    const select = $("#hsFilial");
    if(!select) return;

    select.innerHTML = `<option value="">Selecione...</option>` +
      FILIAIS.map(filial => `<option value="${filial}">${filial}</option>`).join("");
  }

  function resetForm(){
    const user = upper(window.getUser?.() || "USUÁRIO");

    if($("#hsFilial")) $("#hsFilial").value = "";
    if($("#hsTipo")) $("#hsTipo").value = "";
    if($("#hsData")) $("#hsData").value = todayBR();
    if($("#hsStatus")) $("#hsStatus").value = "ABERTA";
    if($("#hsObs")) $("#hsObs").value = "";
    if($("#hsSolicitante")) $("#hsSolicitante").value = user;
  }

  function openModal(){
    const modal = $("#homeSolicModal");
    if(!modal) return;

    modal.classList.add("isOpen");

    if($("#hsData") && !safeText($("#hsData").value)) $("#hsData").value = todayBR();
    if($("#hsStatus") && !safeText($("#hsStatus").value)) $("#hsStatus").value = "ABERTA";
    if($("#hsSolicitante")) $("#hsSolicitante").value = upper(window.getUser?.() || "USUÁRIO");
  }

  function closeModal(){
    $("#homeSolicModal")?.classList.remove("isOpen");
  }

  async function refreshKpi(){
    try{
      const api = typeof ensurePortalApi === "function"
        ? await ensurePortalApi()
        : window.PortalAPI;

      if(!api){
        throw new Error("API segura do Portal indisponível.");
      }

      const result = await api.call("home", "read");
      const abertas = Math.max(0, Number(result.data?.solicitacoes) || 0);

      if($("#homeSolicOpen")) $("#homeSolicOpen").textContent = String(abertas);
      if($("#homeSolicStat")) $("#homeSolicStat").textContent = String(abertas);
    }catch(error){
      console.error("[home-solic] refreshKpi:", error);
    }
  }

  async function sendSolic(){
    const button = $("#homeSolicSend");
    const payload = {
      filial: upper($("#hsFilial")?.value),
      tipo: upper($("#hsTipo")?.value || "GERAL"),
      data: safeText($("#hsData")?.value || todayBR()),
      status: "ABERTA",
      observacao: safeText($("#hsObs")?.value),
      solicitante: upper($("#hsSolicitante")?.value || window.getUser?.() || "USUÁRIO")
    };

    if(!payload.filial){
      alert("Selecione a filial.");
      return;
    }

    if(!payload.observacao){
      alert("Escreva a observação.");
      return;
    }

    try{
      if(button) button.disabled = true;
      showLoading();

      await portalCall("create", payload);
      await refreshKpi();
      resetForm();
      closeModal();
      alert("Solicitação salva com sucesso ✅");
    }catch(error){
      console.error("[home-solic] sendSolic:", error);
      alert(error?.message || "Falha ao salvar solicitação.");
    }finally{
      hideLoading();
      if(button) button.disabled = false;
    }
  }

  function bind(){
    $("#homeSolicCard")?.addEventListener("click", openModal);
    $("#homeSolicClose")?.addEventListener("click", closeModal);
    $("#homeSolicCancel")?.addEventListener("click", closeModal);
    $("#homeSolicSend")?.addEventListener("click", sendSolic);

    $("#homeSolicModal")?.addEventListener("click", event => {
      if(event.target === $("#homeSolicModal")) closeModal();
    });

    document.addEventListener("keydown", event => {
      if(event.key === "Escape") closeModal();
    });
  }

  window.addEventListener("DOMContentLoaded", () => {
    ensureLoading();
    fillFiliais();
    bind();
    resetForm();
    refreshKpi();
    setInterval(refreshKpi, 60000);
  });
})();
