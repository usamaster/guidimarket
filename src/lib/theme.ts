const STORAGE_KEY = 'guidimarket-theme'

export type ThemeMode = 'light' | 'dark'

export function getStoredTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'dark' || v === 'light') return v
  } catch {
    void 0
  }
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
  return 'light'
}

export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement
  if (mode === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    void 0
  }
  window.dispatchEvent(new Event('themechange'))
}

export function toggleTheme(): ThemeMode {
  const next: ThemeMode = document.documentElement.classList.contains('dark') ? 'light' : 'dark'
  applyTheme(next)
  return next
}
