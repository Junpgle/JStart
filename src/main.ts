import './style.css'

interface Shortcut {
  name: string
  url: string
  icon: string
}

type Engine = 'bing' | 'google' | 'baidu'

const background = document.getElementById('background') as HTMLDivElement
const backgroundOverlay = document.getElementById('backgroundOverlay') as HTMLDivElement
const searchInput = document.getElementById('searchInput') as HTMLInputElement
const searchBtn = document.getElementById('searchBtn') as HTMLButtonElement
const suggestions = document.getElementById('suggestions') as HTMLDivElement
const searchBox = document.querySelector('.search-box') as HTMLDivElement
const themeBtn = document.getElementById('themeBtn') as HTMLButtonElement
const shortcutsGrid = document.getElementById('shortcutsGrid') as HTMLDivElement
const addModal = document.getElementById('addModal') as HTMLDivElement
const cancelBtn = document.getElementById('cancelBtn') as HTMLButtonElement
const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement
const shortcutNameInput = document.getElementById('shortcutName') as HTMLInputElement
const shortcutUrlInput = document.getElementById('shortcutUrl') as HTMLInputElement
const engineBtns = document.querySelectorAll('.engine-btn') as NodeListOf<HTMLButtonElement>
const clock = document.getElementById('clock') as HTMLDivElement
const wallpaperInfo = document.getElementById('wallpaperInfo') as HTMLDivElement
const weatherEl = document.getElementById('weather') as HTMLDivElement
const countdownBar = document.getElementById('countdownBar') as HTMLDivElement
const toastEl = document.getElementById('toast') as HTMLDivElement
const userBtn = document.getElementById('userBtn') as HTMLButtonElement
const loginModal = document.getElementById('loginModal') as HTMLDivElement
const loginTitle = document.getElementById('loginTitle') as HTMLHeadingElement
const loginUsername = document.getElementById('loginUsername') as HTMLInputElement
const loginEmail = document.getElementById('loginEmail') as HTMLInputElement
const loginPassword = document.getElementById('loginPassword') as HTMLInputElement
const loginCode = document.getElementById('loginCode') as HTMLInputElement
const loginError = document.getElementById('loginError') as HTMLDivElement
const loginCancelBtn = document.getElementById('loginCancelBtn') as HTMLButtonElement
const loginToggleBtn = document.getElementById('loginToggleBtn') as HTMLButtonElement
const loginSubmitBtn = document.getElementById('loginSubmitBtn') as HTMLButtonElement

const API_BASE = 'https://api-cdt.junpgle.me'
let currentEngine: Engine = 'bing'
let debounceTimer: number | null = null
let isRegisterMode = false
let isVerifyStep = false

const searchUrls: Record<Engine, string> = {
  bing: 'https://www.bing.com/search?q=',
  google: 'https://www.google.com/search?q=',
  baidu: 'https://www.baidu.com/s?wd='
}

function crossfade(src: string, callback?: () => void) {
  const img = new Image()
  img.onload = () => {
    backgroundOverlay.style.backgroundImage = `url(${src})`
    backgroundOverlay.style.opacity = '1'
    const onEnd = () => {
      background.style.backgroundImage = `url(${src})`
      backgroundOverlay.style.opacity = '0'
      backgroundOverlay.removeEventListener('transitionend', onEnd)
      callback?.()
    }
    backgroundOverlay.addEventListener('transitionend', onEnd)
  }
  img.src = src
}

