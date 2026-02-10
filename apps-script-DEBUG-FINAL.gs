/**
 * Google Apps Script - DEBUG VERSION
 * Execute testSaveFrete para ver os logs
 */

const SHEET_NAME = 'Fretes';

function getHeaders(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return [];
  
  const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  Logger.log('📋 Cabeçalhos da planilha:');
  headerRow.forEach((h, i) => {
    Logger.log(`  Coluna ${i + 1}: "${h}"`);
  });
  return headerRow;
}

function doGet(e) {
  const action = e.parameter.action;
  const callback = e.parameter.callback || 'callback';
  
  let result = {};
  
  try {
    if (action === 'list') {
      const fretes = listFretes();
      result = { ok: true, data: fretes };
      
    } else if (action === 'save') {
      const data = JSON.parse(e.parameter.data);
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
    Logger.log('❌ ERRO: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
    
    result = { 
      ok: false,
      error: error.toString(),
      stack: error.stack 
    };
  }
  
  const jsonp = callback + '(' + JSON.stringify(result) + ')';
  
  return ContentService
    .createTextOutput(jsonp)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function listFretes() {
  try {
    const sheet = getSheet();
    const lastRow = sheet.getLastRow();
    
    if (lastRow <= 1) {
      Logger.log('📋 Nenhum frete encontrado');
      return [];
    }
    
    const headers = getHeaders(sheet);
    const numCols = headers.length;
    
    Logger.log('📊 Lendo ' + (lastRow - 1) + ' fretes com ' + numCols + ' colunas');
    
    const dataRange = sheet.getRange(2, 1, lastRow - 1, numCols);
    const rows = dataRange.getValues();
    
    const fretes = rows
      .filter(row => row[0])
      .map(row => {
        let obj = {};
        headers.forEach((header, index) => {
          const value = row[index];
          obj[header] = value !== undefined && value !== null ? value : "";
        });
        return obj;
      });
    
    Logger.log('✅ Retornando ' + fretes.length + ' fretes');
    
    if (fretes.length > 0) {
      const primeiro = fretes[0];
      Logger.log('🔍 Primeiro frete:');
      Logger.log('  - qtPorta: ' + primeiro.qtPorta);
      Logger.log('  - qtdTransito: ' + primeiro.qtdTransito);
    }
    
    return fretes;
    
  } catch (error) {
    Logger.log('❌ Erro em listFretes: ' + error.toString());
    throw new Error('Erro ao listar fretes: ' + error.toString());
  }
}

function saveFrete(data) {
  try {
    const sheet = getSheet();
    const headers = getHeaders(sheet);
    
    if (!data.id || data.id === '') {
      data.id = Utilities.getUuid();
      Logger.log('🆕 Criando novo frete com ID: ' + data.id);
    } else {
      Logger.log('✏️ Atualizando frete ID: ' + data.id);
    }
    
    Logger.log('📦 Dados recebidos:');
    Logger.log('  - qtPorta: ' + data.qtPorta + ' (tipo: ' + typeof data.qtPorta + ')');
    Logger.log('  - qtdTransito: ' + data.qtdTransito + ' (tipo: ' + typeof data.qtdTransito + ')');
    
    // 🔍 VERIFICAR SE OS CABEÇALHOS TÊM qtPorta
    const qtPortaIndex = headers.indexOf('qtPorta');
    const qtdTransitoIndex = headers.indexOf('qtdTransito');
    
    Logger.log('🔍 Índices dos cabeçalhos:');
    Logger.log('  - qtPorta está na coluna: ' + (qtPortaIndex + 1) + ' (índice ' + qtPortaIndex + ')');
    Logger.log('  - qtdTransito está na coluna: ' + (qtdTransitoIndex + 1) + ' (índice ' + qtdTransitoIndex + ')');
    
    if (qtPortaIndex === -1) {
      Logger.log('⚠️ ATENÇÃO: "qtPorta" NÃO FOI ENCONTRADO nos cabeçalhos!');
      Logger.log('Cabeçalhos disponíveis: ' + headers.join(', '));
    }
    
    const existingRowIndex = findRowById(sheet, data.id);
    
    if (existingRowIndex > 0) {
      updateRow(sheet, existingRowIndex, data, headers);
      Logger.log('✅ Frete atualizado na linha ' + existingRowIndex);
      return { 
        ok: true,
        status: 'success', 
        message: 'Frete atualizado com sucesso', 
        id: data.id 
      };
    } else {
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

function getSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    throw new Error('Aba "' + SHEET_NAME + '" não encontrada!');
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

function updateRow(sheet, rowIndex, data, headers) {
  Logger.log('📝 Preparando valores para atualização:');
  
  const values = headers.map((header, index) => {
    let value = data[header];
    
    if (value === null || value === undefined || value === '') {
      value = '';
    }
    
    if (header === 'qtPorta' || header === 'qtdTransito') {
      Logger.log(`  Coluna ${index + 1} (${header}): ${value} (tipo: ${typeof value})`);
    }
    
    return value;
  });
  
  Logger.log('🔧 Escrevendo na linha ' + rowIndex);
  sheet.getRange(rowIndex, 1, 1, values.length).setValues([values]);
  Logger.log('✅ Valores escritos com sucesso');
}

function appendRow(sheet, data, headers) {
  Logger.log('📝 Preparando valores para nova linha:');
  
  const values = headers.map((header, index) => {
    let value = data[header];
    
    if (value === null || value === undefined || value === '') {
      value = '';
    }
    
    if (header === 'qtPorta' || header === 'qtdTransito') {
      Logger.log(`  Coluna ${index + 1} (${header}): ${value} (tipo: ${typeof value})`);
    }
    
    return value;
  });
  
  Logger.log('🔧 Adicionando nova linha');
  sheet.appendRow(values);
  Logger.log('✅ Linha adicionada com sucesso');
}

/**
 * 🧪 TESTE - Execute esta função
 */
function testSaveFrete() {
  const testData = {
    regional: 'GOIÁS',
    filial: 'ITUMBIARA',
    cliente: 'TESTE DEBUG',
    origem: 'RIO VERDE-GO',
    coleta: 'FAZ TESTE',
    contato: 'ARIEL 64 99227-7537',
    destino: 'CABECEIRAS',
    uf: 'GO',
    descarga: 'GRANJA TESTE',
    volume: 1500,
    valorEmpresa: 200,
    valorMotorista: 180,
    km: 600,
    pedagioEixo: 30,
    produto: 'SOJA',
    icms: 'ISENTO (CIF)',
    pedidoSat: 9999,
    qtPorta: 777,  // ⭐ VALOR DE TESTE
    qtdTransito: 888,  // ⭐ VALOR DE TESTE
    status: 'LIBERADO',
    obs: 'TESTE DEBUG QTPORTA'
  };
  
  Logger.log('🧪 INICIANDO TESTE');
  Logger.log('Valores de entrada:');
  Logger.log('  qtPorta: ' + testData.qtPorta);
  Logger.log('  qtdTransito: ' + testData.qtdTransito);
  Logger.log('');
  
  const result = saveFrete(testData);
  
  Logger.log('');
  Logger.log('📋 RESULTADO:');
  Logger.log(JSON.stringify(result, null, 2));
}

function testListFretes() {
  const result = listFretes();
  Logger.log('📊 Total: ' + result.length);
}
