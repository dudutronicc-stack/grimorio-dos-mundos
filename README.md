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

1. No [Firebase Console](https://console.firebase.google.com/), abra o projeto `grimorio-dos-mundos-dh`.
2. Crie o banco Cloud Firestore. A região é permanente; escolha-a considerando latência, localização e elegibilidade de cota gratuita antes de confirmar.
3. Em Authentication, habilite Google e Email Link. Adicione `dudutronicc-stack.github.io` aos domínios autorizados.
4. Crie um app Web no projeto e copie a configuração pública do Firebase para `.env.local`. Defina `VITE_USE_FIREBASE_EMULATORS=false`.
5. Publique as regras revisadas com `npm run firebase:deploy-rules`.
6. Configure no repositório GitHub os Actions Secrets `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID` e `VITE_FIREBASE_APP_ID`. Configure também `VITE_USE_FIREBASE_EMULATORS=false` para o workflow de produção.

As regras do Firestore restringem a escrita do catálogo ao criador autorizado, isolam rascunhos por conta, protegem sugestões e avaliações e limitam leitores sem login ao volume 1 e às páginas 1–4. As páginas ficam em documentos separados para a regra de prévia poder ser aplicada pelo servidor.

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
