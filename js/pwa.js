/* ==========================================================================
   CONTROL FINANCIERO - MÓDULO PWA & INSTALACIÓN EN MÓVIL / ESCRITORIO
   ========================================================================== */

const PWAManager = {
  deferredPrompt: null,
  isInstalled: false,

  init() {
    this.checkIfInstalled();
    this.registerServiceWorker();
    this.listenInstallPrompt();
    this.setupUI();
  },

  checkIfInstalled() {
    // Verificar si ya se ejecuta en modo standalone
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || window.navigator.standalone === true;

    this.isInstalled = isStandalone;
    if (this.isInstalled) {
      document.body.classList.add('pwa-standalone');
      const installButtons = document.querySelectorAll('.btn-install-pwa');
      installButtons.forEach(btn => {
        btn.classList.add('hidden');
      });
      const banner = document.getElementById('pwaInstallBanner');
      if (banner) banner.classList.add('hidden');
      const installSections = document.querySelectorAll('.pwa-install-section');
      installSections.forEach(section => section.classList.add('hidden'));
    }
  },

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((reg) => {
            console.log('Control Financiero SW registrado:', reg.scope);
          })
          .catch((err) => {
            console.warn('Error registrando Service Worker:', err);
          });
      });
    }
  },

  listenInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevenir el banner predeterminado del navegador
      e.preventDefault();
      this.deferredPrompt = e;

      // Mostrar botones y banner de instalación
      const installButtons = document.querySelectorAll('.btn-install-pwa');
      installButtons.forEach(btn => btn.classList.remove('hidden'));

      const banner = document.getElementById('pwaInstallBanner');
      if (banner && !this.isInstalled) {
        banner.classList.remove('hidden');
      }
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.isInstalled = true;
      const banner = document.getElementById('pwaInstallBanner');
      if (banner) banner.classList.add('hidden');

      if (window.App) {
        window.App.showNotification('🎉 ¡Control Financiero se instaló con éxito en tu dispositivo!', 'success');
      }
    });
  },

  setupUI() {
    // Detectar iOS para preparar la guía de instalación
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    this.isIOS = isIOS;
  },

  // Disparar acción al hacer clic en cualquier botón "Instalar App"
  async triggerInstall() {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        console.log('El usuario aceptó instalar Control Financiero');
      }
      this.deferredPrompt = null;
    } else if (this.isIOS) {
      // Mostrar instrucciones paso a paso para iOS Safari
      this.showIOSInstallModal();
    } else {
      // Navegadores Chromium de escritorio o Android donde ya expiró el evento
      this.showDesktopOrGeneralInstallModal();
    }
  },

  showIOSInstallModal() {
    const modal = document.getElementById('iosInstallModal');
    if (modal) {
      modal.classList.remove('hidden');
    }
  },

  hideIOSInstallModal() {
    const modal = document.getElementById('iosInstallModal');
    if (modal) {
      modal.classList.add('hidden');
    }
  },

  showDesktopOrGeneralInstallModal() {
    const modal = document.getElementById('generalInstallModal');
    if (modal) {
      modal.classList.remove('hidden');
    }
  },

  hideGeneralInstallModal() {
    const modal = document.getElementById('generalInstallModal');
    if (modal) {
      modal.classList.add('hidden');
    }
  },

  dismissBanner() {
    const banner = document.getElementById('pwaInstallBanner');
    if (banner) banner.classList.add('hidden');
  }
};
