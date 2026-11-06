# Portal Retrô Games 🎮

Portal estático para organizar consoles, coleção de jogos e manual de códigos, macetes, segredos e comandos.

## Abrir
`index.html` é a Home; as telas `consoles.html`, `jogo.html`, `manual.html`, `colecao.html`, `favoritos.html` e `gerenciar.html` compartilham `assets/style.css` e `assets/app.js`.

## Conteúdo e armazenamento
- A instalação começa com **dados demonstrativos**, não representa os jogos reais do proprietário.
- Use **Gerenciar → Limpar exemplos** para começar do zero.
- O botão **+ Adicionar** permite cadastrar consoles, jogos e macetes.
- Capas podem ser enviadas do computador e são reduzidas para caber no armazenamento.
- Os dados são salvos no **localStorage do navegador, por dispositivo**. GitHub Pages publica o código, não uma base de dados.
- Em **Gerenciar**, use **Exportar backup** e **Importar backup** (JSON) para mover dados entre navegadores ou fazer cópias.
- Para sincronização automática entre diferentes dispositivos e usuários, será necessário conectar um backend (Google Sheets/Apps Script, Firebase ou similar). Não publique tokens privados no frontend.

## Segurança e créditos
Covers demonstrativos são representações abstratas originais, não capas oficiais. Imagens personalizadas devem ser usadas com autorização. Não há emulador nem ROMs.

## Implantação
Publicado em `Netosmith/calculo-piso`, branch `main`, pasta `ACERVO-RETRO/`. Se GitHub Pages publica o diretório raiz, a rota é `https://portalfrete.net.br/ACERVO-RETRO/` (dependente da configuração do Pages).

© Portal Retrô Games.
