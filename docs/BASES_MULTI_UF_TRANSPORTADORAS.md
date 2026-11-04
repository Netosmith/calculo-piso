# Bases operacionais por UF | Portal Frete multi-transportadoras

## Escopo e princípio
Implementação exclusiva para as novas transportadoras, como GNOVA (`teste-01`). A Nova Frota mantém os arquivos e o gateway originais. **Base contábil/operacional** e **UF geográfica da origem do frete** são informações diferentes. Uma regional de MG vinculada à Base GO continua contabilizada na Base GO, mas seu frete aparece em MG no mapa da Home.

## Modos coexistentes
- **Geral/planilha única:** módulo existente `fretes` (`fretes.html`), com regionais e fretes de qualquer estado.
- **Interno legado:** módulos `fretes` / `fretes2`, mantidos por compatibilidade com o modelo original GO/MT.
- **Bases dedicadas:** `fretes-go`, `fretes-mt`, `fretes-sp`, `fretes-ms`, `fretes-ba`, `fretes-pr`, `fretes-sc`, `fretes-ro`, `fretes-to`, `fretes-ma`. Só aparecem quando liberados no Super Admin.

As entradas da GNOVA ficam em `pages/transportadora-teste/fretes-GO.html` ... `fretes-MA.html`. Elas reutilizam o layout comum e enviam o identificador de base validado pela sessão ao Worker. O gerador `scripts/criar-transportadora-modelo.mjs` cria os mesmos atalhos para as futuras transportadoras.

## Uma planilha e um Apps Script por base dedicada
No **Super Admin > Transportadora > Configurações > Planilha individual**, selecionar a base (GO/MT/SP/MS/BA/PR/SC/RO/TO/MA). Cada base tem configuração **privada** de URL do Apps Script, ID de planilha e chave, registrada separadamente em R2. A planilha geral permanece independente.

Para habilitar uma base:
1. Preparar uma cópia limpa da planilha-modelo de fretes e seu Apps Script, com as abas e ações esperadas pelo gateway.
2. Configurar no Apps Script da cópia o vínculo com a mesma transportadora, a planilha correta e a chave exclusiva.
3. Selecionar a UF da base no Super Admin. Salvar a integração inicialmente **desativada**, testar o vínculo/identidade e então ativar.
4. Liberar o módulo correspondente em **Cards e módulos**.
5. Testar com login da transportadora: inclusão, leitura, atualização e remoção, além de `Ctrl+F5`.

Não compartilhar IDs, tokens ou chaves em HTML público. Nenhuma base deve utilizar acidentalmente a planilha de outra; sem configuração individual, a operação da base não deve cair silenciosamente na planilha geral.

## Cadastro de regional e UF
Em **Cadastros > Regionais** (transportadoras), escolher:
- **Base:** `GERAL` ou uma das bases dedicadas GO/MT/SP/MS/BA/PR/SC/RO/TO/MA.
- **Estado (UF):** estado geográfico da regional, podendo diferir da Base.

A UF é gravada no catálogo privado R2 da transportadora. Os dados originais do cadastro de regionais continuam na planilha da transportadora. Exemplo: `Base = GO`, `UF = MG`, `Regional = TRIÂNGULO MINEIRO`. Resultado: o BI contabiliza em GO, e a Home mostra em MG.

A Home prioriza UF explícita da origem no registro; se não houver, tenta identificá-la na rota ou no catálogo de UF da regional. **Não presume que a UF de origem seja igual à Base.** Frete sem UF confiável não recebe classificação geográfica inventada.

## BI e mapa
O filtro **Base** do BI permite escolher várias bases (Ctrl/Shift) ou **TODAS AS BASES**. A leitura combina as fontes autorizadas, preservando sua origem contábil. A Home consulta as bases habilitadas e distribui os fretes pelo estado da origem.

A mesma carga deve ser registrada **uma única vez** na sua base contábil responsável. Não se deve copiar a linha para outra planilha para fazê-la aparecer em outro estado: os mapas já agregam todos os registros autorizados.

## Homologação antes da produção
Verificar uma carga de origem MG na Base GO; uma de PR na Geral; uma de SP na Base SP; BI com cada base separada e com todas; cards visíveis somente para módulos habilitados; rejeição de acesso a base desabilitada; identidade e planilha corretas no teste de integração; permanência após recarga; e ausência de qualquer mudança funcional na Nova Frota.

**Limite:** os HTMLs, Worker, integrações privadas e lógica dos módulos foram preparados no repositório. As planilhas independentes e implantação do Apps Script ainda precisam ser vinculadas e validadas com as contas e credenciais reais de cada transportadora. O registro de código não equivale a uma homologação em produção.
