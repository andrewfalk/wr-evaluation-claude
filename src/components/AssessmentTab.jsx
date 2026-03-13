import { KLG_OPTIONS, LOW_REASON_OPTIONS } from '../utils/data';
import { getSideText } from '../utils/calculations';

function SideAssessment({ diag, index, side, handleDiagnosis }) {
  const isRight = side === 'right';
  const color = isRight ? '#1971c2' : '#2b8a3e';
  const label = isRight ? '우측' : '좌측';
  const confirmedKey = isRight ? 'confirmedRight' : 'confirmedLeft';
  const assessmentKey = isRight ? 'assessmentRight' : 'assessmentLeft';
  const reasonKey = isRight ? 'reasonRight' : 'reasonLeft';
  const reasonOtherKey = isRight ? 'reasonRightOther' : 'reasonLeftOther';

  return (
    <div style={{ background: 'var(--card-bg)', padding: 12, borderRadius: 8, marginTop: 12 }}>
      <h4 style={{ marginBottom: 8, color, fontSize: '0.85rem' }}>▶ {label}</h4>
      <div className="form-row">
        <div className="form-group">
          <label>상병 상태</label>
          <select value={diag[confirmedKey]} onChange={e => handleDiagnosis(index, confirmedKey, e.target.value)} title="해당 부위 상병의 확인/미확인 판정">
            <option value="">선택</option>
            <option value="confirmed">확인</option>
            <option value="unconfirmed">미확인</option>
          </select>
        </div>
        <div className="form-group">
          <label>업무관련성</label>
          <select value={diag[assessmentKey]} onChange={e => handleDiagnosis(index, assessmentKey, e.target.value)} title="해당 부위의 업무관련성 높음/낮음 판정">
            <option value="">선택</option>
            <option value="high">높음</option>
            <option value="low">낮음</option>
          </select>
        </div>
      </div>
      {diag[assessmentKey] === 'low' && (
        <div className="form-group">
          <label>업무관련성 평가 낮음 사유</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
            {LOW_REASON_OPTIONS.map(opt => (
              <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={(diag[reasonKey] || []).includes(opt.value)}
                  onChange={() => {
                    const current = diag[reasonKey] || [];
                    const next = current.includes(opt.value)
                      ? current.filter(v => v !== opt.value)
                      : [...current, opt.value];
                    handleDiagnosis(index, reasonKey, next);
                  }}
                />
                {opt.label}
              </label>
            ))}
          </div>
          {(diag[reasonKey] || []).includes('other') && (
            <input value={diag[reasonOtherKey]} onChange={e => handleDiagnosis(index, reasonOtherKey, e.target.value)} placeholder="기타 사유" style={{ marginTop: 8 }} />
          )}
        </div>
      )}
    </div>
  );
}

export function AssessmentTab({ formData, handleDiagnosis, handleInput }) {
  return (
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
            <SideAssessment diag={diag} index={i} side="right" handleDiagnosis={handleDiagnosis} />
          )}
          {(diag.side === 'left' || diag.side === 'both') && (
            <SideAssessment diag={diag} index={i} side="left" handleDiagnosis={handleDiagnosis} />
          )}
          {!diag.side && <div style={{ padding: 15, textAlign: 'center', color: 'var(--text-muted)', background: 'var(--card-bg)', borderRadius: 8, marginTop: 12 }}>⚠️ 신청상병에서 부위 선택 필요</div>}
        </div>
      ))}
      <div className="section" style={{ marginTop: 20 }}>
        <h2 className="section-title"><span className="section-icon">💼</span>복귀 고려사항</h2>
        <textarea rows="3" style={{ width: '100%' }} value={formData.returnConsiderations} onChange={e => handleInput('returnConsiderations', e.target.value)} placeholder="업무 복귀 시 고려사항..." title="업무 복귀 시 고려해야 할 사항 입력" />
      </div>
    </div>
  );
}
