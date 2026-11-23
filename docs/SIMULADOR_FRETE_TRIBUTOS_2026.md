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

## Testes e limites

Executar: node --test worker/tests/fretes-simulador-2026.test.mjs

Os cálculos são indicativos por viagem. A apuração fiscal definitiva
exige regime real, competência, créditos tributários, ICMS/ISS correto,
PIS/COFINS próprios, adicional IRPJ se aplicável, histórico do motorista,
pendências de retenções e conferência pela contabilidade.

O simulador é local e não altera dados de fretes já cadastrados.
A publicação do GitHub Pages e a interação com perfis reais ainda
precisam ser validadas depois do deploy.
