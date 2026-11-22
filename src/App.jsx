import { useEffect, useMemo, useState } from 'react'
import { firebaseAuth, firestoreDb, googleProvider } from './firebase'
import { onAuthStateChanged, signInWithPopup, signOut, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth'
import {
  createSuggestion,
  fetchCharacters,
  fetchDrafts,
  fetchStories,
  fetchSuggestions,
  fetchUserRole,
  fetchVolumePages,
  persistCharacter,
  persistDraft,
  persistReaction,
  persistStory,
  persistVolume,
  removeDraft,
} from './firestoreData'
import './App.css'

const seedStories = [
  {
    id: 1,
    title: 'Crônicas da Nova Aurora',
    kind: 'Fantasia',
    status: 'Em publicação',
    synopsis: 'Um grupo de jovens refugiados descobre que a noite mais fria do reino guarda uma porta para o mundo dos bruxos.',
    cover: '',
    volumes: [
      { id: 11, number: 1, title: 'Será um bruxo?', chapters: 10, downloads: 48, likes: 86, dislikes: 3 },
    ],
  },
]

function readData(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}

function App() {
  const [area, setArea] = useState('reader')
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')
  const [stories, setStories] = useState(() => firestoreDb ? [] : readData('stories', seedStories))
  const [drafts, setDrafts] = useState(() => firestoreDb ? [] : readData('author-drafts', []))
  const [characters, setCharacters] = useState(() => firestoreDb ? [] : readData('characters', [
    { id: 1, name: 'Henry', role: 'Protagonista', note: 'Cabelos escuros bagunçados, expressão cansada.' },
    { id: 2, name: 'Jacx', role: 'Co-protagonista', note: 'Cachos escuros, vestido cinza simples.' },
  ]))
  const [suggestions, setSuggestions] = useState(() => readData('suggestions', []))
  const [reactions, setReactions] = useState(() => readData('reactions', {}))
  const [authModal, setAuthModal] = useState(false)
  const [authEmail, setAuthEmail] = useState('')
  const [authUser, setAuthUser] = useState(null)
  const [accountRole, setAccountRole] = useState('reader')
  const [authBusy, setAuthBusy] = useState(false)
  const [viewMode, setViewMode] = useState('site')
  const [selectedVolume, setSelectedVolume] = useState(null)
  const [studioText, setStudioText] = useState('')
  const [comicPrompt, setComicPrompt] = useState('')
  const [installPrompt, setInstallPrompt] = useState(null)
  const [installHelp, setInstallHelp] = useState('')
  const [draftId, setDraftId] = useState(null)
  const [writingStoryId, setWritingStoryId] = useState('')
  const [writingTitle, setWritingTitle] = useState('')
  const [writingText, setWritingText] = useState('')
  const [selectedPage, setSelectedPage] = useState(0)
  const [notice, setNotice] = useState('')
  const ownerUnlocked = authUser?.email === 'dudutronicc@gmail.com' || accountRole === 'creator'
  const readerPageCount = selectedVolume?.pages?.length || selectedVolume?.chapters || 1

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    if (!firestoreDb) localStorage.setItem('stories', JSON.stringify(stories))
  }, [stories])

  useEffect(() => {
    if (!firestoreDb) localStorage.setItem('author-drafts', JSON.stringify(drafts))
  }, [drafts])

  useEffect(() => {
    if (!firestoreDb) localStorage.setItem('characters', JSON.stringify(characters))
  }, [characters])

  useEffect(() => {
    if (!firestoreDb) localStorage.setItem('suggestions', JSON.stringify(suggestions))
  }, [suggestions])

  useEffect(() => {
    if (!firestoreDb) localStorage.setItem('reactions', JSON.stringify(reactions))
  }, [reactions])

  useEffect(() => {
    const visits = Number(localStorage.getItem('visits') || 0) + 1
    localStorage.setItem('visits', String(visits))
  }, [])

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
        setNotice('Não foi possível preparar a instalação offline neste navegador.')
      })
    }

    function handleInstallPrompt(event) {
      event.preventDefault()
      setInstallPrompt(event)
    }

    window.addEventListener('beforeinstallprompt', handleInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', handleInstallPrompt)
  }, [])

  useEffect(() => {
    if (!firebaseAuth) return
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => setAuthUser(user))
    return unsubscribe
  }, [])

  useEffect(() => {
    if (!firestoreDb || !authUser) {
      setAccountRole('reader')
      return
    }
    let active = true
    fetchUserRole(authUser.uid)
      .then((role) => {
        if (active) setAccountRole(role)
      })
      .catch(() => {
        if (active) setNotice('Não foi possível verificar o perfil da conta.')
      })
    return () => { active = false }
  }, [authUser])

  useEffect(() => {
    if (!firestoreDb) return
    let active = true
    const isCreator = ownerUnlocked
    fetchStories(isCreator, authUser?.uid)
      .then((items) => {
        if (!active) return
        setStories(items)
        setReactions(Object.fromEntries(items.flatMap((story) => story.volumes
          .filter((volume) => volume.userReaction)
          .map((volume) => [volume.id, volume.userReaction]))))
      })
      .catch(() => {
        if (active) setNotice('Não foi possível carregar as histórias do Firestore. Verifique a configuração e as regras.')
      })

    if (isCreator) {
      Promise.all([fetchDrafts(authUser.uid), fetchSuggestions(), fetchCharacters()])
        .then(([savedDrafts, savedSuggestions, savedCharacters]) => {
          if (!active) return
          setDrafts(savedDrafts)
          setSuggestions(savedSuggestions)
          setCharacters(savedCharacters)
        })
        .catch(() => {
          if (active) setNotice('Não foi possível carregar os dados privados do estúdio.')
        })
    }

    return () => { active = false }
  }, [authUser, ownerUnlocked])

  useEffect(() => {
    if (!firebaseAuth || !isSignInWithEmailLink(firebaseAuth, window.location.href)) return
    const email = window.localStorage.getItem('emailForSignIn')
    if (!email) {
      setAuthEmail('')
      setAuthModal(true)
      return
    }
    signInWithEmailLink(firebaseAuth, email, window.location.href)
      .then(() => {
        window.localStorage.removeItem('emailForSignIn')
        window.history.replaceState({}, document.title, window.location.pathname)
        setNotice('Login confirmado.')
      })
      .catch(() => setNotice('O link de login expirou ou não é válido.'))
  }, [])

  const metrics = useMemo(() => {
    const visits = Number(localStorage.getItem('visits') || 0)
    const likes = Object.values(reactions).filter((item) => item === 'like').length
    const dislikes = Object.values(reactions).filter((item) => item === 'dislike').length
    const downloads = stories.reduce((total, story) => total + story.volumes.reduce((sum, volume) => sum + volume.downloads, 0), 0)
    return { visits, likes, dislikes, downloads, suggestions: suggestions.length }
  }, [reactions, stories, suggestions])

  async function addStory(event) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const cover = data.get('cover')?.trim()
    const story = {
      id: String(Date.now()),
      title: data.get('title'),
      kind: data.get('kind'),
      status: data.get('status'),
      synopsis: data.get('synopsis'),
      cover,
      volumes: [],
    }
    if (firestoreDb) {
      try {
        await persistStory(story)
      } catch {
        setNotice('A história não foi salva no Firestore. Verifique sua conta e as regras de acesso.')
        return
      }
    }
    setStories((items) => [story, ...items])
    form.reset()
    setNotice('História criada.')
  }

  async function saveDraft(event) {
    event.preventDefault()
    const title = writingTitle.trim()
    const text = writingText.trim()
    if (!title || !text) {
      setNotice('Preencha o título e o texto para salvar o rascunho.')
      return
    }

    const draft = {
      id: draftId || Date.now(),
      storyId: writingStoryId,
      title,
      text,
      updatedAt: new Date().toISOString(),
    }
    if (firestoreDb) {
      if (!firebaseAuth?.currentUser) {
        setNotice('Entre na conta de criador antes de salvar um rascunho na nuvem.')
        return
      }
      try {
        await persistDraft(firebaseAuth.currentUser.uid, draft)
      } catch {
        setNotice('Não foi possível salvar o rascunho no Firestore.')
        return
      }
    }
    setDrafts((items) => [draft, ...items.filter((item) => item.id !== draft.id)])
    setDraftId(draft.id)
    setNotice(firestoreDb ? 'Rascunho salvo na nuvem.' : 'Rascunho salvo neste navegador.')
  }

  function resumeDraft(draft) {
    setDraftId(draft.id)
    setWritingStoryId(draft.storyId || '')
    setWritingTitle(draft.title)
    setWritingText(draft.text)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setNotice(`Rascunho "${draft.title}" aberto para continuar.`)
  }

  async function publishWriting(event) {
    event.preventDefault()
    const title = writingTitle.trim()
    const text = writingText.trim()
    if (!title || !text) {
      setNotice('Adicione um título e escreva o conteúdo antes de publicar.')
      return
    }
    const story = stories.find((item) => String(item.id) === String(writingStoryId))
    if (!story) {
      setNotice('Selecione uma história para publicar este volume.')
      return
    }

    const pages = text.split(/\n\s*\n/).map((page) => page.trim()).filter(Boolean)
    const volumeNumber = Math.max(0, ...story.volumes.map((volume) => Number(volume.number) || 0)) + 1
    const volume = {
      id: String(Date.now()),
      number: volumeNumber,
      title,
      chapters: 1,
      pages: pages.length ? pages : [text],
      downloads: 0,
      likes: 0,
      dislikes: 0,
      publishedAt: new Date().toISOString(),
    }
    if (firestoreDb) {
      try {
        await persistVolume(story.id, volume)
        if (draftId && firebaseAuth?.currentUser) {
          await removeDraft(firebaseAuth.currentUser.uid, draftId)
        }
      } catch {
        setNotice('O volume não foi publicado no Firestore. Confira conexão e regras.')
        return
      }
    }
    setStories((items) => items.map((item) => (
      item.id === story.id ? { ...item, volumes: [...item.volumes, volume] } : item
    )))
    setDrafts((items) => items.filter((item) => item.id !== draftId))
    setDraftId(null)
    setWritingTitle('')
    setWritingText('')
    setWritingStoryId('')
    setNotice(`Volume ${volumeNumber} publicado em "${story.title}".`)
  }

  async function deleteDraft(id) {
    if (firestoreDb && firebaseAuth?.currentUser) {
      try {
        await removeDraft(firebaseAuth.currentUser.uid, id)
      } catch {
        setNotice('Não foi possível excluir o rascunho salvo na nuvem.')
        return
      }
    }
    setDrafts((items) => items.filter((item) => item.id !== id))
    if (draftId === id) {
      setDraftId(null)
      setWritingTitle('')
      setWritingText('')
      setWritingStoryId('')
    }
    setNotice('Rascunho excluído.')
  }

  async function addCharacterSafe(event) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const character = { id: String(Date.now()), name: data.get('name'), role: data.get('role'), note: data.get('note') }
    if (firestoreDb) {
      try {
        await persistCharacter(character)
      } catch {
        setNotice('Não foi possível salvar o personagem no Firestore.')
        return
      }
    }
    setCharacters((items) => [...items, character])
    form.reset()
  }

  function generatePages(event) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const title = data.get('title')?.trim()
    const text = data.get('text')?.trim()
    if (!title || !text) return
    const parts = text.split(/[.!?]+/).filter(Boolean).map((part) => part.trim()).slice(0, 10)
    const pages = parts.map((part, index) => `Página ${index + 1}: ${part}.`)
    const result = [
      `TÍTULO: ${title}`,
      'FORMATO: Mangá, 10 páginas, preto e branco',
      'BIBLE VISUAL: manter cabelos, roupas, idades e cenários descritos; não alterar características não explícitas.',
      '',
      ...pages,
    ].join('\n')
    const blob = new Blob([result], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${slugify(title)}-roteiro.txt`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function slugify(value) {
    return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  }

  async function reactTo(storyId, volumeId, reaction) {
    if (firestoreDb && !firebaseAuth?.currentUser) {
      setAuthModal(true)
      setNotice('Entre para avaliar este volume.')
      return
    }
    const nextReaction = reactions[volumeId] === reaction ? null : reaction
    if (firestoreDb && firebaseAuth?.currentUser) {
      try {
        await persistReaction(storyId, volumeId, firebaseAuth.currentUser.uid, nextReaction)
      } catch {
        setNotice('Não foi possível salvar sua avaliação.')
        return
      }
    }
    setReactions((items) => ({ ...items, [volumeId]: nextReaction }))
  }

  async function openVolume(storyId, volume) {
    if (!authUser && volume.number > 1) {
      setAuthModal(true)
      setNotice('Entre para ler os volumes seguintes.')
      return
    }
    setSelectedPage(0)
    if (!firestoreDb) {
      setSelectedVolume(volume)
      return
    }
    try {
      const pages = await fetchVolumePages(storyId, volume.id, Boolean(authUser))
      setSelectedVolume({ ...volume, pages })
    } catch {
      setNotice('Não foi possível abrir as páginas deste volume no Firestore.')
    }
  }

  async function addSuggestion(event) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const name = data.get('name') || authUser?.displayName || 'Leitor'
    const message = data.get('message')
    if (firestoreDb && !firebaseAuth?.currentUser) {
      setAuthModal(true)
      setNotice('Entre para enviar uma sugestão.')
      return
    }
    let id = String(Date.now())
    if (firestoreDb && firebaseAuth?.currentUser) {
      try {
        id = await createSuggestion(firebaseAuth.currentUser.uid, name, message)
      } catch {
        setNotice('Não foi possível enviar a sugestão.')
        return
      }
    }
    setSuggestions((items) => [{ id, name, message }, ...items])
    form.reset()
    setNotice('Sugestão enviada.')
  }

  function downloadVolume(volume) {
    if (!authUser) {
      setAuthModal(true)
      setNotice('Entre para baixar os volumes.')
      return
    }
    const content = [
      'GRIMÓRIO DOS MUNDOS',
      `Volume ${volume.number}: ${volume.title}`,
      '',
      'Criado por Eduardo Henrique',
      'Marca d’água: Eduardo Henrique - Todos os direitos reservados',
      '',
      'Esta é uma demonstração visual. A obra completa pode ser publicada nesta área.',
    ].join('\n')
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `eduardo-henrique-volume-${volume.number}-${slugify(volume.title)}.txt`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function openAuth() {
    setAuthModal(true)
  }

  async function signInWithGoogle() {
    if (!firebaseAuth || !googleProvider) {
      setNotice('Configure o Firebase antes de usar o login Google.')
      return
    }
    setAuthBusy(true)
    try {
      await signInWithPopup(firebaseAuth, googleProvider)
      setAuthModal(false)
      setNotice('Login realizado.')
    } catch {
      setNotice('Não foi possível concluir o login Google.')
    } finally {
      setAuthBusy(false)
    }
  }

  async function sendEmailLink(event) {
    event.preventDefault()
    if (!firebaseAuth || !authEmail) {
      setNotice('Informe um e-mail válido.')
      return
    }
    setAuthBusy(true)
    try {
      await sendSignInLinkToEmail(firebaseAuth, authEmail, {
        url: window.location.href,
        handleCodeInApp: true,
      })
      window.localStorage.setItem('emailForSignIn', authEmail)
      setNotice('Token enviado por e-mail.')
      setAuthModal(false)
    } catch {
      setNotice('Não foi possível enviar o token por e-mail.')
    } finally {
      setAuthBusy(false)
    }
  }

  async function installApp() {
    if (installPrompt) {
      try {
        await installPrompt.prompt()
        await installPrompt.userChoice
        setInstallPrompt(null)
      } catch {
        setNotice('A instalação não pôde ser iniciada. Use o menu do navegador para adicionar o app à tela inicial.')
      }
      return
    }

    const userAgent = navigator.userAgent
    const isAppleMobile = /iPhone|iPad|iPod/.test(userAgent)
    const isMac = /Macintosh|Mac OS X/.test(userAgent)
    if (isAppleMobile) {
      setInstallHelp('No Safari, toque em Compartilhar e escolha “Adicionar à Tela de Início”.')
    } else if (isMac && /Safari/.test(userAgent) && !/Chrome|Chromium|Edg/.test(userAgent)) {
      setInstallHelp('No Safari para macOS, abra o menu Arquivo e escolha “Adicionar ao Dock”.')
    } else {
      setInstallHelp('No Chrome ou Edge, abra o menu do navegador e escolha “Instalar Grimório dos Mundos”. No Windows e macOS, o app abre em uma janela própria.')
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setArea('reader')} type="button">
          <span className="brand-mark">G</span>
          <span>
            <strong>Grimório dos Mundos</strong>
            <small>Histórias além da página</small>
          </span>
        </button>
        <nav aria-label="Navegação principal">
          <button className={area === 'reader' ? 'active' : ''} onClick={() => setArea('reader')}>Biblioteca</button>
          {ownerUnlocked && <button className={area === 'owner' ? 'active' : ''} onClick={() => setArea('owner')}>Estúdio do autor</button>}
        </nav>
        <div className="top-actions">
          <button className="theme-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} type="button" aria-label="Alternar tema">
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          {authUser ? (
            <button className="login-button" onClick={() => firebaseAuth && signOut(firebaseAuth)}>Sair</button>
          ) : (
            <button className="login-button" onClick={openAuth}>Entrar</button>
          )}
        </div>
      </header>

      {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Fechar">×</button></div>}

      {area === 'reader' ? (
        <main className="reader-layout">
          <section className="hero-banner">
            <p className="eyebrow">ACESSO LIVRE • NOVOS REINOS</p>
            <h1>Abra o livro.<br/><em>Encontre outro mundo.</em></h1>
            <p>Histórias em quadrinhos, mangás, fantasias e séries autorais criadas por Eduardo Henrique.</p>
          </section>

          <section>
            <div className="section-heading">
              <div><p className="eyebrow">COLEÇÃO</p><h2>Histórias disponíveis</h2></div>
              <div className="view-switch" aria-label="Modo de visualização">
                <button className={viewMode === 'site' ? 'active' : ''} onClick={() => setViewMode('site')}>Site</button>
                <button className={viewMode === 'feed' ? 'active' : ''} onClick={() => setViewMode('feed')}>Feed</button>
              </div>
            </div>
            <div className={viewMode === 'feed' ? 'feed-grid' : 'story-grid'}>
              {stories.map((story) => (
                <article className="story-card" key={story.id}>
                  <div
                    className="cover"
                    role="button"
                    tabIndex={0}
                    onClick={() => story.volumes[0] && openVolume(story.id, story.volumes[0])}
                    onKeyDown={(event) => event.key === 'Enter' && story.volumes[0] && openVolume(story.id, story.volumes[0])}
                    style={story.cover ? { backgroundImage: `linear-gradient(145deg, transparent, #09070d), url(${story.cover})` } : undefined}
                  >
                    <span>{story.kind}</span>
                    <strong>{story.title}</strong>
                  </div>
                  <div className="card-body">
                    <div className="status"><i/> {story.status}</div>
                    <p>{story.synopsis}</p>
                    <div className="volume-list">
                      {story.volumes.map((volume) => (
                        <div className="volume" key={volume.id}>
                          <div>
                            <span>Volume {volume.number}</span>
                            <strong>{volume.title}</strong>
                            <small>{volume.chapters} capítulos</small>
                          </div>
                          <div className="actions">
                            <button onClick={() => openVolume(story.id, volume)}>Ler</button>
                            <button className={reactions[volume.id] === 'like' ? 'selected' : ''} onClick={() => reactTo(story.id, volume.id, 'like')}>▲ {volume.likes}</button>
                            <button className={reactions[volume.id] === 'dislike' ? 'selected' : ''} onClick={() => reactTo(story.id, volume.id, 'dislike')}>▼ {volume.dislikes}</button>
                            <button onClick={() => downloadVolume(volume)}>⇩ Download</button>
                          </div>
                        </div>
                      ))}
                      {story.volumes.length === 0 && <p className="empty">Nenhum volume publicado ainda.</p>}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="suggestion-section">
            <div>
              <p className="eyebrow">COMUNIDADE</p>
              <h2>Envie sua sugestão</h2>
              <p>Ideias, personagens, mundos e feedback sobre as histórias.</p>
            </div>
            <form onSubmit={addSuggestion}>
              <input name="name" placeholder="Seu nome" />
              <textarea name="message" placeholder="Escreva sua sugestão..." required />
              <button type="submit">Enviar sugestão</button>
            </form>
          </section>
        </main>
      ) : (
        <main className="owner-layout">
          {ownerUnlocked ? (
            <div className="dashboard studio">
              <aside>
                <p className="eyebrow">ESTÚDIO</p>
                <h2>Eduardo Henrique</h2>
                <button onClick={() => firebaseAuth && signOut(firebaseAuth)}>Sair</button>
              </aside>
              <div className="dashboard-content">
                <div className="metric-grid">
                  <article><span>Acessos</span><strong>{metrics.visits}</strong><small>Visitas nesta versão</small></article>
                  <article><span>Downloads</span><strong>{metrics.downloads}</strong><small>Arquivos solicitados</small></article>
                  <article><span>Likes</span><strong>{metrics.likes}</strong><small>Avaliações positivas</small></article>
                  <article><span>Sugestões</span><strong>{metrics.suggestions}</strong><small>Mensagens recebidas</small></article>
                </div>

                <section className="panel-section">
                  <h2>Criar uma história</h2>
                  <form className="grid-form" onSubmit={addStory}>
                    <input name="title" placeholder="Título" required />
                    <input name="kind" placeholder="Gênero" required />
                    <input name="status" placeholder="Status" defaultValue="Em publicação" />
                    <input name="cover" placeholder="URL da capa" />
                    <textarea name="synopsis" placeholder="Sinopse" required />
                    <button type="submit">Publicar história</button>
                  </form>
                </section>

                <section className="panel-section writing-studio">
                  <div className="writing-heading">
                    <div>
                      <p className="eyebrow">ESPAÇO DE ESCRITA</p>
                      <h2>Escreva sua próxima história</h2>
                    </div>
                    {draftId && <span className="draft-status">Rascunho aberto</span>}
                  </div>
                  <form className="writing-form" onSubmit={saveDraft}>
                    <select value={writingStoryId} onChange={(event) => setWritingStoryId(event.target.value)} aria-label="História">
                      <option value="">Selecione uma história para publicar...</option>
                      {stories.map((story) => <option value={story.id} key={story.id}>{story.title}</option>)}
                    </select>
                    <input value={writingTitle} onChange={(event) => setWritingTitle(event.target.value)} placeholder="Título do capítulo ou volume" required />
                    <textarea
                      value={writingText}
                      onChange={(event) => setWritingText(event.target.value)}
                      placeholder="Comece a escrever aqui. Separe as páginas por uma linha em branco."
                      aria-label="Texto da história"
                      required
                    />
                    <div className="writing-actions">
                      <button type="submit" className="secondary-button">Salvar para depois</button>
                      <button type="button" className="publish-button" onClick={publishWriting}>Publicar</button>
                    </div>
                  </form>
                  <div className="drafts-list">
                    <div className="drafts-title"><h3>Seus rascunhos</h3><span>{drafts.length} salvos</span></div>
                    {drafts.length === 0 ? (
                      <p className="empty">Os textos salvos aparecerão aqui para você continuar depois.</p>
                    ) : drafts.map((draft) => (
                      <article className="draft-item" key={draft.id}>
                        <div>
                          <strong>{draft.title}</strong>
                          <small>Salvo em {new Date(draft.updatedAt).toLocaleString('pt-BR')}</small>
                        </div>
                        <div>
                          <button type="button" onClick={() => resumeDraft(draft)}>Continuar escrevendo</button>
                          <button type="button" onClick={() => deleteDraft(draft.id)}>Excluir</button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="panel-section studio-ai">
                  <div>
                    <p className="eyebrow">ASSISTENTE DE TEXTO</p>
                    <h2>Organize o roteiro</h2>
                  </div>
                  <textarea value={studioText} onChange={(event) => setStudioText(event.target.value)} placeholder="Cole o texto da cena, a sinopse ou a descrição dos personagens..." />
                  <button type="button" onClick={() => setNotice('Assistente de texto preparado para integração com IA.')}>Organizar narrativa</button>
                </section>

                <section className="panel-section studio-ai">
                  <div>
                    <p className="eyebrow">AGENTE DE QUADRINHOS</p>
                    <h2>Transformar em mangá</h2>
                  </div>
                  <textarea value={comicPrompt} onChange={(event) => setComicPrompt(event.target.value)} placeholder="Descreva a composição, enquadramentos, emoção e consistência visual..." />
                  <button type="button" onClick={() => setNotice('Agente visual preparado para gerar o roteiro de páginas.')}>Gerar plano de páginas</button>
                </section>

                <section className="panel-section">
                  <h2>Personagens</h2>
                  <form className="grid-form" onSubmit={addCharacterSafe}>
                    <input name="name" placeholder="Nome" required />
                    <input name="role" placeholder="Função" required />
                    <input name="note" placeholder="Características físicas permanentes" required />
                    <button type="submit">Adicionar personagem</button>
                  </form>
                  <div className="character-list">
                    {characters.map((character) => <article key={character.id}><strong>{character.name}</strong><span>{character.role}</span><p>{character.note}</p></article>)}
                  </div>
                </section>

                <section className="panel-section">
                  <h2>Gerador de roteiro</h2>
                  <form className="grid-form" onSubmit={generatePages}>
                    <input name="title" placeholder="Título do capítulo" required />
                    <textarea name="text" placeholder="Cole o texto autoral..." required />
                    <button type="submit">Gerar roteiro de 10 páginas</button>
                  </form>
                </section>

                <section className="panel-section">
                  <h2>Sugestões dos leitores</h2>
                  {suggestions.length === 0 ? <p>Nenhuma sugestão recebida.</p> : suggestions.map((item) => <article className="suggestion-item" key={item.id}><strong>{item.name}</strong><p>{item.message}</p></article>)}
                </section>
              </div>
            </div>
          ) : (
            <section className="unlock-card">
              <span className="brand-mark">G</span>
              <p className="eyebrow">ACESSO DE AUTOR</p>
              <h1>Estúdio do autor</h1>
              <p>Esta área é reservada ao criador autorizado.</p>
              <button type="button" onClick={openAuth}>Entrar com minha conta</button>
            </section>
          )}
        </main>
      )}

      {selectedVolume && (
        <div className="reader-modal" role="dialog" aria-modal="true" aria-label={`Leitor de ${selectedVolume.title}`}>
          <button className="reader-close" onClick={() => setSelectedVolume(null)} aria-label="Voltar à biblioteca">×</button>
          <div className="book">
            <div className="book-page left-page">
              <span>Volume {selectedVolume.number}</span>
              <h2>{selectedVolume.title}</h2>
              <p>{authUser ? 'Leitura completa para leitores cadastrados.' : 'Prévia gratuita: primeiro volume, até quatro páginas.'}</p>
              <small>Página {selectedPage + 1} de {readerPageCount}</small>
            </div>
            <div className="book-page right-page">
              {(!authUser && selectedPage >= 4) ? (
                <div className="login-gate">
                  <strong>Continue a leitura</strong>
                  <p>Crie sua conta ou entre para desbloquear todas as páginas, volumes e downloads.</p>
                  <button onClick={openAuth}>Entrar ou cadastrar</button>
                </div>
              ) : (
                <>
                  <div className="comic-preview">
                    <span>PÁGINA {selectedPage + 1}</span>
                    <p>{selectedVolume.pages?.[selectedPage] || `Prévia de leitura de “${selectedVolume.title}”.`}</p>
                  </div>
                  <div className="book-navigation">
                    <button disabled={selectedPage === 0} onClick={() => setSelectedPage((page) => page - 1)}>Anterior</button>
                    <button disabled={selectedPage >= readerPageCount - 1} onClick={() => setSelectedPage((page) => page + 1)}>Próxima</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {authModal && (
        <div className="auth-modal" role="dialog" aria-modal="true" aria-label="Entrar na conta">
          <div className="auth-card">
            <button className="auth-close" onClick={() => setAuthModal(false)} aria-label="Fechar">×</button>
            <span className="brand-mark">G</span>
            <p className="eyebrow">GRIMÓRIO DOS MUNDOS</p>
            <h2>Entre ou crie sua conta</h2>
            <button className="google-button" onClick={signInWithGoogle} disabled={authBusy}>Continuar com Google</button>
            <div className="divider"><span>ou use seu e-mail</span></div>
            <form onSubmit={sendEmailLink}>
              <input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="Seu e-mail" required />
              <button type="submit" disabled={authBusy}>Receber token de acesso</button>
            </form>
            <small>O cadastro e o login usam validação por token enviado ao e-mail, sem documentos pessoais.</small>
          </div>
        </div>
      )}

      <footer className="app-footer">
        <div>
          <span className="brand-mark footer-mark">G</span>
          <div>
            <strong>Leve o Grimório com você</strong>
            <p>Instale no Android, iOS, Windows ou macOS pelo navegador e use em uma janela própria.</p>
          </div>
        </div>
        <button type="button" onClick={installApp}>Instalar aplicativo</button>
        <small>Aplicativo web instalável. APK/IPA assinados ainda não estão disponíveis.</small>
      </footer>

      {installHelp && (
        <div className="auth-modal" role="dialog" aria-modal="true" aria-label="Como instalar o app">
          <div className="auth-card install-card">
            <button className="auth-close" onClick={() => setInstallHelp('')} aria-label="Fechar">×</button>
            <span className="brand-mark">G</span>
            <p className="eyebrow">INSTALAÇÃO</p>
            <h2>Adicione à tela inicial</h2>
            <p>{installHelp}</p>
            <button className="google-button" onClick={() => setInstallHelp('')}>Entendi</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
