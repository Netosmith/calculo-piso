# 📊 Integração Google Sheets - Fretes.html

## 🎯 Visão Geral

O sistema **fretes.html** agora está integrado com Google Sheets para permitir que **todos os usuários vejam as mesmas informações**, funcionando como uma planilha compartilhada em tempo real.

## 🔗 Configuração Atual

**API URL:** `https://script.google.com/macros/s/AKfycbz05hQfNPztgZm24gzE7jgODmCU1nQqAxpCJbmJs9j_g8pR86xVRqEWQS_zUXqKogG2/exec`

## 📋 Funcionalidades Implementadas

### ✅ CRUD Completo Sincronizado

1. **CREATE (Criar)** - Quando um usuário adiciona um novo frete, é salvo no Sheets
2. **READ (Ler)** - Ao carregar a página, busca todos os fretes do Sheets
3. **UPDATE (Atualizar)** - Quando edita um frete, atualiza no Sheets
4. **DELETE (Excluir)** - Quando remove um frete, deleta do Sheets

### 🔄 Sincronização em Tempo Real

- **Ao abrir a página**: Carrega automaticamente os dados do Google Sheets
- **Ao salvar/editar**: Envia os dados para o Sheets imediatamente
- **Ao excluir**: Remove do Sheets em tempo real
- **Botão "🔄 Atualizar"**: Permite recarregar manualmente os dados do Sheets

### 📊 Indicador de Status

No topo da página, há um indicador visual que mostra:
- 🔄 **Carregando...** - Buscando dados do Sheets
- ✅ **Sincronizado (X fretes)** - Dados carregados com sucesso
- ❌ **Erro/Offline** - Falha na conexão, usando dados locais

## 🛠️ Google Apps Script - Endpoints Necessários

Seu Apps Script deve ter os seguintes endpoints:

### 1. **Listar Todos os Fretes**
```javascript
// GET ?action=list&callback=cb_xxxxx
// Retorna: Array de objetos com todos os fretes
```

### 2. **Salvar/Atualizar Frete**
```javascript
// GET ?action=save&data=JSON&callback=cb_xxxxx
// Recebe: objeto com todos os campos do frete
// Retorna: {status: 'success', message: '...', id: '...'}
```

### 3. **Deletar Frete**
```javascript
// GET ?action=delete&id=XXXX&callback=cb_xxxxx
// Recebe: id do frete
// Retorna: {status: 'success', message: '...'}
```

## 📦 Estrutura de Dados

Cada frete deve ter os seguintes campos:

```javascript
{
  id: "uuid",                    // ID único
  regional: "GOIÁS",
  filial: "ITUMBIARA",
  cliente: "CARGILL",
  origem: "RIO VERDE-GO",
  coleta: "FAZ SANTANA",
  contato: "ARIEL 64 99227-7537", // Fixo (lista pré-definida)
  destino: "SANTOS/SP",
  uf: "GO",
  descarga: "CARGILL",
  volume: 75,                     // número ou ""
  valorEmpresa: 87,               // número ou ""
  valorMotorista: 80,             // número ou ""
  km: 330,                        // número ou ""
  pedagioEixo: 7.40,             // número ou ""
  produto: "SOJA",
  icms: "ISENTO (CIF)",
  pedidoSat: 12245,              // número ou ""
  qtdPorta: 2,                   // número ou ""
  qtdTransito: 3,                // número ou ""
  status: "LIBERADO",            // LIBERADO | PARADO | SUSPENSO
  obs: "AGENDAMENTO ALONGADO"
}
```

## 🔒 Método JSONP (Resolve CORS)

O sistema usa **JSONP** para contornar problemas de CORS do GitHub Pages:
- Adiciona `?callback=cb_xxxxx` em todas as requisições
- O Apps Script deve retornar: `callback_name({data})`

## 🌐 Exemplo de Apps Script (Google)

```javascript
function doGet(e) {
  const action = e.parameter.action;
  const callback = e.parameter.callback || 'callback';
  
  let result = {};
  
  try {
    if (action === 'list') {
      result = listFretes();
    } else if (action === 'save') {
      const data = JSON.parse(e.parameter.data);
      result = saveFrete(data);
    } else if (action === 'delete') {
      const id = e.parameter.id;
      result = deleteFrete(id);
    }
  } catch (error) {
    result = { status: 'error', message: error.toString() };
  }
  
  // JSONP response
  return ContentService
    .createTextOutput(callback + '(' + JSON.stringify(result) + ')')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function listFretes() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Fretes');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);
  
  return rows.map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function saveFrete(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Fretes');
  
  // Se tem ID, atualiza; senão, cria novo
  if (data.id) {
    // Busca linha existente e atualiza
    updateRow(sheet, data);
  } else {
    // Adiciona nova linha
    data.id = Utilities.getUuid();
    appendRow(sheet, data);
  }
  
  return { status: 'success', message: 'Frete salvo', id: data.id };
}

function deleteFrete(id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Fretes');
  
  // Busca e deleta a linha com o ID
  deleteRowById(sheet, id);
  
  return { status: 'success', message: 'Frete excluído' };
}
```

## 📱 Cache Local (Modo Offline)

O sistema mantém uma cópia local no `localStorage`:
- Permite trabalhar offline (visualização apenas)
- Ao voltar online, tenta sincronizar automaticamente
- Operações de salvamento/exclusão exigem conexão

## 🎨 Melhorias Implementadas

1. ✅ **Feedback Visual**: Loading states em todos os botões
2. ✅ **Mensagens Claras**: Sucesso/erro em todas operações
3. ✅ **Status de Sync**: Indicador sempre visível
4. ✅ **Botão Atualizar**: Recarrega manualmente quando necessário
5. ✅ **Dados Compartilhados**: Todos veem as mesmas informações

## 🚀 Como Testar

1. Abra `pages/fretes.html` em múltiplas abas/navegadores
2. Adicione um novo frete em uma aba
3. Clique em "🔄 Atualizar" na outra aba
4. Veja o frete aparecer em todas as abas!

## 📝 Observações Importantes

- **Contatos são fixos**: Lista pré-definida no código
- **Filiais são fixas**: Lista pré-definida com ordem específica
- **Pesos são por usuário**: Salvos localmente (não no Sheets)
- **ID único**: Gerado automaticamente (UUID)

## 🔧 Manutenção

Para alterar a URL do Apps Script:
1. Abra `assets/js/fretes.js`
2. Localize `const API_URL = "..."`
3. Substitua pela nova URL
4. Commit e push as mudanças

---

**Desenvolvido por:** Nova Frota Transportes  
**Última atualização:** 2026-02-06
