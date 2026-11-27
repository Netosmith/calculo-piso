# Monitoramento | Link de ponto único de descarga

Implementado em 27/11/2026 na Central de Monitoramento Nova Frota, separado do rastreamento de viagens.

## Uso

1. Abra pages/monitoramento.html e a seção Localização pontual de descarga.
2. Preencha a identificação da descarga e, se desejar, placa, motorista, cliente, destino, NF, CT-e e observações.
3. Gere o link único e compartilhe pelo WhatsApp ou copie.
4. Quem receber abre o link e toca em Enviar minha localização uma vez. Se o navegador pedir autorização do GPS, deve permitir.
5. A equipe vê o ponto no mapa, dados da descarga, horário, precisão e o botão Google Maps.

Não solicita foto, selfie, cadastro, início de viagem ou rastreamento contínuo. O GPS exato não pode ser obtido sem autorização do navegador. A posição é recebida no momento da confirmação e não necessariamente no instante exato em que o link foi aberto.

## Segurança

- Token aleatório de 256 bits, armazenado como hash SHA-256 no D1.
- Prazo de validade: 48 horas. O primeiro envio consome o link.
- As APIs públicas validam o token e aceitam somente um ponto consentido, sem revelar placa, cliente, NF ou CT-e.
- Listagem e criação exigem autenticação e acesso ao módulo Monitoramento.
- Exclusão remove permanentemente os dados da solicitação e invalida o link.
- Nenhuma posição aproximada por IP é tratada como GPS. O envio depende de um gesto da pessoa.
- A exclusão é manual; não foi implementado expurgo automático de registros antigos.

## Implantação

- Página pública: pages/validacao.html
- Painel e mapa: pages/monitoramento.html
- Backend: worker/src/controllers/monitor-spot.js
- Roteador: worker/src/router.js
- Banco D1: worker/migrations/0030_monitor_spot_link.sql
- Testes: worker/tests/monitor-spot.test.mjs

O workflow deploy-portal-hotfix.yml foi atualizado para executar a migração remota e testar antes do deploy. É necessário confirmar seu sucesso no GitHub Actions/Cloudflare antes de considerar o recurso operacional em produção.

## Verificação funcional

Criar link, abrir em outro celular, autorizar GPS, conferir marcador e Google Maps, tentar reenviar (deve bloquear), negar permissão em novo link (nenhum ponto deve ser gravado), expirar/cancelar link e verificar inacessibilidade.