async function loadBackground(): Promise<void> {
  const cacheKey = 'wallpaper-cache'
  const imgDataKey = 'wallpaper-img-data'

  // 1. 立即显示缓存壁纸（首屏直接设置，无需动画）
  const cached = localStorage.getItem(cacheKey)
  let cacheAvailable = false
  if (cached) {
    const { url, title } = JSON.parse(cached)
    if (title) wallpaperInfo.textContent = title
    try {
      const cache = await caches.open('jstart-wallpaper')
      const response = await cache.match(url)
      if (response) {
        const blob = await response.blob()
        background.style.backgroundImage = `url(${URL.createObjectURL(blob)})`
        cacheAvailable = true
      }
    } catch {}
    if (!cacheAvailable) {
      const imgData = localStorage.getItem(imgDataKey)
      if (imgData) background.style.backgroundImage = `url(${imgData})`
    }
  }

  // 壁纸加载完成后淡入显示
  background.classList.add('loaded')

  // 2. 获取今天的壁纸元数据
  try {
    const res = await fetch('https://bing.biturl.top/?resolution=UHD&format=json&index=0&mkt=zh-CN')
    const data = await res.json()
    if (!data.url) return

    const todayUrl = data.url
    const todayTitle = data.title || data.copyright || ''
    const cachedData = cached ? JSON.parse(cached) : null

    // 3. 如果今天壁纸和缓存相同，已完成
    if (cachedData && cachedData.url === todayUrl) return

    const imgRes = await fetch(todayUrl)
    const blob = await imgRes.blob()
    const blobUrl = URL.createObjectURL(blob)

    // 4. 缓存到 Cache API
    try {
      const cache = await caches.open('jstart-wallpaper')
      await cache.put(todayUrl, new Response(blob))
      const keys = await cache.keys()
      for (const req of keys) {
        if (req.url !== todayUrl) await cache.delete(req)
      }
    } catch {
      const reader = new FileReader()
      reader.onload = () => {
        try { localStorage.setItem(imgDataKey, reader.result as string) } catch {}
      }
      reader.readAsDataURL(blob)
    }

    // 5. 交叉淡入新壁纸
    crossfade(blobUrl)

    // 6. 更新缓存元数据
    wallpaperInfo.textContent = todayTitle
    localStorage.setItem(cacheKey, JSON.stringify({ url: todayUrl, title: todayTitle }))
  } catch {
    // 网络失败，保持渐变兜底背景
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
  const win: Record<string, unknown> = window as unknown as Record<string, unknown>

  win[cb] = (data: unknown) => {
    delete win[cb]
    script.remove()
    if (currentEngine === 'google') {
      const items = ((data as any)[1] || []).map((i: any[]) => i[0])
      showSuggestions(items)
    } else {
      showSuggestions((data as string[][])[1] || [])
    }
  }

  script.onerror = () => {
    delete win[cb]
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
  backgroundOverlay.classList.add('blur')
})

searchInput.addEventListener('blur', () => {
  setTimeout(() => {
    background.classList.remove('blur')
    backgroundOverlay.classList.remove('blur')
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
    const { origin } = new URL(url)
    // 先用站点自身的 favicon（不受 CORS 限制），失败再降级到代理
    return `${origin}/favicon.ico`
  } catch {
    return ''
  }
}

function applyFaviconFallback(img: HTMLImageElement, domain: string): void {
  const fallbacks = [
    `https://favicon.im/${domain}.128`,
    `https://statics.dnspod.cn/proxy_favicons/t/${domain}`,
  ]
  let i = 0
  img.onerror = () => {
    if (i < fallbacks.length) {
      img.onerror = null
      img.src = fallbacks[i++]
    } else {
      img.onerror = null
      img.style.display = 'none'
    }
  }
}

function getDomain(url: string): string {
  try { return new URL(url).hostname } catch { return '' }
}

function renderShortcuts(shortcuts: Shortcut[]): void {
  shortcutsGrid.innerHTML = shortcuts.map((s, i) => `
    <div class="shortcut-item" data-index="${i}" draggable="true">
      <a href="${s.url}" class="shortcut-link" target="_blank">
        <div class="shortcut-icon">
          <img src="${getFaviconUrl(s.url)}" class="favicon-${getDomain(s.url)}" alt="${s.name}" loading="lazy">
        </div>
        <div class="shortcut-name">${s.name}</div>
      </a>
      <button class="shortcut-delete" data-index="${i}">×</button>
    </div>
  `).join('') + `
    <div class="shortcut-item">
      <button class="add-shortcut-btn" id="addShortcutBtn">+</button>
      <div class="shortcut-name">&nbsp;</div>
    </div>
  `
  // 绑定 onerror 降级
  shortcutsGrid.querySelectorAll<HTMLImageElement>('img[class^="favicon-"]').forEach(img => {
    const domain = img.className.replace('favicon-', '')
    applyFaviconFallback(img, domain)
  })
}


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
  syncAfterChange()
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
    syncAfterChange()
  } else if (target.classList.contains('add-shortcut-btn')) {
    addModal.classList.add('visible')
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
    syncAfterChange()
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

let pomodoroTimestamp = 0
let pomodoroTargetEnd = 0
let pomodoroMode = 0 // 0=倒计时, 1=正计时
let pomodoroTodoTitle = ''
let pomodoroTickTimer: number | null = null
let pomodoroActive = false

function updateClock(): void {
  if (pomodoroTimestamp) return
  const now = new Date()
  clock.textContent = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

updateClock()
setInterval(updateClock, 1000)

async function loadWeather(): Promise<void> {
  try {
    const res = await fetch('https://wttr.in/?format=j1&lang=zh')
    const data = await res.json()
    const current = data.current_condition[0]
    const area = data.nearest_area[0]
    const temp = current.temp_C
    const desc = current.lang_zh[0]?.value || current.weatherDesc[0]?.value || ''
    const city = area.areaName[0]?.value || ''
    weatherEl.innerHTML = `
      <div>
        <div class="weather-temp">${temp}°C</div>
        <div class="weather-desc">${desc}</div>
        <div class="weather-loc">${city}</div>
      </div>
    `
  } catch {
    weatherEl.innerHTML = ''
  }
}

function updatePomodoroDisplay(): void {
  if (!pomodoroTimestamp) return
  const now = Date.now()
  const elapsed = Math.floor((now - pomodoroTimestamp) / 1000)
  let display: number
  if (pomodoroMode === 1) {
    display = elapsed
  } else {
    const planned = Math.floor((pomodoroTargetEnd - pomodoroTimestamp) / 1000)
    display = Math.max(0, planned - elapsed)
  }
  const min = Math.floor(display / 60)
  const sec = display % 60
  const title = pomodoroTodoTitle ? `<div class="clock-sub">${pomodoroTodoTitle}</div>` : ''
  const badge = `<span class="pomodoro-badge">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 21C16.9706 21 21 17.4183 21 13C21 8.58172 16.9706 5 12 5C7.02944 5 3 8.58172 3 13C3 17.4183 7.02944 21 12 21Z" fill="url(#tomatoGrad)"/>
      <path d="M7.5 10C6.5 11 6 12.5 6 13.5C6 14 6.2 14.2 6.5 14C7 13.5 8 11.5 8 10.5C8 10.1 7.8 9.7 7.5 10Z" fill="white" fill-opacity="0.5"/>
      <path d="M12 5V2.5C12 2.22386 12.2239 2 12.5 2C12.7761 2 13 2.22386 13 2.5V5H12Z" fill="#2ECC71"/>
      <path d="M12 5.5C10 4.5 7.5 4.5 6.5 5C8 6 10.5 6 12 5.5Z" fill="#27AE60"/>
      <path d="M12 5.5C14 4.5 16.5 4.5 17.5 5C16 6 13.5 6 12 5.5Z" fill="#27AE60"/>
      <path d="M12 5.5C12 3.5 11 1.5 9.5 1C10.5 2.5 11.5 4 12 5.5Z" fill="#219A52"/>
      <path d="M12 5.5C12 3.5 13 1.5 14.5 1C13.5 2.5 12.5 4 12 5.5Z" fill="#219A52"/>
      <defs>
        <radialGradient id="tomatoGrad" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(10 10) rotate(45) scale(12 12)">
          <stop offset="0%" stop-color="#FF6B6B"/>
          <stop offset="60%" stop-color="#FF4757"/>
          <stop offset="100%" stop-color="#D63031"/>
        </radialGradient>
      </defs>
    </svg>
  </span>`
  const newContent = `${badge}<span class="pomodoro-time">${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}</span>${title}`
  
  if (!pomodoroActive) {
    const oldContent = clock.innerHTML
    clock.innerHTML = `<div class="clock-old">${oldContent}</div><div class="clock-new">${newContent}</div>`
    clock.className = 'clock switching'
    clock.addEventListener('animationend', () => {
      clock.innerHTML = newContent
      clock.className = 'clock pomodoro'
    }, { once: true })
    pomodoroActive = true
  } else {
    const pomodoroTimeEl = clock.querySelector('.pomodoro-time')
    if (pomodoroTimeEl) {
      pomodoroTimeEl.textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    }
  }
}

function stopPomodoroDisplay(): void {
  if (pomodoroActive) {
    const oldContent = clock.innerHTML
    const now = new Date()
    const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    clock.innerHTML = `<div class="clock-old">${oldContent}</div><div class="clock-new">${timeStr}</div>`
    clock.className = 'clock switching'
    clock.addEventListener('animationend', () => {
      clock.innerHTML = timeStr
      clock.className = 'clock'
    }, { once: true })
    pomodoroActive = false
  }
  if (pomodoroTickTimer) { clearInterval(pomodoroTickTimer); pomodoroTickTimer = null }
  pomodoroTimestamp = 0
  setTimeout(() => updateClock(), 800)
}

async function checkPomodoro(): Promise<void> {
  if (!isLoggedIn()) {
    stopPomodoroDisplay()
    return
  }
  try {
    const res = await fetch(`${API_BASE}/api/jstart/pomodoro-active`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    })
    if (!res.ok) return
    const data = await res.json()
    if (data.active && data.state) {
      const s = data.state
      pomodoroMode = s.mode ?? 0
      pomodoroTimestamp = s.timestamp || 0
      pomodoroTargetEnd = s.target_end_ms || 0
      pomodoroTodoTitle = s.todo_title || s.todoTitle || ''
      updatePomodoroDisplay()
      if (!pomodoroTickTimer) {
        pomodoroTickTimer = window.setInterval(updatePomodoroDisplay, 1000)
      }
    } else {
      stopPomodoroDisplay()
    }
  } catch {}
}

loadWeather()
loadBackground()
loadShortcuts()
checkPomodoro()
setInterval(checkPomodoro, 30000)

// ==================== Toast ====================

let toastTimer: number | null = null

function showToast(message: string, type: 'success' | 'error' = 'success'): void {
  if (toastTimer) clearTimeout(toastTimer)
  toastEl.textContent = message
  toastEl.className = `toast ${type} visible`
  toastTimer = window.setTimeout(() => {
    toastEl.classList.remove('visible')
  }, 2500)
}

// ==================== Auth ====================

function getToken(): string | null {
  return localStorage.getItem('jstart_token')
}

function getUser(): { id: number; username: string; email: string } | null {
  const s = localStorage.getItem('jstart_user')
  return s ? JSON.parse(s) : null
}

function isLoggedIn(): boolean {
  return !!getToken()
}

function updateUserBtn(): void {
  const user = getUser()
  if (user) {
    userBtn.innerHTML = `<span class="user-avatar">${user.username[0].toUpperCase()}</span><span>${user.username}</span>`
    userBtn.title = '点击退出登录'
  } else {
    userBtn.textContent = '登录'
    userBtn.title = '登录'
  }
}

userBtn.addEventListener('click', () => {
  if (isLoggedIn()) {
    localStorage.removeItem('jstart_token')
    localStorage.removeItem('jstart_user')
    updateUserBtn()
    showToast('已退出登录')
  } else {
    loginModal.classList.add('visible')
    loginError.textContent = ''
  }
})

loginCancelBtn.addEventListener('click', () => {
  loginModal.classList.remove('visible')
  loginError.textContent = ''
  isVerifyStep = false
  loginCode.style.display = 'none'
})

loginToggleBtn.addEventListener('click', () => {
  isRegisterMode = !isRegisterMode
  isVerifyStep = false
  loginTitle.textContent = isRegisterMode ? '注册' : '登录'
  loginSubmitBtn.textContent = isRegisterMode ? '发送验证码' : '登录'
  loginToggleBtn.textContent = isRegisterMode ? '返回登录' : '注册'
  loginUsername.style.display = isRegisterMode ? 'block' : 'none'
  loginPassword.style.display = 'block'
  loginCode.style.display = 'none'
  loginError.textContent = ''
})

loginSubmitBtn.addEventListener('click', async () => {
  const email = loginEmail.value.trim()
  const password = loginPassword.value

  if (!email) {
    loginError.textContent = '请填写邮箱'
    return
  }

  loginSubmitBtn.disabled = true
  loginSubmitBtn.textContent = '请稍候...'
  loginError.textContent = ''

  try {
    if (isRegisterMode && !isVerifyStep) {
      // 第一步：发送验证码
      const username = loginUsername.value.trim()
      if (!username) {
        loginError.textContent = '请填写用户名'
        loginSubmitBtn.disabled = false
        loginSubmitBtn.textContent = '发送验证码'
        return
      }
      if (!password) {
        loginError.textContent = '请填写密码'
        loginSubmitBtn.disabled = false
        loginSubmitBtn.textContent = '发送验证码'
        return
      }
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, username })
      })
      const data = await res.json()
      if (!res.ok) {
        loginError.textContent = data.error || '注册失败'
        loginSubmitBtn.disabled = false
        loginSubmitBtn.textContent = '发送验证码'
        return
      }
      // 进入验证码输入步骤
      isVerifyStep = true
      loginCode.style.display = 'block'
      loginPassword.style.display = 'none'
      loginUsername.style.display = 'none'
      loginTitle.textContent = '输入验证码'
      loginSubmitBtn.textContent = '验证并注册'
      loginError.textContent = '验证码已发送到邮箱'
      loginSubmitBtn.disabled = false
      return
    }

    if (isRegisterMode && isVerifyStep) {
      // 第二步：验证码验证
      const code = loginCode.value.trim()
      if (!code) {
        loginError.textContent = '请输入验证码'
        loginSubmitBtn.disabled = false
        loginSubmitBtn.textContent = '验证并注册'
        return
      }
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      })
      const data = await res.json()
      if (!res.ok) {
        loginError.textContent = data.error || '验证失败'
        loginSubmitBtn.disabled = false
        loginSubmitBtn.textContent = '验证并注册'
        return
      }
      // 注册成功，自动登录
      const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: loginPassword.value })
      })
      const loginData = await loginRes.json()
      if (loginRes.ok) {
        localStorage.setItem('jstart_token', loginData.token)
        localStorage.setItem('jstart_user', JSON.stringify(loginData.user))
      }
      closeLoginModal()
      showToast('登录成功')
      updateUserBtn()
      await pullShortcuts()
      return
    }

    // 登录
    if (!password) {
      loginError.textContent = '请填写密码'
      loginSubmitBtn.disabled = false
      loginSubmitBtn.textContent = '登录'
      return
    }
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const data = await res.json()
    if (!res.ok) {
      loginError.textContent = data.error || '登录失败'
      loginSubmitBtn.disabled = false
      loginSubmitBtn.textContent = '登录'
      return
    }
    localStorage.setItem('jstart_token', data.token)
    localStorage.setItem('jstart_user', JSON.stringify(data.user))
    closeLoginModal()
    showToast('登录成功')
    updateUserBtn()
    await pullShortcuts()
  } catch {
    loginError.textContent = '网络错误'
  } finally {
    loginSubmitBtn.disabled = false
    if (!isVerifyStep) {
      loginSubmitBtn.textContent = isRegisterMode ? '发送验证码' : '登录'
    }
  }
})

