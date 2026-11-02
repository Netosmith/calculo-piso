import { verifyOidcJwt } from "./oidc-verifier.js";

// Não usa URLs, 'jku' ou 'jwk' indicados pelo token. O JWKS deve ser
// configurado pelo operador com URL HTTPS do provedor confiável.
export async function verifyWithTrustedJwks(token, config={}, fetcher=fetch) {
  try {
    const {issuer,audience,subject,jwksUrl}=config;
    if(typeof issuer!=="string" || !issuer.startsWith("https://") ||
       typeof jwksUrl!=="string" || !jwksUrl.startsWith("https://") ||
       new URL(jwksUrl).origin!==new URL(issuer).origin ||
       typeof token!=="string" || token.length>16000)
      return {ok:false,reason:"config-invalid"};
    const headerPart=token.split(".")[0];
    if(!headerPart || !/^[A-Za-z0-9_-]+$/.test(headerPart)) return {ok:false,reason:"token-invalid"};
    const header=JSON.parse(atob(headerPart.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(headerPart.length/4)*4,"=")));
    if(header?.alg!=="RS256" || typeof header.kid!=="string" || header.kid.length>128)
      return {ok:false,reason:"header-invalid"};
    const response=await fetcher(jwksUrl,{redirect:"error",headers:{Accept:"application/json"}});
    if(!response.ok) return {ok:false,reason:"jwks-unavailable"};
    const raw=await response.text();
    if(raw.length>65536) return {ok:false,reason:"jwks-too-large"};
    const jwks=JSON.parse(raw);
    if(!Array.isArray(jwks?.keys) || jwks.keys.length>50) return {ok:false,reason:"jwks-invalid"};
    const matches=jwks.keys.filter(key=>key?.kid===header.kid && key.kty==="RSA" && (!key.use || key.use==="sig"));
    if(matches.length!==1) return {ok:false,reason:"key-not-unique"};
    return await verifyOidcJwt(token,{issuer,audience,subject,jwk:matches[0]});
  } catch {
    return {ok:false,reason:"jwks-verification-failed"};
  }
}
