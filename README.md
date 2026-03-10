# 근골격계 질환 업무관련성 평가 프로그램

직업환경의학 전문의를 위한 업무관련성 평가 도구

## 🚀 시작하기

### 필수 조건
- Node.js 16.x 이상
- npm 또는 yarn

### 설치

```bash
# 의존성 설치
npm install
```

### 개발 모드

```bash
# 웹 개발 서버 실행 (http://localhost:3000)
npm run dev
```

### 빌드

```bash
# 웹 버전 빌드 (Vercel 배포용)
npm run build:web

# Electron 버전 빌드
npm run build:electron

# Windows 설치파일 생성 (32bit)
npm run electron:build:win32

# Windows 설치파일 생성 (64bit)
npm run electron:build:win64
```

## 📁 프로젝트 구조

```
wr-evaluation-v2/
├── src/
│   ├── main.jsx              # React 진입점
│   ├── App.jsx               # 메인 앱 컴포넌트
│   ├── index.css             # 스타일
│   ├── components/
│   │   ├── PresetSearch.jsx    # Preset 검색 컴포넌트
│   │   ├── BatchImportModal.jsx # 일괄 Import 모달
│   │   ├── BasicInfoTab.jsx    # 기본정보 탭
│   │   ├── DiagnosisTab.jsx    # 진단 탭
│   │   ├── JobTab.jsx          # 직종 탭
│   │   ├── AssessmentTab.jsx   # 평가 탭
│   │   └── ResultPanel.jsx     # 결과 패널
│   ├── hooks/
│   │   └── useJobPresets.js  # Preset 로딩 훅
│   └── utils/
│       ├── calculations.js   # 계산 로직
│       └── data.js           # 데이터 생성 함수 및 상수
├── public/
│   └── job-presets.json      # 직종 Preset 데이터
├── electron/
│   ├── main.js               # Electron 메인 프로세스
│   └── preload.js            # 보안 브릿지
├── index.html                # HTML 진입점
├── package.json
├── vite.config.js            # Vite 설정
└── README.md
```

## 📦 배포

### 웹 (Vercel)

```bash
npm run build:web
# dist/web 폴더를 Vercel에 배포
```

### Desktop (Windows)

```bash
# 32bit + 64bit 모두 빌드
npm run electron:build

# release 폴더에 설치파일 생성됨
```

## 🔄 동기화 워크플로우

1. `src/` 폴더의 코드를 수정
2. 웹 배포: `npm run build:web` → Vercel
3. Electron 배포: `npm run electron:build` → 설치파일 배포

**코드는 하나, 빌드만 두 번!**

## 📋 주요 기능

- ✅ 다중 환자 관리 (사이드바)
- ✅ 일괄 Import/Export
- ✅ 직종 Preset 검색
- ✅ 업무관련성 자동 계산
- ✅ PDF/Excel 내보내기
- ✅ 로컬 저장/불러오기

## 🛠 기술 스택

- React 18
- Vite
- Electron 21 (Windows 7 호환)
- SheetJS (xlsx)
- html2pdf.js

## 📝 v1.6.0 변경사항

- confirm/alert → Electron IPC `dialog.showMessageBox` 전환 (포커스 문제 해결)
- App.jsx 컴포넌트 분리 (865→430줄): BasicInfoTab, DiagnosisTab, JobTab, AssessmentTab, ResultPanel
- 계산 로직 통합 (`computePatientCalc`) — 중복 계산 제거
- 데이터 팩토리 패턴 적용 (`createJob`, `createDiagnosis`, `createPatient`)
- ID 생성 방식 개선: `Date.now()+Math.random()` → `crypto.randomUUID()`
- `disable-gpu` 스위치 Windows 7 조건부 적용 (Windows 10/11 GPU 가속 유지)
- 배치 Excel 내보내기 유효성 검사 추가
- 입력 수정 시 오류 메시지 자동 초기화
- 중복 상수 추출 (`LOW_REASON_OPTIONS`, `AUX_LABELS`)
- 미사용 코드 제거 (`platform.js`)

## 📄 라이선스

Private
