/* ==========================================================================
   JD FINANZAS - SEGUIMIENTO PERSONAL DE PLANES CASHEA
   ========================================================================== */

const CasheaManager = {
  _initialized: false,

  init() {
    if (!this._initialized) this._initialized = true;
    this.render();
  },

  parseISODateUTC(dateString) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateString || ''));
    if (!match) throw new Error('La fecha inicial no es válida.');
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      throw new Error('La fecha inicial no existe.');
    }
    return date;
  },

  toISODateUTC(date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  },

  createSchedule(totalAmount, installmentCount, firstDate) {
    const totalCents = Math.round(Number(totalAmount) * 100);
    const count = Number(installmentCount);
    if (!Number.isSafeInteger(totalCents) || totalCents <= 0) throw new Error('El monto total debe ser mayor que cero y estar dentro del rango permitido.');
    if (!Number.isInteger(count) || count < 1 || count > 120) throw new Error('El número de cuotas debe estar entre 1 y 120.');
    if (count > totalCents) throw new Error('El número de cuotas no puede superar los centavos del total: cada cuota debe ser de al menos 0.01.');

    const startDate = this.parseISODateUTC(firstDate);
    const baseCents = Math.floor(totalCents / count);
    const remainder = totalCents - (baseCents * count);

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
    if (!title) throw new Error('Escribe una compra o descripción.');
    const schedule = this.createSchedule(planData.totalAmount, Number(planData.installmentCount), planData.firstDate);
    const totalCents = schedule.reduce((sum, installment) => sum + installment.amountCents, 0);

    const plan = StorageManager.addCasheaPlan({
      title,
      merchant: String(planData.merchant || '').trim(),
      totalAmount: totalCents / 100,
      totalCents,
      installmentCount: schedule.length,
      firstDate: planData.firstDate,
      notes: String(planData.notes || '').trim(),
      installments: schedule
    });
    this.render();
    if (window.App) {
      window.App.updateDashboard();
      window.App.showNotification('Plan Cashea guardado con su calendario quincenal.', 'success');
    }
    return plan;
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
    this.render();
    if (window.App) window.App.updateDashboard();
  },

  deletePlan(planId) {
    if (!confirm('¿Eliminar este plan y todo su calendario de cuotas?')) return;
    const plans = StorageManager.getCasheaPlans().filter(plan => plan.id !== planId);
    StorageManager.saveCasheaPlans(plans);
    this.render();
    if (window.App) {
      window.App.updateDashboard();
      window.App.showNotification('Plan Cashea eliminado.', 'info');
    }
  },

  calculateStats(plans = StorageManager.getCasheaPlans()) {
    const unpaid = [];
    let pendingCents = 0;
    let activePlans = 0;

    plans.forEach(plan => {
      const pendingForPlan = (plan.installments || []).filter(installment => !installment.paid);
      if (pendingForPlan.length) activePlans += 1;
      pendingForPlan.forEach(installment => {
        const amountCents = Number.isInteger(installment.amountCents)
          ? installment.amountCents
          : Math.round(Number(installment.amount || 0) * 100);
        pendingCents += amountCents;
        unpaid.push({ ...installment, amountCents, planTitle: plan.title, planId: plan.id });
      });
    });

    unpaid.sort((left, right) => left.date.localeCompare(right.date));
    return { pendingCents, pendingAmount: pendingCents / 100, activePlans, nextInstallment: unpaid[0] || null };
  },

  updatePreview() {
    const preview = document.getElementById('casheaSchedulePreview');
    if (!preview) return;
    const amount = document.getElementById('casheaTotalAmount')?.value;
    const count = Number(document.getElementById('casheaInstallmentCount')?.value);
    const date = document.getElementById('casheaFirstDate')?.value;
    if (!amount || !count || !date) {
      preview.textContent = 'Completa monto, cuotas y fecha para previsualizar el calendario.';
      return;
    }
    try {
      const schedule = this.createSchedule(amount, count, date);
      const first = schedule[0];
      const last = schedule[schedule.length - 1];
      preview.textContent = `${schedule.length} cuotas cada 14 días · ${this.formatDate(first.date)} a ${this.formatDate(last.date)} · suma exacta.`;
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
      : 'Sin cuotas pendientes';

    if (!plans.length) {
      list.innerHTML = `
        <div class="cashea-empty">
          <img src="assets/cashea-mark.svg" alt="Cashea" class="cashea-brand-logo w-14 h-14">
          <h3>Aún no hay planes registrados</h3>
          <p>Cuando agregues una compra verás aquí cada cuota separada exactamente por 14 días.</p>
          <button onclick="App.openAddCasheaModal()" class="btn-cashea"><i data-lucide="plus" class="w-4 h-4"></i> Registrar primer plan</button>
        </div>`;
      if (window.lucide) lucide.createIcons({ root: list });
      return;
    }

    list.innerHTML = plans.map(plan => this.renderPlan(plan, symbol)).join('');
    if (window.lucide) lucide.createIcons({ root: list });
  },

  renderPlan(plan, symbol) {
    const installments = Array.isArray(plan.installments) ? plan.installments : [];
    const paidCount = installments.filter(item => item.paid).length;
    const pendingCents = installments.filter(item => !item.paid).reduce((sum, item) => {
      return sum + (Number.isInteger(item.amountCents) ? item.amountCents : Math.round(Number(item.amount || 0) * 100));
    }, 0);
    const progress = installments.length ? Math.round((paidCount / installments.length) * 100) : 0;

    return `
      <article class="cashea-plan-card">
        <div class="cashea-plan-head">
          <div class="flex items-center gap-3 min-w-0">
            <img src="assets/cashea-mark.svg" alt="Cashea" class="cashea-brand-logo w-10 h-10 flex-shrink-0">
            <div class="min-w-0">
              <h3>${this.escapeHTML(plan.title)}</h3>
              <p>${plan.merchant ? this.escapeHTML(plan.merchant) : 'Comercio no especificado'}${plan.notes ? ` · ${this.escapeHTML(plan.notes)}` : ''}</p>
            </div>
          </div>
          <button onclick="CasheaManager.deletePlan('${this.escapeAttribute(plan.id)}')" class="icon-danger" title="Eliminar plan"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        </div>
        <div class="cashea-plan-summary">
          <span><small>Pendiente</small><strong>${this.formatMoney(pendingCents / 100, symbol)}</strong></span>
          <span><small>Progreso</small><strong>${paidCount}/${installments.length}</strong></span>
          <span><small>Total</small><strong>${this.formatMoney(Number(plan.totalAmount || 0), symbol)}</strong></span>
        </div>
        <div class="cashea-progress"><span style="width:${progress}%"></span></div>
        <div class="cashea-calendar" aria-label="Calendario completo de cuotas">
          ${installments.map(installment => {
            const amount = Number.isInteger(installment.amountCents) ? installment.amountCents / 100 : Number(installment.amount || 0);
            return `
              <label class="cashea-installment ${installment.paid ? 'is-paid' : ''}">
                <input type="checkbox" ${installment.paid ? 'checked' : ''} onchange="CasheaManager.toggleInstallment('${this.escapeAttribute(plan.id)}','${this.escapeAttribute(installment.id)}')">
                <span class="cashea-number">${installment.number}</span>
                <span class="cashea-date">${this.formatDate(installment.date)}</span>
                <strong>${this.formatMoney(amount, symbol)}</strong>
                <em>${installment.paid ? 'Pagada' : 'Pendiente'}</em>
              </label>`;
          }).join('')}
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
