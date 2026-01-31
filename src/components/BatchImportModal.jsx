import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { createPatient, createDiagnosis } from '../utils/data';

export function BatchImportModal({ onClose, onImport }) {
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
        alert('파일 읽기 오류: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(f);
  };

  const handleImport = () => {
    if (!preview || preview.length < 2) return alert('데이터가 없습니다');

    const headers = preview[0].map(h => (h || '').toString().toLowerCase());
    const findCol = (keywords) => headers.findIndex(h => keywords.some(k => h.includes(k)));

    const colMap = {
      name: findCol(['이름', 'name']),
      birthDate: findCol(['생년월일', 'birth']),
      injuryDate: findCol(['재해', 'injury']),
      height: findCol(['키', 'height']),
      weight: findCol(['몸무게', 'weight']),
      diagCode: findCol(['진단코드', 'code']),
      diagName: findCol(['진단명', 'diag']),
      side: findCol(['부위', 'side']),
      jobName: findCol(['직종', 'job']),
      jobStart: findCol(['시작', 'start']),
      jobEnd: findCol(['종료', 'end']),
      jobWeight: findCol(['중량', 'kg']),
      jobSquat: findCol(['쪼그', 'squat'])
    };

    const sideMap = {
      '우측': 'right', '좌측': 'left', '양측': 'both',
      'right': 'right', 'left': 'left', 'both': 'both'
    };

    const parseDate = (v) => {
      if (!v) return '';
      if (typeof v === 'number') {
        const d = XLSX.SSF.parse_date_code(v);
        return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
      }
      return String(v);
    };

    const patients = [];
    for (let i = 1; i < preview.length; i++) {
      const row = preview[i];
      if (!row || row.length === 0 || !row[colMap.name]) continue;

      const p = createPatient();
      p.data.name = row[colMap.name] || '';
      p.data.birthDate = parseDate(row[colMap.birthDate]);
      p.data.injuryDate = parseDate(row[colMap.injuryDate]);
      p.data.height = row[colMap.height] ? String(row[colMap.height]) : '';
      p.data.weight = row[colMap.weight] ? String(row[colMap.weight]) : '';

      if (colMap.diagCode >= 0 || colMap.diagName >= 0) {
        p.data.diagnoses = [{
          ...createDiagnosis(),
          code: row[colMap.diagCode] || '',
          name: row[colMap.diagName] || '',
          side: sideMap[(row[colMap.side] || '').toLowerCase()] || ''
        }];
      }

      if (colMap.jobName >= 0) {
        p.data.jobs = [{
          ...p.data.jobs[0],
          jobName: row[colMap.jobName] || '',
          startDate: parseDate(row[colMap.jobStart]),
          endDate: parseDate(row[colMap.jobEnd]),
          weight: row[colMap.jobWeight] ? String(row[colMap.jobWeight]) : '',
          squatting: row[colMap.jobSquat] ? String(row[colMap.jobSquat]) : ''
        }];
      }

      patients.push(p);
    }

    if (patients.length === 0) return alert('가져올 데이터가 없습니다');
    onImport(patients);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
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

        {preview && preview.length > 1 && (
          <div className="batch-summary">
            <h4>📋 미리보기: {preview.length - 1}명 환자</h4>
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
                        ... 외 {preview.length - 6}명
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
