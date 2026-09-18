import { callAppsScript } from "../services/appscript.js";
import { getSession, readSessionId } from "../services/session.js";
import { canRunGatewayAction, MODULE_ACTIONS } from "../services/permissions.js";
import { readJson } from "../utils/validation.js";
import { errorResponse, success } from "../utils/response.js";

const ESTADIAS_PRECISION_PREFIX = "estadias:precision:v1:";
const ESTADIAS_PRECISION_FIELDS = [
  "dataHoraChegada",
  "dataHoraSaida",
  "tempoEspera",
  "tempoRetroativo",
  "horasPagar",
  "valorHora",
  "valorTotal",
  "pesoDestino"
];

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

function safeParams(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

function gatewayErrorMessage(error) {
  const message = String(error?.message || error || "").trim();

  if (!message) {
    return "Falha na comunicação segura com o Apps Script.";
  }

  const lower = message.toLowerCase();
  const safePrefixes = [
    "tempo limite excedido",
    "resposta inválida do apps script",
    "apps script respondeu",
    "falha ao enviar",
    "arquivo"
  ];

  if (safePrefixes.some((prefix) => lower.startsWith(prefix))) {
    return message;
  }

  return "Falha na comunicação segura com o Apps Script.";
}

function estadiaId(value) {
  return String(value?.id || value?.ID || "").trim();
}

function estadiaPrecisionKey(id) {
  return `${ESTADIAS_PRECISION_PREFIX}${String(id || "").trim()}`;
}

function precisionFromParams(params) {
  const source = safeParams(params);
  const precision = {};

  for (const field of ESTADIAS_PRECISION_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      precision[field] = source[field];
    }
  }

  return precision;
}

async function readEstadiaPrecision(env, id) {
  if (!env?.SESSIONS || !id) return null;

  try {
    const raw = await env.SESSIONS.get(estadiaPrecisionKey(id));
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : null;
  } catch (error) {
    console.warn("[ESTADIAS] Falha ao ler precisão de horário", {
      id,
      message: String(error?.message || error)
    });
    return null;
  }
}

async function writeEstadiaPrecision(env, id, params) {
  if (!env?.SESSIONS || !id) return null;

  const incoming = precisionFromParams(params);
  if (!Object.keys(incoming).length) return null;

  try {
    const current = (await readEstadiaPrecision(env, id)) || {};
    const merged = {
      ...current,
      ...incoming,
      precisionUpdatedAt: Date.now()
    };

    await env.SESSIONS.put(
      estadiaPrecisionKey(id),
      JSON.stringify(merged)
    );

    return merged;
  } catch (error) {
    console.warn("[ESTADIAS] Falha ao salvar precisão de horário", {
      id,
      message: String(error?.message || error)
    });
    return null;
  }
}

async function deleteEstadiaPrecision(env, id) {
  if (!env?.SESSIONS || !id) return;

  try {
    await env.SESSIONS.delete(estadiaPrecisionKey(id));
  } catch (error) {
    console.warn("[ESTADIAS] Falha ao remover precisão de horário", {
      id,
      message: String(error?.message || error)
    });
  }
}

function applyPrecision(record, precision) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return record;
  }

  if (!precision) return record;

  for (const field of ESTADIAS_PRECISION_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(precision, field)) {
      record[field] = precision[field];
    }
  }

  return record;
}

async function overlayEstadiasPrecision(env, data) {
  if (!env?.SESSIONS) return data;

  if (Array.isArray(data)) {
    // Antes era feito 1 KV.get para CADA estadia. Com dezenas/centenas de
    // registros isso acrescentava muita latência em toda abertura da tela.
    // Agora listamos somente as chaves que realmente possuem precisão salva
    // e lemos apenas esses poucos registros.
    const recordsById = new Map();

    for (const record of data) {
      const id = estadiaId(record);
      if (id) recordsById.set(id, record);
    }

    if (!recordsById.size) return data;

    try {
      const listed = await env.SESSIONS.list({
        prefix: ESTADIAS_PRECISION_PREFIX,
        limit: 1000
      });

      const keys = Array.isArray(listed?.keys) ? listed.keys : [];
      const precisionKeys = keys
        .map((entry) => String(entry?.name || ""))
        .filter((key) => key.startsWith(ESTADIAS_PRECISION_PREFIX))
        .filter((key) => {
          const id = key.slice(ESTADIAS_PRECISION_PREFIX.length);
          return recordsById.has(id);
        });

      await Promise.all(
        precisionKeys.map(async (key) => {
          const id = key.slice(ESTADIAS_PRECISION_PREFIX.length);
          const precision = await readEstadiaPrecision(env, id);
          applyPrecision(recordsById.get(id), precision);
        })
      );
    } catch (error) {
      // Precisão é uma camada complementar. Nunca deve atrasar ou impedir
      // a listagem principal das estadias.
      console.warn("[ESTADIAS] Overlay de precisão ignorado nesta leitura", {
        message: String(error?.message || error)
      });
    }

    return data;
  }

  const id = estadiaId(data);
  if (!id) return data;

  const precision = await readEstadiaPrecision(env, id);
  return applyPrecision(data, precision);
}

