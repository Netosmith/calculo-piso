/* controle.js | NOVA FROTA | GOOGLE SHEETS */
(function(){
"use strict";

const API_URL =
  "https://script.google.com/macros/s/AKfycbyIeygrlaQVPq0puz1uxztLHSg0bsjxBcGFuZ9IR4CXqB2DqWMf3gPPFVk4FI0B-i45/exec";

const S = {
  rows: [],
  filial: "",
  id: "",
  loading: false
};

const $ = (s) => document.querySelector(s);
const safe = (v) => String(v ?? "").trim();
const upper = (v) => safe(v).toUpperCase();
const num = (v) => {
  const n = Number(String(v ?? "").replace(/\./g,"").replace(",","."));
  return Number.isFinite(n) ? n : 0;
};
const ton = (v) => num(v).toLocaleString("pt-BR",{maximumFractionDigits:2}) + " t";
const fmtData = (v) => {
  if(!v) return "-";
  const raw = String(v);
  if(/^\d{4}-\d{2}-\d{2}/.test(raw)){
    const d = raw.slice(0,10).split("-");
    return `${d[2]}/${d[1]}/${d[0]}`;
  }
  return raw;
};

function sync(text){
  const el = $("#sync");
  if(el) el.textContent = text;
}

function setLoading(on, text){
  S.loading = !!on;
  sync(on ? (text || "⏳ Carregando...") : "✅ Pronto");

  [
    "#btnNovoTop",
    "#btnNovoFilial",
    "#btnNovoVeiculo",
    "#btnAtualizar",
    "#salvarEmbarque",
    "#salvarVeiculo"
  ].forEach(sel => {
    const el = $(sel);
    if(el) el.disabled = !!on;
  });
}

function jsonp(url, timeoutMs = 35000){
  return new Promise((resolve,reject) => {
    const callback = "nfcb_" + Math.random().toString(36).slice(2);
    const script = document.createElement("script");
    const sep = url.includes("?") ? "&" : "?";

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Tempo esgotado ao acessar a planilha."));
    }, timeoutMs);

    function cleanup(){
      clearTimeout(timer);
      try{ delete window[callback]; }catch(_){}
      try{ script.remove(); }catch(_){}
    }

    window[callback] = (data) => {
      cleanup();
      resolve(data);
    };

    script.src =
      url + sep +
      "callback=" + encodeURIComponent(callback) +
      "&_=" + Date.now();

    script.onerror = () => {
      cleanup();
      reject(new Error("Falha ao acessar o Apps Script."));
    };

    document.head.appendChild(script);
  });
}

function buildUrl(params){
  const url = new URL(API_URL);

  Object.entries(params || {}).forEach(([key,value]) => {
    if(value !== undefined && value !== null){
      if(typeof value === "object"){
        url.searchParams.set(key, JSON.stringify(value));
      }else{
        url.searchParams.set(key, String(value));
      }
    }
  });

  return url.toString();
}

async function api(params){
  const res = await jsonp(buildUrl(params));

  if(!res || res.ok === false){
    throw new Error(res?.error || res?.message || "Erro na API.");
  }

  return res;
}

function extractRows(res){
  const rows =
    res?.rows ??
    res?.data ??
    res?.items ??
    res?.embarques ??
    [];

  return Array.isArray(rows) ? rows : [];
}

function normalizeVeiculo(v){
  return {
    id: safe(v.id ?? v.ID ?? v.Id),
    idEmbarque: safe(v.idEmbarque ?? v.IDEmbarque ?? v.embarqueId),
    dataHora: safe(v.dataHora ?? v.DataHora ?? v.data_hora),
    placa: upper(v.placa ?? v.Placa),
    motorista: upper(v.motorista ?? v.Motorista),
    tipo: upper(v.tipo ?? v.Tipo ?? v.tipoVeiculo ?? v.TipoVeiculo),
    peso: num(v.peso ?? v.Peso),
    situacao: upper(v.situacao ?? v.Situacao ?? v.status)
  };
}

