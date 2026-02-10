# 🔧 SOLUÇÃO DEFINITIVA - qtPorta não grava

## 🎯 PROBLEMA IDENTIFICADO

Sua planilha tem **COLUNAS EXTRAS** (p5E, p6E, p7E, p4E, p9E) que o código não esperava!

```
Estrutura ESPERADA pelo código antigo:
id | regional | filial | ... | produto | icms | pedidoSat | qtPorta | qtdTransito | ...
                                    ^15      ^16      ^17      ^18         ^19

Estrutura REAL da sua planilha:
id | regional | filial | ... | produto | icms | pedidoSat | p5E | p6E | p7E | p4E | p9E | qtPorta | qtdTransito | ...
                                    ^15      ^16      ^17    ^18   ^19   ^20   ^21   ^22     ^23         ^24
```

O código tentava gravar `qtPorta` na coluna 18, mas na verdade ele está na coluna 23!

---

## ✅ SOLUÇÃO

Criei um **novo Apps Script** que **lê dinamicamente** a estrutura da planilha (qualquer ordem de colunas funciona).

---

## 📋 PASSO A PASSO PARA CORRIGIR

### 1️⃣ Abrir o Apps Script

1. Abra sua planilha do Google Sheets
2. Vá em **Extensions** > **Apps Script**

### 2️⃣ Substituir o código

1. **Selecione TODO o código** atual (Ctrl+A)
2. **Delete** tudo
3. Abra o arquivo **`apps-script-FIXED-v2.gs`** do repositório:
   - https://github.com/Netosmith/calculo-piso/blob/main/apps-script-FIXED-v2.gs
4. **Copie TODO o conteúdo**
5. **Cole** no Apps Script
6. **Salve** (Ctrl+S ou ícone de disquete)

### 3️⃣ Fazer deployment

**IMPORTANTE**: Não crie um novo deployment! **Edite o existente**:

1. Clique em **Deploy** > **Manage deployments**
2. Clique no **ícone de lápis** ✏️ ao lado do deployment existente
3. Em **Version**, selecione **New version**
4. Clique em **Deploy**
5. **A URL não vai mudar!** ✅

### 4️⃣ Testar no Apps Script

Antes de testar no site, vamos testar direto no Apps Script:

1. No menu de funções (dropdown no topo), selecione: **`testSaveFrete`**
2. Clique em **Run** (▶️)
3. Vá em **View** > **Executions** (ou Ctrl+Enter)
4. Veja os logs

**Esperado nos logs:**
```
🧪 Testando salvamento com:
  qtPorta: 99
  qtdTransito: 88
✏️ Atualizando frete ID: ...
📦 Valores recebidos:
  - qtPorta: 99 (tipo: number)
  - qtdTransito: 88 (tipo: number)
📝 Escrevendo valores na linha X:
  - qtPorta (coluna 23): 99  ⬅️ DEVE MOSTRAR A COLUNA CORRETA!
  - qtdTransito (coluna 24): 88
✅ Frete atualizado na linha X
```

### 5️⃣ Verificar na planilha

1. Volte para a planilha do Google Sheets
2. Procure a linha com cliente **"TESTE QTPORTA"**
3. Verifique se apareceu **qtPorta = 99** e **qtdTransito = 88**

Se aparecer, está funcionando! 🎉

### 6️⃣ Testar no site

1. Abra `fretes.html`
2. Pressione **Ctrl+F5** (recarregar sem cache)
3. Clique em **"🔄 Atualizar"** (recarregar do Sheets)
4. **Edite** um frete existente
5. Altere **Qtd Porta** e **Qtd Trânsito**
6. **Salve**
7. Clique em **"🔄 Atualizar"** novamente
8. Verifique se os valores aparecem

### 7️⃣ Testar share-clientes

1. Abra `share-clientes.html`
2. Selecione um cliente
3. Verifique se os valores de **CMH's Local** e **CMH's Trans** estão corretos

---

## 🔍 SE NÃO FUNCIONAR

Me envie os **logs da execução** do Apps Script (passo 4) mostrando:
- Qual coluna ele tentou gravar
- Se apareceu erro

---

## 📊 O QUE MUDOU NO NOVO CÓDIGO

### Antes (ERRADO):
```javascript
const HEADERS = ['id', 'regional', 'filial', ...]; // Lista fixa
// Sempre tentava gravar na mesma posição (índice fixo)
```

### Depois (CORRETO):
```javascript
function getHeaders(sheet) {
  // Lê a primeira linha da planilha
  const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  return headerRow;
}

// Usa os cabeçalhos REAIS da planilha
const headers = getHeaders(sheet);
const values = headers.map(header => data[header]);
```

Agora funciona com **qualquer estrutura de planilha**! 🎯

---

## ✅ CHECKLIST

- [ ] Substituir código no Apps Script
- [ ] Fazer deployment (editar o existente)
- [ ] Executar `testSaveFrete` no Apps Script
- [ ] Verificar logs (qual coluna usou)
- [ ] Verificar planilha (valores gravados)
- [ ] Testar no site (fretes.html)
- [ ] Testar share-clientes.html

---

**Avise quando terminar! 🚀**
