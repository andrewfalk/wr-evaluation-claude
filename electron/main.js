const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

// Windows 7 호환성
app.commandLine.appendSwitch('disable-gpu');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../public/icon.ico'),
    title: '근골격계 질환 업무관련성 평가 프로그램'
  });

  // 개발 모드와 프로덕션 모드 구분
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/electron/index.html'));
  }

  // 메뉴 설정
  const menuTemplate = [
    {
      label: '파일',
      submenu: [
        { label: '새로 만들기', accelerator: 'CmdOrCtrl+N', click: () => mainWindow.webContents.send('menu-new') },
        { type: 'separator' },
        { label: '종료', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
      ]
    },
    {
      label: '편집',
      submenu: [
        { label: '실행 취소', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: '다시 실행', accelerator: 'CmdOrCtrl+Y', role: 'redo' },
        { type: 'separator' },
        { label: '잘라내기', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: '복사', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: '붙여넣기', accelerator: 'CmdOrCtrl+V', role: 'paste' }
      ]
    },
    {
      label: '보기',
      submenu: [
        { label: '새로고침', accelerator: 'CmdOrCtrl+R', click: () => mainWindow.reload() },
        { label: '전체 화면', accelerator: 'F11', click: () => mainWindow.setFullScreen(!mainWindow.isFullScreen()) },
        { type: 'separator' },
        { label: '확대', accelerator: 'CmdOrCtrl+Plus', click: () => mainWindow.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() + 0.5) },
        { label: '축소', accelerator: 'CmdOrCtrl+-', click: () => mainWindow.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() - 0.5) },
        { label: '기본 크기', accelerator: 'CmdOrCtrl+0', click: () => mainWindow.webContents.setZoomLevel(0) }
      ]
    },
    {
      label: '도움말',
      submenu: [
        { label: '버전 정보', click: () => {
          const { dialog } = require('electron');
          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: '버전 정보',
            message: '근골격계 질환 업무관련성 평가 프로그램',
            detail: `버전: 1.5.0\n\n직업환경의학 전문의를 위한 업무관련성 평가 도구`
          });
        }}
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
