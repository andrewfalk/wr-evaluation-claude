export function DiagnosisTab({ formData, handleDiagnosis, addDiagnosis, removeDiagnosis, errors }) {
  return (
    <div className="section">
      <h2 className="section-title"><span className="section-icon">🩺</span>신청 상병</h2>
      {errors.diagnoses && <div className="error-message">{errors.diagnoses}</div>}
      {formData.diagnoses.map((diag, i) => (
        <div key={diag.id} className="diagnosis-card">
          <div className="diagnosis-card-header">
            <span className="diagnosis-card-title">상병 #{i + 1}</span>
            {formData.diagnoses.length > 1 && <button className="btn btn-danger btn-xs" onClick={() => removeDiagnosis(i)} title="이 상병 삭제">삭제</button>}
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
      <button className="btn btn-primary btn-sm" onClick={addDiagnosis} title="새 진단 상병 추가">+ 상병 추가</button>
    </div>
  );
}
