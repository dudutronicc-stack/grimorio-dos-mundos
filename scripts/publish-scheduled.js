import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore'

const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID

if (!projectId) {
  throw new Error('Defina GOOGLE_CLOUD_PROJECT ou FIREBASE_PROJECT_ID antes de executar a publicação agendada.')
}

initializeApp({ credential: applicationDefault(), projectId })

const db = getFirestore()
const now = Timestamp.now()
const [scheduledVolumes, scheduledChapters] = await Promise.all([
  db.collectionGroup('volumes').where('status', '==', 'scheduled').get(),
  db.collectionGroup('chapters').where('status', '==', 'scheduled').get(),
])
let publishedVolumes = 0
let publishedChapters = 0

for (const volumeDocument of scheduledVolumes.docs) {
  const volume = volumeDocument.data()
  if (!volume.publishAt || volume.publishAt.toMillis() > now.toMillis()) continue

  const chaptersSnapshot = await volumeDocument.ref.collection('chapters').get()
  if (chaptersSnapshot.size > 450) {
    throw new Error(`O volume ${volumeDocument.ref.path} tem capítulos demais para ser publicado em um único lote.`)
  }
  const chapters = chaptersSnapshot.docs
    .map((chapterDocument) => ({ ref: chapterDocument.ref, ...chapterDocument.data() }))
    .filter((chapter) => ['pending', 'scheduled'].includes(chapter.status))
    .sort((left, right) => (Number(left.number) || 0) - (Number(right.number) || 0))
  const storyRef = volumeDocument.ref.parent.parent
  if (!storyRef) throw new Error(`Não foi possível localizar a saga do volume ${volumeDocument.ref.path}.`)

  const batch = db.batch()
  batch.update(volumeDocument.ref, {
    status: 'published',
    publishAt: FieldValue.delete(),
    publishedAt: FieldValue.serverTimestamp(),
  })
  chaptersSnapshot.docs.forEach((chapterDocument) => {
    if (['pending', 'scheduled'].includes(chapterDocument.data().status)) {
      batch.update(chapterDocument.ref, {
        status: 'published',
        publishAt: FieldValue.delete(),
        publishedAt: FieldValue.serverTimestamp(),
      })
    }
  })
  batch.update(storyRef, {
    latestReleaseAt: FieldValue.serverTimestamp(),
    latestReleaseVolumeId: volumeDocument.id,
    latestReleaseChapterId: chapters.length ? chapters[chapters.length - 1].ref.id : '',
    latestReleaseTitle: volume.title,
    latestReleaseType: 'volume',
  })
  await batch.commit()
  publishedVolumes += 1
}

for (const chapterDocument of scheduledChapters.docs) {
  const chapterSnapshot = await chapterDocument.ref.get()
  if (!chapterSnapshot.exists() || chapterSnapshot.data().status !== 'scheduled') continue
  const chapter = chapterSnapshot.data()
  if (!chapter.publishAt || chapter.publishAt.toMillis() > now.toMillis()) continue

  const volumeRef = chapterDocument.ref.parent.parent
  const storyRef = volumeRef?.parent.parent
  if (!volumeRef || !storyRef) throw new Error(`Não foi possível localizar a saga e o volume de ${chapterDocument.ref.path}.`)
  const volumeSnapshot = await volumeRef.get()
  if (!volumeSnapshot.exists() || volumeSnapshot.data().status !== 'published') continue

  const batch = db.batch()
  batch.update(chapterDocument.ref, {
    status: 'published',
    publishAt: FieldValue.delete(),
    publishedAt: FieldValue.serverTimestamp(),
  })
  batch.update(volumeRef, {
    chapters: FieldValue.increment(1),
    pageCount: FieldValue.increment(chapter.pageCount || 1),
  })
  batch.update(storyRef, {
    latestReleaseAt: FieldValue.serverTimestamp(),
    latestReleaseVolumeId: volumeRef.id,
    latestReleaseChapterId: chapterDocument.id,
    latestReleaseTitle: chapter.title,
    latestReleaseType: 'chapter',
  })
  await batch.commit()
  publishedChapters += 1
}

console.log(`Publicação agendada concluída: ${publishedVolumes} volume(s) e ${publishedChapters} capítulo(s).`)
