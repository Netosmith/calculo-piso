# 🧪 TESTE DIRETO - VERIFICAR SE APPS SCRIPT GRAVA qtPorta

## 📋 TESTE 1: Testar direto no navegador

Cole esta URL no navegador (substitua a URL do Apps Script pela sua):

```
https://script.google.com/macros/s/SUA_URL_AQUI/exec?action=save&data={"id":"","regional":"GOIÁS","filial":"ITUMBIARA","cliente":"TESTE BROWSER","origem":"RIO VERDE","coleta":"FAZ TESTE","contato":"ARIEL","destino":"CABECEIRAS","uf":"GO","descarga":"GRANJA","volume":100,"valorEmpresa":100,"valorMotorista":90,"km":500,"pedagioEixo":30,"produto":"SOJA","icms":"ISENTO","pedidoSat":999,"qtPorta":555,"qtdTransito":444,"status":"LIBERADO","obs":"TESTE DIRETO"}&callback=teste123
```

**Substitua `SUA_URL_AQUI`** pela sua URL do Apps Script (sem o /exec no final).

### ✅ Resultado esperado:

```javascript
teste123({"ok":true,"status":"success","message":"Frete criado com sucesso","id":"..."})
```

Depois, **verifique na planilha** se apareceu a linha com:
- cliente: TESTE BROWSER
- qtPorta: 555
- qtdTransito: 444

---

## 📋 TESTE 2: Ver o que o Apps Script está recebendo

Adicione esta função no Apps Script para logar TUDO que chega:

```javascript
function doGet(e) {
  // 🔍 LOG COMPLETO DO QUE ESTÁ CHEGANDO
  Logger.log('📨 REQUISIÇÃO RECEBIDA:');
  Logger.log('  action: ' + e.parameter.action);
  Logger.log('  data (raw): ' + e.parameter.data);
  
  if (e.parameter.data) {
    try {
      const parsed = JSON.parse(e.parameter.data);
      Logger.log('  data (parsed): ' + JSON.stringify(parsed, null, 2));
      Logger.log('  qtPorta no parsed: ' + parsed.qtPorta);
      Logger.log('  qtdTransito no parsed: ' + parsed.qtdTransito);
    } catch (err) {
      Logger.log('  ERRO ao fazer parse: ' + err);
    }
  }
  
  // ... resto do código doGet
}
```

---

## 📋 TESTE 3: Verificar se o problema é no mapeamento

Me envie:

1. **Print da linha de cabeçalho** da planilha (todas as colunas)
2. **Print de uma linha de dados** que você criou manualmente (com qtPorta preenchido)
3. **Logs do Apps Script** após executar `testSaveFrete`

---

## 🎯 SOLUÇÃO ALTERNATIVA: Simplificar o Apps Script

Vou criar uma versão **ultra-simples** que grava diretamente pela posição da coluna:

