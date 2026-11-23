import assert from 'node:assert/strict'
import test from 'node:test'
import { initialChapter, initialStory, initialVolume } from './initialChapter.js'

test('models the first story as a saga, manga volume, and chapter', () => {
  assert.equal(initialStory.title, 'Crônicas da Nova Aurora')
  assert.equal(initialVolume.medium, 'manga')
  assert.equal(initialVolume.chapterList[0].title, 'Será um bruxo?')
  assert.equal(initialChapter.pages.length, 10)
  assert.equal(initialChapter.pages.every((page) => page.artSvg.startsWith('<svg')), true)
  assert.equal(initialChapter.pages.some((page) => /Harry Potter/i.test(page.artSvg)), false)
})
