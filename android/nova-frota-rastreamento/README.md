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
3. No link da viagem, toque em **Iniciar viagem**, envie a selfie no navegador e aguarde a mensagem de recebimento.
4. No app, cole o link de rastreamento e toque em **Verificar viagem**.
5. Leia o aviso, marque a autorização de localização e toque em **Iniciar viagem / GPS**.
6. Autorize o GPS; mantenha a localização do aparelho ativada.
7. Bloqueie a tela e confira se a notificação de GPS continua presente.
8. No Portal, abra o Monitoramento e verifique a atualização do veículo.
9. Após a descarga, envie o comprovante pelo link do motorista e aguarde a validação humana no portal.
10. Você pode interromper o GPS a qualquer momento no app ou pela notificação, independentemente da aprovação da descarga.

## Limitações do piloto

- O link atual do Portal é válido por **7 dias**, inclusive para o envio de posições. Uma viagem mais longa exige evolução da sessão de rastreamento no backend.
- Não há fila persistente de posições offline; o envio retoma na próxima posição recebida após o retorno da conexão.
- Não há retomada automática após reinicializar o aparelho.
- O Android pode interromper serviços em condições especiais (economia agressiva de bateria, encerramento forçado etc.).
- Abrir o link diretamente no aplicativo depende da configuração de aplicativos padrão; colar o link sempre funciona.

## Segurança e privacidade

O rastreamento só inicia após ação e aceite do motorista. O usuário tem botão visível para interromper, e o Android mantém uma notificação enquanto o serviço está ativo. O app não solicita acesso aos contatos, câmera, arquivos ou mensagens. A selfie é coletada pelo navegador com ação explícita do motorista e enviada a armazenamento privado R2. O token da viagem é enviado somente para `https://api.portalfrete.net.br`; não é gravado em armazenamento persistente.

Antes de distribuir publicamente, implementar política de privacidade, revisão de retenção dos dados, sessões de rastreamento de duração controlada, tratamento de reconexão e testes em diferentes versões do Android.

## Selfie e comprovante

- Nas **novas viagens**, o servidor exige a selfie de abertura antes de aceitar a primeira posição GPS.
- A selfie não é verificada automaticamente: equipe autorizada compara com dados do cadastro e realiza checagens independentes.
- O comprovante de descarga pode ser JPG, PNG, WEBP ou PDF. A Nova Frota aprova ou rejeita no portal.
- O encerramento normal da viagem requer **as duas aprovações**; encerramento excepcional exige ADMINISTRADOR e justificativa registrada.
- O motorista pode interromper voluntariamente seu próprio compartilhamento de localização a qualquer momento. Isso **não encerra** a viagem operacional.
- O aplicativo Android mantém serviço de localização em primeiro plano, com notificação, para funcionar com a tela bloqueada quando permitido pelo sistema. O navegador não garante isso.
- Antes da utilização em produção, a transportadora deve formalizar aviso de privacidade, prazo de retenção, base legal aplicável, medidas de acesso e procedimento de eliminação dos arquivos.
