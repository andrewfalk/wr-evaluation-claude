import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';
import { AUX_LABELS } from './data';
import { computePatientCalc, getSideText, getStatusText, getReasonText } from './calculations';

export const genReport = (data, c) => {
  const { age, bmi, relatedness: r, cumulativeBurden: cum, jobBurdens: jb } = c || computePatientCalc(data);

  let t = `업무관련성 특별진찰 소견서\n\n이름: ${data.name}(${data.gender === 'male' ? '남' : data.gender === 'female' ? '여' : ''})\n`;
  t += `키/몸무게: ${data.height || '-'}cm / ${data.weight || '-'}kg (BMI: ${bmi || '-'})\n`;
  t += `생년월일: ${data.birthDate || '-'}\n재해일자: ${data.injuryDate || '-'} (만 ${age}세)\n\n`;
  t += `[신청 상병]\n`;
  data.diagnoses.forEach((d, i) => {
    if (d.code || d.name) t += `#${i + 1}. ${d.code} ${d.name} (${getSideText(d.side)})\n`;
  });
  t += `\n[특이사항]\n${data.specialNotes || '-'}\n\n[직업력]\n`;
  jb.forEach((j, i) => {
    const checked = Object.entries(AUX_LABELS).filter(([k]) => j[k]).map(([, v]) => v);
    t += `직력${i + 1}: ${j.jobName || '-'} | ${j.period} | ${j.weight || '-'}kg | ${j.squatting || '-'}분 | ${j.burden.level}\n`;
    if (checked.length > 0) t += `  보조: ${checked.join(', ')}\n`;
  });
  t += `\n참고) 신체부담 정도는 다음의 4단계로 구분함.\n`;
  t += `1) 고도: 퇴행성 변화를 유발 또는 가속하는 것이 확실함(definite)\n`;
  t += `2) 중등도상: 퇴행성 변화를 유발 또는 가속하기에 충분함(probable)\n`;
  t += `3) 중등도하: 퇴행성 변화를 유발 또는 가속할 가능성이 있음(possible)\n`;
  t += `4) 경도: 퇴행성 변화를 유발 또는 가속하기 어려움(no related)\n`;
  t += `\n[신체부담기여도] ${r.min}% ~ ${r.max}%\n[누적신체부담] ${cum}\n\n[종합소견]\n`;

  data.diagnoses.forEach((d, i) => {
    if (d.code || d.name) {
      t += `\n상병 #${i + 1}: ${d.code} ${d.name}\n`;
      if (d.side === 'right' || d.side === 'both') {
        t += `  우측: 상병 상태(${getStatusText(d.confirmedRight)}) / 업무관련성(${d.assessmentRight === 'high' ? '높음' : d.assessmentRight === 'low' ? '낮음' : '-'})`;
        if (d.assessmentRight === 'low') t += `\n    낮음 사유:\n    - ${getReasonText(d.reasonRight, d.reasonRightOther).split('\n').join('\n    - ')}`;
        t += `\n`;
      }
      if (d.side === 'left' || d.side === 'both') {
        t += `  좌측: 상병 상태(${getStatusText(d.confirmedLeft)}) / 업무관련성(${d.assessmentLeft === 'high' ? '높음' : d.assessmentLeft === 'low' ? '낮음' : '-'})`;
        if (d.assessmentLeft === 'low') t += `\n    낮음 사유:\n    - ${getReasonText(d.reasonLeft, d.reasonLeftOther).split('\n').join('\n    - ')}`;
        t += `\n`;
      }
    }
  });

  if (data.returnConsiderations) t += `\n[복귀 관련 고려사항]\n${data.returnConsiderations}\n`;
  t += `\n${'─'.repeat(50)}\n${data.evaluationDate}\n${data.hospitalName} ${data.department}\n담당의: ${data.doctorName}`;
  return t;
};

