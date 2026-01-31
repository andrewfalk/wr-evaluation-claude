// 신체부담정도 계산
export function calculatePhysicalBurden(w, t) {
  const W = parseFloat(w) || 0;
  const T = parseFloat(t) || 0;
  
  if ((W >= 3000 && T >= 180) || (W >= 3000 && T >= 120) || (W >= 2000 && T >= 180)) {
    return { level: '고', minScore: 6.0, maxScore: 9.0 };
  }
  if ((W >= 3000 && T >= 60) || (W >= 2000 && T >= 120) || (W < 2000 && T >= 120)) {
    return { level: '중상', minScore: 3.0, maxScore: 6.0 };
  }
  if ((W >= 3000 && T < 60) || (W >= 2000 && T < 120) || (W < 2000 && T >= 60)) {
    return { level: '중하', minScore: 2.0, maxScore: 4.0 };
  }
  return { level: '하', minScore: 1.0, maxScore: 2.0 };
}

// 근무기간 계산 (년 단위)
export function calculateWorkPeriod(s, e) {
  if (!s || !e) return 0;
  return Math.max(0, (new Date(e) - new Date(s)) / (1000 * 60 * 60 * 24 * 365.25));
}

// 근무기간 포맷팅
export function formatWorkPeriod(s, e) {
  if (!s || !e) return '-';
  const m = Math.round(calculateWorkPeriod(s, e) * 12);
  return `${Math.floor(m / 12)}년 ${m % 12}월`;
}

// 만 나이 계산
export function calculateAge(b, r) {
  if (!b || !r) return 0;
  const birth = new Date(b);
  const ref = new Date(r);
  let age = ref.getFullYear() - birth.getFullYear();
  if (ref.getMonth() < birth.getMonth() || 
      (ref.getMonth() === birth.getMonth() && ref.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

// BMI 계산
export function calculateBMI(h, w) {
  const H = parseFloat(h);
  const W = parseFloat(w);
  return (H && W && H > 0) ? (W / ((H / 100) ** 2)).toFixed(1) : 0;
}

// 업무관련성 계산
export function calculateWorkRelatedness(jobs, age) {
  if (!jobs?.length || age <= 30) return { min: 0, max: 0 };
  
  let sumMin = 0;
  let sumMax = 0;
  
  jobs.forEach(j => {
    const b = calculatePhysicalBurden(j.weight, j.squatting);
    const p = calculateWorkPeriod(j.startDate, j.endDate);
    sumMin += (b.minScore - 1) * p;
    sumMax += (b.maxScore - 1) * p;
  });
  
  const af = age - 30;
  return {
    min: Math.max(0, (sumMin / (af + sumMin)) * 100).toFixed(1),
    max: Math.max(0, (sumMax / (af + sumMax)) * 100).toFixed(1)
  };
}

// 누적신체부담 평가
export function evaluateCumulativeBurden(min, max) {
  return ((parseFloat(min) + parseFloat(max)) / 2) >= 50 ? '충분함' : '불충분함';
}

// 텍스트 헬퍼
export const getSideText = (side) => 
  side === 'right' ? '우측' : side === 'left' ? '좌측' : side === 'both' ? '양측' : '-';

export const getStatusText = (status) => 
  status === 'confirmed' ? '확인' : status === 'mild' ? '경미' : status === 'unconfirmed' ? '미확인' : '-';

export const getKlgText = (klg) => 
  klg === 'N/A' ? '해당없음' : klg ? `${klg}등급` : '-';

export const getReasonText = (reason, other) => {
  if (reason === 'unrelated') return '신체부담과 관련없는 상병';
  if (reason === 'mild') return '상병 미확인/연령대비 경미';
  if (reason === 'delayed') return '업무중단 후 상당기간 경과';
  if (reason === 'other') return `기타 (${other || ''})`;
  return '-';
};
