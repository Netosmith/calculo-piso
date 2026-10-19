(() => {
  "use strict";
  const API = "https://api.portalfrete.net.br/v1/fleet";
  const LEGACY = "nf_frota_identificacoes_v1";
  const form = document.getElementById("nfcForm");
  if (!form) return;
  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
  const cleanPlate = text => String(text || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
  const types = {
    cnh: "CNH",
    cavalo: "Documento cavalo",
    carreta: "Documento carreta",
    antt: "ANTT",
    endereco: "Comprovante de endereço",
    fotoCaminhao: "Foto do caminhão",
    fotoMotorista: "Motorista em frente ao caminhão",
    fotoMotoristaCNH: "Motorista segurando CNH",
    fotoMotoristaIndividual: "Foto individual do motorista"
  };
  const inputs = [...form.querySelectorAll("[data-nfc-file]")];
  let records = [], selected = null, docs = [], busy = false, connected = false;

  async function request(path, { method = "GET", json, file, download = false } = {}) {
    const headers = { Accept: download ? "*/*" : "application/json" };
    if (json !== undefined) headers["Content-Type"] = "application/json";
    if (file) headers["Content-Type"] = file.type || "application/octet-stream";
    const response = await fetch(API + path, {
      method, credentials: "include", cache: "no-store", headers,
      body: json !== undefined ? JSON.stringify(json) : file || undefined
    });
    if (download && response.ok) return response.blob();
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      const error = new Error(data.error || "Não foi possível concluir a operação online.");
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function status(message, error = false) {
    const el = byId("nfcOnlineStatus");
    el.textContent = message;
    el.style.color = error ? "#b91c1c" : "#146c55";
  }
  function feedback(message, error = false) {
    const el = byId("nfcFeedback");
    el.textContent = message;
    el.style.color = error ? "#b91c1c" : "#146c55";
  }
  function lock(value) {
    busy = value;
    form.querySelectorAll("button").forEach(button => button.disabled = value);
    byId("nfcReload").disabled = value;
    byId("nfcMigrate").disabled = value;
  }
  function legacyRows() {
    try {
      const rows = JSON.parse(localStorage.getItem(LEGACY) || "[]");
      return Array.isArray(rows) ? rows.filter(r => r && r.driver && r.tractor && r.trailer) : [];
    } catch { return []; }
  }
  function migrationAvailable() {
    const size = legacyRows().length;
    byId("nfcMigrate").hidden = !size;
    if (size) byId("nfcMigrate").textContent = "Importar " + size + " cadastro(s) antigos do navegador";
  }

  function render() {
    byId("nfcList").innerHTML = records.length
      ? '<table class="nfg-table"><thead><tr><th>Motorista</th><th>Telefone</th><th>Cavalo</th><th>Carreta</th><th>Ações</th></tr></thead><tbody>' +
        records.map(r => '<tr><td>' + esc(r.driver) + '</td><td>' + esc(r.phone || "") +
          '</td><td>' + esc(r.tractor) + '</td><td>' + esc(r.trailer) +
          '</td><td style="white-space:nowrap"><button class="nfg-action secondary" type="button" data-nfc-edit="' + esc(r.id) + '">Editar / documentos</button> ' +
          '<button class="nfg-action secondary" type="button" data-nfc-download="' + esc(r.id) + '">Baixar ficha</button> ' +
          '<button class="nfg-action secondary" type="button" data-nfc-delete="' + esc(r.id) + '">Excluir</button></td></tr>').join("") +
        '</tbody></table>'
      : '<p class="nfg-muted">Nenhum conjunto cadastrado online.</p>';
    migrationAvailable();
  }
  function selectedFiles() {
    return inputs.filter(el => el.files && el.files.length).map(el => ({
      kind: el.dataset.nfcFile, file: el.files[0]
    }));
  }
  function refreshFiles() {
    const names = selectedFiles().map(x => (types[x.kind] || x.kind) + ": " + x.file.name);
    byId("nfcFilesStatus").textContent = names.length
      ? "Arquivos selecionados para envio: " + names.join(" • ")
      : "Selecione documentos para enviar ou substituir. Os existentes permanecem no R2.";
  }
  function renderDocs() {
    const area = byId("nfcStoredDocuments"), list = byId("nfcDocumentsList");
    area.hidden = !selected;
    if (!selected) return;
    const byType = new Map(docs.map(d => [d.doc_type, d]));
    list.innerHTML = '<table class="nfg-table"><thead><tr><th>Documento</th><th>Situação</th><th>Ações</th></tr></thead><tbody>' +
      Object.entries(types).map(([type, label]) => {
        const d = byType.get(type);
        return '<tr><td>' + esc(label) + '</td><td>' +
          (d ? 'Armazenado • ' + esc(new Date(d.uploaded_at.replace(" ", "T") + "Z").toLocaleDateString("pt-BR")) : 'Pendente') +
          '</td><td>' + (d
            ? '<button type="button" class="nfg-action secondary" data-nfc-get="' + esc(d.id) + '">Baixar</button> ' +
              '<button type="button" class="nfg-action secondary" data-nfc-remove="' + esc(d.id) + '">Remover</button>'
            : 'Escolha o arquivo acima e salve') + '</td></tr>';
      }).join("") + '</tbody></table>';
  }
  async function loadDocs(id) {
    if (!id) { docs = []; renderDocs(); return; }
    const result = await request("/documents?set_id=" + encodeURIComponent(id));
    if (selected === id) { docs = result.documents || []; renderDocs(); }
  }
  async function load() {
    status("Carregando cadastros online...");
    try {
      const result = await request("/sets");
      connected = true;
      records = Array.isArray(result.sets) ? result.sets : [];
      render();
      status(records.length + " conjunto(s) online. D1 conectado.");
      if (selected) {
        if (records.some(x => x.id === selected)) await loadDocs(selected);
        else reset();
      }
    } catch (err) {
      connected = false;
      records = [];
      render();
      status("Falha de conexão: " + err.message, true);
      feedback("Nenhum dado local será usado como se estivesse salvo online. Faça login no Portal e tente novamente.", true);
    }
  }
  function reset() {
    selected = null;
    form.reset();
    docs = [];
    renderDocs();
    refreshFiles();
    feedback("Pronto para cadastrar novo conjunto online.");
  }
  function select(r) {
    selected = r.id;
    form.elements.driver.value = r.driver || "";
    form.elements.phone.value = r.phone || "";
    form.elements.tractor.value = r.tractor || "";
    form.elements.trailer.value = r.trailer || "";
    inputs.forEach(input => { input.value = ""; });
    refreshFiles();
    feedback("Editando conjunto " + r.tractor + ". Você pode substituir seus documentos.");
    loadDocs(r.id).catch(err => feedback("Falha ao carregar documentos: " + err.message, true));
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob), anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function csvCell(x) { return '"' + String(x ?? "").replace(/"/g, '""').replace(/^[=+@-]/, value => "'" + value) + '"'; }
  function downloadCard(record) {
    const pairs = [
      ["CAMPO", "VALOR"], ["Motorista", record.driver],
      ["Telefone", record.phone || ""], ["Placa cavalo", record.tractor],
      ["Placa carreta", record.trailer], ["Documentos", "Acesse no Portal Frete para baixar arquivos privados"]
    ];
    const content = "\uFEFF" + pairs.map(row => row.map(csvCell).join(";")).join("\r\n");
    downloadFile(new Blob([content], { type: "text/csv;charset=utf-8" }), "ficha-" + record.tractor + ".csv");
  }

  inputs.forEach(input => input.addEventListener("change", () => {
    if (input.files && input.files[0] && input.files[0].size > 15 * 1024 * 1024) {
      input.value = "";
      feedback("Arquivo maior que 15 MB.", true);
    }
    refreshFiles();
  }));

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy || !connected) { feedback("A conexão online precisa estar ativa para salvar.", true); return; }
    const record = {
      driver: form.elements.driver.value.trim(),
      phone: form.elements.phone.value.trim(),
      tractor: cleanPlate(form.elements.tractor.value),
      trailer: cleanPlate(form.elements.trailer.value)
    };
    if (!record.driver || record.tractor.length !== 7 || record.trailer.length !== 7) {
      feedback("Informe nome e placas completas de 7 caracteres.", true);
      return;
    }
    const pending = selectedFiles();
    if (pending.some(x => !x.file.type)) {
      feedback("Um arquivo não possui tipo identificável. Use PDF, JPG, PNG ou WebP.", true);
      return;
    }
    lock(true);
    try {
      feedback("Salvando identificação no D1...");
      const result = await request(selected ? "/sets/" + selected : "/sets", {
        method: selected ? "PUT" : "POST", json: record
      });
      const id = result.id;
      selected = id;
      let sent = 0;
      const failures = [];
      for (const entry of pending) {
        try {
          feedback("Enviando " + (types[entry.kind] || entry.kind) + " ao R2 (" + (sent + failures.length + 1) + "/" + pending.length + ")...");
          await request("/documents?set_id=" + encodeURIComponent(id) + "&type=" + encodeURIComponent(entry.kind), { method: "POST", file: entry.file });
          sent++;
          const input = inputs.find(x => x.dataset.nfcFile === entry.kind);
          if (input) input.value = "";
        } catch (err) {
          failures.push((types[entry.kind] || entry.kind) + ": " + err.message);
        }
      }
      await load();
      if (selected) await loadDocs(selected);
      refreshFiles();
      feedback(failures.length ? "Cadastro salvo. " + sent + " arquivo(s) enviado(s); falhas: " + failures.join(" | ") : "Cadastro e " + sent + " arquivo(s) gravados online no Cloudflare.", !!failures.length);
      if (!failures.length) { form.reset(); selected = null; docs = []; renderDocs(); }
    } catch (err) { feedback("Não foi possível salvar: " + err.message, true); }
    finally { lock(false); }
  });

  byId("nfcClear").addEventListener("click", reset);
  byId("nfcReload").addEventListener("click", load);
  byId("nfcList").addEventListener("click", async event => {
    if (busy || !connected) return;
    const button = event.target.closest("button");
    if (!button) return;
    const id = button.dataset.nfcEdit || button.dataset.nfcDownload || button.dataset.nfcDelete;
    const record = records.find(x => x.id === id);
    if (!record) return;
    if (button.dataset.nfcEdit) return select(record);
    if (button.dataset.nfcDownload) return downloadCard(record);
    if (button.dataset.nfcDelete) {
      if (!confirm("Excluir permanentemente o conjunto de " + record.driver + ", incluindo TODOS os documentos armazenados no R2?")) return;
      lock(true);
      try {
        await request("/sets/" + id, { method: "DELETE" });
        if (selected === id) reset();
        await load();
        feedback("Cadastro e documentos excluídos online.");
      } catch (err) { feedback("Falha na exclusão: " + err.message, true); }
      finally { lock(false); }
    }
  });
  byId("nfcStoredDocuments").addEventListener("click", async event => {
    const button = event.target.closest("button");
    if (!button || busy || !connected || !selected) return;
    const id = button.dataset.nfcGet || button.dataset.nfcRemove;
    const doc = docs.find(x => x.id === id);
    if (!doc) return;
    if (button.dataset.nfcGet) {
      try {
        const blob = await request("/documents/" + id, { download: true });
        const ext = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[doc.mime] || "bin";
        downloadFile(blob, doc.doc_type + "-" + (records.find(r => r.id === selected)?.tractor || "conjunto") + "." + ext);
      } catch (err) { feedback("Falha ao baixar documento: " + err.message, true); }
    } else if (button.dataset.nfcRemove) {
      if (!confirm("Excluir este documento armazenado no Cloudflare?")) return;
      lock(true);
      try {
        await request("/documents/" + id, { method: "DELETE" });
        await loadDocs(selected);
        feedback("Documento removido do R2.");
      } catch (err) { feedback("Falha ao remover documento: " + err.message, true); }
      finally { lock(false); }
    }
  });

  byId("nfcMigrate").addEventListener("click", async () => {
    if (!connected || busy) return;
    const old = legacyRows();
    const known = new Set(records.map(r => [cleanPlate(r.tractor), cleanPlate(r.trailer), r.driver.trim().toUpperCase()].join("|")));
    const pending = old.filter(r => !known.has([cleanPlate(r.tractor), cleanPlate(r.trailer), String(r.driver).trim().toUpperCase()].join("|")));
    if (!pending.length) { feedback("Todos os cadastros antigos já constam na lista online."); return; }
    if (!confirm("Importar " + pending.length + " identificação(ões) antigas para o D1? Os arquivos não existiam no armazenamento antigo. Os registros locais serão preservados para segurança.")) return;
    lock(true);
    let imported = 0;
    try {
      for (const row of pending) {
        await request("/sets", { method: "POST", json: {
          driver: String(row.driver), phone: String(row.phone || ""),
          tractor: cleanPlate(row.tractor), trailer: cleanPlate(row.trailer)
        } });
        imported++;
      }
      feedback(imported + " cadastro(s) migrado(s) com sucesso. Os dados antigos continuam no navegador como backup.");
    } catch (err) {
      feedback(imported + " cadastro(s) importado(s), mas houve erro: " + err.message, true);
    } finally { lock(false); await load(); }
  });

  refreshFiles();
  renderDocs();
  load();
})();