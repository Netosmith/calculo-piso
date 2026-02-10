/**
 * Google Apps Script para integração com fretes.html
 * Nova Frota Transportes - VERSÃO 2 (LÊ ESTRUTURA DINÂMICA)
 * 
 * INSTRUÇÕES DE CONFIGURAÇÃO:
 * 1. Cole este código no Apps Script (Extensions > Apps Script)
 * 2. Deploy como Web App (Deploy > Manage deployments > Editar deployment existente)
 * 3. Configure: Execute as "Me", Access "Anyone"
 * 4. A URL não deve mudar se você editar o deployment existente
 */

// Nome da aba/sheet na planilha
const SHEET_NAME = 'Fretes';

/**
 * Lê os cabeçalhos da planilha (primeira linha)
 */
function getHeaders(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return [];
  
  const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  return headerRow;
}

/**
 * Função principal - recebe todas as requisições
 */
function doGet(e) {
  const action = e.parameter.action;
  const callback = e.parameter.callback || 'callback';
  
  let result = {};
  
  try {
    if (action === 'list') {
      // Listar todos os fretes
      const fretes = listFretes();
      result = { ok: true, data: fretes };
      
    } else if (action === 'save') {
      // Salvar/atualizar frete
      const data = JSON.parse(e.parameter.data);
      result = saveFrete(data);
      
    } else if (action === 'delete') {
      // Deletar frete
      const id = e.parameter.id;
      result = deleteFrete(id);
      
    } else {
      result = { 
        ok: false,
        error: 'Ação inválida. Use: list, save ou delete' 
      };
    }
    
  } catch (error) {
    Logger.log('❌ ERRO: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
    
    result = { 
      ok: false,
      error: error.toString(),
      stack: error.stack 
    };
  }
  
  // Retorna JSONP (resolve CORS)
  const jsonp = callback + '(' + JSON.stringify(result) + ')';
  
  return ContentService
    .createTextOutput(jsonp)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

/**
 * Lista todos os fretes da planilha
 */
function listFretes() {
  try {
    const sheet = getSheet();
    const lastRow = sheet.getLastRow();
    
    // Se não houver dados além do cabeçalho
    if (lastRow <= 1) {
      Logger.log('📋 Nenhum frete encontrado');
      return [];
    }
    
    // ✅ Lê os cabeçalhos REAIS da planilha
    const headers = getHeaders(sheet);
    const numCols = headers.length;
    
    Logger.log('📊 Lendo ' + (lastRow - 1) + ' fretes com ' + numCols + ' colunas');
    Logger.log('📋 Cabeçalhos: ' + headers.join(', '));
    
    const dataRange = sheet.getRange(2, 1, lastRow - 1, numCols);
    const rows = dataRange.getValues();
    
    // Converte array de arrays para array de objetos
    const fretes = rows
      .filter(row => row[0]) // Ignora linhas vazias (sem ID)
      .map(row => {
        let obj = {};
        headers.forEach((header, index) => {
          const value = row[index];
          obj[header] = value !== undefined && value !== null ? value : "";
        });
        return obj;
      });
    
    Logger.log('✅ Retornando ' + fretes.length + ' fretes');
    
    // Log do primeiro frete para debug
    if (fretes.length > 0) {
      const primeiro = fretes[0];
      Logger.log('🔍 Primeiro frete (debug):');
      Logger.log('  - id: ' + primeiro.id);
      Logger.log('  - cliente: ' + primeiro.cliente);
      Logger.log('  - qtPorta: ' + primeiro.qtPorta);
      Logger.log('  - qtdTransito: ' + primeiro.qtdTransito);
    }
    
    return fretes;
    
  } catch (error) {
    Logger.log('❌ Erro em listFretes: ' + error.toString());
    throw new Error('Erro ao listar fretes: ' + error.toString());
  }
}

/**
 * Salva ou atualiza um frete
 */
function saveFrete(data) {
  try {
    const sheet = getSheet();
    const headers = getHeaders(sheet);
    
    // Gera ID se não existir
    if (!data.id || data.id === '') {
      data.id = Utilities.getUuid();
      Logger.log('🆕 Criando novo frete com ID: ' + data.id);
    } else {
      Logger.log('✏️ Atualizando frete ID: ' + data.id);
    }
    
    // Log dos valores de quantidade
    Logger.log('📦 Valores recebidos:');
    Logger.log('  - qtPorta: ' + data.qtPorta + ' (tipo: ' + typeof data.qtPorta + ')');
    Logger.log('  - qtdTransito: ' + data.qtdTransito + ' (tipo: ' + typeof data.qtdTransito + ')');
    
    // Busca se já existe um frete com este ID
    const existingRowIndex = findRowById(sheet, data.id);
    
    if (existingRowIndex > 0) {
      // Atualiza linha existente
      updateRow(sheet, existingRowIndex, data, headers);
      Logger.log('✅ Frete atualizado na linha ' + existingRowIndex);
      return { 
        ok: true,
        status: 'success', 
        message: 'Frete atualizado com sucesso', 
        id: data.id 
      };
    } else {
      // Adiciona nova linha
      appendRow(sheet, data, headers);
      Logger.log('✅ Frete criado');
      return { 
        ok: true,
        status: 'success', 
        message: 'Frete criado com sucesso', 
        id: data.id 
      };
    }
  } catch (error) {
    Logger.log('❌ Erro em saveFrete: ' + error.toString());
    return {
      ok: false,
      error: error.toString()
    };
  }
}

/**
 * Deleta um frete pelo ID
 */
function deleteFrete(id) {
  try {
    const sheet = getSheet();
    
    if (!id || id === '') {
      return { 
        ok: false,
        error: 'ID não fornecido' 
      };
    }
    
    const rowIndex = findRowById(sheet, id);
    
    if (rowIndex > 0) {
      sheet.deleteRow(rowIndex);
      Logger.log('🗑️ Frete deletado da linha ' + rowIndex);
      return { 
        ok: true,
        status: 'success', 
        message: 'Frete excluído com sucesso' 
      };
    } else {
      return { 
        ok: false,
        error: 'Frete não encontrado com ID: ' + id 
      };
    }
  } catch (error) {
    Logger.log('❌ Erro em deleteFrete: ' + error.toString());
    return {
      ok: false,
      error: error.toString()
    };
  }
}

/**
 * Obtém a sheet de fretes
 */
function getSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    throw new Error('Aba "' + SHEET_NAME + '" não encontrada!');
  }
  
  return sheet;
}

