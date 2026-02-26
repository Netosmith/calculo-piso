/* =========================================
   NOVA FROTA - ADMINISTRATIVO API (WebApp) v2
   =========================================
   UPLOAD CHUNKED via JSONP GET:
   - action=upload_chunk   → armazena pedaço do base64
   - action=upload_finalize → junta tudo e cria arquivo no Drive

   Outros endpoints (inalterados):
   - action=cheques_list
   - action=cheques_get
   - action=cheques_add
   - action=cheques_update
   - action=drive_upload (compatibilidade — arquivos pequenos)
========================================= */

var SHEET_CHEQUES = "CHEQUES";

// ─── ENTRYPOINT GET (JSONP) ──────────────────────────────
function doGet(e) {
  var action = String((e.parameter && e.parameter.action) || "").toLowerCase();
  var cb     = String((e.parameter && e.parameter.callback) || "").trim();

  try {
    if (action === "cheques_list")    return outOk(listCheques_(), cb);
    if (action === "cheques_get")     return outOk(getChequeById_(e.parameter.id || ""), cb);
    if (action === "cheques_add")     return outOk(addCheque_(e.parameter), cb);
    if (action === "cheques_update")  return outOk(updateCheque_(e.parameter), cb);

    // ── Upload chunked ──────────────────────────────────
    if (action === "upload_chunk")    return outOk(saveChunk_(e.parameter), cb);
    if (action === "upload_finalize") return outOk(finalizeUpload_(e.parameter), cb);

    // ── Compatibilidade: upload base64 completo (arquivos pequenos) ──
    if (action === "drive_upload")    return outOk(driveUploadBase64_(e.parameter), cb);

    return outErr("Ação inválida: " + action, cb);
  } catch (err) {
    return outErr(err && err.message ? err.message : String(err), cb);
  }
}

// ─── ENTRYPOINT POST (fallback JSON) ────────────────────
function doPost(e) {
  try {
    var ctype  = String((e.postData && e.postData.type) || "").toLowerCase();
    var action = String((e.parameter && e.parameter.action) || "").toLowerCase();

    if (ctype.includes("application/json")) {
      var body   = JSON.parse((e.postData && e.postData.contents) || "{}");
      var bAction = String(body.action || "").toLowerCase();
      if (bAction === "cheques_add")    return outOk(addCheque_(body),         "");
      if (bAction === "cheques_update") return outOk(updateCheque_(body),      "");
      if (bAction === "drive_upload")   return outOk(driveUploadBase64_(body), "");
      return outErr("Ação inválida: " + bAction, "");
    }

    return outErr("Use JSONP GET para upload.", "");
  } catch (err) {
    return outErr(String(err && err.message ? err.message : err), "");
  }
}

// ─── UPLOAD CHUNKED ─────────────────────────────────────

/**
 * Recebe um pedaço (chunk) do base64 e armazena em PropertiesService.
 * Parâmetros: uploadId, chunk (índice), total, data (trecho base64)
 */
function saveChunk_(p) {
  var uploadId = String(p.uploadId || "").trim();
  var chunk    = parseInt(String(p.chunk || "0"), 10);
  var total    = parseInt(String(p.total || "1"), 10);
  var data     = String(p.data || "");

  if (!uploadId) throw new Error("uploadId obrigatório.");
  if (!data)     throw new Error("data (chunk base64) obrigatório.");

  var props = PropertiesService.getScriptProperties();
  var key   = "upload_" + uploadId + "_" + chunk;

  props.setProperty(key, data);

  return { uploadId: uploadId, chunk: chunk, total: total, saved: true };
}

/**
 * Junta todos os chunks salvos, cria o arquivo no Drive e limpa os dados.
 * Parâmetros: uploadId, total, folderId, filial, type, ref, filename, mimeType
 */
