// 진단 데이터 생성
export const createDiagnosis = () => ({
  id: Date.now() + Math.random(),
  code: '',
  name: '',
  side: '',
  confirmedCode: '',
  confirmedName: '',
  klgRight: '',
  klgLeft: '',
  confirmedRight: '',
  confirmedLeft: '',
  assessmentRight: '',
  assessmentLeft: '',
  reasonRight: '',
  reasonRightOther: '',
  reasonLeft: '',
  reasonLeftOther: ''
});

// 환자 데이터 생성
export const createPatientData = () => ({
  name: '',
  gender: '',
  height: '',
  weight: '',
  birthDate: '',
  injuryDate: '',
  hospitalName: '',
  department: '',
  doctorName: '',
  evaluationDate: new Date().toISOString().split('T')[0],
  specialNotes: '',
  diagnoses: [createDiagnosis()],
  jobs: [{
    id: Date.now(),
    jobName: '',
    presetId: null,
    startDate: '',
    endDate: '',
    evidenceSources: [],
    weight: '',
    squatting: '',
    stairs: false,
    kneeTwist: false,
    startStop: false,
    tightSpace: false,
    kneeContact: false,
    jumpDown: false
  }],
  returnConsiderations: ''
});

// 환자 생성
export const createPatient = () => ({
  id: Date.now() + Math.random(),
  data: createPatientData()
});

// KLG 옵션
export const KLG_OPTIONS = [
  { value: '', label: '선택' },
  { value: 'N/A', label: '해당없음' },
  { value: '1', label: '1등급' },
  { value: '2', label: '2등급' },
  { value: '3', label: '3등급' },
  { value: '4', label: '4등급' }
];

// Fallback Presets
export const FALLBACK_PRESETS = [
  { id: 1, jobName: "건설 현장 배근공", category: "건설업", weight: 2500, squatting: 180, source: "Fallback" },
  { id: 2, jobName: "기계 조립원", category: "제조업", weight: 1500, squatting: 120, source: "Fallback" },
  { id: 3, jobName: "포장작업원", category: "제조업", weight: 300, squatting: 60, source: "Fallback" }
];
