# Portal Frete App | Android e iOS

Primeiro marco da versão móvel do **Portal Frete**. Projeto em React Native + Expo SDK 57, separado dos arquivos do site e do Worker.

## O que já existe nesta etapa

- Home nativa azul, verde e branco, com atalhos dos módulos.
- Login reaproveitando https://portalfrete.net.br e a autenticação já implementada.
- WebView integrada aos módulos existentes, com cookies compartilhados, HTTPS obrigatório e bloqueio de navegação para domínios não autorizados.
- Navegação nativa, abas, retorno Android e mensagem de falha de conexão.
- Acesso a outra transportadora por código ou convite individual, sem uma lista pública de empresas. O servidor continua aplicando permissões e separação de dados.
- Não altera banco de dados, contas de usuários, GitHub Pages, Cloudflare, Super Admin ou qualquer módulo operacional.

**Estado atual:** base para testes. Ainda não é APK/IPA de produção nem versão aprovada pelas lojas.

## APK Android instalável (v0.1.1)

A primeira compilação `assembleDebug` exigia conexão com o servidor de desenvolvimento Metro e por isso exibia **Unable to load script** quando aberta diretamente no Galaxy S23.

O workflow `.github/workflows/mobile-android-apk.yml` foi corrigido para executar **`:app:assembleRelease`**, embutindo o JavaScript no APK, e conferir a presença de `assets/index.android.bundle` no arquivo. A versão de teste usa **assinatura de desenvolvimento**, que não deve ser utilizada para distribuição nas lojas.

Para obter a versão correta, abra **Actions → Portal Frete - Gerar APK Android instalável → execução bem-sucedida → Artifacts → Portal-Frete-Android-INSTALAVEL-TESTE**. Extraia `app-release.apk` do ZIP.

Para evitar conflitos de assinatura entre as versões de teste, **desinstale a versão 0.1.0 antes** de instalar a versão 0.1.1. O Portal utiliza dados online, portanto desinstalar esse aplicativo de testes não apaga os dados registrados no servidor.

A compilação release não depende de Metro. Ainda é necessário testar login, navegação e uploads em um aparelho físico.

## Versão 0.2.0 | GPS nativo do motorista

Esta etapa acrescenta a tela inicial **SOU MOTORISTA / SOU FUNCIONÁRIO** e um serviço de localização nativo (expo-location + expo-task-manager). O modo funcionário segue utilizando a Home original do Portal.

**Motorista:** cole o link da viagem; abra a selfie e o termo no navegador; após concluir e aceitar, volte ao app, selecione "Conferir viagem" e toque **Ativar rastreamento nativo**. O Android exibe uma notificação persistente durante a transmissão. No iPhone, as permissões de localização em segundo plano são configuradas, mas a validação em aparelho físico ainda é necessária.

**Permissões:** só são solicitadas na ativação explícita da viagem, após confirmar o aceite no Worker. O app pode continuar com a tela bloqueada ou em segundo plano, sujeito às restrições de Android/iOS. Não há garantia se o usuário força a parada, revoga permissão, desliga o celular ou se o sistema encerra o serviço.

**Quando a rede falha:** as posições ficam em uma fila SQLite local cifrada em AES-256, com chave exclusiva no SecureStore. O app reenvia os registros quando possível; a API mantém o horário original da coleta e rejeita duplicatas pelo identificador da posição. O limite de reenvio é de 72 horas e o link da viagem atualmente vence em 7 dias. Viagens mais longas exigirão renovação do acesso.

**Segurança:** o backend valida vínculo, selfie, aceite e status ativo. Não apresenta os fretes internos protegidos ao motorista. O card Fretes do motorista mostra a integração como pendente até criarmos uma API de divulgação pública e independente da operação.

**Testes indispensáveis antes de usar com cargas reais:** instalar APK 0.2 no Galaxy S23, conceder localização precisa e "Permitir o tempo todo", configurar bateria para execução sem restrições, iniciar viagem de teste, bloquear tela, navegar em WhatsApp, desconectar internet e validar horários originais das posições na Central. Repetir em iOS com assinatura e TestFlight, incluindo parada forçada e perda de GPS. Não considerar o monitoramento homologado apenas pelos testes automatizados.

