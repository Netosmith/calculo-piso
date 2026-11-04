#!/usr/bin/env node
/**
 * Create another transportadora's static URL entrypoints, using GNOVA/teste-01
 * as the REFERENCE ONLY. Does not copy data, credentials, JS or CSS.
 *
 * Usage:
 *   node scripts/criar-transportadora-modelo.mjs <slug-publico> <tenant-id> [--dry-run]
 *
 * Example (synthetic IDs): node scripts/criar-transportadora-modelo.mjs empresa-exemplo empresa-02
 * Provision tenant, users, isolated Sheet and Apps Script in Super Admin first.
 */
import {readFileSync,writeFileSync,mkdirSync,existsSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";

const [slug,id,option]=process.argv.slice(2);
const valid=value=>typeof value==="string"&&
 /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value)&&value.length<=48;
if(!valid(slug)||!valid(id)||slug==="transportadora-teste"||
 (option!==undefined&&option!=="--dry-run")){
 console.error("Uso: node scripts/criar-transportadora-modelo.mjs <slug-publico> <tenant-id> [--dry-run]");
 process.exitCode=2;
}else{
 const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
 const from=resolve(root,"pages","transportadora-teste");
 const to=resolve(root,"pages",slug);
 const modules=["login","home","fretes","fretes2","fretes-GO","fretes-MT","fretes-SP","fretes-MS","fretes-BA","fretes-PR","fretes-SC","fretes-RO","fretes-TO","fretes-MA","fretes-AC","fretes-AL","fretes-AP","fretes-AM","fretes-CE","fretes-DF","fretes-ES","fretes-MG","fretes-PA","fretes-PB","fretes-PE","fretes-PI","fretes-RJ","fretes-RN","fretes-RS","fretes-RR","fretes-SE","bi","divulgacao","share-clientes",
  "controle","administrativo","cadastros","estadias","fretes-mercado","embarques",
  "chamados","patrimonio-br","relatorio","custo-filial","custo-frota-pesada",
  "monitoramento","calculo-piso","calculo-antt","calculo-antt2","ordem"];
 const entries=modules.map(name=>{
  const source=readFileSync(resolve(from,name+".html"),"utf8");
  if(!source.includes('data-tenant-id="teste-01"'))throw Error("Modelo inválido: "+name);
  let result=source.replace('data-tenant-id="teste-01"','data-tenant-id="'+id+'"')
   .replaceAll("TRANSPORTADORA TESTE","ACESSO EMPRESARIAL")
   .replaceAll("Transportadora Teste","Acesso empresarial");
  // The GNOVA order shell may eventually contain real fiscal records.
  // Never copy those records to a new transportadora.
  if(name==="ordem"){
   result=result.replace("Cadastro manual exclusivo da GNOVA no GitHub.",
     "Cadastro manual exclusivo desta transportadora no GitHub.");
   // New companies must not inherit the GNOVA trade name either.
   result=result.replace(/const NOME_TRANSPORTADORA = "[^"]*";/,
     'const NOME_TRANSPORTADORA = "";');
   result=result.replace(/(const EMPRESAS_POR_ESTADO = \{)[\s\S]*?(\n      \};\n      window\.PORTAL_ORDEM_CONFIG)/,
     (_match,start,end)=>start+
     ["GO: \"GOIÁS\"","MG: \"MINAS GERAIS\"","SP: \"SÃO PAULO\"",
      "MT: \"MATO GROSSO\"","PR: \"PARANÁ\"","SC: \"SANTA CATARINA\"",
      "TO: \"TOCANTINS\"","PA: \"PARÁ\"","MA: \"MARANHÃO\"",
      "BA: \"BAHIA\""].map(entry=>{
       const [uf,filial]=entry.split(": ");
       return '\n        '+uf+': { filial:'+filial+', cnpj:"", ie:"", endereco:"", email:"" }';
     }).join(",") +end);
  }
  return {name,target:resolve(to,name+".html"),content:result};
 });
 if(existsSync(to)||entries.some(x=>existsSync(x.target))){
  throw Error("A pasta da transportadora já existe. Nada foi sobrescrito: "+to);
 }
 if(option!=="--dry-run"){
  mkdirSync(to,{recursive:false});
  for(const item of entries)writeFileSync(item.target,item.content,{flag:"wx"});
 }
 console.log((option==="--dry-run"?"DRY RUN: ":"")+"Preparadas "+
   entries.length+" páginas no slug "+slug+" para tenant "+id+
   ". Nenhum dado operacional, segredo ou planilha foi copiado.");
}
