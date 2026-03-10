import { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';
import { useJobPresets } from './hooks/useJobPresets';
import { BatchImportModal } from './components/BatchImportModal';
import { BasicInfoTab } from './components/BasicInfoTab';
import { DiagnosisTab } from './components/DiagnosisTab';
import { JobTab } from './components/JobTab';
import { AssessmentTab } from './components/AssessmentTab';
import { ResultPanel } from './components/ResultPanel';
import { createPatient, createPatientData, createDiagnosis, createJob, AUX_LABELS } from './utils/data';
import {
  computePatientCalc, getSideText, getStatusText, getReasonText
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
    if (s) {
      try { setSavedItems(JSON.parse(s)); }
      catch { localStorage.removeItem('wrEvaluationSavedItems'); }
    }
  }, []);

  const calc = useMemo(() => computePatientCalc(formData), [formData]);

  const updatePatient = (updater) => {
    setPatients(prev => prev.map(p =>
      p.id === activeId
        ? { ...p, data: typeof updater === 'function' ? updater(p.data) : { ...p.data, ...updater } }
        : p
    ));
    if (Object.keys(errors).length) setErrors({});
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
    jobs: [...d.jobs, createJob()]
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
    if (stats.newPatients > 0) {
      const newPatient = mergedPatients[mergedPatients.length - stats.newPatients];
      if (newPatient) setActiveId(newPatient.id);
    }
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

  const handleLoad = async (item) => {
    const confirmed = window.electron?.showConfirm
      ? await window.electron.showConfirm('현재 데이터를 덮어쓰시겠습니까?')
      : confirm('현재 데이터를 덮어쓰시겠습니까?');
    if (confirmed) {
      setPatients(item.patients);
      setActiveId(item.patients[0].id);
      setShowLoadModal(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = window.electron?.showConfirm
      ? await window.electron.showConfirm('삭제하시겠습니까?')
      : confirm('삭제하시겠습니까?');
    if (confirmed) {
      const items = savedItems.filter(x => x.id !== id);
      setSavedItems(items);
      localStorage.setItem('wrEvaluationSavedItems', JSON.stringify(items));
    }
  };

  // --- 리포트/내보내기 함수 ---

  const genReport = (data, c) => {
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

  const generateEMRData = (data, c) => {
    const { age, bmi, relatedness: rel, cumulativeBurden: cum, jobBurdens: jb } = c || computePatientCalc(data);

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
    const jobLines = jb.filter(j => j.jobName).map(j => {
      const checked = Object.entries(AUX_LABELS).filter(([k]) => j[k]).map(([, v]) => v);
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

    const { b5, b6, b7, b8, b9 } = generateEMRData(formData, calc);

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
    const validPatients = patients.filter(p => p.data.name);
    if (validPatients.length === 0) {
      if (window.electron?.showAlert) await window.electron.showAlert('내보낼 환자가 없습니다 (이름 미입력)');
      else alert('내보낼 환자가 없습니다 (이름 미입력)');
      return;
    }
    const skipped = patients.length - validPatients.length;

    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    validPatients.forEach(p => {
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
    a.download = `업무관련성평가_${validPatients.length}명_${new Date().toISOString().split('T')[0]}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    if (skipped > 0) {
      const msg = `${validPatients.length}명 내보냄 (이름 미입력 ${skipped}명 제외)`;
      if (window.electron?.showAlert) await window.electron.showAlert(msg);
      else alert(msg);
    }
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

            {activeTab === 'input' && <BasicInfoTab formData={formData} handleInput={handleInput} errors={errors} calc={calc} />}
            {activeTab === 'diagnosis' && <DiagnosisTab formData={formData} handleDiagnosis={handleDiagnosis} addDiagnosis={addDiagnosis} removeDiagnosis={removeDiagnosis} errors={errors} />}
            {activeTab === 'job' && <JobTab formData={formData} handleJob={handleJob} handlePresetSelect={handlePresetSelect} addJob={addJob} removeJob={removeJob} presets={presets} presetMeta={presetMeta} presetError={presetError} errors={errors} />}
            {activeTab === 'assessment' && <AssessmentTab formData={formData} handleDiagnosis={handleDiagnosis} handleInput={handleInput} />}
          </div>

          {/* 결과 패널 */}
          <ResultPanel calc={calc} previewText={genReport(formData, calc)} />
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
