(function(){
  "use strict";

  const API_URL =
    "https://script.google.com/macros/s/AKfycby95ZPwK5pwuU8hsydVY3Flr9tl8esHKMl0b9IlpDTP7FQEPOwrvxWZJj0uZOlANh_Z/exec";

  const FILIAIS = [
    "ITUMBIARA","RIO VERDE","JATAI","MINEIROS","CHAPADAO DO CEU","MONTIVIDIU",
    "INDIARA","BOM JESUS DE GO","VIANOPOLIS","ANAPOLIS","URUAÇU"
  ];

  const $ = (s)=>document.querySelector(s);

  function upper(v){ return String(v ?? "").trim().toUpperCase(); }
  function safeText(v){ return String(v ?? "").trim(); }

  function todayBR(){
    const d = new Date();
    const dd = String(d.getDate()).padStart(2,"0");
    const mm = String(d.getMonth()+1).padStart(2,"0");
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

      window[cb] = (data) => { cleanup(); resolve(data); };

      s.src = url + sep + "callback=" + encodeURIComponent(cb) + "&_=" + Date.now();
      s.onerror = () => { cleanup(); reject(new Error("Erro ao carregar script (JSONP)")); };
      document.head.appendChild(s);
    });
  }

  function buildUrl(paramsObj) {
    const url = new URL(API_URL);
    Object.entries(paramsObj || {}).forEach(([k, v]) => url.searchParams.set(k, v));
    return url.toString();
  }

  function openModal(){
    $("#homeSolicModal")?.classList.add("isOpen");
  }

  function closeModal(){
    $("#homeSolicModal")?.classList.remove("isOpen");
  }

  function fillFiliais(){
    const sel = $("#hsFilial");
    if(!sel) return;

    sel.innerHTML =
      `<option value="">Selecione...</option>` +
      FILIAIS.map(f => `<option value="${f}">${f}</option>`).join("");
  }

  async function refreshKpi(){
    try{
      const res = await jsonp(buildUrl({ action:"solicit_list" }));
      if(!res || res.ok === false) return;

      const abertas = (res.data || [])
        .filter(x => upper(x.status) === "ABERTA")
        .length;

      const el = $("#homeSolicOpen");
      if(el) el.textContent = String(abertas);
    }catch(e){
      console.error("[home-solic] refreshKpi:", e);
    }
  }

  async function sendSolic(){
    const filial = upper($("#hsFilial")?.value || "");
    const tipo = upper($("#hsTipo")?.value || "GERAL");
    const data = safeText($("#hsData")?.value || todayBR());
    const status = upper($("#hsStatus")?.value || "ABERTA");
    const observacao = safeText($("#hsObs")?.value || "");
    const solicitante = upper(window.getUser?.() || "USUÁRIO");

    if(!filial) return alert("Selecione a filial.");
    if(!observacao) return alert("Descreva a observação.");

    try{
      const res = await jsonp(buildUrl({
        action:"solicit_add",
        filial,
        tipo,
        data,
        status,
        observacao,
        solicitante
      }));

      if(!res || res.ok === false){
        throw new Error(res?.error || "Falha ao enviar solicitação");
      }

      closeModal();

      if($("#hsFilial")) $("#hsFilial").value = "";
      if($("#hsTipo")) $("#hsTipo").value = "";
      if($("#hsData")) $("#hsData").value = todayBR();
      if($("#hsStatus")) $("#hsStatus").value = "ABERTA";
      if($("#hsObs")) $("#hsObs").value = "";
      if($("#hsSolicitante")) $("#hsSolicitante").value = solicitante;

      await refreshKpi();
      alert("Solicitação enviada ✅");
    }catch(e){
      console.error("[home-solic] sendSolic:", e);
      alert(e?.message || "Falha ao enviar solicitação.");
    }
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
    bind();

    if($("#hsData")) $("#hsData").value = todayBR();
    if($("#hsStatus")) $("#hsStatus").value = "ABERTA";
    if($("#hsSolicitante")) $("#hsSolicitante").value = upper(window.getUser?.() || "USUÁRIO");

    refreshKpi();
    setInterval(refreshKpi, 60000);
  });
})();
