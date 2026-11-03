import { verifyWithTrustedJwks } from "./oidc-jwks.js";

// Política de MFA deve ser configurada conforme claims documentadas pelo IdP.
// A assinatura, emissor, audiência e subject são verificados antes de consultar MFA.
export function hasVerifiedMfa(claims, policy={}) {
  if(!claims || typeof claims!=="object") return false;
  const acceptedAcr=Array.isArray(policy.acceptedAcr)?policy.acceptedAcr:[];
  const acceptedAmr=Array.isArray(policy.acceptedAmr)?policy.acceptedAmr:[];
  if(!acceptedAcr.length && !acceptedAmr.length) return false;
  const acrMatch=acceptedAcr.length>0 && typeof claims.acr==="string" && acceptedAcr.includes(claims.acr);
  const amrMatch=acceptedAmr.length>0 && Array.isArray(claims.amr) && claims.amr.some(v=>typeof v==="string" && acceptedAmr.includes(v));
  return Boolean(acrMatch || amrMatch);
}

export async function verifySuperAdminIdentity(token, config, fetcher=fetch) {
  const verified=await verifyWithTrustedJwks(token,config,fetcher);
  if(!verified.ok) return verified;
  if(!hasVerifiedMfa(verified.claims,config?.mfaPolicy))
    return {ok:false,reason:"mfa-required"};
  return {ok:true,subject:verified.claims.sub};
}
