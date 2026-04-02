import { useState, useEffect, useMemo } from 'react';
import { useJobPresets } from './hooks/useJobPresets';
import { genReport, exportExcelSingle, exportExcelBatch, exportExcelSelected, exportPDF } from './utils/exportHandlers';
import { BatchImportModal } from './components/BatchImportModal';
import { BasicInfoTab } from './components/BasicInfoTab';
import { DiagnosisTab } from './components/DiagnosisTab';
import { JobTab } from './components/JobTab';
import { AssessmentTab } from './components/AssessmentTab';
import { ResultPanel } from './components/ResultPanel';
import { SettingsModal } from './components/SettingsModal';
import { createPatient, createPatientData, createDiagnosis, createJob, DEFAULT_SETTINGS, FONT_SIZE_MAP } from './utils/data';
import { computePatientCalc, isAssessmentComplete } from './utils/calculations';
import { usePatientList } from './hooks/usePatientList';
import { loadSavedItems, savePatientsData, deleteSavedItem, hasDuplicateName } from './utils/storageHandlers';
import { exportForUnified } from './utils/batchExport';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState('default');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [lastAutoSave, setLastAutoSave] = useState(null);
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('wrEvaluationSettings');
    if (saved) try { return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }; } catch {}
    return { ...DEFAULT_SETTINGS };
  });
  const [showSettings, setShowSettings] = useState(false);

  const { presets, presetMeta, loading: presetLoading, error: presetError } = useJobPresets();

  const activePatient = patients.find(p => p.id === activeId) || patients[0];
  const formData = activePatient?.data || createPatientData();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
    document.documentElement.style.fontSize = FONT_SIZE_MAP[settings.fontSize] || '16px';
  }, [settings.theme, settings.fontSize]);

  useEffect(() => {
    setSavedItems(loadSavedItems());
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('wrEvaluationAutoSave');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        const time = new Date(data.savedAt).toLocaleString('ko-KR');
        const doConfirm = window.electron?.showConfirm
          ? (msg) => window.electron.showConfirm(msg)
          : (msg) => Promise.resolve(confirm(msg));
        doConfirm(`이전 자동 저장 데이터가 있습니다 (${time}).\n이어서 작업하시겠습니까?`).then(ok => {
          if (ok) {
            setPatients(data.patients);
            setActiveId(data.patients[0].id);
          }
          localStorage.removeItem('wrEvaluationAutoSave');
        });
      } catch {
        localStorage.removeItem('wrEvaluationAutoSave');
      }
    }
  }, []);

  useEffect(() => {
    if (!settings.autoSaveInterval) return;
    const timer = setTimeout(() => {
      const data = { savedAt: new Date().toISOString(), patients };
      localStorage.setItem('wrEvaluationAutoSave', JSON.stringify(data));
      setLastAutoSave(new Date());
    }, settings.autoSaveInterval * 1000);
    return () => clearTimeout(timer);
  }, [patients, settings.autoSaveInterval]);

  const calc = useMemo(() => computePatientCalc(formData), [formData]);

  const displayPatients = usePatientList(patients, searchQuery, sortKey, statusFilter);

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
    p.data.hospitalName = settings.hospitalName;
    p.data.department = settings.department;
    p.data.doctorName = settings.doctorName;
    setPatients(prev => [...prev, p]);
    setActiveId(p.id);
  };

  const removePatient = (id) => {
    if (patients.length <= 1) return;
    const newPatients = patients.filter(p => p.id !== id);
    setPatients(newPatients);
    if (activeId === id) setActiveId(newPatients[0].id);
  };

  const removeSelectedPatients = async () => {
    if (selectedIds.size === 0) return;
    if (selectedIds.size >= patients.length) {
      const msg = '최소 1명의 환자는 유지해야 합니다';
      if (window.electron?.showAlert) await window.electron.showAlert(msg);
      else alert(msg);
      return;
    }
    const confirmed = window.electron?.showConfirm
      ? await window.electron.showConfirm(`선택된 ${selectedIds.size}명의 환자를 삭제하시겠습니까?`)
      : confirm(`선택된 ${selectedIds.size}명의 환자를 삭제하시겠습니까?`);
    if (!confirmed) return;
    const newPatients = patients.filter(p => !selectedIds.has(p.id));
    setPatients(newPatients);
    if (selectedIds.has(activeId)) setActiveId(newPatients[0].id);
    setSelectedIds(new Set());
  };

  const handleSaveSettings = (newSettings) => {
    setSettings(newSettings);
    localStorage.setItem('wrEvaluationSettings', JSON.stringify(newSettings));
    setShowSettings(false);
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
    if (hasDuplicateName(saveName, savedItems)) {
      const confirmed = window.electron?.showConfirm
        ? await window.electron.showConfirm(`"${saveName}" 이름의 저장 데이터가 이미 존재합니다. 덮어쓰시겠습니까?`)
        : confirm(`"${saveName}" 이름의 저장 데이터가 이미 존재합니다. 덮어쓰시겠습니까?`);
      if (!confirmed) return;
    }
    const items = savePatientsData(saveName, patients, savedItems);
    setSavedItems(items);
    setLastAutoSave(null);
    setShowSaveModal(false);
    setSaveName('');
    if (window.electron?.showAlert) await window.electron.showAlert('저장됨');
    else alert('저장됨');
  };

  const handleLoad = async (item, mode = 'overwrite') => {
    if (mode === 'overwrite') {
      const confirmed = window.electron?.showConfirm
        ? await window.electron.showConfirm('현재 데이터를 덮어쓰시겠습니까?')
        : confirm('현재 데이터를 덮어쓰시겠습니까?');
      if (!confirmed) return;
      setPatients(item.patients);
      setActiveId(item.patients[0].id);
    } else {
      const newPatients = item.patients.map(p => ({ ...p, id: Date.now() + Math.random() }));
      setPatients(prev => [...prev, ...newPatients]);
      setActiveId(newPatients[0].id);
    }
    setShowLoadModal(false);
  };

  const handleDelete = async (id) => {
    const confirmed = window.electron?.showConfirm
      ? await window.electron.showConfirm('삭제하시겠습니까?')
      : confirm('삭제하시겠습니까?');
    if (confirmed) {
      setSavedItems(deleteSavedItem(id, savedItems));
    }
  };

  // --- 리포트/내보내기 핸들러 ---

  const handleExcelSingle = async () => {
    const e = validate(formData);
    setErrors(e);
    if (Object.keys(e).length) {
      if (window.electron?.showAlert) await window.electron.showAlert('필수항목 확인');
      else alert('필수항목 확인');
      return;
    }
    exportExcelSingle(formData, calc);
  };

  const handleExcelBatch = async () => {
    try {
      const { skipped } = await exportExcelBatch(patients);
      if (skipped > 0) {
        const msg = `${patients.length - skipped}명 내보냄 (이름 미입력 ${skipped}명 제외)`;
        if (window.electron?.showAlert) await window.electron.showAlert(msg);
        else alert(msg);
      }
    } catch (err) {
      if (window.electron?.showAlert) await window.electron.showAlert(err.message);
      else alert(err.message);
    }
  };

  const handleExcelSelected = async () => {
    try {
      await exportExcelSelected(patients, selectedIds);
    } catch (err) {
      if (window.electron?.showAlert) await window.electron.showAlert(err.message);
      else alert(err.message);
    }
  };

  const handleUnifiedSingle = async () => {
    const e = validate(formData);
    setErrors(e);
    if (Object.keys(e).length) {
      if (window.electron?.showAlert) await window.electron.showAlert('필수항목 확인');
      else alert('필수항목 확인');
      return;
    }
    exportForUnified([activePatient]);
  };

  const handleUnifiedBatch = async () => {
    try {
      const validPatients = patients.filter(p => p.data.name);
      if (validPatients.length === 0) throw new Error('내보낼 환자가 없습니다 (이름 미입력)');
      const skipped = patients.length - validPatients.length;
      exportForUnified(validPatients);
      if (skipped > 0) {
        const msg = `${validPatients.length}명 내보냄 (이름 미입력 ${skipped}명 제외)`;
        if (window.electron?.showAlert) await window.electron.showAlert(msg);
        else alert(msg);
      }
    } catch (err) {
      if (window.electron?.showAlert) await window.electron.showAlert(err.message);
      else alert(err.message);
    }
  };

  const handleUnifiedSelected = async () => {
    try {
      const selected = patients.filter(p => selectedIds.has(p.id) && p.data.name);
      if (selected.length === 0) throw new Error('선택된 환자가 없거나 이름이 미입력입니다');
      exportForUnified(selected);
    } catch (err) {
      if (window.electron?.showAlert) await window.electron.showAlert(err.message);
      else alert(err.message);
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
    exportPDF(formData, calc);
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
          <h2>👥 환자 목록 ({(searchQuery.trim() || statusFilter !== 'all') ? `${displayPatients.length}/${patients.length}` : patients.length})</h2>
          <div className="sidebar-actions">
            <button className="btn btn-primary btn-sm" onClick={addPatient} title="새 환자 추가">+ 추가</button>
            <button className="btn btn-info btn-sm" onClick={() => setShowBatchImport(true)} title="Excel/CSV 파일에서 여러 환자 일괄 가져오기">📥 일괄</button>
          </div>
        </div>
        <div className="sidebar-filter">
          <input
            type="search"
            placeholder="검색 (이름, 진단, 직종)"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', padding: '4px 0' }}>
            <input type="checkbox" checked={displayPatients.length > 0 && displayPatients.every(p => selectedIds.has(p.id))} onChange={e => {
              setSelectedIds(prev => {
                const next = new Set(prev);
                displayPatients.forEach(p => e.target.checked ? next.add(p.id) : next.delete(p.id));
                return next;
              });
            }} />
            <span style={{ whiteSpace: 'nowrap' }}>전체선택{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}</span>
            {selectedIds.size > 0 && (
              <button className="btn btn-danger btn-xs" onClick={removeSelectedPatients} title="선택된 환자 일괄 삭제" style={{ marginLeft: 'auto', fontSize: '0.7rem' }}>삭제</button>
            )}
          </div>
          <div className="sidebar-filter-row">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} title="종합소견 완료/미완료 기준 필터">
              <option value="all">전체</option>
              <option value="complete">완료</option>
              <option value="incomplete">미완료</option>
            </select>
            <select value={sortKey} onChange={e => setSortKey(e.target.value)} title="환자 목록 정렬 기준 변경">
              <option value="default">입력순</option>
              <option value="name">이름순</option>
              <option value="birthDate">생년월일순</option>
              <option value="evaluationDate">평가일순</option>
            </select>
          </div>
        </div>
        <div className="patient-list">
          {displayPatients.map(p => {
            const origIndex = patients.indexOf(p);
            return (
              <div
                key={p.id}
                className={`patient-item ${p.id === activeId ? 'active' : ''}`}
                onClick={() => { setActiveId(p.id); setShowSidebar(false); }}
              >
                <div className="patient-item-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" checked={selectedIds.has(p.id)} onClick={e => e.stopPropagation()} onChange={() => {
                    setSelectedIds(prev => {
                      const next = new Set(prev);
                      next.has(p.id) ? next.delete(p.id) : next.add(p.id);
                      return next;
                    });
                  }} />
                  <span style={{ flex: 1 }}>{p.data.name || `환자 #${origIndex + 1}`}</span>
                  <span className={isAssessmentComplete(p.data) ? 'status-dot complete' : 'status-dot'} title={isAssessmentComplete(p.data) ? '종합소견 입력 완료' : '종합소견 미완료'}>
                    {isAssessmentComplete(p.data) ? '●' : '●'}
                  </span>
                </div>
                <div className="patient-item-info">{p.data.birthDate || '-'} | {p.data.diagnoses?.[0]?.name || '-'}</div>
                {patients.length > 1 && (
                  <div className="patient-item-actions">
                    <button className="btn btn-danger btn-xs" onClick={e => { e.stopPropagation(); removePatient(p.id); }}>삭제</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 메인 영역 */}
      <div className="main-area">
        <header className="header">
          <h1>🏥 근골격계 질환 업무관련성 평가{lastAutoSave && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 8, fontWeight: 400 }} title="마지막 자동 저장 시각">💾 {lastAutoSave.toLocaleTimeString('ko-KR')}</span>}</h1>
          <div className="header-actions">
            <button className="btn btn-secondary btn-sm sidebar-toggle" onClick={() => setShowSidebar(v => !v)} title="환자 목록 사이드바 열기/닫기">👥 환자 ({patients.length})</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowSaveModal(true)} title="현재 데이터를 로컬에 저장">💾 저장</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowLoadModal(true)} title="저장된 데이터 불러오기">📂 불러오기</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowSettings(true)} title="앱 설정 (테마, 폰트, 기본값 등)">⚙ 설정</button>
            <button className="btn btn-success btn-sm" onClick={handleExcelSingle} title="현재 환자 EMR 서식 Excel 내보내기">📊 EMR(현재)</button>
            {selectedIds.size > 0 && <button className="btn btn-success btn-sm" onClick={handleExcelSelected} title={`선택된 ${selectedIds.size}명 EMR 서식 Excel 내보내기 (ZIP)`}>📊 EMR(선택 {selectedIds.size})</button>}
            <button className="btn btn-success btn-sm" onClick={handleExcelBatch} title="전체 환자 EMR 서식 Excel 일괄 내보내기 (ZIP)">📊 EMR(전체)</button>
            <button className="btn btn-info btn-sm" onClick={handleUnifiedSingle} title="현재 환자 일괄입력 서식 Excel 내보내기">📋 일괄(현재)</button>
            {selectedIds.size > 0 && <button className="btn btn-info btn-sm" onClick={handleUnifiedSelected} title={`선택된 ${selectedIds.size}명 일괄입력 서식 Excel 내보내기`}>📋 일괄(선택 {selectedIds.size})</button>}
            <button className="btn btn-info btn-sm" onClick={handleUnifiedBatch} title="전체 환자 일괄입력 서식 Excel 내보내기">📋 일괄(전체)</button>
            <button className="btn btn-primary btn-sm" onClick={handlePDF} title="현재 환자 PDF 내보내기">📄 PDF</button>
          </div>
        </header>

        <div className="main-content">
          {/* 입력 패널 */}
          <div className="panel">
            <div className="tabs">
              <button className={`tab ${activeTab === 'input' ? 'active' : ''}`} onClick={() => setActiveTab('input')} title="인적사항, 특이사항, 평가기관 입력">기본정보</button>
              <button className={`tab ${activeTab === 'diagnosis' ? 'active' : ''}`} onClick={() => setActiveTab('diagnosis')} title="진단코드 및 진단명 입력">신청상병 ({formData.diagnoses.length})</button>
              <button className={`tab ${activeTab === 'job' ? 'active' : ''}`} onClick={() => setActiveTab('job')} title="직종, 근무기간, 신체부담 요인 입력">직업력 ({formData.jobs.length})</button>
              <button className={`tab ${activeTab === 'assessment' ? 'active' : ''}`} onClick={() => setActiveTab('assessment')} title="KLG 등급, 상병확인, 업무관련성 평가">종합소견</button>
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
      {showSettings && <SettingsModal settings={settings} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />}

      {showSaveModal && (
        <div className="modal-overlay" onClick={() => setShowSaveModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>💾 저장</h2>
            <p style={{ marginBottom: 15, color: 'var(--text-muted)' }}>현재 {patients.length}명의 환자 데이터를 저장합니다</p>
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
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>저장 데이터 없음</p>
            ) : (
              savedItems.map(item => (
                <div key={item.id} className="saved-item">
                  <div>
                    <h4>{item.name}</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.count || 1}명 | {new Date(item.savedAt).toLocaleString('ko-KR')}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <button className="btn btn-primary btn-xs" onClick={() => handleLoad(item, 'overwrite')} title="기존 데이터를 삭제하고 이 저장 데이터로 교체">덮어쓰기</button>
                    <button className="btn btn-info btn-xs" onClick={() => handleLoad(item, 'append')} title="기존 데이터를 유지하고 이 저장 데이터를 뒤에 추가">추가</button>
                    <button className="btn btn-secondary btn-xs" onClick={() => exportForUnified(item.patients)} title="통합 프로그램(무릎+척추)에서 일괄 Import 가능한 엑셀 파일로 내보내기">통합용 내보내기</button>
                    <button className="btn btn-danger btn-xs" onClick={() => handleDelete(item.id)}>삭제</button>
                  </div>
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
