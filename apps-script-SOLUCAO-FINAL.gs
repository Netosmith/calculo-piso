/**
 * Google Apps Script - VERSÃO FINAL CORRIGIDA
 * Normaliza nomes de colunas para evitar problemas
 */

const SHEET_NAME = 'Fretes';

/**
 * Normaliza nomes de colunas (remove espaços, lowercase)
 */
function normalizeHeader(header) {
  return String(header)
    .toLowerCase()
    .replace(/\s+/g, '')  // Remove espaços
    .trim();
}

/**
 * Lê os cabeçalhos da planilha e retorna versão original + normalizada
 */
function getHeaders(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return { original: [], normalized: [] };
  
  const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  
  const original = headerRow;
  const normalized = headerRow.map(h => normalizeHeader(h));
  
  Logger.log('📋 Cabeçalhos da planilha:');
  original.forEach((h, i) => {
    Logger.log(`  Coluna ${i + 1}: "${h}" → normalizado: "${normalized[i]}"`);
  });
  
  return { original, normalized };
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
    
    const { original, normalized } = getHeaders(sheet);
    const numCols = original.length;
    
    Logger.log('📊 Lendo ' + (lastRow - 1) + ' fretes com ' + numCols + ' colunas');
    
    const dataRange = sheet.getRange(2, 1, lastRow - 1, numCols);
    const rows = dataRange.getValues();
    
    const fretes = rows
      .filter(row => row[0])
      .map(row => {
        let obj = {};
        
        // Usa os nomes NORMALIZADOS como chaves
        normalized.forEach((header, index) => {
          const value = row[index];
          obj[header] = value !== undefined && value !== null ? value : "";
        });
        
        // Mapeia para nomes esperados pelo JavaScript (camelCase)
        return {
          id: obj.id || '',
          regional: obj.regional || '',
          filial: obj.filial || '',
          cliente: obj.cliente || '',
          origem: obj.origem || '',
          coleta: obj.coleta || '',
          contato: obj.contato || '',
          destino: obj.destino || '',
          uf: obj.uf || '',
          descarga: obj.descarga || '',
          volume: obj.volume || '',
          valorEmpresa: obj.valorempresa || '',
          valorMotorista: obj.valormotorista || '',
          km: obj.km || '',
          pedagioEixo: obj.pedagioeixo || '',
          produto: obj.produto || '',
          icms: obj.icms || '',
          pedidoSat: obj.pedidosat || '',  // ⭐ Normalizado: "pedido sat" → "pedidosat"
          qtPorta: obj.qtporta || '',       // ⭐ Normalizado: "qtPorta" → "qtporta"
          qtdTransito: obj.qtdtransito || '', // ⭐ Normalizado: "qtdTransito" → "qtdtransito"
          status: obj.status || '',
          obs: obj.obs || ''
        };
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
    const { original, normalized } = getHeaders(sheet);
    
    if (!data.id || data.id === '') {
      data.id = Utilities.getUuid();
      Logger.log('🆕 Criando novo frete com ID: ' + data.id);
    } else {
      Logger.log('✏️ Atualizando frete ID: ' + data.id);
    }
    
    Logger.log('📦 Dados recebidos:');
    Logger.log('  - qtPorta: ' + data.qtPorta + ' (tipo: ' + typeof data.qtPorta + ')');
    Logger.log('  - qtdTransito: ' + data.qtdTransito + ' (tipo: ' + typeof data.qtdTransito + ')');
    
    const existingRowIndex = findRowById(sheet, data.id);
    
    if (existingRowIndex > 0) {
      updateRow(sheet, existingRowIndex, data, normalized);
      Logger.log('✅ Frete atualizado na linha ' + existingRowIndex);
      return { 
        ok: true,
        status: 'success', 
        message: 'Frete atualizado com sucesso', 
        id: data.id 
      };
    } else {
      appendRow(sheet, data, normalized);
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

/**
 * Mapeia dados do JavaScript para a ordem das colunas da planilha
 */
function mapDataToColumns(data, normalizedHeaders) {
  // Mapeamento: chave JavaScript → valor
  const dataMap = {
    id: data.id || '',
    regional: data.regional || '',
    filial: data.filial || '',
    cliente: data.cliente || '',
    origem: data.origem || '',
    coleta: data.coleta || '',
    contato: data.contato || '',
    destino: data.destino || '',
    uf: data.uf || '',
    descarga: data.descarga || '',
    volume: data.volume || '',
    valorempresa: data.valorEmpresa || '',
    valormotorista: data.valorMotorista || '',
    km: data.km || '',
    pedagioeixo: data.pedagioEixo || '',
    produto: data.produto || '',
    icms: data.icms || '',
    pedidosat: data.pedidoSat || '',
    qtporta: data.qtPorta || '',        // ⭐ Mapeia qtPorta
    qtdtransito: data.qtdTransito || '', // ⭐ Mapeia qtdTransito
    status: data.status || '',
    obs: data.obs || ''
  };
  
  // Preenche valores na ordem dos cabeçalhos da planilha
  const values = normalizedHeaders.map((header, index) => {
    const value = dataMap[header];
    
    if (header === 'qtporta' || header === 'qtdtransito') {
      Logger.log(`  Coluna ${index + 1} (${header}): ${value} (tipo: ${typeof value})`);
    }
    
    return value !== undefined ? value : '';
  });
  
  return values;
}

function updateRow(sheet, rowIndex, data, normalizedHeaders) {
  Logger.log('📝 Preparando valores para atualização:');
  const values = mapDataToColumns(data, normalizedHeaders);
  
  Logger.log('🔧 Escrevendo na linha ' + rowIndex);
  sheet.getRange(rowIndex, 1, 1, values.length).setValues([values]);
  Logger.log('✅ Valores escritos com sucesso');
}

function appendRow(sheet, data, normalizedHeaders) {
  Logger.log('📝 Preparando valores para nova linha:');
  const values = mapDataToColumns(data, normalizedHeaders);
  
  Logger.log('🔧 Adicionando nova linha');
  sheet.appendRow(values);
  Logger.log('✅ Linha adicionada com sucesso');
}

/**
 * 🧪 TESTE
 */
function testSaveFrete() {
  const testData = {
    regional: 'GOIÁS',
    filial: 'ITUMBIARA',
    cliente: 'TESTE FINAL',
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
    qtPorta: 999,       // ⭐ TESTE
    qtdTransito: 888,   // ⭐ TESTE
    status: 'LIBERADO',
    obs: 'TESTE NORMALIZAÇÃO'
  };
  
  Logger.log('🧪 INICIANDO TESTE COM NORMALIZAÇÃO');
  Logger.log('Valores: qtPorta=' + testData.qtPorta + ', qtdTransito=' + testData.qtdTransito);
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
