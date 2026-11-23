export function getDeviceViewMode({ userAgent = '', platform = '', maxTouchPoints = 0 }) {
  const isMobileOS = /Android|iPhone|iPad|iPod/i.test(userAgent)
    || (platform === 'MacIntel' && maxTouchPoints > 1)

  return isMobileOS ? 'feed' : 'site'
}
