/* cadastros.js | NOVA FROTA */
(function(){
  "use strict";

  const API_URL =
    "https://script.google.com/macros/s/AKfycbyIeygrlaQVPq0puz1uxztLHSg0bsjxBcGFuZ9IR4CXqB2DqWMf3gPPFVk4FI0B-i45/exec";

  const CONFIG = {
    usuarios: {
      title: "Usuário",
      list: "usuarios_list",
      add: "usuarios_add",
      update: "usuarios_update",
      toggle: "usuarios_toggle",
      idField: "Usuario",
      columns: [
        ["Usuario","Usuário"],
        ["Nome","Nome"],
        ["Perfil","Perfil"],
        ["Estados","Estados"],
        ["Ativo","Status"]
      ],
      fields: [
        { key:"Usuario", label:"Usuário", required:true },
        { key:"Senha", label:"Senha", type:"password", requiredOnCreate:true, hint:"Na edição, deixe vazio para manter a senha atual." },
        { key:"Nome", label:"Nome", required:true },
        { key:"Perfil", label:"Perfil", type:"select", options:["ADMINISTRADOR","OPERACIONAL","COMERCIAL","PISO","GOADM"], required:true },
        { key:"Estados", label:"Estados / acessos", required:true, hint:"Exemplo: GO,MT ou ADMINISTRADOR" },
        { key:"Ativo", label:"Ativo", type:"select", options:["SIM","NÃO"], required:true }
      ]
    },

    regionais: {
      title: "Regional",
      list: "regionais_list",
      add: "regionais_add",
      update: "regionais_update",
      toggle: "regionais_toggle",
      idField: "id",
      columns: [
        ["regional","Regional"],
        ["ordem","Ordem"],
        ["ativo","Status"]
      ],
      fields: [
        { key:"regional", label:"Regional", required:true },
        { key:"ordem", label:"Ordem", type:"number" },
        { key:"ativo", label:"Ativo", type:"select", options:["SIM","NÃO"], required:true }
      ]
    },

    filiais: {
      title: "Filial",
      list: "filiais_list",
      add: "filiais_add",
      update: "filiais_update",
      toggle: "filiais_toggle",
      idField: "id",
      columns: [
        ["regional","Regional"],
        ["filial","Filial"],
        ["ordem","Ordem"],
        ["ativo","Status"]
      ],
      fields: [
        { key:"regional", label:"Regional", required:true },
        { key:"filial", label:"Filial", required:true },
        { key:"ordem", label:"Ordem", type:"number" },
        { key:"ativo", label:"Ativo", type:"select", options:["SIM","NÃO"], required:true }
      ]
    },

    clientes: {
      title: "Cliente",
      list: "clientes_list",
      add: "clientes_add",
      update: "clientes_update",
      toggle: "clientes_toggle",
      idField: "id",
      columns: [
        ["cliente","Cliente"],
        ["ordem","Ordem"],
        ["ativo","Status"]
      ],
      fields: [
        { key:"cliente", label:"Cliente", required:true },
        { key:"ordem", label:"Ordem", type:"number" },
        { key:"ativo", label:"Ativo", type:"select", options:["SIM","NÃO"], required:true }
      ]
    },

    contatos: {
      title: "Contato",
      list: "contatos_list",
      add: "contatos_add",
      update: "contatos_update",
      toggle: "contatos_toggle",
      idField: "id",
      columns: [
        ["regional","Regional"],
        ["filial","Filial"],
        ["nome","Nome"],
        ["telefone","Telefone"],
        ["ordem","Ordem"],
        ["ativo","Status"]
      ],
      fields: [
        { key:"regional", label:"Regional", required:true },
        { key:"filial", label:"Filial", required:true },
        { key:"nome", label:"Nome", required:true },
        { key:"telefone", label:"Telefone", required:true, hint:"Pode digitar com DDD. O sistema salva somente os números." },
        { key:"ordem", label:"Ordem", type:"number" },
        { key:"ativo", label:"Ativo", type:"select", options:["SIM","NÃO"], required:true }
      ]
    },

    funcionarios: {
      title: "Funcionário",
      list: "funcionarios_list",
      add: "funcionarios_add",
      update: "funcionarios_update",
      toggle: "funcionarios_toggle",
      idField: "id",
      columns: [
        ["regional","Regional"],
        ["filial","Filial"],
        ["nome","Nome"],
        ["cargo","Cargo"],
        ["telefone","Telefone"],
        ["email","E-mail"],
        ["ativo","Status"]
      ],
      fields: [
        { key:"regional", label:"Regional", required:true },
        { key:"filial", label:"Filial", required:true },
        { key:"nome", label:"Nome", required:true },
        { key:"cargo", label:"Cargo" },
        { key:"telefone", label:"Telefone" },
        { key:"email", label:"E-mail", type:"email" },
        { key:"ativo", label:"Ativo", type:"select", options:["SIM","NÃO"], required:true }
      ]
    }
  };

  const STATE = {
    tab:"usuarios",
    rows:[],
    editing:null,
    busy:false
  };

  const $ = (s) => document.querySelector(s);

  function safe(v){
    return String(v ?? "").trim();
  }

  function upper(v){
    return safe(v).toUpperCase();
  }

  function setStatus(text){
    const el = $("#cadStatus");
    if(el) el.textContent = text;
  }

  function jsonp(url, timeoutMs = 35000){
    return new Promise((resolve, reject) => {
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
        url.searchParams.set(key, value);
      }
    });
    return url.toString();
  }

  async function api(params){
    const res = await jsonp(buildUrl(params));
    if(!res || res.ok === false){
      throw new Error(res?.error || "Erro na API.");
    }
    return res;
  }

  function configAtual(){
    return CONFIG[STATE.tab];
  }

  function isAtivo(row){
    return upper(row.Ativo ?? row.ativo) === "SIM";
  }

  function statusPill(value){
    const ativo = upper(value) === "SIM";
    const span = document.createElement("span");
    span.className = "pill " + (ativo ? "on" : "off");
    span.textContent = ativo ? "ATIVO" : "INATIVO";
    return span;
  }

  function formatCell(key, value){
    if(["Ativo","ativo"].includes(key)){
      return statusPill(value);
    }

    const span = document.createElement("span");
    span.textContent = safe(value) || "-";
    return span;
  }

  function filteredRows(){
    const busca = upper($("#buscaCadastro")?.value);
    if(!busca) return STATE.rows;

    return STATE.rows.filter((row) => {
      return upper(JSON.stringify(row)).includes(busca);
    });
  }

  function render(){
    const cfg = configAtual();
    const head = $("#cadHead");
    const body = $("#cadBody");

    head.innerHTML = "";
    body.innerHTML = "";

    const trh = document.createElement("tr");

    cfg.columns.forEach(([,label]) => {
      const th = document.createElement("th");
      th.textContent = label;
      trh.appendChild(th);
    });

    const thAcoes = document.createElement("th");
    thAcoes.textContent = "Ações";
    trh.appendChild(thAcoes);
    head.appendChild(trh);

    const rows = filteredRows();

    if(!rows.length){
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = cfg.columns.length + 1;
      td.className = "empty";
      td.textContent = "Nenhum registro encontrado.";
      tr.appendChild(td);
      body.appendChild(tr);
      return;
    }

    rows.forEach((row) => {
      const tr = document.createElement("tr");

      cfg.columns.forEach(([key]) => {
        const td = document.createElement("td");
        td.appendChild(formatCell(key, row[key]));
        tr.appendChild(td);
      });

      const tdActions = document.createElement("td");
      const wrap = document.createElement("div");
      wrap.className = "actionsCell";

      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "mini edit";
      edit.textContent = "Editar";
      edit.onclick = () => openModal(row);

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "mini toggle";
      toggle.textContent = isAtivo(row) ? "Desativar" : "Ativar";
      toggle.onclick = () => toggleRow(row);

      wrap.append(edit, toggle);
      tdActions.appendChild(wrap);
      tr.appendChild(tdActions);
      body.appendChild(tr);
    });
  }

  async function loadCurrent(){
    if(STATE.busy) return;

    STATE.busy = true;
    setStatus("🔄 Carregando " + configAtual().title.toLowerCase() + "...");

    try{
      const res = await api({ action:configAtual().list });
      STATE.rows = Array.isArray(res.data) ? res.data : [];
      render();
      setStatus("✅ " + STATE.rows.length + " registro(s)");
    }catch(error){
      console.error("[cadastros] carregar:", error);
      STATE.rows = [];
      render();
      setStatus("❌ Erro ao carregar");
      alert(error.message);
    }finally{
      STATE.busy = false;
    }
  }

  function createInput(field, value){
    const wrap = document.createElement("div");
    wrap.className = "field" + (field.full ? " full" : "");

    const label = document.createElement("label");
    label.htmlFor = "fld_" + field.key;
    label.textContent = field.label + (field.required ? " *" : "");

    let input;

    if(field.type === "select"){
      input = document.createElement("select");

      (field.options || []).forEach((option) => {
        const op = document.createElement("option");
        op.value = option;
        op.textContent = option;
        input.appendChild(op);
      });
    }else{
      input = document.createElement("input");
      input.type = field.type || "text";
    }

    input.id = "fld_" + field.key;
    input.name = field.key;
    input.value = value ?? (field.key === "Ativo" || field.key === "ativo" ? "SIM" : "");

    if(field.required && !(field.requiredOnCreate && STATE.editing)){
      input.required = true;
    }

    wrap.append(label, input);

    if(field.hint){
      const hint = document.createElement("div");
      hint.className = "hint";
      hint.textContent = field.hint;
      wrap.appendChild(hint);
    }

    return wrap;
  }

  function openModal(row){
    STATE.editing = row || null;

    const cfg = configAtual();
    $("#modalTitle").textContent =
      (row ? "Editar " : "Novo ") + cfg.title;

    const fields = $("#formFields");
    fields.innerHTML = "";

    cfg.fields.forEach((field) => {
      fields.appendChild(createInput(field, row ? row[field.key] : ""));
    });

    $("#cadModal").classList.add("show");
    $("#cadModal").setAttribute("aria-hidden","false");

    setTimeout(() => {
      fields.querySelector("input,select")?.focus();
    }, 40);
  }

  function closeModal(){
    if(STATE.busy) return;
    $("#cadModal").classList.remove("show");
    $("#cadModal").setAttribute("aria-hidden","true");
    STATE.editing = null;
    $("#cadForm").reset();
  }

  function collectForm(){
    const cfg = configAtual();
    const payload = {};

    cfg.fields.forEach((field) => {
      const el = $("#fld_" + field.key);
      payload[field.key] = safe(el?.value);

      const requiredNow =
        field.required ||
        (field.requiredOnCreate && !STATE.editing);

      if(requiredNow && !payload[field.key]){
        throw new Error("Preencha o campo: " + field.label);
      }
    });

    return payload;
  }

  async function save(){
    if(STATE.busy) return;

    let payload;

    try{
      payload = collectForm();
    }catch(error){
      alert(error.message);
      return;
    }

    const cfg = configAtual();
    const editing = !!STATE.editing;

    if(editing){
      if(STATE.tab === "usuarios"){
        payload.usuarioOriginal = STATE.editing.Usuario;
      }else{
        payload.id = STATE.editing[cfg.idField];
      }
    }

    STATE.busy = true;
    $("#btnSalvar").disabled = true;
    setStatus("💾 Salvando...");

    try{
      await api({
        action:editing ? cfg.update : cfg.add,
        ...payload
      });

      closeModal();
      await loadCurrent();
      setStatus("✅ Cadastro salvo");
    }catch(error){
      console.error("[cadastros] salvar:", error);
      setStatus("❌ Erro ao salvar");
      alert(error.message);
    }finally{
      STATE.busy = false;
      $("#btnSalvar").disabled = false;
    }
  }

  async function toggleRow(row){
    if(STATE.busy) return;

    const cfg = configAtual();
    const novoAtivo = isAtivo(row) ? "NÃO" : "SIM";

    const nome =
      row.Usuario || row.regional || row.filial ||
      row.cliente || row.nome || "registro";

    if(!confirm(
      (novoAtivo === "SIM" ? "Ativar " : "Desativar ") +
      nome + "?"
    )){
      return;
    }

    const payload = {
      action:cfg.toggle,
      ativo:novoAtivo
    };

    if(STATE.tab === "usuarios"){
      payload.usuario = row.Usuario;
    }else{
      payload.id = row[cfg.idField];
    }

    STATE.busy = true;
    setStatus("⏳ Atualizando status...");

    try{
      await api(payload);
      await loadCurrent();
      setStatus("✅ Status atualizado");
    }catch(error){
      console.error("[cadastros] toggle:", error);
      setStatus("❌ Erro ao atualizar");
      alert(error.message);
    }finally{
      STATE.busy = false;
    }
  }

  function bind(){
    $("#tabs").addEventListener("click", (event) => {
      const button = event.target.closest("[data-tab]");
      if(!button) return;

      STATE.tab = button.dataset.tab;
      STATE.rows = [];
      STATE.editing = null;

      document.querySelectorAll(".tabBtn").forEach((btn) => {
        btn.classList.toggle("active", btn === button);
      });

      $("#buscaCadastro").value = "";
      loadCurrent();
    });

    $("#buscaCadastro").addEventListener("input", render);
    $("#btnAtualizar").addEventListener("click", loadCurrent);
    $("#btnNovo").addEventListener("click", () => openModal(null));
    $("#btnSalvar").addEventListener("click", save);
    $("#btnCancelar").addEventListener("click", closeModal);
    $("#btnFecharModal").addEventListener("click", closeModal);

    $("#cadModal").addEventListener("click", (event) => {
      if(event.target === $("#cadModal")) closeModal();
    });

    document.addEventListener("keydown", (event) => {
      if(event.key === "Escape") closeModal();
    });
  }

  async function init(){
    bind();

    const selectedState = upper(
      localStorage.getItem("nf_auth_state")
    );

    if(selectedState !== "ADMINISTRADOR"){
      alert("Acesso permitido somente ao administrador.");
      window.location.href = "./home.html";
      return;
    }

    await loadCurrent();
  }

  window.addEventListener("DOMContentLoaded", init);
})();
