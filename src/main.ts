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
const searchBox = document.querySelector('.search-box') as HTMLDivElement
const themeBtn = document.getElementById('themeBtn') as HTMLButtonElement
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
  const cacheName = 'jstart-wallpaper'
  const cacheKey = 'wallpaper-cache'

  // 1. 立即显示缓存壁纸
  const cached = localStorage.getItem(cacheKey)
  if (cached) {
    const { url } = JSON.parse(cached)
    try {
      const cache = await caches.open(cacheName)
      const response = await cache.match(url)
      if (response) {
        const blob = await response.blob()
        const blobUrl = URL.createObjectURL(blob)
        background.style.backgroundImage = `url(${blobUrl})`
        background.classList.add('loaded')
      }
    } catch {}
  }

  // 2. 获取今天的壁纸元数据
  try {
    const res = await fetch('https://bing.biturl.top/?resolution=UHD&format=json&index=0&mkt=zh-CN')
    const data = await res.json()
    if (!data.url) return

    const todayUrl = data.url
    const cachedData = cached ? JSON.parse(cached) : null

    // 3. 如果今天壁纸和缓存相同，已完成
    if (cachedData && cachedData.url === todayUrl) return

    // 4. 下载新壁纸
    const cache = await caches.open(cacheName)
    const imgRes = await fetch(todayUrl)
    await cache.put(todayUrl, imgRes.clone())

    // 5. 新壁纸下载完毕后淡入
    const blob = await imgRes.blob()
    const blobUrl = URL.createObjectURL(blob)

    // 确保图片预加载完成后再淡入
    const img = new Image()
    img.onload = () => {
      background.style.backgroundImage = `url(${blobUrl})`
      // 如果之前没loaded（无缓存），触发淡入
      if (!background.classList.contains('loaded')) {
        background.classList.add('loaded')
      }
    }
    img.src = blobUrl

    // 6. 更新缓存元数据
    localStorage.setItem(cacheKey, JSON.stringify({ url: todayUrl }))

    // 7. 清理旧缓存
    const keys = await cache.keys()
    for (const req of keys) {
      if (req.url !== todayUrl) {
        await cache.delete(req)
      }
    }
  } catch {
    // 网络失败，如果还没显示缓存，用纯色兜底
    if (!background.classList.contains('loaded')) {
      background.style.backgroundColor = '#1a1a2e'
      background.classList.add('loaded')
    }
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
    searchBox.classList.remove('has-suggestions')
  }

  if (currentEngine === 'google') {
    // Google 用 JSONP
    script.src = `https://suggestqueries.google.com/complete/search?client=youtube&q=${encodeURIComponent(query)}&callback=${cb}`
    document.body.appendChild(script)
  } else {
    // Bing / 百度 走代理 fetch
    const url = currentEngine === 'bing'
      ? `/sug/bing/osjson.aspx?query=${encodeURIComponent(query)}`
      : `/sug/baidu/su?wd=${encodeURIComponent(query)}&action=opensearch`

    const decoder = currentEngine === 'baidu'
      ? (r: Response) => r.arrayBuffer().then(b => new TextDecoder('gbk').decode(b))
      : (r: Response) => r.text()

    fetch(url)
      .then(decoder)
      .then(text => {
        const data = JSON.parse(text)
        showSuggestions(data[1] || [])
      })
      .catch(() => {
        suggestions.classList.remove('visible')
        searchBox.classList.remove('has-suggestions')
      })
  }
}

function showSuggestions(items: string[]): void {
  if (items.length === 0) {
    suggestions.classList.remove('visible')
    searchBox.classList.remove('has-suggestions')
    return
  }

  suggestions.innerHTML = items.slice(0, 8).map(item =>
    `<div class="suggestion-item">${item}</div>`
  ).join('')
  suggestions.classList.add('visible')
  searchBox.classList.add('has-suggestions')
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
    searchBox.classList.remove('has-suggestions')
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
  if (!saved) {
    localStorage.setItem('shortcuts', JSON.stringify(shortcuts))
  }
  renderShortcuts(shortcuts)
}

function getFaviconUrl(url: string): string {
  try {
    const domain = new URL(url).hostname
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
  } catch {
    return ''
  }
}

function renderShortcuts(shortcuts: Shortcut[]): void {
  shortcutsGrid.innerHTML = shortcuts.map((s, i) => `
    <div class="shortcut-item" data-index="${i}" draggable="true">
      <a href="${s.url}" class="shortcut-link" target="_blank">
        <div class="shortcut-icon">
          <img src="${getFaviconUrl(s.url)}" alt="${s.name}" loading="lazy">
        </div>
        <div class="shortcut-name">${s.name}</div>
      </a>
      <button class="shortcut-delete" data-index="${i}">×</button>
    </div>
  `).join('')
}

