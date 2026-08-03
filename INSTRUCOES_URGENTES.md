# 🔧 INSTRUÇÕES URGENTES - Apps Script Corrigido

## ❌ Problema Identificado

O erro que você está vendo:
```
Unexpected error while getting the method or property openById on object SpreadsheetApp
```

Significa que seu Apps Script está tentando usar `openById()` mas **não deve usar isso**.

## ✅ SOLUÇÃO

### Passo 1: Copie o Código Correto

Abra o arquivo: **`apps-script-FIXED.gs`** (está no repositório)

### Passo 2: Cole no Google Apps Script

1. Abra sua planilha do Google Sheets
2. Vá em: **Extensions > Apps Script**
3. **DELETE TODO O CÓDIGO ANTIGO**
4. **Cole o código do `apps-script-FIXED.gs`**
5. Salve (Ctrl+S)

### Passo 3: Faça Deploy Novamente

1. Clique em **Deploy > New deployment**
2. Type: **Web app**
3. Execute as: **Me**
4. Who has access: **Anyone**  
5. Clique **Deploy**
6. **Copie a nova URL** (será diferente da antiga)

### Passo 4: Atualize a URL no Site

A URL do Apps Script não deve ficar no código. Configure a implantação somente no secret `APPS_SCRIPT_URL` do Cloudflare Worker.

Você vai precisar **substituir** por uma nova URL após fazer o deploy.

## 🔑 Diferença Chave

### ❌ Código Antigo (ERRADO):
```javascript
SpreadsheetApp.openById('ID_DA_PLANILHA')
```

### ✅ Código Novo (CORRETO):
```javascript
SpreadsheetApp.getActiveSpreadsheet()
```

O `getActiveSpreadsheet()` usa a planilha onde o script está vinculado automaticamente.

## 📋 Checklist

- [ ] Abrir Google Sheets
- [ ] Extensions > Apps Script
- [ ] Deletar código antigo
- [ ] Colar código do `apps-script-FIXED.gs`
- [ ] Salvar
- [ ] Deploy > New deployment como Web app
- [ ] Execute as: Me
- [ ] Who has access: Anyone
- [ ] Copiar nova URL
- [ ] Me enviar a nova URL aqui

## 🧪 Testar

Depois do deploy, teste exclusivamente pelo Portal autenticado e pelo gateway do Worker. Chamadas diretas ao Apps Script devem ser recusadas.

Deve retornar:
```javascript
teste123({"ok":true,"data":[]});
```

---

**Me envie a nova URL quando fizer o deploy!** 🚀
