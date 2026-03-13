import { useMemo } from 'react';
import { isAssessmentComplete } from '../utils/calculations';

export function usePatientList(patients, searchQuery, sortKey, statusFilter) {
  return useMemo(() => {
    let list = patients;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(p => {
        const d = p.data;
        return (d.name || '').toLowerCase().includes(q)
          || (d.diagnoses?.[0]?.name || '').toLowerCase().includes(q)
          || (d.jobs?.[0]?.jobName || '').toLowerCase().includes(q);
      });
    }
    if (statusFilter === 'complete') {
      list = list.filter(p => isAssessmentComplete(p.data));
    } else if (statusFilter === 'incomplete') {
      list = list.filter(p => !isAssessmentComplete(p.data));
    }
    if (sortKey === 'name') {
      list = [...list].sort((a, b) => (a.data.name || '').localeCompare(b.data.name || '', 'ko'));
    } else if (sortKey === 'birthDate') {
      list = [...list].sort((a, b) => (a.data.birthDate || '').localeCompare(b.data.birthDate || ''));
    } else if (sortKey === 'evaluationDate') {
      list = [...list].sort((a, b) => (b.data.evaluationDate || '').localeCompare(a.data.evaluationDate || ''));
    }
    return list;
  }, [patients, searchQuery, sortKey, statusFilter]);
}
