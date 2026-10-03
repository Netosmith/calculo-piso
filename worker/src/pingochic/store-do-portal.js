import { PingoStore as BasePingoStore } from "./store-do.js";

const PORTAL_COOKIE = "__Host-portal_session";
const PBKDF2_ITERATIONS = 100000;

/**
 * Camada de integração entre o admin da Pingo Chic e a autenticação já existente
 * do Portal Frete. Mantém todos os recursos do PingoStore original e acrescenta
 * um bootstrap seguro para o PRIMEIRO administrador da loja.
 *
 * Regras do bootstrap:
 * - só funciona enquanto a tabela admins estiver vazia;
 * - exige uma sessão válida do Portal Frete no mesmo navegador;
 * - a sessão precisa ter perfil ADMINISTRADOR;
 * - o e-mail e a senha informados na tela da Pingo Chic viram as credenciais
 *   definitivas do primeiro administrador;
 * - a senha é armazenada somente como PBKDF2-SHA256, compatível com o backend
 *   original da Pingo Chic.
 */
export class PingoStore extends BasePingoStore {
  async adminRoutes(request, seg, method, url) {
    const action = seg[0] || "";

    if (action === "login" && method === "POST") {
      const noAdmins = !this.sql.exec("SELECT id FROM admins LIMIT 1").toArray().length;

      if (noAdmins) {
        const portalSession = await this.portalAdministrator(request);

        if (portalSession) {
          const body = await readJson(request);
          const email = normalizeEmail(body.email);
          const password = String(body.password || "");
          const ip = request.headers.get("CF-Connecting-IP") || "local";
          const attemptKey = "a:" + ip;

          this.checkAttempts(attemptKey);

          if (!validEmail(email)) {
            this.failAttempt(attemptKey);
            return json({ ok: false, error: "Informe um e-mail válido para o administrador Pingo Chic." }, 400);
          }
          if (password.length < 10) {
            this.failAttempt(attemptKey);
            return json({ ok: false, error: "Para o primeiro acesso, crie uma senha com pelo menos 10 caracteres." }, 400);
          }

          const alreadyExists = this.sql.exec("SELECT id FROM admins WHERE email = ?", email).toArray().length;
          if (alreadyExists) {
            return super.adminRoutes(request, seg, method, url);
          }

          const name = clean(portalSession.nome || portalSession.usuario, 80) || "Administrador";
          const passwordHash = await hashPassword(password);
          const row = this.sql.exec(
            "INSERT INTO admins (email, name, pass, created_at) VALUES (?, ?, ?, ?) RETURNING *",
            email,
            name,
            passwordHash,
            Date.now()
          ).toArray()[0];

          this.clearAttempts(attemptKey);
          const session = this.createSession("admin", row.id);

          return json(
            { ok: true, admin: { id: row.id, email: row.email, name: row.name }, bootstrap: "portal" },
            200,
            { "Set-Cookie": session.cookie }
          );
        }

        // Se os secrets antigos estiverem configurados, preserva o fluxo original.
        if (!this.env.PINGO_ADMIN_EMAIL || !this.env.PINGO_ADMIN_PASSWORD) {
          return json({
            ok: false,
            error: "Primeiro acesso: entre no Portal Frete com perfil ADMINISTRADOR nesta mesma sessão. Depois volte aqui e informe o e-mail e uma senha de pelo menos 10 caracteres."
          }, 401);
        }
      }
    }

    return super.adminRoutes(request, seg, method, url);
  }

  async portalAdministrator(request) {
    if (!this.env.SESSIONS) return null;

    const sessionId = readCookie(request, PORTAL_COOKIE);
    if (!sessionId) return null;

    try {
      const session = await this.env.SESSIONS.get(`session:${sessionId}`, { type: "json" });
      if (!session) return null;
      if (String(session.perfil || "").trim().toUpperCase() !== "ADMINISTRADOR") return null;

      if (session.expiresAt) {
        const expiresAt = Date.parse(session.expiresAt);
        if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) return null;
      }

      return session;
    } catch (error) {
      console.warn("[pingochic] não foi possível validar a sessão do Portal", error);
      return null;
    }
  }
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers
    }
  });
}

function readCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=").trim();
  }
  return "";
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase().slice(0, 160);
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function clean(value, max = 200) {
  return String(value ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
}

function randomHex(bytes) {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return [...buffer].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function pbkdf2(password, saltHex, iterations) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const salt = new Uint8Array(saltHex.match(/../g).map((hex) => parseInt(hex, 16)));
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256
  );
  return [...new Uint8Array(bits)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password) {
  const salt = randomHex(16);
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt}$${hash}`;
}