function normalizeEmbarque(e){
  const veiculos = Array.isArray(e.veiculos) ? e.veiculos.map(normalizeVeiculo) : [];

  return {
    id: safe(e.id ?? e.ID ?? e.Id),
    data: safe(e.data ?? e.Data ?? e.dataCriacao ?? e.DataCriacao),
    filial: upper(e.filial ?? e.Filial),
    cliente: upper(e.cliente ?? e.Cliente),
    origem: upper(e.origem ?? e.Origem),
    local: upper(e.local ?? e.Local ?? e.localEmbarque ?? e.LocalEmbarque),
    destino: upper(e.destino ?? e.Destino),
    produto: upper(e.produto ?? e.Produto),
    volume: num(e.volume ?? e.Volume ?? e.volumeContratado ?? e.VolumeContratado),
    status: upper(e.status ?? e.Status),
    veiculos
  };
}

async function carregarDados(){
  setLoading(true, "⏳ Carregando embarques...");

  try{
    const [resEmb, resVei] = await Promise.all([
      api({ action:"controle_embarques_list" }),
      api({ action:"controle_veiculos_list" })
    ]);

    const embarques = extractRows(resEmb).map(normalizeEmbarque);
    const veiculos = extractRows(resVei).map(normalizeVeiculo);

    const mapa = {};
    veiculos.forEach(v => {
      if(!mapa[v.idEmbarque]) mapa[v.idEmbarque] = [];
      mapa[v.idEmbarque].push(v);
    });

    embarques.forEach(e => {
      e.veiculos = mapa[e.id] || e.veiculos || [];
    });

    S.rows = embarques;
    renderDashboard();

    if(S.filial){
      renderFilial();
    }

    if(S.id){
      const atual = S.rows.find(e => e.id === S.id);
      if(atual) openDetalhe(S.id, false);
    }

    sync("✅ Dados atualizados");
  }catch(err){
    console.error(err);
    sync("⚠️ Erro ao carregar");
    alert("Não foi possível carregar o controle de embarque.\n\n" + err.message);
  }finally{
    setLoading(false);
  }
}

function show(name){
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  $("#view-" + name)?.classList.add("active");
  window.scrollTo({top:0,behavior:"smooth"});
}

function embarcado(e){
  return (e.veiculos || []).reduce((a,v) => a + num(v.peso), 0);
}

function saldo(e){
  return Math.max(0, num(e.volume) - embarcado(e));
}

function cls(status){
  status = upper(status);

  if(["CONCLUÍDO","FINALIZADO"].includes(status)){
    return "text-green-400 border-green-500/40 bg-green-500/10";
  }

  if(status === "EM ATRASO"){
    return "text-red-300 border-red-400/40 bg-red-500/10";
  }

  if(["EM ANDAMENTO","CARREGANDO"].includes(status)){
    return "text-yellow border-yellow/40 bg-yellow/10";
  }

  return "text-primary border-primary/40 bg-primary/10";
}

function resumo(){
  const map = {};

  S.rows.forEach(e => {
    const filial = upper(e.filial || "SEM FILIAL");

    if(!map[filial]){
      map[filial] = {
        filial,
        total:0,
        ativos:0,
        finalizados:0,
        veiculos:0
      };
    }

    map[filial].total++;
    map[filial].veiculos += (e.veiculos || []).length;

    if(upper(e.status) === "CONCLUÍDO"){
      map[filial].finalizados++;
    }else{
      map[filial].ativos++;
    }
  });

  return Object.values(map).sort((a,b) => a.filial.localeCompare(b.filial));
}

function fillFiliais(){
  const el = $("#fFilial");
  if(!el) return;

  const old = el.value;
  const filiais = resumo().map(x => x.filial);

  el.innerHTML =
    '<option value="">Todas as filiais</option>' +
    filiais.map(f => `<option value="${f}">${f}</option>`).join("");

  if(filiais.includes(old)){
    el.value = old;
  }
}

