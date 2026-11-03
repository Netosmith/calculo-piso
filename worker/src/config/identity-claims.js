// Pré-validação defensiva das claims. Não substitui a verificação criptográfica
// de assinatura JWT, emissor e audiência pelo provedor OIDC.
export function inspectIdentityClaims(claims, options = {}) {
  if (!claims || typeof claims !== "object" || Array.isArray(claims))
    return {ok:false,reason:"claims-invalid"};
  const issuer=String(options.issuer||"");
  const audience=String(options.audience||"");
  const subject=String(options.subject||"");
  if (!issuer || !audience || !subject) return {ok:false,reason:"config-missing"};
  if (claims.iss!==issuer || claims.sub!==subject) return {ok:false,reason:"identity-mismatch"};
  const aud=Array.isArray(claims.aud)?claims.aud:[claims.aud];
  if (!aud.includes(audience)) return {ok:false,reason:"audience-mismatch"};
  const now=Math.floor(Date.now()/1000);
  const maxLifetime=Number.isSafeInteger(options.maxLifetimeSeconds) ? options.maxLifetimeSeconds : 300;
  if(maxLifetime<30 || maxLifetime>900) return {ok:false,reason:"lifetime-config-invalid"};
  if(!Number.isSafeInteger(claims.iat) || claims.iat>now+30 || claims.iat<now-maxLifetime ||
     !Number.isSafeInteger(claims.exp) || claims.exp-claims.iat>maxLifetime)
    return {ok:false,reason:"token-lifetime-invalid"};
  if (!Number.isSafeInteger(claims.exp) || claims.exp<=now ||
      (claims.nbf!==undefined && (!Number.isSafeInteger(claims.nbf)||claims.nbf>now)))
    return {ok:false,reason:"token-time-invalid"};
  return {ok:true};
}
