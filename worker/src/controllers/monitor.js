import { LEGACY_NOVA_FROTA, tenantIdForLegacySession } from "../config/transportadoras.js";
import { getSession, readSessionId } from "../services/session.js";
import { errorResponse, success } from "../utils/response.js";

// O monitoramento legado continua exclusivo da Nova Frota.
const PROFILES = new Set(["ADMINISTRADOR", "COMERCIAL", "OPERACIONAL"]);
const LINK_DAYS = 7;
const HISTORY_PAGE_SIZE = 1000;
const clean = (v, n = 100) => String(v ?? "").trim().slice(0, n);
const plate = v => clean(v, 12).toUpperCase().replace(/[^A-Z0-9]/g, "");
const validToken = v => /^[a-f0-9]{64}$/.test(String(v || ""));
const validId = v => /^[a-f0-9-]{36}$/.test(String(v || ""));
const parse = async req => {
  try {
    const x = await req.json();
    return x && typeof x === "object" && !Array.isArray(x) ? x : null;
  } catch { return null; }
};
const now = () => new Date().toISOString();
const makeToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), x => x.toString(16).padStart(2, "0")).join("");

async function hashToken(value) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, "0")).join("");
}
async function manager(req, env) {
  const session = await getSession(env, readSessionId(req));
  if (!session) return { error: errorResponse("Sessão inválida.", 401) };
  if (tenantIdForLegacySession(session) !== LEGACY_NOVA_FROTA.id)
    return { error: errorResponse("Monitoramento não provisionado para esta transportadora.", 403) };
  if (!PROFILES.has(clean(session.perfil).toUpperCase()))
    return { error: errorResponse("Sem permissão para Monitoramento.", 403) };
  return { session };
}
const toTrip = row => ({
  id: row.id, plate: row.plate, driver: row.driver, branch: row.branch || "",
  origin: row.origin, destination: row.destination,
  active: row.active === 1, createdAt: row.created_at, updatedAt: row.updated_at,
  linkExpiresAt: row.token_expires_at,
  lastPosition: row.last_position_at ? {
    lat: row.lat, lng: row.lng, accuracy: row.accuracy, at: row.last_position_at
  } : null
});
async function tripForToken(db, value) {
  if (!validToken(value)) return null;
  return db.prepare("SELECT * FROM monitor_trips WHERE token_hash=? AND token_expires_at>?")
    .bind(await hashToken(value), now()).first();
}
function dbError(error, stage) {
  console.error("[MONITOR] " + stage, String(error?.message || error));
  return errorResponse("Falha no banco do monitoramento.", 503, { stage });
}

