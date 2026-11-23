import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { firestoreDb } from './firebase'

function requireDatabase() {
  if (!firestoreDb) throw new Error('Firebase não está configurado.')
  return firestoreDb
}

export async function fetchStories(isCreator, uid, isSignedIn) {
  const db = requireDatabase()
  const storiesCollection = collection(db, 'stories')
  const storiesQuery = isCreator
    ? storiesCollection
    : isSignedIn
      ? query(storiesCollection, where('status', '==', 'published'))
      : query(storiesCollection, where('status', '==', 'published'), where('guestPreview', '==', true))
  const snapshot = await getDocs(storiesQuery)

  return Promise.all(snapshot.docs.map(async (storyDocument) => {
    const story = { id: storyDocument.id, ...storyDocument.data(), volumes: [] }
    const volumesQuery = isCreator
      ? collection(db, 'stories', storyDocument.id, 'volumes')
      : query(collection(db, 'stories', storyDocument.id, 'volumes'), where('status', '==', 'published'))
    const volumesSnapshot = await getDocs(volumesQuery)
    story.volumes = await Promise.all(volumesSnapshot.docs.map(async (volumeDocument) => {
      const volume = { id: volumeDocument.id, ...volumeDocument.data() }
      const chaptersRef = collection(db, 'stories', storyDocument.id, 'volumes', volumeDocument.id, 'chapters')
      const chaptersQuery = isCreator
        ? chaptersRef
        : query(chaptersRef, where('status', '==', 'published'))
      const chaptersSnapshot = await getDocs(chaptersQuery)
      volume.chapterList = chaptersSnapshot.docs
        .map((chapterDocument) => ({ id: chapterDocument.id, ...chapterDocument.data() }))
        .sort((left, right) => left.number - right.number)
      if (volume.chapterList.length === 0) {
        volume.chapterList = [{
          id: 'legacy',
          number: 1,
          title: volume.title,
          pageCount: volume.pageCount || volume.chapters || 1,
          legacy: true,
        }]
      }
      if (uid) {
        const reactionSnapshot = await getDoc(doc(db, 'stories', storyDocument.id, 'volumes', volumeDocument.id, 'reactions', uid))
        volume.userReaction = reactionSnapshot.exists() ? reactionSnapshot.data().reaction : null
      }
      return volume
    }))
    story.volumes.sort((left, right) => left.number - right.number)
    if (!isCreator && !isSignedIn) {
      story.volumes = story.volumes.filter((volume) => volume.number === 1)
      story.volumes.forEach((volume) => {
        volume.chapterList = volume.chapterList.filter((chapter) => chapter.number === 1)
      })
    }
    return story
  })).then((stories) => stories.sort((left, right) => (left.guestPreviewRank || 0) - (right.guestPreviewRank || 0)))
}

export async function fetchChapterPages(storyId, volumeId, chapter, isSignedIn) {
  const db = requireDatabase()
  const pagesCollection = chapter.legacy
    ? collection(db, 'stories', String(storyId), 'volumes', String(volumeId), 'pages')
    : collection(db, 'stories', String(storyId), 'volumes', String(volumeId), 'chapters', String(chapter.id), 'pages')
  const pagesQuery = isSignedIn
    ? pagesCollection
    : query(pagesCollection, where('pageNumber', '<=', 5))
  const snapshot = await getDocs(pagesQuery)
  return snapshot.docs
    .map((pageDocument) => pageDocument.data())
    .sort((left, right) => left.pageNumber - right.pageNumber)
}

export async function persistChapter(storyId, volumeId, chapter, status = 'published', publishAt = '') {
  const db = requireDatabase()
  const batch = writeBatch(db)
  const storyRef = doc(db, 'stories', String(storyId))
  const chapterRef = doc(db, 'stories', String(storyId), 'volumes', String(volumeId), 'chapters', String(chapter.id))
  const volumeRef = doc(db, 'stories', String(storyId), 'volumes', String(volumeId))
  const { pages = [], ...metadata } = chapter
  batch.set(chapterRef, {
    ...metadata,
    status,
    ...(status === 'scheduled' && publishAt ? { publishAt: Timestamp.fromDate(new Date(publishAt)) } : {}),
  })
  if (status === 'published') {
    batch.update(volumeRef, {
      chapters: increment(1),
      pageCount: increment(chapter.pageCount || pages.length || 1),
    })
    batch.update(storyRef, {
      latestReleaseAt: serverTimestamp(),
      latestReleaseVolumeId: String(volumeId),
      latestReleaseChapterId: String(chapter.id),
      latestReleaseTitle: chapter.title,
    })
  }
  pages.forEach((page, index) => {
    const pageRef = doc(collection(chapterRef, 'pages'), String(index + 1).padStart(4, '0'))
    batch.set(pageRef, {
      ...(typeof page === 'string' ? { content: page } : page),
      pageNumber: index + 1,
    })
  })
  await batch.commit()
}