function closeLoginModal(): void {
  loginModal.classList.remove('visible')
  loginEmail.value = ''
  loginPassword.value = ''
  loginUsername.value = ''
  loginCode.value = ''
  loginError.textContent = ''
  isVerifyStep = false
  loginCode.style.display = 'none'
  loginPassword.style.display = 'block'
  loginUsername.style.display = isRegisterMode ? 'block' : 'none'
  loginTitle.textContent = isRegisterMode ? '注册' : '登录'
  loginSubmitBtn.textContent = isRegisterMode ? '发送验证码' : '登录'
}

// ==================== Sync ====================

async function pullShortcuts(): Promise<void> {
  if (!isLoggedIn()) return
  try {
    const res = await fetch(`${API_BASE}/api/jstart/shortcuts`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    })
    if (!res.ok) { showToast('同步失败', 'error'); return }
    const data = await res.json()
    if (data.shortcuts && data.shortcuts.length > 0) {
      localStorage.setItem('shortcuts', JSON.stringify(data.shortcuts))
      renderShortcuts(data.shortcuts)
      showToast('同步成功')
    } else {
      // 云端无数据，把本地推上去
      const local = localStorage.getItem('shortcuts')
      if (local) await pushShortcuts(JSON.parse(local))
    }
  } catch {
    showToast('同步失败', 'error')
  }
}

