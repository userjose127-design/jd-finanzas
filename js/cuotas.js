/* ==========================================================================
   JD FINANZAS - MÓDULO DE DEUDAS EN CUOTAS (TRACKER & AMORTIZACIÓN)
   ========================================================================== */

const CuotasManager = {
  statusFilter: 'all', // 'all', 'active', 'completed'
  searchFilter: '',

  init() {
    this.setupFilterListeners();
    this.render();
  },

  setupFilterListeners() {
    const searchInput = document.getElementById('debtSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchFilter = e.target.value.toLowerCase().trim();
        this.render();
      });
    }
  },

  setStatusFilter(status) {
    this.statusFilter = status;
    document.querySelectorAll('[data-debt-filter]').forEach(btn => {
      const isCurrent = btn.getAttribute('data-debt-filter') === status;
      if (isCurrent) {
        btn.classList.add('bg-purple-600', 'text-white', 'border-purple-400');
        btn.classList.remove('bg-purple-950/60', 'text-purple-300');
      } else {
        btn.classList.remove('bg-purple-600', 'text-white', 'border-purple-400');
        btn.classList.add('bg-purple-950/60', 'text-purple-300');
      }
    });
    this.render();
  },

  getDebts() {
    return StorageManager.getDebts();
  },

  calculateOverallStats() {
    const debts = this.getDebts();
    let totalInitialDebt = 0;
    let totalRemainingDebt = 0;
    let totalPaidSoFar = 0;
    let totalMonthlyCommitment = 0;
    let activeDebtsCount = 0;
    let finishedDebtsCount = 0;

    debts.forEach(d => {
      const totalAmount = Number(d.totalAmount || 0);
      const installmentAmount = Number(d.installmentAmount || 0);
      const totalInstallments = Number(d.totalInstallments || 1);
      const paidInstallments = Number(d.paidInstallments || 0);
      
      const paidAmount = paidInstallments * installmentAmount;
      const remainingAmount = Math.max(0, totalAmount - paidAmount);

      totalInitialDebt += totalAmount;
      totalPaidSoFar += paidAmount;
      totalRemainingDebt += remainingAmount;

      if (paidInstallments < totalInstallments) {
        activeDebtsCount++;
        totalMonthlyCommitment += installmentAmount;
      } else {
        finishedDebtsCount++;
      }
    });

    const globalProgress = totalInitialDebt > 0 
      ? Math.round((totalPaidSoFar / totalInitialDebt) * 100) 
      : 0;

    return {
      totalInitialDebt,
      totalRemainingDebt,
      totalPaidSoFar,
      totalMonthlyCommitment,
      activeDebtsCount,
      finishedDebtsCount,
      globalProgress,
      totalCount: debts.length
    };
  },

  addDebt(debtData) {
    const totalAmount = parseFloat(debtData.totalAmount);
    const totalInstallments = parseInt(debtData.totalInstallments);
    const paidInstallments = parseInt(debtData.paidInstallments || 0);
    let installmentAmount = parseFloat(debtData.installmentAmount);

    // Auto calcular monto por cuota si no fue especificado
    if (!installmentAmount && totalAmount && totalInstallments) {
      installmentAmount = parseFloat((totalAmount / totalInstallments).toFixed(2));
    }

    const newDebt = {
      title: debtData.title.trim(),
      creditor: (debtData.creditor || 'Varios').trim(),
      totalAmount: totalAmount,
      totalInstallments: totalInstallments,
      paidInstallments: paidInstallments,
      installmentAmount: installmentAmount,
      dueDateDay: parseInt(debtData.dueDateDay || 15),
      quincenaTarget: parseInt(debtData.quincenaTarget || 1),
      notes: (debtData.notes || '').trim(),
      category: debtData.category || 'Cuotas'
    };

    StorageManager.addDebt(newDebt);
    this.render();
    if (window.App) {
      window.App.updateDashboard();
      window.App.showNotification('¡Deuda en cuotas registrada con éxito!', 'success');
    }
  },

  advanceInstallment(debtId) {
    const debts = this.getDebts();
    const debt = debts.find(d => d.id === debtId);
    if (!debt) return;

    if (debt.paidInstallments < debt.totalInstallments) {
      debt.paidInstallments++;
      StorageManager.saveDebts(debts);
      this.render();
      if (window.App) window.App.updateDashboard();

      // Celebración si completó la deuda
      if (debt.paidInstallments === debt.totalInstallments) {
        if (typeof confetti === 'function') {
          confetti({
            particleCount: 120,
            spread: 80,
            origin: { y: 0.6 }
          });
        }
        if (window.App) {
          window.App.showNotification(`🎉 ¡FELICIDADES JD! Liquidaste por completo la deuda "${debt.title}".`, 'success');
        }
      } else {
        if (window.App) {
          window.App.showNotification(`Cuota ${debt.paidInstallments}/${debt.totalInstallments} registrada para "${debt.title}".`, 'success');
        }
      }
    }
  },

  revertInstallment(debtId) {
    const debts = this.getDebts();
    const debt = debts.find(d => d.id === debtId);
    if (!debt) return;

    if (debt.paidInstallments > 0) {
      debt.paidInstallments--;
      StorageManager.saveDebts(debts);
      this.render();
      if (window.App) {
        window.App.updateDashboard();
        window.App.showNotification(`Cuota retrocedida a ${debt.paidInstallments}/${debt.totalInstallments}.`, 'info');
      }
    }
  },

  deleteDebt(debtId) {
    if (confirm('¿Seguro que deseas eliminar esta deuda en cuotas?')) {
      StorageManager.deleteDebt(debtId);
      this.render();
      if (window.App) {
        window.App.updateDashboard();
        window.App.showNotification('Deuda eliminada del registro.', 'info');
      }
    }
  },

  // Añadir esta cuota a los compromisos de la quincena activa
  addInstallmentToCurrentQuincena(debtId) {
    const debts = this.getDebts();
    const debt = debts.find(d => d.id === debtId);
    if (!debt) return;

    const nextCuotaNumber = Math.min(debt.totalInstallments, debt.paidInstallments + 1);
    const day = String(debt.dueDateDay || 15).padStart(2, '0');
    const dueDate = `${QuincenaManager.activeYear}-${String(QuincenaManager.activeMonth).padStart(2, '0')}-${day}`;

    QuincenaManager.addPayment({
      title: `Cuota ${debt.title} (${nextCuotaNumber}/${debt.totalInstallments})`,
      amount: debt.installmentAmount,
      category: 'Cuotas',
      dueDate: dueDate,
      paid: false,
      linkedDebtId: debt.id
    });

    if (window.App) {
      window.App.showNotification(`Cuota de "${debt.title}" cargada a la quincena actual`, 'success');
    }
  },

  render() {
    const debts = this.getDebts();
    const stats = this.calculateOverallStats();
    const settings = StorageManager.getSettings();
    const symbol = settings.currencySymbol || '$';

    // 1. Métricas del Panel de Cuotas
    const elRemaining = document.getElementById('debtsTotalRemaining');
    const elInitial = document.getElementById('debtsTotalInitial');
    const elCommitment = document.getElementById('debtsMonthlyCommitment');
    const elProgress = document.getElementById('debtsGlobalProgress');
    const elProgressBar = document.getElementById('debtsGlobalProgressBar');

    if (elRemaining) elRemaining.textContent = `${symbol}${stats.totalRemainingDebt.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
    if (elInitial) elInitial.textContent = `${symbol}${stats.totalInitialDebt.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
    if (elCommitment) elCommitment.textContent = `${symbol}${stats.totalMonthlyCommitment.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
    if (elProgress) elProgress.textContent = `${stats.globalProgress}%`;
    if (elProgressBar) elProgressBar.style.width = `${stats.globalProgress}%`;

    // 2. Render de la lista de deudas
    const listEl = document.getElementById('debtsItemsList');
    if (!listEl) return;

    let filtered = [...debts];
    if (this.statusFilter === 'active') {
      filtered = filtered.filter(d => (d.paidInstallments || 0) < (d.totalInstallments || 1));
    } else if (this.statusFilter === 'completed') {
      filtered = filtered.filter(d => (d.paidInstallments || 0) >= (d.totalInstallments || 1));
    }

    if (this.searchFilter) {
      filtered = filtered.filter(d => 
        (d.title || '').toLowerCase().includes(this.searchFilter) ||
        (d.creditor || '').toLowerCase().includes(this.searchFilter)
      );
    }

    if (filtered.length === 0) {
      if (debts.length === 0) {
        listEl.innerHTML = `
          <div class="text-center py-12 px-4 rounded-2xl border border-dashed border-purple-800/40 bg-purple-950/20">
            <div class="w-14 h-14 mx-auto mb-3 rounded-2xl bg-purple-900/30 flex items-center justify-center text-purple-400">
              <i data-lucide="award" class="w-7 h-7"></i>
            </div>
            <h4 class="text-base font-bold text-white mb-1">¡No tienes deudas en cuotas registradas!</h4>
            <p class="text-xs text-purple-300/70 max-w-xs mx-auto mb-4">Lleva el control exacto de tus tarjetas, préstamos o compras diferidas en cuotas.</p>
            <button onclick="App.openAddDebtModal()" class="btn-purple px-4 py-2 rounded-xl text-xs inline-flex items-center gap-2">
              <i data-lucide="plus" class="w-4 h-4"></i> Añadir Primera Cuota
            </button>
          </div>
        `;
      } else {
        listEl.innerHTML = `
          <div class="text-center py-8 px-4 rounded-2xl bg-purple-950/20 border border-purple-900/40 text-purple-300/70 text-xs">
            No se encontraron cuotas con el filtro actual.
          </div>
        `;
      }
      if (window.lucide) lucide.createIcons({ root: listEl });
      return;
    }

    listEl.innerHTML = filtered.map(d => {
      const totalAmount = Number(d.totalAmount || 0);
      const installmentAmount = Number(d.installmentAmount || 0);
      const totalInstallments = Number(d.totalInstallments || 1);
      const paidInstallments = Number(d.paidInstallments || 0);
      
      const paidAmount = paidInstallments * installmentAmount;
      const remainingAmount = Math.max(0, totalAmount - paidAmount);
      const percent = Math.min(100, Math.round((paidInstallments / totalInstallments) * 100));
      const isCompleted = paidInstallments >= totalInstallments;
      const remainingInstallments = Math.max(0, totalInstallments - paidInstallments);

      return `
        <div class="glass-card p-4 sm:p-5 border ${isCompleted ? 'border-emerald-500/30 bg-emerald-950/10' : 'border-purple-900/50'} relative overflow-hidden transition">
          ${isCompleted ? `
            <div class="absolute -right-8 top-5 rotate-45 bg-emerald-500 text-purple-950 font-black text-[9px] py-0.5 px-8 shadow">
              LIQUIDADA
            </div>
          ` : ''}

          <div class="flex items-start justify-between gap-3 mb-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h4 class="font-extrabold text-white text-base sm:text-lg truncate">${this.escapeHTML(d.title)}</h4>
                <span class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-900/60 text-purple-300 border border-purple-700/40">
                  ${this.escapeHTML(d.creditor)}
                </span>
              </div>
              <p class="text-xs text-purple-300/70 mt-0.5">
                Paga en: <strong class="text-purple-200">${d.quincenaTarget === 1 ? '1ª Quincena' : '2ª Quincena'} (Día ~${d.dueDateDay})</strong>
                ${d.notes ? ` • ${this.escapeHTML(d.notes)}` : ''}
              </p>
            </div>

            <button onclick="CuotasManager.deleteDebt('${d.id}')" class="text-purple-400/40 hover:text-rose-400 transition p-1" title="Eliminar deuda">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>

          <!-- Datos cuantitativos -->
          <div class="grid grid-cols-3 gap-2 sm:gap-4 my-3 p-3 rounded-xl bg-purple-950/40 border border-purple-900/40 text-center">
            <div>
              <div class="text-[10px] text-purple-300/70 uppercase tracking-wider">Por Cuota</div>
              <div class="font-bold text-white text-sm sm:text-base mt-0.5">${symbol}${installmentAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</div>
            </div>
            <div>
              <div class="text-[10px] text-purple-300/70 uppercase tracking-wider">Resta por Pagar</div>
              <div class="font-bold ${isCompleted ? 'text-emerald-400' : 'text-purple-200'} text-sm sm:text-base mt-0.5">
                ${symbol}${remainingAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div>
              <div class="text-[10px] text-purple-300/70 uppercase tracking-wider">Total Inicial</div>
              <div class="font-bold text-purple-300/80 text-sm sm:text-base mt-0.5">${symbol}${totalAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>

          <!-- Barra de Progreso de Amortización -->
          <div class="mb-3">
            <div class="flex items-center justify-between text-xs mb-1.5 font-medium">
              <span class="text-purple-300 flex items-center gap-1.5">
                <i data-lucide="check-circle-2" class="w-3.5 h-3.5 text-purple-400"></i>
                Cuota <strong>${paidInstallments}</strong> de <strong>${totalInstallments}</strong> pagadas
              </span>
              <span class="font-bold ${isCompleted ? 'text-emerald-400' : 'text-purple-300'}">${percent}%</span>
            </div>
            <div class="progress-container">
              <div class="progress-fill-purple ${isCompleted ? '!bg-emerald-500' : ''}" style="width: ${percent}%;"></div>
            </div>
            <div class="text-right text-[11px] text-purple-300/60 mt-1">
              ${isCompleted ? '🎉 100% Amortizado' : `Faltan ${remainingInstallments} cuotas por pagar`}
            </div>
          </div>

          <!-- Acciones de la cuota -->
          <div class="flex items-center justify-between gap-2 pt-2 border-t border-purple-900/40">
            <div class="flex items-center gap-1">
              <button onclick="CuotasManager.revertInstallment('${d.id}')" 
                      class="px-2.5 py-1.5 rounded-lg bg-purple-900/40 hover:bg-purple-900 text-purple-300 text-xs border border-purple-800/50 transition flex items-center gap-1"
                      title="Restar una cuota">
                <i data-lucide="minus" class="w-3 h-3"></i> Cuota
              </button>
              
              <button onclick="CuotasManager.advanceInstallment('${d.id}')" 
                      class="px-3 py-1.5 rounded-lg ${isCompleted ? 'bg-purple-900/30 text-purple-400/40 cursor-not-allowed' : 'btn-purple'} text-xs font-semibold flex items-center gap-1.5"
                      ${isCompleted ? 'disabled' : ''}
                      title="Registrar cuota pagada">
                <i data-lucide="check" class="w-3.5 h-3.5"></i> Registrar Cuota
              </button>
            </div>

            ${!isCompleted ? `
              <button onclick="CuotasManager.addInstallmentToCurrentQuincena('${d.id}')" 
                      class="px-3 py-1.5 rounded-lg bg-purple-900/40 hover:bg-purple-800 text-purple-200 border border-purple-700/50 text-xs font-medium flex items-center gap-1.5 transition">
                <i data-lucide="calendar-plus" class="w-3.5 h-3.5 text-purple-400"></i> Cargar a Quincena
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons({ root: listEl });
  },

  escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }
};
