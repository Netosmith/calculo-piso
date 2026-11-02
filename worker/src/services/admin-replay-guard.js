// D1 replay guard for future privileged write operations.
// A unique (subject, jti) constraint makes concurrent reuse fail atomically.
// Call only after JWT signature, issuer, audience, MFA and expiration verification.
export async function consumeAdminToken(db, subject, jti, expiresAt) {
  if(!db?.prepare || typeof subject!=="string" || !subject || subject.length>256 ||
     typeof jti!=="string" || !/^[A-Za-z0-9_-]{16,128}$/.test(jti) ||
     !Number.isSafeInteger(expiresAt) || expiresAt<=Math.floor(Date.now()/1000) ||
     expiresAt>Math.floor(Date.now()/1000)+900) return false;
  try {
    const result=await db.prepare(
      "INSERT INTO portal_admin_token_uses(subject,jti,expires_at) VALUES(?,?,?) ON CONFLICT(subject,jti) DO NOTHING"
    ).bind(subject,jti,expiresAt).run();
    return result?.meta?.changes===1;
  } catch {
    return false;
  }
}
