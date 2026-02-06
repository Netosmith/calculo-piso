/**
 * Google Apps Script para integração com fretes.html
 * Nova Frota Transportes
 * 
 * INSTRUÇÕES DE CONFIGURAÇÃO:
 * 1. Crie uma planilha no Google Sheets chamada "Fretes"
 * 2. A primeira linha deve ter os cabeçalhos (nomes das colunas)
 * 3. Cole este código no Apps Script (Extensions > Apps Script)
 * 4. Deploy como Web App (Deploy > New deployment)
 * 5. Configure: Execute as "Me", Access "Anyone"
 * 6. Copie a URL do deployment e atualize no fretes.js
 */

// Nome da aba/sheet na planilha
const SHEET_NAME = 'Fretes';

// Cabeçalhos da planilha (ordem importante!)
const HEADERS = [
  'id', 'regional', 'filial', 'cliente', 'origem', 'coleta', 'contato',
  'destino', 'uf', 'descarga', 'volume', 'valorEmpresa', 'valorMotorista',
  'km', 'pedagioEixo', 'produto', 'icms', 'pedidoSat', 'qtdPorta',
  'qtdTransito', 'status', 'obs'
];

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
      result = listFretes();
      
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
        status: 'error', 
        message: 'Ação inválida. Use: list, save ou delete' 
      };
    }
    
  } catch (error) {
    result = { 
      status: 'error', 
      message: error.toString(),
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
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  
  // Se não houver dados além do cabeçalho
  if (data.length <= 1) {
    return [];
  }
  
  const headers = data[0];
  const rows = data.slice(1); // Pula cabeçalho
  
  // Converte array de arrays para array de objetos
  const fretes = rows
    .filter(row => row[0]) // Ignora linhas vazias
    .map(row => {
      let obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    });
  
  return fretes;
}

/**
 * Salva ou atualiza um frete
 */
function saveFrete(data) {
  const sheet = getSheet();
  
  // Gera ID se não existir
  if (!data.id || data.id === '') {
    data.id = Utilities.getUuid();
  }
  
  // Busca se já existe um frete com este ID
  const existingRowIndex = findRowById(sheet, data.id);
  
  if (existingRowIndex > 0) {
    // Atualiza linha existente
    updateRow(sheet, existingRowIndex, data);
    return { 
      status: 'success', 
      message: 'Frete atualizado com sucesso', 
      id: data.id 
    };
  } else {
    // Adiciona nova linha
    appendRow(sheet, data);
    return { 
      status: 'success', 
      message: 'Frete criado com sucesso', 
      id: data.id 
    };
  }
}

/**
 * Deleta um frete pelo ID
 */
function deleteFrete(id) {
  const sheet = getSheet();
  
  if (!id || id === '') {
    return { 
      status: 'error', 
      message: 'ID não fornecido' 
    };
  }
  
  const rowIndex = findRowById(sheet, id);
  
  if (rowIndex > 0) {
    sheet.deleteRow(rowIndex);
    return { 
      status: 'success', 
      message: 'Frete excluído com sucesso' 
    };
  } else {
    return { 
      status: 'error', 
      message: 'Frete não encontrado com ID: ' + id 
    };
  }
}

/**
 * Obtém a sheet de fretes
 */
function getSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  
  // Se a sheet não existir, cria uma nova
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
    // Adiciona cabeçalhos
    sheet.appendRow(HEADERS);
    
    // Formata cabeçalho
    const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#0F172A');
    headerRange.setFontColor('#FFFFFF');
    
    // Congela primeira linha
    sheet.setFrozenRows(1);
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
function updateRow(sheet, rowIndex, data) {
  const values = HEADERS.map(header => {
    let value = data[header];
    
    // Converte valores vazios para string vazia
    if (value === null || value === undefined) {
      return '';
    }
    
    return value;
  });
  
  sheet.getRange(rowIndex, 1, 1, values.length).setValues([values]);
}

/**
 * Adiciona uma nova linha
 */
function appendRow(sheet, data) {
  const values = HEADERS.map(header => {
    let value = data[header];
    
    // Converte valores vazios para string vazia
    if (value === null || value === undefined) {
      return '';
    }
    
    return value;
  });
  
  sheet.appendRow(values);
}

/**
 * Função de teste - execute para testar
 */
function testListFretes() {
  const result = listFretes();
  Logger.log('Total de fretes: ' + result.length);
  Logger.log(JSON.stringify(result, null, 2));
}

/**
 * Função de teste - salvar frete
 */
function testSaveFrete() {
  const testData = {
    id: Utilities.getUuid(),
    regional: 'GOIÁS',
    filial: 'ITUMBIARA',
    cliente: 'TESTE CLIENTE',
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
    qtdPorta: 2,
    qtdTransito: 3,
    status: 'LIBERADO',
    obs: 'TESTE DE INTEGRAÇÃO'
  };
  
  const result = saveFrete(testData);
  Logger.log(JSON.stringify(result, null, 2));
}

/**
 * Função de teste - deletar frete
 */
function testDeleteFrete() {
  // Substitua pelo ID real de um frete de teste
  const testId = 'seu-id-aqui';
  const result = deleteFrete(testId);
  Logger.log(JSON.stringify(result, null, 2));
}

/**
 * Função para limpar todos os dados (CUIDADO!)
 */
function clearAllFretes() {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
    Logger.log('Todos os fretes foram removidos. Cabeçalho mantido.');
  } else {
    Logger.log('Nenhum frete para remover.');
  }
}
