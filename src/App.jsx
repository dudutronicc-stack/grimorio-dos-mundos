import { useEffect, useMemo, useState } from 'react'
import { firebaseAuth, firestoreDb, googleProvider } from './firebase'
import { onAuthStateChanged, signInWithPopup, signOut, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth'
import {
  createSuggestion,
  createReviewRequest,
  fetchCharacters,
  fetchChapterPages,
  fetchDrafts,
  fetchReaderFavorites,
  fetchReviewRequests,
  fetchStories,
  fetchSuggestions,
  fetchUserProfile,
  persistCharacter,
  persistChapter,
  persistDraft,
  persistReaderFavorite,
  persistReaction,
  persistStory,
  persistStoryTheme,
  persistUserProfile,
  persistVolume,
  persistVolumeReviewFlag,
  removeReaderFavorite,
  removeDraft,
  publishQueuedChapter,
  publishQueuedVolume,
  setChapterSchedule,
  setVolumeSchedule,
  updateReviewRequest,
} from './firestoreData'
import { getDeviceViewMode } from './viewMode'
import { analyzeManuscript } from './geminiAssistant'
import './App.css'

const seedStories = [
  {
    id: 1,
    title: 'Crônicas da Nova Aurora',
    kind: 'Fantasia',
    status: 'Em publicação',
    guestPreview: true,
    guestPreviewRank: 1,
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

function getVolumeChapters(volume) {
  return volume.chapterList?.length ? volume.chapterList : [{
    id: 'legacy',
    number: 1,
    title: volume.title,
    pageCount: volume.pageCount || volume.chapters || 1,
    legacy: true,
  }]
}

function authorKey(value) {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function timestampValue(value) {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return new Date(value).getTime() || 0
  if (typeof value?.toMillis === 'function') return value.toMillis()
  return 0
}

function dateTimeLocalValue(value) {
  const timestamp = timestampValue(value)
  if (!timestamp) return ''
  const localDate = new Date(timestamp - new Date(timestamp).getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 16)
}

function compressSagaImage(file) {
  if (!file.type.startsWith('image/')) return Promise.reject(new Error('Selecione um arquivo de imagem.'))
  if (file.size > 10 * 1024 * 1024) return Promise.reject(new Error('A imagem original deve ter no máximo 10 MB.'))

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const scale = Math.min(1, 1200 / image.width, 1200 / image.height)
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))
      const context = canvas.getContext('2d')
      if (!context) {
        reject(new Error('Não foi possível preparar a imagem.'))
        return
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      for (const quality of [0.85, 0.72, 0.6, 0.5]) {
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        if (dataUrl.length <= 700_000) {
          resolve(dataUrl)
          return
        }
      }
      reject(new Error('A imagem ainda ficou grande demais após a compressão. Escolha uma imagem menor.'))
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Não foi possível abrir a imagem selecionada.'))
    }
    image.src = objectUrl
  })
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
  const [readerFavorites, setReaderFavorites] = useState([])
  const [reviewRequests, setReviewRequests] = useState([])
  const [catalogTitleFilter, setCatalogTitleFilter] = useState('')
  const [catalogAuthorFilter, setCatalogAuthorFilter] = useState('')
  const [catalogReleaseFilter, setCatalogReleaseFilter] = useState('')
  const [authModal, setAuthModal] = useState(false)
  const [authEmail, setAuthEmail] = useState('')
  const [authUser, setAuthUser] = useState(null)
  const [accountRole, setAccountRole] = useState('reader')
  const [profile, setProfile] = useState(null)
  const [authBusy, setAuthBusy] = useState(false)
  const viewMode = getDeviceViewMode(window.navigator)
  const [selectedVolume, setSelectedVolume] = useState(null)
  const [selectedChapter, setSelectedChapter] = useState(null)
  const [readerMode, setReaderMode] = useState('book')
  const [readerFontSize, setReaderFontSize] = useState(20)
  const [studioText, setStudioText] = useState('')
  const [comicPrompt, setComicPrompt] = useState('')
  const [assistantFile, setAssistantFile] = useState(null)
  const [assistantConsent, setAssistantConsent] = useState(false)
  const [assistantBusy, setAssistantBusy] = useState(false)
  const [assistantResult, setAssistantResult] = useState('')
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)
  const [publishReviewMethod, setPublishReviewMethod] = useState('none')
  const [publishDestination, setPublishDestination] = useState('now')
  const [publishAt, setPublishAt] = useState('')
  const [reviewerEmail, setReviewerEmail] = useState('')
  const [publishBusy, setPublishBusy] = useState(false)
  const [themeStoryId, setThemeStoryId] = useState('')
  const [themePreset, setThemePreset] = useState('parchment')
  const [themeBackground, setThemeBackground] = useState('')
  const [installPrompt, setInstallPrompt] = useState(null)
  const [installHelp, setInstallHelp] = useState('')
  const [draftId, setDraftId] = useState(null)
  const [writingStoryId, setWritingStoryId] = useState('')
  const [writingTitle, setWritingTitle] = useState('')
  const [writingVolumeTitle, setWritingVolumeTitle] = useState('')
  const [writingMedium, setWritingMedium] = useState('manga')
  const [writingVolumeId, setWritingVolumeId] = useState('')
  const [writingText, setWritingText] = useState('')
  const [selectedPage, setSelectedPage] = useState(0)
  const [notice, setNotice] = useState('')
  const ownerUnlocked = authUser?.email === 'dudutronicc@gmail.com' || accountRole === 'creator'
  const writingStory = stories.find((item) => String(item.id) === String(writingStoryId))
  const writingSelectedVolume = writingStory?.volumes.find((item) => String(item.id) === String(writingVolumeId))
  const publicStories = useMemo(() => stories.filter((story) => (
    story.status === 'published' || (!firestoreDb && story.status === 'Em publicação')
  )), [stories])
  const themeStory = stories.find((item) => String(item.id) === String(themeStoryId))
  const writingContentMedium = writingSelectedVolume?.medium || writingMedium
  const readerPageCount = selectedChapter?.pageCount || selectedVolume?.pageCount || selectedChapter?.pages?.length || selectedVolume?.chapters || 1
  const lastChapterNumber = Math.max(0, ...(selectedVolume?.chapterList || []).map((chapter) => Number(chapter.number) || 0))
  const isBookEnd = Boolean(selectedChapter && selectedPage >= readerPageCount - 1
    && Number(selectedChapter.number) === lastChapterNumber)
  const filteredCatalogStories = useMemo(() => publicStories.filter((story) => {
    const matchesTitle = story.title.toLowerCase().includes(catalogTitleFilter.trim().toLowerCase())
    const matchesAuthor = (story.authorName || '').toLowerCase().includes(catalogAuthorFilter.trim().toLowerCase())
    const releaseDate = timestampValue(story.latestReleaseAt || story.publishedAt || story.updatedAt)
    const matchesRelease = !catalogReleaseFilter || releaseDate >= new Date(`${catalogReleaseFilter}T00:00:00`).getTime()
    return matchesTitle && matchesAuthor && matchesRelease
  }), [publicStories, catalogTitleFilter, catalogAuthorFilter, catalogReleaseFilter])
  const followedAuthorUpdates = useMemo(() => {
    const authorFavorites = readerFavorites.filter((favorite) => favorite.type === 'author')
    return publicStories.map((story) => {
      const storyAuthorId = String(story.authorId || authorKey(story.authorName))
      const followedAuthor = authorFavorites.find((favorite) => String(favorite.targetId) === storyAuthorId)
      const releaseTime = timestampValue(story.latestReleaseAt)
      if (!followedAuthor || !releaseTime || releaseTime <= timestampValue(followedAuthor.followedAt)) return null
      return { story, followedAuthor, releaseTime }
    }).filter(Boolean).sort((left, right) => right.releaseTime - left.releaseTime)
  }, [publicStories, readerFavorites])
  const queuedPublicationItems = useMemo(() => stories.flatMap((story) => story.volumes.flatMap((volume) => {
    if (['pending', 'scheduled', 'pending_review'].includes(volume.status)) {
      return [{ type: 'volume', story, volume }]
    }
    return volume.chapterList
      .filter((chapter) => !chapter.legacy && ['pending', 'scheduled', 'pending_review'].includes(chapter.status))
      .map((chapter) => ({ type: 'chapter', story, volume, chapter }))
  })), [stories])
  const pendingReviewCount = reviewRequests.filter((request) => (
    request.recipientEmail === authUser?.email?.toLowerCase() && request.status === 'pending'
  )).length

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
    if (!firestoreDb || !authUser) return
    let active = true
    fetchReaderFavorites(authUser.uid)
      .then((favorites) => {
        if (active) setReaderFavorites(favorites)
      })
      .catch(() => {
        if (active) setNotice('Não foi possível carregar seus favoritos.')
      })
    return () => { active = false }
  }, [authUser])

  useEffect(() => {
    if (!firestoreDb || !authUser?.email) return
    let active = true
    fetchReviewRequests(authUser.uid, authUser.email.toLowerCase())
      .then((requests) => {
        if (active) setReviewRequests(requests)
      })
      .catch(() => {
        if (active) setNotice('Não foi possível carregar as notificações de revisão.')
      })
    return () => { active = false }
  }, [authUser])

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
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      setReaderFavorites([])
      setReviewRequests([])
      setAuthUser(user)
      if (!user) setArea('reader')
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    if (!firestoreDb || !authUser) {
      setAccountRole('reader')
      setProfile(null)
      return
    }
    let active = true
    Promise.all([fetchUserProfile(authUser.uid, authUser), fetchDrafts(authUser.uid)])
      .then(([savedProfile, savedDrafts]) => {
        if (!active) return
        setProfile({
          ...savedProfile,
          authorName: savedProfile.authorName || '',
          displayName: savedProfile.displayName || authUser.displayName || '',
        })
        setAccountRole(savedProfile.role || 'reader')
        setDrafts(savedDrafts)
      })
      .catch(() => {
        if (active) setNotice('Não foi possível carregar o perfil e os rascunhos da conta.')
      })
    return () => { active = false }
  }, [authUser])

  useEffect(() => {
    if (!firestoreDb) return
    let active = true
    const isCreator = ownerUnlocked
    fetchStories(isCreator, authUser?.uid, Boolean(authUser))
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
      Promise.all([fetchSuggestions(), fetchCharacters()])
        .then(([savedSuggestions, savedCharacters]) => {
          if (!active) return
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
      authorName: profile?.authorName || authUser?.displayName || 'Eduardo Henrique',
      authorId: authUser?.uid || '',
      publishedAt: new Date().toISOString(),
      latestReleaseAt: new Date().toISOString(),
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
      volumeId: writingVolumeId,
      volumeTitle: writingVolumeTitle.trim(),
      medium: writingMedium,
      title,
      text,
      updatedAt: new Date().toISOString(),
    }
    if (firestoreDb) {
      if (!firebaseAuth?.currentUser) {
        setNotice('Entre na sua conta antes de salvar um rascunho na nuvem.')
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

  async function saveProfile(event) {
    event.preventDefault()
    const authorName = profile?.authorName?.trim() || ''
    if (authorName.length < 2 || authorName.length > 80) {
      setNotice('O nome de autor deve ter entre 2 e 80 caracteres.')
      return
    }
    if (!firestoreDb || !authUser) {
      setNotice('Entre na sua conta para salvar o perfil.')
      return
    }
    try {
      await persistUserProfile(authUser.uid, authorName)
      setProfile((current) => ({ ...current, authorName }))
      setNotice('Perfil atualizado.')
    } catch {
      setNotice('Não foi possível salvar o nome de autor.')
    }
  }

  function resumeDraft(draft) {
    setDraftId(draft.id)
    setWritingStoryId(draft.storyId || '')
    setWritingVolumeId(draft.volumeId || '')
    setWritingVolumeTitle(draft.volumeTitle || '')
    setWritingMedium(draft.medium || 'manga')
    setWritingTitle(draft.title)
    setWritingText(draft.text)
    setArea(ownerUnlocked ? 'owner' : 'profile')
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setNotice(`Rascunho "${draft.title}" aberto para continuar.`)
  }

  function queueDraft(draft) {
    if (!draft.storyId) {
      setNotice('Este rascunho ainda não está associado a uma saga. Abra-o, escolha a saga e salve novamente.')
      return
    }
    setDraftId(draft.id)
    setWritingStoryId(draft.storyId)
    setWritingVolumeId(draft.volumeId || '')
    setWritingVolumeTitle(draft.volumeTitle || '')
    setWritingMedium(draft.medium || 'manga')
    setWritingTitle(draft.title)
    setWritingText(draft.text)
    setPublishReviewMethod('none')
    setPublishDestination('queue')
    setArea('owner')
    setPublishDialogOpen(true)
  }

  async function publishWriting({ status = 'published', publishAt = '', reviewNotes = '' } = {}) {
    const title = writingTitle.trim()
    const text = writingText.trim()
    if (!title || !text) {
      setNotice('Adicione um título e escreva o conteúdo antes de publicar.')
      return false
    }
    const story = stories.find((item) => String(item.id) === String(writingStoryId))
    if (!story) {
      setNotice('Selecione uma saga para publicar o capítulo.')
      return false
    }

    const existingVolume = story.volumes.find((item) => String(item.id) === String(writingVolumeId))
    if (!existingVolume && !writingVolumeTitle.trim()) {
      setNotice('Informe o título do livro, mangá ou temporada.')
      return false
    }
    const medium = existingVolume?.medium || writingMedium
    let pages
    if (medium === 'video') {
      try {
        const videoUrl = new URL(text)
        if (videoUrl.protocol !== 'https:') throw new Error('URL must use HTTPS.')
        pages = [{ mediaType: 'video', videoUrl: videoUrl.href }]
      } catch {
        setNotice('Para um episódio em vídeo, informe uma URL HTTPS direta para o arquivo de vídeo.')
        return false
      }
    } else {
      pages = text.split(/\n\s*\n/).map((page) => page.trim()).filter(Boolean)
    }
    const volumeNumber = existingVolume?.number
      || Math.max(0, ...story.volumes.map((volume) => Number(volume.number) || 0)) + 1
    const volume = existingVolume || {
      id: String(Date.now()),
      number: volumeNumber,
      title: writingVolumeTitle.trim() || `Volume ${volumeNumber}`,
      medium,
      chapters: 0,
      pageCount: 0,
      downloads: 0,
      likes: 0,
      dislikes: 0,
      chapterList: [],
      publishedAt: new Date().toISOString(),
    }
    const chapterNumber = Math.max(0, ...(volume.chapterList || []).map((chapter) => Number(chapter.number) || 0)) + 1
    const chapter = {
      id: String(Date.now() + 1),
      number: chapterNumber,
      title,
      pageCount: pages.length || 1,
      pages: pages.length ? pages : [text],
      status,
      reviewNotes,
      ...(publishAt ? { publishAt } : {}),
      publishedAt: status === 'published' ? new Date().toISOString() : '',
    }
    if (firestoreDb) {
      try {
        if (!existingVolume) {
          await persistVolume(story.id, {
            ...volume,
            status,
            ...(publishAt ? { publishAt } : {}),
            chapters: chapterNumber,
            pageCount: chapter.pageCount,
            chapterList: [chapter],
          })
        } else {
          await persistChapter(story.id, volume.id, chapter, status, publishAt)
        }
        if (draftId && firebaseAuth?.currentUser) {
          await removeDraft(firebaseAuth.currentUser.uid, draftId)
        }
      } catch {
        setNotice('O capítulo não foi publicado no Firestore. Confira conexão e regras.')
        return false
      }
    }
    setStories((items) => items.map((item) => (
      String(item.id) === String(story.id)
        ? {
          ...item,
          ...(status === 'published' ? {
            latestReleaseAt: chapter.publishedAt,
            latestReleaseVolumeId: String(volume.id),
            latestReleaseChapterId: String(chapter.id),
            latestReleaseTitle: chapter.title,
          } : {}),
          volumes: existingVolume
            ? item.volumes.map((current) => current.id === volume.id
              ? {
                ...current,
                ...(status === 'published' ? {
                  chapters: chapterNumber,
                  pageCount: (current.pageCount || 0) + chapter.pageCount,
                } : {}),
                chapterList: [...(current.chapterList || []), chapter],
              }
              : current)
            : [...item.volumes, { ...volume, status, chapters: chapterNumber, pageCount: chapter.pageCount, chapterList: [chapter] }],
        }
        : item
    )))
    setDrafts((items) => items.filter((item) => item.id !== draftId))
    setDraftId(null)
    setWritingTitle('')
    setWritingVolumeTitle('')
    setWritingMedium('manga')
    setWritingVolumeId('')
    setWritingText('')
    setWritingStoryId('')
    setPublishDialogOpen(false)
    setPublishReviewMethod('none')
    setPublishDestination('now')
    setPublishAt('')
    setNotice(status === 'published'
      ? `Capítulo ${chapterNumber} publicado em "${volume.title}" — ${story.title}.`
      : status === 'scheduled'
        ? `Capítulo agendado para publicação em "${volume.title}".`
        : status === 'pending_review'
          ? 'Conteúdo enviado para revisão e movido para Para publicar.'
          : 'Conteúdo salvo em Para publicar, sem data definida.')
    return true
  }

  async function confirmPublication(event) {
    event.preventDefault()
    const story = stories.find((item) => String(item.id) === String(writingStoryId))
    const content = writingText.trim()
    const draftTitle = writingTitle.trim()
    if (!story || !content || !draftTitle) {
      setNotice('Selecione uma saga e preencha o título e o texto antes de continuar.')
      return
    }

    let status = 'published'
    let scheduledAt = ''
    let reviewNotes = ''
    const method = publishReviewMethod
    if (method === 'none') {
      if (publishDestination === 'queue') status = 'pending'
      if (publishDestination === 'schedule') {
        const scheduledDate = new Date(publishAt)
        if (!publishAt || Number.isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
          setNotice('Escolha uma data e hora futuras para agendar a publicação.')
          return
        }
        status = 'scheduled'
        scheduledAt = scheduledDate.toISOString()
      }
    } else {
      status = 'pending_review'
      if (method === 'ai') {
        if (!assistantConsent) {
          setNotice('Confirme o envio do conteúdo ao Google antes de solicitar a revisão por IA.')
          return
        }
      } else {
        const recipientEmail = reviewerEmail.trim().toLowerCase()
        if (!firebaseAuth?.currentUser || !recipientEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipientEmail)) {
          setNotice('Informe um e-mail válido de uma conta que possa acessar a central de notificações.')
          return
        }
        if (recipientEmail === authUser?.email?.toLowerCase()) {
          setNotice('Informe o e-mail de outra pessoa para revisar o conteúdo.')
          return
        }
        if (content.length > 200000) {
          setNotice('O texto enviado ao revisor deve ter no máximo 200.000 caracteres.')
          return
        }
        if (story.title.length > 160) {
          setNotice('O título da saga deve ter no máximo 160 caracteres para solicitar uma revisão.')
          return
        }
      }
    }

    setPublishBusy(true)
    try {
      if (method === 'ai') {
        const reviewPrompt = [
          'Faça uma revisão editorial do conteúdo abaixo. Aponte clareza, coerência, ritmo, continuidade de personagens e cenários, e sugestões objetivas.',
          'Não reescreva a obra inteira e não altere características visuais sem indicação explícita do autor.',
          `Título do capítulo: ${draftTitle}`,
          `Saga: ${story.title}`,
          'Conteúdo:',
          content,
        ].join('\n\n')
        reviewNotes = await analyzeManuscript(null, reviewPrompt)
        setAssistantResult(reviewNotes)
      }

      const saved = await publishWriting({ status, publishAt: scheduledAt, reviewNotes })
      if (!saved) return

      if (method === 'reviewer') {
        try {
          const requestId = await createReviewRequest(authUser.uid, {
            senderEmail: authUser.email,
            senderName: (profile?.authorName || authUser.displayName || 'Autor').slice(0, 80),
            recipientEmail: reviewerEmail.trim().toLowerCase(),
            storyId: String(story.id),
            volumeId: String(writingVolumeId || ''),
            draftTitle,
            storyTitle: story.title,
            content,
          })
          setReviewRequests((items) => [{
            id: requestId,
            senderUid: authUser.uid,
            recipientEmail: reviewerEmail.trim().toLowerCase(),
            status: 'pending',
            storyTitle: story.title,
            draftTitle,
            createdAt: Date.now(),
          }, ...items])
          setNotice('Conteúdo colocado em Para publicar e pedido enviado à central de notificações do revisor.')
        } catch {
          setNotice('O conteúdo foi salvo em Para publicar, mas a notificação ao revisor não foi criada.')
        }
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível concluir o processo de revisão.')
    } finally {
      setPublishBusy(false)
    }
  }

  async function refreshAuthorCatalog() {
    const updatedStories = await fetchStories(true, authUser.uid, true)
    setStories(updatedStories)
  }

  async function publishQueuedItem(item) {
    try {
      if (item.type === 'volume') {
        await publishQueuedVolume(item.story.id, item.volume.id)
      } else {
        await publishQueuedChapter(item.story.id, item.volume.id, item.chapter.id)
      }
      await refreshAuthorCatalog()
      setNotice('Item publicado e removido de Para publicar.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível publicar este item.')
    }
  }

  async function saveQueueSchedule(event, item) {
    event.preventDefault()
    const form = event.currentTarget
    const value = new FormData(form).get('publishAt')?.trim()
    const date = value ? new Date(value) : null
    if (date && (Number.isNaN(date.getTime()) || date <= new Date())) {
      setNotice('A data de publicação precisa estar no futuro.')
      return
    }
    try {
      const publishAtIso = date ? date.toISOString() : ''
      if (item.type === 'volume') {
        await setVolumeSchedule(item.story.id, item.volume.id, publishAtIso)
      } else {
        await setChapterSchedule(item.story.id, item.volume.id, item.chapter.id, publishAtIso)
      }
      await refreshAuthorCatalog()
      setNotice(date ? 'Data automática de publicação salva.' : 'Item mantido em Para publicar, sem data automática.')
    } catch {
      setNotice('Não foi possível salvar a data de publicação.')
    }
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
      setWritingVolumeTitle('')
      setWritingMedium('manga')
      setWritingVolumeId('')
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

  async function openChapter(storyId, volume, chapter, story) {
    if (!authUser && (!story?.guestPreview || volume.number > 1 || chapter.number > 1)) {
      setAuthModal(true)
      setNotice('Entre para acessar outras obras, volumes e capítulos.')
      return
    }
    setSelectedPage(0)
    setReaderMode('book')
    setReaderFontSize(20)
    const readerVolume = {
      ...volume,
      storyId,
      sagaTitle: story?.title || '',
      authorName: story?.authorName || '',
      storyTheme: story?.theme || {},
      chapterList: getVolumeChapters(volume),
    }
    if (!firestoreDb) {
      setSelectedVolume(readerVolume)
      setSelectedChapter(chapter)
      return
    }
    try {
      const pages = await fetchChapterPages(storyId, volume.id, chapter, Boolean(authUser))
      setSelectedVolume({ ...readerVolume, pages })
      setSelectedChapter({ ...chapter, pages })
    } catch {
      setNotice('Não foi possível abrir as páginas deste capítulo no Firestore.')
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
        id = await createSuggestion(firebaseAuth.currentUser.uid, name, message, {
          storyId: selectedVolume?.storyId,
          volumeId: selectedVolume?.id,
          chapterId: selectedChapter?.id,
        })
      } catch {
        setNotice('Não foi possível enviar a sugestão.')
        return
      }
    }
    setSuggestions((items) => [{ id, name, message, storyId: selectedVolume?.storyId, volumeId: selectedVolume?.id, chapterId: selectedChapter?.id }, ...items])
    form.reset()
    setNotice('Sugestão enviada.')
  }

  async function saveSagaTheme(event) {
    event.preventDefault()
    if (!themeStory) return
    let background = ''
    if (themeBackground.trim()) {
      if (themeBackground.startsWith('data:image/jpeg;base64,')) {
        if (themeBackground.length > 700000) {
          setNotice('A imagem comprimida deve ter no máximo 700 KB.')
          return
        }
        background = themeBackground
      } else {
        try {
          const parsedBackground = new URL(themeBackground.trim())
          if (parsedBackground.protocol !== 'https:') throw new Error('HTTPS is required.')
          background = parsedBackground.href
        } catch {
          setNotice('A imagem de fundo deve ser uma URL HTTPS válida ou uma imagem carregada.')
          return
        }
      }
    }
    const nextTheme = { preset: themePreset, background }
    if (firestoreDb) {
      try {
        await persistStoryTheme(themeStory.id, nextTheme)
      } catch {
        setNotice('Não foi possível salvar o visual desta saga.')
        return
      }
    }
    setStories((items) => items.map((item) => String(item.id) === String(themeStory.id) ? { ...item, theme: nextTheme } : item))
    setNotice('Visual da saga atualizado.')
  }

  async function toggleVolumeReview(storyId, volumeId, reviewEnabled) {
    if (firestoreDb) {
      try {
        await persistVolumeReviewFlag(storyId, volumeId, reviewEnabled)
      } catch {
        setNotice('Não foi possível atualizar a opção de sugestões deste volume.')
        return
      }
    }
    setStories((items) => items.map((story) => String(story.id) === String(storyId)
      ? { ...story, volumes: story.volumes.map((volume) => String(volume.id) === String(volumeId) ? { ...volume, reviewEnabled } : volume) }
      : story))
  }

  function isReaderFavorite(type, targetId) {
    const favoriteId = `${type}_${encodeURIComponent(String(targetId))}`
    return readerFavorites.some((favorite) => favorite.id === favoriteId)
  }

  async function toggleReaderFavorite(type, targetId, targetName) {
    if (!authUser) {
      setAuthModal(true)
      setNotice('Entre para salvar obras e autores nos seus favoritos.')
      return
    }
    const favoriteId = `${type}_${encodeURIComponent(String(targetId))}`
    const existing = readerFavorites.find((favorite) => favorite.id === favoriteId)
    if (firestoreDb) {
      try {
        if (existing) {
          await removeReaderFavorite(authUser.uid, favoriteId)
        } else {
          await persistReaderFavorite(authUser.uid, { id: favoriteId, type, targetId, targetName })
        }
      } catch {
        setNotice('Não foi possível atualizar seus favoritos.')
        return
      }
    }
    setReaderFavorites((items) => existing
      ? items.filter((favorite) => favorite.id !== favoriteId)
      : [...items, { id: favoriteId, type, targetId: String(targetId), targetName, followedAt: Date.now() }])
    setNotice(existing ? 'Favorito removido.' : `${type === 'author' ? 'Autor' : 'Obra'} adicionado aos favoritos.`)
  }

  async function analyzeWithGemini() {
    if (!assistantConsent) {
      setNotice('Confirme que deseja enviar o conteúdo selecionado ao Google para análise.')
      return
    }
    setAssistantBusy(true)
    try {
      const prompt = [studioText.trim(), comicPrompt.trim()].filter(Boolean).join('\n\n')
      const result = await analyzeManuscript(assistantFile, prompt)
      setAssistantResult(result)
      setNotice('Análise concluída. Revise as sugestões antes de incorporá-las à história.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível concluir a análise com a IA.')
    } finally {
      setAssistantBusy(false)
    }
  }

  async function respondToReviewRequest(requestId, updates) {
    try {
      await updateReviewRequest(requestId, { ...updates, reviewerUid: authUser.uid })
      setReviewRequests((items) => items.map((item) => item.id === requestId ? { ...item, ...updates, reviewerUid: authUser.uid } : item))
      setNotice(updates.status === 'accepted' ? 'Pedido de revisão aceito.' : updates.status === 'declined' ? 'Pedido de revisão recusado.' : 'Revisão enviada ao autor.')
    } catch {
      setNotice('Não foi possível atualizar o pedido de revisão.')
    }
  }

  async function completeReview(event, request) {
    event.preventDefault()
    const form = event.currentTarget
    const feedback = new FormData(form).get('feedback')?.trim()
    if (!feedback || feedback.length > 5000) {
      setNotice('A revisão deve ter entre 1 e 5.000 caracteres.')
      return
    }
    await respondToReviewRequest(request.id, { status: 'completed', feedback })
    form.reset()
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
          <button className={area === 'reader' ? 'active' : ''} onClick={() => setArea('reader')}>{authUser ? 'Feed' : 'Leitor'}</button>
          {authUser && (
            <>
              <button className={area === 'catalog' ? 'active' : ''} onClick={() => setArea('catalog')}>Acervo</button>
              <button className={area === 'favorites' ? 'active' : ''} onClick={() => setArea('favorites')}>Favoritos</button>
              <button className={area === 'notifications' ? 'active' : ''} onClick={() => setArea('notifications')}>
                Notificações{pendingReviewCount > 0 ? ` (${pendingReviewCount})` : ''}
              </button>
              <button className={area === 'library' ? 'active' : ''} onClick={() => setArea('library')}>Minha biblioteca</button>
              <button className={area === 'profile' ? 'active' : ''} onClick={() => setArea('profile')}>Perfil e rascunhos</button>
            </>
          )}
          {ownerUnlocked && (
            <>
              <button className={area === 'publishQueue' ? 'active' : ''} onClick={() => setArea('publishQueue')}>
                Para publicar{queuedPublicationItems.length ? ` (${queuedPublicationItems.length})` : ''}
              </button>
              <button className={area === 'owner' ? 'active' : ''} onClick={() => setArea('owner')}>Estúdio do autor</button>
            </>
          )}
        </nav>
        <div className="top-actions">
          <button className="theme-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} type="button" aria-label="Alternar tema">
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          {authUser ? (
            <>
              <button className="login-button profile-shortcut" onClick={() => setArea('profile')}>
                {profile?.authorName || authUser.displayName || 'Perfil'}
              </button>
              <button className="login-button" onClick={() => firebaseAuth && signOut(firebaseAuth)}>Sair</button>
            </>
          ) : (
            <button className="login-button" onClick={openAuth}>Entrar</button>
          )}
        </div>
      </header>

      {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Fechar">×</button></div>}

      {area === 'reader' ? (
        <main className="reader-layout">
          {authUser && followedAuthorUpdates.length > 0 && (
            <section className="feed-updates">
              <div className="section-heading">
                <div><p className="eyebrow">ATUALIZAÇÕES DE AUTORES FAVORITOS</p><h2>Novidades para você</h2></div>
              </div>
              {followedAuthorUpdates.map(({ story, followedAuthor, releaseTime }) => {
                const releaseVolume = story.volumes.find((volume) => String(volume.id) === String(story.latestReleaseVolumeId))
                  || story.volumes[story.volumes.length - 1]
                const releaseChapters = releaseVolume ? getVolumeChapters(releaseVolume) : []
                const releaseChapter = releaseChapters.find((chapter) => String(chapter.id) === String(story.latestReleaseChapterId))
                  || releaseChapters[releaseChapters.length - 1]
                return (
                  <article className="feed-update-card" key={`${story.id}-${releaseTime}`}>
                    <span className="eyebrow">AUTOR FAVORITO · {followedAuthor.targetName}</span>
                    <h3>{story.latestReleaseTitle || story.title}</h3>
                    <p>{story.title}{story.authorName ? ` · ${story.authorName}` : ''}</p>
                    <time dateTime={new Date(releaseTime).toISOString()}>{new Date(releaseTime).toLocaleDateString('pt-BR')}</time>
                    {releaseVolume && releaseChapter && (
                      <button onClick={() => openChapter(story.id, releaseVolume, releaseChapter, story)}>Ler atualização</button>
                    )}
                  </article>
                )
              })}
            </section>
          )}
          <section className="hero-banner">
            <p className="eyebrow">ACESSO LIVRE • NOVOS REINOS</p>
            <h1>Abra o livro.<br/><em>Encontre outro mundo.</em></h1>
            <p>{authUser ? 'Explore toda a biblioteca publicada, organizada por saga, livro e capítulo.' : 'Leia gratuitamente as cinco obras mais curtidas: cinco páginas de cada título. Entre para continuar.'}</p>
          </section>

          <section>
            <div className="section-heading">
              <div><p className="eyebrow">COLEÇÃO</p><h2>Histórias disponíveis</h2></div>
            </div>
            <div className={viewMode === 'feed' ? 'feed-grid' : 'blog-grid'}>
              {publicStories.map((story) => {
                const coverImage = story.cover || story.theme?.background
                return (
                  <article className="story-card" key={story.id}>
                  <div
                    className="cover"
                    role="button"
                    tabIndex={0}
                    onClick={() => story.volumes[0] && openChapter(story.id, story.volumes[0], getVolumeChapters(story.volumes[0])[0], story)}
                    onKeyDown={(event) => event.key === 'Enter' && story.volumes[0] && openChapter(story.id, story.volumes[0], getVolumeChapters(story.volumes[0])[0], story)}
                    style={{
                      '--saga-accent': story.theme?.preset === 'midnight' ? '#9a88ff' : story.theme?.preset === 'forest' ? '#7cb590' : '#c9a44d',
                      ...(coverImage ? { backgroundImage: `linear-gradient(145deg, transparent, #09070d), url("${coverImage}")` } : {}),
                    }}
                  >
                    <span>{story.kind}</span>
                    <strong>{story.title}</strong>
                  </div>
                  <div className="card-body">
                    <div className="status"><i/> {story.status}</div>
                    {story.authorName && <small className="author-byline">Por {story.authorName}</small>}
                    <p>{story.synopsis}</p>
                    <div className="story-favorite-actions">
                      <button onClick={() => toggleReaderFavorite('story', story.id, story.title)}>
                        {isReaderFavorite('story', story.id) ? '★ Remover dos favoritos' : '☆ Favoritar obra'}
                      </button>
                      {story.authorName && (
                        <button onClick={() => toggleReaderFavorite('author', story.authorId || authorKey(story.authorName), story.authorName)}>
                          {isReaderFavorite('author', story.authorId || authorKey(story.authorName)) ? '★ Autor favorito' : '☆ Favoritar autor'}
                        </button>
                      )}
                    </div>
                    <div className="volume-list">
                      {story.volumes.map((volume) => (
                        <div className="volume" key={volume.id}>
                          <div className="volume-heading">
                            <span>{volume.medium === 'video' ? 'Temporada' : volume.medium === 'book' ? 'Livro' : 'Mangá'} {volume.number}</span>
                            <strong>{volume.title}</strong>
                            <small>{getVolumeChapters(volume).length} capítulo(s)</small>
                          </div>
                          <details className="chapter-folder" open>
                            <summary>Capítulos</summary>
                            <div className="chapter-items">
                              {getVolumeChapters(volume).map((chapter) => (
                                <button key={chapter.id} onClick={() => openChapter(story.id, volume, chapter, story)}>
                                  <span>Capítulo {chapter.number}: {chapter.title}</span>
                                  <small>{chapter.pageCount || 1} página(s)</small>
                                </button>
                              ))}
                            </div>
                          </details>
                          <div className="actions">
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
                )
              })}
            </div>
          </section>

        </main>
      ) : area === 'catalog' ? (
        <main className="reader-layout archive-layout">
          <section className="section-heading">
            <div><p className="eyebrow">ACERVO</p><h1>Explore as obras</h1></div>
            <p>Filtre por título, autor e data de lançamento.</p>
          </section>
          <form className="archive-filters" onSubmit={(event) => event.preventDefault()}>
            <label>Obra<input value={catalogTitleFilter} onChange={(event) => setCatalogTitleFilter(event.target.value)} placeholder="Buscar título" /></label>
            <label>Autor<input value={catalogAuthorFilter} onChange={(event) => setCatalogAuthorFilter(event.target.value)} placeholder="Buscar autor" /></label>
            <label>Lançada a partir de<input type="date" value={catalogReleaseFilter} onChange={(event) => setCatalogReleaseFilter(event.target.value)} /></label>
          </form>
          <div className="archive-list">
            {filteredCatalogStories.map((story) => (
              <article className="archive-card" key={story.id}>
                <div>
                  <p className="eyebrow">{story.kind}</p>
                  <h2>{story.title}</h2>
                  <p>{story.synopsis}</p>
                  <small>Por {story.authorName || 'Autor independente'} · Lançamento {new Date(timestampValue(story.publishedAt || story.latestReleaseAt || story.updatedAt) || Date.now()).toLocaleDateString('pt-BR')}</small>
                </div>
                <div className="archive-actions">
                  <button onClick={() => toggleReaderFavorite('story', story.id, story.title)}>
                    {isReaderFavorite('story', story.id) ? '★ Favorita' : '☆ Favoritar obra'}
                  </button>
                  {story.authorName && (
                    <button onClick={() => toggleReaderFavorite('author', story.authorId || authorKey(story.authorName), story.authorName)}>
                      {isReaderFavorite('author', story.authorId || authorKey(story.authorName)) ? '★ Autor favorito' : '☆ Favoritar autor'}
                    </button>
                  )}
                  {story.volumes[0] && getVolumeChapters(story.volumes[0])[0] && (
                    <button onClick={() => openChapter(story.id, story.volumes[0], getVolumeChapters(story.volumes[0])[0], story)}>Abrir obra</button>
                  )}
                </div>
              </article>
            ))}
            {filteredCatalogStories.length === 0 && <p className="empty">Nenhuma obra corresponde aos filtros.</p>}
          </div>
        </main>
      ) : area === 'favorites' ? (
        <main className="reader-layout favorites-layout">
          <section className="section-heading">
            <div><p className="eyebrow">CONTEXTO LEITOR</p><h1>Meus favoritos</h1></div>
            <p>Obras salvas e autores acompanhados.</p>
          </section>
          <section className="panel-section">
            <h2>Autores favoritos</h2>
            {readerFavorites.filter((favorite) => favorite.type === 'author').map((favorite) => (
              <article className="favorite-row" key={favorite.id}>
                <strong>{favorite.targetName}</strong>
                <button onClick={() => toggleReaderFavorite('author', favorite.targetId, favorite.targetName)}>Deixar de seguir</button>
              </article>
            ))}
            {!readerFavorites.some((favorite) => favorite.type === 'author') && <p className="empty">Favorite autores no Acervo para receber novidades no Feed.</p>}
          </section>
          <section className="panel-section">
            <h2>Obras favoritas</h2>
            {readerFavorites.filter((favorite) => favorite.type === 'story').map((favorite) => {
              const story = publicStories.find((item) => String(item.id) === String(favorite.targetId))
              return (
                <article className="favorite-row" key={favorite.id}>
                  <div><strong>{story?.title || favorite.targetName}</strong><small>{story?.authorName || 'Obra salva'}</small></div>
                  <div>
                    {story?.volumes[0] && <button onClick={() => openChapter(story.id, story.volumes[0], getVolumeChapters(story.volumes[0])[0], story)}>Abrir</button>}
                    <button onClick={() => toggleReaderFavorite('story', favorite.targetId, favorite.targetName)}>Remover</button>
                  </div>
                </article>
              )
            })}
            {!readerFavorites.some((favorite) => favorite.type === 'story') && <p className="empty">Favorite obras no Feed ou no Acervo para encontrá-las aqui.</p>}
          </section>
        </main>
      ) : area === 'notifications' ? (
        <main className="reader-layout notifications-layout">
          <section className="section-heading">
            <div><p className="eyebrow">CENTRAL DE NOTIFICAÇÕES</p><h1>Pedidos de revisão</h1></div>
            <p>As solicitações são entregues dentro do site para a conta que usa o e-mail indicado.</p>
          </section>
          {reviewRequests.length === 0 ? <p className="empty">Você não tem pedidos de revisão.</p> : reviewRequests.map((request) => {
            const isIncoming = request.recipientEmail === authUser?.email?.toLowerCase()
            return (
              <article className="review-request-card" key={request.id}>
                <details>
                  <summary>
                    <span>{isIncoming ? 'Pedido recebido' : 'Pedido enviado'} · {request.storyTitle} · {request.draftTitle}</span>
                    <small>Status: {request.status === 'pending' ? 'aguardando resposta' : request.status === 'accepted' ? 'aceito' : request.status === 'declined' ? 'recusado' : 'revisão concluída'}</small>
                  </summary>
                  <p>{isIncoming ? `${request.senderName} (${request.senderEmail}) pediu uma revisão.` : `Enviado para ${request.recipientEmail}.`}</p>
                  <p><strong>Saga:</strong> {request.storyTitle}</p>
                  <pre className="review-request-content">{request.content}</pre>
                  {isIncoming && request.status === 'pending' && (
                    <div className="review-request-actions">
                      <button onClick={() => respondToReviewRequest(request.id, { status: 'accepted' })}>Aceitar revisão</button>
                      <button onClick={() => respondToReviewRequest(request.id, { status: 'declined' })}>Recusar</button>
                    </div>
                  )}
                  {isIncoming && request.status === 'accepted' && (
                    <form className="review-response-form" onSubmit={(event) => completeReview(event, request)}>
                      <label htmlFor={`feedback-${request.id}`}>Sua revisão para o autor</label>
                      <textarea id={`feedback-${request.id}`} name="feedback" maxLength={5000} required />
                      <button type="submit">Enviar revisão</button>
                    </form>
                  )}
                  {request.status === 'completed' && <div className="review-feedback"><strong>Resposta do revisor</strong><p>{request.feedback}</p></div>}
                </details>
              </article>
            )
          })}
          <p className="notification-email-note">Aviso: por enquanto as notificações são somente no site; nenhum e-mail externo é enviado.</p>
        </main>
      ) : area === 'publishQueue' && ownerUnlocked ? (
        <main className="reader-layout publish-queue-layout">
          <section className="section-heading">
            <div><p className="eyebrow">CONTEXTO AUTOR</p><h1>Para publicar</h1></div>
            <p>Conteúdo privado em preparação. Agende a data ou deixe sem data até decidir publicar.</p>
          </section>
          {queuedPublicationItems.length === 0 ? <p className="empty">Nenhum conteúdo está aguardando publicação.</p> : queuedPublicationItems.map((item) => {
            const queuedChapter = item.type === 'chapter'
              ? item.chapter
              : getVolumeChapters(item.volume).find((chapter) => !chapter.legacy)
            const status = item.type === 'volume' ? item.volume.status : item.chapter.status
            const publishDate = item.type === 'volume' ? item.volume.publishAt : item.chapter.publishAt
            return (
              <article className="queued-publication" key={`${item.type}-${item.story.id}-${item.volume.id}-${item.chapter?.id || ''}`}>
                <div>
                  <p className="eyebrow">{item.story.kind} · {item.story.title}</p>
                  <h2>{item.type === 'volume' ? item.volume.title : item.chapter.title}</h2>
                  <p>{item.type === 'volume' ? 'Volume' : `Volume ${item.volume.number} · Capítulo ${item.chapter.number}`} · {status === 'pending_review' ? 'aguardando revisão' : status === 'scheduled' ? 'agendado' : 'sem data definida'}</p>
                  {publishDate && <small>Publicação: {new Date(timestampValue(publishDate)).toLocaleString('pt-BR')}</small>}
                  {queuedChapter?.reviewNotes && <details className="ai-review-notes"><summary>Ver revisão da IA</summary><pre>{queuedChapter.reviewNotes}</pre></details>}
                </div>
                <div className="queued-publication-actions">
                  {queuedChapter && (
                    <button type="button" onClick={() => openChapter(item.story.id, item.volume, queuedChapter, item.story)}>Visualizar</button>
                  )}
                  <form onSubmit={(event) => saveQueueSchedule(event, item)}>
                    <label>Data e hora (vazio = sem agendamento)<input type="datetime-local" name="publishAt" defaultValue={dateTimeLocalValue(publishDate)} /></label>
                    <button type="submit">Salvar data</button>
                  </form>
                  <button type="button" className="publish-button" onClick={() => publishQueuedItem(item)}>Publicar agora</button>
                </div>
              </article>
            )
          })}
        </main>
      ) : area === 'library' ? (
        <main className="reader-layout personal-library">
          <section className="section-heading">
            <div><p className="eyebrow">CONTEXTO LEITOR</p><h1>Minha biblioteca</h1></div>
            <p>Histórias publicadas, organizadas por saga, volume e capítulo.</p>
          </section>
          {publicStories.length === 0 ? <p className="empty">Nenhuma história publicada está disponível.</p> : publicStories.map((story) => (
            <section className="library-saga panel-section" key={story.id}>
              <p className="eyebrow">{story.kind}</p>
              <h2>{story.title}</h2>
              {story.authorName && <small className="author-byline">Por {story.authorName}</small>}
              <p>{story.synopsis}</p>
              {story.volumes.length === 0 ? <p className="empty">Nenhum volume publicado.</p> : story.volumes.map((volume) => (
                <details className="library-volume" key={volume.id} open>
                  <summary>{volume.medium === 'video' ? 'Temporada' : volume.medium === 'book' ? 'Livro' : 'Mangá'} {volume.number}: {volume.title}</summary>
                  <div className="library-chapters">
                    {getVolumeChapters(volume).map((chapter) => (
                      <button key={chapter.id} onClick={() => openChapter(story.id, volume, chapter, story)}>
                        <span>Capítulo {chapter.number}: {chapter.title}</span>
                        <small>{volume.medium === 'video' ? 'episódio' : `${chapter.pageCount || 1} página(s)`}</small>
                      </button>
                    ))}
                  </div>
                </details>
              ))}
            </section>
          ))}
        </main>
      ) : area === 'profile' ? (
        <main className="owner-layout account-layout">
          <section className="panel-section account-profile">
            <p className="eyebrow">CONTEXTO AUTOR</p>
            <h1>Perfil de autor</h1>
            <p>Escolha como seu nome aparece nos rascunhos e nas futuras publicações.</p>
            <form className="profile-form" onSubmit={saveProfile}>
              <label htmlFor="author-name">Nome de autor</label>
              <input
                id="author-name"
                value={profile?.authorName || ''}
                onChange={(event) => setProfile((current) => ({ ...current, authorName: event.target.value }))}
                maxLength={80}
                minLength={2}
                disabled={!profile}
                required
              />
              <button type="submit" disabled={!profile}>Salvar perfil</button>
            </form>
          </section>

          <section className="panel-section">
            <p className="eyebrow">ESPAÇO PRIVADO</p>
            <h2>Salvar um rascunho</h2>
            <form className="writing-form" onSubmit={saveDraft}>
              <select value={writingStoryId} onChange={(event) => { setWritingStoryId(event.target.value); setWritingVolumeId('') }} aria-label="Saga do rascunho">
                <option value="">Sem saga definida</option>
                {stories.map((story) => <option value={story.id} key={story.id}>{story.title}</option>)}
              </select>
              <select value={writingVolumeId} onChange={(event) => setWritingVolumeId(event.target.value)} aria-label="Volume do rascunho" disabled={!writingStoryId}>
                <option value="">Novo volume</option>
                {(stories.find((item) => String(item.id) === String(writingStoryId))?.volumes || []).map((volume) => (
                  <option value={volume.id} key={volume.id}>{volume.title}</option>
                ))}
              </select>
              {!writingVolumeId && writingStoryId && (
                <>
                  <select value={writingMedium} onChange={(event) => setWritingMedium(event.target.value)} aria-label="Tipo do volume do rascunho">
                    <option value="book">Livro</option>
                    <option value="manga">Mangá</option>
                    <option value="video">Temporada de vídeos</option>
                  </select>
                  <input value={writingVolumeTitle} onChange={(event) => setWritingVolumeTitle(event.target.value)} placeholder="Título do livro, mangá ou temporada" />
                </>
              )}
              <input value={writingTitle} onChange={(event) => setWritingTitle(event.target.value)} placeholder="Título do capítulo" required />
              {writingContentMedium === 'video' ? (
                <input type="url" value={writingText} onChange={(event) => setWritingText(event.target.value)} placeholder="URL HTTPS direta do episódio (MP4/WebM)" aria-label="URL do episódio" required />
              ) : (
                <textarea value={writingText} onChange={(event) => setWritingText(event.target.value)} placeholder="Escreva aqui e separe as páginas por uma linha em branco." aria-label="Texto do rascunho" required />
              )}
              <div className="writing-actions"><button type="submit" className="publish-button">Salvar rascunho</button></div>
            </form>
          </section>

          <section className="panel-section">
            <div className="drafts-title"><div><p className="eyebrow">CONTEXTO AUTOR</p><h2>Meus rascunhos</h2></div><span>{drafts.length} salvos</span></div>
            {drafts.length === 0 ? (
              <p className="empty">Seus rascunhos privados aparecerão aqui.</p>
            ) : drafts.map((draft) => (
              <article className="draft-item" key={draft.id}>
                <div><strong>{draft.title}</strong><small>Salvo em {new Date(draft.updatedAt).toLocaleString('pt-BR')}</small></div>
                <div>
                  <button type="button" onClick={() => resumeDraft(draft)}>Continuar escrevendo</button>
                  <button type="button" onClick={() => queueDraft(draft)}>Para publicar</button>
                  <button type="button" onClick={() => deleteDraft(draft.id)}>Excluir</button>
                </div>
              </article>
            ))}
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

                <section className="panel-section">
                  <p className="eyebrow">IDENTIDADE VISUAL</p>
                  <h2>Personalizar uma saga</h2>
                  <form className="theme-editor" onSubmit={saveSagaTheme}>
                    <select
                      value={themeStoryId}
                      onChange={(event) => {
                        const nextStory = stories.find((item) => String(item.id) === event.target.value)
                        setThemeStoryId(event.target.value)
                        setThemePreset(nextStory?.theme?.preset || 'parchment')
                        setThemeBackground(nextStory?.theme?.background || '')
                      }}
                      aria-label="Saga para personalizar"
                      required
                    >
                      <option value="">Selecione uma saga</option>
                      {stories.map((story) => <option value={story.id} key={story.id}>{story.title}</option>)}
                    </select>
                    <select value={themePreset} onChange={(event) => setThemePreset(event.target.value)} aria-label="Paleta visual">
                      <option value="parchment">Pergaminho</option>
                      <option value="midnight">Meia-noite</option>
                      <option value="forest">Floresta</option>
                    </select>
                    <input
                      type="text"
                      value={themeBackground}
                      onChange={(event) => setThemeBackground(event.target.value)}
                      placeholder="URL HTTPS ou imagem carregada"
                      aria-label="URL da imagem de fundo da saga"
                    />
                    <label className="theme-image-upload">
                      Carregar imagem da saga (JPEG comprimido, até 700 KB)
                      <input type="file" accept="image/*" onChange={async (event) => {
                        const file = event.target.files?.[0]
                        if (!file) return
                        try {
                          setThemeBackground(await compressSagaImage(file))
                          setNotice('Imagem carregada e comprimida. Salve o visual para aplicá-la.')
                        } catch (error) {
                          setNotice(error instanceof Error ? error.message : 'Não foi possível carregar a imagem.')
                        }
                      }} />
                    </label>
                    <button type="submit" disabled={!themeStory}>Salvar visual da saga</button>
                  </form>
                </section>

                <section className="panel-section">
                  <p className="eyebrow">FEEDBACK POR LIVRO</p>
                  <h2>Sugestões ao fim do volume</h2>
                  {stories.flatMap((story) => story.volumes.map((volume) => (
                    <label className="review-toggle" key={`${story.id}-${volume.id}`}>
                      <input
                        type="checkbox"
                        checked={Boolean(volume.reviewEnabled)}
                        onChange={(event) => toggleVolumeReview(story.id, volume.id, event.target.checked)}
                      />
                      <span>{story.title} — Volume {volume.number}: {volume.title}</span>
                    </label>
                  )))}
                  {stories.every((story) => story.volumes.length === 0) && <p className="empty">Publique um volume para habilitar sugestões por livro.</p>}
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
                    <select value={writingStoryId} onChange={(event) => { setWritingStoryId(event.target.value); setWritingVolumeId('') }} aria-label="História">
                      <option value="">Selecione uma história para publicar...</option>
                      {stories.map((story) => <option value={story.id} key={story.id}>{story.title}</option>)}
                    </select>
                    <select
                      value={writingVolumeId}
                      onChange={(event) => setWritingVolumeId(event.target.value)}
                      aria-label="Volume"
                      disabled={!writingStoryId}
                    >
                      <option value="">Criar novo volume</option>
                      {(stories.find((item) => String(item.id) === String(writingStoryId))?.volumes || []).map((volume) => (
                        <option value={volume.id} key={volume.id}>{volume.medium === 'video' ? 'Temporada' : volume.medium === 'book' ? 'Livro' : 'Mangá'} {volume.number}: {volume.title}</option>
                      ))}
                    </select>
                    {!writingVolumeId && (
                      <>
                        <select value={writingMedium} onChange={(event) => setWritingMedium(event.target.value)} aria-label="Tipo do volume">
                          <option value="book">Livro</option>
                          <option value="manga">Mangá</option>
                          <option value="video">Temporada de vídeos</option>
                        </select>
                        <input value={writingVolumeTitle} onChange={(event) => setWritingVolumeTitle(event.target.value)} placeholder="Título do livro, mangá ou temporada" required />
                      </>
                    )}
                    <input value={writingTitle} onChange={(event) => setWritingTitle(event.target.value)} placeholder="Título do capítulo" required />
                    {writingContentMedium === 'video' ? (
                      <input type="url" value={writingText} onChange={(event) => setWritingText(event.target.value)} placeholder="URL HTTPS direta do episódio (MP4/WebM)" aria-label="URL do episódio" required />
                    ) : (
                      <textarea
                        value={writingText}
                        onChange={(event) => setWritingText(event.target.value)}
                        placeholder="Comece a escrever aqui. Separe as páginas por uma linha em branco."
                        aria-label="Texto da história"
                        required
                      />
                    )}
                    <div className="writing-actions">
                      <button type="submit" className="secondary-button">Salvar para depois</button>
                      <button type="button" className="publish-button" onClick={() => setPublishDialogOpen(true)}>Publicar</button>
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
                          <button type="button" onClick={() => queueDraft(draft)}>Para publicar</button>
                          <button type="button" onClick={() => deleteDraft(draft.id)}>Excluir</button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="panel-section ai-assistant">
                  <div>
                    <p className="eyebrow">ASSISTENTE DE TEXTO</p>
                    <h2>Analisar e criar conceito</h2>
                  </div>
                  <textarea value={studioText} onChange={(event) => setStudioText(event.target.value)} placeholder="Cole o texto autoral, manuscrito ou sinopse..." />
                  <textarea value={comicPrompt} onChange={(event) => setComicPrompt(event.target.value)} placeholder="Opcional: peça um conceito, roteiro de páginas ou análise de continuidade..." />
                  <label className="assistant-file">
                    Arquivo opcional (TXT, Markdown, DOCX ou PDF; até 20 MB)
                    <input
                      type="file"
                      accept=".txt,.md,.docx,.pdf"
                      onChange={(event) => setAssistantFile(event.target.files?.[0] || null)}
                    />
                  </label>
                  {assistantFile && <small className="assistant-file-name">Selecionado: {assistantFile.name}</small>}
                  <label className="ai-consent">
                    <input type="checkbox" checked={assistantConsent} onChange={(event) => setAssistantConsent(event.target.checked)} />
                    <span>Concordo em enviar este texto/arquivo ao Google para análise pela IA. O arquivo não será salvo no site.</span>
                  </label>
                  <p className="ai-disclosure">Usa Gemini 4 Hydrogen via Firebase AI Logic. A análise cria texto e conceitos; não gera imagens. Requer App Check e respeita as cotas gratuitas do serviço.</p>
                  <button type="button" onClick={analyzeWithGemini} disabled={assistantBusy}>
                    {assistantBusy ? 'Analisando...' : 'Analisar com Gemini'}
                  </button>
                  {assistantResult && (
                    <div className="assistant-result">
                      <h3>Resultado para revisão</h3>
                      <pre>{assistantResult}</pre>
                      <button type="button" onClick={() => setStudioText((text) => `${text}${text ? '\n\n' : ''}${assistantResult}`)}>Adicionar ao texto de trabalho</button>
                    </div>
                  )}
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

      {publishDialogOpen && (
        <div className="publish-modal" role="dialog" aria-modal="true" aria-label="Opções de publicação">
          <form className="publish-dialog" onSubmit={confirmPublication}>
            <button type="button" className="auth-close" onClick={() => setPublishDialogOpen(false)} aria-label="Fechar">×</button>
            <p className="eyebrow">REVISÃO E PUBLICAÇÃO</p>
            <h2>Como deseja publicar?</h2>
            <label>
              Revisão
              <select value={publishReviewMethod} onChange={(event) => {
                setPublishReviewMethod(event.target.value)
                if (event.target.value !== 'none') setPublishDestination('queue')
              }}>
                <option value="none">Publicar sem revisão</option>
                <option value="ai">Solicitar revisão por IA</option>
                <option value="reviewer">Encaminhar para um revisor do site</option>
              </select>
            </label>
            {publishReviewMethod === 'none' ? (
              <>
                <label>
                  Quando publicar?
                  <select value={publishDestination} onChange={(event) => setPublishDestination(event.target.value)}>
                    <option value="now">Publicar agora</option>
                    <option value="queue">Deixar em Para publicar, sem data</option>
                    <option value="schedule">Agendar data e hora</option>
                  </select>
                </label>
                {publishDestination === 'schedule' && (
                  <label>Data e hora<input type="datetime-local" value={publishAt} onChange={(event) => setPublishAt(event.target.value)} required /></label>
                )}
              </>
            ) : publishReviewMethod === 'ai' ? (
              <>
                <label className="ai-consent">
                  <input type="checkbox" checked={assistantConsent} onChange={(event) => setAssistantConsent(event.target.checked)} />
                  <span>Autorizo enviar o texto deste capítulo ao Google Gemini para revisão editorial.</span>
                </label>
                <p>A análise será salva em Para publicar. Você decide quando liberar o capítulo.</p>
              </>
            ) : (
              <>
                <label>E-mail cadastrado do revisor<input type="email" value={reviewerEmail} onChange={(event) => setReviewerEmail(event.target.value)} maxLength={254} required /></label>
                <p>O pedido aparecerá na central de notificações da conta que usa esse e-mail. O conteúdo ficará privado enquanto aguarda revisão.</p>
              </>
            )}
            <div className="publish-dialog-actions">
              <button type="button" onClick={() => setPublishDialogOpen(false)}>Cancelar</button>
              <button type="submit" className="publish-button" disabled={publishBusy}>
                {publishBusy ? 'Processando...' : publishReviewMethod === 'none' ? 'Confirmar' : 'Enviar para revisão'}
              </button>
            </div>
          </form>
        </div>
      )}

      {selectedVolume && (
        <div className="reader-modal" role="dialog" aria-modal="true" aria-label={`Leitor de ${selectedVolume.title}`}>
          <button className="reader-close" onClick={() => { setSelectedVolume(null); setSelectedChapter(null) }} aria-label="Voltar à biblioteca">×</button>
          <div className="reader-toolbar">
            <div className="reader-work-meta">
              <strong>{selectedVolume.sagaTitle}</strong>
              <span>{selectedVolume.authorName ? `Por ${selectedVolume.authorName} · ` : ''}{selectedVolume.medium === 'video' ? 'Temporada' : selectedVolume.medium === 'book' ? 'Livro' : 'Mangá'} {selectedVolume.number}: {selectedVolume.title}</span>
            </div>
            <div className="reader-mode-options" role="group" aria-label="Modo de leitura">
              <button className={readerMode === 'book' ? 'selected' : ''} onClick={() => setReaderMode('book')} aria-pressed={readerMode === 'book'}>Livro aberto</button>
              <button className={readerMode === 'kindle' ? 'selected' : ''} onClick={() => setReaderMode('kindle')} aria-pressed={readerMode === 'kindle'}>Estilo Kindle</button>
            </div>
            {readerMode === 'kindle' && (
              <div className="kindle-font-controls" aria-label="Tamanho do texto">
                <button onClick={() => setReaderFontSize((size) => Math.max(14, size - 2))} aria-label="Diminuir texto">A−</button>
                <button onClick={() => setReaderFontSize((size) => Math.min(32, size + 2))} aria-label="Aumentar texto">A+</button>
              </div>
            )}
          </div>
          <div
            className={`book ${readerMode === 'kindle' ? 'kindle-book' : ''}`}
            style={readerMode === 'kindle' && selectedVolume.storyTheme.background
              ? { backgroundImage: `linear-gradient(rgba(244, 239, 223, .92), rgba(244, 239, 223, .92)), url("${selectedVolume.storyTheme.background}")`, backgroundSize: 'cover' }
              : undefined}
          >
            {readerMode === 'book' && (
              <div className="book-page left-page">
                <span>Volume {selectedVolume.number}</span>
                <h2>{selectedChapter?.title || selectedVolume.title}</h2>
                <p>{authUser ? 'Leitura completa para leitores cadastrados.' : 'Prévia gratuita: cinco páginas do primeiro capítulo.'}</p>
                <small>Página {selectedPage + 1} de {readerPageCount}</small>
              </div>
            )}
            <div className={`book-page right-page ${readerMode === 'kindle' ? 'kindle-page' : ''}`}>
              {(!authUser && selectedPage >= 5) ? (
                <div className="login-gate">
                  <strong>Continue a leitura</strong>
                  <p>Esta foi a prévia gratuita de cinco páginas. Entre ou crie sua conta para continuar.</p>
                  <button onClick={openAuth}>Entrar ou cadastrar</button>
                  <button type="button" onClick={() => setSelectedPage((page) => page - 1)}>Voltar à página anterior</button>
                </div>
              ) : (
                <>
                  <div
                    className={`comic-preview ${readerMode === 'kindle' ? 'kindle-content' : ''}`}
                    style={readerMode === 'kindle' ? { fontSize: `${readerFontSize}px` } : undefined}
                  >
                    {readerMode === 'kindle' && (
                      <div className="kindle-heading">
                        <span>{selectedVolume.sagaTitle}</span>
                        <h1>{selectedChapter?.title || selectedVolume.title}</h1>
                        <small>{selectedVolume.authorName ? `Por ${selectedVolume.authorName} · ` : ''}Página {selectedPage + 1}</small>
                      </div>
                    )}
                    {selectedChapter?.pages?.[selectedPage]?.mediaType === 'video' && selectedChapter.pages[selectedPage].videoUrl ? (
                      <video className="comic-video" controls src={selectedChapter.pages[selectedPage].videoUrl}>
                        Seu navegador não consegue reproduzir este vídeo.
                      </video>
                    ) : selectedChapter?.pages?.[selectedPage]?.artSvg ? (
                      <img
                        className="comic-art"
                        src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(selectedChapter.pages[selectedPage].artSvg)}`}
                        alt={selectedChapter.pages[selectedPage].altText || `Página ${selectedPage + 1} de ${selectedChapter.title}`}
                      />
                    ) : (
                      <p>{selectedChapter?.pages?.[selectedPage]?.content || selectedChapter?.pages?.[selectedPage] || `Prévia de leitura de “${selectedChapter?.title || selectedVolume.title}”.`}</p>
                    )}
                  </div>
                  <div className="book-navigation">
                    <button disabled={selectedPage === 0} onClick={() => setSelectedPage((page) => page - 1)}>Anterior</button>
                    <button disabled={selectedPage >= readerPageCount - 1} onClick={() => setSelectedPage((page) => page + 1)}>Próxima</button>
                  </div>
                </>
              )}
            </div>
          </div>
          {selectedVolume.reviewEnabled && isBookEnd && (
            <section className="suggestion-section reader-suggestions">
              <div>
                <p className="eyebrow">FIM DO VOLUME</p>
                <h2>Compartilhe sua sugestão</h2>
                <p>O autor habilitou o envio de comentários para este livro.</p>
              </div>
              <form onSubmit={addSuggestion}>
                <input name="name" placeholder="Seu nome" defaultValue={profile?.authorName || authUser?.displayName || ''} />
                <textarea name="message" placeholder="Escreva sua sugestão..." required />
                <button type="submit">Enviar sugestão</button>
              </form>
            </section>
          )}
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
