/* patrimonio-br.js | NOVA FROTA | Gateway seguro */
(function(){
  "use strict";

  const STATE = { rows: [], editId: "", saving: false };
  const $ = (id) => document.getElementById(id);
  const text = (v) => String(v ?? "").trim();
  const upper = (v) => text(v).toUpperCase();
  const esc = (v) => text(v)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");

  function setStatus(message){
    const el = $("syncStatus");
    if(el) el.textContent = message;
  }

  function rowsFrom(result){
    const raw = result?.data;
    if(Array.isArray(raw)) return raw;
    if(Array.isArray(raw?.data)) return raw.data;
    if(Array.isArray(raw?.rows)) return raw.rows;
    return [];
  }

  function normalize(r){
    return {
      id: text(r?.id),
      filial: upper(r?.filial),
      estado: upper(r?.estado),
      equipamento: upper(r?.equipamento),
      numeroPatrimonio: upper(r?.numeroPatrimonio),
      posse: upper(r?.posse),
      status: upper(r?.status || "ATIVO"),
      observacao: text(r?.observacao),
      anexo1Nome: text(r?.anexo1Nome),
      anexo1Url: text(r?.anexo1Url),
      anexo2Nome: text(r?.anexo2Nome),
      anexo2Url: text(r?.anexo2Url)
    };
  }

  async function call(action, params = {}){
    if(!window.PortalAPI?.call){
      throw new Error("API segura do Portal não carregada.");
    }
    return window.PortalAPI.call("patrimonio", action, params);
  }

  async function load(){
    try{
      setStatus("🔄 Carregando...");
      const result = await call("read", { resource:"br" });
      STATE.rows = rowsFrom(result).map(normalize);
      fillFilters();
      render();
      setStatus("✅ Atualizado");
    }catch(error){
      console.error("[patrimonio-br] load:", error);
      setStatus("❌ Falha ao carregar");
      alert(error?.message || "Não foi possível carregar o patrimônio.");
    }
  }

  function filteredRows(){
    const filial = upper($("fFilialPatrimonio")?.value);
    const estado = upper($("fEstadoPatrimonio")?.value);
    const status = upper($("fStatusPatrimonio")?.value);
    const busca = upper($("fBuscaPatrimonio")?.value);

    return STATE.rows.filter((r) => {
      if(filial && r.filial !== filial) return false;
      if(estado && r.estado !== estado) return false;
      if(status && r.status !== status) return false;
      if(busca && !upper(JSON.stringify(r)).includes(busca)) return false;
      return true;
    });
  }

  function unique(field){
    return [...new Set(STATE.rows.map(r => upper(r[field])).filter(Boolean))]
      .sort((a,b) => a.localeCompare(b,"pt-BR"));
  }

  function setOptions(id, placeholder, values){
    const el = $(id);
    if(!el) return;
    const selected = el.value;
    el.innerHTML = `<option value="">${placeholder}</option>` +
      values.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
    if(values.includes(selected)) el.value = selected;
  }

  function fillFilters(){
    setOptions("fFilialPatrimonio", "Todas as filiais", unique("filial"));
    setOptions("fEstadoPatrimonio", "Todos os estados", unique("estado"));
    setOptions("fStatusPatrimonio", "Todos os status", unique("status"));
  }

  function statusClass(status){
    const s = upper(status).normalize("NFD").replace(/[\u0300-\u036f]/g,"");
    if(s === "ATIVO") return "ativo";
    if(s === "MANUTENCAO") return "manutencao";
    if(s === "BAIXADO") return "baixado";
    return "inativo";
  }

  function anexosHtml(r){
    const links = [];
    if(r.anexo1Url) links.push(`<a class="anexoTag" href="${esc(r.anexo1Url)}" target="_blank" rel="noopener">📎 ${esc(r.anexo1Nome || "Anexo 1")}</a>`);
    if(r.anexo2Url) links.push(`<a class="anexoTag" href="${esc(r.anexo2Url)}" target="_blank" rel="noopener">📎 ${esc(r.anexo2Nome || "Anexo 2")}</a>`);
    return links.join("") || "—";
  }

  function render(){
    const rows = filteredRows();
    const tbody = $("tbodyPatrimonio");
    if(!tbody) return;

    $("kpiTotalItens").textContent = String(STATE.rows.length);
    $("kpiAtivos").textContent = String(STATE.rows.filter(r => r.status === "ATIVO").length);
    $("kpiManutencao").textContent = String(STATE.rows.filter(r => upper(r.status).includes("MANUTEN")).length);
    $("kpiInativos").textContent = String(STATE.rows.filter(r => ["INATIVO","BAIXADO"].includes(r.status)).length);

    if(!rows.length){
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:22px;color:#64748B;font-weight:800;">Nenhum patrimônio encontrado.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${esc(r.filial)}</td>
        <td>${esc(r.estado)}</td>
        <td><b>${esc(r.equipamento)}</b></td>
        <td>${esc(r.numeroPatrimonio)}</td>
        <td>${esc(r.posse || "—")}</td>
        <td><span class="statusBadge ${statusClass(r.status)}">${esc(r.status)}</span></td>
        <td>${esc(r.observacao || "—")}</td>
        <td>${anexosHtml(r)}</td>
        <td class="num">
          <div class="acoesWrap">
            <button class="btnTiny ghost" type="button" data-edit="${esc(r.id)}">Editar</button>
            <button class="btnTiny" type="button" data-delete="${esc(r.id)}">Excluir</button>
          </div>
        </td>
      </tr>
    `).join("");
  }

  function setValue(id, value){ const el = $(id); if(el) el.value = value || ""; }

  function openModal(row = null){
    STATE.editId = row?.id || "";
    $("modalPatrimonioTitle").textContent = row ? "Editar Patrimônio" : "Novo Patrimônio";
    setValue("mFilialPatrimonio", row?.filial);
    setValue("mEstadoPatrimonio", row?.estado);
    setValue("mEquipamentoPatrimonio", row?.equipamento);
    setValue("mNumeroPatrimonio", row?.numeroPatrimonio);
    setValue("mPossePatrimonio", row?.posse);
    setValue("mStatusPatrimonio", row?.status || "ATIVO");
    setValue("mObsPatrimonio", row?.observacao);
    setValue("mAnexosPatrimonio", "");
    renderSelectedFiles();
    $("modalPatrimonio")?.classList.add("isOpen");
    $("modalPatrimonio")?.setAttribute("aria-hidden","false");
  }

  function closeModal(){
    if(STATE.saving) return;
    $("modalPatrimonio")?.classList.remove("isOpen");
    $("modalPatrimonio")?.setAttribute("aria-hidden","true");
    STATE.editId = "";
  }

  function renderSelectedFiles(){
    const files = [...($("mAnexosPatrimonio")?.files || [])];
    const list = $("listaArquivosPatrimonio");
    if(list) list.innerHTML = files.map(f => `<span class="fileChip">📎 ${esc(f.name)}</span>`).join("");
  }

  function readFile(file){
    return new Promise((resolve,reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        resolve({
          fileName:file.name,
          mimeType:file.type || "application/octet-stream",
          base64Data:result.includes(",") ? result.split(",")[1] : result
        });
      };
      reader.onerror = () => reject(new Error(`Falha ao ler ${file.name}`));
      reader.readAsDataURL(file);
    });
  }

  async function save(){
    if(STATE.saving) return;

    const payload = {
      resource:"br",
      filial:upper($("mFilialPatrimonio")?.value),
      estado:upper($("mEstadoPatrimonio")?.value),
      equipamento:upper($("mEquipamentoPatrimonio")?.value),
      numeroPatrimonio:upper($("mNumeroPatrimonio")?.value),
      posse:upper($("mPossePatrimonio")?.value),
      status:upper($("mStatusPatrimonio")?.value || "ATIVO"),
      observacao:text($("mObsPatrimonio")?.value)
    };

    if(!payload.filial || !payload.estado || !payload.equipamento || !payload.numeroPatrimonio){
      alert("Preencha Filial, Estado, Equipamento e Número Patrimônio.");
      return;
    }

    const files = [...($("mAnexosPatrimonio")?.files || [])];
    if(files.length > 2){
      alert("Máximo de 2 anexos.");
      return;
    }

    const button = $("btnSaveModalPatrimonio");
    STATE.saving = true;
    if(button){ button.disabled = true; button.textContent = "Salvando..."; }

    try{
      const result = STATE.editId
        ? await call("update", { ...payload, id:STATE.editId })
        : await call("create", payload);

      const savedId = STATE.editId || text(result?.data?.id || result?.data?.row?.id);

      if(files.length){
        if(!savedId) throw new Error("Registro salvo, mas o ID não foi retornado para anexar os arquivos.");
        const encoded = await Promise.all(files.map(readFile));
        await call("update", { resource:"br-upload", id:savedId, files:encoded });
      }

      closeModal();
      await load();
    }catch(error){
      console.error("[patrimonio-br] save:", error);
      alert(error?.message || "Falha ao salvar patrimônio.");
    }finally{
      STATE.saving = false;
      if(button){ button.disabled = false; button.textContent = "Salvar"; }
    }
  }

  async function remove(id){
    const row = STATE.rows.find(r => r.id === id);
    if(!row || !confirm(`Excluir o patrimônio ${row.numeroPatrimonio}?`)) return;
    try{
      setStatus("🗑️ Excluindo...");
      await call("delete", { resource:"br", id });
      await load();
    }catch(error){
      console.error("[patrimonio-br] delete:", error);
      alert(error?.message || "Falha ao excluir patrimônio.");
      setStatus("❌ Falha ao excluir");
    }
  }

  function bind(){
    $("btnReloadPatrimonio")?.addEventListener("click", load);
    $("btnNovoPatrimonio")?.addEventListener("click", () => openModal());
    $("btnCloseModalPatrimonio")?.addEventListener("click", closeModal);
    $("btnCancelModalPatrimonio")?.addEventListener("click", closeModal);
    $("btnSaveModalPatrimonio")?.addEventListener("click", save);
    $("mAnexosPatrimonio")?.addEventListener("change", renderSelectedFiles);

    ["fFilialPatrimonio","fEstadoPatrimonio","fStatusPatrimonio"].forEach(id => $(id)?.addEventListener("change", render));
    $("fBuscaPatrimonio")?.addEventListener("input", render);

    $("tbodyPatrimonio")?.addEventListener("click", (event) => {
      const target = event.target;
      if(!(target instanceof HTMLElement)) return;
      const editId = target.getAttribute("data-edit");
      const deleteId = target.getAttribute("data-delete");
      if(editId) openModal(STATE.rows.find(r => r.id === editId));
      if(deleteId) remove(deleteId);
    });

    $("modalPatrimonio")?.addEventListener("click", (event) => {
      if(event.target === $("modalPatrimonio")) closeModal();
    });
  }

  window.addEventListener("DOMContentLoaded", async () => {
    bind();
    await load();
  });
})();