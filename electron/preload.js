const { contextBridge, ipcRenderer } = require('electron');

// 웹 페이지에서 사용할 수 있는 API 노출
contextBridge.exposeInMainWorld('electron', {
  // 플랫폼 정보
  platform: process.platform,
  
  // 메뉴 이벤트 리스너
  onMenuNew: (callback) => ipcRenderer.on('menu-new', callback),
  
  // 버전 정보
  version: {
    app: '1.5.0',
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome
  }
});
