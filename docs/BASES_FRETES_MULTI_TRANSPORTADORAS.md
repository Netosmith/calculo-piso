# Portal Frete | Bases operacionais por transportadora

**Escopo:** apenas transportadoras novas (GNOVA `teste-01` e futuras). A Nova Frota continua usando as páginas originais, o gateway legado, o BI e a separação GO/MT preexistentes.

## Modos que podem coexistir

1. **Geral / multiestado:** módulo `fretes` em `fretes.html`. Permite cadastrar fretes de qualquer UF em uma só base. O módulo `fretes2` da divisão interna MT continua disponível.
2. **Estadual dedicado:** os 27 módulos `fretes-ac`, `fretes-al`, `fretes-ap`, `fretes-am`, `fretes-ba`, `fretes-ce`, `fretes-df`, `fretes-es`, `fretes-go`, `fretes-ma`, `fretes-mg`, `fretes-ms`, `fretes-mt`, `fretes-pa`, `fretes-pb`, `fretes-pe`, `fretes-pi`, `fretes-pr`, `fretes-rj`, `fretes-rn`, `fretes-ro`, `fretes-rr`, `fretes-rs`, `fretes-sc`, `fretes-se`, `fretes-sp`, `fretes-to`, com entrypoints `pages/<slug>/fretes-UF.html`. Cada um pode receber seu próprio Apps Script e Google Sheets independentes.
3. **Misto:** a transportadora ativa o Geral e qualquer subconjunto dos dez módulos dedicados. O BI atual e o mapa fazem a união das fontes habilitadas. Bases indisponíveis são identificadas como carregamento parcial.

As páginas `fretes-UF.html` usam a interface compartilhada de Fretes ou Fretes MT e não copiam os arquivos enormes de HTML/JS. O carregador aceita apenas as 27 UFs brasileiras conhecidas, exige sessão da mesma transportadora e módulo habilitado. O gateway resolve o Apps Script privado por `transportadoraId + UF da base`, **nunca pela UF da origem nem por parâmetros de URL enviados pelo usuário**.

## Base contábil NÃO é UF de origem

- `base`: qual planilha/módulo administra e contabiliza o frete.
- `ufOrigem`, Cidade-UF ou `UF` cadastrada na regional: onde o frete realmente tem origem.
- Exemplo: frete carregado em MG, regional em MG, administrado em BASE GO. O BI contabiliza na BASE GO e o mapa mostra MG.
- Quando a UF de origem não é determinável, o mapa não atribui automaticamente GO/MT nas novas transportadoras. Informe a UF no campo origem (`CATANDUVA-SP`) e cadastre também a UF da regional.

As regionais de novas transportadoras têm campos independentes **Base** e **Estado (UF)**. A UF da regional fica no R2 privado da própria transportadora, registrada em auditoria, sem exigir alteração do esquema legado de planilhas. O cadastro base/regional/filial continua no Apps Script próprio da transportadora.

## Como ativar uma nova base

1. Criar uma **cópia limpa** da planilha de fretes para a UF e implantar uma cópia do Apps Script gateway apontando para essa planilha. Cada Apps Script deve ter `PORTAL_GATEWAY_KEY` exclusiva e `transportadoraId` correspondente. **A criação de Sheets e a implantação de Apps Scripts não são automáticas neste repositório.**
2. Em **Super Admin > Transportadora > Configurações > Integração**, escolher a Base (qualquer uma das 27 UFs, incluindo DF) em vez de Geral.
3. Informar o ID da planilha, a URL publicada do Apps Script e a chave daquela base. Salvar a integração **desativada**.
4. Testar a conexão. O `gateway_ping` deve confirmar a mesma transportadora e o mesmo ID de planilha. Ao ativar uma base dedicada, o backend repete essa validação antes de permitir a gravação.
5. Em **Cards e módulos**, habilitar apenas as bases desejadas. Entrar com usuário autorizado, testar criação/leitura/edição/exclusão na base, revisar filtro de regional e conferir mapa e BI. Não copiar dados da Nova Frota.

O backend usa R2 privado para `tenant/<tenant-id>/private/base-<uf>-apps-script-v1.json`, independente da integração geral `apps-script-v1.json`. Uma base sem integração ativada retorna erro; **nunca** consulta silenciosamente a planilha geral.

## Consolidação e limites da homologação

- **Home / Fretes por Estado:** agrega fretes disponíveis das bases habilitadas por UF real de origem. A Home das novas transportadoras pode apresentar as quantidades de fretes, veículos em porta e trânsito por base.
- **BI atual e mapa operacional:** oferecem seleção múltipla de bases ou TODAS AS BASES e agregam as fontes autorizadas. Cada registro preserva `origemDados` para contabilização por base.
- **Histórico diário/comercial:** mantém o gateway de BI existente. Para snapshots históricos das bases dedicadas, o Apps Script/rotina de histórico de cada base ainda precisa ser provisionado e validado; não presumir que o histórico da base Geral cobre bases dedicadas.
- **Sem acesso a produção:** commits e testes estáticos do repositório não provam publicação do Worker, GitHub Pages ou conexões reais de Sheets. Homologar com credenciais reais após deploy.

## Cobertura nacional e preparo de novas empresas

As 26 unidades estaduais e o Distrito Federal estão disponíveis no **Super Admin > Cards e módulos**, na lista de bases para configurar as integrações e no gerador de novas transportadoras. A pasta da GNOVA possui as 27 entradas `fretes-UF.html`; além delas, continuam existindo `fretes.html` (Geral/multiestado) e `fretes2.html` (separação interna legada).

A disponibilização da **página** e do **módulo** não cria automaticamente uma planilha, não publica Apps Script nem liga a permissão na transportadora ativa. Cada base permanece inoperante até que a respectiva integração seja configurada e testada. Na Home e no BI, o sistema lê somente bases liberadas; uma fonte não vinculada não pode herdar a fonte Geral como alternativa.

**UFs cobertas:** AC, AL, AP, AM, BA, CE, DF, ES, GO, MA, MG, MS, MT, PA, PB, PE, PI, PR, RJ, RN, RO, RR, RS, SC, SE, SP, TO.
