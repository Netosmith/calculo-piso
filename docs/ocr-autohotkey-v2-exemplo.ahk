#Requires AutoHotkey v2.0
#SingleInstance Force

; Exemplo seguro: lê a exportação OCR local e mostra os campos.
; NÃO digita nem salva nada no sistema. A automação será vinculada
; futuramente aos controles reais do software de cadastro.
arquivo := FileSelect(1, , "Escolha o arquivo exportado pelo Portal Frete", "Exportação OCR (*.txt)")
if (arquivo = "")
    ExitApp

try {
    campos := LerExportacaoOCR(arquivo)
    if (campos.Get("FORMATO", "") != "PORTAL_FRETE_OCR_V1")
        throw Error("Formato inválido para o leitor do Portal Frete.")

    tipo := campos.Get("TIPO_DOCUMENTO", "")
    nl := Chr(10)
    if (tipo = "veiculo") {
        resumo := "Documento do veículo" . nl
            . "Placa: " . campos.Get("PLACA", "") . nl
            . "RENAVAM: " . campos.Get("RENAVAM", "") . nl
            . "Chassi: " . campos.Get("CHASSI", "") . nl
            . "Espécie/tipo CRLV: " . campos.Get("ESPECIE_TIPO_CRLV", "") . nl
            . "Tipo no sistema: " . campos.Get("TIPO_VEICULO_SISTEMA", "")
    } else if (tipo = "cnh") {
        resumo := "Documento do motorista" . nl
            . "Nome: " . campos.Get("NOME_COMPLETO", "") . nl
            . "CPF: " . campos.Get("CPF", "") . nl
            . "CNH: " . campos.Get("REGISTRO_CNH", "") . nl
            . "Categoria: " . campos.Get("CATEGORIA_CNH", "") . nl
            . "Validade: " . campos.Get("VALIDADE_CNH", "")
    } else if (tipo = "endereco") {
        resumo := "Comprovante de endereço" . nl
            . "Titular: " . campos.Get("TITULAR", "") . nl
            . "Logradouro: " . campos.Get("LOGRADOURO", "") . nl
            . "Número: " . campos.Get("NUMERO", "") . nl
            . "Cidade: " . campos.Get("CIDADE", "") . nl
            . "UF: " . campos.Get("UF", "")
    } else {
        resumo := "Tipo de documento não mapeado: " . tipo
    }
    MsgBox(resumo . nl . nl . "Confira os dados antes de qualquer preenchimento.", "Prévia OCR | AutoHotkey v2")
} catch as err {
    MsgBox("Não foi possível ler a exportação." . Chr(10) . err.Message, "Portal Frete OCR", "Iconx")
}

LerExportacaoOCR(caminho) {
    texto := FileRead(caminho, "UTF-8")
    dados := Map()
    for linha in StrSplit(texto, Chr(10), Chr(13)) {
        linha := Trim(linha, " " . Chr(9) . Chr(13) . Chr(10))
        if (linha = "" || SubStr(linha, 1, 1) = "#" || SubStr(linha, 1, 1) = Chr(0xFEFF))
            continue
        pos := InStr(linha, "=")
        if (pos < 2)
            continue
        chave := Trim(SubStr(linha, 1, pos - 1))
        valor := SubStr(linha, pos + 1)
        dados[chave] := valor
    }
    return dados
}
