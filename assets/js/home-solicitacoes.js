(function(){
  "use strict";

  const API_URL =
    "https://script.google.com/macros/s/AKfycbyWSvivxCp4GslWhGRxfvg6gcE72hNATplIqdVG2tp46DtrdxWzKLqirm-BgcSv2tlw/exec";

  const FILIAIS = [
    "ITUMBIARA","RIO VERDE","JATAI","MINEIROS","CHAPADAO DO CEU","MONTIVIDIU",
    "INDIARA","BOM JESUS DE GO","VIANOPOLIS","ANAPOLIS","URUAÇU"
  ];

  const $ = (s)=>document.querySelector(s);

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
    sel.innerHTML = `<option value="">Selecione...</option>` + FILIAIS.map(f=>`<option value="${f}">${f}</option>`).join("");
  }

  async function refreshKpi(){
    try{
      const res = await jsonp(buildUrl({ action:"solicit_list" }));
      if(!res || res.ok === false) return;
      const abertas = (res.data || []).filter(x => String(x.status||"").toUpperCase() === "ABERTA").length;
      const el = $("#homeSolicOpen");
      if(el) el.textContent = String(abertas);
    }catch(e){
      // silencioso na home
    }
  }

  async function sendSolic(){
    const filial = String($("#hsFilial")?.value||"").toUpperCase();
    const tipo = String($("#hsTipo")?.value||"").toUpperCase() || "GERAL";
    const obs = String($("#hsObs")?.value||"").trim();

    if(!filial) return alert("Selecione a filial.");
    if(!obs) return alert("Escreva a observação.");

    try{
      const res = await jsonp(buildUrl({
        action:"solicit_add",
        filial, tipo,
        observacao: obs,
        data: ""
      }));
      if(!res || res.ok === false) throw new Error(res?.error || "Falha ao enviar");
      closeModal();
      $("#hsTipo").value = "";
      $("#hsObs").value = "";
      await refreshKpi();
      alert("Solicitação enviada ✅");
    }catch(e){
      alert(e?.message || "Falha ao enviar solicitação.");
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
    fillFiliais();
    bind();
    refreshKpi();
    setInterval(refreshKpi, 60000);
  });
})();
