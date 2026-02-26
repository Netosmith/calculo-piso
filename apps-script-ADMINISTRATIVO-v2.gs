/* =========================================
   NOVA FROTA - ADMINISTRATIVO API (WebApp) v2
   =========================================
   CORREÇÕES v2:
   - doPost: lê e.parameter APENAS do querystring
     (campos do body application/x-www-form-urlencoded
      NÃO chegam em e.parameter no Apps Script)
   - doPost: quando action=drive_upload, parseia
     o body manualmente via e.postData.contents
   - driveUploadBase64_: aceita parâmetros via doGet
     (JSONP GET) — solução principal do front
   - Upload via GET/JSONP: sem limitação de CORS,
     sem X-Frame-Options, sem postMessage
========================================= */

const SHEET_CHEQUES = "CHEQUES";

// --------------------
// ENTRYPOINTS
// --------------------
function doGet(e) {
  const action = String((e.parameter && e.parameter.action) || "").toLowerCase();
  const cb     = String((e.parameter && e.parameter.callback) || "").trim();

  try {
    if (action === "cheques_list")   return outOk(listCheques_(), cb);
    if (action === "cheques_get")    return outOk(getChequeById_(e.parameter.id || ""), cb);
    if (action === "cheques_add")    return outOk(addCheque_(e.parameter), cb);
    if (action === "cheques_update") return outOk(updateCheque_(e.parameter), cb);

    // ✅ UPLOAD via JSONP GET (principal — sem CORS)
    // O front envia: ?action=drive_upload&folderId=...&data=BASE64&...&callback=cb_xxx
    if (action === "drive_upload")   return outOk(driveUploadBase64_(e.parameter), cb);

    return outErr("Ação inválida: " + action, cb);
  } catch (err) {
    return outErr(err && err.message ? err.message : String(err), cb);
  }
}

function doPost(e) {
  try {
    const ctype       = String((e.postData && e.postData.type) || "").toLowerCase();
    const actionParam = String((e.parameter && e.parameter.action) || "").toLowerCase();

    // ============================================================
    // ⚠️  IMPORTANTE (comportamento do Apps Script):
    //
    //   e.parameter → recebe apenas querystring (?key=value)
    //   e.postData.contents → recebe o BODY do POST (form data, JSON, etc.)
    //
    //   Form application/x-www-form-urlencoded com campos muito
    //   grandes (base64) é TRUNCADO pelo Google.
    //   Por isso o front agora usa JSONP GET (doGet) para uploads.
    //
    //   Este doPost existe como fallback / compatibilidade.
    // ============================================================

    // ── 1) Upload via form (fallback legado) ─────────────────────
    if (actionParam === "drive_upload") {
      // Tenta ler do body se veio como form-urlencoded
      let params = Object.assign({}, e.parameter); // querystring

      if (ctype.includes("application/x-www-form-urlencoded") && e.postData && e.postData.contents) {
        // Parse manual do body
        const bodyParsed = parseFormBody_(e.postData.contents);
        params = Object.assign(params, bodyParsed);
      }

      const result = driveUploadBase64_(params);
      return outHtmlPostMessage_({ ok: true, data: result });
    }

    // ── 2) POST JSON ──────────────────────────────────────────────
    if (ctype.includes("application/json")) {
      const body   = JSON.parse((e.postData && e.postData.contents) || "{}");
      const action = String(body.action || "").toLowerCase();

      if (action === "cheques_add")    return outOk(addCheque_(body),          "");
      if (action === "cheques_update") return outOk(updateCheque_(body),       "");
      if (action === "drive_upload")   return outOk(driveUploadBase64_(body),  "");

      return outErr("Ação inválida: " + action, "");
    }

    // ── 3) Fallback ───────────────────────────────────────────────
    return outErr("POST não reconhecido. Use JSONP GET para upload.", "");

  } catch (err) {
    return outHtmlPostMessage_({
      ok: false,
      error: String(err && err.message ? err.message : err)
    });
  }
}

/**
 * Parseia body application/x-www-form-urlencoded manualmente.
 * Necessário porque e.parameter NÃO recebe campos do body no Apps Script.
 */
function parseFormBody_(contents) {
  const result = {};
  try {
    const pairs = String(contents || "").split("&");
    pairs.forEach(function(pair) {
      const eqIdx = pair.indexOf("=");
      if (eqIdx < 0) return;
      const k = decodeURIComponent(pair.slice(0, eqIdx).replace(/\+/g, " "));
      const v = decodeURIComponent(pair.slice(eqIdx + 1).replace(/\+/g, " "));
      result[k] = v;
    });
  } catch (ex) {
    Logger.log("parseFormBody_ error: " + ex);
  }
  return result;
}

/** HTML que conversa com o parent via postMessage (fallback iframe) */
function outHtmlPostMessage_(payload) {
  const msg  = JSON.stringify(Object.assign({ __nf_upload__: true }, payload));
  const html =
    "<!doctype html><html><body>" +
    "<script>" +
    "try{ parent.postMessage(" + msg + ", '*'); }catch(e){}" +
    "</script>OK</body></html>";

  return ContentService
    .createTextOutput(html)
    .setMimeType(ContentService.MimeType.HTML);
}

// --------------------
// CHEQUES (SHEET)
// --------------------
function shCheques_() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(SHEET_CHEQUES);
  if (!sh) throw new Error("Aba \"" + SHEET_CHEQUES + "\" não existe.");
  return sh;
}

