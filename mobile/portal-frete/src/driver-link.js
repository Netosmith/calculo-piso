// Convite de viagem só é aceito do domínio oficial Nova Frota.
export function extractDriverToken(value){
  const source=String(value||"").trim();
  const valid=value=>/^[a-f0-9]{64}$/i.test(String(value||""));
  if(valid(source))return source.toLowerCase();
  try{
    const url=new URL(source);
    if(url.protocol==="portalfrete:"&&url.hostname==="viagem"){
      const token=url.pathname.slice(1);
      return valid(token)?token.toLowerCase():null;
    }
    if(url.protocol==="https:"&&url.hostname==="portalfrete.net.br"&&
      url.pathname==="/pages/monitorar-motorista.html"){
      const token=url.hash.replace(/^#/,"");
      return valid(token)?token.toLowerCase():null;
    }
  }catch{}
  return null;
}