export async function persistStory(story) {
  const db = requireDatabase()
  await setDoc(doc(db, 'stories', String(story.id)), {
    title: story.title,
    kind: story.kind,
    synopsis: story.synopsis,
    cover: story.cover || '',
    authorName: story.authorName || '',
    authorId: story.authorId || '',
    theme: story.theme || {},
    guestPreview: story.guestPreview || false,
    guestPreviewRank: story.guestPreviewRank || null,
    status: 'published',
    publishedAt: story.publishedAt || serverTimestamp(),
    latestReleaseAt: serverTimestamp(),
    latestReleaseTitle: story.title,
    latestReleaseType: 'story',
    updatedAt: serverTimestamp(),
  })
}

export async function persistStoryTheme(storyId, theme) {
  const db = requireDatabase()
  await updateDoc(doc(db, 'stories', String(storyId)), {
    theme,
    updatedAt: serverTimestamp(),
  })
}

export async function persistVolumeReviewFlag(storyId, volumeId, reviewEnabled) {
  const db = requireDatabase()
  await updateDoc(doc(db, 'stories', String(storyId), 'volumes', String(volumeId)), {
    reviewEnabled,
    updatedAt: serverTimestamp(),
  })
}

export async function persistVolume(storyId, volume) {
  const db = requireDatabase()
  const batch = writeBatch(db)
  const storyRef = doc(db, 'stories', String(storyId))
  const volumeRef = doc(db, 'stories', String(storyId), 'volumes', String(volume.id))
  const { pages = [], chapterList = [], status = 'published', publishAt = '', ...metadata } = volume
  batch.set(volumeRef, {
    ...metadata,
    status,
    ...(status === 'scheduled' && publishAt ? { publishAt: Timestamp.fromDate(new Date(publishAt)) } : {}),
    watermark: 'Eduardo Henrique',
  })
  if (status === 'published') {
    batch.update(storyRef, {
      latestReleaseAt: serverTimestamp(),
      latestReleaseVolumeId: String(volume.id),
      latestReleaseChapterId: String(chapterList.length ? chapterList[chapterList.length - 1].id : ''),
      latestReleaseTitle: volume.title,
      latestReleaseType: 'volume',
    })
  }
  pages.forEach((page, index) => {
    const pageRef = doc(collection(volumeRef, 'pages'), String(index + 1).padStart(4, '0'))
    batch.set(pageRef, {
      ...(typeof page === 'string' ? { content: page } : page),
      pageNumber: index + 1,
    })
  })
  chapterList.forEach((chapter) => {
    const { pages: chapterPages = [], ...chapterMetadata } = chapter
    const chapterRef = doc(collection(volumeRef, 'chapters'), String(chapter.id))
    const chapterStatus = chapterMetadata.status || status
    const { publishAt: chapterPublishAt, ...chapterData } = chapterMetadata
    batch.set(chapterRef, {
      ...chapterData,
      status: chapterStatus,
      ...(chapterStatus === 'scheduled' && (chapterPublishAt || publishAt)
        ? { publishAt: Timestamp.fromDate(new Date(chapterPublishAt || publishAt)) }
        : {}),
    })
    chapterPages.forEach((page, index) => {
      const pageRef = doc(collection(chapterRef, 'pages'), String(index + 1).padStart(4, '0'))
      batch.set(pageRef, {
        ...(typeof page === 'string' ? { content: page } : page),
        pageNumber: index + 1,
      })
    })
  })
  await batch.commit()
}

export async function publishQueuedChapter(storyId, volumeId, chapterId) {
  const db = requireDatabase()
  const chapterRef = doc(db, 'stories', String(storyId), 'volumes', String(volumeId), 'chapters', String(chapterId))
  const chapterSnapshot = await getDoc(chapterRef)
  if (!chapterSnapshot.exists()) throw new Error('O capítulo não existe mais.')
  const chapter = chapterSnapshot.data()
  if (!['pending', 'scheduled', 'pending_review'].includes(chapter.status)) {
    throw new Error('O capítulo não está aguardando publicação.')
  }

  const batch = writeBatch(db)
  const volumeRef = doc(db, 'stories', String(storyId), 'volumes', String(volumeId))
  const storyRef = doc(db, 'stories', String(storyId))
  batch.update(chapterRef, {
    status: 'published',
    publishAt: deleteField(),
    publishedAt: serverTimestamp(),
  })
  batch.update(volumeRef, {
    chapters: increment(1),
    pageCount: increment(chapter.pageCount || 1),
  })
  batch.update(storyRef, {
    latestReleaseAt: serverTimestamp(),
    latestReleaseVolumeId: String(volumeId),
    latestReleaseChapterId: String(chapterId),
    latestReleaseTitle: chapter.title,
    latestReleaseType: 'chapter',
  })
  await batch.commit()
}

