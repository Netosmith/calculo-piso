// Cloudflare Workers ctx.access is produced by Cloudflare Access after
// authentication. Never trust a caller-provided email/header as identity.
export async function verifiedStagingOwner(env, ctx) {
  const expectedEmail=String(env?.SUPER_ADMIN_ACCESS_EMAIL||"").trim().toLowerCase();
  const expectedAud=String(env?.SUPER_ADMIN_ACCESS_AUD||"").trim();
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(expectedEmail) ||
     expectedEmail.length>254 || expectedAud.length<8 || expectedAud.length>256 ||
     !ctx?.access || ctx.access.aud!==expectedAud ||
     typeof ctx.access.getIdentity!=="function") return null;
  try {
    const identity=await ctx.access.getIdentity();
    const email=String(identity?.email||"").trim().toLowerCase();
    if(!email || email!==expectedEmail) return null;
    // This is a staging-only identity for the existing owner authorization
    // checks, not a legacy session, credential or Apps Script account.
    return {
      usuario:"ACCESS_OWNER",
      nome:"Proprietario (Access)",
      transportadoraId:"nova-frota",
      perfil:"ADMINISTRADOR",
      estados:[],
      estado:""
    };
  } catch {
    return null;
  }
}
