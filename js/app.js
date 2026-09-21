/* ==========================================================================
   JD FINANZAS - CONTROLADOR PRINCIPAL DE LA APLICACIÓN (APP.JS)
   ========================================================================== */

const App = {
  currentTab: 'dashboard',

  init() {
    // Inicializar submódulos
    StorageManager.init();
    QuincenaManager.init();
    CuotasManager.init();
    PWAManager.init();

    // Eventos y UI
    this.setupNavigation();
    this.setupModals();
    this.setupForms();
    this.updateDashboard();
    this.initSimulator();
    this.loadSettingsInUI();

    // Lucide Icons
    if (window.lucide) {
      lucide.createIcons();
    }

    // Comprobar si hay hash en la URL para navegación directa (#quincena, #cuotas, etc.)
    const hash = window.location.hash.replace('#', '');
    if (['dashboard', 'quincena', 'cuotas', 'simulador', 'configuracion'].includes(hash)) {
      this.switchTab(hash);
    }
  },

  // Manejo de pestañas
  setupNavigation() {
    const navButtons = document.querySelectorAll('[data-tab-target]');
    navButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const target = btn.getAttribute('data-tab-target');
        this.switchTab(target);
      });
    });
  },

  switchTab(tabId) {
    this.currentTab = tabId;
    window.location.hash = tabId;

    // Actualizar paneles visibles
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.add('hidden');
    });

    const activePanel = document.getElementById(`tab-${tabId}`);
    if (activePanel) {
      activePanel.classList.remove('hidden');
      activePanel.classList.add('animate-fade-in');
    }

    // Actualizar botones de navegación (desktop y móvil)
    document.querySelectorAll('[data-tab-target]').forEach(btn => {
      const isTarget = btn.getAttribute('data-tab-target') === tabId;
      if (btn.classList.contains('mobile-nav-item')) {
        if (isTarget) {
          btn.classList.add('text-purple-400', 'bg-purple-900/40');
          btn.classList.remove('text-purple-300/60');
        } else {
          btn.classList.remove('text-purple-400', 'bg-purple-900/40');
          btn.classList.add('text-purple-300/60');
        }
      } else {
        // Desktop sidebar nav
        if (isTarget) {
          btn.classList.add('bg-purple-800/50', 'text-white', 'border-purple-500');
          btn.classList.remove('text-purple-300/70', 'border-transparent');
        } else {
          btn.classList.remove('bg-purple-800/50', 'text-white', 'border-purple-500');
          btn.classList.add('text-purple-300/70', 'border-transparent');
        }
      }
    });

    // Re-renderizar si es necesario
    if (tabId === 'dashboard') this.updateDashboard();
    if (tabId === 'quincena') QuincenaManager.render();
    if (tabId === 'cuotas') CuotasManager.render();
    if (tabId === 'simulador') this.updateSimulator();

    // Scroll arriba suave
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (window.lucide) lucide.createIcons();
  },

  // Dashboard general unificado para JD
  updateDashboard() {
    const qMetrics = QuincenaManager.calculateMetrics();
    const debtStats = CuotasManager.calculateOverallStats();
    const settings = StorageManager.getSettings();
    const symbol = settings.currencySymbol || '$';

    // Saludos según la hora
    const hour = new Date().getHours();
    let greeting = '¡Hola, JD!';
    if (hour < 12) greeting = '¡Buenos días, JD!';
    else if (hour < 19) greeting = '¡Buenas tardes, JD!';
    else greeting = '¡Buenas noches, JD!';

    const greetingEl = document.getElementById('dashGreeting');
    if (greetingEl) greetingEl.textContent = greeting;

    // Tarjetas principales del Dashboard
    const dashBalanceEl = document.getElementById('dashFreeBalance');
    const dashIncomeEl = document.getElementById('dashTotalIncome');
    const dashCommittedEl = document.getElementById('dashCommitted');
    const dashTotalDebtEl = document.getElementById('dashTotalDebt');
    const dashHealthEl = document.getElementById('dashFinancialHealth');

    if (dashBalanceEl) {
      dashBalanceEl.textContent = `${symbol}${qMetrics.freeBalance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
      dashBalanceEl.className = qMetrics.freeBalance >= 0 
        ? 'text-2xl sm:text-3xl font-black text-emerald-400' 
        : 'text-2xl sm:text-3xl font-black text-rose-400';
    }

    if (dashIncomeEl) dashIncomeEl.textContent = `${symbol}${qMetrics.totalIncome.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
    if (dashCommittedEl) dashCommittedEl.textContent = `${symbol}${qMetrics.totalPayments.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
    if (dashTotalDebtEl) dashTotalDebtEl.textContent = `${symbol}${debtStats.totalRemainingDebt.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;

    const dashAmortPercent = document.getElementById('dashAmortizationPercent');
    const dashAmortBar = document.getElementById('dashAmortizationBar');
    if (dashAmortPercent) dashAmortPercent.textContent = `${debtStats.globalProgress}%`;
    if (dashAmortBar) dashAmortBar.style.width = `${debtStats.globalProgress}%`;

    // Diagnóstico del semáforo financiero
    if (dashHealthEl) {
      const commitPct = qMetrics.committedPercentage;
      if (qMetrics.totalIncome === 0) {
        dashHealthEl.innerHTML = `<span class="badge-purple px-2.5 py-1 rounded-full text-xs font-semibold">Sin ingresos fijados</span>`;
      } else if (commitPct <= 50) {
        dashHealthEl.innerHTML = `<span class="badge-paid px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1"><i data-lucide="check-circle" class="w-3.5 h-3.5"></i> Excelente (Comprometido ${commitPct}%)</span>`;
      } else if (commitPct <= 80) {
        dashHealthEl.innerHTML = `<span class="badge-pending px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1"><i data-lucide="alert-triangle" class="w-3.5 h-3.5"></i> Controlado (Comprometido ${commitPct}%)</span>`;
      } else {
        dashHealthEl.innerHTML = `<span class="badge-danger px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1"><i data-lucide="alert-octagon" class="w-3.5 h-3.5"></i> Ajustado (Comprometido ${commitPct}%)</span>`;
      }
    }

    // Próximos vencimientos prioritarios en el dashboard
    this.renderUpcomingPayments(symbol);

    if (window.lucide) lucide.createIcons();
  },

  renderUpcomingPayments(symbol) {
    const listEl = document.getElementById('dashUpcomingList');
    if (!listEl) return;

    const data = QuincenaManager.getCurrentData();
    const pending = (data.paymentList || []).filter(p => !p.paid);

    if (pending.length === 0) {
      listEl.innerHTML = `
        <div class="text-center py-6 text-purple-300/60 text-xs">
          ¡Genial! No hay pagos pendientes en esta quincena.
        </div>`;
      return;
    }

    listEl.innerHTML = pending.slice(0, 4).map(p => `
      <div class="flex items-center justify-between p-3 rounded-xl bg-purple-950/40 border border-purple-900/40 hover:border-purple-600/30 transition">
        <div class="flex items-center gap-3">
          <button onclick="QuincenaManager.togglePayment('${p.id}')" class="custom-checkbox" title="Marcar pagado"></button>
          <div>
            <div class="font-bold text-white text-sm">${QuincenaManager.escapeHTML(p.title)}</div>
            <div class="text-xs text-purple-300/70">${p.category} ${p.dueDate ? `• Vence: ${QuincenaManager.formatDueDate(p.dueDate)}` : ''}</div>
          </div>
        </div>
        <div class="text-right">
          <div class="font-extrabold text-purple-100 text-sm">${symbol}${Number(p.amount).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</div>
          ${QuincenaManager.getDueDateBadge(p.dueDate)}
        </div>
      </div>
    `).join('');
  },

  // Modales
  setupModals() {
    // Cerrar modales con clic en backdrop o botón cerrar
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = btn.closest('.modal-container');
        if (modal) modal.classList.add('hidden');
      });
    });

    document.querySelectorAll('.modal-container').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.add('hidden');
        }
      });
    });
  },

  openAddPaymentModal() {
    const modal = document.getElementById('addPaymentModal');
    if (!modal) return;
    
    // Cargar selector de deudas en cuotas para vincular si el usuario quiere
    const debts = StorageManager.getDebts().filter(d => d.paidInstallments < d.totalInstallments);
    const debtSelect = document.getElementById('paymentLinkedDebt');
    if (debtSelect) {
      debtSelect.innerHTML = '<option value="">Ninguna (Gasto normal)</option>' + 
        debts.map(d => `<option value="${d.id}">Cuota: ${d.title} (${d.paidInstallments + 1}/${d.totalInstallments}) - $${d.installmentAmount}</option>`).join('');
    }

    // Establecer fecha por defecto dentro de la quincena activa
    const day = QuincenaManager.activePeriod === 1 ? '10' : '25';
    const dateInput = document.getElementById('paymentDueDate');
    if (dateInput) {
      dateInput.value = `${QuincenaManager.activeYear}-${String(QuincenaManager.activeMonth).padStart(2, '0')}-${day}`;
    }

    modal.classList.remove('hidden');
    document.getElementById('paymentTitle').focus();
    if (window.lucide) lucide.createIcons();
  },

  openAddIncomeModal() {
    const modal = document.getElementById('addIncomeModal');
    if (!modal) return;
    const day = QuincenaManager.activePeriod === 1 ? '15' : '30';
    const dateInput = document.getElementById('incomeDate');
    if (dateInput) {
      dateInput.value = `${QuincenaManager.activeYear}-${String(QuincenaManager.activeMonth).padStart(2, '0')}-${day}`;
    }
    modal.classList.remove('hidden');
    document.getElementById('incomeTitle').focus();
  },

  openAddDebtModal() {
    const modal = document.getElementById('addDebtModal');
    if (modal) {
      modal.classList.remove('hidden');
      document.getElementById('debtTitle').focus();
    }
  },

  // Formularios
  setupForms() {
    // Form Pago
    const formPayment = document.getElementById('formAddPayment');
    if (formPayment) {
      formPayment.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('paymentTitle').value;
        const amount = document.getElementById('paymentAmount').value;
        const category = document.getElementById('paymentCategory').value;
        const dueDate = document.getElementById('paymentDueDate').value;
        const linkedDebtId = document.getElementById('paymentLinkedDebt').value;

        if (!title || !amount) return;

        QuincenaManager.addPayment({
          title,
          amount,
          category,
          dueDate,
          linkedDebtId: linkedDebtId || null
        });

        formPayment.reset();
        document.getElementById('addPaymentModal').classList.add('hidden');
        this.showNotification('Compromiso agregado a la quincena', 'success');
      });
    }

    // Vincular autollenado si se selecciona una deuda en cuotas
    const linkedDebtSelect = document.getElementById('paymentLinkedDebt');
    if (linkedDebtSelect) {
      linkedDebtSelect.addEventListener('change', (e) => {
        const debtId = e.target.value;
        if (debtId) {
          const debt = StorageManager.getDebts().find(d => d.id === debtId);
          if (debt) {
            document.getElementById('paymentTitle').value = `Cuota ${debt.title} (${debt.paidInstallments + 1}/${debt.totalInstallments})`;
            document.getElementById('paymentAmount').value = debt.installmentAmount;
            document.getElementById('paymentCategory').value = 'Cuotas';
          }
        }
      });
    }

    // Form Ingreso
    const formIncome = document.getElementById('formAddIncome');
    if (formIncome) {
      formIncome.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('incomeTitle').value;
        const amount = document.getElementById('incomeAmount').value;
        const date = document.getElementById('incomeDate').value;

        if (!title || !amount) return;

        QuincenaManager.addIncome(title, amount, date);
        formIncome.reset();
        document.getElementById('addIncomeModal').classList.add('hidden');
        this.showNotification('Ingreso agregado con éxito', 'success');
      });
    }

    // Form Deuda en Cuotas
    const formDebt = document.getElementById('formAddDebt');
    if (formDebt) {
      // Auto-calcular cuota cuando se ingresa total y cuotas
      const totalInput = document.getElementById('debtTotalAmount');
      const installmentsInput = document.getElementById('debtTotalInstallments');
      const installmentAmountInput = document.getElementById('debtInstallmentAmount');

      const calcCuota = () => {
        const t = parseFloat(totalInput.value);
        const n = parseInt(installmentsInput.value);
        if (t && n && n > 0) {
          installmentAmountInput.value = (t / n).toFixed(2);
        }
      };

      totalInput.addEventListener('input', calcCuota);
      installmentsInput.addEventListener('input', calcCuota);

      formDebt.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('debtTitle').value;
        const creditor = document.getElementById('debtCreditor').value;
        const totalAmount = document.getElementById('debtTotalAmount').value;
        const totalInstallments = document.getElementById('debtTotalInstallments').value;
        const paidInstallments = document.getElementById('debtPaidInstallments').value || 0;
        const installmentAmount = document.getElementById('debtInstallmentAmount').value;
        const quincenaTarget = document.getElementById('debtQuincenaTarget').value;
        const dueDateDay = document.getElementById('debtDueDateDay').value;
        const notes = document.getElementById('debtNotes').value;

        if (!title || !totalAmount || !totalInstallments) return;

        CuotasManager.addDebt({
          title,
          creditor,
          totalAmount,
          totalInstallments,
          paidInstallments,
          installmentAmount,
          quincenaTarget,
          dueDateDay,
          notes
        });

        formDebt.reset();
        document.getElementById('addDebtModal').classList.add('hidden');
      });
    }

    // Selectores de Quincena (mes, año, periodo)
    const selectMonth = document.getElementById('selectMonth');
    const selectYear = document.getElementById('selectYear');
    const selectPeriod = document.getElementById('selectPeriod');

    const handlePeriodChange = () => {
      QuincenaManager.setPeriod(selectYear.value, selectMonth.value, selectPeriod.value);
    };

    if (selectMonth) selectMonth.addEventListener('change', handlePeriodChange);
    if (selectYear) selectYear.addEventListener('change', handlePeriodChange);
    if (selectPeriod) selectPeriod.addEventListener('change', handlePeriodChange);
  },

  // Simulador de Presupuesto
  initSimulator() {
    const simIncome = document.getElementById('simIncomeInput');
    const simExtra = document.getElementById('simExtraExpenseInput');
    const simSavingsGoal = document.getElementById('simSavingsGoalInput');

    const runSim = () => this.updateSimulator();

    if (simIncome) simIncome.addEventListener('input', runSim);
    if (simExtra) simExtra.addEventListener('input', runSim);
    if (simSavingsGoal) simSavingsGoal.addEventListener('input', runSim);
  },

  updateSimulator() {
    const simIncomeInput = document.getElementById('simIncomeInput');
    const simExtraInput = document.getElementById('simExtraExpenseInput');
    const simSavingsInput = document.getElementById('simSavingsGoalInput');
    if (!simIncomeInput) return;

    const qMetrics = QuincenaManager.calculateMetrics();
    const income = parseFloat(simIncomeInput.value) || qMetrics.totalIncome || 1200;
    const currentFixed = qMetrics.totalPayments;
    const extra = parseFloat(simExtraInput ? simExtraInput.value : 0) || 0;
    const savings = parseFloat(simSavingsInput ? simSavingsInput.value : 0) || 0;

    const remaining = income - (currentFixed + extra + savings);
    const settings = StorageManager.getSettings();
    const symbol = settings.currencySymbol || '$';

    const resRemaining = document.getElementById('simResultRemaining');
    const resFixed = document.getElementById('simResultFixed');
    const resVerdict = document.getElementById('simResultVerdict');

    if (resFixed) resFixed.textContent = `${symbol}${currentFixed.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
    if (resRemaining) {
      resRemaining.textContent = `${symbol}${remaining.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
      resRemaining.className = remaining >= 0 ? 'text-2xl font-black text-emerald-400' : 'text-2xl font-black text-rose-400';
    }

    if (resVerdict) {
      if (remaining < 0) {
        resVerdict.innerHTML = `<span class="badge-danger px-3 py-1 rounded-full text-xs font-bold">⚠️ Déficit de ${symbol}${Math.abs(remaining).toFixed(2)}: Tus gastos superan tus ingresos.</span>`;
      } else if (remaining < income * 0.15) {
        resVerdict.innerHTML = `<span class="badge-pending px-3 py-1 rounded-full text-xs font-bold">⚡ Margen estrecho: Te queda menos del 15% libre.</span>`;
      } else {
        resVerdict.innerHTML = `<span class="badge-paid px-3 py-1 rounded-full text-xs font-bold">✨ Presupuesto saludable: Te queda un ${Math.round((remaining / income) * 100)}% disponible.</span>`;
      }
    }
  },

  // Ajustes y Configuración
  loadSettingsInUI() {
    const settings = StorageManager.getSettings();
    const nameInput = document.getElementById('settingUserName');
    const currencyInput = document.getElementById('settingCurrencySymbol');
    const salaryInput = document.getElementById('settingDefaultSalary');

    if (nameInput) nameInput.value = settings.userName || 'JD';
    if (currencyInput) currencyInput.value = settings.currencySymbol || '$';
    if (salaryInput) salaryInput.value = settings.defaultIncome || 1200;
  },

  saveSettingsFromUI() {
    const nameInput = document.getElementById('settingUserName');
    const currencyInput = document.getElementById('settingCurrencySymbol');
    const salaryInput = document.getElementById('settingDefaultSalary');

    StorageManager.saveSettings({
      userName: nameInput ? nameInput.value.trim() : 'JD',
      currencySymbol: currencyInput ? currencyInput.value.trim() : '$',
      defaultIncome: salaryInput ? parseFloat(salaryInput.value) : 1200
    });

    this.updateDashboard();
    QuincenaManager.render();
    CuotasManager.render();
    this.showNotification('Ajustes guardados correctamente', 'success');
  },

  // Exportar respaldo JSON
  exportDataJSON() {
    const jsonStr = StorageManager.exportBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `JD_Finanzas_Respaldo_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showNotification('Respaldo descargado con éxito', 'success');
  },

  // Importar respaldo JSON
  importDataJSON(fileInput) {
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = StorageManager.importBackup(e.target.result);
      if (result.success) {
        this.updateDashboard();
        QuincenaManager.render();
        CuotasManager.render();
        this.showNotification('Copia de seguridad restaurada correctamente', 'success');
      } else {
        alert('Error al importar archivo: ' + result.error);
      }
    };
    reader.readAsText(file);
    fileInput.value = '';
  },

  // Exportar resumen a CSV
  exportCSV() {
    const qData = QuincenaManager.getCurrentData();
    const settings = StorageManager.getSettings();
    const symbol = settings.currencySymbol || '$';

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += `JD FINANZAS - REPORTE DE QUINCENA\r\n`;
    csvContent += `Periodo: ${qData.id}\r\n\r\n`;

    csvContent += `INGRESOS REGISTRADOS\r\n`;
    csvContent += `Concepto,Fecha,Monto (${symbol})\r\n`;
    (qData.incomeList || []).forEach(inc => {
      csvContent += `"${inc.title}","${inc.date}",${inc.amount}\r\n`;
    });

    csvContent += `\r\nCOMPROMISOS Y PAGOS\r\n`;
    csvContent += `Concepto,Categoria,Vencimiento,Monto (${symbol}),Estado\r\n`;
    (qData.paymentList || []).forEach(p => {
      csvContent += `"${p.title}","${p.category}","${p.dueDate}",${p.amount},"${p.paid ? 'PAGADO' : 'PENDIENTE'}"\r\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `JD_Quincena_${qData.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showNotification('Reporte en CSV generado', 'success');
  },

  // Notificaciones Toast
  showNotification(message, type = 'info') {
    const toast = document.getElementById('toastNotification');
    const msgEl = document.getElementById('toastMessage');
    const iconEl = document.getElementById('toastIcon');
    if (!toast || !msgEl) return;

    msgEl.textContent = message;

    if (type === 'success') {
      toast.className = 'fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-emerald-950/90 text-emerald-200 border border-emerald-500/40 shadow-2xl backdrop-blur-md animate-fade-in';
      if (iconEl) iconEl.innerHTML = '<i data-lucide="check-circle" class="w-5 h-5 text-emerald-400"></i>';
    } else {
      toast.className = 'fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-purple-950/90 text-purple-200 border border-purple-500/40 shadow-2xl backdrop-blur-md animate-fade-in';
      if (iconEl) iconEl.innerHTML = '<i data-lucide="info" class="w-5 h-5 text-purple-400"></i>';
    }

    if (window.lucide) lucide.createIcons({ root: toast });

    toast.classList.remove('hidden');

    if (this._toastTimeout) clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      toast.classList.add('hidden');
    }, 3800);
  }
};

// Arrancar al cargar la ventana
window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