function renderDashboard(){
  let data = resumo();
  const filtro = upper($("#fFilial")?.value);
  const busca = upper($("#fBusca")?.value);

  if(filtro){
    data = data.filter(x => x.filial === filtro);
  }

  if(busca){
    data = data.filter(x => {
      const relacionados = S.rows.filter(e => upper(e.filial) === x.filial);
      return upper(JSON.stringify({resumo:x,embarques:relacionados})).includes(busca);
    });
  }

  const grid = $("#gridFiliais");
  if(!grid) return;

  grid.innerHTML = "";

  if(!data.length){
    grid.innerHTML = `
      <div class="col-span-full bg-surface border border-line rounded-xl p-8 text-center text-muted">
        Nenhuma filial encontrada.
      </div>
    `;
  }

  data.forEach(x => {
    const aberto = x.ativos > 0;
    const button = document.createElement("button");

    button.type = "button";
    button.className =
      "text-left bg-surface border border-line p-5 rounded-2xl hover:border-primary transition-all";

    button.innerHTML = `
      <div class="flex justify-between mb-4">
        <span class="material-symbols-outlined ${aberto ? "text-yellow pulse" : "text-green-400"}">
          local_shipping
        </span>
        <span class="text-xs font-bold ${aberto ? "text-yellow" : "text-green-400"}">
          ${aberto ? "EM ABERTO" : "FINALIZADOS"}
        </span>
      </div>

      <h3 class="text-lg font-bold">${x.filial}</h3>

      <div class="mt-4 pt-4 border-t border-line/40 grid grid-cols-3 gap-2">
        <div>
          <small class="text-muted">Ativos</small>
          <b class="block text-xl">${x.ativos}</b>
        </div>
        <div>
          <small class="text-muted">Veículos</small>
          <b class="block text-xl">${x.veiculos}</b>
        </div>
        <div>
          <small class="text-muted">Total</small>
          <b class="block text-xl">${x.total}</b>
        </div>
      </div>
    `;

    button.onclick = () => openFilial(x.filial);
    grid.appendChild(button);
  });

  const finalizados = S.rows.filter(e => upper(e.status) === "CONCLUÍDO").length;

  $("#sFiliais").textContent = resumo().length;
  $("#sAtivos").textContent = S.rows.length - finalizados;
  $("#sVeiculos").textContent = S.rows.reduce((a,e) => a + (e.veiculos || []).length,0);
  $("#sFinalizados").textContent = finalizados;

  fillFiliais();
}

function openFilial(filial){
  S.filial = filial;
  $("#tituloFilial").textContent = "Filial: " + filial;
  renderFilial();
  show("filial");
}

