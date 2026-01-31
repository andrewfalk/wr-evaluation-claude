// Electron 환경 여부 확인
export const isElectron = () => {
  return typeof window !== 'undefined' && 
         typeof window.process === 'object' && 
         window.process.type === 'renderer';
};

// 플랫폼 정보
export const getPlatform = () => {
  if (isElectron()) {
    return 'electron';
  }
  return 'web';
};
