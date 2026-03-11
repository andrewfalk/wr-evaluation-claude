export function BasicInfoTab({ formData, handleInput, errors, calc }) {
  return (
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
          <div className="form-group"><label>BMI</label><input value={calc.bmi || '-'} readOnly title="자동계산: 몸무게(kg) / 키(m)²" /></div>
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
          <div className="form-group"><label>만 나이</label><input value={calc.age ? `${calc.age}세` : '-'} readOnly title="재해일자 기준 자동계산" /></div>
        </div>
      </div>
      <div className="section">
        <h2 className="section-title"><span className="section-icon">2</span>특이사항</h2>
        <div className="form-group">
          <textarea rows="2" value={formData.specialNotes} onChange={e => handleInput('specialNotes', e.target.value)} placeholder="산재이력, 상병상태 등" title="산재이력, 상병상태, 휴식기간 등 기록" />
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
  );
}
