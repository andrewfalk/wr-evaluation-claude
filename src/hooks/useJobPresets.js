import { useState, useEffect } from 'react';
import { FALLBACK_PRESETS } from '../utils/data';

export function useJobPresets() {
  const [presets, setPresets] = useState([]);
  const [presetMeta, setPresetMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('./job-presets.json')
      .then(r => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then(data => {
        setPresets(data.presets || []);
        setPresetMeta({
          version: data.version,
          lastUpdated: data.lastUpdated,
          count: data.presets?.length
        });
      })
      .catch(err => {
        setPresets(FALLBACK_PRESETS);
        setPresetMeta({ version: 'fallback', count: FALLBACK_PRESETS.length });
        setError('Preset 파일 로드 실패');
      })
      .finally(() => setLoading(false));
  }, []);

  return { presets, presetMeta, loading, error };
}
