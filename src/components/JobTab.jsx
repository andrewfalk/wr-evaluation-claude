import { PresetSearch } from './PresetSearch';
import { calculatePhysicalBurden, formatWorkPeriod } from '../utils/calculations';

export function JobTab({ formData, handleJob, handlePresetSelect, addJob, removeJob, presets, presetMeta, presetError, errors }) {
  return (
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
  );
}
