/**
 * Apps Script PADRONIZADO - VERSÃO FINAL
 * Usa apenas "porta" e "transito" (minúsculas, sem prefixos)
 */

const SHEET_NAME = 'Fretes';

function doGet(e) {
  const action = e.parameter.action;
  const callback = e.parameter.callback || 'callback';
  
  let result = {};
  
  try {
    if (action === 'list') {
      result = { ok: true, data: listFretes() };
      
    } else if (action === 'save') {
      const data = JSON.parse(e.parameter.data);
      result = saveFrete(data);
      
    } else if (action === 'delete') {
      result = deleteFrete(e.parameter.id);
      
    } else {
      result = { ok: false, error: 'Ação inválida' };
    }
    
  } catch (error) {
    Logger.log('❌ ERRO: ' + error.toString());
    result = { ok: false, error: error.toString() };
  }
  
  const jsonp = callback + '(' + JSON.stringify(result) + ')';
  return ContentService.createTextOutput(jsonp).setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function listFretes() {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  
  if (lastRow <= 1) return [];
  
  // Lê TODAS as 22 colunas
  const data = sheet.getRange(2, 1, lastRow - 1, 22).getValues();
  
  return data.filter(row => row[0]).map(row => ({
    id: row[0] || '',
    regional: row[1] || '',
    filial: row[2] || '',
    cliente: row[3] || '',
    origem: row[4] || '',
    coleta: row[5] || '',
    contato: row[6] || '',
    destino: row[7] || '',
    uf: row[8] || '',
    descarga: row[9] || '',
    volume: row[10] || '',
    valorEmpresa: row[11] || '',
    valorMotorista: row[12] || '',
    km: row[13] || '',
    pedagioEixo: row[14] || '',
    produto: row[15] || '',
    icms: row[16] || '',
    pedidoSat: row[17] || '',
    porta: row[18] || '',      // ⭐ Coluna 19
    transito: row[19] || '',   // ⭐ Coluna 20
    status: row[20] || '',
    obs: row[21] || ''
  }));
}

function saveFrete(data) {
  const sheet = getSheet();
  
  if (!data.id || data.id === '') {
    data.id = Utilities.getUuid();
  }
  
  Logger.log('💾 Salvando frete:');
  Logger.log('  porta: ' + data.porta);
  Logger.log('  transito: ' + data.transito);
  
  // Array na ordem das colunas
  const rowData = [
    data.id || '',                      // 1
    data.regional || '',                // 2
    data.filial || '',                  // 3
    data.cliente || '',                 // 4
    data.origem || '',                  // 5
    data.coleta || '',                  // 6
    data.contato || '',                 // 7
    data.destino || '',                 // 8
    data.uf || '',                      // 9
    data.descarga || '',                // 10
    data.volume || '',                  // 11
    data.valorEmpresa || '',            // 12
    data.valorMotorista || '',          // 13
    data.km || '',                      // 14
    data.pedagioEixo || '',             // 15
    data.produto || '',                 // 16
    data.icms || '',                    // 17
    data.pedidoSat || '',               // 18
    data.porta || '',                   // 19 ⭐
    data.transito || '',                // 20 ⭐
    data.status || '',                  // 21
    data.obs || ''                      // 22
  ];
  
  Logger.log('Array[18] (porta): ' + rowData[18]);
  Logger.log('Array[19] (transito): ' + rowData[19]);
  
  const existingRow = findRowById(sheet, data.id);
  
  if (existingRow > 0) {
    sheet.getRange(existingRow, 1, 1, rowData.length).setValues([rowData]);
    Logger.log('✅ Atualizado');
    
    return { 
      ok: true, 
      status: 'success', 
      message: 'Frete atualizado', 
      id: data.id 
    };
  } else {
    sheet.appendRow(rowData);
    Logger.log('✅ Criado');
    
    return { 
      ok: true, 
      status: 'success', 
      message: 'Frete criado', 
      id: data.id 
    };
  }
}

function deleteFrete(id) {
  const sheet = getSheet();
  const rowIndex = findRowById(sheet, id);
  
  if (rowIndex > 0) {
    sheet.deleteRow(rowIndex);
    return { ok: true, status: 'success', message: 'Frete excluído' };
  }
  
  return { ok: false, error: 'Frete não encontrado' };
}

function getSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    throw new Error('Aba "' + SHEET_NAME + '" não encontrada');
  }
  
  return sheet;
}

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
 * 🧪 TESTE
 */
function testSaveFrete() {
  Logger.log('🧪 TESTE COM PORTA E TRANSITO PADRONIZADOS');
  
  const testData = {
    regional: 'GOIÁS',
    filial: 'ITUMBIARA',
    cliente: 'TESTE PADRONIZADO',
    origem: 'RIO VERDE-GO',
    coleta: 'FAZ TESTE',
    contato: 'ARIEL',
    destino: 'CABECEIRAS',
    uf: 'GO',
    descarga: 'GRANJA',
    volume: 1000,
    valorEmpresa: 150,
    valorMotorista: 130,
    km: 500,
    pedagioEixo: 30,
    produto: 'SOJA',
    icms: 'ISENTO',
    pedidoSat: 8888,
    porta: 999,       // ⭐ PADRONIZADO
    transito: 888,    // ⭐ PADRONIZADO
    status: 'LIBERADO',
    obs: 'TESTE PADRONIZAÇÃO'
  };
  
  Logger.log('Entrada:');
  Logger.log('  porta: ' + testData.porta);
  Logger.log('  transito: ' + testData.transito);
  Logger.log('');
  
  const result = saveFrete(testData);
  
  Logger.log('');
  Logger.log('Resultado: ' + JSON.stringify(result, null, 2));
  Logger.log('');
  Logger.log('⚠️ VERIFIQUE NA PLANILHA:');
  Logger.log('  - Cliente: TESTE PADRONIZADO');
  Logger.log('  - Coluna 19 (porta): 999');
  Logger.log('  - Coluna 20 (transito): 888');
}