function renderFilial(){
  let rows = S.rows.filter(e => upper(e.filial) === upper(S.filial));
  const busca = upper($("#buscaFilial")?.value);

  if(busca){
    rows = rows.filter(e => upper(JSON.stringify(e)).includes(busca));
  }

  const tbody = $("#tbodyEmbarques");
  tbody.innerHTML = "";

  if(!rows.length){
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="p-8 text-center text-muted">
          Nenhum embarque encontrado para esta filial.
        </td>
      </tr>
    `;
  }

  rows.forEach(e => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td class="p-4">${fmtData(e.data)}</td>
      <td class="p-4 font-semibold">${e.cliente}</td>
      <td class="p-4">${e.origem}</td>
      <td class="p-4">${e.local}</td>
      <td class="p-4">${e.destino}</td>
      <td class="p-4">${ton(e.volume)}</td>
      <td class="p-4">${ton(saldo(e))}</td>
      <td class="p-4">
        <span class="px-3 py-1 rounded-full border text-xs font-bold ${cls(e.status)}">
          ${e.status}
        </span>
      </td>
      <td class="p-4 text-right">
        <button data-open="${e.id}" class="material-symbols-outlined hover:text-primary">
          visibility
        </button>
        <button data-del="${e.id}" class="material-symbols-outlined hover:text-red-300 ml-2">
          delete
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-open]").forEach(btn => {
    btn.onclick = () => openDetalhe(btn.dataset.open);
  });

  tbody.querySelectorAll("[data-del]").forEach(btn => {
    btn.onclick = () => deleteEmbarque(btn.dataset.del);
  });

  const todos = S.rows.filter(e => upper(e.filial) === upper(S.filial));
  const finalizados = todos.filter(e => upper(e.status) === "CONCLUÍDO").length;
  const volume = todos.reduce((a,e) => a + num(e.volume),0);
  const saldoTotal = todos.reduce((a,e) => a + saldo(e),0);
  const saidas = todos.reduce(
    (a,e) => a + (e.veiculos || []).filter(v => upper(v.situacao) === "FINALIZADO").length,
    0
  );

  $("#fAtivos").textContent = todos.length - finalizados;
  $("#fTotal").textContent = todos.length;
  $("#fFinalizados").textContent = finalizados;
  $("#mEficiencia").textContent =
    (todos.length ? finalizados / todos.length * 100 : 0)
      .toLocaleString("pt-BR",{maximumFractionDigits:1}) + "%";
  $("#mSaidas").textContent = saidas;
  $("#mVolume").textContent = ton(volume);
  $("#mSaldo").textContent = ton(saldoTotal);
}

function openDetalhe(id, changeView = true){
  const e = S.rows.find(x => x.id === id);
  if(!e) return;

  S.id = id;

  $("#dCliente").textContent = e.cliente;
  $("#dRota").textContent = e.origem + " → " + e.destino;
  $("#dProduto").textContent = e.produto;
  $("#dStatus").textContent = e.status;
  $("#dStatus").className =
    "ml-auto px-3 py-2 rounded-full border text-xs font-bold " + cls(e.status);
  $("#dVolume").textContent = ton(e.volume);
  $("#dEmbarcado").textContent = ton(embarcado(e));
  $("#dSaldo").textContent = ton(saldo(e));

  renderVeiculos(e);

  if(changeView){
    show("detalhe");
  }
}

function renderVeiculos(e){
  const tbody = $("#tbodyVeiculos");
  tbody.innerHTML = "";

  if(!(e.veiculos || []).length){
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="p-8 text-center text-muted">
          Nenhum veículo registrado neste embarque.
        </td>
      </tr>
    `;
  }

  (e.veiculos || []).forEach(v => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td class="p-4">${v.dataHora || "-"}</td>
      <td class="p-4 font-bold">${v.placa}</td>
      <td class="p-4">${v.motorista || "-"}</td>
      <td class="p-4">${v.tipo || "-"}</td>
      <td class="p-4">${ton(v.peso)}</td>
      <td class="p-4">
        <span class="px-3 py-1 rounded-full border text-xs font-bold ${cls(v.situacao)}">
          ${v.situacao}
        </span>
      </td>
      <td class="p-4 text-right">
        <button data-vdel="${v.id}" class="material-symbols-outlined hover:text-red-300">
          delete
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-vdel]").forEach(btn => {
    btn.onclick = () => deleteVeiculo(btn.dataset.vdel);
  });
}

function modal(id,on){
  $("#" + id).classList.toggle("show",on);
}

function openEmbarqueModal(){
  ["eCliente","eOrigem","eLocal","eDestino","eProduto","eVolume"]
    .forEach(id => $("#" + id).value = "");

  $("#eFilial").value = S.filial || "";
  $("#eStatus").value = "AGENDADO";
  modal("modalEmbarque",true);
}

async function salvarEmbarque(){
  const payload = {
    filial: upper($("#eFilial").value),
    cliente: upper($("#eCliente").value),
    origem: upper($("#eOrigem").value),
    localEmbarque: upper($("#eLocal").value),
    destino: upper($("#eDestino").value),
    produto: upper($("#eProduto").value),
    volumeContratado: num($("#eVolume").value),
    status: upper($("#eStatus").value)
  };

  const faltando = [];
  if(!payload.filial) faltando.push("FILIAL");
  if(!payload.cliente) faltando.push("CLIENTE");
  if(!payload.origem) faltando.push("ORIGEM");
  if(!payload.destino) faltando.push("DESTINO");
  if(!payload.volumeContratado) faltando.push("VOLUME");

  if(faltando.length){
    alert("Preencha: " + faltando.join(", "));
    return;
  }

  setLoading(true,"⏳ Salvando embarque...");

  try{
    await api({
      action:"controle_embarques_add",
      ...payload
    });

    modal("modalEmbarque",false);
    S.filial = payload.filial;

    await carregarDados();
    openFilial(payload.filial);
    sync("✅ Embarque salvo");
  }catch(err){
    console.error(err);
    alert("Erro ao salvar embarque.\n\n" + err.message);
  }finally{
    setLoading(false);
  }
}