**Disponibilidade:** o APK Android de teste sai pelo workflow do GitHub. A chave local de teste pode exigir desinstalar o APK anterior. No iOS, o bundle é validado, mas falta build assinado.

## Preparação

Requisitos: Node.js 22.13+ e Git. Android: Android Studio ou Expo Go, conforme compatibilidade do SDK. iOS: iPhone com Expo Go para testar a interface; builds de distribuição via EAS Build e assinatura Apple.

No terminal, na pasta raiz do repositório:

~~~bash
cd mobile/portal-frete
npm install
npx expo install --check
npm run check
npx expo start
~~~

Abra no dispositivo usando o Expo Go compatível com SDK 57, ou use emulador.

## Gerar builds para teste

**Estes comandos precisam da sua conta Expo e de assinatura. Ainda não executamos um build neste projeto.**

~~~bash
npm install -g eas-cli
eas login
eas build:configure
# APK de teste Android
eas build --platform android --profile preview
# Build para simulador iOS
eas build --platform ios --profile ios-simulator
~~~

Para instalar no iPhone físico por TestFlight, é necessário Apple Developer Program e configuração de assinatura. Para publicar na Google Play e App Store também são necessários testes, ícones e materiais das lojas, política de privacidade e contas de desenvolvedor.

## Acesso às transportadoras

- **Nova Frota:** deixe o código empresarial vazio, usando /pages/login.html.
- **Outras transportadoras:** informe seu código privado recebido ou abra um convite no formato portalfrete://acesso/SLUG. O app usará /pages/SLUG/login.html.
- O código da empresa não é a senha. O servidor valida login e permissões.
- Os atalhos não liberam novos recursos: só abrem páginas do portal autenticado.
- O aplicativo não mostra uma lista de transportadoras. Cada empresa utiliza seu próprio endereço.

## Próxima etapa: rastreamento nativo do motorista

**Não incluído na primeira versão.** Uma WebView não resolve rastreamento contínuo em segundo plano. A próxima etapa é desenvolver um módulo específico para o motorista:

1. vincular dispositivo e viagem após selfie e aceite do termo;
2. usar serviços de localização nativos, permissões e indicação visível de rastreamento;
3. manter fila criptografada de posições quando perder conexão e sincronizar sem duplicidade no Worker;
4. alertar a Central sobre ausência de sinal, falha ou revogação;
5. encerrar a coleta na finalização e respeitar retenção e transparência;
6. testar tela bloqueada, segundo plano, GPS negado, reinício do app e falta de internet em aparelhos reais.

**Não prometer rastreamento ininterrupto.** iOS/Android podem restringir serviços em segundo plano, o usuário pode revogar a permissão ou desligar o aparelho. Para cargas de risco elevado, mantenha rastreador veicular independente como redundância.

**Publicação:** Google Play impõe regras para localização em segundo plano e a App Store pode rejeitar um app que apenas empacote um website. Antes da submissão, completar funcionalidades nativas próprias (notificações, operações offline e localização consentida).

## Limitações desta primeira versão

O aplicativo inicial requer internet. Uploads, downloads, câmera e retorno de login devem ser testados em aparelhos reais, pois podem exigir integração nativa extra. O pacote ainda precisa ser compilado em ambiente Android/iOS e não contém builds assinados. Identificadores e ícones podem ser ajustados antes de registrar nas lojas.

## Organização

- App.js: home nativa e navegação.
- src/routes.js: endereços autorizados e isolamento por empresa.
- src/theme.js: identidade visual da plataforma.
- tests/routes.test.mjs: testes das rotas.
- app.json: configurações Android/iOS.
- eas.json: perfis de build.

**Nunca colocar senhas, segredos do Worker nem credenciais de assinatura no GitHub.**
