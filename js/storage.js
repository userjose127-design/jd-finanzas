/* ==========================================================================
   JD FINANZAS - MÓDULO DE PERSISTENCIA Y ALMACENAMIENTO (STORAGE)
   ========================================================================== */

const STORAGE_KEYS = {
  SETTINGS: 'jd_finanzas_settings',
  QUINCENAS: 'jd_finanzas_quincenas',
  DEBTS: 'jd_finanzas_debts',
  VERSION: 'jd_finanzas_v1'
};

const DEFAULT_SETTINGS = {
  userName: 'JD',
  currencySymbol: '$',
  currencyCode: 'USD',
  defaultIncome: 0, // En blanco para que JD coloque sus ingresos reales
  darkMode: true,
  notificationsEnabled: false
};

// Configuración limpia sin datos ficticios para que JD comience desde cero
const SEED_DATA = {
  settings: DEFAULT_SETTINGS,
  debts: []
};

const StorageManager = {
  // Inicialización
  init() {
    // Si no existe versión 2.0 (versión limpia), inicializar limpio
    if (localStorage.getItem(STORAGE_KEYS.VERSION) !== '2.0_clean') {
      this.seedInitialData();
    }
  },

  // Sembrado de estructura limpia en blanco
  seedInitialData() {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1; // 1-12
    const currentQ = today.getDate() <= 15 ? 1 : 2;
    const qKey = `${year}-${String(month).padStart(2, '0')}-Q${currentQ}`;

    // Estructura limpia para la quincena actual
    const initialQuincena = {
      id: qKey,
      year: year,
      month: month,
      period: currentQ,
      incomeList: [], // En blanco
      paymentList: []  // En blanco
    };

    const quincenasMap = {};
    quincenasMap[qKey] = initialQuincena;

    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(SEED_DATA.settings));
    localStorage.setItem(STORAGE_KEYS.DEBTS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.QUINCENAS, JSON.stringify(quincenasMap));
    localStorage.setItem(STORAGE_KEYS.VERSION, '2.0_clean');
  },

  // Ajustes de JD
  getSettings() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
    } catch (e) {
      return DEFAULT_SETTINGS;
    }
  },

  saveSettings(newSettings) {
    const updated = { ...this.getSettings(), ...newSettings };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    return updated;
  },

  // Deudas en Cuotas
  getDebts() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.DEBTS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  saveDebts(debts) {
    localStorage.setItem(STORAGE_KEYS.DEBTS, JSON.stringify(debts));
    return debts;
  },

  addDebt(debt) {
    const debts = this.getDebts();
    const newDebt = {
      ...debt,
      id: 'debt_' + Date.now(),
      createdAt: new Date().toISOString().split('T')[0]
    };
    debts.unshift(newDebt);
    this.saveDebts(debts);
    return newDebt;
  },

  updateDebt(id, updatedFields) {
    const debts = this.getDebts();
    const index = debts.findIndex(d => d.id === id);
    if (index !== -1) {
      debts[index] = { ...debts[index], ...updatedFields };
      this.saveDebts(debts);
      return debts[index];
    }
    return null;
  },

  deleteDebt(id) {
    const debts = this.getDebts().filter(d => d.id !== id);
    this.saveDebts(debts);
    return debts;
  },

  // Quincenas
  getAllQuincenas() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.QUINCENAS);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      return {};
    }
  },

  getQuincena(year, month, period) {
    const qKey = `${year}-${String(month).padStart(2, '0')}-Q${period}`;
    const all = this.getAllQuincenas();
    if (all[qKey]) {
      return all[qKey];
    }

    // Si no existe, crear una estructura limpia con el ingreso estimado por defecto
    const settings = this.getSettings();
    const isFirstPeriod = period === 1;
    const defaultDate = `${year}-${String(month).padStart(2, '0')}-${isFirstPeriod ? '15' : '30'}`;

    const incomeList = (settings.defaultIncome && settings.defaultIncome > 0)
      ? [{ id: 'inc_' + Date.now(), title: 'Sueldo Quincenal', amount: settings.defaultIncome, date: defaultDate }]
      : [];

    const newQ = {
      id: qKey,
      year: parseInt(year),
      month: parseInt(month),
      period: parseInt(period),
      incomeList: incomeList,
      paymentList: []
    };

    all[qKey] = newQ;
    localStorage.setItem(STORAGE_KEYS.QUINCENAS, JSON.stringify(all));
    return newQ;
  },

  saveQuincena(quincena) {
    const all = this.getAllQuincenas();
    all[quincena.id] = quincena;
    localStorage.setItem(STORAGE_KEYS.QUINCENAS, JSON.stringify(all));
    return quincena;
  },

  // Respaldo y Restauración
  exportBackup() {
    const backup = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      appName: 'JD Finanzas',
      settings: this.getSettings(),
      debts: this.getDebts(),
      quincenas: this.getAllQuincenas()
    };
    return JSON.stringify(backup, null, 2);
  },

  importBackup(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (!data.settings || !data.quincenas || !data.debts) {
        throw new Error('El archivo no tiene el formato correcto de JD Finanzas.');
      }
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data.settings));
      localStorage.setItem(STORAGE_KEYS.DEBTS, JSON.stringify(data.debts));
      localStorage.setItem(STORAGE_KEYS.QUINCENAS, JSON.stringify(data.quincenas));
      localStorage.setItem(STORAGE_KEYS.VERSION, '1.0');
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  resetAll() {
    localStorage.clear();
    this.seedInitialData();
  }
};

// Ejecutar init al cargar el script
StorageManager.init();