export async function monitorController(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method;
  if (path === "/v1/monitor/health" && method === "GET") {
    if (!env.FLEET_DB) return errorResponse("Banco D1 indisponível.", 503, { stage: "db-binding" });
    try {
      const result = await env.FLEET_DB.prepare("SELECT 1 AS ok").first();
      return success({ storage: result?.ok === 1 ? "available" : "unavailable", database: "D1" });
    } catch (e) { return dbError(e, "db-health"); }
  }
  if (!env.FLEET_DB) return errorResponse("Banco D1 não configurado.", 503, { stage: "db-binding" });
  const db = env.FLEET_DB;

  // Acesso por token: apenas a viagem, nunca dados de outras viagens.
  if (path === "/v1/monitor/driver" && method === "POST") {
    const body = await parse(request);
    try {
      const row = await tripForToken(db, body?.token);
      if (!row) return errorResponse("Link inválido ou expirado.", 404);
      return success({ trip: toTrip(row) });
    } catch (e) { return dbError(e, "driver-read"); }
  }
  if (path === "/v1/monitor/position" && method === "POST") {
    const body = await parse(request);
    const lat = Number(body?.latitude), lng = Number(body?.longitude), accuracy = Number(body?.accuracy);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 ||
        !Number.isFinite(lng) || lng < -180 || lng > 180 ||
        !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100000)
      return errorResponse("Coordenadas inválidas.", 400);
    try {
      const row = await tripForToken(db, body?.token);
      if (!row) return errorResponse("Link inválido ou expirado.", 404);
      if (row.active !== 1) return errorResponse("Viagem encerrada.", 409);
      const time = now();
      // O batch é atômico. Uma viagem encerrada não recebe novas posições.
      await db.batch([
        db.prepare("UPDATE monitor_trips SET lat=?,lng=?,accuracy=?,last_position_at=?,updated_at=? WHERE id=? AND active=1")
          .bind(lat, lng, accuracy, time, time, row.id),
        db.prepare("INSERT INTO monitor_positions (trip_id,lat,lng,accuracy,recorded_at) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM monitor_trips WHERE id=? AND active=1)")
          .bind(row.id, lat, lng, accuracy, time, row.id)
      ]);
      return success({ receivedAt: time });
    } catch (e) { return dbError(e, "position-write"); }
  }

  let auth;
  try { auth = await manager(request, env); } catch (e) { return dbError(e, "session"); }
  if (auth.error) return auth.error;

  if (path === "/v1/monitor/trips" && method === "GET") {
    try {
      const result = await db.prepare(
        "SELECT t.*, COALESCE(e.branch,'') AS branch FROM monitor_trips t LEFT JOIN monitor_trip_extras e ON e.trip_id=t.id ORDER BY t.active DESC,t.created_at DESC LIMIT 300"
      ).all();
      return success({ trips: (result.results || []).map(toTrip), complete: true });
    } catch (e) { return dbError(e, "trips-read"); }
  }
  if (path === "/v1/monitor/trips" && method === "POST") {
    const body = await parse(request), p = plate(body?.plate), driver = clean(body?.driver);
    if (p.length !== 7 || driver.length < 2) return errorResponse("Informe placa e motorista válidos.", 400);
    const access = makeToken(), tokenHash = await hashToken(access), time = now(), tripId = crypto.randomUUID();
    const expires = new Date(Date.now() + LINK_DAYS * 86400000).toISOString();
    const origin = clean(body?.origin), destination = clean(body?.destination),
      branch = clean(body?.branch, 60), actor = clean(auth.session.usuario);
    try {
      await db.batch([
        db.prepare("INSERT INTO monitor_trips (id,plate,driver,origin,destination,created_by,created_at,updated_at,active,token_hash,token_expires_at) VALUES (?,?,?,?,?,?,?,?,1,?,?)")
          .bind(tripId, p, driver, origin, destination, actor, time, time, tokenHash, expires),
        db.prepare("INSERT INTO monitor_trip_extras (trip_id,branch) VALUES (?,?)").bind(tripId, branch)
      ]);
      return success({
        trip: { id: tripId, plate: p, driver, origin, destination, branch, active: true,
          createdAt: time, updatedAt: time, linkExpiresAt: expires, lastPosition: null },
        token: access, linkExpiresDays: LINK_DAYS
      }, 201);
    } catch (e) { return dbError(e, "trip-create"); }
  }
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 5 && parts[0] === "v1" && parts[1] === "monitor" &&
      parts[2] === "trips" && parts[4] === "positions" && method === "GET") {
    if (!validId(parts[3])) return errorResponse("Identificador inválido.", 400);
    const before = url.searchParams.get("before");
    if (before && (!Number.isFinite(Date.parse(before)) || before.length > 35))
      return errorResponse("Data de paginação inválida.", 400);
    try {
      const trip = await db.prepare("SELECT id FROM monitor_trips WHERE id=?").bind(parts[3]).first();
      if (!trip) return errorResponse("Viagem não encontrada.", 404);
      const query = before
        ? db.prepare("SELECT lat,lng,accuracy,recorded_at AS at FROM monitor_positions WHERE trip_id=? AND recorded_at<? ORDER BY recorded_at DESC,id DESC LIMIT ?").bind(parts[3], before, HISTORY_PAGE_SIZE + 1)
        : db.prepare("SELECT lat,lng,accuracy,recorded_at AS at FROM monitor_positions WHERE trip_id=? ORDER BY recorded_at DESC,id DESC LIMIT ?").bind(parts[3], HISTORY_PAGE_SIZE + 1);
      const rows = (await query.all()).results || [];
      const hasMore = rows.length > HISTORY_PAGE_SIZE;
      const page = rows.slice(0, HISTORY_PAGE_SIZE);
      return success({
        points: page.reverse(), hasMore,
        nextBefore: hasMore && page.length ? page[0].at : null,
        scope: "nova-frota"
      });
    } catch (e) { return dbError(e, "positions-read"); }
  }
  if (parts.length === 5 && parts[0] === "v1" && parts[1] === "monitor" &&
      parts[2] === "trips" && parts[4] === "stop" && method === "POST") {
    if (!validId(parts[3])) return errorResponse("Identificador inválido.", 400);
    try {
      const time = now();
      const result = await db.prepare("UPDATE monitor_trips SET active=0,updated_at=? WHERE id=? AND active=1")
        .bind(time, parts[3]).run();
      if (!result.meta?.changes) return errorResponse("Viagem não encontrada ou já encerrada.", 404);
      const row = await db.prepare(
        "SELECT t.*, COALESCE(e.branch,'') AS branch FROM monitor_trips t LEFT JOIN monitor_trip_extras e ON e.trip_id=t.id WHERE t.id=?"
      ).bind(parts[3]).first();
      return success({ trip: toTrip(row) });
    } catch (e) { return dbError(e, "trip-stop"); }
  }
  return errorResponse("Rota de monitoramento não encontrada.", 404);
}
