import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { firestoreDb } from './firebase'

function requireDatabase() {
  if (!firestoreDb) throw new Error('Firebase não está configurado.')
  return firestoreDb
}

export async function fetchStories(isCreator, uid) {
  const db = requireDatabase()
  const storiesQuery = isCreator
    ? collection(db, 'stories')
    : query(collection(db, 'stories'), where('status', '==', 'published'))
  const snapshot = await getDocs(storiesQuery)

  return Promise.all(snapshot.docs.map(async (storyDocument) => {
    const story = { id: storyDocument.id, ...storyDocument.data(), volumes: [] }
    const volumesQuery = isCreator
      ? collection(db, 'stories', storyDocument.id, 'volumes')
      : query(collection(db, 'stories', storyDocument.id, 'volumes'), where('status', '==', 'published'))
    const volumesSnapshot = await getDocs(volumesQuery)
    story.volumes = await Promise.all(volumesSnapshot.docs.map(async (volumeDocument) => {
      const volume = { id: volumeDocument.id, ...volumeDocument.data() }
      if (uid) {
        const reactionSnapshot = await getDoc(doc(db, 'stories', storyDocument.id, 'volumes', volumeDocument.id, 'reactions', uid))
        volume.userReaction = reactionSnapshot.exists() ? reactionSnapshot.data().reaction : null
      }
      return volume
    }))
    story.volumes.sort((left, right) => left.number - right.number)
    return story
  }))
}

export async function fetchVolumePages(storyId, volumeId, isSignedIn) {
  const db = requireDatabase()
  const pagesCollection = collection(db, 'stories', String(storyId), 'volumes', String(volumeId), 'pages')
  const pagesQuery = isSignedIn
    ? pagesCollection
    : query(pagesCollection, where('pageNumber', '<=', 4))
  const snapshot = await getDocs(pagesQuery)
  return snapshot.docs
    .map((pageDocument) => pageDocument.data())
    .sort((left, right) => left.pageNumber - right.pageNumber)
    .map((page) => page.content)
}

export async function persistStory(story) {
  const db = requireDatabase()
  await setDoc(doc(db, 'stories', String(story.id)), {
    title: story.title,
    kind: story.kind,
    synopsis: story.synopsis,
    cover: story.cover || '',
    status: 'published',
    updatedAt: serverTimestamp(),
  })
}

export async function persistVolume(storyId, volume) {
  const db = requireDatabase()
  const batch = writeBatch(db)
  const volumeRef = doc(db, 'stories', String(storyId), 'volumes', String(volume.id))
  const { pages = [], ...metadata } = volume
  batch.set(volumeRef, {
    ...metadata,
    status: 'published',
    watermark: 'Eduardo Henrique',
  })
  pages.forEach((content, index) => {
    const pageRef = doc(collection(volumeRef, 'pages'), String(index + 1).padStart(4, '0'))
    batch.set(pageRef, { pageNumber: index + 1, content })
  })
  await batch.commit()
}

export async function fetchDrafts(uid) {
  const db = requireDatabase()
  const snapshot = await getDocs(collection(db, 'users', uid, 'drafts'))
  return snapshot.docs
    .map((draftDocument) => ({ id: draftDocument.id, ...draftDocument.data() }))
    .sort((left, right) => right.updatedAt - left.updatedAt)
}

export async function persistDraft(uid, draft) {
  const db = requireDatabase()
  await setDoc(doc(db, 'users', uid, 'drafts', String(draft.id)), {
    storyId: draft.storyId || '',
    title: draft.title,
    text: draft.text,
    updatedAt: Date.now(),
  })
}

export async function removeDraft(uid, draftId) {
  const db = requireDatabase()
  await deleteDoc(doc(db, 'users', uid, 'drafts', String(draftId)))
}

export async function createSuggestion(uid, name, message) {
  const db = requireDatabase()
  const suggestion = await addDoc(collection(db, 'suggestions'), {
    uid,
    name,
    message,
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

export async function fetchUserRole(uid) {
  const db = requireDatabase()
  const snapshot = await getDoc(doc(db, 'users', uid))
  return snapshot.exists() ? snapshot.data().role : 'reader'
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