export const generateEMRData = (data, c) => {
  const { age, bmi, relatedness: rel, cumulativeBurden: cum, jobBurdens: jb } = c || computePatientCalc(data);

  const b5 = data.diagnoses
    .filter(d => d.confirmedCode || d.confirmedName)
    .map(d => {
      let line = `${d.confirmedCode || ''} ${d.confirmedName || ''}`.trim();
      if (d.side === 'right' || d.side === 'both') {
        line += `\n  - 우측: 상병 상태(${getStatusText(d.confirmedRight)}) / 업무관련성(${d.assessmentRight === 'high' ? '높음' : d.assessmentRight === 'low' ? '낮음' : '-'})`;
        if (d.assessmentRight === 'low') line += `\n    업무관련성 평가 낮음 사유:\n    - ${getReasonText(d.reasonRight, d.reasonRightOther).split('\n').join('\n    - ')}`;
      }
      if (d.side === 'left' || d.side === 'both') {
        line += `\n  - 좌측: 상병 상태(${getStatusText(d.confirmedLeft)}) / 업무관련성(${d.assessmentLeft === 'high' ? '높음' : d.assessmentLeft === 'low' ? '낮음' : '-'})`;
        if (d.assessmentLeft === 'low') line += `\n    업무관련성 평가 낮음 사유:\n    - ${getReasonText(d.reasonLeft, d.reasonLeftOther).split('\n').join('\n    - ')}`;
      }
      return line;
    }).join('\n\n');

  const jobLines = jb.filter(j => j.jobName).map(j => {
    const checked = Object.entries(AUX_LABELS).filter(([k]) => j[k]).map(([, v]) => v);
    let line = `- ${j.jobName}: ${j.period} | 중량물 ${j.weight || '-'}kg | 쪼그려앉기 ${j.squatting || '-'}분 | 신체부담 ${j.burden.level}`;
    if (checked.length > 0) line += `\n  보조: ${checked.join(', ')}`;
    return line;
  }).join('\n');
  const avgRel = ((+rel.min + +rel.max) / 2).toFixed(1);
  const burdenNote = `참고) 신체부담 정도는 다음의 4단계로 구분함.\n1) 고도: 퇴행성 변화를 유발 또는 가속하는 것이 확실함(definite)\n2) 중등도상: 퇴행성 변화를 유발 또는 가속하기에 충분함(probable)\n3) 중등도하: 퇴행성 변화를 유발 또는 가속할 가능성이 있음(possible)\n4) 경도: 퇴행성 변화를 유발 또는 가속하기 어려움(no related)`;
  const b6 = `[직업력]\n${jobLines}\n\n${burdenNote}\n\n[신체부담기여도 평가]\n- 최소: ${rel.min}%\n- 최대: ${rel.max}%\n- 평균: ${avgRel}%\n\n[누적신체부담]\n- ${cum}`;

  const b7 = `- 키: ${data.height || '-'}cm\n- 몸무게: ${data.weight || '-'}kg\n- BMI: ${bmi || '-'}\n- 나이: ${age || '-'}세 (재해일 기준)\n- 특이사항: ${data.specialNotes || '없음'}`;

  const diagSummary = data.diagnoses.filter(d => d.code || d.name).map((d, i) => {
    let summary = `#${i + 1}. ${d.code} ${d.name} (${getSideText(d.side)})`;
    if (d.side === 'right' || d.side === 'both') {
      summary += `\n   상병 상태: ${getStatusText(d.confirmedRight)} / 업무관련성: ${d.assessmentRight === 'high' ? '높음' : d.assessmentRight === 'low' ? '낮음' : '-'}`;
      if (d.assessmentRight === 'low') summary += `\n   낮음 사유:\n   - ${getReasonText(d.reasonRight, d.reasonRightOther).split('\n').join('\n   - ')}`;
    }
    if (d.side === 'left' || d.side === 'both') {
      summary += `\n   상병 상태: ${getStatusText(d.confirmedLeft)} / 업무관련성: ${d.assessmentLeft === 'high' ? '높음' : d.assessmentLeft === 'low' ? '낮음' : '-'}`;
      if (d.assessmentLeft === 'low') summary += `\n   낮음 사유:\n   - ${getReasonText(d.reasonLeft, d.reasonLeftOther).split('\n').join('\n   - ')}`;
    }
    return summary;
  }).join('\n\n');
  const b8 = `[신체부담기여도]\n- 신체부담기여도: ${rel.min}% ~ ${rel.max}%\n- 누적신체부담: ${cum}\n\n[상병별 종합소견]\n${diagSummary}`;

  const b9 = data.returnConsiderations || '';

  return { b5, b6, b7, b8, b9 };
};

