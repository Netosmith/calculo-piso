/* Exportação local para automação com AutoHotkey v2.
   Formato linha CHAVE=VALOR, codificação UTF-8 com BOM.
   Os dados NUNCA são enviados ao servidor pelo exportador. */
(function(root,factory){
 "use strict";
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root)root.PortalOCRAutoHotkey=api;
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const FIELD_KEYS=Object.freeze({
  cnh:Object.freeze({
   nome:"NOME_COMPLETO",cpf:"CPF",rg:"RG",nascimento:"DATA_NASCIMENTO",
   registro:"REGISTRO_CNH",categoria:"CATEGORIA_CNH",validade:"VALIDADE_CNH",
   primeiraHabilitacao:"PRIMEIRA_HABILITACAO",localEmissao:"LOCAL_EMISSAO"
  }),
  veiculo:Object.freeze({
   placa:"PLACA",renavam:"RENAVAM",chassi:"CHASSI",
   especieTipo:"ESPECIE_TIPO_CRLV",tipoVeiculoSistema:"TIPO_VEICULO_SISTEMA",
   marcaModelo:"MARCA_MODELO",anoFabricacao:"ANO_FABRICACAO",
   anoModelo:"ANO_MODELO",cor:"COR",proprietario:"PROPRIETARIO",
   cpfCnpj:"CPF_CNPJ_PROPRIETARIO",municipio:"CIDADE_EMPLACAMENTO",
   uf:"UF_EMPLACAMENTO",combustivel:"COMBUSTIVEL"
  }),
  endereco:Object.freeze({
   titular:"TITULAR",cpfCnpj:"CPF_CNPJ",logradouro:"LOGRADOURO",numero:"NUMERO",
   complemento:"COMPLEMENTO",bairro:"BAIRRO",cidade:"CIDADE",uf:"UF",
   cep:"CEP",referencia:"REFERENCIA"
  }),
  geral:Object.freeze({})
 });
 function safe(value){
  // Mantém os acentos da escrita e impede que valores criem novas chaves.
  return String(value??"").normalize("NFC")
   .replace(/[\u0000-\u001F\u007F]/g," ").replace(/\s{2,}/g," ").trim();
 }
 function fromDocument(documento){
  if(!documento||typeof documento!=="object"||
     !documento.campos||typeof documento.campos!=="object"||
     !Object.hasOwn(FIELD_KEYS,documento.tipoDocumento))
   throw new Error("Documento não reconhecido para exportação AutoHotkey.");
  const lines=[
   "# Portal Frete OCR | intercâmbio local para AutoHotkey v2",
   "# Revise os dados antes de preencher o sistema de cadastro",
   "FORMATO=PORTAL_FRETE_OCR_V1",
   "TIPO_DOCUMENTO="+safe(documento.tipoDocumento),
   "ARQUIVO_ORIGEM="+safe(documento.nomeArquivo),
   "CONFERENCIA_OBRIGATORIA=SIM"
  ];
  for(const [field,key] of Object.entries(FIELD_KEYS[documento.tipoDocumento]))
   lines.push(key+"="+safe(documento.campos[field]));
  return "\uFEFF"+lines.join("\r\n")+"\r\n";
 }
 return Object.freeze({FIELD_KEYS,fromDocument});
});