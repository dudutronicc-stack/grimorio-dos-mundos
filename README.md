# Grimório dos Mundos

Aplicação web para publicar histórias autorais em quadrinhos, mangás e fantasia.

## Recursos

- Biblioteca pública de histórias e volumes
- Área local do criador
- Cadastro de histórias e personagens
- Gerador de roteiro de dez páginas
- Sugestões dos leitores
- Likes e dislikes
- Downloads com identificação de Eduardo Henrique
- Tema claro e escuro
- Instalação como aplicativo web (PWA) em Android, iOS, Windows e macOS

## Instalar no computador

Abra o site no Chrome ou Edge e selecione **Instalar Grimório dos Mundos** no menu do navegador. No Safari para macOS, use **Arquivo > Adicionar ao Dock**. A instalação usa a mesma interface responsiva do site, sem reduzir a resolução das páginas.

Esta versão é um PWA e não distribui instaladores `.exe`, `.dmg`, `.apk` ou `.ipa`. Esses pacotes nativos exigem etapas próprias de compilação e, para distribuição pública, assinatura/certificados de cada plataforma.

## Responsividade

A interface deve preservar conteúdo e qualidade em telas pequenas, tablets e desktops, tanto no navegador quanto quando instalada como PWA. Validar mudanças em larguras de telefone (~360 px), tablet (~768 px) e desktop (~1280 px), incluindo o feed, leitor de livro, formulários do estúdio e área de instalação.

## Executar localmente

```powershell
npm install
npm run dev
```

## Publicação no GitHub Pages

O workflow em `.github/workflows/deploy.yml` publica automaticamente o conteúdo da pasta `dist` após cada push na branch `master`.
