/**
 * 🧪 TESTE DIRETO - Grava pela posição exata
 * Execute esta função no Apps Script
 */

function testGravarDireto() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Fretes');
  
  Logger.log('🧪 TESTE: Gravando DIRETAMENTE pela posição');
  
  const testRow = [
    Utilities.getUuid(),  // 1 - id
    'GOIÁS',              // 2 - regional
    'ITUMBIARA',          // 3 - filial
    'TESTE POSICAO',      // 4 - cliente
    'RIO VERDE',          // 5 - origem
    'FAZ',                // 6 - coleta
    'ARIEL',              // 7 - contato
    'CABECEIRAS',         // 8 - destino
    'GO',                 // 9 - uf
    'GRANJA',             // 10 - descarga
    100,                  // 11 - volume
    100,                  // 12 - valorEmpresa
    90,                   // 13 - valorMotorista
    500,                  // 14 - km
    30,                   // 15 - pedagioEixo
    'SOJA',               // 16 - produto
    'ISENTO',             // 17 - icms
    999,                  // 18 - pedidoSat
    777,                  // 19 - PORTA ⭐
    666,                  // 20 - TRANSITO ⭐
    'LIBERADO',           // 21 - status
    'TESTE DIRETO'        // 22 - obs
  ];
  
  Logger.log('📝 Array com ' + testRow.length + ' valores');
  Logger.log('  Posição 18 (porta): ' + testRow[18]);
  Logger.log('  Posição 19 (transito): ' + testRow[19]);
  
  sheet.appendRow(testRow);
  
  Logger.log('✅ Linha adicionada!');
  Logger.log('');
  Logger.log('⚠️ VEJA NA PLANILHA:');
  Logger.log('  - Cliente: TESTE POSICAO');
  Logger.log('  - Coluna 19: deve ter 777');
  Logger.log('  - Coluna 20: deve ter 666');
}