export async function publishQueuedVolume(storyId, volumeId) {
  const db = requireDatabase()
  const volumeRef = doc(db, 'stories', String(storyId), 'volumes', String(volumeId))
  const volumeSnapshot = await getDoc(volumeRef)
  if (!volumeSnapshot.exists()) throw new Error('O volume não existe mais.')
  const volume = volumeSnapshot.data()
  if (!['pending', 'scheduled', 'pending_review'].includes(volume.status)) {
    throw new Error('O volume não está aguardando publicação.')
  }

  const chaptersSnapshot = await getDocs(collection(volumeRef, 'chapters'))
  if (chaptersSnapshot.size > 450) throw new Error('O volume tem capítulos demais para esta operação em lote.')
  const chapters = chaptersSnapshot.docs
    .map((chapterDocument) => ({ id: chapterDocument.id, ...chapterDocument.data() }))
    .sort((left, right) => left.number - right.number)
  const publishableChapters = chapters.filter((chapter) => ['pending', 'scheduled'].includes(chapter.status))
  const batch = writeBatch(db)
  batch.update(volumeRef, {
    status: 'published',
    publishAt: deleteField(),
    publishedAt: serverTimestamp(),
  })
  chaptersSnapshot.docs.forEach((chapterDocument) => {
    if (['pending', 'scheduled'].includes(chapterDocument.data().status)) {
      batch.update(chapterDocument.ref, {
        status: 'published',
        publishAt: deleteField(),
        publishedAt: serverTimestamp(),
      })
    }
  })
  batch.update(doc(db, 'stories', String(storyId)), {
    latestReleaseAt: serverTimestamp(),
    latestReleaseVolumeId: String(volumeId),
    latestReleaseChapterId: String(publishableChapters.length ? publishableChapters[publishableChapters.length - 1].id : ''),
    latestReleaseTitle: volume.title,
    latestReleaseType: 'volume',
  })
  await batch.commit()
}

export async function setChapterSchedule(storyId, volumeId, chapterId, publishAt) {
  const db = requireDatabase()
  const chapterRef = doc(db, 'stories', String(storyId), 'volumes', String(volumeId), 'chapters', String(chapterId))
  await updateDoc(chapterRef, {
    status: publishAt ? 'scheduled' : 'pending',
    publishAt: publishAt ? Timestamp.fromDate(new Date(publishAt)) : deleteField(),
  })
}

export async function setVolumeSchedule(storyId, volumeId, publishAt) {
  const db = requireDatabase()
  const volumeRef = doc(db, 'stories', String(storyId), 'volumes', String(volumeId))
  const chaptersSnapshot = await getDocs(collection(volumeRef, 'chapters'))
  if (chaptersSnapshot.size > 450) throw new Error('O volume tem capítulos demais para esta operação em lote.')
  const batch = writeBatch(db)
  batch.update(volumeRef, {
    status: publishAt ? 'scheduled' : 'pending',
    publishAt: publishAt ? Timestamp.fromDate(new Date(publishAt)) : deleteField(),
  })
  chaptersSnapshot.docs.forEach((chapterDocument) => {
    if (['pending', 'scheduled'].includes(chapterDocument.data().status)) {
      batch.update(chapterDocument.ref, {
        status: publishAt ? 'scheduled' : 'pending',
        publishAt: publishAt ? Timestamp.fromDate(new Date(publishAt)) : deleteField(),
      })
    }
  })
  await batch.commit()
}

export async function createReviewRequest(uid, details) {
  const db = requireDatabase()
  const request = await addDoc(collection(db, 'reviewRequests'), {
    ...details,
    senderUid: uid,
    status: 'pending',
    createdAt: serverTimestamp(),
  })
  return request.id
}

export async function fetchReviewRequests(uid, email) {
  const db = requireDatabase()
  const [incoming, outgoing] = await Promise.all([
    getDocs(query(collection(db, 'reviewRequests'), where('recipientEmail', '==', email))),
    getDocs(query(collection(db, 'reviewRequests'), where('senderUid', '==', uid))),
  ])
  const requests = new Map()
  incoming.docs.concat(outgoing.docs).forEach((requestDocument) => {
    requests.set(requestDocument.id, { id: requestDocument.id, ...requestDocument.data() })
  })
  return [...requests.values()].sort((left, right) => (
    (right.createdAt?.toMillis?.() || 0) - (left.createdAt?.toMillis?.() || 0)
  ))
}

