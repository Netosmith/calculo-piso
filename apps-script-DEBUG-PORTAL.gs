/**
 * 🔍 DEBUG - Ver o que está chegando do site
 * Cole no Apps Script e deixe rodando
 */

function doGet(e) {
  const action = e.parameter.action;
  const callback = e.parameter.callback || 'callback';
  
  let result = {};
  
  try {
    if (action === 'list') {
      result = { ok: true, data: listFretes() };
      
    } else if (action === 'save') {
      const rawData = e.parameter.data;
      
      // 🔍 LOG DETALHADO
      Logger.log('========================================');
      Logger.log('📨 REQUISIÇÃO SAVE RECEBIDA');
      Logger.log('========================================');
      Logger.log('');
      Logger.log('📦 DATA (raw string):');
      Logger.log(rawData);
      Logger.log('');
      
      const data = JSON.parse(rawData);
      
      Logger.log('📦 DATA (parsed object):');
      Logger.log(JSON.stringify(data, null, 2));
      Logger.log('');
      
      Logger.log('🔍 VERIFICAÇÃO DOS CAMPOS:');
      Logger.log('  data.porta: "' + data.porta + '" (tipo: ' + typeof data.porta + ')');
      Logger.log('  data.transito: "' + data.transito + '" (tipo: ' + typeof data.transito + ')');
      Logger.log('');
      
      Logger.log('🔑 TODAS AS CHAVES DO OBJETO:');
      const keys = Object.keys(data);
      Logger.log(keys.join(', '));
      Logger.log('');
      
      Logger.log('🔍 PROCURANDO "porta" nas chaves:');
      keys.forEach(k => {
        if (k.toLowerCase().includes('porta') || k.toLowerCase().includes('port')) {
          Logger.log('  ENCONTRADO: "' + k + '" = ' + data[k]);
        }
      });
      Logger.log('');
      
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
    porta: row[18] || '',
    transito: row[19] || '',
    status: row[20] || '',
    obs: row[21] || ''
  }));
}

function saveFrete(data) {
  const sheet = getSheet();
  
  if (!data.id || data.id === '') {
    data.id = Utilities.getUuid();
  }
  
  Logger.log('📝 SALVANDO FRETE:');
  Logger.log('  ID: ' + data.id);
  Logger.log('  Cliente: ' + data.cliente);
  Logger.log('  porta: "' + data.porta + '"');
  Logger.log('  transito: "' + data.transito + '"');
  Logger.log('');
  
  const rowData = [
    data.id || '',
    data.regional || '',
    data.filial || '',
    data.cliente || '',
    data.origem || '',
    data.coleta || '',
    data.contato || '',
    data.destino || '',
    data.uf || '',
    data.descarga || '',
    data.volume || '',
    data.valorEmpresa || '',
    data.valorMotorista || '',
    data.km || '',
    data.pedagioEixo || '',
    data.produto || '',
    data.icms || '',
    data.pedidoSat || '',
    data.porta || '',
    data.transito || '',
    data.status || '',
    data.obs || ''
  ];
  
  Logger.log('📋 ARRAY QUE SERÁ GRAVADO:');
  Logger.log('  rowData[18] (porta): "' + rowData[18] + '"');
  Logger.log('  rowData[19] (transito): "' + rowData[19] + '"');
  Logger.log('');
  
  const existingRow = findRowById(sheet, data.id);
  
  if (existingRow > 0) {
    sheet.getRange(existingRow, 1, 1, rowData.length).setValues([rowData]);
    Logger.log('✅ Frete ATUALIZADO na linha ' + existingRow);
    
    return { 
      ok: true, 
      status: 'success', 
      message: 'Frete atualizado', 
      id: data.id 
    };
  } else {
    sheet.appendRow(rowData);
    Logger.log('✅ Frete CRIADO');
    
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
  let sheet = spreadsheet.getSheetByName('Fretes');
  
  if (!sheet) {
    throw new Error('Aba "Fretes" não encontrada');
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
