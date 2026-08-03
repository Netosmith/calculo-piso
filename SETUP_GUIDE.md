# 🚀 Guia Rápido de Setup - Integração Google Sheets

## ✅ O Que Foi Feito

Sua página `fretes.html` agora está **100% integrada com Google Sheets**! Todos os usuários que acessarem verão os **mesmos dados compartilhados**, funcionando como uma planilha do Google.

## 🔧 O Que Você Precisa Fazer no Google

### Passo 1: Verificar/Configurar o Google Apps Script

O endereço do Apps Script deve ser configurado somente no secret `APPS_SCRIPT_URL` do Cloudflare Worker. O frontend usa `PortalAPI` e nunca chama a implantação diretamente.

Certifique-se de que ele responde aos seguintes endpoints:

#### 1. **Listar Fretes** (GET)
```
?action=list&callback=cb_xxxxx
```
**Retorna:** Array de objetos com todos os fretes

#### 2. **Salvar Frete** (GET)
```
?action=save&data={"id":"xxx",...}&callback=cb_xxxxx
```
**Retorna:** `{status: 'success', message: '...', id: '...'}`

#### 3. **Deletar Frete** (GET)
```
?action=delete&id=xxx&callback=cb_xxxxx
```
**Retorna:** `{status: 'success', message: '...'}`

### Passo 2: Estrutura da Planilha

Sua planilha Google Sheets deve ter uma aba chamada **"Fretes"** com as seguintes colunas (primeira linha):

```
id | regional | filial | cliente | origem | coleta | contato | destino | uf | descarga | volume | valorEmpresa | valorMotorista | km | pedagioEixo | produto | icms | pedidoSat | qtdPorta | qtdTransito | status | obs
```

### Passo 3: Código do Apps Script

Use o arquivo `apps-script-example.gs` fornecido. Ele tem:
- ✅ Todas as funções necessárias (list, save, delete)
- ✅ Tratamento de erros
- ✅ JSONP para resolver CORS
- ✅ Funções de teste
- ✅ Auto-criação da planilha se não existir

## 🎯 Como Funciona Agora

### 1️⃣ **Carregar Página**
- Abre `pages/fretes.html`
- Automaticamente busca dados do Google Sheets
- Mostra: "✅ Sincronizado (X fretes)"

### 2️⃣ **Adicionar Novo Frete**
- Clica em "+ Novo"
- Preenche o formulário
- Clica em "Salvar"
- **Salva no Google Sheets**
- Todos os outros usuários verão ao atualizar

### 3️⃣ **Editar Frete**
- Clica em "Editar" na linha
- Modifica os dados
- Clica em "Salvar"
- **Atualiza no Google Sheets**
- Mudança visível para todos

### 4️⃣ **Excluir Frete**
- Clica em "Excluir" na linha
- Confirma a exclusão
- **Remove do Google Sheets**
- Desaparece para todos

### 5️⃣ **Atualizar Manualmente**
- Clica no botão "🔄 Atualizar"
- Recarrega dados mais recentes do Sheets
- Vê mudanças feitas por outros usuários

## 🔍 Indicadores Visuais

No topo da página você verá:

- **🔄 Carregando...** (azul) - Buscando dados
- **✅ Sincronizado (15 fretes)** (verde) - Tudo ok
- **❌ Erro/Offline** (vermelho) - Sem conexão

## 📱 Modo Offline

Se a conexão com o Google Sheets falhar:
- ✅ Continua mostrando dados do cache local
- ⚠️ Operações de salvar/editar/excluir NÃO funcionarão
- 💾 Ao voltar online, pode atualizar manualmente

## 🧪 Como Testar

### Teste 1: Múltiplos Usuários
1. Abra o site em 2 navegadores diferentes (ou abas anônimas)
2. Adicione um frete no navegador 1
3. Clique em "🔄 Atualizar" no navegador 2
4. **O frete deve aparecer!** ✅

### Teste 2: Sincronização
1. Adicione um frete pelo site
2. Abra sua planilha do Google Sheets
3. **Veja o frete aparecer lá!** ✅

### Teste 3: Edição Compartilhada
1. Edite um frete no Google Sheets diretamente
2. Clique em "🔄 Atualizar" no site
3. **Veja as mudanças aparecerem!** ✅

## ⚙️ Configurações Avançadas

### Alterar URL do Apps Script
Se precisar mudar a URL:

1. Abra as configurações do Cloudflare Worker
2. Atualize o secret `APPS_SCRIPT_URL`
3. Publique uma nova versão do Worker

Não grave a URL do Apps Script no frontend ou no repositório.

### Adicionar Novos Campos
Para adicionar um campo novo:

1. Adicione a coluna no Google Sheets
2. Atualize `HEADERS` no Apps Script
3. Adicione o campo no formulário HTML
4. Adicione o campo na função `collectModal()` do JS

## 🎉 Pronto!

Seu sistema agora funciona como uma **planilha compartilhada em tempo real**!

### O Que Mudou:
- ❌ **Antes:** Cada usuário tinha seus próprios dados locais
- ✅ **Agora:** Todos veem e editam os mesmos dados compartilhados

### Vantagens:
- 👥 Colaboração em tempo real
- 📊 Dados centralizados no Google Sheets
- 🔄 Sincronização automática
- 💾 Backup automático pelo Google
- 📱 Acesso de qualquer lugar

---

**Dúvidas?** Verifique:
- `GOOGLE_SHEETS_INTEGRATION.md` - Documentação completa
- `apps-script-example.gs` - Código do Apps Script
- Console do navegador (F12) - Para ver logs de erro

**Desenvolvido por:** Nova Frota Transportes  
**Data:** 2026-02-06
