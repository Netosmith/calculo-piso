# Simulador do Resultado do Frete | Portal Frete 2026

Implementação: 23/11/2026. Botão **Simular Frete** ao lado de **Ordem Offline**
em pages/fretes.html e pages/fretes2.html. As páginas das transportadoras usam
a mesma interface compartilhada e as permissões já existentes de Fretes.

## Referência analisada

O arquivo original 'Simulador calculo Frete.xls' contém as abas CTE, NFS
e Parametros. Exemplo CTE: tarifa empresa R$ 240/t, motorista R$ 230/t,
30 toneladas, bruto empresa R$ 7.200, bruto motorista R$ 6.900 e
diferença ANTES dos impostos R$ 300.

Os parâmetros históricos incluem PIS 1,65%, COFINS 7,6%, INSS 20%,
seguro 0,06% do valor de mercadoria, taxa fixa de CT-e R$ 0,38 e taxa
operacional CIOT 0,4%. Essas tarifas não devem ser utilizadas para
todos os regimes indiscriminadamente.

## Fórmulas do simulador

Receita = frete empresa/t × toneladas.
Custo contratado = frete motorista/t × toneladas.
Pedágio = pedágio/t × toneladas + pedágio fixo.
Seguro = valor mercadoria/t × toneladas × taxa de seguro.
Saldo empresa = receita − custo contratado − impostos da empresa −
INSS patronal aplicável − pedágio − seguro − demais custos.
Motorista líquido = custo contratado − INSS retido − SEST − SENAT −
IRRF estimado. Esses descontos do motorista não se somam uma
segunda vez ao custo empresarial.

Pessoa Física / TAC:
- Base INSS = 20% do frete contratado;
- INSS retido = 11% sobre a base, considerando teto contributivo mensal
  de R$ 8.475,55 (2026) e remunerações anteriores informadas;
- INSS patronal, se aplicável = 20% da base, equivalente a 4% do frete;
- SEST = 1,5% sobre base de 20%, SENAT = 1% sobre base de 20%;
- IRRF indicativo sobre remuneração tributável de 10% do frete de
  cargas, pela tabela progressiva e redução mensal de 2026.

Pessoa Jurídica:
- Sem aplicar automaticamente retenções de INSS, SEST, SENAT ou IRRF
  de pessoa física ao contratado PJ. Seu tributo próprio depende do CNPJ.

Equiparado:
- Pessoa física pode ser equiparada a PJ para fins de imposto de renda
  quando contrata outro motorista ou explora atividade de forma social.
  O painel exige que o usuário confirme o tratamento fiscal como
  PJ ou contribuinte individual; não aplica uma regra automática pelo nome.

Regime da transportadora:
- Lucro Presumido sobre CTE de cargas: PIS 0,65%, COFINS 3%,
  IRPJ de referência 1,20% e CSLL de referência 1,08% da receita.
  O adicional trimestral de IRPJ não está incluído.
- Lucro Real: PIS 1,65%, COFINS 7,6% antes dos créditos. IRPJ e CSLL
  efetivos são ajustáveis e exigem apuração contábil.
- Simples Nacional: alíquota efetiva DAS editável, conforme PGDAS-D/RBT12.
  O ICMS em regra compõe o DAS de transporte interestadual/intermunicipal;
  evitar descontar duas vezes. Um checkbox permite ICMS extra somente
  quando confirmado pelo contador.
- ICMS do CTE e ISS da NFS são editáveis. O valor depende da operação,
  UF, serviço e exceções fiscais. A NFS em lucro presumido exige
  confirmação de base de IRPJ e CSLL própria.
- A transição de CBS/IBS em 2026 não é somada automaticamente,
  dada a legislação de compensações no ano-teste.

Os exemplos iniciais no modal são dados históricos da planilha, não
valores reais ou regime confirmado da Nova Frota.

## Fontes

- eSocial, frete TAC e 10% IRRF / 20% INSS:
  https://www.gov.br/esocial/pt-br/acesso-ao-sistema/cronograma-de-implantacao/perguntas-frequentes-producao-empresas-e-producao-restrita
- Receita Federal, tabela 2026:
  https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026
