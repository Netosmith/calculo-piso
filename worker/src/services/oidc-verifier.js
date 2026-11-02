import { inspectIdentityClaims } from "../config/identity-claims.js";

function decodeBase64Url(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("JWT inválido");
  const base64=value.replace(/-/g,"+").replace(/_/g,"/");
  const binary=atob(base64.padEnd(Math.ceil(base64.length/4)*4,"="));
  return Uint8Array.from(binary,c=>c.charCodeAt(0));
}
function parseJson(bytes) {
  return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
}

// Verificador de JWT RS256 com chave JWK fornecida por configuração confiável.
// O chamador deve obter e validar a chave no JWKS do emissor, sem aceitar JWK do token.
export async function verifyOidcJwt(token, {issuer,audience,subject,jwk}={}) {
  try {
    if(typeof token!=="string" || token.length>16000) return {ok:false,reason:"token-invalid"};
    const parts=token.split(".");
    if(parts.length!==3) return {ok:false,reason:"token-invalid"};
    const header=parseJson(decodeBase64Url(parts[0]));
    const claims=parseJson(decodeBase64Url(parts[1]));
    if(header?.alg!=="RS256" || header?.typ && header.typ!=="JWT" || !header?.kid)
      return {ok:false,reason:"header-invalid"};
    if(!jwk || jwk.kty!=="RSA" || jwk.kid!==header.kid || jwk.alg && jwk.alg!=="RS256" || jwk.use && jwk.use!=="sig")
      return {ok:false,reason:"key-invalid"};
    const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
    const valid=await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,decodeBase64Url(parts[2]),new TextEncoder().encode(parts[0]+"."+parts[1]));
    if(!valid) return {ok:false,reason:"signature-invalid"};
    const checked=inspectIdentityClaims(claims,{issuer,audience,subject});
    return checked.ok?{ok:true,claims}:{ok:false,reason:checked.reason};
  } catch {
    return {ok:false,reason:"verification-failed"};
  }
}