function finalizeUpload_(p) {
  var uploadId  = String(p.uploadId  || "").trim();
  var total     = parseInt(String(p.total || "1"), 10);
  var folderId  = String(p.folderId  || "").trim();
  var filial    = up_(p.filial || "");
  var typeRaw   = String(p.type || p.kind || "").trim().toLowerCase();
  var type      = typeRaw || "arquivo";
  var ref       = String(p.ref      || "").trim();
  var filename  = String(p.filename || "").trim();
  var mimeType  = String(p.mimeType || "application/octet-stream").trim();

  if (!uploadId) throw new Error("uploadId obrigatório.");
  if (!folderId) throw new Error("folderId obrigatório.");
  if (!filial)   throw new Error("filial obrigatória.");
  if (!filename) throw new Error("filename obrigatório.");

  // Junta os chunks na ordem
  var props  = PropertiesService.getScriptProperties();
  var base64 = "";
  var keys   = [];

  for (var i = 0; i < total; i++) {
    var key   = "upload_" + uploadId + "_" + i;
    var piece = props.getProperty(key);
    if (piece === null || piece === undefined) {
      throw new Error("Chunk " + i + " não encontrado. Tente novamente.");
    }
    base64 += piece;
    keys.push(key);
  }

  // Cria o arquivo no Drive
  var root         = DriveApp.getFolderById(folderId);
  var filialFolder = getOrCreateFolder_(root, filial);

  var subName =
    (type === "termo")     ? "CHEQUES"    :
    (type === "checklist") ? "CHECKLISTS" :
    "ARQUIVOS";

  var dest  = getOrCreateFolder_(filialFolder, subName);
  var bytes = Utilities.base64Decode(base64);
  var blob  = Utilities.newBlob(bytes, mimeType, filename);

  var stamp   = Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyyMMdd-HHmmss");
  var safeRef = ref ? (" - " + ref.replace(/[^\w\-\. ]+/g, "")) : "";
  blob.setName(type.toUpperCase() + safeRef + " - " + stamp + " - " + filename);

  var file    = dest.createFile(blob);
  var viewUrl = "https://drive.google.com/file/d/" + file.getId() + "/view";

  // Limpa os chunks do PropertiesService
  keys.forEach(function(k) {
    try { props.deleteProperty(k); } catch(e) {}
  });

  return {
    fileId:       file.getId(),
    name:         file.getName(),
    url:          viewUrl,
    folderFilial: filial,
    folderTipo:   subName
  };
}

// ─── DRIVE UPLOAD DIRETO (base64 completo — arquivos pequenos) ──
function driveUploadBase64_(p) {
  var folderId = String(p.folderId || "").trim();
  var filial   = up_(p.filial || "");
  var typeRaw  = String(p.type || p.kind || "").trim().toLowerCase();
  var type     = typeRaw || "arquivo";
  var ref      = String(p.ref      || "").trim();
  var filename = String(p.filename || "").trim();
  var mimeType = String(p.mimeType || "application/octet-stream").trim();
  var dataB64  = String(p.data     || "").trim();

  if (!folderId) throw new Error("folderId obrigatório.");
  if (!filial)   throw new Error("filial obrigatória.");
  if (!dataB64)  throw new Error("data (base64) obrigatório.");
  if (!filename) throw new Error("filename obrigatório.");

  var root         = DriveApp.getFolderById(folderId);
  var filialFolder = getOrCreateFolder_(root, filial);

  var subName =
    (type === "termo")     ? "CHEQUES"    :
    (type === "checklist") ? "CHECKLISTS" :
    "ARQUIVOS";

  var dest  = getOrCreateFolder_(filialFolder, subName);
  var bytes = Utilities.base64Decode(dataB64);
  var blob  = Utilities.newBlob(bytes, mimeType, filename);

  var stamp   = Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyyMMdd-HHmmss");
  var safeRef = ref ? (" - " + ref.replace(/[^\w\-\. ]+/g, "")) : "";
  blob.setName(type.toUpperCase() + safeRef + " - " + stamp + " - " + filename);

  var file    = dest.createFile(blob);
  var viewUrl = "https://drive.google.com/file/d/" + file.getId() + "/view";

  return {
    fileId:       file.getId(),
    name:         file.getName(),
    url:          viewUrl,
    folderFilial: filial,
    folderTipo:   subName
  };
}

function getOrCreateFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

// ─── CHEQUES (SHEET) ────────────────────────────────────
function shCheques_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SHEET_CHEQUES);
  if (!sh) throw new Error("Aba \"" + SHEET_CHEQUES + "\" não existe.");
  return sh;
}

function listCheques_() {
  var sh     = shCheques_();
  var values = sh.getDataRange().getValues();
  if (values.length <= 1) return [];

  var header = values[0].map(function(h) { return String(h).trim(); });
  var rows   = values.slice(1);

  return rows
    .filter(function(r) { return r.some(function(c) { return String(c || "").trim() !== ""; }); })
    .map(function(r) {
      var obj = {};
      header.forEach(function(h, i) { obj[h] = r[i]; });
      return obj;
    });
}

function getChequeById_(id) {
  id = String(id || "").trim();
  if (!id) return null;
  var all = listCheques_();
  return all.find(function(x) { return String(x.id) === id; }) || null;
}

function addCheque_(body) {
  var sh = shCheques_();

  var filial      = up_(body.filial);
  var data        = String(body.data        || "").trim();
  var sequencia   = String(body.sequencia   || "").trim();
  var responsavel = up_(body.responsavel);
  var status      = up_(body.status || "ATIVO");

  if (!filial)      throw new Error("Filial obrigatória.");
  if (!data)        throw new Error("Data obrigatória.");
  if (!sequencia)   throw new Error("Sequência obrigatória.");
  if (!responsavel) throw new Error("Responsável obrigatório.");

  var createdAt = Date.now();
  var id = filial + "-" + sequencia + "-" + data.replace(/\//g, "");

  var all = listCheques_();
  if (all.some(function(x) { return String(x.id) === id; })) {
    throw new Error("Já existe cheque com esse ID: " + id);
  }

  sh.appendRow([id, createdAt, filial, data, sequencia, responsavel, status, "", "", createdAt]);
  return { id: id };
}

function updateCheque_(body) {
  var sh = shCheques_();
  var id = String(body.id || "").trim();
  if (!id) throw new Error("ID obrigatório para update.");

  var values = sh.getDataRange().getValues();
  var header = values[0].map(function(h) { return String(h).trim(); });

  var idxId = header.indexOf("id");
  if (idxId < 0) throw new Error("Coluna \"id\" não encontrada.");

  var rowIndex = -1;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idxId]) === id) { rowIndex = i; break; }
  }
  if (rowIndex < 0) throw new Error("Cheque não encontrado: " + id);

  var colIndex = {};
  header.forEach(function(h, i) { colIndex[h] = i; });

  var row = values[rowIndex];

  if (body.status    != null && colIndex.status    != null) row[colIndex.status]    = up_(body.status);
  if (body.termoUrl  != null && colIndex.termoUrl  != null) row[colIndex.termoUrl]  = String(body.termoUrl  || "").trim();
  if (body.termoNome != null && colIndex.termoNome != null) row[colIndex.termoNome] = String(body.termoNome || "").trim();
  if (colIndex.updatedAt != null) row[colIndex.updatedAt] = Date.now();

  sh.getRange(rowIndex + 1, 1, 1, header.length).setValues([row]);
  return { ok: true };
}

// ─── HELPERS ────────────────────────────────────────────
function up_(s) { return String(s || "").trim().toUpperCase(); }

function outOk(data, cb)  { return out_({ ok: true,  data: data                      }, cb); }
function outErr(msg,  cb) { return out_({ ok: false, error: String(msg || "Erro")    }, cb); }

function out_(obj, cb) {
  var json = JSON.stringify(obj);
  if (cb) {
    return ContentService
      .createTextOutput(cb + "(" + json + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