const buildWorkbook = (emrData) => {
  const { b5, b6, b7, b8, b9 } = emrData;
  const wb = XLSX.utils.book_new();
  const wsData = [
    ['업무관련성특별진찰소견서(근골격계질병)', ''],
    ['항목', '내용'],
    ['1.신청상병명', ''],
    ['2.진료기록 및 의학적 소견', ''],
    ['3.최종 확인 상병명', b5],
    ['4.직업적 요인', b6],
    ['5.개인적 요인', b7],
    ['6.종합소견', b8],
    ['7.복귀 관련 고려사항', b9]
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{ wch: 25 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, ws, '업무관련성특별진찰소견서(근골격계질병)');
  return wb;
};

export const exportExcelSingle = (formData, calc) => {
  const emrData = generateEMRData(formData, calc);
  const wb = buildWorkbook(emrData);
  XLSX.writeFile(wb, `업무관련성평가_${formData.name || '미입력'}_${new Date().toISOString().split('T')[0]}.xlsx`);
};

export const exportExcelBatch = async (patients) => {
  const validPatients = patients.filter(p => p.data.name);
  if (validPatients.length === 0) throw new Error('내보낼 환자가 없습니다 (이름 미입력)');
  const skipped = patients.length - validPatients.length;

  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  validPatients.forEach(p => {
    const d = p.data;
    const emrData = generateEMRData(d);
    const wb = buildWorkbook(emrData);
    const fileName = `${d.name || '미입력'}_${d.injuryDate || '미입력'}.xlsx`;
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    zip.file(fileName, buf);
  });

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `업무관련성평가_${validPatients.length}명_${new Date().toISOString().split('T')[0]}.zip`;
  a.click();
  URL.revokeObjectURL(url);

  return { exported: validPatients.length, skipped };
};

export const exportExcelSelected = async (patients, selectedIds) => {
  const selected = patients.filter(p => selectedIds.has(p.id) && p.data.name);
  if (selected.length === 0) throw new Error('선택된 환자가 없거나 이름이 미입력입니다');

  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  selected.forEach(p => {
    const d = p.data;
    const emrData = generateEMRData(d);
    const wb = buildWorkbook(emrData);
    const fileName = `${d.name || '미입력'}_${d.injuryDate || '미입력'}.xlsx`;
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    zip.file(fileName, buf);
  });

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `업무관련성평가_선택${selected.length}명_${new Date().toISOString().split('T')[0]}.zip`;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportPDF = (formData, calc) => {
  const { age, bmi, relatedness: r, cumulativeBurden: cum, jobBurdens: jb } = calc;
  const td = 'border:1px solid #ddd; padding:8px;';
  const th = `${td} background:#f5f5f5;`;
  const h3s = 'margin:20px 0 10px; font-size:14px;';

  const assessmentHtml = formData.diagnoses.filter(d => d.code || d.name).map((d, i) => {
    let html = `<div style="background:#f8f9fa; padding:12px; border-radius:8px; margin-bottom:10px;">`;
    html += `<div style="font-weight:bold; margin-bottom:8px;">상병 #${i + 1}: ${d.code} ${d.name} (${getSideText(d.side)})</div>`;
    const renderSide = (label, confirmed, assessment, reasons, reasonOther) => {
      let s = `<div style="margin-left:10px; margin-bottom:6px;">`;
      s += `<b>${label}:</b> 상병 상태(${getStatusText(confirmed)}) / 업무관련성(${assessment === 'high' ? '높음' : assessment === 'low' ? '낮음' : '-'})`;
      if (assessment === 'low' && reasons?.length) {
        s += `<div style="margin-left:15px; margin-top:4px; font-size:11px; color:#555;">낮음 사유: ${getReasonText(reasons, reasonOther).split('\n').join(', ')}</div>`;
      }
      s += `</div>`;
      return s;
    };
    if (d.side === 'right' || d.side === 'both') html += renderSide('우측', d.confirmedRight, d.assessmentRight, d.reasonRight, d.reasonRightOther);
    if (d.side === 'left' || d.side === 'both') html += renderSide('좌측', d.confirmedLeft, d.assessmentLeft, d.reasonLeft, d.reasonLeftOther);
    html += `</div>`;
    return html;
  }).join('');

  const content = document.createElement('div');
  content.style.cssText = 'font-family: "Noto Sans KR", sans-serif; padding: 40px; max-width: 800px; font-size: 12px; line-height: 1.6;';
  content.innerHTML = `
    <h1 style="text-align:center; margin-bottom:30px; font-size:18px; border-bottom:2px solid #333; padding-bottom:10px;">업무관련성 특별진찰 소견서</h1>
    <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
      <tr><td style="${th} width:120px;"><b>이름/성별</b></td><td style="${td}">${formData.name} (${formData.gender === 'male' ? '남' : formData.gender === 'female' ? '여' : '-'})</td><td style="${th} width:120px;"><b>키/몸무게</b></td><td style="${td}">${formData.height || '-'}cm / ${formData.weight || '-'}kg (BMI: ${bmi})</td></tr>
      <tr><td style="${th}"><b>생년월일</b></td><td style="${td}">${formData.birthDate || '-'}</td><td style="${th}"><b>재해일자</b></td><td style="${td}">${formData.injuryDate || '-'} (만 ${age}세)</td></tr>
    </table>
    <h3 style="${h3s}">📋 신청 상병</h3>
    <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
      ${formData.diagnoses.filter(d => d.code || d.name).map((d, i) => `<tr><td style="${td}">#${i + 1}. ${d.code} ${d.name} (${getSideText(d.side)})</td></tr>`).join('')}
    </table>
    ${formData.specialNotes ? `<h3 style="${h3s}">📝 특이사항</h3><div style="background:#f8f9fa; padding:12px; border-radius:8px; margin-bottom:20px; white-space:pre-wrap;">${formData.specialNotes}</div>` : ''}
    <h3 style="${h3s}">👷 직업력</h3>
    <table style="width:100%; border-collapse:collapse; margin-bottom:10px;">
      <tr style="background:#f5f5f5;"><th style="${td}">직종</th><th style="${td}">근무기간</th><th style="${td}">중량물</th><th style="${td}">쪼그려앉기</th><th style="${td}">신체부담</th></tr>
      ${jb.filter(j => j.jobName).map(j => {
        const aux = Object.entries(AUX_LABELS).filter(([k]) => j[k]).map(([, v]) => v);
        return `<tr><td style="${td}">${j.jobName}${aux.length ? `<div style="font-size:10px; color:#666; margin-top:2px;">보조: ${aux.join(', ')}</div>` : ''}</td><td style="${td}">${j.period}</td><td style="${td}">${j.weight || '-'}kg/일</td><td style="${td}">${j.squatting || '-'}분/일</td><td style="${td} font-weight:bold;">${j.burden.level}</td></tr>`;
      }).join('')}
    </table>
    <div style="font-size:11px; color:#555; margin-bottom:15px; line-height:1.6;">
      <b>참고)</b> 신체부담 정도는 다음의 4단계로 구분함.<br/>
      1) 고도: 퇴행성 변화를 유발 또는 가속하는 것이 확실함(definite)<br/>
      2) 중등도상: 퇴행성 변화를 유발 또는 가속하기에 충분함(probable)<br/>
      3) 중등도하: 퇴행성 변화를 유발 또는 가속할 가능성이 있음(possible)<br/>
      4) 경도: 퇴행성 변화를 유발 또는 가속하기 어려움(no related)
    </div>
    <div style="background:#667eea; color:white; padding:15px; border-radius:8px; margin:20px 0; text-align:center;">
      <div style="font-size:16px; font-weight:bold;">신체부담기여도: ${r.min}% ~ ${r.max}%</div>
      <div style="margin-top:5px;">누적신체부담: ${cum}</div>
    </div>
    <h3 style="${h3s}">📋 종합소견</h3>
    ${assessmentHtml}
    ${formData.returnConsiderations ? `<h3 style="${h3s}">💼 복귀 관련 고려사항</h3><div style="background:#f8f9fa; padding:12px; border-radius:8px; margin-bottom:20px; white-space:pre-wrap;">${formData.returnConsiderations}</div>` : ''}
    <div style="border-top:2px solid #333; margin-top:30px; padding-top:15px; text-align:center; font-size:12px; color:#555;">
      <div>${formData.evaluationDate || '-'}</div>
      <div style="margin-top:4px;">${formData.hospitalName || '-'} ${formData.department || ''}</div>
      <div style="margin-top:4px;">담당의: ${formData.doctorName || '-'}</div>
    </div>
  `;

  html2pdf().set({
    margin: 10,
    filename: `업무관련성평가_${formData.name || '미입력'}_${new Date().toISOString().split('T')[0]}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  }).from(content).save().then(() => {
    document.body.click();
  });
};
