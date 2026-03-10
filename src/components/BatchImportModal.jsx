import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { createPatient, createDiagnosis, createJob } from '../utils/data';
import { formatWorkPeriod } from '../utils/calculations';

export function BatchImportModal({ onClose, onImport, existingPatients = [] }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [columns, setColumns] = useState([]);
  const [dragover, setDragover] = useState(false);
  const fileRef = useRef();

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (json.length > 0) {
          setColumns(json[0]);
          setPreview(json);
        }
      } catch (err) {
        if (window.electron?.showAlert) window.electron.showAlert('파일 읽기 오류: ' + err.message);
        else alert('파일 읽기 오류: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(f);
  };

  const handleImport = async () => {
    if (!preview || preview.length < 2) {
      if (window.electron?.showAlert) await window.electron.showAlert('데이터가 없습니다');
      else alert('데이터가 없습니다');
      return;
    }

    const headers = preview[0].map(h => (h || '').toString().toLowerCase());
    const findCol = (keywords) => headers.findIndex(h => keywords.some(k => h.includes(k)));

    // 29개 변수 매핑 (기존 25개 + KLG 2개 + 근무기간 2개)
    const colMap = {
      // 기본 정보 (5개)
      name: findCol(['이름', 'name']),
      birthDate: findCol(['생년월일', 'birth']),
      injuryDate: findCol(['재해', 'injury']),
      height: findCol(['키', 'height']),
      weight: findCol(['몸무게', 'weight']),
      // 신규 추가 (6개)
      gender: findCol(['성별', 'gender', 'sex']),
      hospitalName: findCol(['병원', 'hospital']),
      department: findCol(['진료과', 'department', 'dept']),
      doctorName: findCol(['담당의', 'doctor', '의사']),
      specialNotes: findCol(['특이사항', 'special', 'note']),
      returnConsiderations: findCol(['복귀', 'return', 'consideration']),
      // 상병 정보 (3개)
      diagCode: findCol(['진단코드', 'code']),
      diagName: findCol(['진단명', 'diag']),
      side: findCol(['부위', 'side']),
      // 직업 정보 (7개)
      jobName: findCol(['직종', 'job']),
      jobStart: findCol(['시작', 'start']),
      jobEnd: findCol(['종료', 'end']),
      jobPeriodY: findCol(['근무기간(년)', '기간(년)', 'period_y']),
      jobPeriodM: findCol(['근무기간(개월)', '기간(개월)', 'period_m']),
      jobWeight: findCol(['중량', 'kg']),
      jobSquat: findCol(['쪼그', 'squat']),
      // KLG 등급 (2개)
      klgRight: findCol(['klg(우측)', 'klg우측', 'klg_right', 'klg(right)']),
      klgLeft: findCol(['klg(좌측)', 'klg좌측', 'klg_left', 'klg(left)']),
      // 보조 변수 (6개)
      stairs: findCol(['계단', 'stair']),
      kneeTwist: findCol(['비틀', 'twist']),
      startStop: findCol(['출발', 'start_stop', '정지']),
      tightSpace: findCol(['좁은', 'tight', 'space']),
      kneeContact: findCol(['접촉', 'contact', '충격']),
      jumpDown: findCol(['뛰어', 'jump'])
    };

    const sideMap = {
      '우측': 'right', '좌측': 'left', '양측': 'both',
      'right': 'right', 'left': 'left', 'both': 'both'
    };

    const genderMap = {
      '남': 'male', '여': 'female', '남자': 'male', '여자': 'female',
      'male': 'male', 'female': 'female', 'm': 'male', 'f': 'female'
    };

    const parseDate = (v) => {
      if (!v) return '';
      if (typeof v === 'number') {
        const d = XLSX.SSF.parse_date_code(v);
        return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
      }
      return String(v);
    };

    const getVal = (row, key) => {
      const idx = colMap[key];
      return idx >= 0 ? row[idx] : undefined;
    };

    const parseBool = (v) => {
      if (!v) return false;
      const s = String(v).toLowerCase().trim();
      return ['true', '1', 'o', 'yes', 'y', '예', '○', '유'].includes(s);
    };

    const parseKlg = (v) => {
      if (!v) return '';
      const s = String(v).trim();
      if (s === 'N/A' || s === '해당없음') return 'N/A';
      const m = s.match(/(\d)/);
      return m ? m[1] : '';
    };

    const applyKlg = (diag, side, klgRight, klgLeft) => {
      if (side === 'right' || side === 'both') diag.klgRight = klgRight;
      if (side === 'left' || side === 'both') diag.klgLeft = klgLeft;
    };

    // 통계 추적
    let stats = { newPatients: 0, newDiagnoses: 0, newJobs: 0, skipped: 0 };

    // 결과 환자 목록 (기존 환자 복사본으로 시작)
    const resultPatients = existingPatients.map(p => ({
      ...p,
      data: {
        ...p.data,
        diagnoses: [...p.data.diagnoses],
        jobs: [...p.data.jobs]
      }
    }));

    // 각 행 처리
    for (let i = 1; i < preview.length; i++) {
      const row = preview[i];
      if (!row || row.length === 0 || !getVal(row, 'name')) continue;

      const rowName = String(getVal(row, 'name') || '').trim();
      const rowBirthDate = parseDate(getVal(row, 'birthDate'));
      const rowDiagCode = String(getVal(row, 'diagCode') || '').trim();
      const rowDiagName = String(getVal(row, 'diagName') || '').trim();
      const rowSide = sideMap[(String(getVal(row, 'side') || '')).toLowerCase()] || '';
      const rowJobName = String(getVal(row, 'jobName') || '').trim();
      const rowKlgRight = parseKlg(getVal(row, 'klgRight'));
      const rowKlgLeft = parseKlg(getVal(row, 'klgLeft'));

      // 3. 환자 찾기 (이름 + 생년월일 + 재해일자)
      const rowInjuryDate = parseDate(getVal(row, 'injuryDate'));
      let existingPatient = resultPatients.find(p =>
        p.data.name === rowName && p.data.birthDate === rowBirthDate && p.data.injuryDate === rowInjuryDate
      );

      if (!existingPatient) {
        // 3-1: 새 환자 추가
        const p = createPatient();
        p.data.name = rowName;
        p.data.birthDate = rowBirthDate;
        p.data.injuryDate = rowInjuryDate;
        p.data.height = getVal(row, 'height') ? String(getVal(row, 'height')) : '';
        p.data.weight = getVal(row, 'weight') ? String(getVal(row, 'weight')) : '';

        // 신규 6개 필드
        p.data.gender = genderMap[(String(getVal(row, 'gender') || '')).toLowerCase()] || '';
        p.data.hospitalName = String(getVal(row, 'hospitalName') || '');
        p.data.department = String(getVal(row, 'department') || '');
        p.data.doctorName = String(getVal(row, 'doctorName') || '');
        p.data.specialNotes = String(getVal(row, 'specialNotes') || '');
        p.data.returnConsiderations = String(getVal(row, 'returnConsiderations') || '');

        // 상병 추가
        if (rowDiagCode || rowDiagName) {
          const newDiag = {
            ...createDiagnosis(),
            code: rowDiagCode,
            name: rowDiagName,
            side: rowSide
          };
          applyKlg(newDiag, rowSide, rowKlgRight, rowKlgLeft);
          p.data.diagnoses = [newDiag];
        }

        // 직업 추가
        if (rowJobName) {
          p.data.jobs = [{
            ...createJob(),
            jobName: rowJobName,
            startDate: parseDate(getVal(row, 'jobStart')),
            endDate: parseDate(getVal(row, 'jobEnd')),
            workPeriodOverride: (() => {
              const y = parseInt(getVal(row, 'jobPeriodY')) || 0;
              const m = parseInt(getVal(row, 'jobPeriodM')) || 0;
              if (!y && !m) return '';
              const imported = `${y}년 ${m}개월`;
              const auto = formatWorkPeriod(parseDate(getVal(row, 'jobStart')), parseDate(getVal(row, 'jobEnd')));
              return imported !== auto ? imported : '';
            })(),
            weight: getVal(row, 'jobWeight') ? String(getVal(row, 'jobWeight')) : '',
            squatting: getVal(row, 'jobSquat') ? String(getVal(row, 'jobSquat')) : '',
            stairs: parseBool(getVal(row, 'stairs')),
            kneeTwist: parseBool(getVal(row, 'kneeTwist')),
            startStop: parseBool(getVal(row, 'startStop')),
            tightSpace: parseBool(getVal(row, 'tightSpace')),
            kneeContact: parseBool(getVal(row, 'kneeContact')),
            jumpDown: parseBool(getVal(row, 'jumpDown'))
          }];
        }

        resultPatients.push(p);
        stats.newPatients++;
      } else {
        // 3-2: 같은 사람 발견
        const existingDiag = existingPatient.data.diagnoses.find(d =>
          d.code === rowDiagCode && d.name === rowDiagName && d.side === rowSide
        );

        if (!existingDiag && (rowDiagCode || rowDiagName)) {
          // 3-2-2: 상병이 다름 → 상병 추가
          const newDiag = {
            ...createDiagnosis(),
            code: rowDiagCode,
            name: rowDiagName,
            side: rowSide
          };
          applyKlg(newDiag, rowSide, rowKlgRight, rowKlgLeft);
          existingPatient.data.diagnoses.push(newDiag);
          stats.newDiagnoses++;
        } else if (existingDiag) {
          // 기존 상병에 KLG 값 보완 (비어있는 경우만)
          if (rowKlgRight && !existingDiag.klgRight && (rowSide === 'right' || rowSide === 'both')) {
            existingDiag.klgRight = rowKlgRight;
          }
          if (rowKlgLeft && !existingDiag.klgLeft && (rowSide === 'left' || rowSide === 'both')) {
            existingDiag.klgLeft = rowKlgLeft;
          }
        }

        // 3-2-3: 직종 비교
        if (rowJobName) {
          const existingJob = existingPatient.data.jobs.find(j => j.jobName === rowJobName);

          if (!existingJob) {
            // 직종이 다름 → 직종 추가
            existingPatient.data.jobs.push({
              ...createJob(),
              jobName: rowJobName,
              startDate: parseDate(getVal(row, 'jobStart')),
              endDate: parseDate(getVal(row, 'jobEnd')),
              workPeriodOverride: (() => {
                const y = parseInt(getVal(row, 'jobPeriodY')) || 0;
                const m = parseInt(getVal(row, 'jobPeriodM')) || 0;
                if (!y && !m) return '';
                const imported = `${y}년 ${m}개월`;
                const auto = formatWorkPeriod(parseDate(getVal(row, 'jobStart')), parseDate(getVal(row, 'jobEnd')));
                return imported !== auto ? imported : '';
              })(),
              weight: getVal(row, 'jobWeight') ? String(getVal(row, 'jobWeight')) : '',
              squatting: getVal(row, 'jobSquat') ? String(getVal(row, 'jobSquat')) : '',
              stairs: parseBool(getVal(row, 'stairs')),
              kneeTwist: parseBool(getVal(row, 'kneeTwist')),
              startStop: parseBool(getVal(row, 'startStop')),
              tightSpace: parseBool(getVal(row, 'tightSpace')),
              kneeContact: parseBool(getVal(row, 'kneeContact')),
              jumpDown: parseBool(getVal(row, 'jumpDown'))
            });
            stats.newJobs++;
          } else {
            // 3-2-1: 상병도 같고 직종도 같음 → 중복, 건너뜀
            if (existingDiag) {
              stats.skipped++;
            }
          }
        }
      }
    }

    if (stats.newPatients === 0 && stats.newDiagnoses === 0 && stats.newJobs === 0) {
      if (window.electron?.showAlert) await window.electron.showAlert('가져올 데이터가 없습니다 (모두 중복)');
      else alert('가져올 데이터가 없습니다 (모두 중복)');
      return;
    }

    onImport(resultPatients, stats);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <h2>📥 일괄 Import (다중 환자)</h2>

        <div
          className={`import-zone ${dragover ? 'dragover' : ''}`}
          onClick={() => fileRef.current.click()}
          onDragOver={e => { e.preventDefault(); setDragover(true); }}
          onDragLeave={() => setDragover(false)}
          onDrop={e => { e.preventDefault(); setDragover(false); handleFile(e.dataTransfer.files[0]); }}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files[0])}
          />
          <p>📁 클릭하거나 파일을 드래그하세요</p>
          <p style={{ color: '#888', fontSize: '0.85rem', marginTop: 5 }}>
            첫 행: 컬럼명 / 2행부터: 환자별 데이터
          </p>
          {file && <p style={{ marginTop: 10, color: '#667eea' }}>✅ {file.name}</p>}
        </div>

        {/* 지원 컬럼 안내 */}
        <details style={{ marginTop: 10, fontSize: '0.8rem', color: '#666' }}>
          <summary style={{ cursor: 'pointer' }}>📋 지원하는 컬럼 (29개)</summary>
          <div style={{ marginTop: 8, padding: 10, background: '#f8f9fa', borderRadius: 4 }}>
            <strong>기본정보:</strong> 이름, 생년월일, 재해일자, 키, 몸무게, 성별<br/>
            <strong>기관정보:</strong> 병원명, 진료과, 담당의<br/>
            <strong>기타:</strong> 특이사항, 복귀고려사항<br/>
            <strong>상병:</strong> 진단코드, 진단명, 부위, KLG(우측), KLG(좌측)<br/>
            <strong>직업:</strong> 직종명, 시작일, 종료일, 근무기간(년), 근무기간(개월), 중량물(kg), 쪼그려앉기(분)<br/>
            <strong>보조변수:</strong> 계단오르내리기, 무릎비틀림, 출발정지반복, 좁은공간, 무릎접촉충격, 뛰어내리기
          </div>
        </details>

        {preview && preview.length > 1 && (
          <div className="batch-summary">
            <h4>📋 미리보기: {preview.length - 1}행</h4>
            <div style={{ overflowX: 'auto', marginTop: 10 }}>
              <table className="import-preview">
                <thead>
                  <tr>
                    {columns.slice(0, 8).map((c, i) => <th key={i}>{c}</th>)}
                    {columns.length > 8 && <th>...</th>}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(1, 6).map((row, ri) => (
                    <tr key={ri}>
                      {columns.slice(0, 8).map((_, ci) => <td key={ci}>{row[ci]}</td>)}
                      {columns.length > 8 && <td>...</td>}
                    </tr>
                  ))}
                  {preview.length > 6 && (
                    <tr>
                      <td colSpan={Math.min(columns.length, 9)} style={{ textAlign: 'center', color: '#888' }}>
                        ... 외 {preview.length - 6}행
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 15 }}>
          <button className="btn btn-primary" onClick={handleImport} disabled={!preview}>
            일괄 가져오기
          </button>
          <button className="btn btn-secondary" onClick={onClose}>취소</button>
        </div>
      </div>
    </div>
  );
}
