const SAVED_ITEMS_KEY = 'wrEvaluationSavedItems';
const AUTO_SAVE_KEY = 'wrEvaluationAutoSave';

export const loadSavedItems = () => {
  const s = localStorage.getItem(SAVED_ITEMS_KEY);
  if (s) {
    try { return JSON.parse(s); }
    catch { localStorage.removeItem(SAVED_ITEMS_KEY); }
  }
  return [];
};

export const hasDuplicateName = (saveName, savedItems) => {
  return savedItems.some(x => x.name === saveName);
};

export const savePatientsData = (saveName, patients, savedItems) => {
  const item = { id: Date.now(), name: saveName, count: patients.length, savedAt: new Date().toISOString(), patients };
  const existingIndex = savedItems.findIndex(x => x.name === saveName);
  let items;
  if (existingIndex >= 0) {
    items = [...savedItems];
    items[existingIndex] = item;
  } else {
    items = [...savedItems, item];
  }
  localStorage.setItem(SAVED_ITEMS_KEY, JSON.stringify(items));
  localStorage.removeItem(AUTO_SAVE_KEY);
  return items;
};

export const deleteSavedItem = (id, savedItems) => {
  const items = savedItems.filter(x => x.id !== id);
  localStorage.setItem(SAVED_ITEMS_KEY, JSON.stringify(items));
  return items;
};