export async function portalGatewayController(request, env) {
  const sessionId = readSessionId(request);
  const session = await getSession(env, sessionId);

  if (!session) {
    return errorResponse("Sessão inválida ou expirada.", 401);
  }

  if (!session.estado) {
    return errorResponse("Selecione um estado antes de acessar os módulos.", 409);
  }

  let body;
  try {
    body = await readJson(request);
  } catch (error) {
    return errorResponse(error.message, 400);
  }

  const moduleName = normalizeKey(body.module);
  const actionName = normalizeKey(body.action);
  const params = safeParams(body.params);
  const resourceName = normalizeKey(params.resource);

  if (!moduleName || !actionName) {
    return errorResponse("Informe módulo e ação.", 400);
  }

  if (!MODULE_ACTIONS[moduleName]) {
    console.warn("[GATEWAY] Módulo recusado", {
      usuario: session.usuario,
      perfil: session.perfil,
      estado: session.estado,
      moduleName,
      actionName
    });
    return errorResponse("Módulo não autorizado.", 403);
  }

  if (!canRunGatewayAction(session, moduleName, actionName, params)) {
    console.warn("[GATEWAY] Ação recusada", {
      usuario: session.usuario,
      perfil: session.perfil,
      estado: session.estado,
      moduleName,
      actionName
    });
    return errorResponse("Ação não autorizada para este perfil.", 403);
  }

  // Proteção crítica: versões antigas do frontend usavam DELETE para remover
  // anexos e o Apps Script interpretava isso como exclusão do embarque inteiro.
  // Nunca encaminhar DELETE de anexos. A remoção visual/segura é feita por UPDATE.
  if (
    moduleName === "embarques" &&
    actionName === "delete" &&
    ["itinerario", "comprovante", "liberacao"].includes(resourceName)
  ) {
    console.warn("[GATEWAY] DELETE de anexo bloqueado para proteger o embarque", {
      usuario: session.usuario,
      resourceName,
      id: params.id
    });
    return errorResponse(
      "Remoção direta de anexo bloqueada para proteger os dados do embarque. Atualize a página e tente novamente.",
      409
    );
  }

  try {
    const result = await callAppsScript(env, {
      action: "portal_gateway",
      method: "POST",
      params: {
        module: moduleName,
        action: actionName,
        payload: params,
        auth: {
          usuario: session.usuario,
          nome: session.nome,
          perfil: session.perfil,
          estado: session.estado,
          estados: session.estados
        }
      }
    });

    if (!result?.ok) {
      return errorResponse(
        result?.error || "O Apps Script recusou a operação.",
        Number(result?.status) || 502,
        result?.details
      );
    }

    // O Apps Script legado normaliza datas de ESTADIAS em HH:mm e elimina
    // os segundos. Mantemos aqui uma camada de precisão no KV para que o
    // Portal preserve HH:mm:ss e os cálculos monetários exatos entre usuários.
    if (moduleName === "estadias") {
      if (actionName === "read") {
        result.data = await overlayEstadiasPrecision(env, result.data);
      }

      if (actionName === "create" || actionName === "update") {
        const id = String(params.id || estadiaId(result.data) || "").trim();

        if (id) {
          const precision = await writeEstadiaPrecision(env, id, params);
          applyPrecision(result.data, precision);
        }
      }

      if (actionName === "delete") {
        await deleteEstadiaPrecision(env, String(params.id || "").trim());
      }
    }

    return success({
      module: moduleName,
      action: actionName,
      data: result.data ?? result
    });
  } catch (error) {
    const message = gatewayErrorMessage(error);
    const isTimeout = message.toLowerCase().includes("tempo limite excedido");

    console.error("[GATEWAY] Falha ao chamar Apps Script", {
      moduleName,
      actionName,
      resource: resourceName,
      message: String(error?.message || error)
    });

    return errorResponse(
      message,
      isTimeout ? 504 : 502
    );
  }
}
