/* ==========================================================================
   CONTROL FINANCIERO - PERSISTENCIA LOCAL, MIGRACIÓN Y RESPALDOS
   ========================================================================== */

const STORAGE_KEYS = {
  SETTINGS: 'jd_finanzas_settings',
  QUINCENAS: 'jd_finanzas_quincenas',
  DEBTS: 'jd_finanzas_debts',
  CASHEA: 'jd_finanzas_cashea',
  AUTH: 'jd_finanzas_auth',
  VERSION: 'jd_finanzas_v1'
};

const SCHEMA_VERSION = '3.0';

const DEFAULT_SETTINGS = {
  userName: 'Usuario',
  currencySymbol: '$',
  currencyCode: 'USD',
  defaultIncome: 0,
  darkMode: true,
  notificationsEnabled: false
};

const StorageManager = {
  init() {
    // Migración aditiva: jamás se borran datos por una diferencia de versión.
    const hasFinancialData = [STORAGE_KEYS.SETTINGS, STORAGE_KEYS.QUINCENAS, STORAGE_KEYS.DEBTS, STORAGE_KEYS.CASHEA]
      .some(key => localStorage.getItem(key) !== null);

    if (!hasFinancialData) {
      this.seedInitialData();
      return;
    }

    if (localStorage.getItem(STORAGE_KEYS.SETTINGS) === null) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
    }
    if (localStorage.getItem(STORAGE_KEYS.DEBTS) === null) {
      localStorage.setItem(STORAGE_KEYS.DEBTS, JSON.stringify([]));
    }
    if (localStorage.getItem(STORAGE_KEYS.QUINCENAS) === null) {
      localStorage.setItem(STORAGE_KEYS.QUINCENAS, JSON.stringify(this.createInitialQuincenas()));
    }
    if (localStorage.getItem(STORAGE_KEYS.CASHEA) === null) {
      localStorage.setItem(STORAGE_KEYS.CASHEA, JSON.stringify([]));
    }

    localStorage.setItem(STORAGE_KEYS.VERSION, SCHEMA_VERSION);
  },

  createId(prefix = 'id') {
    const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
    return `${prefix}_${Date.now()}_${random}`;
  },

  createInitialQuincenas() {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const period = today.getDate() <= 15 ? 1 : 2;
    const id = `${year}-${String(month).padStart(2, '0')}-Q${period}`;
    return {
      [id]: { id, year, month, period, incomeList: [], paymentList: [] }
    };
  },

  seedInitialData() {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
    localStorage.setItem(STORAGE_KEYS.DEBTS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.QUINCENAS, JSON.stringify(this.createInitialQuincenas()));
    localStorage.setItem(STORAGE_KEYS.CASHEA, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.VERSION, SCHEMA_VERSION);
  },

  readJSON(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch (error) {
      console.warn(`No se pudo leer ${key}:`, error);
      return fallback;
    }
  },

  getSettings() {
    const saved = this.readJSON(STORAGE_KEYS.SETTINGS, {});
    return saved && typeof saved === 'object' && !Array.isArray(saved)
      ? { ...DEFAULT_SETTINGS, ...saved }
      : { ...DEFAULT_SETTINGS };
  },

  saveSettings(newSettings) {
    const updated = { ...this.getSettings(), ...newSettings };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    return updated;
  },

  hasStoredAuth() {
    return localStorage.getItem(STORAGE_KEYS.AUTH) !== null;
  },

  getAuth() {
    const auth = this.readJSON(STORAGE_KEYS.AUTH, null);
    return auth && typeof auth === 'object' && !Array.isArray(auth) ? auth : null;
  },

  saveAuth(authConfig) {
    localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(authConfig));
    return authConfig;
  },

  clearAuth() {
    localStorage.removeItem(STORAGE_KEYS.AUTH);
  },

  getDebts() {
    const data = this.readJSON(STORAGE_KEYS.DEBTS, []);
    return Array.isArray(data) ? data : [];
  },

  saveDebts(debts) {
    if (!Array.isArray(debts)) throw new Error('Las deudas deben ser una lista.');
    localStorage.setItem(STORAGE_KEYS.DEBTS, JSON.stringify(debts));
    return debts;
  },

  addDebt(debt) {
    const debts = this.getDebts();
    const newDebt = { ...debt, id: this.createId('debt'), createdAt: new Date().toISOString().split('T')[0] };
    debts.unshift(newDebt);
    this.saveDebts(debts);
    return newDebt;
  },

  updateDebt(id, updatedFields) {
    const debts = this.getDebts();
    const index = debts.findIndex(debt => debt.id === id);
    if (index === -1) return null;
    debts[index] = { ...debts[index], ...updatedFields };
    this.saveDebts(debts);
    return debts[index];
  },

  deleteDebt(id) {
    const debts = this.getDebts().filter(debt => debt.id !== id);
    this.saveDebts(debts);
    return debts;
  },

  getCasheaPlans() {
    const data = this.readJSON(STORAGE_KEYS.CASHEA, []);
    return Array.isArray(data) ? data : [];
  },

  saveCasheaPlans(plans) {
    if (!Array.isArray(plans)) throw new Error('Los planes Cashea deben ser una lista.');
    localStorage.setItem(STORAGE_KEYS.CASHEA, JSON.stringify(plans));
    return plans;
  },

  addCasheaPlan(plan) {
    const plans = this.getCasheaPlans();
    const newPlan = {
      ...plan,
      id: this.createId('cashea'),
      createdAt: new Date().toISOString()
    };
    plans.unshift(newPlan);
    this.saveCasheaPlans(plans);
    return newPlan;
  },

  getAllQuincenas() {
    const data = this.readJSON(STORAGE_KEYS.QUINCENAS, {});
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  },

  getQuincena(year, month, period) {
    const parsedYear = Number.parseInt(year, 10);
    const parsedMonth = Number.parseInt(month, 10);
    const parsedPeriod = Number.parseInt(period, 10);
    const id = `${parsedYear}-${String(parsedMonth).padStart(2, '0')}-Q${parsedPeriod}`;
    const all = this.getAllQuincenas();
    if (all[id]) return all[id];

    const settings = this.getSettings();
    const lastDay = new Date(parsedYear, parsedMonth, 0).getDate();
    const day = parsedPeriod === 1 ? 15 : lastDay;
    const date = `${parsedYear}-${String(parsedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const incomeList = Number(settings.defaultIncome) > 0
      ? [{ id: this.createId('inc'), title: 'Sueldo Quincenal', amount: Number(settings.defaultIncome), date }]
      : [];

    const quincena = { id, year: parsedYear, month: parsedMonth, period: parsedPeriod, incomeList, paymentList: [] };
    all[id] = quincena;
    localStorage.setItem(STORAGE_KEYS.QUINCENAS, JSON.stringify(all));
    return quincena;
  },

  saveQuincena(quincena) {
    if (!quincena || typeof quincena !== 'object' || !quincena.id) throw new Error('Quincena inválida.');
    const all = this.getAllQuincenas();
    all[quincena.id] = quincena;
    localStorage.setItem(STORAGE_KEYS.QUINCENAS, JSON.stringify(all));
    return quincena;
  },

  exportBackup() {
    return JSON.stringify({
      appName: 'Control Financiero',
      schemaVersion: SCHEMA_VERSION,
      exportDate: new Date().toISOString(),
      data: {
        settings: this.getSettings(),
        debts: this.getDebts(),
        quincenas: this.getAllQuincenas(),
        cashea: this.getCasheaPlans()
      }
    }, null, 2);
  },

  safeText(value, label, maxLength = 300, optional = false) {
    if ((value === undefined || value === null) && optional) return '';
    if (typeof value !== 'string') throw new Error(`${label} debe ser texto.`);
    if (value.length > maxLength) throw new Error(`${label} supera el tamaño permitido.`);
    return value;
  },

  safeId(value, label) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,180}$/.test(value)) {
      throw new Error(`${label} contiene un identificador inválido.`);
    }
    return value;
  },

  safeNumber(value, label, min = 0, max = Number.MAX_SAFE_INTEGER) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < min || number > max) throw new Error(`${label} contiene un monto inválido.`);
    return number;
  },

  safeInteger(value, label, min = 0, max = Number.MAX_SAFE_INTEGER) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < min || number > max) throw new Error(`${label} contiene un entero inválido.`);
    return number;
  },

  safeDate(value, label, optional = false, clampInvalidDay = false) {
    if ((value === '' || value === undefined || value === null) && optional) return '';
    if (typeof value !== 'string') throw new Error(`${label} debe ser una fecha.`);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) throw new Error(`${label} no tiene formato válido.`);
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      if (clampInvalidDay && month >= 1 && month <= 12 && day >= 1) {
        const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
        return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
      }
      throw new Error(`${label} no existe.`);
    }
    return value;
  },

  assertNoDuplicateJsonKeys(jsonString) {
    if (typeof jsonString !== 'string') throw new Error('El respaldo debe ser texto JSON.');
    let position = 0;
    const maxDepth = 200;

    const skipWhitespace = () => {
      while (position < jsonString.length && /\s/.test(jsonString[position])) position += 1;
    };

    const parseStringToken = () => {
      const start = position;
      if (jsonString[position] !== '"') throw new Error('El respaldo contiene JSON inválido.');
      position += 1;
      let escaped = false;
      while (position < jsonString.length) {
        const character = jsonString[position];
        position += 1;
        if (escaped) {
          escaped = false;
        } else if (character === '\\') {
          escaped = true;
        } else if (character === '"') {
          try {
            return JSON.parse(jsonString.slice(start, position));
          } catch (error) {
            throw new Error('El respaldo contiene una cadena JSON inválida.');
          }
        }
      }
      throw new Error('El respaldo contiene una cadena JSON sin cerrar.');
    };

    const scanValue = (depth) => {
      if (depth > maxDepth) throw new Error('El respaldo JSON tiene demasiados niveles anidados.');
      skipWhitespace();
      const character = jsonString[position];

      if (character === '{') {
        position += 1;
        skipWhitespace();
        const keys = new Set();
        if (jsonString[position] === '}') {
          position += 1;
          return;
        }
        while (position < jsonString.length) {
          skipWhitespace();
          const key = parseStringToken();
          if (keys.has(key)) throw new Error(`El respaldo contiene la propiedad JSON duplicada "${key}".`);
          keys.add(key);
          skipWhitespace();
          if (jsonString[position] !== ':') throw new Error('El respaldo contiene JSON inválido.');
          position += 1;
          scanValue(depth + 1);
          skipWhitespace();
          if (jsonString[position] === '}') {
            position += 1;
            return;
          }
          if (jsonString[position] !== ',') throw new Error('El respaldo contiene JSON inválido.');
          position += 1;
        }
        throw new Error('El respaldo contiene un objeto JSON sin cerrar.');
      }

      if (character === '[') {
        position += 1;
        skipWhitespace();
        if (jsonString[position] === ']') {
          position += 1;
          return;
        }
        while (position < jsonString.length) {
          scanValue(depth + 1);
          skipWhitespace();
          if (jsonString[position] === ']') {
            position += 1;
            return;
          }
          if (jsonString[position] !== ',') throw new Error('El respaldo contiene JSON inválido.');
          position += 1;
        }
        throw new Error('El respaldo contiene una lista JSON sin cerrar.');
      }

      if (character === '"') {
        parseStringToken();
        return;
      }

      const start = position;
      while (position < jsonString.length && !/[\s,}\]]/.test(jsonString[position])) position += 1;
      const token = jsonString.slice(start, position);
      try {
        JSON.parse(token);
      } catch (error) {
        throw new Error('El respaldo contiene un valor JSON inválido.');
      }
    };

    scanValue(0);
    skipWhitespace();
    if (position !== jsonString.length) throw new Error('El respaldo contiene contenido adicional después del JSON.');
  },

  normalizeBackup(parsed) {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('El archivo no contiene un objeto JSON válido.');
    }

    const source = parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data) ? parsed.data : parsed;
    if (!source.settings || typeof source.settings !== 'object' || Array.isArray(source.settings)) {
      throw new Error('El respaldo no contiene ajustes válidos.');
    }
    if (!Array.isArray(source.debts)) throw new Error('El respaldo no contiene una lista de deudas válida.');
    if (!source.quincenas || typeof source.quincenas !== 'object' || Array.isArray(source.quincenas)) {
      throw new Error('El respaldo no contiene quincenas válidas.');
    }
    const sourceCashea = source.cashea === undefined ? [] : source.cashea;
    if (!Array.isArray(sourceCashea)) throw new Error('El respaldo no contiene planes Cashea válidos.');

    const currencySymbol = this.safeText(source.settings.currencySymbol ?? '$', 'El símbolo de moneda', 12);
    if (/[<>&"'`]/.test(currencySymbol)) throw new Error('El símbolo de moneda contiene caracteres no permitidos.');
    const settings = {
      ...DEFAULT_SETTINGS,
      userName: this.safeText(source.settings.userName ?? 'Usuario', 'El nombre de usuario', 60),
      currencySymbol,
      currencyCode: this.safeText(source.settings.currencyCode ?? 'USD', 'El código de moneda', 12),
      defaultIncome: this.safeNumber(source.settings.defaultIncome ?? 0, 'El ingreso predeterminado'),
      darkMode: source.settings.darkMode !== false,
      notificationsEnabled: source.settings.notificationsEnabled === true
    };

    const debts = source.debts.map((debt, index) => {
      if (!debt || typeof debt !== 'object' || Array.isArray(debt)) throw new Error(`La deuda ${index + 1} es inválida.`);
      const totalInstallments = this.safeInteger(debt.totalInstallments, `Las cuotas de la deuda ${index + 1}`, 1, 1200);
      return {
        ...debt,
        id: this.safeId(debt.id, `La deuda ${index + 1}`),
        title: this.safeText(debt.title, `El título de la deuda ${index + 1}`, 160),
        creditor: this.safeText(debt.creditor ?? '', `El acreedor de la deuda ${index + 1}`, 160),
        notes: this.safeText(debt.notes ?? '', `Las notas de la deuda ${index + 1}`, 500),
        totalAmount: this.safeNumber(debt.totalAmount, `El total de la deuda ${index + 1}`),
        totalInstallments,
        paidInstallments: this.safeInteger(debt.paidInstallments ?? 0, `Las cuotas pagadas de la deuda ${index + 1}`, 0, totalInstallments),
        installmentAmount: this.safeNumber(debt.installmentAmount, `El monto de cuota de la deuda ${index + 1}`),
        dueDateDay: this.safeInteger(debt.dueDateDay ?? 15, `El día de pago de la deuda ${index + 1}`, 1, 31),
        quincenaTarget: this.safeInteger(debt.quincenaTarget ?? 1, `La quincena de la deuda ${index + 1}`, 1, 2)
      };
    });

    const allowedCategories = new Set(['Vivienda', 'Servicios', 'Alimentación', 'Transporte', 'Cuotas', 'Ahorro', 'Entretenimiento', 'Salud', 'Otro']);
    const quincenas = {};
    const canonicalQuincenaIds = new Set();
    Object.entries(source.quincenas).forEach(([key, quincena], index) => {
      if (!quincena || typeof quincena !== 'object' || Array.isArray(quincena)) throw new Error(`La quincena ${index + 1} es inválida.`);
      const year = this.safeInteger(quincena.year, `El año de la quincena ${index + 1}`, 2000, 2200);
      const month = this.safeInteger(quincena.month, `El mes de la quincena ${index + 1}`, 1, 12);
      const period = this.safeInteger(quincena.period, `El periodo de la quincena ${index + 1}`, 1, 2);
      const canonicalId = `${year}-${String(month).padStart(2, '0')}-Q${period}`;
      const originalKey = this.safeId(key, `La clave de la quincena ${index + 1}`);
      const storedId = this.safeId(quincena.id, `El ID de la quincena ${index + 1}`);
      if (originalKey !== canonicalId || storedId !== canonicalId) {
        throw new Error(`La quincena ${index + 1} no coincide con su periodo canónico ${canonicalId}.`);
      }
      if (canonicalQuincenaIds.has(canonicalId)) throw new Error(`El respaldo contiene la quincena duplicada ${canonicalId}.`);
      canonicalQuincenaIds.add(canonicalId);
      if (!Array.isArray(quincena.incomeList) || !Array.isArray(quincena.paymentList)) throw new Error(`La quincena ${canonicalId} no contiene listas válidas.`);
      quincenas[canonicalId] = {
        id: canonicalId,
        year,
        month,
        period,
        incomeList: quincena.incomeList.map((income, incomeIndex) => ({
          id: this.safeId(income.id, `El ingreso ${incomeIndex + 1} de ${canonicalId}`),
          title: this.safeText(income.title, `El ingreso ${incomeIndex + 1} de ${canonicalId}`, 160),
          amount: this.safeNumber(income.amount, `El ingreso ${incomeIndex + 1} de ${canonicalId}`),
          date: this.safeDate(income.date, `La fecha del ingreso ${incomeIndex + 1} de ${canonicalId}`, true, true)
        })),
        paymentList: quincena.paymentList.map((payment, paymentIndex) => {
          if (!payment || typeof payment !== 'object' || Array.isArray(payment)) throw new Error(`El pago ${paymentIndex + 1} de ${canonicalId} es inválido.`);
          const category = this.safeText(payment.category ?? 'Otro', `La categoría del pago ${paymentIndex + 1}`, 40);
          if (!allowedCategories.has(category)) throw new Error(`La categoría del pago ${paymentIndex + 1} no es válida.`);
          return {
            id: this.safeId(payment.id, `El pago ${paymentIndex + 1} de ${canonicalId}`),
            title: this.safeText(payment.title, `El pago ${paymentIndex + 1} de ${canonicalId}`, 160),
            amount: this.safeNumber(payment.amount, `El pago ${paymentIndex + 1} de ${canonicalId}`),
            category,
            dueDate: this.safeDate(payment.dueDate, `La fecha del pago ${paymentIndex + 1} de ${canonicalId}`, true, true),
            paid: payment.paid === true,
            linkedDebtId: payment.linkedDebtId ? this.safeId(payment.linkedDebtId, `La deuda vinculada del pago ${paymentIndex + 1}`) : null,
            sourceType: payment.sourceType ? this.safeText(payment.sourceType, `El origen del pago ${paymentIndex + 1}`, 30) : null,
            linkedCasheaPlanId: payment.linkedCasheaPlanId ? this.safeId(payment.linkedCasheaPlanId, `El plan Cashea del pago ${paymentIndex + 1}`) : null,
            linkedCasheaEntryId: payment.linkedCasheaEntryId ? this.safeId(payment.linkedCasheaEntryId, `La entrada Cashea del pago ${paymentIndex + 1}`) : null,
            linkedCasheaKind: payment.linkedCasheaKind ? this.safeText(payment.linkedCasheaKind, `El tipo Cashea del pago ${paymentIndex + 1}`, 20) : null
          };
        })
      };
    });

    const cashea = sourceCashea.map((plan, planIndex) => {
      if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
        throw new Error(`El plan Cashea ${planIndex + 1} es inválido.`);
      }
      const totalCents = Math.round(this.safeNumber(plan.totalAmount, `El total del plan Cashea ${planIndex + 1}`) * 100);
      const isLegacy = !plan.lineType && plan.initialPayment === undefined && plan.initialPercentage === undefined;
      const lineType = plan.lineType === undefined ? 'legacy' : this.safeText(plan.lineType, `La línea del plan Cashea ${planIndex + 1}`, 20);
      if (!['cotidiana', 'compras', 'legacy'].includes(lineType)) throw new Error(`La línea del plan Cashea ${planIndex + 1} no es válida.`);
      const initialPercentage = isLegacy ? 0 : this.safeNumber(plan.initialPercentage ?? 0, `El inicial del plan Cashea ${planIndex + 1}`, 0, 100);
      const initialCents = isLegacy
        ? 0
        : this.safeInteger(plan.initialCents ?? Math.round(totalCents * initialPercentage / 100), `El inicial del plan Cashea ${planIndex + 1}`, 0, totalCents);
      const financedCents = isLegacy ? totalCents : totalCents - initialCents;
      const installments = Array.isArray(plan.installments) ? plan.installments : [];
      if (installments.length > 120 || (financedCents > 0 && installments.length < 1)) {
        throw new Error(`Las cuotas del plan Cashea ${planIndex + 1} son inválidas.`);
      }
      const normalizedInstallments = installments.map((installment, installmentIndex) => {
        if (!installment || typeof installment !== 'object' || Array.isArray(installment)) throw new Error(`La cuota ${installmentIndex + 1} del plan Cashea es inválida.`);
        const amountCents = installment.amountCents === undefined
          ? Math.round(this.safeNumber(installment.amount, `La cuota ${installmentIndex + 1} del plan Cashea`) * 100)
          : this.safeInteger(installment.amountCents, `La cuota ${installmentIndex + 1} del plan Cashea`, 1);
        return {
          id: this.safeId(installment.id, `La cuota ${installmentIndex + 1} del plan Cashea`),
          number: this.safeInteger(installment.number, `El número de cuota ${installmentIndex + 1}`, 1, 120),
          date: this.safeDate(installment.date, `La fecha de cuota ${installmentIndex + 1}`),
          amountCents,
          amount: amountCents / 100,
          paid: installment.paid === true,
          paidAt: installment.paidAt === null || installment.paidAt === undefined ? null : this.safeText(installment.paidAt, 'La fecha de pago Cashea', 40)
        };
      });
      const installmentsTotalCents = normalizedInstallments.reduce((sum, installment) => sum + installment.amountCents, 0);
      if (installmentsTotalCents !== financedCents) throw new Error(`Las cuotas del plan Cashea ${planIndex + 1} no coinciden con el monto financiado.`);
      for (let index = 1; index < normalizedInstallments.length; index += 1) {
        const previous = new Date(`${normalizedInstallments[index - 1].date}T00:00:00Z`);
        const current = new Date(`${normalizedInstallments[index].date}T00:00:00Z`);
        if ((current - previous) !== 14 * 24 * 60 * 60 * 1000) throw new Error(`El calendario del plan Cashea ${planIndex + 1} no respeta intervalos de 14 días.`);
      }
      let initialPayment = null;
      if (plan.initialPayment) {
        const paymentCents = this.safeInteger(plan.initialPayment.amountCents ?? Math.round(Number(plan.initialPayment.amount || 0) * 100), `El pago inicial del plan Cashea ${planIndex + 1}`, 1, totalCents);
        initialPayment = {
          id: 'initial',
          date: this.safeDate(plan.initialPayment.date, `La fecha inicial del plan Cashea ${planIndex + 1}`),
          amountCents: paymentCents,
          amount: paymentCents / 100,
          paid: plan.initialPayment.paid === true,
          paidAt: plan.initialPayment.paidAt === null || plan.initialPayment.paidAt === undefined ? null : this.safeText(plan.initialPayment.paidAt, 'La fecha del pago inicial', 40)
        };
      }
      const firstDate = normalizedInstallments.length
        ? normalizedInstallments[0].date
        : this.safeDate(plan.firstDate, `La primera fecha del plan Cashea ${planIndex + 1}`);
      return {
        id: this.safeId(plan.id, `El plan Cashea ${planIndex + 1}`),
        title: this.safeText(plan.title, `El título del plan Cashea ${planIndex + 1}`, 160),
        merchant: this.safeText(plan.merchant ?? '', `El comercio del plan Cashea ${planIndex + 1}`, 160),
        lineType,
        lineLabel: this.safeText(plan.lineLabel ?? '', `La etiqueta de línea del plan Cashea ${planIndex + 1}`, 60, true),
        notes: this.safeText(plan.notes ?? '', `Las notas del plan Cashea ${planIndex + 1}`, 500),
        totalAmount: totalCents / 100,
        totalCents,
        initialPercentage,
        initialAmount: initialCents / 100,
        initialCents,
        financedAmount: financedCents / 100,
        financedCents,
        installmentCount: this.safeInteger(plan.installmentCount ?? normalizedInstallments.length, `El número de cuotas del plan Cashea ${planIndex + 1}`, 0, 120),
        initialDate: initialPayment?.date || this.safeDate(plan.initialDate ?? firstDate, `La fecha inicial del plan Cashea ${planIndex + 1}`),
        firstDate,
        createdAt: this.safeText(plan.createdAt ?? '', `La creación del plan Cashea ${planIndex + 1}`, 40),
        initialPayment,
        installments: normalizedInstallments
      };
    });

    return { settings, debts, quincenas, cashea };
  },

  importBackup(jsonString) {
    const managedKeys = [STORAGE_KEYS.SETTINGS, STORAGE_KEYS.DEBTS, STORAGE_KEYS.QUINCENAS, STORAGE_KEYS.CASHEA, STORAGE_KEYS.VERSION];
    const snapshot = Object.fromEntries(managedKeys.map(key => [key, localStorage.getItem(key)]));

    try {
      this.assertNoDuplicateJsonKeys(jsonString);
      const normalized = this.normalizeBackup(JSON.parse(jsonString));
      const serialized = {
        [STORAGE_KEYS.SETTINGS]: JSON.stringify(normalized.settings),
        [STORAGE_KEYS.DEBTS]: JSON.stringify(normalized.debts),
        [STORAGE_KEYS.QUINCENAS]: JSON.stringify(normalized.quincenas),
        [STORAGE_KEYS.CASHEA]: JSON.stringify(normalized.cashea),
        [STORAGE_KEYS.VERSION]: SCHEMA_VERSION
      };
      managedKeys.forEach(key => localStorage.setItem(key, serialized[key]));
      return { success: true };
    } catch (error) {
      let rollbackError = null;
      try {
        managedKeys.forEach(key => localStorage.removeItem(key));
        managedKeys.forEach(key => {
          if (snapshot[key] !== null) localStorage.setItem(key, snapshot[key]);
        });
      } catch (restoreError) {
        rollbackError = restoreError;
        console.error('No se pudo completar el rollback del respaldo:', restoreError);
      }
      const detail = rollbackError ? ' Además, el navegador no pudo recuperar por completo el estado anterior.' : '';
      return { success: false, error: `${error.message || 'No fue posible restaurar el respaldo.'}${detail}` };
    }
  },

  resetAll() {
    // Restablece solo datos financieros; la configuración de acceso se conserva.
    [STORAGE_KEYS.SETTINGS, STORAGE_KEYS.DEBTS, STORAGE_KEYS.QUINCENAS, STORAGE_KEYS.CASHEA, STORAGE_KEYS.VERSION]
      .forEach(key => localStorage.removeItem(key));
    this.seedInitialData();
  }
};
