/* ==========================================================================
   CONTROL FINANCIERO - SEGUIMIENTO DE PLANES CASHEA
   ========================================================================== */

const CASHEA_LINE_RULES = Object.freeze({
  cotidiana: Object.freeze({ label: 'Línea cotidiana', installments: [1, 2] }),
  compras: Object.freeze({ label: 'Línea de compras', installments: [3, 6, 9, 12] })
});

const CasheaManager = {
  _initialized: false,

  init() {
    if (!this._initialized) this._initialized = true;
    this.updateInstallmentOptions();
    this.render();
  },

  getLineRule(lineType) {
    return CASHEA_LINE_RULES[lineType] || CASHEA_LINE_RULES.cotidiana;
  },

  getLineLabel(lineType) {
    return this.getLineRule(lineType).label;
  },

  updateInstallmentOptions() {
    const typeInput = document.getElementById('casheaLineType');
    const countInput = document.getElementById('casheaInstallmentCount');
    if (!typeInput || !countInput) return;

    const selectedType = typeInput.value || 'cotidiana';
    const allowed = this.getLineRule(selectedType).installments;
    const previous = Number(countInput.value);
    countInput.innerHTML = allowed.map(count => `<option value="${count}">${count} ${count === 1 ? 'cuota' : 'cuotas'}</option>`).join('');
    countInput.value = allowed.includes(previous) ? String(previous) : String(allowed[0]);
  },

  parseISODateUTC(dateString) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateString || ''));
    if (!match) throw new Error('La fecha no es válida.');
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      throw new Error('La fecha no existe.');
    }
    return date;
  },

  toISODateUTC(date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  },

  addDays(dateString, days) {
    const date = this.parseISODateUTC(dateString);
    date.setUTCDate(date.getUTCDate() + days);
    return this.toISODateUTC(date);
  },

  getDefaultFirstDate(initialDate) {
    try {
      return this.addDays(initialDate, 14);
    } catch (error) {
      return new Date().toISOString().slice(0, 10);
    }
  },

  calculateAmounts(totalAmount, initialPercentage) {
    const totalCents = Math.round(Number(totalAmount) * 100);
    const percentage = Number(initialPercentage);
    if (!Number.isSafeInteger(totalCents) || totalCents <= 0) {
      throw new Error('El monto total debe ser mayor que cero.');
    }
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      throw new Error('El inicial debe estar entre 0% y 100%.');
    }
    const initialCents = Math.round(totalCents * (percentage / 100));
    return {
      totalCents,
      initialCents,
      financedCents: totalCents - initialCents,
      initialPercentage: percentage
    };
  },

  createSchedule(financedAmount, installmentCount, firstDate) {
    const financedCents = Math.round(Number(financedAmount) * 100);
    const count = Number(installmentCount);
    if (!Number.isSafeInteger(financedCents) || financedCents < 0) {
      throw new Error('El monto financiado no es válido.');
    }
    if (!Number.isInteger(count) || count < 1 || count > 120) {
      throw new Error('El número de cuotas no es válido.');
    }
    if (financedCents === 0) return [];
    if (count > financedCents) {
      throw new Error('El monto financiado es muy pequeño para esa cantidad de cuotas.');
    }

    const startDate = this.parseISODateUTC(firstDate);
    const baseCents = Math.floor(financedCents / count);
    const remainder = financedCents - (baseCents * count);

    return Array.from({ length: count }, (_, index) => {
      const date = new Date(startDate.getTime());
      date.setUTCDate(date.getUTCDate() + (index * 14));
      const amountCents = baseCents + (index < remainder ? 1 : 0);
      return {
        id: `installment_${index + 1}`,
        number: index + 1,
        date: this.toISODateUTC(date),
        amountCents,
        amount: amountCents / 100,
        paid: false,
        paidAt: null
      };
    });
  },

  addPlan(planData) {
    const title = String(planData.title || '').trim();
    const lineType = String(planData.lineType || 'cotidiana');
    const lineRule = this.getLineRule(lineType);
    const installmentCount = Number(planData.installmentCount);
    if (!title) throw new Error('Escribe una compra o descripción.');
    if (!lineRule.installments.includes(installmentCount)) {
      throw new Error(`${lineRule.label} solo permite ${lineRule.installments.join(', ')} cuotas.`);
    }

    const initialDate = String(planData.initialDate || planData.firstDate || '');
    const firstDate = String(planData.firstDate || '');
    this.parseISODateUTC(initialDate);
    this.parseISODateUTC(firstDate);
    const amounts = this.calculateAmounts(planData.totalAmount, planData.initialPercentage ?? 0);
    const schedule = this.createSchedule(amounts.financedCents / 100, installmentCount, firstDate);
    const initialPayment = amounts.initialCents > 0 ? {
      id: 'initial',
      date: initialDate,
      amountCents: amounts.initialCents,
      amount: amounts.initialCents / 100,
      paid: false,
      paidAt: null
    } : null;

    const plan = StorageManager.addCasheaPlan({
      title,
      merchant: String(planData.merchant || '').trim(),
      lineType,
      lineLabel: lineRule.label,
      totalAmount: amounts.totalCents / 100,
      totalCents: amounts.totalCents,
      initialPercentage: amounts.initialPercentage,
      initialAmount: amounts.initialCents / 100,
      initialCents: amounts.initialCents,
      financedAmount: amounts.financedCents / 100,
      financedCents: amounts.financedCents,
      installmentCount,
      initialDate,
      firstDate,
      notes: String(planData.notes || '').trim(),
      initialPayment,
      installments: schedule
    });

    this.syncPlanPayments(plan);
    this.render();
    if (window.App) {
      window.App.updateDashboard();
      window.App.showNotification('Plan Cashea guardado y añadido a tus quincenas.', 'success');
    }
    return plan;
  },

  getPeriodForDate(dateString) {
    const date = this.parseISODateUTC(dateString);
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      period: date.getUTCDate() <= 15 ? 1 : 2
    };
  },

  getEntries(plan) {
    const entries = [];
    if (plan.initialPayment && Number(plan.initialPayment.amountCents || 0) > 0) {
      entries.push({ ...plan.initialPayment, kind: 'initial', number: 0 });
    }
    (plan.installments || []).forEach(installment => {
      entries.push({ ...installment, kind: 'installment' });
    });
    return entries;
  },

  getEntryTitle(plan, entry) {
    if (entry.kind === 'initial') return `Inicial ${this.formatMoney(entry.amount, StorageManager.getSettings().currencySymbol || '$')} · ${plan.title}`;
    return `Cuota ${entry.number}/${plan.installmentCount} · ${plan.title}`;
  },

  syncEntryToQuincena(plan, entry) {
    if (!entry || Number(entry.amountCents || 0) <= 0 || typeof QuincenaManager === 'undefined') return;
    QuincenaManager.upsertCasheaPayment({
      id: `cashea_${plan.id}_${entry.kind}_${entry.id}`,
      title: this.getEntryTitle(plan, entry),
      amount: Number(entry.amountCents) / 100,
      category: 'Cuotas',
      dueDate: entry.date,
      paid: entry.paid === true,
      linkedCasheaPlanId: plan.id,
      linkedCasheaEntryId: entry.id,
      linkedCasheaKind: entry.kind,
      sourceType: 'cashea'
    });
  },

  syncPlanPayments(plan) {
    this.getEntries(plan).forEach(entry => this.syncEntryToQuincena(plan, entry));
  },

  removePlanPayments(planId) {
    if (typeof QuincenaManager === 'undefined') return;
    QuincenaManager.removeCasheaPayments(planId);
  },

  syncPaymentToCashea(payment) {
    if (!payment?.linkedCasheaPlanId) return;
    const plans = StorageManager.getCasheaPlans();
    const plan = plans.find(item => item.id === payment.linkedCasheaPlanId);
    if (!plan) return;

    if (payment.linkedCasheaKind === 'initial' && plan.initialPayment?.id === payment.linkedCasheaEntryId) {
      plan.initialPayment.paid = payment.paid === true;
      plan.initialPayment.paidAt = plan.initialPayment.paid ? new Date().toISOString() : null;
    } else {
      const installment = (plan.installments || []).find(item => item.id === payment.linkedCasheaEntryId);
      if (!installment) return;
      installment.paid = payment.paid === true;
      installment.paidAt = installment.paid ? new Date().toISOString() : null;
    }
    StorageManager.saveCasheaPlans(plans);
    this.render();
  },

  toggleInitialPayment(planId) {
    const plans = StorageManager.getCasheaPlans();
    const plan = plans.find(item => item.id === planId);
    if (!plan?.initialPayment) return;
    plan.initialPayment.paid = !plan.initialPayment.paid;
    plan.initialPayment.paidAt = plan.initialPayment.paid ? new Date().toISOString() : null;
    StorageManager.saveCasheaPlans(plans);
    this.syncEntryToQuincena(plan, { ...plan.initialPayment, kind: 'initial', number: 0 });
    this.render();
    if (window.App) window.App.updateDashboard();
  },

  toggleInstallment(planId, installmentId) {
    const plans = StorageManager.getCasheaPlans();
    const plan = plans.find(item => item.id === planId);
    if (!plan) return;
    const installment = (plan.installments || []).find(item => item.id === installmentId);
    if (!installment) return;
    installment.paid = !installment.paid;
    installment.paidAt = installment.paid ? new Date().toISOString() : null;
    StorageManager.saveCasheaPlans(plans);
    this.syncEntryToQuincena(plan, { ...installment, kind: 'installment' });
    this.render();
    if (window.App) window.App.updateDashboard();
  },

  deletePlan(planId) {
    if (!confirm('¿Eliminar este plan, sus pagos en quincena y todo su calendario?')) return;
    this.removePlanPayments(planId);
    const plans = StorageManager.getCasheaPlans().filter(plan => plan.id !== planId);
    StorageManager.saveCasheaPlans(plans);
    this.render();
    if (window.App) {
      window.App.updateDashboard();
      window.App.showNotification('Plan Cashea eliminado de la aplicación y sus quincenas.', 'info');
    }
  },

  calculateStats(plans = StorageManager.getCasheaPlans()) {
    const unpaid = [];
    let pendingCents = 0;
    let activePlans = 0;

    plans.forEach(plan => {
      const pendingForPlan = this.getEntries(plan).filter(entry => !entry.paid);
      if (pendingForPlan.length) activePlans += 1;
      pendingForPlan.forEach(entry => {
        const amountCents = Number(entry.amountCents || 0);
        pendingCents += amountCents;
        unpaid.push({ ...entry, amountCents, planTitle: plan.title, planId: plan.id });
      });
    });

    unpaid.sort((left, right) => left.date.localeCompare(right.date));
    return { pendingCents, pendingAmount: pendingCents / 100, activePlans, nextInstallment: unpaid[0] || null };
  },

  updatePreview() {
    const preview = document.getElementById('casheaSchedulePreview');
    if (!preview) return;
    const amount = document.getElementById('casheaTotalAmount')?.value;
    const lineType = document.getElementById('casheaLineType')?.value || 'cotidiana';
    const count = Number(document.getElementById('casheaInstallmentCount')?.value);
    const initialPercent = Number(document.getElementById('casheaInitialPercent')?.value || 0);
    const firstDate = document.getElementById('casheaFirstDate')?.value;
    if (!amount || !count || !firstDate) {
      preview.textContent = 'Completa monto, línea, inicial y fecha para previsualizar.';
      return;
    }
    try {
      const amounts = this.calculateAmounts(amount, initialPercent);
      const schedule = this.createSchedule(amounts.financedCents / 100, count, firstDate);
      const first = schedule[0];
      const last = schedule[schedule.length - 1];
      const scheduleText = schedule.length
        ? `${schedule.length} cuotas cada 14 días · ${this.formatDate(first.date)} a ${this.formatDate(last.date)}`
        : 'sin cuotas financiadas';
      preview.textContent = `${this.getLineLabel(lineType)} · Inicial ${initialPercent}% (${this.formatMoney(amounts.initialCents / 100, StorageManager.getSettings().currencySymbol || '$')}) · Financiado ${this.formatMoney(amounts.financedCents / 100, StorageManager.getSettings().currencySymbol || '$')} · ${scheduleText}.`;
    } catch (error) {
      preview.textContent = error.message;
    }
  },

  render() {
    const list = document.getElementById('casheaPlansList');
    if (!list) return;
    const plans = StorageManager.getCasheaPlans();
    const stats = this.calculateStats(plans);
    const symbol = StorageManager.getSettings().currencySymbol || '$';

    const pending = document.getElementById('casheaPendingBalance');
    const active = document.getElementById('casheaActivePlans');
    const next = document.getElementById('casheaNextInstallment');
    const nextDetail = document.getElementById('casheaNextInstallmentDetail');
    if (pending) pending.textContent = this.formatMoney(stats.pendingAmount, symbol);
    if (active) active.textContent = String(stats.activePlans);
    if (next) next.textContent = stats.nextInstallment ? this.formatMoney(stats.nextInstallment.amountCents / 100, symbol) : '—';
    if (nextDetail) nextDetail.textContent = stats.nextInstallment
      ? `${this.formatDate(stats.nextInstallment.date)} · ${stats.nextInstallment.planTitle}`
      : 'Sin pagos pendientes';

    if (!plans.length) {
      list.innerHTML = `
        <div class="cashea-empty">
          <img src="assets/cashea-mark.svg" alt="Cashea" class="cashea-brand-logo w-14 h-14">
          <h3>Aún no hay planes registrados</h3>
          <p>Registra una línea cotidiana o de compras y sus pagos aparecerán automáticamente en tus quincenas.</p>
          <button onclick="App.openAddCasheaModal()" class="btn-cashea"><i data-lucide="plus" class="w-4 h-4"></i> Registrar primer plan</button>
        </div>`;
      if (window.lucide) lucide.createIcons({ root: list });
      return;
    }

    list.innerHTML = plans.map(plan => this.renderPlan(plan, symbol)).join('');
    if (window.lucide) lucide.createIcons({ root: list });
  },

  renderPlan(plan, symbol) {
    const entries = this.getEntries(plan);
    const paidCount = entries.filter(item => item.paid).length;
    const pendingCents = entries.filter(item => !item.paid).reduce((sum, item) => sum + Number(item.amountCents || 0), 0);
    const progress = entries.length ? Math.round((paidCount / entries.length) * 100) : 100;
    const lineLabel = plan.lineLabel || this.getLineLabel(plan.lineType);
    const initialLabel = Number(plan.initialPercentage || 0).toLocaleString('es-ES', { maximumFractionDigits: 2 });

    const initialRow = plan.initialPayment && Number(plan.initialPayment.amountCents || 0) > 0 ? `
      <label class="cashea-installment ${plan.initialPayment.paid ? 'is-paid' : ''}">
        <input type="checkbox" ${plan.initialPayment.paid ? 'checked' : ''} onchange="CasheaManager.toggleInitialPayment('${this.escapeAttribute(plan.id)}')">
        <span class="cashea-number">$</span>
        <span class="cashea-date">Inicial · ${this.formatDate(plan.initialPayment.date)}</span>
        <strong>${this.formatMoney(plan.initialPayment.amountCents / 100, symbol)}</strong>
        <em>${plan.initialPayment.paid ? 'Pagado' : 'Inicial pendiente'}</em>
      </label>` : '';

    return `
      <article class="cashea-plan-card">
        <div class="cashea-plan-head">
          <div class="flex items-center gap-3 min-w-0">
            <img src="assets/cashea-mark.svg" alt="Cashea" class="cashea-brand-logo w-10 h-10 flex-shrink-0">
            <div class="min-w-0">
              <h3>${this.escapeHTML(plan.title)}</h3>
              <p>${this.escapeHTML(lineLabel)} · Inicial ${initialLabel}%${plan.merchant ? ` · ${this.escapeHTML(plan.merchant)}` : ''}</p>
            </div>
          </div>
          <button onclick="CasheaManager.deletePlan('${this.escapeAttribute(plan.id)}')" class="icon-danger" title="Eliminar plan"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        </div>
        <div class="cashea-plan-summary">
          <span><small>Pendiente</small><strong>${this.formatMoney(pendingCents / 100, symbol)}</strong></span>
          <span><small>Pagado</small><strong>${paidCount}/${entries.length}</strong></span>
          <span><small>Financiado</small><strong>${this.formatMoney(Number(plan.financedAmount || 0), symbol)}</strong></span>
        </div>
        <div class="cashea-progress"><span style="width:${progress}%"></span></div>
        <div class="cashea-calendar" aria-label="Calendario completo de pagos Cashea">
          ${initialRow}
          ${(plan.installments || []).map(installment => {
            const amount = Number(installment.amountCents || installment.amount * 100) / 100;
            return `
              <label class="cashea-installment ${installment.paid ? 'is-paid' : ''}">
                <input type="checkbox" ${installment.paid ? 'checked' : ''} onchange="CasheaManager.toggleInstallment('${this.escapeAttribute(plan.id)}','${this.escapeAttribute(installment.id)}')">
                <span class="cashea-number">${installment.number}</span>
                <span class="cashea-date">Cuota · ${this.formatDate(installment.date)}</span>
                <strong>${this.formatMoney(amount, symbol)}</strong>
                <em>${installment.paid ? 'Pagada' : 'Pendiente'}</em>
              </label>`;
          }).join('')}
          ${entries.length === 1 && plan.initialPayment ? '<p class="cashea-preview">Este plan se cubre con el pago inicial; no quedan cuotas financiadas.</p>' : ''}
        </div>
      </article>`;
  },

  formatMoney(amount, symbol) {
    return `${symbol}${Number(amount || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  },

  formatDate(dateString) {
    try {
      return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
        .format(this.parseISODateUTC(dateString));
    } catch (error) {
      return String(dateString || '');
    }
  },

  escapeHTML(value) {
    return String(value || '').replace(/[&<>'"]/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[character]));
  },

  escapeAttribute(value) {
    return this.escapeHTML(value).replace(/`/g, '&#96;');
  }
};

if (typeof globalThis !== 'undefined') globalThis.CasheaManager = CasheaManager;
