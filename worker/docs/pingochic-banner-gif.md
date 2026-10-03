# Pingo Chic — banners com GIF

O backend da Pingo Chic aceita banners com imagem fixa (JPG, PNG ou WEBP) e GIF animado.

- Imagens fixas: até 4 MB e otimizadas no navegador antes do upload.
- GIFs: até 8 MB e enviados sem conversão para preservar a animação.
- Arquivos são armazenados no R2 usando o endpoint administrativo `/v1/pingo/admin/images`.
- A loja pública utiliza o mesmo campo `image` do banner, mantendo compatibilidade com banners existentes.
