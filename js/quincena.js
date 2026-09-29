/* ==========================================================================
   JD FINANZAS - MÓDULO DE GESTIÓN DE QUINCENA
   ========================================================================== */

const CATEGORIES = [
  { name: 'Vivienda', icon: 'home', color: '#8b5cf6' },
  { name: 'Servicios', icon: 'zap', color: '#06b6d4' },
  { name: 'Alimentación', icon: 'shopping-cart', color: '#10b981' },
  { name: 'Transporte', icon: 'truck', color: '#f59e0b' },
  { name: 'Cuotas', icon: 'credit-card', color: '#ec4899' },
  { name: 'Ahorro', icon: 'piggy-bank', color: '#14b8a6' },
  { name: 'Entretenimiento', icon: 'film', color: '#a855f7' },
  { name: 'Salud', icon: 'heart', color: '#ef4444' },
  { name: 'Otro', icon: 'tag', color: '#94a3b8' }
];

const QuincenaManager = {
  activeYear: new Date().getFullYear(),
  activeMonth: new Date().getMonth() + 1,
  activePeriod: new Date().getDate() <= 15 ? 1 : 2,
  chartInstance: null,
  searchFilter: '',
  statusFilter: 'all', // 'all', 'pending', 'paid'
  viewMode: 'list',    // 'list' | 'kanban'
  _initialized: false,

  init() {
    if (!this._initialized) {
      this.setupDateSelectors();
      this.setupFilterListeners();
      this._initialized = true;
    }
    this.render();
  },

  setupFilterListeners() {
    const searchInput = document.getElementById('paymentSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchFilter = e.target.value.toLowerCase().trim();
        this.renderPaymentListFiltered();
      });
    }
  },

  setStatusFilter(status) {
    this.statusFilter = status;
    document.querySelectorAll('[data-status-filter]').forEach(btn => {
      const isCurrent = btn.getAttribute('data-status-filter') === status;
      if (isCurrent) {
        btn.classList.add('bg-purple-600', 'text-white', 'border-purple-400');
        btn.classList.remove('bg-purple-950/60', 'text-purple-300');
      } else {
        btn.classList.remove('bg-purple-600', 'text-white', 'border-purple-400');
        btn.classList.add('bg-purple-950/60', 'text-purple-300');
      }
    });
    this.renderPaymentListFiltered();
  },

  setViewMode(mode) {
    this.viewMode = mode;
    document.querySelectorAll('[data-view-mode]').forEach(btn => {
      const isCurrent = btn.getAttribute('data-view-mode') === mode;
      if (isCurrent) {
        btn.classList.add('bg-purple-600', 'text-white');
        btn.classList.remove('text-purple-400');
      } else {
        btn.classList.remove('bg-purple-600', 'text-white');
        btn.classList.add('text-purple-400');
      }
    });
    this.renderPaymentListFiltered();
  },

  getCurrentData() {
    return StorageManager.getQuincena(this.activeYear, this.activeMonth, this.activePeriod);
  },

  setPeriod(year, month, period) {
    this.activeYear = parseInt(year);
    this.activeMonth = parseInt(month);
    this.activePeriod = parseInt(period);
    this.render();
    if (window.App) {
      window.App.updateDashboard();
    }
  },

  setupDateSelectors() {
    // Se sincroniza con controles en la interfaz
  },

  calculateMetrics(quincenaData) {
    const data = quincenaData || this.getCurrentData();
    const totalIncome = (data.incomeList || []).reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
    const totalPayments = (data.paymentList || []).reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
    
    const totalPaid = (data.paymentList || [])
      .filter(p => p.paid)
      .reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

    const totalPending = (data.paymentList || [])
      .filter(p => !p.paid)
      .reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

    // Saldo libre presupuestado (Ingreso - Total Pagos)
    const freeBalance = totalIncome - totalPayments;

    // Liquidez actual en mano (Ingreso - Lo que ya pagó)
    const currentLiquidity = totalIncome - totalPaid;

    // Porcentaje comprometido
    const committedPercentage = totalIncome > 0 ? Math.min(100, Math.round((totalPayments / totalIncome) * 100)) : 0;

    return {
      totalIncome,
      totalPayments,
      totalPaid,
      totalPending,
      freeBalance,
      currentLiquidity,
      committedPercentage,
      totalItems: (data.paymentList || []).length,
      paidItems: (data.paymentList || []).filter(p => p.paid).length
    };
  },

  // Manejo de Ingresos
  addIncome(title, amount, date) {
    const data = this.getCurrentData();
    data.incomeList = data.incomeList || [];
    data.incomeList.push({
      id: StorageManager.createId('inc'),
      title: title.trim(),
      amount: parseFloat(amount),
      date: date || new Date().toISOString().split('T')[0]
    });
    StorageManager.saveQuincena(data);
    this.render();
    if (window.App) window.App.updateDashboard();
  },

  deleteIncome(incomeId) {
    const data = this.getCurrentData();
    data.incomeList = (data.incomeList || []).filter(i => i.id !== incomeId);
    StorageManager.saveQuincena(data);
    this.render();
    if (window.App) window.App.updateDashboard();
  },

  // Manejo de Pagos
  addPayment(payment) {
    const data = this.getCurrentData();
    data.paymentList = data.paymentList || [];
    const newPayment = {
      id: StorageManager.createId('pay'),
      title: payment.title.trim(),
      amount: parseFloat(payment.amount),
      category: payment.category || 'Otro',
      dueDate: payment.dueDate || '',
      paid: !!payment.paid,
      linkedDebtId: payment.linkedDebtId || null
    };
    data.paymentList.push(newPayment);
    StorageManager.saveQuincena(data);
    this.render();
    if (window.App) window.App.updateDashboard();
    return newPayment;
  },

  togglePayment(paymentId) {
    const data = this.getCurrentData();
    const payment = (data.paymentList || []).find(p => p.id === paymentId);
    if (payment) {
      payment.paid = !payment.paid;
      StorageManager.saveQuincena(data);
      this.render();
      if (window.App) window.App.updateDashboard();

      // Si se marcó como pagado y está vinculado a una deuda en cuotas, preguntar o sincronizar
      if (payment.paid && payment.linkedDebtId) {
        if (window.App && typeof window.App.showNotification === 'function') {
          window.App.showNotification(`¡Genial JD! Pago registrado: "${payment.title}"`, 'success');
        }
      }
    }
  },

  deletePayment(paymentId) {
    const data = this.getCurrentData();
    data.paymentList = (data.paymentList || []).filter(p => p.id !== paymentId);
    StorageManager.saveQuincena(data);
    this.render();
    if (window.App) window.App.updateDashboard();
  },

  // Copiar pagos de la quincena anterior para facilitar la vida a JD
  copyFromPreviousQuincena() {
    let prevPeriod = this.activePeriod === 1 ? 2 : 1;
    let prevMonth = this.activePeriod === 1 ? (this.activeMonth === 1 ? 12 : this.activeMonth - 1) : this.activeMonth;
    let prevYear = this.activePeriod === 1 && this.activeMonth === 1 ? this.activeYear - 1 : this.activeYear;

    const prevData = StorageManager.getQuincena(prevYear, prevMonth, prevPeriod);
    if (!prevData || !prevData.paymentList || prevData.paymentList.length === 0) {
      if (window.App) window.App.showNotification('No hay pagos en la quincena anterior para duplicar.', 'info');
      return;
    }

    const currentData = this.getCurrentData();
    currentData.paymentList = currentData.paymentList || [];

    // Clona los pagos reiniciando el estado a pendiente
    let count = 0;
    prevData.paymentList.forEach(item => {
      // Ajusta la fecha a la quincena actual
      const day = item.dueDate ? item.dueDate.split('-')[2] : '15';
      const newDueDate = `${this.activeYear}-${String(this.activeMonth).padStart(2, '0')}-${day}`;
      currentData.paymentList.push({
        id: StorageManager.createId('pay'),
        title: item.title,
        amount: item.amount,
        category: item.category,
        dueDate: newDueDate,
        paid: false,
        linkedDebtId: item.linkedDebtId || null
      });
      count++;
    });

    StorageManager.saveQuincena(currentData);
    this.render();
    if (window.App) {
      window.App.updateDashboard();
      window.App.showNotification(`¡Listo JD! Se duplicaron ${count} compromisos de la quincena anterior como pendientes.`, 'success');
    }
  },

  // Renderizado en el DOM
  render() {
    const data = this.getCurrentData();
    const metrics = this.calculateMetrics(data);
    const settings = StorageManager.getSettings();
    const symbol = settings.currencySymbol || '$';

    // 1. Selector de Quincena Header / Labels
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const monthName = monthNames[this.activeMonth - 1];
    const qTitle = `${this.activePeriod}ª Quincena - ${monthName} ${this.activeYear}`;
    const qRange = this.activePeriod === 1 ? `1 al 15 de ${monthName}` : `16 al fin de ${monthName}`;

    const titleEl = document.getElementById('currentQuincenaTitle');
    const rangeEl = document.getElementById('currentQuincenaRange');
    if (titleEl) titleEl.textContent = qTitle;
    if (rangeEl) rangeEl.textContent = qRange;

    // Sincronizar selectores si existen
    const monthSelect = document.getElementById('selectMonth');
    const yearSelect = document.getElementById('selectYear');
    const periodSelect = document.getElementById('selectPeriod');
    if (monthSelect) monthSelect.value = this.activeMonth;
    if (yearSelect) yearSelect.value = this.activeYear;
    if (periodSelect) periodSelect.value = this.activePeriod;

    // 2. Tarjetas KPI de la Quincena
    const elIncome = document.getElementById('qTotalIncome');
    const elPayments = document.getElementById('qTotalPayments');
    const elPaid = document.getElementById('qTotalPaid');
    const elPending = document.getElementById('qTotalPending');
    const elBalance = document.getElementById('qFreeBalance');
    const elPercentage = document.getElementById('qCommittedPercentage');
    const elProgressBar = document.getElementById('qProgressBar');

    if (elIncome) elIncome.textContent = `${symbol}${metrics.totalIncome.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (elPayments) elPayments.textContent = `${symbol}${metrics.totalPayments.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (elPaid) elPaid.textContent = `${symbol}${metrics.totalPaid.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (elPending) elPending.textContent = `${symbol}${metrics.totalPending.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (elBalance) {
      elBalance.textContent = `${symbol}${metrics.freeBalance.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      elBalance.className = metrics.freeBalance >= 0 ? 'text-2xl font-black text-emerald-400' : 'text-2xl font-black text-rose-400';
    }
    if (elPercentage) elPercentage.textContent = `${metrics.committedPercentage}%`;
    if (elProgressBar) {
      elProgressBar.style.width = `${Math.min(100, metrics.committedPercentage)}%`;
      elProgressBar.className = metrics.committedPercentage > 90 ? 'progress-fill-purple !bg-rose-500' : (metrics.committedPercentage > 70 ? 'progress-fill-purple !bg-amber-500' : 'progress-fill-purple');
    }

    // 3. Renderizar lista de pagos
    this.renderPaymentList(data.paymentList || [], symbol);

    // 4. Renderizar lista de ingresos
    this.renderIncomeList(data.incomeList || [], symbol);

    // 5. Renderizar Gráfico de Quincena
    this.renderChart(data.paymentList || []);
  },

  renderPaymentListFiltered() {
    const data = this.getCurrentData();
    const settings = StorageManager.getSettings();
    const symbol = settings.currencySymbol || '$';
    this.renderPaymentList(data.paymentList || [], symbol);
  },

  renderIncomeList(incomes, symbol) {
    const listEl = document.getElementById('incomeItemsList');
    if (!listEl) return;

    if (incomes.length === 0) {
      listEl.innerHTML = `
        <div class="text-center py-5 px-3 rounded-2xl border border-dashed border-purple-800/40 bg-purple-950/20">
          <div class="w-8 h-8 mx-auto mb-2 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <i data-lucide="arrow-down-left" class="w-4 h-4"></i>
          </div>
          <p class="text-xs text-purple-200/80 mb-2 font-medium">Aún no has añadido ingresos para esta quincena.</p>
          <button onclick="App.openAddIncomeModal()" class="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold hover:bg-emerald-500/30 transition flex items-center gap-1.5 mx-auto">
            <i data-lucide="plus" class="w-3.5 h-3.5"></i> Añadir mi Ingreso
          </button>
        </div>`;
      if (window.lucide) lucide.createIcons({ root: listEl });
      return;
    }

    listEl.innerHTML = incomes.map(inc => `
      <div class="flex items-center justify-between p-3 rounded-xl bg-purple-950/40 border border-purple-900/40 hover:border-purple-600/40 transition">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <i data-lucide="arrow-down-left" class="w-5 h-5"></i>
          </div>
          <div>
            <div class="font-semibold text-white text-sm">${this.escapeHTML(inc.title)}</div>
            <div class="text-xs text-purple-300/70">${inc.date || 'Fecha no fijada'}</div>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-emerald-400 font-bold text-sm">+${symbol}${Number(inc.amount).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
          <button onclick="QuincenaManager.deleteIncome('${inc.id}')" class="text-purple-400/50 hover:text-rose-400 transition p-1.5" title="Eliminar ingreso">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
    `).join('');

    if (window.lucide) lucide.createIcons({ root: listEl });
  },

  renderPaymentList(payments, symbol) {
    const listEl = document.getElementById('paymentItemsList');
    if (!listEl) return;

    // 1. Filtrar por estado (Odoo filters)
    let filtered = [...payments];
    if (this.statusFilter === 'pending') {
      filtered = filtered.filter(p => !p.paid);
    } else if (this.statusFilter === 'paid') {
      filtered = filtered.filter(p => p.paid);
    }

    // 2. Filtrar por búsqueda de texto
    if (this.searchFilter) {
      filtered = filtered.filter(p => 
        (p.title || '').toLowerCase().includes(this.searchFilter) ||
        (p.category || '').toLowerCase().includes(this.searchFilter)
      );
    }

    // Estado vacío
    if (filtered.length === 0) {
      if (payments.length === 0) {
        listEl.innerHTML = `
          <div class="text-center py-12 px-4 rounded-2xl border border-dashed border-purple-800/40 bg-purple-950/20">
            <div class="w-14 h-14 mx-auto mb-3 rounded-2xl bg-purple-900/30 flex items-center justify-center text-purple-400">
              <i data-lucide="sparkles" class="w-7 h-7"></i>
            </div>
            <h4 class="text-base font-bold text-white mb-1">¡Quincena limpia! Sin pagos registrados</h4>
            <p class="text-xs text-purple-300/70 max-w-xs mx-auto mb-4">Comienza registrando tus gastos fijos (Alquiler, Servicios, Tarjetas o Cuotas) para tener el control exacto.</p>
            <div class="flex justify-center gap-2">
              <button onclick="App.openAddPaymentModal()" class="btn-purple px-4 py-2 rounded-xl text-xs flex items-center gap-2 font-bold">
                <i data-lucide="plus" class="w-4 h-4"></i> Añadir mi Primer Gasto
              </button>
              <button onclick="QuincenaManager.copyFromPreviousQuincena()" class="px-4 py-2 rounded-xl text-xs bg-purple-900/40 hover:bg-purple-900/70 border border-purple-700/50 text-purple-200 flex items-center gap-2">
                <i data-lucide="copy" class="w-4 h-4"></i> Duplicar Anterior
              </button>
            </div>
          </div>
        `;
      } else {
        listEl.innerHTML = `
          <div class="text-center py-8 px-4 rounded-2xl bg-purple-950/20 border border-purple-900/40 text-purple-300/70 text-xs">
            No se encontraron pagos con el filtro actual ("${this.searchFilter || this.statusFilter}").
          </div>
        `;
      }
      if (window.lucide) lucide.createIcons({ root: listEl });
      return;
    }

    // Ordenar: Pendientes primero, luego por fecha de vencimiento
    filtered.sort((a, b) => {
      if (a.paid === b.paid) {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      }
      return a.paid ? 1 : -1;
    });

    // Vista KANBAN estilo Odoo
    if (this.viewMode === 'kanban') {
      listEl.className = 'grid grid-cols-1 sm:grid-cols-2 gap-3';
      listEl.innerHTML = filtered.map(pay => {
        const isPaid = pay.paid;
        const categoryObj = CATEGORIES.find(c => c.name === pay.category) || { icon: 'tag', color: '#a78bfa' };

        return `
          <div class="glass-card p-4 border ${isPaid ? 'border-emerald-500/30 bg-emerald-950/10' : 'border-purple-800/50'} flex flex-col justify-between transition relative overflow-hidden">
            <div class="flex items-start justify-between gap-2 mb-2.5">
              <div class="flex items-center gap-2 min-w-0">
                <div class="w-9 h-9 rounded-xl bg-purple-900/60 border border-purple-700/40 flex items-center justify-center flex-shrink-0" style="color: ${categoryObj.color}">
                  <i data-lucide="${categoryObj.icon}" class="w-4 h-4"></i>
                </div>
                <div class="min-w-0">
                  <h4 class="font-bold text-white text-sm truncate ${isPaid ? 'line-through text-slate-400' : ''}">${this.escapeHTML(pay.title)}</h4>
                  <span class="text-[11px] text-purple-300/70">${pay.category}</span>
                </div>
              </div>

              <input type="checkbox" 
                     class="custom-checkbox mt-0.5" 
                     ${isPaid ? 'checked' : ''} 
                     onchange="QuincenaManager.togglePayment('${pay.id}')"
                     title="${isPaid ? 'Marcar como pendiente' : 'Marcar como pagado'}">
            </div>

            <div class="flex items-end justify-between pt-2 border-t border-purple-900/40 mt-2">
              <div>
                <div class="text-[10px] text-purple-300/60">${pay.dueDate ? 'Vence: ' + this.formatDueDate(pay.dueDate) : 'Sin fecha'}</div>
                <div class="mt-1">${isPaid ? '<span class="badge-paid px-2 py-0.5 rounded-full text-[10px] font-bold">PAGADO</span>' : this.getDueDateBadge(pay.dueDate)}</div>
              </div>
              <div class="text-right">
                <div class="font-black text-base ${isPaid ? 'text-emerald-400' : 'text-purple-100'}">
                  ${symbol}${Number(pay.amount).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                </div>
                <button onclick="QuincenaManager.deletePayment('${pay.id}')" class="text-purple-400/40 hover:text-rose-400 text-xs p-1 transition mt-0.5" title="Eliminar">
                  <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    } else {
      // Vista LISTA clásica estilo Odoo
      listEl.className = 'space-y-2.5';
      listEl.innerHTML = filtered.map(pay => {
        const isPaid = pay.paid;
        const statusBadge = isPaid
          ? '<span class="badge-paid px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1"><i data-lucide="check" class="w-3 h-3"></i> Pagado</span>'
          : this.getDueDateBadge(pay.dueDate);

        const categoryObj = CATEGORIES.find(c => c.name === pay.category) || { icon: 'tag', color: '#a78bfa' };

        return `
          <div class="payment-item ${isPaid ? 'is-paid' : ''} glass-card p-3.5 sm:p-4 flex items-center justify-between gap-3 border border-purple-900/50 transition">
            <div class="flex items-center gap-3 sm:gap-4 min-w-0">
              <input type="checkbox" 
                     class="custom-checkbox" 
                     ${isPaid ? 'checked' : ''} 
                     onchange="QuincenaManager.togglePayment('${pay.id}')"
                     title="${isPaid ? 'Marcar como pendiente' : 'Marcar como pagado'}">
              
              <div class="w-10 h-10 rounded-xl bg-purple-900/50 border border-purple-700/30 flex-shrink-0 flex items-center justify-center text-purple-300">
                <i data-lucide="${categoryObj.icon}" class="w-5 h-5" style="color: ${categoryObj.color}"></i>
              </div>

              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="payment-title font-bold text-white text-sm sm:text-base truncate">${this.escapeHTML(pay.title)}</span>
                  ${pay.linkedDebtId ? '<span class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30">CUOTA</span>' : ''}
                </div>
                <div class="flex items-center gap-2 text-xs text-purple-300/70 mt-0.5 flex-wrap">
                  <span>${pay.category}</span>
                  ${pay.dueDate ? `<span>• Vence: ${this.formatDueDate(pay.dueDate)}</span>` : ''}
                </div>
              </div>
            </div>

            <div class="flex items-center gap-3 sm:gap-4 flex-shrink-0">
              <div class="text-right">
                <div class="font-extrabold text-sm sm:text-base ${isPaid ? 'text-emerald-400' : 'text-purple-100'}">
                  ${symbol}${Number(pay.amount).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div class="mt-0.5">${statusBadge}</div>
              </div>

              <button onclick="QuincenaManager.deletePayment('${pay.id}')" class="text-purple-400/40 hover:text-rose-400 transition p-1.5" title="Eliminar compromiso">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </div>
        `;
      }).join('');
    }

    if (window.lucide) lucide.createIcons({ root: listEl });
  },

  getDueDateBadge(dueDate) {
    if (!dueDate) {
      return '<span class="badge-purple px-2 py-0.5 rounded-full text-[11px] font-medium">Pendiente</span>';
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate + 'T00:00:00');
    const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return `<span class="badge-danger px-2 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1"><i data-lucide="alert-circle" class="w-3 h-3"></i> Vencido</span>`;
    } else if (diffDays === 0) {
      return `<span class="badge-pending px-2 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1"><i data-lucide="clock" class="w-3 h-3"></i> Vence hoy</span>`;
    } else if (diffDays <= 3) {
      return `<span class="badge-pending px-2 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1"><i data-lucide="clock" class="w-3 h-3"></i> ${diffDays} días</span>`;
    } else {
      return `<span class="badge-purple px-2 py-0.5 rounded-full text-[11px] font-medium">${diffDays} días</span>`;
    }
  },

  formatDueDate(dateString) {
    try {
      const parts = dateString.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}`;
      }
      return dateString;
    } catch (e) {
      return dateString;
    }
  },

  renderChart(payments) {
    const canvas = document.getElementById('quincenaCategoryChart');
    if (!canvas) return;

    // Calcular montos por categoría
    const categoryTotals = {};
    payments.forEach(p => {
      const cat = p.category || 'Otro';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(p.amount);
    });

    const labels = Object.keys(categoryTotals);
    const dataValues = Object.values(categoryTotals);

    if (labels.length === 0) {
      if (this.chartInstance) {
        this.chartInstance.destroy();
        this.chartInstance = null;
      }
      return;
    }

    const colors = [
      '#8b5cf6', '#a855f7', '#c084fc', '#ec4899', 
      '#06b6d4', '#10b981', '#f59e0b', '#6366f1', '#64748b'
    ];

    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    if (typeof Chart === 'undefined') return;

    const ctx = canvas.getContext('2d');
    this.chartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: dataValues,
          backgroundColor: colors.slice(0, labels.length),
          borderWidth: 2,
          borderColor: '#0d0620'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              padding: 12,
              color: '#cbd5e1',
              font: {
                family: 'Plus Jakarta Sans',
                size: 11
              }
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const settings = StorageManager.getSettings();
                return ` ${context.label}: ${settings.currencySymbol || '$'}${context.parsed.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
              }
            }
          }
        }
      }
    });
  },

  escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }
};
