const API = "https://script.google.com/macros/s/AKfycbyOfN1PHdk_C4D5z1SFEEVEg7wWKnc7SberIARP4p6gt38fcrNeiNDjbq2vYrE9ryL0/exec";

let charts = {};

async function loadBI(){
  const res = await fetch(`${API}?action=bi_list`);
  const json = await res.json();
  const data = json.data || [];

  renderKPIs(data);
  renderCharts(data);
}

/* ================= KPIs ================= */

function renderKPIs(data){

  let porta = 0;
  let transito = 0;
  let volume = 0;
  let frete = 0;
  let margem = 0;

  data.forEach(d=>{
    porta += Number(d.porta || 0);
    transito += Number(d.transito || 0);
    volume += Number(d.volume || 0);

    frete += Number(d.valorEmpresa || 0);
    margem += (Number(d.valorEmpresa || 0) - Number(d.valorMotorista || 0));
  });

  const total = porta + transito;
  const mediaFrete = frete / (data.length || 1);
  const mediaMargem = margem / (data.length || 1);

  document.getElementById("kPorta").innerText = porta;
  document.getElementById("kTransito").innerText = transito;
  document.getElementById("kTotal").innerText = total;
  document.getElementById("kVolume").innerText = (volume*38).toFixed(0) + " t";
  document.getElementById("kFrete").innerText = "R$ " + mediaFrete.toFixed(2);
  document.getElementById("kMargem").innerText = "R$ " + mediaMargem.toFixed(2);
}

/* ================= GRÁFICOS ================= */

function renderCharts(data){

  const filialMap = {};
  const clienteMap = {};
  const volumeMap = {};
  const portaMap = {};
  const transitoMap = {};

  data.forEach(d=>{
    const f = d.filial || "OUTROS";
    const c = d.cliente || "OUTROS";

    filialMap[f] = (filialMap[f] || 0) + 1;
    clienteMap[c] = (clienteMap[c] || 0) + 1;
    volumeMap[f] = (volumeMap[f] || 0) + Number(d.volume || 0);

    portaMap[f] = (portaMap[f] || 0) + Number(d.porta || 0);
    transitoMap[f] = (transitoMap[f] || 0) + Number(d.transito || 0);
  });

  buildChart("chartFilial", filialMap, "Veículos");
  buildChart("chartCliente", clienteMap, "Veículos");
  buildChart("chartVolume", volumeMap, "Volume");
  buildDualChart("chartPT", portaMap, transitoMap);
}

/* ================= FUNÇÕES ================= */

function buildChart(id, map, label){

  if(charts[id]) charts[id].destroy();

  charts[id] = new Chart(document.getElementById(id),{
    type:"bar",
    data:{
      labels:Object.keys(map),
      datasets:[{
        label:label,
        data:Object.values(map)
      }]
    },
    options:{
      responsive:true,
      plugins:{legend:{display:false}}
    }
  });
}

function buildDualChart(id, porta, transito){

  if(charts[id]) charts[id].destroy();

  charts[id] = new Chart(document.getElementById(id),{
    type:"bar",
    data:{
      labels:Object.keys(porta),
      datasets:[
        {label:"Porta", data:Object.values(porta)},
        {label:"Trânsito", data:Object.values(transito)}
      ]
    }
  });
}

loadBI();
