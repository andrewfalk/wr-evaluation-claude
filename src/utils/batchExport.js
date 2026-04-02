import * as XLSX from 'xlsx';
import { getEffectiveWorkPeriod } from './calculations';

// 통합 프로그램(wr-evaluation-unified) 일괄 Import 36열 헤더
const BATCH_HEADERS = [
  '이름', '생년월일', '재해일자', '키', '몸무게', '성별',
  '병원명', '진료과', '담당의', '특이사항', '복귀고려사항',
  '진단코드', '진단명', '부위', 'KLG(우측)', 'KLG(좌측)',
  '직종명', '시작일', '종료일', '근무기간(년)', '근무기간(개월)', '중량물(kg)', '쪼그려앉기(분)',
  '계단오르내리기', '무릎비틀림', '출발정지반복', '좁은공간', '무릎접촉충격', '뛰어내리기',
  '작업명', '자세코드', '작업중량(kg)', '횟수/일', '시간값', '시간단위', '보정계수'
];

const SIDE_MAP = { right: '우측', left: '좌측', both: '양측' };

function patientToRows(patient) {
  const d = patient.data || {};
  const diagnoses = (d.diagnoses || []).filter(dx => dx.code || dx.name);
  const jobs = (d.jobs || []).filter(j => j.jobName);
  const rowCount = Math.max(1, diagnoses.length, jobs.length);

  const rows = [];
  for (let i = 0; i < rowCount; i++) {
    const row = new Array(36).fill('');

    // 기본정보: 첫 행에만
    if (i === 0) {
      row[0] = d.name || '';
      row[1] = d.birthDate || '';
      row[2] = d.injuryDate || '';
      row[3] = d.height || '';
      row[4] = d.weight || '';
      row[5] = d.gender === 'male' ? '남' : d.gender === 'female' ? '여' : '';
      row[6] = d.hospitalName || '';
      row[7] = d.department || '';
      row[8] = d.doctorName || '';
      row[9] = d.specialNotes || '';
      row[10] = d.returnConsiderations || '';
    }

    // 진단
    if (i < diagnoses.length) {
      const dx = diagnoses[i];
      row[11] = dx.code || '';
      row[12] = dx.name || '';
      row[13] = SIDE_MAP[dx.side] || '';
      row[14] = dx.klgRight || '';
      row[15] = dx.klgLeft || '';
    }

    // 직업
    if (i < jobs.length) {
      const j = jobs[i];
      row[16] = j.jobName || '';
      row[17] = j.startDate || '';
      row[18] = j.endDate || '';

      // 근무기간
      const periodYears = getEffectiveWorkPeriod(j);
      if (periodYears > 0) {
        row[19] = Math.floor(periodYears);
        row[20] = Math.round((periodYears % 1) * 12);
      }

      row[21] = j.weight || '';
      row[22] = j.squatting || '';
      row[23] = j.stairs ? 'O' : '';
      row[24] = j.kneeTwist ? 'O' : '';
      row[25] = j.startStop ? 'O' : '';
      row[26] = j.tightSpace ? 'O' : '';
      row[27] = j.kneeContact ? 'O' : '';
      row[28] = j.jumpDown ? 'O' : '';
    }

    // 29-35: 척추 열 — 무릎 전용이므로 비워둠

    rows.push(row);
  }
  return rows;
}

export function exportForUnified(patients) {
  if (!patients || patients.length === 0) {
    alert('내보낼 환자 데이터가 없습니다.');
    return;
  }

  const allRows = [];
  patients.forEach(p => {
    allRows.push(...patientToRows(p));
  });

  const wsData = [BATCH_HEADERS, ...allRows];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // 열 너비 설정
  ws['!cols'] = BATCH_HEADERS.map((h, i) => {
    if (i <= 2) return { wch: 12 };   // 이름/날짜
    if (i <= 5) return { wch: 8 };    // 키/몸무게/성별
    if (i <= 10) return { wch: 15 };  // 병원/과/의사/특이/복귀
    if (i <= 15) return { wch: 12 };  // 진단
    if (i <= 22) return { wch: 12 };  // 직업
    return { wch: 8 };                // 보조변수/척추
  });

  XLSX.utils.book_append_sheet(wb, ws, '일괄데이터');

  const fileName = `통합프로그램용_${patients.length}명_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
