import assert from 'node:assert/strict'
import test from 'node:test'
import { getDeviceViewMode } from './viewMode.js'

test('uses the feed on Android and iOS devices', () => {
  assert.equal(getDeviceViewMode({ userAgent: 'Mozilla/5.0 (Linux; Android 14)' }), 'feed')
  assert.equal(getDeviceViewMode({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' }), 'feed')
  assert.equal(getDeviceViewMode({ platform: 'MacIntel', maxTouchPoints: 5 }), 'feed')
})

test('uses the blog layout in desktop browsers', () => {
  assert.equal(getDeviceViewMode({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }), 'site')
})
