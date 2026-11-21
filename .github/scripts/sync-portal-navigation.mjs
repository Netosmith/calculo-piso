// Mantém os atalhos das transportadoras sincronizados com os módulos do Worker.
// Navegação: a barra usa a sessão autenticada; este script cria apenas as
// pequenas páginas de entrada necessárias no GitHub Pages.
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const exists=file=>fs.existsSync(path.join(root,file));
function valuesFrom(js,name){
 const re=new RegExp("export const "+name+"\\s*=\\s*Object\\.freeze\\(\\[([\\s\\S]*?)\\]\\)");
 const found=js.match(re);
 if(!found)throw new Error("Registro ausente: "+name);
 return [...found[1].matchAll(/"([a-z][a-z0-9-]+)"/g)].map(m=>m[1]);
}
const tenantKeys=valuesFrom(read("worker/src/config/tenant-modules.js"),"TENANT_MODULES");
const novaScript=read("worker/src/services/nova-frota-modules.js");
const novaKeys=[
 ...valuesFrom(novaScript,"NOVA_FROTA_LEGACY_DEFAULTS"),
 ...valuesFrom(novaScript,"NOVA_FROTA_NEW_MODULES")
];
const union=new Set([...tenantKeys,...novaKeys]);
const aliases={
 "piso":"calculo-piso.html",
 "piso2":"calculo-antt.html",
 "share":"share-clientes.html",
 "custo-frota":"custo-frota-pesada.html",
 "patrimonio":"patrimonio-br.html",
 "fretes2":"fretes2.html"
};
function route(feature){
 const uf=feature.match(/^fretes-([a-z]{2})$/);
 if(uf)return {file:"fretes-"+uf[1].toUpperCase()+".html",shared:"fretes.html",uf:uf[1].toUpperCase()};
 return {file:aliases[feature]||feature+".html",shared:aliases[feature]||feature+".html",uf:null};
}
function fail(message){throw new Error("[NAVEGAÇÃO] "+message);}
for(const feature of union){
 const p="pages/"+route(feature).shared;
 if(!exists(p))fail("Módulo registrado sem HTML compartilhado: "+feature+" -> "+p);
 // Um módulo nunca deve depender da Home para construir seu menu.
 const html=read(p);
 if(!/assets\/js\/auth\.js(?:\?|["'])/.test(html))
  fail("Página sem auth.js / barra compartilhada: "+p);
}
const home=read("pages/home.html");
const cards=new Set([...home.matchAll(/data-feature="([a-z][a-z0-9-]+)"/g)].map(m=>m[1]));
for(const feature of cards){
 if(!union.has(feature))fail("Card da Home sem chave cadastrada no Worker: "+feature);
}
function escapeHtml(text){
 return text.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll('"' ,"&quot;");
}
function wrapper(tenant,feature){
 const {file,shared,uf}=route(feature);
 const title=escapeHtml(uf?"Fretes "+uf:feature.replaceAll("-"," "));
 const attr=uf?' data-freight-base="'+uf+'"':"";
 return '<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<meta name="robots" content="noindex,nofollow">\n<title>'+title+' | Portal Frete</title>\n</head>\n<body>\n<p>Validando sessão da transportadora...</p>\n<script src="/assets/js/tenant-page.js?v=nav-auto-1" data-tenant-id="'+escapeHtml(tenant)+'" data-shared-page="'+shared+'"'+attr+'></script>\n</body>\n</html>\n';
}
const allowedTenantKeys=tenantKeys.filter(key=>!["fretes2","funcionarios","relatorio","super-admin"].includes(key));
const pages=path.join(root,"pages");
let created=0,checked=0;
for(const entry of fs.readdirSync(pages,{withFileTypes:true})){
 if(!entry.isDirectory())continue;
 const homeFile=path.join("pages",entry.name,"home.html");
 if(!exists(homeFile))continue;
 const tenant=read(homeFile).match(/data-tenant-id="([a-zA-Z0-9_-]+)"/)?.[1];
 // Modelo02 é só redirecionamento; não criar páginas nele.
 if(!tenant)continue;
 for(const feature of allowedTenantKeys){
  const {file}=route(feature),dest=path.join("pages",entry.name,file);
  if(exists(dest)){checked++;continue;}
  const contents=wrapper(tenant,feature);
  if(process.argv.includes("--check"))fail("Falta entrada: "+dest);
  fs.writeFileSync(path.join(root,dest),contents,"utf8");created++;
  process.stdout.write("Criado "+dest+"\n");
 }
}
process.stdout.write("[NAVEGAÇÃO] "+union.size+" módulos cadastrados; "+cards.size+
 " cards da Home; "+checked+" atalhos verificados; "+created+" novos atalhos.\n");
