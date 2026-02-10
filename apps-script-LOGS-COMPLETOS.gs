/**
 * Apps Script FINAL - COM LOGS DETALHADOS
 */

const SHEET_NAME = 'Fretes';

function doGet(e) {
  const action = e.parameter.action;
  const callback = e.parameter.callback || 'callback';
  
  let result = {};
  
  try {
    // 🔍 LOG COMPLETO DO QUE CHEGOU
    Logger.log('📨 ===== REQUISIÇÃO RECEBIDA =====');
    Logger.log('action: ' + action);
    Logger.log('callback: ' + callback);
    
    if (action === 'list') {
      result = { ok: true, data: listFretes() };
      
    } else if (action === 'save') {
      Logger.log('');
      Logger.log('📦 DATA RECEBIDO (raw):');
      Logger.log(e.parameter.data);
      
      const data = JSON.parse(e.parameter.data);
      
      Logger.log('');
      Logger.log('📦 DATA APÓS PARSE:');
      Logger.log(JSON.stringify(data, null, 2));
      
      Logger.log('');
      Logger.log('🔍 CAMPOS IMPORTANTES:');
      Logger.log('  - data.qtPorta: ' + data.qtPorta + ' (tipo: ' + typeof data.qtPorta + ')');
      Logger.log('  - data.qtdTransito: ' + data.qtdTransito + ' (tipo: ' + typeof data.qtdTransito + ')');
      Logger.log('  - data.pedidoSat: ' + data.pedidoSat + ' (tipo: ' + typeof data.pedidoSat + ')');
      
      Logger.log('');
      Logger.log('🔑 TODAS AS CHAVES DO OBJETO:');
      Logger.log(Object.keys(data).join(', '));
      
      result = saveFrete(data);
      
    } else if (action === 'delete') {
      result = deleteFrete(e.parameter.id);
      
    } else {
      result = { ok: false, error: 'Ação inválida' };
    }
    
  } catch (error) {
    Logger.log('❌ ERRO: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
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
    qtPorta: row[18] || '',      // ⭐ Coluna 19
    qtdTransito: row[19] || '',  // ⭐ Coluna 20
    status: row[20] || '',
    obs: row[21] || ''
  }));
}

function saveFrete(data) {
  const sheet = getSheet();
  
  if (!data.id || data.id === '') {
    data.id = Utilities.getUuid();
    Logger.log('🆕 ID gerado: ' + data.id);
  }
  
  Logger.log('');
  Logger.log('📝 PREPARANDO ARRAY DE VALORES:');
  
  // Extrai cada valor individualmente com log
  const id = data.id || '';
  const regional = data.regional || '';
  const filial = data.filial || '';
  const cliente = data.cliente || '';
  const origem = data.origem || '';
  const coleta = data.coleta || '';
  const contato = data.contato || '';
  const destino = data.destino || '';
  const uf = data.uf || '';
  const descarga = data.descarga || '';
  const volume = data.volume || '';
  const valorEmpresa = data.valorEmpresa || '';
  const valorMotorista = data.valorMotorista || '';
  const km = data.km || '';
  const pedagioEixo = data.pedagioEixo || '';
  const produto = data.produto || '';
  const icms = data.icms || '';
  const pedidoSat = data.pedidoSat || '';
  
  // ⭐ CAMPOS PROBLEMÁTICOS
  const qtPorta = data.qtPorta;
  const qtdTransito = data.qtdTransito;
  
  Logger.log('Posição 18 (qtPorta):');
  Logger.log('  - Valor de data.qtPorta: ' + data.qtPorta);
  Logger.log('  - Tipo: ' + typeof data.qtPorta);
  Logger.log('  - É undefined? ' + (data.qtPorta === undefined));
  Logger.log('  - É null? ' + (data.qtPorta === null));
  Logger.log('  - É string vazia? ' + (data.qtPorta === ''));
  Logger.log('  - Valor final que será gravado: ' + qtPorta);
  
  Logger.log('Posição 19 (qtdTransito):');
  Logger.log('  - Valor de data.qtdTransito: ' + data.qtdTransito);
  Logger.log('  - Tipo: ' + typeof data.qtdTransito);
  Logger.log('  - Valor final que será gravado: ' + qtdTransito);
  
  const status = data.status || '';
  const obs = data.obs || '';
  
  // Array na ordem das colunas
  const rowData = [
    id,              // 1
    regional,        // 2
    filial,          // 3
    cliente,         // 4
    origem,          // 5
    coleta,          // 6
    contato,         // 7
    destino,         // 8
    uf,              // 9
    descarga,        // 10
    volume,          // 11
    valorEmpresa,    // 12
    valorMotorista,  // 13
    km,              // 14
    pedagioEixo,     // 15
    produto,         // 16
    icms,            // 17
    pedidoSat,       // 18
    qtPorta,         // 19 ⭐
    qtdTransito,     // 20 ⭐
    status,          // 21
    obs              // 22
  ];
  
  Logger.log('');
  Logger.log('📋 ARRAY FINAL (rowData):');
  Logger.log('  rowData[18] (qtPorta): ' + rowData[18]);
  Logger.log('  rowData[19] (qtdTransito): ' + rowData[19]);
  
  const existingRow = findRowById(sheet, data.id);
  
  if (existingRow > 0) {
    Logger.log('✏️ Atualizando linha ' + existingRow);
    sheet.getRange(existingRow, 1, 1, rowData.length).setValues([rowData]);
    Logger.log('✅ Atualizado');
    
    return { 
      ok: true, 
      status: 'success', 
      message: 'Frete atualizado', 
      id: data.id 
    };
  } else {
    Logger.log('➕ Adicionando nova linha');
    sheet.appendRow(rowData);
    Logger.log('✅ Adicionado');
    
    return { 
      ok: true, 
      status: 'success', 
      message: 'Frete criado com sucesso', 
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
