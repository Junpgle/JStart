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
const addModal = document.getElementById('addModal') as HTMLDivElement
const cancelBtn = document.getElementById('cancelBtn') as HTMLButtonElement
const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement
const shortcutNameInput = document.getElementById('shortcutName') as HTMLInputElement
const shortcutUrlInput = document.getElementById('shortcutUrl') as HTMLInputElement
const engineBtns = document.querySelectorAll('.engine-btn') as NodeListOf<HTMLButtonElement>
const clock = document.getElementById('clock') as HTMLDivElement
const wallpaperInfo = document.getElementById('wallpaperInfo') as HTMLDivElement
const weatherEl = document.getElementById('weather') as HTMLDivElement
const pomodoroStatus = document.getElementById('pomodoroStatus') as HTMLDivElement
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

async function loadBackground(): Promise<void> {
  const cacheKey = 'wallpaper-cache'
  const imgDataKey = 'wallpaper-img-data'

  // 1. 立即显示缓存壁纸
  const cached = localStorage.getItem(cacheKey)
  let cacheAvailable = false
  if (cached) {
    const { url, title } = JSON.parse(cached)
    if (title) wallpaperInfo.textContent = title
    // 优先从 Cache API 读取
    try {
      const cache = await caches.open('jstart-wallpaper')
      const response = await cache.match(url)
      if (response) {
        const blob = await response.blob()
        background.style.backgroundImage = `url(${URL.createObjectURL(blob)})`
        background.classList.add('loaded')
        cacheAvailable = true
      }
    } catch {}
    // Cache API 失败，从 localStorage 读 base64
    if (!cacheAvailable) {
      const imgData = localStorage.getItem(imgDataKey)
      if (imgData) {
        background.style.backgroundImage = `url(${imgData})`
        background.classList.add('loaded')
      }
    }
  }

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

    // 4. 下载新壁纸并淡入
    const applyImage = (src: string) => {
      const img = new Image()
      img.onload = () => {
        background.style.backgroundImage = `url(${src})`
        if (!background.classList.contains('loaded')) {
          background.classList.add('loaded')
        }
      }
      img.src = src
    }

    const imgRes = await fetch(todayUrl)
    const blob = await imgRes.blob()
    const blobUrl = URL.createObjectURL(blob)

    // 5. 缓存到 Cache API
    try {
      const cache = await caches.open('jstart-wallpaper')
      await cache.put(todayUrl, new Response(blob))
      // 清理旧缓存
      const keys = await cache.keys()
      for (const req of keys) {
        if (req.url !== todayUrl) await cache.delete(req)
      }
    } catch {
      // Cache API 不可用，存 base64 到 localStorage
      const reader = new FileReader()
      reader.onload = () => {
        try { localStorage.setItem(imgDataKey, reader.result as string) } catch {}
      }
      reader.readAsDataURL(blob)
    }

    // 6. 淡入新壁纸
    applyImage(blobUrl)

    // 7. 更新缓存元数据
    wallpaperInfo.textContent = todayTitle
    localStorage.setItem(cacheKey, JSON.stringify({ url: todayUrl, title: todayTitle }))
  } catch {
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

const faviconCache = new Map<string, string>()

function getFaviconUrl(url: string): string {
  try {
    const domain = new URL(url).hostname
    const cached = faviconCache.get(domain)
    if (cached) return cached
    const remote = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
    // 后台获取并缓存为 blob URL
    fetch(remote).then(r => r.blob()).then(blob => {
      const blobUrl = URL.createObjectURL(blob)
      faviconCache.set(domain, blobUrl)
      // 更新已渲染的 img
      document.querySelectorAll<HTMLImageElement>(`img.favicon-${CSS.escape(domain)}`).forEach(img => {
        img.src = blobUrl
      })
    }).catch(() => {})
    return remote
  } catch {
    return ''
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

function updateClock(): void {
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

let pomodoroStartTime = 0
let pomodoroPlanned = 0
let pomodoroTodoTitle = ''
let pomodoroTimerMode = 0 // 0=倒计时, 1=正计时
let pomodoroTickTimer: number | null = null

function updatePomodoroDisplay(): void {
  if (!pomodoroStartTime) return
  const elapsed = Math.floor((Date.now() - pomodoroStartTime) / 1000)
  let display: number
  if (pomodoroTimerMode === 1) {
    // 正计时：显示已过时间
    display = elapsed
  } else {
    // 倒计时：显示剩余时间
    display = Math.max(0, pomodoroPlanned - elapsed)
  }
  const min = Math.floor(display / 60)
  const sec = display % 60
  const title = pomodoroTodoTitle ? ` · ${pomodoroTodoTitle}` : ''
  const prefix = pomodoroTimerMode === 1 ? '🍅' : '⏱️'
  pomodoroStatus.innerHTML = `<span class="pomodoro-dot"></span>${prefix} ${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}${title}`
}

async function checkPomodoro(): Promise<void> {
  if (!isLoggedIn()) {
    pomodoroStatus.classList.remove('active')
    return
  }
  try {
    const res = await fetch(`${API_BASE}/api/jstart/pomodoro-active`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    })
    if (!res.ok) return
    const data = await res.json()
    if (data.active && data.record) {
      pomodoroStartTime = data.record.start_time
      pomodoroPlanned = data.record.planned_duration || 1500
      pomodoroTodoTitle = data.record.todo_title || ''
      pomodoroTimerMode = data.timer_mode ?? 0
      pomodoroStatus.classList.add('active')
      updatePomodoroDisplay()
      if (!pomodoroTickTimer) {
        pomodoroTickTimer = window.setInterval(updatePomodoroDisplay, 1000)
      }
    } else {
      pomodoroStatus.classList.remove('active')
      if (pomodoroTickTimer) { clearInterval(pomodoroTickTimer); pomodoroTickTimer = null }
      pomodoroStartTime = 0
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

// 初始化
updateUserBtn()
if (isLoggedIn()) pullShortcuts()
