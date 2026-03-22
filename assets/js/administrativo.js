(function () {
"use strict";

const API_URL = "https://script.google.com/macros/s/AKfycb.../exec";

const FILIAIS = [
  "RIO VERDE",
  "ITUMBIARA",
  "JATAI",
  "MINEIROS"
];

const $ = (s)=>document.querySelector(s);

let DATA = { cheques: [] };
let filialSelecionada = "";

function upper(v){ return String(v||"").toUpperCase(); }

// ================= API =================

async function apiGet(params){
  const url = new URL(API_URL);
  Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
  const res = await fetch(url);
  return res.json();
}

async function apiPost(body){
  const res = await fetch(API_URL,{
    method:"POST",
    body: JSON.stringify(body)
  });
  return res.json();
}

// ================= LOAD =================

async function loadCheques(){
  const res = await apiGet({action:"cheques_list"});
  DATA.cheques = res.data || [];
}

// ================= RENDER =================

function renderFiliais(){
  const bar = $("#filialBar");
  bar.innerHTML = "";

  FILIAIS.forEach(f=>{
    const btn = document.createElement("button");
    btn.textContent = f;

    if(f === filialSelecionada){
      btn.classList.add("active");
    }

    btn.onclick = ()=>{
      filialSelecionada = f;
      renderCheques();
    };

    bar.appendChild(btn);
  });
}

function renderCheques(){
  const tbody = $("#chequesTbody");
  tbody.innerHTML = "";

  const list = DATA.cheques.filter(c=>upper(c.filial)===upper(filialSelecionada));

  list.forEach(c=>{
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${c.filial}</td>
      <td>${c.data}</td>
      <td>${c.sequencia}</td>
      <td>${c.responsavel}</td>
      <td>${c.status}</td>
      <td>${c.termoAssinado}</td>
      <td>
        <button class="btnUpload" data-id="${c.id}">
          ${c.termoArquivoUrl ? "TROCAR" : "UPLOAD"}
        </button>
      </td>
      <td>
        ${
          c.termoArquivoUrl
          ? `<a href="${c.termoArquivoUrl}" target="_blank">📄 Abrir</a>`
          : "-"
        }
      </td>
    `;

    tbody.appendChild(tr);
  });
}

// ================= UPLOAD =================

document.addEventListener("click",(e)=>{
  if(e.target.classList.contains("btnUpload")){
    const id = e.target.dataset.id;
    const input = $("#chequeFileInput");

    input.dataset.id = id;
    input.click();
  }
});

$("#chequeFileInput").addEventListener("change", async (e)=>{
  const file = e.target.files[0];
  const id = e.target.dataset.id;

  if(!file || !id) return;

  const reader = new FileReader();

  reader.onload = async function(){
    const base64 = reader.result.split(",")[1];

    const cheque = DATA.cheques.find(c=>c.id===id);

    try{
      await apiPost({
        action: "cheques_upload_termo",
        id: id,
        fileName: file.name,
        mimeType: file.type,
        base64: base64,
        filial: cheque.filial,
        sequencia: cheque.sequencia
      });

      alert("Upload realizado!");
      await reload();

    }catch(err){
      alert("Erro no upload");
    }
  };

  reader.readAsDataURL(file);
});

// ================= RELOAD =================

async function reload(){
  await loadCheques();
  renderFiliais();
  renderCheques();
}

// ================= INIT =================

async function init(){
  await loadCheques();

  filialSelecionada = FILIAIS[0];

  renderFiliais();
  renderCheques();
}

window.addEventListener("DOMContentLoaded", init);

})();
