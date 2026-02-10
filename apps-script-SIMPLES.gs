/**
 * Apps Script ULTRA SIMPLIFICADO - Grava pela posição das colunas
 * 
 * ⚠️ IMPORTANTE: As posições devem corresponder EXATAMENTE à sua planilha!
 */

const SHEET_NAME = 'Fretes';

// 🎯 MAPEAMENTO FIXO DAS COLUNAS (ajuste conforme sua planilha)
const COL_MAP = {
  id: 1,
  regional: 2,
  filial: 3,
  cliente: 4,
  origem: 5,
  coleta: 6,
  contato: 7,
  destino: 8,
  uf: 9,
  descarga: 10,
  volume: 11,
  valorEmpresa: 12,
  valorMotorista: 13,
  km: 14,
  pedagioEixo: 15,
  produto: 16,
  icms: 17,
  pedidoSat: 18,
  qtPorta: 19,      // ⭐ COLUNA 19
  qtdTransito: 20,  // ⭐ COLUNA 20
  status: 21,
  obs: 22
};

function doGet(e) {
  const action = e.parameter.action;
  const callback = e.parameter.callback || 'callback';
  
  let result = {};
  
  try {
    // 🔍 LOG COMPLETO
    Logger.log('📨 REQUISIÇÃO:');
    Logger.log('  action: ' + action);
    
    if (action === 'list') {
      result = { ok: true, data: listFretes() };
      
    } else if (action === 'save') {
      Logger.log('  data (raw): ' + e.parameter.data);
      
      const data = JSON.parse(e.parameter.data);
      Logger.log('  data (parsed):');
      Logger.log('    - qtPorta: ' + data.qtPorta + ' (tipo: ' + typeof data.qtPorta + ')');
      Logger.log('    - qtdTransito: ' + data.qtdTransito + ' (tipo: ' + typeof data.qtdTransito + ')');
      
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
  
  // Lê TODAS as colunas
  const data = sheet.getRange(2, 1, lastRow - 1, 22).getValues();
  
  return data.filter(row => row[0]).map(row => ({
    id: row[0],
    regional: row[1],
    filial: row[2],
    cliente: row[3],
    origem: row[4],
    coleta: row[5],
    contato: row[6],
    destino: row[7],
    uf: row[8],
    descarga: row[9],
    volume: row[10],
    valorEmpresa: row[11],
    valorMotorista: row[12],
    km: row[13],
    pedagioEixo: row[14],
    produto: row[15],
    icms: row[16],
    pedidoSat: row[17],
    qtPorta: row[18],      // ⭐ Índice 18 = Coluna 19
    qtdTransito: row[19],  // ⭐ Índice 19 = Coluna 20
    status: row[20],
    obs: row[21]
  }));
}

function saveFrete(data) {
  const sheet = getSheet();
  
  // Gera ID se não existir
  if (!data.id || data.id === '') {
    data.id = Utilities.getUuid();
    Logger.log('🆕 Criando frete com ID: ' + data.id);
  }
  
  Logger.log('📦 Valores recebidos:');
  Logger.log('  - qtPorta: ' + data.qtPorta);
  Logger.log('  - qtdTransito: ' + data.qtdTransito);
  
  // Array com valores na ORDEM DAS COLUNAS
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
    data.qtPorta || '',                 // 19 ⭐
    data.qtdTransito || '',             // 20 ⭐
    data.status || '',                  // 21
    data.obs || ''                      // 22
  ];
  
  Logger.log('📝 Array de valores:');
  Logger.log('  Posição 18 (qtPorta): ' + rowData[18]);
  Logger.log('  Posição 19 (qtdTransito): ' + rowData[19]);
  
  // Busca se já existe
  const existingRow = findRowById(sheet, data.id);
  
  if (existingRow > 0) {
    // Atualiza linha existente
    Logger.log('✏️ Atualizando linha ' + existingRow);
    sheet.getRange(existingRow, 1, 1, rowData.length).setValues([rowData]);
    Logger.log('✅ Linha atualizada');
    
    return { 
      ok: true, 
      status: 'success', 
      message: 'Frete atualizado', 
      id: data.id 
    };
  } else {
    // Adiciona nova linha
    Logger.log('➕ Adicionando nova linha');
    sheet.appendRow(rowData);
    Logger.log('✅ Linha adicionada');
    
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
  Logger.log('🧪 TESTE - Criando frete com qtPorta e qtdTransito');
  
  const testData = {
    regional: 'GOIÁS',
    filial: 'ITUMBIARA',
    cliente: 'TESTE SIMPLES',
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
    qtPorta: 777,       // ⭐ TESTE
    qtdTransito: 666,   // ⭐ TESTE
    status: 'LIBERADO',
    obs: 'TESTE VERSÃO SIMPLES'
  };
  
  Logger.log('Entrada:');
  Logger.log('  qtPorta: ' + testData.qtPorta);
  Logger.log('  qtdTransito: ' + testData.qtdTransito);
  Logger.log('');
  
  const result = saveFrete(testData);
  
  Logger.log('');
  Logger.log('Resultado: ' + JSON.stringify(result, null, 2));
  Logger.log('');
  Logger.log('⚠️ VERIFIQUE NA PLANILHA se apareceu:');
  Logger.log('  - Cliente: TESTE SIMPLES');
  Logger.log('  - qtPorta (coluna 19): 777');
  Logger.log('  - qtdTransito (coluna 20): 666');
}

function testListFretes() {
  const fretes = listFretes();
  Logger.log('Total de fretes: ' + fretes.length);
  
  if (fretes.length > 0) {
    Logger.log('Primeiro frete:');
    Logger.log('  qtPorta: ' + fretes[0].qtPorta);
    Logger.log('  qtdTransito: ' + fretes[0].qtdTransito);
  }
}
