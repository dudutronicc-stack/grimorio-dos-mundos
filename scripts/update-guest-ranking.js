import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID

if (!projectId) {
  throw new Error('Defina GOOGLE_CLOUD_PROJECT ou FIREBASE_PROJECT_ID antes de executar o ranking.')
}

initializeApp({ credential: applicationDefault(), projectId })

const db = getFirestore()
const storiesSnapshot = await db.collection('stories').where('status', '==', 'published').get()
const updates = []
const ranking = []

for (const storyDocument of storiesSnapshot.docs) {
  const story = storyDocument.data()
  const volumesSnapshot = await storyDocument.ref.collection('volumes').where('status', '==', 'published').get()
  let likes = 0
  let hasGuestPreview = false

  for (const volumeDocument of volumesSnapshot.docs) {
    const volume = volumeDocument.data()
    const reactionsSnapshot = await volumeDocument.ref.collection('reactions').get()
    let volumeLikes = 0
    let volumeDislikes = 0

    reactionsSnapshot.forEach((reactionDocument) => {
      const reaction = reactionDocument.data().reaction
      if (reaction === 'like') volumeLikes += 1
      if (reaction === 'dislike') volumeDislikes += 1
    })

    likes += volumeLikes
    updates.push({
      ref: volumeDocument.ref,
      data: { likes: volumeLikes, dislikes: volumeDislikes },
    })

    if (Number(volume.number) !== 1) continue
    const chaptersSnapshot = await volumeDocument.ref.collection('chapters')
      .where('status', '==', 'published')
      .get()
    const firstChapter = chaptersSnapshot.docs.find((chapterDocument) => Number(chapterDocument.data().number) === 1)

    if (firstChapter) {
      const pagesSnapshot = await firstChapter.ref.collection('pages').limit(1).get()
      hasGuestPreview ||= !pagesSnapshot.empty
    } else {
      const legacyPagesSnapshot = await volumeDocument.ref.collection('pages').limit(1).get()
      hasGuestPreview ||= !legacyPagesSnapshot.empty
    }
  }

  updates.push({
    ref: storyDocument.ref,
    data: { likes },
  })

  if (hasGuestPreview) {
    const latestReleaseAt = story.latestReleaseAt?.toMillis?.() || story.publishedAt?.toMillis?.() || 0
    ranking.push({
      ref: storyDocument.ref,
      title: String(story.title || ''),
      likes,
      latestReleaseAt,
    })
  }
}

ranking.sort((left, right) => (
  right.likes - left.likes
  || right.latestReleaseAt - left.latestReleaseAt
  || left.title.localeCompare(right.title, 'pt-BR')
))

const featuredStories = new Map(ranking.slice(0, 5).map((story, index) => [story.ref.path, index + 1]))
const rankingUpdatedAt = FieldValue.serverTimestamp()
storiesSnapshot.docs.forEach((storyDocument) => {
  const rank = featuredStories.get(storyDocument.ref.path) || null
  updates.push({
    ref: storyDocument.ref,
    data: {
      guestPreview: rank !== null,
      guestPreviewRank: rank,
      rankingUpdatedAt,
    },
  })
})

const mergedUpdates = new Map()
updates.forEach(({ ref, data }) => {
  const existing = mergedUpdates.get(ref.path)
  mergedUpdates.set(ref.path, { ref, data: { ...existing?.data, ...data } })
})
const uniqueUpdates = [...mergedUpdates.values()]

for (let offset = 0; offset < uniqueUpdates.length; offset += 400) {
  const batch = db.batch()
  uniqueUpdates.slice(offset, offset + 400).forEach(({ ref, data }) => batch.set(ref, data, { merge: true }))
  await batch.commit()
}

console.log(`Ranking semanal atualizado: ${featuredStories.size} obras em destaque entre ${storiesSnapshot.size} publicadas.`)