async function pushShortcuts(shortcuts: Shortcut[]): Promise<void> {
  if (!isLoggedIn()) return
  try {
    const res = await fetch(`${API_BASE}/api/jstart/shortcuts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ shortcuts })
    })
    if (res.ok) {
      showToast('已同步')
    } else {
      showToast('同步失败', 'error')
    }
  } catch {
    showToast('同步失败', 'error')
  }
}

function syncAfterChange(): void {
  if (!isLoggedIn()) return
  const saved = localStorage.getItem('shortcuts')
  const shortcuts: Shortcut[] = saved ? JSON.parse(saved) : []
  pushShortcuts(shortcuts)
}

// ==================== Countdown ====================

async function loadCountdown(): Promise<void> {
  if (!isLoggedIn()) return
  try {
    const user = getUser()
    if (!user) return
    const res = await fetch(`${API_BASE}/api/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({
        user_id: user.id,
        device_id: 'jstart-web',
        last_sync_time: 0,
        todos: [],
        todo_groups: [],
        countdowns: [],
        pomodoro_records: [],
        pomodoro_tags: []
      })
    })
    if (!res.ok) return
    const data = await res.json()
    const list: { title: string; target_time: number; is_deleted: boolean }[] = data.server_countdowns || []
    const now = Date.now()
    const upcoming = list
      .filter(c => !c.is_deleted && c.target_time > now)
      .sort((a, b) => a.target_time - b.target_time)
    if (upcoming.length === 0) return
    const nearest = upcoming[0]
    const days = Math.ceil((nearest.target_time - now) / 86400000)
    const targetDate = new Date(nearest.target_time)
    const dateStr = `${targetDate.getFullYear()}/${String(targetDate.getMonth() + 1).padStart(2, '0')}/${String(targetDate.getDate()).padStart(2, '0')}`
    const content = countdownBar.querySelector('.island-content') as HTMLDivElement
    content.innerHTML = `
      <span class="countdown-label">${nearest.title}</span>
      <span class="countdown-days">还有 ${days} 天</span>
    `
    // 展开时显示的详情
    const detail = document.createElement('div')
    detail.className = 'countdown-detail'
    detail.innerHTML = `
      <div class="detail-row"><span>目标日期</span><span class="detail-value">${dateStr}</span></div>
      <div class="detail-row"><span>剩余天数</span><span class="detail-value">${days} 天</span></div>
      ${upcoming.length > 1 ? `<div class="detail-row"><span>更多倒计时</span><span class="detail-value">${upcoming.length - 1} 个</span></div>` : ''}
    `
    countdownBar.appendChild(detail)
    countdownBar.classList.add('visible')

    // 点击展开/收起
    countdownBar.addEventListener('click', () => {
      countdownBar.classList.toggle('expanded')
    })

    // 点击外部收起
    document.addEventListener('click', (e) => {
      if (!countdownBar.contains(e.target as Node)) {
        countdownBar.classList.remove('expanded')
      }
    })
  } catch {}
}

// 初始化
updateUserBtn()
if (isLoggedIn()) pullShortcuts()
if (isLoggedIn()) loadCountdown()
