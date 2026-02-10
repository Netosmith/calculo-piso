/**
 * Google Apps Script COM LOGS DE DEBUG
 * Para identificar problema com qtPorta
 */

// Nome da aba/sheet na planilha
const SHEET_NAME = 'Fretes';

// Cabeçalhos da planilha (ordem importante!)
const HEADERS = [
  'id', 'regional', 'filial', 'cliente', 'origem', 'coleta', 'contato',
  'destino', 'uf', 'descarga', 'volume', 'valorEmpresa', 'valorMotorista',
  'km', 'pedagioEixo', 'produto', 'icms', 'pedidoSat', 'qtPorta',
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
      result = { ok: true, data: listFretes() };
      
    } else if (action === 'save') {
      const data = JSON.parse(e.parameter.data);
      
      // 🔍 LOG: Ver o que está chegando
      Logger.log('📥 SAVE recebido:');
      Logger.log('  - qtPorta: ' + data.qtPorta);
      Logger.log('  - qtdPorta: ' + data.qtdPorta);
      Logger.log('  - qtdTransito: ' + data.qtdTransito);
      Logger.log('  - Objeto completo: ' + JSON.stringify(data));
      
      result = saveFrete(data);
      
    } else if (action === 'delete') {
      const id = e.parameter.id;
      result = deleteFrete(id);
      
    } else {
      result = { 
        ok: false,
        error: 'Ação inválida. Use: list, save ou delete' 
      };
    }
    
  } catch (error) {
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
 * Lista todos os fretes
 */
function listFretes() {
  try {
    const sheet = getSheet();
    const lastRow = sheet.getLastRow();
    
    if (lastRow <= 1) {
      return [];
    }
    
    const numCols = HEADERS.length;
    const dataRange = sheet.getRange(2, 1, lastRow - 1, numCols);
    const rows = dataRange.getValues();
    
    const fretes = rows
      .filter(row => row[0])
      .map(row => {
        let obj = {};
        HEADERS.forEach((header, index) => {
          obj[header] = row[index] !== undefined ? row[index] : "";
        });
        return obj;
      });
    
    return fretes;
    
  } catch (error) {
    throw new Error('Erro ao listar: ' + error.toString());
  }
}

/**
 * Salva ou atualiza um frete
 */
function saveFrete(data) {
  try {
    const sheet = getSheet();
    
    // Gera ID se não existir
    if (!data.id || data.id === '') {
      data.id = Utilities.getUuid();
    }
    
    const existingRowIndex = findRowById(sheet, data.id);
    
    if (existingRowIndex > 0) {
      updateRow(sheet, existingRowIndex, data);
      
      // 🔍 LOG: Confirmar o que foi salvo
      const savedRow = sheet.getRange(existingRowIndex, 1, 1, HEADERS.length).getValues()[0];
      const qtPortaIndex = HEADERS.indexOf('qtPorta');
      Logger.log('✅ ATUALIZADO - qtPorta na coluna ' + qtPortaIndex + ' = ' + savedRow[qtPortaIndex]);
      
      return { 
        ok: true,
        status: 'success', 
        message: 'Frete atualizado', 
        id: data.id 
      };
    } else {
      appendRow(sheet, data);
      
      // 🔍 LOG: Confirmar o que foi salvo
      const lastRow = sheet.getLastRow();
      const savedRow = sheet.getRange(lastRow, 1, 1, HEADERS.length).getValues()[0];
      const qtPortaIndex = HEADERS.indexOf('qtPorta');
      Logger.log('✅ CRIADO - qtPorta na coluna ' + qtPortaIndex + ' = ' + savedRow[qtPortaIndex]);
      
      return { 
        ok: true,
        status: 'success', 
        message: 'Frete criado', 
        id: data.id 
      };
    }
    
  } catch (error) {
    Logger.log('❌ ERRO ao salvar: ' + error.toString());
    return {
      ok: false,
      status: 'error',
      error: error.toString()
    };
  }
}

/**
 * Deleta um frete
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
      return { 
        ok: true,
        status: 'success',
        message: 'Frete excluído' 
      };
    } else {
      return { 
        ok: false,
        error: 'Frete não encontrado: ' + id 
      };
    }
    
  } catch (error) {
    return {
      ok: false,
      error: error.toString()
    };
  }
}

/**
 * Obtém a sheet
 */
function getSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    
    const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#0F172A');
    headerRange.setFontColor('#FFFFFF');
    
    sheet.setFrozenRows(1);
  }
  
  return sheet;
}

/**
 * Busca linha por ID
 */
function findRowById(sheet, id) {
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == id) {
      return i + 1;
    }
  }
  
  return -1;
}

/**
 * Atualiza linha
 */
function updateRow(sheet, rowIndex, data) {
  const values = HEADERS.map(header => {
    let value = data[header];
    
    // 🔍 LOG específico para qtPorta
    if (header === 'qtPorta') {
      Logger.log('  📝 Salvando qtPorta: ' + value + ' (tipo: ' + typeof value + ')');
    }
    
    if (value === null || value === undefined) {
      return '';
    }
    
    return value;
  });
  
  sheet.getRange(rowIndex, 1, 1, values.length).setValues([values]);
}

/**
 * Adiciona linha
 */
function appendRow(sheet, data) {
  const values = HEADERS.map(header => {
    let value = data[header];
    
    // 🔍 LOG específico para qtPorta
    if (header === 'qtPorta') {
      Logger.log('  📝 Salvando qtPorta: ' + value + ' (tipo: ' + typeof value + ')');
    }
    
    if (value === null || value === undefined) {
      return '';
    }
    
    return value;
  });
  
  sheet.appendRow(values);
}

/**
 * Teste
 */
function testSave() {
  const testData = {
    regional: 'GOIÁS',
    filial: 'ITUMBIARA',
    cliente: 'TESTE',
    origem: 'RIO VERDE',
    coleta: 'FAZ',
    contato: 'ARIEL',
    destino: 'SANTOS',
    uf: 'GO',
    descarga: 'TESTE',
    volume: 50,
    valorEmpresa: 100,
    valorMotorista: 90,
    km: 300,
    pedagioEixo: 5,
    produto: 'SOJA',
    icms: '',
    pedidoSat: '',
    qtPorta: 15,  // ✅ TESTE COM VALOR
    qtdTransito: 8,
    status: 'LIBERADO',
    obs: 'TESTE'
  };
  
  const result = saveFrete(testData);
  Logger.log('Resultado: ' + JSON.stringify(result));
}