function listCheques_() {
  const sh     = shCheques_();
  const values = sh.getDataRange().getValues();
  if (values.length <= 1) return [];

  const header = values[0].map(function(h) { return String(h).trim(); });
  const rows   = values.slice(1);

  return rows
    .filter(function(r) { return r.some(function(c) { return String(c || "").trim() !== ""; }); })
    .map(function(r) {
      const obj = {};
      header.forEach(function(h, i) { obj[h] = r[i]; });
      return obj;
    });
}

function getChequeById_(id) {
  id = String(id || "").trim();
  if (!id) return null;
  const all = listCheques_();
  return all.find(function(x) { return String(x.id) === id; }) || null;
}

function addCheque_(body) {
  const sh = shCheques_();

  const filial     = up_(body.filial);
  const data       = String(body.data       || "").trim();
  const sequencia  = String(body.sequencia  || "").trim();
  const responsavel= up_(body.responsavel);
  const status     = up_(body.status || "ATIVO");

  if (!filial)      throw new Error("Filial obrigatória.");
  if (!data)        throw new Error("Data obrigatória.");
  if (!sequencia)   throw new Error("Sequência obrigatória.");
  if (!responsavel) throw new Error("Responsável obrigatório.");

  const createdAt = Date.now();
  const id = filial + "-" + sequencia + "-" + data.replace(/\//g, "");

  const all = listCheques_();
  if (all.some(function(x) { return String(x.id) === id; })) {
    throw new Error("Já existe cheque com esse ID: " + id);
  }

  sh.appendRow([
    id, createdAt, filial, data, sequencia,
    responsavel, status,
    "", "",       // termoUrl, termoNome
    createdAt     // updatedAt
  ]);

  return { id: id };
}

function updateCheque_(body) {
  const sh = shCheques_();
  const id = String(body.id || "").trim();
  if (!id) throw new Error("ID obrigatório para update.");

  const values = sh.getDataRange().getValues();
  const header = values[0].map(function(h) { return String(h).trim(); });

  const idxId = header.indexOf("id");
  if (idxId < 0) throw new Error("Coluna \"id\" não encontrada no cabeçalho.");

  const rowIndex = values.findIndex(function(r, i) {
    return i > 0 && String(r[idxId]) === id;
  });
  if (rowIndex < 0) throw new Error("Cheque não encontrado: " + id);

  const colIndex = {};
  header.forEach(function(h, i) { colIndex[h] = i; });

  const row = values[rowIndex];

  if (body.status    != null && colIndex.status    != null) row[colIndex.status]    = up_(body.status);
  if (body.termoUrl  != null && colIndex.termoUrl  != null) row[colIndex.termoUrl]  = String(body.termoUrl  || "").trim();
  if (body.termoNome != null && colIndex.termoNome != null) row[colIndex.termoNome] = String(body.termoNome || "").trim();
  if (colIndex.updatedAt != null) row[colIndex.updatedAt] = Date.now();

  sh.getRange(rowIndex + 1, 1, 1, header.length).setValues([row]);
  return { ok: true };
}

// --------------------
// DRIVE UPLOAD (BASE64 via GET/JSONP)
// Salva em: PASTA_RAIZ / FILIAL / (CHEQUES|CHECKLISTS|ARQUIVOS) / arquivo
// --------------------
function driveUploadBase64_(p) {
  const folderId = String(p.folderId || "").trim();
  const filial   = up_(p.filial || "");

  // front pode mandar "kind" ou "type"
  const typeRaw = String(p.type || p.kind || "").trim().toLowerCase();
  const type    = typeRaw || "arquivo";

  const ref      = String(p.ref      || "").trim();
  const filename = String(p.filename || "").trim();
  const mimeType = String(p.mimeType || "application/octet-stream").trim();
  const dataB64  = String(p.data     || "").trim();

  if (!folderId) throw new Error("folderId obrigatório.");
  if (!filial)   throw new Error("filial obrigatória.");
  if (!dataB64)  throw new Error("data (base64) obrigatório.");
  if (!filename) throw new Error("filename obrigatório.");

  const root        = DriveApp.getFolderById(folderId);
  const filialFolder= getOrCreateFolder_(root, filial);

  const subName =
    (type === "termo")     ? "CHEQUES"    :
    (type === "checklist") ? "CHECKLISTS" :
    "ARQUIVOS";

  const dest = getOrCreateFolder_(filialFolder, subName);

  const bytes = Utilities.base64Decode(dataB64);
  const blob  = Utilities.newBlob(bytes, mimeType, filename);

  const stamp   = Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyyMMdd-HHmmss");
  const safeRef = ref ? (" - " + ref.replace(/[^\w\-\. ]+/g, "")) : "";
  blob.setName(type.toUpperCase() + safeRef + " - " + stamp + " - " + filename);

  const file    = dest.createFile(blob);
  const viewUrl = "https://drive.google.com/file/d/" + file.getId() + "/view";

  return {
    fileId:      file.getId(),
    name:        file.getName(),
    url:         viewUrl,
    folderFilial: filial,
    folderTipo:  subName
  };
}

function getOrCreateFolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

// --------------------
// HELPERS
// --------------------
function up_(s) { return String(s || "").trim().toUpperCase(); }

function outOk(data, cb)  { return out_({ ok: true,  data: data         }, cb); }
function outErr(msg,  cb) { return out_({ ok: false, error: String(msg || "Erro") }, cb); }

function out_(obj, cb) {
  const json = JSON.stringify(obj);
  if (cb) {
    return ContentService
      .createTextOutput(cb + "(" + json + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
