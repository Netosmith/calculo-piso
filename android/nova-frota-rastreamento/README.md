# Nova Frota Rastreamento — piloto Android

Aplicativo nativo Android (Java, sem bibliotecas externas de localização) conectado ao **Monitoramento Nova Frota** do Portal Frete.

## O que faz

- Recebe o link da viagem por intenção Android ou por colagem manual.
- Valida o token com `POST /v1/monitor/driver`.
- Solicita aceite explícito e permissões de localização.
- Inicia serviço GPS em primeiro plano, com notificação permanente e botão de encerramento.
- Envia coordenadas para `POST /v1/monitor/position`, aproximadamente a cada 30 segundos quando há novas posições.
- Continua funcionando com a tela bloqueada e quando o motorista sai da interface, sujeito às políticas de bateria e encerramento de serviços do Android.
- Para automaticamente se o servidor informar link expirado/inválido ou viagem encerrada.

## APK de teste

No GitHub, abra **Actions → Build Nova Frota Rastreamento APK**. Após a execução ficar verde, baixe o artefato `NovaFrota-Rastreamento-Android-APK`. Dentro do ZIP está `app-debug.apk`, assinado com chave de desenvolvimento. Não use esse APK como versão de produção na Play Store.

## Como testar

1. Crie uma viagem em **Monitoramento Nova Frota**, no Portal.
2. Instale o APK no Android de teste (a instalação fora da loja pode exigir autorização manual).
3. Cole o link de rastreamento no aplicativo e toque em **Verificar viagem**.
4. Leia o aviso, marque o consentimento e toque em **Iniciar rastreamento**.
5. Autorize o GPS; mantenha a localização do aparelho ativada.
6. Bloqueie a tela e confira se a notificação de GPS continua presente.
7. No Portal, abra o Monitoramento e verifique a atualização do veículo.
8. Toque em **Encerrar rastreamento** ou use a ação da notificação para parar.

## Limitações do piloto

- O link atual do Portal é válido por **24 horas**, inclusive para o envio de posições. Uma viagem mais longa exige evolução da sessão de rastreamento no backend.
- Não há fila persistente de posições offline; o envio retoma na próxima posição recebida após o retorno da conexão.
- Não há retomada automática após reinicializar o aparelho.
- O Android pode interromper serviços em condições especiais (economia agressiva de bateria, encerramento forçado etc.).
- Abrir o link diretamente no aplicativo depende da configuração de aplicativos padrão; colar o link sempre funciona.

## Segurança e privacidade

O rastreamento só inicia após ação e aceite do motorista. O usuário tem botão visível para interromper, e o Android mantém uma notificação enquanto o serviço está ativo. O app não solicita acesso aos contatos, câmera, arquivos ou mensagens. O token da viagem é enviado somente para `https://api.portalfrete.net.br`; não é gravado em armazenamento persistente.

Antes de distribuir publicamente, implementar política de privacidade, revisão de retenção dos dados, sessões de rastreamento de duração controlada, tratamento de reconexão e testes em diferentes versões do Android.
