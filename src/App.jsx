import { useEffect, useMemo, useState } from 'react'
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
  const [stories, setStories] = useState(() => readData('stories', seedStories))
  const [characters, setCharacters] = useState(() => readData('characters', [
    { id: 1, name: 'Henry', role: 'Protagonista', note: 'Cabelos escuros bagunçados, expressão cansada.' },
    { id: 2, name: 'Jacx', role: 'Co-protagonista', note: 'Cachos escuros, vestido cinza simples.' },
  ]))
  const [suggestions, setSuggestions] = useState(() => readData('suggestions', []))
  const [reactions, setReactions] = useState(() => readData('reactions', {}))
  const [ownerUnlocked, setOwnerUnlocked] = useState(false)
  const [pin, setPin] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('stories', JSON.stringify(stories))
  }, [stories])

  useEffect(() => {
    localStorage.setItem('characters', JSON.stringify(characters))
  }, [characters])

  useEffect(() => {
    localStorage.setItem('suggestions', JSON.stringify(suggestions))
  }, [suggestions])

  useEffect(() => {
    localStorage.setItem('reactions', JSON.stringify(reactions))
  }, [reactions])

  useEffect(() => {
    const visits = Number(localStorage.getItem('visits') || 0) + 1
    localStorage.setItem('visits', String(visits))
  }, [])

  const metrics = useMemo(() => {
    const visits = Number(localStorage.getItem('visits') || 0)
    const likes = Object.values(reactions).filter((item) => item === 'like').length
    const dislikes = Object.values(reactions).filter((item) => item === 'dislike').length
    const downloads = stories.reduce((total, story) => total + story.volumes.reduce((sum, volume) => sum + volume.downloads, 0), 0)
    return { visits, likes, dislikes, downloads, suggestions: suggestions.length }
  }, [reactions, stories, suggestions])

  function addStory(event) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const cover = data.get('cover')?.trim()
    const story = {
      id: Date.now(),
      title: data.get('title'),
      kind: data.get('kind'),
      status: data.get('status'),
      synopsis: data.get('synopsis'),
      cover,
      volumes: [],
    }
    setStories((items) => [story, ...items])
    event.currentTarget.reset()
    setNotice('História criada.')
  }

  function addCharacterSafe(event) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setCharacters((items) => [
      ...items,
      { id: Date.now(), name: data.get('name'), role: data.get('role'), note: data.get('note') },
    ])
    event.currentTarget.reset()
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

  function reactTo(volumeId, reaction) {
    setReactions((items) => ({ ...items, [volumeId]: items[volumeId] === reaction ? null : reaction }))
  }

  function addSuggestion(event) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setSuggestions((items) => [
      { id: Date.now(), name: data.get('name') || 'Leitor', message: data.get('message') },
      ...items,
    ])
    event.currentTarget.reset()
    setNotice('Sugestão enviada.')
  }

  function downloadVolume(volume) {
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

  function unlockOwner(event) {
    event.preventDefault()
    if (pin === '1234') {
      setOwnerUnlocked(true)
      setNotice('Área do criador desbloqueada.')
    } else {
      setNotice('Código incorreto.')
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
          <button className={area === 'owner' ? 'active' : ''} onClick={() => setArea('owner')}>Área do criador</button>
        </nav>
        <button className="theme-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} type="button" aria-label="Alternar tema">
          {theme === 'dark' ? '☀' : '☾'}
        </button>
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
              <span>{stories.length} títulos</span>
            </div>
            <div className="story-grid">
              {stories.map((story) => (
                <article className="story-card" key={story.id}>
                  <div className="cover" style={story.cover ? { backgroundImage: `linear-gradient(145deg, transparent, #09070d), url(${story.cover})` } : undefined}>
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
                            <button className={reactions[volume.id] === 'like' ? 'selected' : ''} onClick={() => reactTo(volume.id, 'like')}>▲ {volume.likes}</button>
                            <button className={reactions[volume.id] === 'dislike' ? 'selected' : ''} onClick={() => reactTo(volume.id, 'dislike')}>▼ {volume.dislikes}</button>
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
          {!ownerUnlocked ? (
            <section className="unlock-card">
              <span className="brand-mark">G</span>
              <p className="eyebrow">ACESSO RESTRITO</p>
              <h1>Área do criador</h1>
              <p>Digite o código local de demonstração.</p>
              <form onSubmit={unlockOwner}>
                <input type="password" inputMode="numeric" value={pin} onChange={(event) => setPin(event.target.value)} placeholder="Código" />
                <button type="submit">Entrar</button>
              </form>
              <small>Versão pública de demonstração. Para proteção real, é necessário autenticação de servidor.</small>
            </section>
          ) : (
            <div className="dashboard">
              <aside>
                <p className="eyebrow">PAINEL</p>
                <h2>Eduardo Henrique</h2>
                <button onClick={() => setOwnerUnlocked(false)}>Sair</button>
              </aside>
              <div className="dashboard-content">
                <div className="metric-grid">
                  <article><span>Acessos</span><strong>{metrics.visits}</strong><small>Visitas nesta versão</small></article>
                  <article><span>Downloads</span><strong>{metrics.downloads}</strong><small>Arquivos solicitados</small></article>
                  <article><span>Likes</span><strong>{metrics.likes}</strong><small>Avaliações positivas</small></article>
                  <article><span>Sugestões</span><strong>{metrics.suggestions}</strong><small>Mensagens recebidas</small></article>
                </div>

                <section className="panel-section">
                  <h2>Nova história</h2>
                  <form className="grid-form" onSubmit={addStory}>
                    <input name="title" placeholder="Título" required />
                    <input name="kind" placeholder="Gênero" required />
                    <input name="status" placeholder="Status" defaultValue="Em publicação" />
                    <input name="cover" placeholder="URL da capa" />
                    <textarea name="synopsis" placeholder="Sinopse" required />
                    <button type="submit">Publicar história</button>
                  </form>
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
          )}
        </main>
      )}
    </div>
  )
}

export default App
