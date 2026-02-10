/**
 * 🧪 TESTE DIRETO - Cole no Apps Script e execute
 */

const SHEET_NAME = 'Fretes';

function TESTE_GRAVAR_QTPORTA() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  
  Logger.log('🧪 TESTE: Gravando diretamente na planilha');
  
  // Dados de teste
  const testData = [
    Utilities.getUuid(),  // 1 - id
    'GOIÁS',              // 2 - regional
    'ITUMBIARA',          // 3 - filial
    'TESTE DIRETO',       // 4 - cliente
    'RIO VERDE',          // 5 - origem
    'FAZ TESTE',          // 6 - coleta
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
    888,                  // 19 - qtPorta ⭐
    777,                  // 20 - qtdTransito ⭐
    'LIBERADO',           // 21 - status
    'TESTE DIRETO'        // 22 - obs
  ];
  
  Logger.log('Valores que serão gravados:');
  Logger.log('  Posição 18 (qtPorta): ' + testData[18]);
  Logger.log('  Posição 19 (qtdTransito): ' + testData[19]);
  
  sheet.appendRow(testData);
  
  Logger.log('✅ Linha adicionada!');
  Logger.log('Verifique na planilha:');
  Logger.log('  - Cliente: TESTE DIRETO');
  Logger.log('  - Coluna 19 (qtPorta): 888');
  Logger.log('  - Coluna 20 (qtdTransito): 777');
}
