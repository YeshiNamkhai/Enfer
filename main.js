'use strict'

/* global createWindow */

const { app, BrowserWindow, Menu } = require('electron')
const path = require('path')

let isShown = true

app.win = null

app.on('ready', () => {
  app.win = new BrowserWindow({
    width: 780,
    height: 462,
    minWidth: 380,
    minHeight: 360,
    backgroundColor: '#000',
    icon: path.join(__dirname, { darwin: 'icon.icns', linux: 'icon.png', win32: 'icon.ico' }[process.platform] || 'icon.ico'),
    resizable: true,
    frame: process.platform !== 'darwin',
    skipTaskbar: process.platform === 'darwin',
    autoHideMenuBar: process.platform === 'darwin',
    webPreferences: { zoomFactor: 1.0, nodeIntegration: true, backgroundThrottling: false }
  })

  app.win.loadURL(`file://${__dirname}/index.html`)
  // app.inspect()
  
  app.injectMenu([
    {
      label: 'Enfer',
      submenu: [
        { label: 'Save Setup', accelerator: 'CmdOrCtrl+S', click: () => { app.win.webContents.executeJavaScript('client.save()').catch(() => {}) } },
        { label: 'Load Setup', accelerator: 'CmdOrCtrl+L', click: () => { app.win.webContents.executeJavaScript('client.load()').catch(() => {}) } },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => { app.quit() } }
      ]
    },
    {
      label: 'MIDI',
      submenu: [
        { label: 'Next Input 1', accelerator: ',', click: () => { app.win.webContents.executeJavaScript('client.io.next1()') } },
        { label: 'Next Input 2', accelerator: '.', click: () => { app.win.webContents.executeJavaScript('client.io.next2()') } },
        { type: 'separator' },
        { label: 'Next Channel/Kit', accelerator: ']', click: () => { app.win.webContents.executeJavaScript('client.modChannel(1)') } },
        { label: 'Prev Channel/Kit', accelerator: '[', click: () => { app.win.webContents.executeJavaScript('client.modChannel(-1)') } },
        { type: 'separator' },
        { label: 'MIDI Learn', accelerator: 'Enter', click: () => { app.win.webContents.executeJavaScript('client.io.startLearn()') } },
        { type: 'separator' },
        { label: 'Refresh MIDI', accelerator: 'CmdOrCtrl+R', click: () => { app.win.webContents.executeJavaScript('client.refreshMidi()').catch(e => {}) } },
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Fullscreen', accelerator: 'F11', click: () => { app.toggleFullscreen() } },
        { label: 'Toggle DevTools', accelerator: 'Alt+Command+I', click: () => { app.inspect() } }
      ]
    }
  ])


  app.win.on('closed', () => {
    app.quit()
  })

  app.win.on('hide', function () {
    isShown = false
  })

  app.win.on('show', function () {
    isShown = true
  })

  app.on('window-all-closed', () => {
    app.quit()
  })

  app.on('activate', () => {
    if (app.win === null) {
      createWindow()
    } else {
      app.win.show()
    }
  })
})

app.inspect = function () {
  app.win.toggleDevTools()
}

app.toggleFullscreen = function () {
  app.win.setFullScreen(!app.win.isFullScreen())
}

app.toggleMenubar = function () {
  app.win.setMenuBarVisibility(!app.win.isMenuBarVisible())
}

app.toggleVisible = function () {
  if (process.platform !== 'darwin') {
    if (!app.win.isMinimized()) { app.win.minimize() } else { app.win.restore() }
  } else {
    if (isShown && !app.win.isFullScreen()) { app.win.hide() } else { app.win.show() }
  }
}

app.injectMenu = function (menu) {
  try {
    Menu.setApplicationMenu(Menu.buildFromTemplate(menu))
  } catch (err) {
    console.warn('Cannot inject menu.')
  }
}