/**
 * Busca a linha pelo ID
 * @returns número da linha (1-based) ou -1 se não encontrar
 */
function findRowById(sheet, id) {
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) { // Começa em 1 (pula cabeçalho)
    if (data[i][0] == id) { // Primeira coluna é o ID
      return i + 1; // +1 porque array é 0-based mas sheet é 1-based
    }
  }
  
  return -1; // Não encontrado
}

/**
 * Atualiza uma linha existente
 */
function updateRow(sheet, rowIndex, data, headers) {
  const values = headers.map(header => {
    let value = data[header];
    
    // Converte valores vazios para string vazia
    if (value === null || value === undefined || value === '') {
      return '';
    }
    
    return value;
  });
  
  Logger.log('📝 Escrevendo valores na linha ' + rowIndex + ':');
  headers.forEach((header, index) => {
    if (header === 'qtPorta' || header === 'qtdTransito') {
      Logger.log('  - ' + header + ' (coluna ' + (index + 1) + '): ' + values[index]);
    }
  });
  
  sheet.getRange(rowIndex, 1, 1, values.length).setValues([values]);
}

/**
 * Adiciona uma nova linha
 */
function appendRow(sheet, data, headers) {
  const values = headers.map(header => {
    let value = data[header];
    
    // Converte valores vazios para string vazia
    if (value === null || value === undefined || value === '') {
      return '';
    }
    
    return value;
  });
  
  Logger.log('📝 Adicionando nova linha:');
  headers.forEach((header, index) => {
    if (header === 'qtPorta' || header === 'qtdTransito') {
      Logger.log('  - ' + header + ' (coluna ' + (index + 1) + '): ' + values[index]);
    }
  });
  
  sheet.appendRow(values);
}

/**
 * Função de teste - lista fretes
 */
function testListFretes() {
  const result = listFretes();
  Logger.log('📊 Total de fretes: ' + result.length);
  if (result.length > 0) {
    Logger.log('🔍 Primeiro frete:');
    Logger.log(JSON.stringify(result[0], null, 2));
  }
}

/**
 * Função de teste - salvar frete
 */
function testSaveFrete() {
  const testData = {
    regional: 'GOIÁS',
    filial: 'ITUMBIARA',
    cliente: 'TESTE QTPORTA',
    origem: 'RIO VERDE-GO',
    coleta: 'FAZ TESTE',
    contato: 'ARIEL 64 99227-7537',
    destino: 'SANTOS/SP',
    uf: 'GO',
    descarga: 'TESTE DESCARGA',
    volume: 75,
    valorEmpresa: 87,
    valorMotorista: 80,
    km: 330,
    pedagioEixo: 7.40,
    produto: 'SOJA',
    icms: 'ISENTO (CIF)',
    pedidoSat: 12245,
    qtPorta: 99,  // ⭐ TESTE
    qtdTransito: 88,  // ⭐ TESTE
    status: 'LIBERADO',
    obs: 'TESTE DE INTEGRAÇÃO COM QTPORTA'
  };
  
  Logger.log('🧪 Testando salvamento com:');
  Logger.log('  qtPorta: ' + testData.qtPorta);
  Logger.log('  qtdTransito: ' + testData.qtdTransito);
  
  const result = saveFrete(testData);
  Logger.log('📋 Resultado:');
  Logger.log(JSON.stringify(result, null, 2));
}
