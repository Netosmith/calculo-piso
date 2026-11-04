# Bases operacionais por UF | Portal Frete multi-transportadoras

## Escopo e princípio
Implementação exclusiva para as novas transportadoras, como GNOVA (`teste-01`). A Nova Frota mantém os arquivos e o gateway originais. **Base contábil/operacional** e **UF geográfica da origem do frete** são informações diferentes. Uma regional de MG vinculada à Base GO continua contabilizada na Base GO, mas seu frete aparece em MG no mapa da Home.

## Modos coexistentes
- **Fretes Operacional (unificado):** módulo `fretes` (`fretes.html`), para operar regionais de qualquer estado em uma planilha única.
- **Fretes2:** página e módulo exclusivos da Nova Frota (MT). Não são disponibilizados a novas transportadoras.
- **Bases dedicadas:** as 27 UFs em `fretes-<uf>` (por exemplo `fretes-go`, `fretes-sp`, `fretes-mt`, `fretes-mg`). Cada módulo é liberado separadamente no Super Admin e utiliza a mesma estrutura HTML de `fretes.html`, inclusive a Base MT.

As entradas da GNOVA ficam em `pages/transportadora-teste/fretes-GO.html` até `fretes-TO.html`, incluindo as demais UFs. Elas reutilizam o layout comum e enviam o identificador de base validado pela sessão ao Worker. O gerador `scripts/criar-transportadora-modelo.mjs` cria os mesmos atalhos para as futuras transportadoras.

## Uma planilha e um Apps Script por base dedicada
No **Super Admin > Transportadora > Configurações > Planilha individual**, selecionar uma das 27 bases estaduais. Cada base tem configuração **privada** de URL do Apps Script, ID de planilha e chave, registrada separadamente em R2. A planilha geral permanece independente.

Para habilitar uma base:
1. Preparar uma cópia limpa da planilha-modelo de fretes e seu Apps Script, com as abas e ações esperadas pelo gateway.
2. Configurar no Apps Script da cópia o vínculo com a mesma transportadora, a planilha correta e a chave exclusiva.
3. Selecionar a UF da base no Super Admin. Salvar a integração inicialmente **desativada**, testar o vínculo/identidade e então ativar.
4. Liberar o módulo correspondente em **Cards e módulos**.
5. Testar com login da transportadora: inclusão, leitura, atualização e remoção, além de `Ctrl+F5`.

Não compartilhar IDs, tokens ou chaves em HTML público. Nenhuma base deve utilizar acidentalmente a planilha de outra; sem configuração individual, a operação da base não deve cair silenciosamente na planilha geral.

O diretório de regionais/filiais/contatos das bases dedicadas usa o catálogo central da transportadora quando a integração geral está ativa. Se não houver integração geral, utiliza o diretório da própria planilha da base. Regionais que já tenham base cadastrada no catálogo privado são filtradas pela base escolhida; regionais antigas sem classificação permanecem disponíveis até serem regularizadas.

## Cadastro de regional e UF
Em **Cadastros > Regionais** (transportadoras), escolher:
- **Base:** `GERAL` (Fretes Operacional) ou uma das 27 UFs cujo módulo tenha sido liberado pelo Super Admin.
- **Estado (UF):** estado geográfico da regional, podendo diferir da Base.

A UF é gravada no catálogo privado R2 da transportadora. Os dados originais do cadastro de regionais continuam na planilha da transportadora. Exemplo: `Base = GO`, `UF = MG`, `Regional = TRIÂNGULO MINEIRO`. Resultado: o BI contabiliza em GO, e a Home mostra em MG.

A Home prioriza UF explícita da origem no registro; se não houver, tenta identificá-la na rota ou no catálogo de UF da regional. **Não presume que a UF de origem seja igual à Base.** Frete sem UF confiável não recebe classificação geográfica inventada.

## BI e mapa
O filtro **Base** do BI permite escolher várias bases (Ctrl/Shift) ou **TODAS AS BASES**. A leitura combina as fontes autorizadas, preservando sua origem contábil. A Home exibe cada base somente após **dois requisitos simultâneos**: o módulo deve estar liberado no Super Admin **e** ao menos uma regional deve estar vinculada à base no cadastro privado. Fretes de regionais vinculadas a outra base ou sem vínculo não entram nos indicadores. Em **Fretes ativos**, o total e as contagens por base são consolidados; em **Veículos totais**, aparecem totais de porta/trânsito por base, inclusive as com zero fretes. A distribuição no mapa geográfico usa a UF da origem, independente da base contábil.

A mesma carga deve ser registrada **uma única vez** na sua base contábil responsável. Não se deve copiar a linha para outra planilha para fazê-la aparecer em outro estado: os mapas já agregam todos os registros autorizados.

## Homologação antes da produção
Verificar uma carga de origem MG na Base GO; uma de PR na Geral; uma de SP na Base SP; BI com cada base separada e com todas; cards e indicadores visíveis somente para bases habilitadas e selecionadas nas regionais; rejeição de acesso a base desabilitada; identidade e planilha corretas no teste de integração; permanência após recarga; e ausência de qualquer mudança funcional na Nova Frota.

**Limite:** os HTMLs, Worker, integrações privadas e lógica dos módulos foram preparados no repositório. As planilhas independentes e implantação do Apps Script ainda precisam ser vinculadas e validadas com as contas e credenciais reais de cada transportadora. O registro de código não equivale a uma homologação em produção.

**Compatibilidade:** o modelo compartilhado de novas empresas não oferece `fretes2.html`. O código original `/pages/fretes2.html` continua destinado apenas à Nova Frota; não alterá-lo por causa das bases MT de outras transportadoras.