export async function updateReviewRequest(requestId, updates) {
  const db = requireDatabase()
  await updateDoc(doc(db, 'reviewRequests', String(requestId)), {
    ...updates,
    updatedAt: serverTimestamp(),
  })
}

export async function fetchDrafts(uid) {
  const db = requireDatabase()
  const snapshot = await getDocs(collection(db, 'users', uid, 'drafts'))
  return snapshot.docs
    .map((draftDocument) => ({ id: draftDocument.id, ...draftDocument.data() }))
    .sort((left, right) => right.updatedAt - left.updatedAt)
}

export async function fetchReaderFavorites(uid) {
  const db = requireDatabase()
  const snapshot = await getDocs(collection(db, 'users', uid, 'favorites'))
  return snapshot.docs.map((favoriteDocument) => ({
    id: favoriteDocument.id,
    ...favoriteDocument.data(),
  }))
}

export async function persistReaderFavorite(uid, favorite) {
  const db = requireDatabase()
  await setDoc(doc(db, 'users', uid, 'favorites', String(favorite.id)), {
    type: favorite.type,
    targetId: String(favorite.targetId),
    targetName: favorite.targetName,
    followedAt: serverTimestamp(),
  })
}

export async function removeReaderFavorite(uid, favoriteId) {
  const db = requireDatabase()
  await deleteDoc(doc(db, 'users', uid, 'favorites', String(favoriteId)))
}

export async function persistDraft(uid, draft) {
  const db = requireDatabase()
  await setDoc(doc(db, 'users', uid, 'drafts', String(draft.id)), {
    storyId: draft.storyId || '',
    volumeId: draft.volumeId || '',
    volumeTitle: draft.volumeTitle || '',
    medium: draft.medium || 'manga',
    title: draft.title,
    text: draft.text,
    updatedAt: Date.now(),
  })
}

export async function removeDraft(uid, draftId) {
  const db = requireDatabase()
  await deleteDoc(doc(db, 'users', uid, 'drafts', String(draftId)))
}

export async function createSuggestion(uid, name, message, context) {
  const db = requireDatabase()
  const suggestion = await addDoc(collection(db, 'suggestions'), {
    uid,
    name,
    message,
    storyId: String(context.storyId),
    volumeId: String(context.volumeId),
    chapterId: String(context.chapterId),
    createdAt: serverTimestamp(),
  })
  return suggestion.id
}

export async function fetchSuggestions() {
  const db = requireDatabase()
  const snapshot = await getDocs(collection(db, 'suggestions'))
  return snapshot.docs
    .map((suggestionDocument) => ({ id: suggestionDocument.id, ...suggestionDocument.data() }))
    .sort((left, right) => (right.createdAt?.toMillis?.() || 0) - (left.createdAt?.toMillis?.() || 0))
}

export async function fetchCharacters() {
  const db = requireDatabase()
  const snapshot = await getDocs(collection(db, 'characters'))
  return snapshot.docs.map((characterDocument) => ({ id: characterDocument.id, ...characterDocument.data() }))
}

export async function fetchUserProfile(uid, user) {
  const db = requireDatabase()
  const profileRef = doc(db, 'users', uid)
  let snapshot = await getDoc(profileRef)
  if (!snapshot.exists()) {
    await setDoc(profileRef, {
      role: 'reader',
      displayName: user.displayName || '',
      email: user.email || '',
      createdAt: serverTimestamp(),
    })
    snapshot = await getDoc(profileRef)
  }
  return snapshot.exists() ? snapshot.data() : {}
}

export async function persistUserProfile(uid, authorName) {
  const db = requireDatabase()
  await updateDoc(doc(db, 'users', uid), {
    authorName,
    updatedAt: serverTimestamp(),
  })
}

export async function persistCharacter(character) {
  const db = requireDatabase()
  await setDoc(doc(db, 'characters', String(character.id)), {
    name: character.name,
    role: character.role,
    note: character.note,
    updatedAt: serverTimestamp(),
  })
}

export async function persistReaction(storyId, volumeId, uid, reaction) {
  const db = requireDatabase()
  const reactionRef = doc(db, 'stories', String(storyId), 'volumes', String(volumeId), 'reactions', uid)
  if (!reaction) {
    await deleteDoc(reactionRef)
    return
  }
  await setDoc(reactionRef, { uid, reaction, updatedAt: Date.now() })
}
