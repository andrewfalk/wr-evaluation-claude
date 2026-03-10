const { contextBridge, ipcRenderer } = require('electron');

// 웹 페이지에서 사용할 수 있는 API 노출
contextBridge.exposeInMainWorld('electron', {
  // 플랫폼 정보
  platform: process.platform,

  // 메뉴 이벤트 리스너
  onMenuNew: (callback) => ipcRenderer.on('menu-new', callback),

  // native alert/confirm 대체 (Windows 7 포커스 문제 해결)
  showAlert: (message) => ipcRenderer.invoke('show-alert', message),
  showConfirm: (message) => ipcRenderer.invoke('show-confirm', message),

  // 버전 정보
  version: {
    app: '1.6.0',
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome
  }
});
