import './style.css'

interface Shortcut {
  name: string
  url: string
  icon: string
}

type Engine = 'bing' | 'google' | 'baidu'

const background = document.getElementById('background') as HTMLDivElement
const searchInput = document.getElementById('searchInput') as HTMLInputElement
const searchBtn = document.getElementById('searchBtn') as HTMLButtonElement
const suggestions = document.getElementById('suggestions') as HTMLDivElement
const shortcutsGrid = document.getElementById('shortcutsGrid') as HTMLDivElement
const addShortcutBtn = document.getElementById('addShortcutBtn') as HTMLButtonElement
const addModal = document.getElementById('addModal') as HTMLDivElement
const cancelBtn = document.getElementById('cancelBtn') as HTMLButtonElement
const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement
const shortcutNameInput = document.getElementById('shortcutName') as HTMLInputElement
const shortcutUrlInput = document.getElementById('shortcutUrl') as HTMLInputElement
const engineBtns = document.querySelectorAll('.engine-btn') as NodeListOf<HTMLButtonElement>

let currentEngine: Engine = 'bing'
let debounceTimer: number | null = null

const searchUrls: Record<Engine, string> = {
  bing: 'https://www.bing.com/search?q=',
  google: 'https://www.google.com/search?q=',
  baidu: 'https://www.baidu.com/s?wd='
}

async function loadBackground(): Promise<void> {
  try {
    const res = await fetch('https://bing.biturl.top/?resolution=UHD&format=json&index=0&mkt=zh-CN')
    const data = await res.json()
    if (data.url) {
      background.style.backgroundImage = `url(${data.url})`
    }
  } catch {
    background.style.backgroundImage = 'url(https://picsum.photos/1920/1080)'
  }
}

function search(query: string): void {
  if (!query.trim()) return
  window.open(searchUrls[currentEngine] + encodeURIComponent(query), '_blank')
}

function loadSuggestions(query: string): void {
  if (!query.trim()) {
    suggestions.classList.remove('visible')
    return
  }

  // 清理旧脚本
  const old = document.getElementById('sug-script')
  if (old) old.remove()

  const cb = 'sug_' + Date.now()
  const script = document.createElement('script')
  script.id = 'sug-script'

  window[cb] = (data: unknown) => {
    delete (window as any)[cb]
    script.remove()
    if (currentEngine === 'google') {
      const items = ((data as any)[1] || []).map((i: any[]) => i[0])
      showSuggestions(items)
    } else {
      showSuggestions((data as string[][])[1] || [])
    }
  }

  script.onerror = () => {
    delete (window as any)[cb]
    script.remove()
    suggestions.classList.remove('visible')
  }

  // 全部用 JSONP，彻底避免编码和跨域问题
  const urls: Record<Engine, string> = {
    bing: `https://api.bing.com/osjson.aspx?query=${encodeURIComponent(query)}`,
    google: `https://suggestqueries.google.com/complete/search?client=youtube&q=${encodeURIComponent(query)}&callback=${cb}`,
    baidu: `https://suggestion.baidu.com/su?wd=${encodeURIComponent(query)}&action=opensearch&cb=${cb}`
  }

  script.src = urls[currentEngine]
  document.body.appendChild(script)
}

function showSuggestions(items: string[]): void {
  if (items.length === 0) {
    suggestions.classList.remove('visible')
    return
  }

  suggestions.innerHTML = items.slice(0, 8).map(item =>
    `<div class="suggestion-item">${item}</div>`
  ).join('')
  suggestions.classList.add('visible')
}

engineBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    engineBtns.forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    currentEngine = btn.dataset.engine as Engine
  })
})

searchInput.addEventListener('focus', () => {
  background.classList.add('blur')
})

searchInput.addEventListener('blur', () => {
  setTimeout(() => {
    background.classList.remove('blur')
    suggestions.classList.remove('visible')
  }, 200)
})

searchInput.addEventListener('input', () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
  debounceTimer = window.setTimeout(() => {
    loadSuggestions(searchInput.value)
  }, 300)
})

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    search(searchInput.value)
  }
})

searchBtn.addEventListener('click', () => {
  search(searchInput.value)
})

suggestions.addEventListener('click', (e) => {
  const target = e.target as HTMLElement
  if (target.classList.contains('suggestion-item')) {
    searchInput.value = target.textContent || ''
    search(target.textContent || '')
  }
})

function loadShortcuts(): void {
  const saved = localStorage.getItem('shortcuts')
  const shortcuts: Shortcut[] = saved ? JSON.parse(saved) : [
    { name: 'GitHub', url: 'https://github.com', icon: 'G' },
    { name: 'YouTube', url: 'https://youtube.com', icon: 'Y' },
    { name: 'Twitter', url: 'https://twitter.com', icon: 'T' },
    { name: '知乎', url: 'https://zhihu.com', icon: '知' }
  ]
  renderShortcuts(shortcuts)
}

function renderShortcuts(shortcuts: Shortcut[]): void {
  shortcutsGrid.innerHTML = shortcuts.map(s => `
    <a href="${s.url}" class="shortcut-item" target="_blank">
      <div class="shortcut-icon">${s.icon}</div>
      <div class="shortcut-name">${s.name}</div>
    </a>
  `).join('')
}

addShortcutBtn.addEventListener('click', () => {
  addModal.classList.add('visible')
})

cancelBtn.addEventListener('click', () => {
  addModal.classList.remove('visible')
})

saveBtn.addEventListener('click', () => {
  const name = shortcutNameInput.value.trim()
  const url = shortcutUrlInput.value.trim()
  if (name && url) {
    const saved = localStorage.getItem('shortcuts')
    const shortcuts: Shortcut[] = saved ? JSON.parse(saved) : []
    shortcuts.push({ name, url, icon: name[0].toUpperCase() })
    localStorage.setItem('shortcuts', JSON.stringify(shortcuts))
    renderShortcuts(shortcuts)
    shortcutNameInput.value = ''
    shortcutUrlInput.value = ''
    addModal.classList.remove('visible')
  }
})

loadBackground()
loadShortcuts()