async function deleteEmbarque(id){
  const e = S.rows.find(x => x.id === id);
  if(!e) return;

  if(!confirm("Excluir este embarque e seus veículos?")){
    return;
  }

  setLoading(true,"⏳ Excluindo embarque...");

  try{
    await api({
      action:"controle_embarques_delete",
      id
    });

    await carregarDados();

    if(S.filial){
      renderFilial();
      show("filial");
    }

    sync("✅ Embarque excluído");
  }catch(err){
    console.error(err);
    alert("Erro ao excluir embarque.\n\n" + err.message);
  }finally{
    setLoading(false);
  }
}

function openVeiculoModal(){
  ["vPlaca","vMotorista","vTipo","vPeso"]
    .forEach(id => $("#" + id).value = "");

  $("#vSituacao").value = "PORTA";
  modal("modalVeiculo",true);
}

async function salvarVeiculo(){
  const embarque = S.rows.find(x => x.id === S.id);
  if(!embarque) return;

  const payload = {
    idEmbarque: embarque.id,
    placa: upper($("#vPlaca").value),
    motorista: upper($("#vMotorista").value),
    tipoVeiculo: upper($("#vTipo").value),
    peso: num($("#vPeso").value),
    situacao: upper($("#vSituacao").value)
  };

  if(!payload.placa){
    alert("Informe a placa.");
    return;
  }

  setLoading(true,"⏳ Salvando veículo...");

  try{
    await api({
      action:"controle_veiculos_add",
      ...payload
    });

    modal("modalVeiculo",false);
    await carregarDados();
    openDetalhe(embarque.id);
    sync("✅ Veículo salvo");
  }catch(err){
    console.error(err);
    alert("Erro ao salvar veículo.\n\n" + err.message);
  }finally{
    setLoading(false);
  }
}

async function deleteVeiculo(id){
  const embarque = S.rows.find(x => x.id === S.id);
  if(!embarque) return;

  if(!confirm("Excluir este veículo?")){
    return;
  }

  setLoading(true,"⏳ Excluindo veículo...");

  try{
    await api({
      action:"controle_veiculos_delete",
      id
    });

    await carregarDados();
    openDetalhe(embarque.id);
    sync("✅ Veículo excluído");
  }catch(err){
    console.error(err);
    alert("Erro ao excluir veículo.\n\n" + err.message);
  }finally{
    setLoading(false);
  }
}

function bind(){
  $("#btnNovoTop").onclick = openEmbarqueModal;
  $("#btnNovoFilial").onclick = openEmbarqueModal;
  $("#btnNovoVeiculo").onclick = openVeiculoModal;

  $("#btnVoltarPainel").onclick = () => {
    renderDashboard();
    show("dashboard");
  };

  $("#btnVoltarFilial").onclick = () => {
    renderFilial();
    show("filial");
  };

  $("#fBusca").oninput = renderDashboard;
  $("#fFilial").onchange = renderDashboard;
  $("#buscaFilial").oninput = renderFilial;

  $("#btnAtualizar").onclick = carregarDados;

  $("#fecharEmbarque").onclick =
  $("#cancelarEmbarque").onclick = () => modal("modalEmbarque",false);

  $("#salvarEmbarque").onclick = salvarEmbarque;

  $("#fecharVeiculo").onclick =
  $("#cancelarVeiculo").onclick = () => modal("modalVeiculo",false);

  $("#salvarVeiculo").onclick = salvarVeiculo;

  ["modalEmbarque","modalVeiculo"].forEach(id => {
    $("#" + id).onclick = e => {
      if(e.target.id === id){
        modal(id,false);
      }
    };
  });

  document.addEventListener("keydown",e => {
    if(e.key === "Escape"){
      modal("modalEmbarque",false);
      modal("modalVeiculo",false);
    }
  });
}

async function init(){
  bind();
  show("dashboard");
  await carregarDados();
}

window.addEventListener("DOMContentLoaded",init);
})();
