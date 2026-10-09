const legacyColorModeKey = 'cframe-color-mode'
const colorModeKey = 'kid-growth-timeline-color-mode'

export default defineNuxtPlugin({
  name: 'kid-growth-timeline-storage-key-migration',
  enforce: 'pre',
  setup() {
    const oldValue = localStorage.getItem(legacyColorModeKey)
    if (oldValue && !localStorage.getItem(colorModeKey)) {
      localStorage.setItem(colorModeKey, oldValue)
    }
    localStorage.removeItem(legacyColorModeKey)
  },
})
