const { app, BrowserWindow, ipcMain, shell, nativeTheme } = require('electron')
const path = require('path')
const { fork } = require('child_process')

let mainWindow
let serverProcess

// ── 启动内嵌 Node 服务（打包后使用，开发模式由 concurrently 启动）──
function startServer() {
  if (process.env.NODE_ENV === 'development') return

  const serverPath = path.join(__dirname, '../../server/index.js')
  serverProcess = fork(serverPath, [], {
    env: { ...process.env, NODE_ENV: 'production' },
    silent: false,
  })

  serverProcess.on('exit', (code) => {
    console.log(`[Main] Server exited with code ${code}`)
  })
}

function createWindow() {
  nativeTheme.themeSource = 'dark'

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0d0d14',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    frame: process.platform !== 'win32',
    titleBarOverlay: process.platform === 'win32' ? {
      color: '#0d0d14',
      symbolColor: '#e0e0ff',
      height: 40,
    } : false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const indexPath = path.join(__dirname, '../renderer/index.html')
  mainWindow.loadFile(indexPath)

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(() => {
  startServer()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill()
  if (process.platform !== 'darwin') app.quit()
})

// ── IPC：打开外部链接 ──
ipcMain.on('open-external', (_, url) => {
  shell.openExternal(url)
})

// ── IPC：获取服务端端口配置 ──
ipcMain.handle('get-config', () => ({
  dgLabPort: parseInt(process.env.DGLAB_WS_PORT || '9999'),
  apiPort: parseInt(process.env.APP_API_PORT || '9998'),
}))
