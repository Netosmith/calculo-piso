/**
 * 🔍 SCRIPT DE DIAGNÓSTICO
 * Execute este script para descobrir a estrutura exata da sua planilha
 */

function diagnosticarPlanilha() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Fretes');
    
    if (!sheet) {
      Logger.log('❌ Aba "Fretes" não encontrada!');
      return;
    }
    
    // Ler primeira linha (cabeçalhos)
    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    
    Logger.log('📊 ESTRUTURA DA PLANILHA:');
    Logger.log('Total de colunas: ' + lastCol);
    Logger.log('');
    
    // Listar cada coluna com seu índice
    headers.forEach((header, index) => {
      Logger.log(`Coluna ${index + 1} (índice ${index}): "${header}"`);
    });
    
    Logger.log('');
    Logger.log('🔍 PROCURANDO qtPorta:');
    const qtPortaIndex = headers.indexOf('qtPorta');
    const qtdPortaIndex = headers.indexOf('qtdPorta');
    
    if (qtPortaIndex >= 0) {
      Logger.log(`✅ "qtPorta" encontrado na coluna ${qtPortaIndex + 1} (índice ${qtPortaIndex})`);
    }
    if (qtdPortaIndex >= 0) {
      Logger.log(`✅ "qtdPorta" encontrado na coluna ${qtdPortaIndex + 1} (índice ${qtdPortaIndex})`);
    }
    if (qtPortaIndex < 0 && qtdPortaIndex < 0) {
      Logger.log('❌ Nenhuma variação de qtPorta encontrada!');
    }
    
    Logger.log('');
    Logger.log('🔍 PROCURANDO qtdTransito:');
    const qtdTransitoIndex = headers.indexOf('qtdTransito');
    const qtTransitoIndex = headers.indexOf('qtTransito');
    
    if (qtdTransitoIndex >= 0) {
      Logger.log(`✅ "qtdTransito" encontrado na coluna ${qtdTransitoIndex + 1} (índice ${qtdTransitoIndex})`);
    }
    if (qtTransitoIndex >= 0) {
      Logger.log(`✅ "qtTransito" encontrado na coluna ${qtTransitoIndex + 1} (índice ${qtTransitoIndex})`);
    }
    
    // Ler primeira linha de dados (se existir)
    if (sheet.getLastRow() > 1) {
      Logger.log('');
      Logger.log('📄 PRIMEIRA LINHA DE DADOS:');
      const firstDataRow = sheet.getRange(2, 1, 1, lastCol).getValues()[0];
      headers.forEach((header, index) => {
        const value = firstDataRow[index];
        if (value !== '' && value !== null && value !== undefined) {
          Logger.log(`  ${header}: ${value}`);
        }
      });
    }
    
    return {
      totalColunas: lastCol,
      headers: headers,
      qtPortaIndex: qtPortaIndex >= 0 ? qtPortaIndex : qtdPortaIndex,
      qtdTransitoIndex: qtdTransitoIndex >= 0 ? qtdTransitoIndex : qtTransitoIndex
    };
    
  } catch (error) {
    Logger.log('❌ ERRO: ' + error.toString());
  }
}

/**
 * 🔧 Criar cabeçalhos corretos (SE NECESSÁRIO)
 * CUIDADO: Isso vai REESCREVER a primeira linha!
 */
function criarCabecalhosCorretos() {
  const confirmar = Browser.msgBox(
    'ATENÇÃO',
    'Isso vai REESCREVER a primeira linha da planilha! Continuar?',
    Browser.Buttons.YES_NO
  );
  
  if (confirmar !== 'yes') {
    Logger.log('❌ Operação cancelada pelo usuário');
    return;
  }
  
  const HEADERS_CORRETOS = [
    'id', 'regional', 'filial', 'cliente', 'origem', 'coleta', 'contato',
    'destino', 'uf', 'descarga', 'volume', 'valorEmpresa', 'valorMotorista',
    'km', 'pedagioEixo', 'produto', 'icms', 'pedidoSat', 'qtPorta',
    'qtdTransito', 'status', 'obs'
  ];
  
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Fretes');
    
    // Escrever cabeçalhos
    sheet.getRange(1, 1, 1, HEADERS_CORRETOS.length).setValues([HEADERS_CORRETOS]);
    
    // Formatar cabeçalho
    const headerRange = sheet.getRange(1, 1, 1, HEADERS_CORRETOS.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#4285f4');
    headerRange.setFontColor('#ffffff');
    
    Logger.log('✅ Cabeçalhos criados com sucesso!');
    Logger.log('Total de colunas: ' + HEADERS_CORRETOS.length);
    
  } catch (error) {
    Logger.log('❌ ERRO ao criar cabeçalhos: ' + error.toString());
  }
}
