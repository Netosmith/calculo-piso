(function(){
  "use strict";

  const API_URL =
    "https://script.google.com/macros/s/AKfycbxRMEGLtFy9n7xaYW3bzjA9JHLzneXHLyhkttP1T120f-GqNGGRAiirwzOVOHX9zGmY/exec";

  const FILIAIS = [
    "ITUMBIARA","RIO VERDE","JATAI","MINEIROS","CHAPADAO DO CEU","MONTIVIDIU",
    "INDIARA","BOM JESUS DE GO","VIANOPOLIS","ANAPOLIS","URUAÇU"
  ];

  const $ = (s) => document.querySelector(s);

  function upper(v){ return String(v ?? "").trim().toUpperCase(); }
  function safeText(v){ return String(v ?? "").trim(); }

  function todayBR(){
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = d.getFullYear();
    return `${dd}/${mm}/${yy}`;
  }

  function jsonp(url, timeoutMs = 25000) {
    return new Promise((resolve, reject) => {
      const cb = "cb_" + Math.random().toString(36).slice(2);
      const s = document.createElement("script");
      const sep = url.includes("?") ? "&" : "?";

      const t = setTimeout(() => {
        cleanup();
        reject(new Error("Timeout (JSONP)"));
      }, timeoutMs);

      function cleanup() {
        clearTimeout(t);
        try { delete window[cb]; } catch {}
        try { s.remove(); } catch {}
      }

      window[cb] = (data) => {
        cleanup();
        resolve(data);
      };

      s.src = url + sep + "callback=" + encodeURIComponent(cb) + "&_=" + Date.now();
      s.onerror = () => {
        cleanup();
        reject(new Error("Erro ao carregar script (JSONP)"));
      };

      document.head.appendChild(s);
    });
  }

  function buildUrl(paramsObj) {
    const url = new URL(API_URL);
    Object.entries(paramsObj || {}).forEach(([k, v]) => {
      url.searchParams.set(k, v);
    });
    return url.toString();
  }

  function ensureLoading() {
    if (document.getElementById("homeSolicLoading")) return;

    const el = document.createElement("div");
    el.id = "homeSolicLoading";
    el.innerHTML = `
      <div class="homeSolicLoadingBox">
        <div class="homeSolicSpinner"></div>
        <div class="homeSolicLoadingText">Salvando solicitação...</div>
      </div>
    `;
    document.body.appendChild(el);

    const style = document.createElement("style");
    style.id = "homeSolicLoadingStyle";
    style.textContent = `
      #homeSolicLoading{
        position: fixed;
        inset: 0;
        display: none;
        align-items: center;
        justify-content: center;
        background: rgba(3,8,20,.58);
        backdrop-filter: blur(8px);
        z-index: 10050;
      }
      #homeSolicLoading.isOpen{ display:flex; }
      .homeSolicLoadingBox{
        width: min(280px, 88vw);
        padding: 28px 20px;
        border-radius: 22px;
        border: 1px solid rgba(255,255,255,.14);
        background: rgba(17,26,51,.92);
        box-shadow: 0 22px 60px rgba(0,0,0,.42);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
      }
      .homeSolicSpinner{
        width: 58px;
        height: 58px;
        border-radius: 999px;
        border: 5px solid rgba(255,255,255,.10);
        border-top-color: rgba(79,209,255,.95);
        border-right-color: rgba(79,209,255,.65);
        animation: homeSolicSpin .8s linear infinite;
      }
      .homeSolicLoadingText{
        color: #e9eefc;
        font-size: 15px;
        font-weight: 800;
        text-align: center;
      }
      @keyframes homeSolicSpin{
        to{ transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  function showLoading() {
    ensureLoading();
    $("#homeSolicLoading")?.classList.add("isOpen");
  }

  function hideLoading() {
    $("#homeSolicLoading")?.classList.remove("isOpen");
  }

  function fillFiliais(){
    const sel = $("#hsFilial");
    if(!sel) return;

    sel.innerHTML =
      `<option value="">Selecione...</option>` +
      FILIAIS.map(f => `<option value="${f}">${f}</option>`).join("");
  }

  function resetForm(){
    const user = upper(window.getUser?.() || "USUÁRIO");

    if ($("#hsFilial")) $("#hsFilial").value = "";
    if ($("#hsTipo")) $("#hsTipo").value = "";
    if ($("#hsData")) $("#hsData").value = todayBR();
    if ($("#hsStatus")) $("#hsStatus").value = "ABERTA";
    if ($("#hsObs")) $("#hsObs").value = "";
    if ($("#hsSolicitante")) $("#hsSolicitante").value = user;
  }

  function openModal(){
    const modal = $("#homeSolicModal");
    if (!modal) return;

    modal.classList.add("isOpen");

    const user = upper(window.getUser?.() || "USUÁRIO");
    const dataEl = $("#hsData");
    const statusEl = $("#hsStatus");
    const solicitanteEl = $("#hsSolicitante");

    if (dataEl && !safeText(dataEl.value)) dataEl.value = todayBR();
    if (statusEl && !safeText(statusEl.value)) statusEl.value = "ABERTA";
    if (solicitanteEl) solicitanteEl.value = user;
  }

  function closeModal(){
    $("#homeSolicModal")?.classList.remove("isOpen");
  }

  async function refreshKpi(){
    try{
      const res = await jsonp(buildUrl({ action:"solicit_list" }), 25000);
      if(!res || res.ok === false) return;

      const abertas = (res.data || []).filter(
        x => upper(x.status || "") === "ABERTA"
      ).length;

      const el = $("#homeSolicOpen");
      if(el) el.textContent = String(abertas);
    }catch(e){
      console.error("[home-solic] refreshKpi:", e);
    }
  }

  async function sendSolic(){
    const btn = $("#homeSolicSend");

    const filial = upper($("#hsFilial")?.value || "");
    const tipo = upper($("#hsTipo")?.value || "GERAL");
    const data = safeText($("#hsData")?.value || todayBR());
    const status = upper($("#hsStatus")?.value || "ABERTA");
    const observacao = safeText($("#hsObs")?.value || "");
    const solicitante = upper($("#hsSolicitante")?.value || (window.getUser?.() || "USUÁRIO"));

    if(!filial){
      alert("Selecione a filial.");
      return;
    }

    if(!observacao){
      alert("Escreva a observação.");
      return;
    }

    try{
      if (btn) btn.disabled = true;
      showLoading();

      const res = await jsonp(buildUrl({
        action: "solicit_add",
        filial,
        tipo,
        data,
        status,
        observacao,
        solicitante
      }), 30000);

      if(!res || res.ok === false){
        throw new Error(res?.error || "Falha ao salvar solicitação.");
      }

      await refreshKpi();
      resetForm();
      closeModal();
      alert("Solicitação salva com sucesso ✅");
    }catch(e){
      console.error("[home-solic] sendSolic:", e);
      alert(e?.message || "Falha ao salvar solicitação.");
    }finally{
      hideLoading();
      if (btn) btn.disabled = false;
    }
  }

  function bind(){
    $("#homeSolicCard")?.addEventListener("click", openModal);
    $("#homeSolicClose")?.addEventListener("click", closeModal);
    $("#homeSolicCancel")?.addEventListener("click", closeModal);
    $("#homeSolicSend")?.addEventListener("click", sendSolic);

    $("#homeSolicModal")?.addEventListener("click", (ev)=>{
      if(ev.target === $("#homeSolicModal")) closeModal();
    });

    document.addEventListener("keydown", (ev)=>{
      if(ev.key === "Escape") closeModal();
    });
  }

  window.addEventListener("DOMContentLoaded", ()=>{
    ensureLoading();
    fillFiliais();
    bind();
    resetForm();
    refreshKpi();
    setInterval(refreshKpi, 60000);
  });
})();
