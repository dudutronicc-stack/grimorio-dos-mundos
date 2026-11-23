# Grimório dos Mundos

Site responsivo e PWA para publicar histórias, mangás e quadrinhos. O front-end usa React + Vite; autenticação e dados compartilhados usam Firebase Authentication e Cloud Firestore.

## Stack e requisitos

- Node.js 22 LTS e npm
- React 19 e Vite 8
- Firebase Web SDK: Email Link/Google Authentication e Cloud Firestore
- Firebase CLI 15.37 (executada via `npx`)
- Java 21+ para os emuladores locais

## Baixar e preparar localmente

```powershell
git clone https://github.com/dudutronicc-stack/grimorio-dos-mundos.git
cd grimorio-dos-mundos
npm install
Copy-Item .env.example .env.local
```

O repositório de trabalho também fica em `C:\projetos\musica-ae-qa\grimorio-dos-mundos`.

### Banco local sem tocar no banco remoto

O `.env.local` de exemplo aponta para o projeto de demonstração `demo-grimorio-mundos` e usa apenas os emuladores:

```powershell
npm run firebase:emulators
```

Os emuladores de Authentication, Firestore e a interface de dados iniciam em `localhost:9099`, `localhost:8080` e `localhost:4000`. O estado local é exportado para `.firebase-data` ao encerrar; esse diretório não é enviado ao Git.

Em outro terminal:

```powershell
npm run dev
```

Use os links de autenticação exibidos no Emulator UI. A configuração de demonstração nunca grava dados no serviço remoto.

### Conectar ao Firebase remoto gratuito

O Firebase/Firestore é um serviço gerenciado: o site e o banco continuam funcionando sem deixar seu computador ligado. O plano Spark oferece cotas gratuitas diárias para o Firestore; ao atingir os limites, as operações podem parar até a próxima cota, e recursos pagos não devem ser ativados sem revisar preços.

1. O projeto `grimorio-dos-mundos-dh` já tem um banco Cloud Firestore Standard em `southamerica-east1` (São Paulo), com proteção contra exclusão habilitada. A região é permanente.
2. Authentication está configurado com login Google e link por e-mail. O domínio `dudutronicc-stack.github.io` está autorizado.
3. O app Web Firebase já está registrado. Para desenvolvimento remoto local, coloque a configuração pública desse app em `.env.local` e defina `VITE_USE_FIREBASE_EMULATORS=false`. Para desenvolvimento isolado, mantenha os valores de demonstração e emuladores.
4. As regras do Firestore já foram compiladas e publicadas. Para alterações futuras, use `npm run firebase:deploy-rules`.
5. Os Actions Secrets `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID` e `VITE_FIREBASE_APP_ID` já estão configurados no repositório. O workflow define `VITE_USE_FIREBASE_EMULATORS=false` para produção. Para habilitar o Gemini, configure também `VITE_FIREBASE_APPCHECK_SITE_KEY` como secret e ative App Check/Firebase AI Logic no console.

As regras do Firestore restringem a publicação do catálogo ao criador autorizado, isolam rascunhos e favoritos por conta, protegem sugestões e avaliações e limitam leitores sem login às cinco primeiras páginas do primeiro capítulo do primeiro volume de cada uma das cinco obras em destaque. O conteúdo é organizado como saga/título → volumes (livro, mangá ou temporada de vídeos) → capítulos/episódios; páginas e mídias ficam em documentos separados para aplicar a regra de prévia no servidor.

Usuários autenticados têm contextos separados de Leitor e Autor: o Acervo filtra por obra, autor e data de lançamento; Favoritos guarda obras e autores; atualizações de autores favoritos aparecem no Feed. O leitor permite alternar entre a visualização de livro aberto e o modo de leitura estilo Kindle. Minha biblioteca lista as histórias publicadas por saga, volume e capítulo; Perfil permite escolher o nome de autor e gerenciar rascunhos privados da própria conta. A publicação continua restrita ao criador autorizado.

No Estúdio, o autor pode definir a identidade visual de cada saga e carregar uma imagem de fundo comprimida (até 700 KB, gravada no Firestore; não usa Firebase Storage). A IA usa Gemini 4 Hydrogen via Firebase AI Logic para análise editorial e conceitos textuais, aceita TXT, Markdown, DOCX e PDF até 20 MB e exige consentimento antes de enviar o conteúdo ao Google. Arquivos não são armazenados pelo site e o recurso depende de App Check e das cotas disponíveis; geração de imagens não está habilitada.

O fluxo de publicação oferece publicação imediata, fila privada sem data, agendamento, revisão por IA ou pedido de revisão a outro usuário. A fila “Para publicar” é exclusiva do autor. A central de notificações encaminha pedidos ao usuário que tem o e-mail informado; ambos precisam entrar no site com esse e-mail. Conforme a opção escolhida, as notificações são somente no site e não enviam e-mail externo.

### Ranking semanal de prévias

O workflow `Weekly guest ranking` recalcula os cinco títulos mais curtidos toda segunda-feira às 06:15 UTC e pode ser iniciado manualmente pelo GitHub Actions. Ele conta os documentos de reação no Firestore, atualiza os contadores e marca os cinco títulos que podem ser lidos sem login.

Para habilitá-lo, configure as variáveis de repositório `GCP_WORKLOAD_IDENTITY_PROVIDER` (nome completo do provider de Workload Identity Federation) e `GCP_SERVICE_ACCOUNT` (e-mail da conta de serviço). A conta precisa do papel `Cloud Datastore User` no projeto; restrinja o provider ao repositório `dudutronicc-stack/grimorio-dos-mundos` e ao branch `master`. O workflow usa OIDC para credenciais temporárias e não requer chave JSON de conta de serviço. Enquanto essas variáveis não forem configuradas, o job informa no resumo do workflow que o ranking ainda está desabilitado. O cálculo consome cotas de leitura e gravação do Firestore.

O workflow `Publish scheduled chapters` usa as mesmas variáveis OIDC para publicar volumes e capítulos agendados a cada 15 minutos. O GitHub pode atrasar execuções agendadas; itens sem data permanecem privados na fila até o autor publicá-los manualmente. Para configurar qualquer automação, habilite a Workload Identity Federation e aplique o papel de acesso do Firestore à conta de serviço, sem criar nem armazenar uma chave JSON.

## Desenvolvimento

```powershell
npm run dev
npm run lint
npm run build
npm run preview
```

Os rascunhos são gravados no Firestore quando a configuração de produção está ativa; sem Firebase configurado, o app usa armazenamento local do navegador.

## Publicação

O GitHub Actions compila o site e publica `dist` no GitHub Pages a cada push em `master`. As regras do Firestore são publicadas separadamente pelo comando `firebase:deploy-rules`.

## Instalação e responsividade

O PWA pode ser instalado no Chrome/Edge (Windows e macOS), no Safari para macOS (Arquivo > Adicionar ao Dock) e em navegadores móveis compatíveis. Não há instaladores nativos `.exe`, `.dmg`, `.apk` ou `.ipa` neste projeto.

Manter a qualidade responsiva em telefone (~360 px), tablet (~768 px) e desktop (~1280 px); validar biblioteca/feed, leitor, formulários do estúdio e área de instalação.
