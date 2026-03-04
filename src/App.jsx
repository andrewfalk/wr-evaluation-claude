import { useState, useEffect, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';
import { useJobPresets } from './hooks/useJobPresets';
import { PresetSearch } from './components/PresetSearch';
import { BatchImportModal } from './components/BatchImportModal';
import { createPatient, createPatientData, createDiagnosis, KLG_OPTIONS } from './utils/data';
import {
  calculatePhysicalBurden, calculateWorkPeriod, formatWorkPeriod,
  calculateAge, calculateBMI, calculateWorkRelatedness, evaluateCumulativeBurden,
  getSideText, getStatusText, getKlgText, getReasonText,
  getEffectiveWorkPeriodText
} from './utils/calculations';

function App() {
  const [patients, setPatients] = useState([createPatient()]);
  const [activeId, setActiveId] = useState(patients[0].id);
  const [activeTab, setActiveTab] = useState('input');
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [savedItems, setSavedItems] = useState([]);
  const [saveName, setSaveName] = useState('');
  const [errors, setErrors] = useState({});
  const [showSidebar, setShowSidebar] = useState(false);
  
  const { presets, presetMeta, loading: presetLoading, error: presetError } = useJobPresets();
  
  const activePatient = patients.find(p => p.id === activeId) || patients[0];
  const formData = activePatient?.data || createPatientData();

  useEffect(() => {
    const s = localStorage.getItem('wrEvaluationSavedItems');
    if (s) setSavedItems(JSON.parse(s));
  }, []);

  const calc = useMemo(() => {
    const age = calculateAge(formData.birthDate, formData.injuryDate);
    const bmi = calculateBMI(formData.height, formData.weight);
    const rel = calculateWorkRelatedness(formData.jobs, age);
    const cum = evaluateCumulativeBurden(rel.min, rel.max);
    const jb = formData.jobs.map(j => ({
      ...j,
      burden: calculatePhysicalBurden(j.weight, j.squatting),
      period: getEffectiveWorkPeriodText(j)
    }));
    return { age, bmi, relatedness: rel, cumulativeBurden: cum, jobBurdens: jb };
  }, [formData]);

  const updatePatient = (updater) => {
    setPatients(prev => prev.map(p =>
      p.id === activeId
        ? { ...p, data: typeof updater === 'function' ? updater(p.data) : { ...p.data, ...updater } }
        : p
    ));
  };

  const handleInput = (f, v) => updatePatient(d => ({ ...d, [f]: v }));
  
  const handleDiagnosis = (i, f, v) => updatePatient(d => {
    const diags = [...d.diagnoses];
    diags[i] = { ...diags[i], [f]: v };
    return { ...d, diagnoses: diags };
  });
  
  const addDiagnosis = () => updatePatient(d => ({ ...d, diagnoses: [...d.diagnoses, createDiagnosis()] }));
  const removeDiagnosis = i => {
    if (formData.diagnoses.length > 1) {
      updatePatient(d => ({ ...d, diagnoses: d.diagnoses.filter((_, x) => x !== i) }));
    }
  };

  const handleJob = (i, f, v) => updatePatient(d => {
    const jobs = [...d.jobs];
    jobs[i] = { ...jobs[i], [f]: v };
    return { ...d, jobs };
  });

  const handlePresetSelect = (i, preset) => updatePatient(d => {
    const jobs = [...d.jobs];
    jobs[i] = {
      ...jobs[i],
      presetId: preset.id,
      jobName: preset.jobName,
      weight: String(preset.weight),
      squatting: String(preset.squatting)
    };
    return { ...d, jobs };
  });

  const addJob = () => updatePatient(d => ({
    ...d,
    jobs: [...d.jobs, {
      id: Date.now() + Math.random(),
      jobName: '', presetId: null, startDate: '', endDate: '', workPeriodOverride: '',
      evidenceSources: [], weight: '', squatting: '',
      stairs: false, kneeTwist: false, startStop: false,
      tightSpace: false, kneeContact: false, jumpDown: false
    }]
  }));

  const removeJob = i => {
    if (formData.jobs.length > 1) {
      updatePatient(d => ({ ...d, jobs: d.jobs.filter((_, x) => x !== i) }));
    }
  };

  const addPatient = () => {
    const p = createPatient();
    setPatients(prev => [...prev, p]);
    setActiveId(p.id);
  };

  const removePatient = (id) => {
    if (patients.length <= 1) return;
    const newPatients = patients.filter(p => p.id !== id);
    setPatients(newPatients);
    if (activeId === id) setActiveId(newPatients[0].id);
  };

  const handleBatchImport = (mergedPatients, stats) => {
    setPatients(mergedPatients);
    // 새 환자가 있으면 첫 번째 새 환자로 이동, 없으면 현재 유지
    if (stats.newPatients > 0) {
      const newPatient = mergedPatients[mergedPatients.length - stats.newPatients];
      if (newPatient) setActiveId(newPatient.id);
    }
    console.log(`Import 완료: 신규 환자 ${stats.newPatients}명, 추가 상병 ${stats.newDiagnoses}건, 추가 직종 ${stats.newJobs}건, 중복 ${stats.skipped}건`);
  };

  const validate = (data) => {
    const e = {};
    if (!data.name) e.name = '이름 필수';
    if (!data.birthDate) e.birthDate = '생년월일 필수';
    if (!data.injuryDate) e.injuryDate = '재해일자 필수';
    if (!data.diagnoses?.some(d => d.code && d.name)) e.diagnoses = '상병 1개 이상 필수';
    if (!data.jobs?.some(j => j.jobName)) e.jobs = '직종 1개 이상 필수';
    return e;
  };

  const handleSave = async () => {
    if (!saveName.trim()) {
      if (window.electron?.showAlert) await window.electron.showAlert('저장명 필수');
      else alert('저장명 필수');
      return;
    }
    const item = { id: Date.now(), name: saveName, count: patients.length, savedAt: new Date().toISOString(), patients };
    const items = [...savedItems, item];
    setSavedItems(items);
    localStorage.setItem('wrEvaluationSavedItems', JSON.stringify(items));
    setShowSaveModal(false);
    setSaveName('');
    if (window.electron?.showAlert) await window.electron.showAlert('저장됨');
    else alert('저장됨');
  };

  const handleLoad = item => {
    if (confirm('현재 데이터를 덮어쓰시겠습니까?')) {
      setPatients(item.patients);
      setActiveId(item.patients[0].id);
      setShowLoadModal(false);
    }
  };

  const handleDelete = id => {
    if (confirm('삭제?')) {
      const items = savedItems.filter(x => x.id !== id);
      setSavedItems(items);
      localStorage.setItem('wrEvaluationSavedItems', JSON.stringify(items));
    }
  };

  const genReport = (data) => {
    const age = calculateAge(data.birthDate, data.injuryDate);
    const bmi = calculateBMI(data.height, data.weight);
    const rel = calculateWorkRelatedness(data.jobs, age);
    const cum = evaluateCumulativeBurden(rel.min, rel.max);
    const jb = data.jobs.map(j => ({
      ...j,
      burden: calculatePhysicalBurden(j.weight, j.squatting),
      period: getEffectiveWorkPeriodText(j)
    }));

    let t = `업무관련성 특별진찰 소견서\n\n이름: ${data.name}(${data.gender === 'male' ? '남' : data.gender === 'female' ? '여' : ''})\n`;
    t += `키/몸무게: ${data.height || '-'}cm / ${data.weight || '-'}kg (BMI: ${bmi || '-'})\n`;
    t += `생년월일: ${data.birthDate || '-'}\n재해일자: ${data.injuryDate || '-'} (만 ${age}세)\n\n`;
    t += `[신청 상병]\n`;
    data.diagnoses.forEach((d, i) => {
      if (d.code || d.name) t += `#${i + 1}. ${d.code} ${d.name} (${getSideText(d.side)})\n`;
    });
    t += `\n[특이사항]\n${data.specialNotes || '-'}\n\n[직업력]\n`;
    const auxLabelsReport = { stairs: '계단오르내리기', kneeTwist: '무릎 비틀림', startStop: '출발/정지 반복', tightSpace: '좁은 공간', kneeContact: '무릎 접촉/충격', jumpDown: '뛰어내리기' };
    jb.forEach((j, i) => {
      const checked = Object.entries(auxLabelsReport).filter(([k]) => j[k]).map(([, v]) => v);
      t += `직력${i + 1}: ${j.jobName || '-'} | ${j.period} | ${j.weight || '-'}kg | ${j.squatting || '-'}분 | ${j.burden.level}\n`;
      if (checked.length > 0) t += `  보조: ${checked.join(', ')}\n`;
    });
    t += `\n[신체부담기여도] ${rel.min}% ~ ${rel.max}%\n[누적신체부담] ${cum}\n\n[종합소견]\n`;
    
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

  // EMR 서식용 Excel 데이터 생성 함수
  const generateEMRData = (data) => {
    const age = calculateAge(data.birthDate, data.injuryDate);
    const bmi = calculateBMI(data.height, data.weight);
    const rel = calculateWorkRelatedness(data.jobs, age);
    const cum = evaluateCumulativeBurden(rel.min, rel.max);
    const jb = data.jobs.map(j => ({
      ...j,
      burden: calculatePhysicalBurden(j.weight, j.squatting),
      period: getEffectiveWorkPeriodText(j)
    }));

    // B5: 최종 확인 상병명
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

    // B6: 직업적 요인
    const auxLabels = { stairs: '계단오르내리기', kneeTwist: '무릎 비틀림', startStop: '출발/정지 반복', tightSpace: '좁은 공간', kneeContact: '무릎 접촉/충격', jumpDown: '뛰어내리기' };
    const jobLines = jb.filter(j => j.jobName).map(j => {
      const checked = Object.entries(auxLabels).filter(([k]) => j[k]).map(([, v]) => v);
      let line = `- ${j.jobName}: ${j.period} | 중량물 ${j.weight || '-'}kg | 쪼그려앉기 ${j.squatting || '-'}분 | 신체부담 ${j.burden.level}`;
      if (checked.length > 0) line += `\n  보조: ${checked.join(', ')}`;
      return line;
    }).join('\n');
    const avgRel = ((+rel.min + +rel.max) / 2).toFixed(1);
    const b6 = `[직업력]\n${jobLines}\n\n[신체부담기여도 평가]\n- 최소: ${rel.min}%\n- 최대: ${rel.max}%\n- 평균: ${avgRel}%\n\n[누적신체부담]\n- ${cum}`;

    // B7: 개인적 요인
    const b7 = `- 키: ${data.height || '-'}cm\n- 몸무게: ${data.weight || '-'}kg\n- BMI: ${bmi || '-'}\n- 나이: ${age || '-'}세 (재해일 기준)\n- 특이사항: ${data.specialNotes || '없음'}`;

    // B8: 종합소견
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

    // B9: 복귀 관련 고려사항
    const b9 = data.returnConsiderations || '';

    return { b5, b6, b7, b8, b9 };
  };

  const handleExcelSingle = async () => {
    const e = validate(formData);
    setErrors(e);
    if (Object.keys(e).length) {
      if (window.electron?.showAlert) await window.electron.showAlert('필수항목 확인');
      else alert('필수항목 확인');
      return;
    }

    const { b5, b6, b7, b8, b9 } = generateEMRData(formData);

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
    XLSX.writeFile(wb, `업무관련성평가_${formData.name || '미입력'}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExcelBatch = async () => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    patients.forEach(p => {
      const d = p.data;
      const { b5, b6, b7, b8, b9 } = generateEMRData(d);
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

      const fileName = `${d.name || '미입력'}_${d.injuryDate || '미입력'}.xlsx`;
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      zip.file(fileName, buf);
    });

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `업무관련성평가_${patients.length}명_${new Date().toISOString().split('T')[0]}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePDF = async () => {
    const e = validate(formData);
    setErrors(e);
    if (Object.keys(e).length) {
      if (window.electron?.showAlert) await window.electron.showAlert('필수항목 확인');
      else alert('필수항목 확인');
      return;
    }
    
    const { age, bmi, relatedness: r, cumulativeBurden: c, jobBurdens: jb } = calc;
    const content = document.createElement('div');
    content.style.cssText = 'font-family: "Noto Sans KR", sans-serif; padding: 40px; max-width: 800px; font-size: 12px; line-height: 1.6;';
    content.innerHTML = `
      <h1 style="text-align:center; margin-bottom:30px; font-size:18px; border-bottom:2px solid #333; padding-bottom:10px;">업무관련성 특별진찰 소견서</h1>
      <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
        <tr><td style="border:1px solid #ddd; padding:8px; background:#f5f5f5; width:120px;"><b>이름/성별</b></td><td style="border:1px solid #ddd; padding:8px;">${formData.name} (${formData.gender === 'male' ? '남' : formData.gender === 'female' ? '여' : '-'})</td><td style="border:1px solid #ddd; padding:8px; background:#f5f5f5; width:120px;"><b>키/몸무게</b></td><td style="border:1px solid #ddd; padding:8px;">${formData.height || '-'}cm / ${formData.weight || '-'}kg (BMI: ${bmi})</td></tr>
        <tr><td style="border:1px solid #ddd; padding:8px; background:#f5f5f5;"><b>생년월일</b></td><td style="border:1px solid #ddd; padding:8px;">${formData.birthDate || '-'}</td><td style="border:1px solid #ddd; padding:8px; background:#f5f5f5;"><b>재해일자</b></td><td style="border:1px solid #ddd; padding:8px;">${formData.injuryDate || '-'} (만 ${age}세)</td></tr>
      </table>
      <h3 style="margin:20px 0 10px; font-size:14px;">📋 신청 상병</h3>
      <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
        ${formData.diagnoses.filter(d => d.code || d.name).map((d, i) => `<tr><td style="border:1px solid #ddd; padding:8px;">#${i + 1}. ${d.code} ${d.name} (${getSideText(d.side)})</td></tr>`).join('')}
      </table>
      <h3 style="margin:20px 0 10px; font-size:14px;">👷 직업력</h3>
      <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
        <tr style="background:#f5f5f5;"><th style="border:1px solid #ddd; padding:8px;">직종</th><th style="border:1px solid #ddd; padding:8px;">근무기간</th><th style="border:1px solid #ddd; padding:8px;">중량물</th><th style="border:1px solid #ddd; padding:8px;">쪼그려앉기</th><th style="border:1px solid #ddd; padding:8px;">신체부담</th></tr>
        ${jb.filter(j => j.jobName).map(j => `<tr><td style="border:1px solid #ddd; padding:8px;">${j.jobName}</td><td style="border:1px solid #ddd; padding:8px;">${j.period}</td><td style="border:1px solid #ddd; padding:8px;">${j.weight || '-'}kg/일</td><td style="border:1px solid #ddd; padding:8px;">${j.squatting || '-'}분/일</td><td style="border:1px solid #ddd; padding:8px; font-weight:bold;">${j.burden.level}</td></tr>`).join('')}
      </table>
      <div style="background:#667eea; color:white; padding:15px; border-radius:8px; margin:20px 0; text-align:center;">
        <div style="font-size:16px; font-weight:bold;">신체부담기여도: ${r.min}% ~ ${r.max}%</div>
        <div style="margin-top:5px;">누적신체부담: ${c}</div>
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

  if (presetLoading) {
    return (
      <div className="app-layout">
        <div className="panel" style={{ textAlign: 'center', padding: '60px', width: '100%' }}>
          <div className="loading-spinner"></div>
          <p>로딩중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* 사이드바 오버레이 (모바일) */}
      {showSidebar && <div className="sidebar-overlay" onClick={() => setShowSidebar(false)} />}
      {/* 사이드바 */}
      <div className={`sidebar ${showSidebar ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <h2>👥 환자 목록 ({patients.length})</h2>
          <div className="sidebar-actions">
            <button className="btn btn-primary btn-sm" onClick={addPatient}>+ 추가</button>
            <button className="btn btn-info btn-sm" onClick={() => setShowBatchImport(true)}>📥 일괄</button>
          </div>
        </div>
        <div className="patient-list">
          {patients.map((p, i) => (
            <div
              key={p.id}
              className={`patient-item ${p.id === activeId ? 'active' : ''}`}
              onClick={() => { setActiveId(p.id); setShowSidebar(false); }}
            >
              <div className="patient-item-name">{p.data.name || `환자 #${i + 1}`}</div>
              <div className="patient-item-info">{p.data.birthDate || '-'} | {p.data.diagnoses?.[0]?.name || '-'}</div>
              {patients.length > 1 && (
                <div className="patient-item-actions">
                  <button className="btn btn-danger btn-xs" onClick={e => { e.stopPropagation(); removePatient(p.id); }}>삭제</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 메인 영역 */}
      <div className="main-area">
        <header className="header">
          <h1>🏥 근골격계 질환 업무관련성 평가</h1>
          <div className="header-actions">
            <button className="btn btn-secondary btn-sm sidebar-toggle" onClick={() => setShowSidebar(v => !v)}>👥 환자 ({patients.length})</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowSaveModal(true)}>💾 저장</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowLoadModal(true)}>📂 불러오기</button>
            <button className="btn btn-success btn-sm" onClick={handleExcelSingle}>📊 Excel(현재)</button>
            <button className="btn btn-success btn-sm" onClick={handleExcelBatch}>📊 Excel(전체)</button>
            <button className="btn btn-primary btn-sm" onClick={handlePDF}>📄 PDF</button>
          </div>
        </header>

        <div className="main-content">
          {/* 입력 패널 */}
          <div className="panel">
            <div className="tabs">
              <button className={`tab ${activeTab === 'input' ? 'active' : ''}`} onClick={() => setActiveTab('input')}>기본정보</button>
              <button className={`tab ${activeTab === 'diagnosis' ? 'active' : ''}`} onClick={() => setActiveTab('diagnosis')}>신청상병 ({formData.diagnoses.length})</button>
              <button className={`tab ${activeTab === 'job' ? 'active' : ''}`} onClick={() => setActiveTab('job')}>직업력 ({formData.jobs.length})</button>
              <button className={`tab ${activeTab === 'assessment' ? 'active' : ''}`} onClick={() => setActiveTab('assessment')}>종합소견</button>
            </div>

            {activeTab === 'input' && (
              <>
                <div className="section">
                  <h2 className="section-title"><span className="section-icon">1</span>인적사항</h2>
                  <div className="form-row">
                    <div className="form-group">
                      <label>이름 *</label>
                      <input value={formData.name} onChange={e => handleInput('name', e.target.value)} />
                      {errors.name && <div className="error-message">{errors.name}</div>}
                    </div>
                    <div className="form-group">
                      <label>성별</label>
                      <div className="radio-group">
                        <label className="radio-label">
                          <input type="radio" name="gender" value="male" checked={formData.gender === 'male'} onChange={e => handleInput('gender', e.target.value)} />
                          <span>남</span>
                        </label>
                        <label className="radio-label">
                          <input type="radio" name="gender" value="female" checked={formData.gender === 'female'} onChange={e => handleInput('gender', e.target.value)} />
                          <span>여</span>
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label>키 (cm)</label><input type="number" value={formData.height} onChange={e => handleInput('height', e.target.value)} /></div>
                    <div className="form-group"><label>몸무게 (kg)</label><input type="number" value={formData.weight} onChange={e => handleInput('weight', e.target.value)} /></div>
                    <div className="form-group"><label>BMI</label><input value={calc.bmi || '-'} readOnly /></div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>생년월일 *</label>
                      <input type="date" max="9999-12-31" value={formData.birthDate} onChange={e => handleInput('birthDate', e.target.value)} />
                      {errors.birthDate && <div className="error-message">{errors.birthDate}</div>}
                    </div>
                    <div className="form-group">
                      <label>재해일자 *</label>
                      <input type="date" max="9999-12-31" value={formData.injuryDate} onChange={e => handleInput('injuryDate', e.target.value)} />
                      {errors.injuryDate && <div className="error-message">{errors.injuryDate}</div>}
                    </div>
                    <div className="form-group"><label>만 나이</label><input value={calc.age ? `${calc.age}세` : '-'} readOnly /></div>
                  </div>
                </div>
                <div className="section">
                  <h2 className="section-title"><span className="section-icon">2</span>특이사항</h2>
                  <div className="form-group">
                    <textarea rows="2" value={formData.specialNotes} onChange={e => handleInput('specialNotes', e.target.value)} placeholder="산재이력, 상병상태 등" />
                  </div>
                </div>
                <div className="section">
                  <h2 className="section-title"><span className="section-icon">3</span>평가기관</h2>
                  <div className="form-row">
                    <div className="form-group"><label>병원명</label><input value={formData.hospitalName} onChange={e => handleInput('hospitalName', e.target.value)} /></div>
                    <div className="form-group"><label>진료과</label><input value={formData.department} onChange={e => handleInput('department', e.target.value)} /></div>
                    <div className="form-group"><label>담당의</label><input value={formData.doctorName} onChange={e => handleInput('doctorName', e.target.value)} /></div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'diagnosis' && (
              <div className="section">
                <h2 className="section-title"><span className="section-icon">🩺</span>신청 상병</h2>
                {errors.diagnoses && <div className="error-message">{errors.diagnoses}</div>}
                {formData.diagnoses.map((diag, i) => (
                  <div key={diag.id} className="diagnosis-card">
                    <div className="diagnosis-card-header">
                      <span className="diagnosis-card-title">상병 #{i + 1}</span>
                      {formData.diagnoses.length > 1 && <button className="btn btn-danger btn-xs" onClick={() => removeDiagnosis(i)}>삭제</button>}
                    </div>
                    <div className="form-row">
                      <div className="form-group"><label>진단코드 *</label><input value={diag.code} onChange={e => handleDiagnosis(i, 'code', e.target.value)} placeholder="M17.0" /></div>
                      <div className="form-group"><label>진단명 *</label><input value={diag.name} onChange={e => handleDiagnosis(i, 'name', e.target.value)} placeholder="원발성 무릎 관절증" /></div>
                    </div>
                    <div className="form-group">
                      <label>부위</label>
                      <div className="radio-group">
                        {['right', 'left', 'both'].map(v => (
                          <label key={v} className="radio-label">
                            <input type="radio" name={`side_${i}`} value={v} checked={diag.side === v} onChange={e => handleDiagnosis(i, 'side', e.target.value)} />
                            <span>{v === 'right' ? '우측' : v === 'left' ? '좌측' : '양측'}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                <button className="btn btn-primary btn-sm" onClick={addDiagnosis}>+ 상병 추가</button>
              </div>
            )}

            {activeTab === 'job' && (
              <div className="section">
                <h2 className="section-title"><span className="section-icon">👷</span>직업력</h2>
                {presetMeta && <div className="preset-meta">📋 Preset: {presetMeta.count}개 직종{presetError && <span style={{ color: '#e67700', marginLeft: 10 }}>⚠️ {presetError}</span>}</div>}
                {errors.jobs && <div className="error-message">{errors.jobs}</div>}
                {formData.jobs.map((job, i) => {
                  const b = calculatePhysicalBurden(job.weight, job.squatting);
                  const bc = b.level === '고' ? 'badge-high' : b.level === '중상' ? 'badge-medium-high' : b.level === '중하' ? 'badge-medium-low' : 'badge-low';
                  return (
                    <div key={job.id} className="job-card">
                      <div className="job-card-header">
                        <span style={{ fontWeight: 600 }}>직력 {i + 1}</span>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span className={`job-badge ${bc}`}>{b.level} ({b.minScore}~{b.maxScore})</span>
                          {formData.jobs.length > 1 && <button className="btn btn-danger btn-xs" onClick={() => removeJob(i)}>삭제</button>}
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group" style={{ flex: 2 }}>
                          <label>직종명</label>
                          <PresetSearch presets={presets} value={job.jobName} onChange={v => handleJob(i, 'jobName', v)} onSelect={p => handlePresetSelect(i, p)} />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group"><label>시작일</label><input type="date" max="9999-12-31" value={job.startDate} onChange={e => handleJob(i, 'startDate', e.target.value)} /></div>
                        <div className="form-group"><label>종료일</label><input type="date" max="9999-12-31" value={job.endDate} onChange={e => handleJob(i, 'endDate', e.target.value)} /></div>
                        <div className="form-group">
                          <label>기간 {job.workPeriodOverride ? '(수동)' : '(자동)'}</label>
                          {(() => {
                            const auto = formatWorkPeriod(job.startDate, job.endDate);
                            const src = job.workPeriodOverride || auto;
                            const yVal = src.match(/(\d+)\s*년/)?.[1] || '';
                            const mVal = src.match(/(\d+)\s*개월/)?.[1] || '';
                            const ovr = job.workPeriodOverride;
                            const ovrStyle = ovr ? { borderColor: '#667eea', background: '#f0f3ff' } : {};
                            return (
                              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                <input type="number" min="0" style={{ width: 70, ...ovrStyle }} value={yVal}
                                  onChange={e => {
                                    const y = parseInt(e.target.value) || 0;
                                    const m = parseInt(job.workPeriodOverride?.match(/(\d+)\s*개월/)?.[1]) || 0;
                                    handleJob(i, 'workPeriodOverride', (y || m) ? `${y}년 ${m}개월` : '');
                                  }} />
                                <span>년</span>
                                <input type="number" min="0" max="11" style={{ width: 70, ...ovrStyle }} value={mVal}
                                  onChange={e => {
                                    const m = parseInt(e.target.value) || 0;
                                    const y = parseInt(job.workPeriodOverride?.match(/(\d+)\s*년/)?.[1]) || 0;
                                    handleJob(i, 'workPeriodOverride', (y || m) ? `${y}년 ${m}개월` : '');
                                  }} />
                                <span>개월</span>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group"><label>쪼그려앉기 (분/일)</label><input type="number" value={job.squatting} onChange={e => handleJob(i, 'squatting', e.target.value)} min="0" /></div>
                        <div className="form-group"><label>중량물 (kg/일)</label><input type="number" value={job.weight} onChange={e => handleJob(i, 'weight', e.target.value)} min="0" /></div>
                      </div>
                      <div className="form-row" style={{ flexWrap: 'wrap', gap: '8px 16px', marginTop: 4 }}>
                        <label className="checkbox-label"><input type="checkbox" checked={job.stairs} onChange={e => handleJob(i, 'stairs', e.target.checked)} /><span>계단오르내리기</span></label>
                        <label className="checkbox-label"><input type="checkbox" checked={job.kneeTwist} onChange={e => handleJob(i, 'kneeTwist', e.target.checked)} /><span>무릎 비틀림</span></label>
                        <label className="checkbox-label"><input type="checkbox" checked={job.startStop} onChange={e => handleJob(i, 'startStop', e.target.checked)} /><span>출발/정지 반복</span></label>
                        <label className="checkbox-label"><input type="checkbox" checked={job.tightSpace} onChange={e => handleJob(i, 'tightSpace', e.target.checked)} /><span>좁은 공간</span></label>
                        <label className="checkbox-label"><input type="checkbox" checked={job.kneeContact} onChange={e => handleJob(i, 'kneeContact', e.target.checked)} /><span>무릎 접촉/충격</span></label>
                        <label className="checkbox-label"><input type="checkbox" checked={job.jumpDown} onChange={e => handleJob(i, 'jumpDown', e.target.checked)} /><span>뛰어내리기</span></label>
                      </div>
                    </div>
                  );
                })}
                <button className="btn btn-primary btn-sm" onClick={addJob}>+ 직종 추가</button>
              </div>
            )}

            {activeTab === 'assessment' && (
              <div className="section">
                <h2 className="section-title"><span className="section-icon">📋</span>종합소견</h2>
                {formData.diagnoses.map((diag, i) => (
                  <div key={diag.id} className="assessment-card">
                    <div className="assessment-card-header">
                      <div className="assessment-card-title">상병 #{i + 1}: {diag.code} {diag.name}</div>
                      <div className="assessment-card-subtitle">부위: {getSideText(diag.side)}</div>
                    </div>
                    {diag.side && (
                      <div className="klg-box">
                        <div className="klg-box-title">📋 KLG 등급</div>
                        <div className="form-row">
                          {(diag.side === 'right' || diag.side === 'both') && (
                            <div className="form-group">
                              <label>우측</label>
                              <select value={diag.klgRight} onChange={e => handleDiagnosis(i, 'klgRight', e.target.value)}>
                                {KLG_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                              </select>
                            </div>
                          )}
                          {(diag.side === 'left' || diag.side === 'both') && (
                            <div className="form-group">
                              <label>좌측</label>
                              <select value={diag.klgLeft} onChange={e => handleDiagnosis(i, 'klgLeft', e.target.value)}>
                                {KLG_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                              </select>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {(diag.side === 'right' || diag.side === 'both') && (
                      <div style={{ background: '#f8f9fa', padding: 12, borderRadius: 8, marginTop: 12 }}>
                        <h4 style={{ marginBottom: 8, color: '#1971c2', fontSize: '0.85rem' }}>▶ 우측</h4>
                        <div className="form-row">
                          <div className="form-group">
                            <label>상병 상태</label>
                            <select value={diag.confirmedRight} onChange={e => handleDiagnosis(i, 'confirmedRight', e.target.value)}>
                              <option value="">선택</option>
                              <option value="confirmed">확인</option>
                              <option value="unconfirmed">미확인</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label>업무관련성</label>
                            <select value={diag.assessmentRight} onChange={e => handleDiagnosis(i, 'assessmentRight', e.target.value)}>
                              <option value="">선택</option>
                              <option value="high">높음</option>
                              <option value="low">낮음</option>
                            </select>
                          </div>
                        </div>
                        {diag.assessmentRight === 'low' && (
                          <div className="form-group">
                            <label>업무관련성 평가 낮음 사유</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                              {[
                                { value: 'unrelated', label: '신체부담과 관련없는 상병' },
                                { value: 'mild', label: '상병 미확인/연령대비 경미' },
                                { value: 'delayed', label: '업무중단 후 상당기간 경과' },
                                { value: 'lowBurden', label: '누적 신체부담 낮음' },
                                { value: 'other', label: '기타' }
                              ].map(opt => (
                                <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
                                  <input
                                    type="checkbox"
                                    checked={(diag.reasonRight || []).includes(opt.value)}
                                    onChange={() => {
                                      const current = diag.reasonRight || [];
                                      const next = current.includes(opt.value)
                                        ? current.filter(v => v !== opt.value)
                                        : [...current, opt.value];
                                      handleDiagnosis(i, 'reasonRight', next);
                                    }}
                                  />
                                  {opt.label}
                                </label>
                              ))}
                            </div>
                            {(diag.reasonRight || []).includes('other') && <input value={diag.reasonRightOther} onChange={e => handleDiagnosis(i, 'reasonRightOther', e.target.value)} placeholder="기타 사유" style={{ marginTop: 8 }} />}
                          </div>
                        )}
                      </div>
                    )}
                    {(diag.side === 'left' || diag.side === 'both') && (
                      <div style={{ background: '#f8f9fa', padding: 12, borderRadius: 8, marginTop: 12 }}>
                        <h4 style={{ marginBottom: 8, color: '#2b8a3e', fontSize: '0.85rem' }}>▶ 좌측</h4>
                        <div className="form-row">
                          <div className="form-group">
                            <label>상병 상태</label>
                            <select value={diag.confirmedLeft} onChange={e => handleDiagnosis(i, 'confirmedLeft', e.target.value)}>
                              <option value="">선택</option>
                              <option value="confirmed">확인</option>
                              <option value="unconfirmed">미확인</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label>업무관련성</label>
                            <select value={diag.assessmentLeft} onChange={e => handleDiagnosis(i, 'assessmentLeft', e.target.value)}>
                              <option value="">선택</option>
                              <option value="high">높음</option>
                              <option value="low">낮음</option>
                            </select>
                          </div>
                        </div>
                        {diag.assessmentLeft === 'low' && (
                          <div className="form-group">
                            <label>업무관련성 평가 낮음 사유</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                              {[
                                { value: 'unrelated', label: '신체부담과 관련없는 상병' },
                                { value: 'mild', label: '상병 미확인/연령대비 경미' },
                                { value: 'delayed', label: '업무중단 후 상당기간 경과' },
                                { value: 'lowBurden', label: '누적 신체부담 낮음' },
                                { value: 'other', label: '기타' }
                              ].map(opt => (
                                <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
                                  <input
                                    type="checkbox"
                                    checked={(diag.reasonLeft || []).includes(opt.value)}
                                    onChange={() => {
                                      const current = diag.reasonLeft || [];
                                      const next = current.includes(opt.value)
                                        ? current.filter(v => v !== opt.value)
                                        : [...current, opt.value];
                                      handleDiagnosis(i, 'reasonLeft', next);
                                    }}
                                  />
                                  {opt.label}
                                </label>
                              ))}
                            </div>
                            {(diag.reasonLeft || []).includes('other') && <input value={diag.reasonLeftOther} onChange={e => handleDiagnosis(i, 'reasonLeftOther', e.target.value)} placeholder="기타 사유" style={{ marginTop: 8 }} />}
                          </div>
                        )}
                      </div>
                    )}
                    {!diag.side && <div style={{ padding: 15, textAlign: 'center', color: '#888', background: '#f8f9fa', borderRadius: 8, marginTop: 12 }}>⚠️ 신청상병에서 부위 선택 필요</div>}
                  </div>
                ))}
                <div className="section" style={{ marginTop: 20 }}>
                  <h2 className="section-title"><span className="section-icon">💼</span>복귀 고려사항</h2>
                  <textarea rows="3" style={{ width: '100%' }} value={formData.returnConsiderations} onChange={e => handleInput('returnConsiderations', e.target.value)} placeholder="업무 복귀 시 고려사항..." />
                </div>
              </div>
            )}
          </div>

          {/* 결과 패널 */}
          <div className="panel">
            <h2 className="section-title"><span className="section-icon">📊</span>결과</h2>
            <div className="result-card">
              <h3>신체부담기여도</h3>
              <div className="result-value">{calc.relatedness.min}% ~ {calc.relatedness.max}%</div>
              <div className="result-sub">평균: {((+calc.relatedness.min + +calc.relatedness.max) / 2).toFixed(1)}%</div>
            </div>
            <div className="assessment-box">
              <div className="assessment-row">
                <span>누적신체부담</span>
                <span className={`assessment-value ${calc.cumulativeBurden === '충분함' ? 'value-positive' : 'value-negative'}`}>{calc.cumulativeBurden}</span>
              </div>
              <div className="assessment-row">
                <span>만 나이</span>
                <span className="assessment-value value-neutral">{calc.age || '-'}세</span>
              </div>
            </div>
            <h3 style={{ margin: '15px 0 10px', fontSize: '0.9rem' }}>직종별 신체부담</h3>
            {calc.jobBurdens.filter(j => j.jobName).map((j, i) => (
              <div key={j.id} className="assessment-box" style={{ marginBottom: 8, padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>{j.jobName}</span>
                  <span className={`job-badge badge-${j.burden.level === '고' ? 'high' : j.burden.level === '중상' ? 'medium-high' : j.burden.level === '중하' ? 'medium-low' : 'low'}`}>{j.burden.level}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#666', marginTop: 4 }}>{j.period} | {j.weight || '-'}kg | {j.squatting || '-'}분</div>
              </div>
            ))}
            <h3 style={{ margin: '15px 0 10px', fontSize: '0.9rem' }}>미리보기</h3>
            <div className="preview-section">{genReport(formData)}</div>
          </div>
        </div>
      </div>

      {/* 모달들 */}
      {showBatchImport && <BatchImportModal onClose={() => setShowBatchImport(false)} onImport={handleBatchImport} existingPatients={patients} />}
      
      {showSaveModal && (
        <div className="modal-overlay" onClick={() => setShowSaveModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>💾 저장</h2>
            <p style={{ marginBottom: 15, color: '#666' }}>현재 {patients.length}명의 환자 데이터를 저장합니다</p>
            <div className="form-group">
              <label>저장명</label>
              <input value={saveName} onChange={e => setSaveName(e.target.value)} autoFocus />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 15 }}>
              <button className="btn btn-primary" onClick={handleSave}>저장</button>
              <button className="btn btn-secondary" onClick={() => setShowSaveModal(false)}>취소</button>
            </div>
          </div>
        </div>
      )}

      {showLoadModal && (
        <div className="modal-overlay" onClick={() => setShowLoadModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>📂 불러오기</h2>
            {savedItems.length === 0 ? (
              <p style={{ color: '#666', textAlign: 'center', padding: 20 }}>저장 데이터 없음</p>
            ) : (
              savedItems.map(item => (
                <div key={item.id} className="saved-item">
                  <div onClick={() => handleLoad(item)}>
                    <h4>{item.name}</h4>
                    <p style={{ fontSize: '0.8rem', color: '#666' }}>{item.count || 1}명 | {new Date(item.savedAt).toLocaleString('ko-KR')}</p>
                  </div>
                  <button className="btn btn-danger btn-xs" onClick={() => handleDelete(item.id)}>삭제</button>
                </div>
              ))
            )}
            <button className="btn btn-secondary" onClick={() => setShowLoadModal(false)} style={{ marginTop: 15, width: '100%' }}>닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
