(function initFleetCostModule(global){
  "use strict";

  const DRAFT_KEY = "nf_frota_pesada_draft_v1";
  const HISTORY_KEY = "nf_frota_pesada_history_v1";

  const numericFields = [
    "kmIda", "kmVolta", "kmExtra", "cargaTon", "freteBruto",
    "precoDiesel", "mediaKmLitro", "arlaPct", "comissaoPct", "impostosPct",
    "pedagioIda", "pedagioVolta", "outrasDespesas", "valorAquisicao",
    "valorResidual", "vidaUtilMeses", "kmPlanejadoMes", "seguroMensal",
    "ipvaAnual", "rastreadorMensal", "salariosMensal", "administrativoMensal",
    "capitalMensal", "outrosFixosMensal", "manutencaoKm", "custoPneus", "vidaPneusKm"
  ];

  const textFields = ["veiculo", "dataViagem", "motorista", "origem", "destino"];
  const allFields = [...textFields, ...numericFields];

  function localDateValue(){
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0,10);
  }

  const exampleValues = {
    veiculo:"EXEMPLO 9 EIXOS", dataViagem:localDateValue(), motorista:"Motorista Exemplo",
    origem:"Origem", destino:"Destino", kmIda:933, kmVolta:933, kmExtra:0,
    cargaTon:46, freteBruto:9614, precoDiesel:5.69, mediaKmLitro:2.2,
    arlaPct:5, comissaoPct:11, impostosPct:9.25, pedagioIda:0, pedagioVolta:0,
    outrasDespesas:0, valorAquisicao:850000, valorResidual:300000,
    vidaUtilMeses:120, kmPlanejadoMes:12000, seguroMensal:2500, ipvaAnual:8500,
    rastreadorMensal:250, salariosMensal:7000, administrativoMensal:1000,
    capitalMensal:0, outrosFixosMensal:1500, manutencaoKm:0.60,
    custoPneus:48000, vidaPneusKm:120000
  };

  function finite(value){
    const normalized = typeof value === "string" ? value.replace(",", ".") : value;
    const number = Number(normalized);
    return Number.isFinite(number) ? Math.max(0, number) : 0;
  }

  function rate(value){
    return Math.min(finite(value), 100) / 100;
  }

  function calculateFleetCost(input = {}){
    const kmTotal = finite(input.kmIda) + finite(input.kmVolta) + finite(input.kmExtra);
    const cargaTon = finite(input.cargaTon);
    const freteBruto = finite(input.freteBruto);
    const consumo = finite(input.mediaKmLitro);
    const litrosDiesel = consumo > 0 ? kmTotal / consumo : 0;
    const custoDiesel = litrosDiesel * finite(input.precoDiesel);
    const custoArla = custoDiesel * rate(input.arlaPct);
    const pedagios = finite(input.pedagioIda) + finite(input.pedagioVolta);
    const outrasDespesas = finite(input.outrasDespesas);
    const comissaoRate = rate(input.comissaoPct);
    const impostosRate = rate(input.impostosPct);
    const comissao = freteBruto * comissaoRate;
    const impostos = freteBruto * impostosRate;

    const vidaUtilMeses = finite(input.vidaUtilMeses);
    const baseDepreciavel = Math.max(0, finite(input.valorAquisicao) - finite(input.valorResidual));
    const depreciacaoMensal = vidaUtilMeses > 0 ? baseDepreciavel / vidaUtilMeses : 0;
    const ipvaMensal = finite(input.ipvaAnual) / 12;
    const custoFixoMensal = depreciacaoMensal + ipvaMensal
      + finite(input.seguroMensal) + finite(input.rastreadorMensal)
      + finite(input.salariosMensal) + finite(input.administrativoMensal)
      + finite(input.capitalMensal) + finite(input.outrosFixosMensal);
    const kmPlanejadoMes = finite(input.kmPlanejadoMes);
    const fixoKm = kmPlanejadoMes > 0 ? custoFixoMensal / kmPlanejadoMes : 0;

    const vidaPneusKm = finite(input.vidaPneusKm);
    const pneusKm = vidaPneusKm > 0 ? finite(input.custoPneus) / vidaPneusKm : 0;
    const manutencaoKm = finite(input.manutencaoKm);
    const custoPneus = pneusKm * kmTotal;
    const custoManutencao = manutencaoKm * kmTotal;
    const custoFixoRateado = fixoKm * kmTotal;

    const custoBase = custoDiesel + custoArla + pedagios + outrasDespesas
      + custoPneus + custoManutencao + custoFixoRateado;
    const custoTotal = custoBase + comissao + impostos;
    const custoKm = kmTotal > 0 ? custoTotal / kmTotal : 0;
    const receitaKm = kmTotal > 0 ? freteBruto / kmTotal : 0;
    const lucro = freteBruto - custoTotal;
    const margem = freteBruto > 0 ? lucro / freteBruto : 0;
    const denominator = 1 - comissaoRate - impostosRate;
    const freteMinimo = denominator > 0 ? custoBase / denominator : 0;
    const freteMinimoKm = kmTotal > 0 ? freteMinimo / kmTotal : 0;
    const freteMinimoTon = cargaTon > 0 ? freteMinimo / cargaTon : 0;
    const baseOperacionalKm = fixoKm + pneusKm + manutencaoKm;

    return {
      kmTotal, cargaTon, freteBruto, litrosDiesel, custoDiesel, custoArla,
      pedagios, outrasDespesas, comissao, impostos, depreciacaoMensal, ipvaMensal,
      custoFixoMensal, fixoKm, pneusKm, manutencaoKm, custoPneus,
      custoManutencao, custoFixoRateado, custoBase, custoTotal, custoKm,
      receitaKm, lucro, margem, freteMinimo, freteMinimoKm, freteMinimoTon,
      baseOperacionalKm,
      groups:{
        diesel:custoDiesel,
        arla:custoArla,
        road:pedagios + outrasDespesas,
        taxes:comissao + impostos,
        wear:custoPneus + custoManutencao,
        fixed:custoFixoRateado
      }
    };
  }

  global.NFFleetCost = { calculateFleetCost, exampleValues:{...exampleValues} };
  if(typeof document === "undefined") return;

  const byId = id => document.getElementById(id);
  const brl = new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL" });
  const number2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 });
  const number0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits:0 });
  const percent1 = new Intl.NumberFormat("pt-BR", { style:"percent", minimumFractionDigits:1, maximumFractionDigits:1 });
  let toastTimer = null;

  function getFormValues(){
    const values = {};
    textFields.forEach(id => { values[id] = byId(id)?.value || ""; });
    numericFields.forEach(id => { values[id] = finite(byId(id)?.value); });
    return values;
  }

  function setFormValues(values){
    allFields.forEach(id => {
      const field = byId(id);
      if(!field) return;
      field.value = values[id] ?? "";
    });
    render();
  }

  function setMoney(id, value){ const element = byId(id); if(element) element.textContent = brl.format(value || 0); }
  function setText(id, value){ const element = byId(id); if(element) element.textContent = value; }

  function showToast(message){
    const toast = byId("fleetToast");
    if(!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function saveDraft(values){
    try{ localStorage.setItem(DRAFT_KEY, JSON.stringify(values)); }catch(error){ console.warn("Não foi possível salvar o rascunho.", error); }
  }

  function loadDraft(){
    try{
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      return draft && typeof draft === "object" ? draft : null;
    }catch(error){ return null; }
  }

  function renderDecision(result){
    const badge = byId("decisionBadge");
    const title = byId("decisionTitle");
    const text = byId("decisionText");
    badge.className = "fleet-decision-badge";

    if(result.kmTotal <= 0 || result.freteBruto <= 0){
      badge.textContent = "Aguardando dados";
      title.textContent = "Preencha a quilometragem e o frete";
      text.textContent = "O portal comparará o valor contratado com todos os custos operacionais rateados.";
      return;
    }

    if(result.lucro >= 0){
      badge.textContent = "Viagem viável";
      badge.classList.add("good");
      title.textContent = `Resultado positivo de ${brl.format(result.lucro)}`;
      text.textContent = `O frete está ${brl.format(result.freteBruto - result.freteMinimo)} acima do ponto de equilíbrio calculado.`;
    }else{
      badge.textContent = "Abaixo do equilíbrio";
      badge.classList.add("bad");
      title.textContent = `Déficit estimado de ${brl.format(Math.abs(result.lucro))}`;
      text.textContent = `Para cobrir os custos informados, o frete precisaria aumentar pelo menos ${brl.format(Math.max(0,result.freteMinimo - result.freteBruto))}.`;
    }
  }

  function renderBars(groups, total){
    Object.entries(groups).forEach(([key,value]) => {
      const bar = document.querySelector(`[data-bar="${key}"]`);
      if(bar) bar.style.width = `${total > 0 ? Math.min(100,(value / total) * 100) : 0}%`;
    });
  }

  function render(){
    const values = getFormValues();
    const result = calculateFleetCost(values);
    saveDraft(values);

    setText("kpiKmTotal", `${number0.format(result.kmTotal)} km`);
    setMoney("kpiCustoTotal", result.custoTotal);
    setMoney("kpiCustoKm", result.custoKm);
    setMoney("kpiReceitaKm", result.receitaKm);
    setMoney("kpiLucro", result.lucro);
    setText("kpiMargem", percent1.format(result.margem));

    const profitClass = result.freteBruto > 0 ? (result.lucro >= 0 ? "green" : "red") : "";
    ["kpiLucroCard","kpiMargemCard"].forEach(id => {
      const card = byId(id);
      if(card) card.className = `fleet-kpi ${profitClass}`.trim();
    });

    setMoney("freteMinimo", result.freteMinimo);
    setText("freteMinimoKm", `${brl.format(result.freteMinimoKm)}/km`);
    setText("freteMinimoTon", `${brl.format(result.freteMinimoTon)}/t`);
    renderDecision(result);

    setMoney("costDiesel", result.groups.diesel);
    setMoney("costArla", result.groups.arla);
    setMoney("costRoad", result.groups.road);
    setMoney("costTaxes", result.groups.taxes);
    setMoney("costWear", result.groups.wear);
    setMoney("costFixed", result.groups.fixed);
    setMoney("costTotalSide", result.custoTotal);
    renderBars(result.groups, result.custoTotal);

    setText("baseLitros", `${number2.format(result.litrosDiesel)} L`);
    setMoney("baseDepreciacao", result.depreciacaoMensal);
    setMoney("baseFixoMensal", result.custoFixoMensal);
    setMoney("baseFixoKm", result.fixoKm);
    setMoney("basePneusKm", result.pneusKm);
    setMoney("baseOperacionalKm", result.baseOperacionalKm);
    return { values, result };
  }

  function getHistory(){
    try{
      const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      return Array.isArray(history) ? history : [];
    }catch(error){ return []; }
  }

  function saveHistory(history){
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0,100)));
    renderHistory();
  }

  function routeLabel(item){
    const origin = String(item.origem || "").trim();
    const destination = String(item.destino || "").trim();
    return origin || destination ? `${origin || "—"} → ${destination || "—"}` : "—";
  }

  function escapeHtml(value){
    return String(value ?? "").replace(/[&<>'"]/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[character]);
  }

  function displayDate(value){
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : (value || "—");
  }

  function renderHistory(){
    const history = getHistory();
    const tbody = byId("historyBody");
    setText("historyCount", `${history.length} ${history.length === 1 ? "viagem" : "viagens"}`);
    if(!tbody) return;
    if(!history.length){
      tbody.innerHTML = '<tr><td class="fleet-table-empty" colspan="10">Nenhuma simulação salva.</td></tr>';
      return;
    }
    tbody.innerHTML = history.map(item => {
      const resultClass = item.lucro >= 0 ? "positive" : "negative";
      return `<tr>
        <td>${escapeHtml(displayDate(item.dataViagem))}</td>
        <td>${escapeHtml(item.veiculo || "—")}</td>
        <td>${escapeHtml(routeLabel(item))}</td>
        <td class="num">${number0.format(item.kmTotal)}</td>
        <td class="num">${brl.format(item.freteBruto)}</td>
        <td class="num">${brl.format(item.custoTotal)}</td>
        <td class="num">${brl.format(item.custoKm)}</td>
        <td class="num ${resultClass}">${brl.format(item.lucro)}</td>
        <td class="num ${resultClass}">${percent1.format(item.margem)}</td>
        <td><button class="fleet-icon-action" type="button" data-remove-history="${escapeHtml(item.id)}" aria-label="Excluir simulação" title="Excluir">×</button></td>
      </tr>`;
    }).join("");
  }

  function saveCurrentTrip(){
    const { values, result } = render();
    if(result.kmTotal <= 0){
      alert("Informe a quilometragem da viagem antes de salvar.");
      byId("kmIda")?.focus();
      return;
    }
    if(result.freteBruto <= 0){
      alert("Informe o frete bruto antes de salvar.");
      byId("freteBruto")?.focus();
      return;
    }
    const history = getHistory();
    history.unshift({
      id:global.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      savedAt:new Date().toISOString(), ...values,
      kmTotal:result.kmTotal, custoTotal:result.custoTotal, custoKm:result.custoKm,
      receitaKm:result.receitaKm, lucro:result.lucro, margem:result.margem,
      freteMinimo:result.freteMinimo
    });
    saveHistory(history);
    showToast("Simulação salva no histórico deste navegador.");
  }

  function csvCell(value){
    const string = String(value ?? "");
    return `"${string.replace(/"/g,'""')}"`;
  }

  function exportCsv(){
    const history = getHistory();
    if(!history.length){ alert("Não há simulações salvas para exportar."); return; }
    const rows = [["Data","Veículo","Motorista","Origem","Destino","KM total","Carga (t)","Frete bruto","Custo total","Custo por KM","Receita por KM","Resultado","Margem","Frete mínimo"]];
    history.forEach(item => rows.push([
      displayDate(item.dataViagem), item.veiculo, item.motorista, item.origem, item.destino,
      item.kmTotal, item.cargaTon, item.freteBruto, item.custoTotal, item.custoKm,
      item.receitaKm, item.lucro, item.margem, item.freteMinimo
    ]));
    const csv = "\ufeff" + rows.map(row => row.map(csvCell).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type:"text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `custo-frota-pesada-${localDateValue()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function clearForm(){
    const empty = Object.fromEntries(allFields.map(id => [id, ""]));
    empty.dataViagem = localDateValue();
    setFormValues(empty);
    showToast("Campos limpos. Informe os dados da nova viagem.");
  }

  function bindEvents(){
    byId("fleetCostForm")?.addEventListener("input", render);
    byId("btnExemplo")?.addEventListener("click", () => { setFormValues(exampleValues); showToast("Valores de exemplo carregados."); });
    byId("btnLimpar")?.addEventListener("click", clearForm);
    byId("btnImprimir")?.addEventListener("click", () => window.print());
    byId("btnSalvarViagem")?.addEventListener("click", saveCurrentTrip);
    byId("btnExportar")?.addEventListener("click", exportCsv);
    byId("btnLimparHistorico")?.addEventListener("click", () => {
      const history = getHistory();
      if(!history.length) return;
      if(confirm("Excluir todo o histórico salvo neste navegador?")){
        localStorage.removeItem(HISTORY_KEY);
        renderHistory();
        showToast("Histórico local removido.");
      }
    });
    byId("historyBody")?.addEventListener("click", event => {
      const button = event.target.closest("[data-remove-history]");
      if(!button) return;
      saveHistory(getHistory().filter(item => item.id !== button.dataset.removeHistory));
      showToast("Simulação removida do histórico.");
    });
  }

  function start(){
    const draft = loadDraft();
    setFormValues(draft || exampleValues);
    bindEvents();
    renderHistory();
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once:true });
  else start();
})(typeof window !== "undefined" ? window : globalThis);