addShortcutBtn.addEventListener('click', () => {
  addModal.classList.add('visible')
})

let dragIndex: number | null = null
let dragStartPos = { x: 0, y: 0 }
let dragAllowed = false

shortcutsGrid.addEventListener('mousedown', (e) => {
  const target = e.target as HTMLElement
  if (target.classList.contains('shortcut-delete')) return
  dragStartPos = { x: e.clientX, y: e.clientY }
  dragAllowed = false
})

shortcutsGrid.addEventListener('mousemove', (e) => {
  if (e.buttons !== 1) return
  const dx = e.clientX - dragStartPos.x
  const dy = e.clientY - dragStartPos.y
  if (Math.abs(dx) + Math.abs(dy) > 5) {
    dragAllowed = true
  }
})

shortcutsGrid.addEventListener('dragstart', (e) => {
  if (!dragAllowed) {
    e.preventDefault()
    return
  }
  const item = (e.target as HTMLElement).closest('.shortcut-item') as HTMLElement | null
  if (!item) return
  dragIndex = parseInt(item.dataset.index || '0')
  item.classList.add('dragging')
  e.dataTransfer!.effectAllowed = 'move'
})

shortcutsGrid.addEventListener('dragover', (e) => {
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'move'
  const item = (e.target as HTMLElement).closest('.shortcut-item') as HTMLElement | null
  shortcutsGrid.querySelectorAll('.shortcut-item').forEach(el => el.classList.remove('drag-over'))
  if (item && parseInt(item.dataset.index || '0') !== dragIndex) {
    item.classList.add('drag-over')
  }
})

shortcutsGrid.addEventListener('dragleave', (e) => {
  const item = (e.target as HTMLElement).closest('.shortcut-item') as HTMLElement | null
  if (item) item.classList.remove('drag-over')
})

shortcutsGrid.addEventListener('drop', (e) => {
  e.preventDefault()
  const item = (e.target as HTMLElement).closest('.shortcut-item') as HTMLElement | null
  if (!item || dragIndex === null) return
  const dropIndex = parseInt(item.dataset.index || '0')
  if (dragIndex === dropIndex) return
  const saved = localStorage.getItem('shortcuts')
  const shortcuts: Shortcut[] = saved ? JSON.parse(saved) : []
  const [moved] = shortcuts.splice(dragIndex, 1)
  shortcuts.splice(dropIndex, 0, moved)
  localStorage.setItem('shortcuts', JSON.stringify(shortcuts))
  renderShortcuts(shortcuts)
  dragIndex = null
})

shortcutsGrid.addEventListener('dragend', () => {
  dragIndex = null
  shortcutsGrid.querySelectorAll('.shortcut-item').forEach(el => {
    el.classList.remove('dragging', 'drag-over')
  })
})

shortcutsGrid.addEventListener('click', (e) => {
  const target = e.target as HTMLElement
  if (target.classList.contains('shortcut-delete')) {
    e.preventDefault()
    e.stopPropagation()
    const index = parseInt(target.dataset.index || '0')
    const saved = localStorage.getItem('shortcuts')
    const shortcuts: Shortcut[] = saved ? JSON.parse(saved) : []
    shortcuts.splice(index, 1)
    localStorage.setItem('shortcuts', JSON.stringify(shortcuts))
    renderShortcuts(shortcuts)
  }
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

type Theme = 'auto' | 'light' | 'dark'

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme): void {
  const effective = theme === 'auto' ? getSystemTheme() : theme
  document.documentElement.setAttribute('data-theme', effective)
  themeBtn.className = 'theme-btn theme-' + theme
  localStorage.setItem('theme', theme)
}

function cycleTheme(): void {
  const current = (localStorage.getItem('theme') || 'auto') as Theme
  const next: Theme = current === 'auto' ? 'light' : current === 'light' ? 'dark' : 'auto'
  applyTheme(next)
}

// 初始化主题
const savedTheme = (localStorage.getItem('theme') || 'auto') as Theme
applyTheme(savedTheme)

// 监听系统主题变化
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if ((localStorage.getItem('theme') || 'auto') === 'auto') {
    applyTheme('auto')
  }
})

themeBtn.addEventListener('click', cycleTheme)

loadBackground()
loadShortcuts()