- INSS 2026:
  https://www.gov.br/inss/pt-br/direitos-e-deveres/inscricao-e-contribuicao/tabela-de-contribuicao-mensal
- IN RFB 2110/2022:
  https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=126687
- PIS e COFINS, cumulativo e não cumulativo:
  https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/perguntas-e-respostas/beneficios-fiscais/perguntas-e-respostas-reducao-dos-incentivos-e-beneficios-tributarios-v5-final.pdf/
- Simples, LC 123/2006:
  https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm
- Equiparação de PF a PJ, Receita Federal:
  https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/declaracoes-e-demonstrativos/ecf/perguntas-e-respostas-pessoa-juridica-2021-arquivos/capitulo-i-declaracoes-da-pessoa-juridica-2021.pdf

## Conciliação da aba NFS (imagem de 23/11/2026)

Com tarifas **R$ 33,00/t empresa**, **R$ 30,00/t motorista** e
**31 toneladas**, ambas as telas calculam receita de R$ 1.023,00,
frete do motorista de R$ 930,00 e diferença bruta de R$ 93,00.

| Rubrica | Planilha NFS AUTÔNOMO | Portal na imagem |
| --- | ---: | ---: |
| Frete da empresa | R$ 1.023,00 | R$ 1.023,00 |
| Frete motorista | R$ 930,00 | R$ 930,00 |
| INSS patronal mostrado | R$ 37,20 | R$ 37,20 |
| ISS | R$ 30,69 | R$ 0,00 |
| PIS | R$ 5,37 | R$ 0,00 |
| COFINS | R$ 24,74 | R$ 0,00 |
| Custos diretos | R$ 4,25 | R$ 0,38 |
| **Saldo** | **-R$ 9,25** | **R$ 55,42** |

A diferença de **R$ 64,67** é explicada integralmente por
ISS (R$ 30,69), PIS+COFINS (R$ 30,11) e despesas (R$ 3,87).
A aba NFS também mostra resultados de R$ 53,33 para REAL/PRESUMIDO
e R$ 31,82 para SIMPLES; esses rótulos não equivalem automaticamente
ao regime fiscal real selecionado no Portal.

Foi incluída a seção **Conferência da planilha NFS**, com botão
**Usar exemplo NFS (33 / 30 / 31 t)** e seleção das três colunas
históricas. Os valores da aba NFS não são carregados como tributos
legais por padrão, mas servem para explicar diferenças matemáticas.

No Simples Nacional, o ISS pode integrar o DAS e a retenção de ISS
na fonte exige segregação adequada da receita no PGDAS-D.
O campo **ISS separado do DAS** só deve ser marcado quando a
contabilidade confirmar a obrigação e que não haverá duplicidade.

Na tela da imagem, o DAS efetivo foi deixado **em 0%**, e o campo
ISS também estava **em 0%**. Para obter um saldo fiscal confiável,
informar o DAS efetivo, a existência de retenção de ISS e os
custos efetivamente suportados. A soma de PIS e COFINS isolados
da planilha não substitui uma alíquota efetiva do PGDAS-D.

Além disso, **transporte municipal** em regra é tributado pelo ISS,
enquanto transporte **intermunicipal/interestadual** requer análise
de CT-e e ICMS. A seleção de NFS pode não representar o transporte
de grãos efetivamente executado.

Fontes:
- Simples Nacional, ISS na retenção:
  https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=92278
- Perguntão do Simples Nacional:
  https://www8.receita.fazenda.gov.br/SimplesNacional/Arquivos/manual/PerguntaoSN.pdf
- Secretaria da Fazenda PR, obrigação de CT-e:
  https://atendimento.fazenda.pr.gov.br/sacsefa/portal/assuntosReferente/47

## Testes e limites

Executar: node --test worker/tests/fretes-simulador-2026.test.mjs

Os cálculos são indicativos por viagem. A apuração fiscal definitiva
exige regime real, competência, créditos tributários, ICMS/ISS correto,
PIS/COFINS próprios, adicional IRPJ se aplicável, histórico do motorista,
pendências de retenções e conferência pela contabilidade.

O simulador é local e não altera dados de fretes já cadastrados.
A publicação do GitHub Pages e a interação com perfis reais ainda
precisam ser validadas depois do deploy.
