/* ==========================================================================
   CONTROL FINANCIERO - AUTENTICACIÓN EN LA NUBE CON SUPABASE AUTH
   Los datos financieros antiguos de localStorage no se migran ni se borran.
   ========================================================================== */

const AuthManager = {
  client: null,
  _onAuthenticated: null,
  _authenticatedNotified: false,
  _authListener: null,

  async init(onAuthenticated) {
    this._onAuthenticated = onAuthenticated;
    this._authenticatedNotified = false;
    document.body.classList.add('auth-locked');
    document.body.classList.remove('auth-unlocked');
    this.ensureScreen();

    try {
      this.client = SupabaseManager.init();
    } catch (error) {
      console.error('No se pudo inicializar Supabase Auth:', error);
      this.renderConnectionError();
      return;
    }

    if (!this._authListener) {
      const { data } = this.client.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
          this._authenticatedNotified = false;
          document.body.classList.add('auth-locked');
          document.body.classList.remove('auth-unlocked');
          this.renderLogin();
        }
        if (event === 'PASSWORD_RECOVERY' && session) {
          this.renderChangePassword();
        }
      });
      this._authListener = data.subscription;
    }

    const { data, error } = await this.client.auth.getSession();
    if (error) {
      console.error('No se pudo recuperar la sesión de Supabase:', error);
      this.renderLogin('No se pudo recuperar la sesión. Intenta nuevamente.');
      return;
    }

    if (data.session) {
      await this.unlock(data.session);
    } else {
      this.renderLogin();
    }
  },

  ensureScreen() {
    let screen = document.getElementById('authScreen');
    if (!screen) {
      screen = document.createElement('section');
      screen.id = 'authScreen';
      screen.className = 'auth-screen';
      screen.setAttribute('aria-live', 'polite');
      document.body.appendChild(screen);
    }
    return screen;
  },

  renderShell(content) {
    const screen = this.ensureScreen();
    screen.innerHTML = `
  <div class="auth-card">
        <div class="auth-brand" aria-hidden="true"><img src="assets/icon-512.png" alt="Control Financiero" class="auth-brand-logo"></div>
        <div class="auth-copy">
          <span class="auth-eyebrow">CONTROL FINANCIERO</span>
          ${content}
          <div class="auth-disclaimer">
            <span aria-hidden="true">⚠</span>
            <span>Tu acceso se protege con Supabase Auth. Usa una contraseña única y no compartas tus credenciales. Los datos financieros permanecen guardados en este dispositivo.</span>
          </div>
        </div>
      </div>`;
  },

  renderLogin(message = '', messageType = 'error', email = '') {
    const messageClass = messageType === 'success' ? 'auth-success' : 'auth-error';
    this.renderShell(`
      <h1>Inicia sesión</h1>
      <p>Accede a tus finanzas desde tu computadora o teléfono.</p>
      ${message ? `<div class="auth-message ${messageClass}">${this.escapeHTML(message)}</div>` : ''}
      <form id="authLoginForm" class="auth-form">
        <label>Correo electrónico
          <input id="authLoginEmail" type="email" autocomplete="email" required value="${this.escapeHTML(email)}" placeholder="tu@correo.com">
        </label>
        <label>Contraseña
          <input id="authLoginPassword" type="password" autocomplete="current-password" required placeholder="Tu contraseña">
        </label>
        <button class="btn-auth" type="submit">Iniciar sesión</button>
        <button id="authForgotButton" class="btn-auth-link" type="button">Olvidé mi contraseña</button>
        <button id="authCreateButton" class="btn-auth-link" type="button">Crear una cuenta nueva</button>
      </form>`);

    document.getElementById('authLoginForm').addEventListener('submit', event => this.handleLogin(event));
    document.getElementById('authForgotButton').addEventListener('click', () => this.sendPasswordReset());
    document.getElementById('authCreateButton').addEventListener('click', () => this.renderCreateAccess());
    document.getElementById('authLoginEmail').focus();
  },

  renderCreateAccess(message = '', messageType = 'error') {
    const messageClass = messageType === 'success' ? 'auth-success' : 'auth-error';
    this.renderShell(`
      <h1>Crea tu cuenta</h1>
      <p>Crea un acceso protegido para usar esta aplicación.</p>
      ${message ? `<div class="auth-message ${messageClass}">${this.escapeHTML(message)}</div>` : ''}
      <form id="authCreateForm" class="auth-form">
        <label>Nombre para mostrar
          <input id="authCreateUser" type="text" autocomplete="name" maxlength="60" required placeholder="Tu nombre">
        </label>
        <label>Correo electrónico
          <input id="authCreateEmail" type="email" autocomplete="email" maxlength="254" required placeholder="tu@correo.com">
        </label>
        <label>Contraseña
          <input id="authCreatePassword" type="password" autocomplete="new-password" minlength="8" required placeholder="Mínimo 8 caracteres">
        </label>
        <label>Confirmar contraseña
          <input id="authCreateConfirm" type="password" autocomplete="new-password" minlength="8" required placeholder="Repite la contraseña">
        </label>
        <button class="btn-auth" type="submit">Crear cuenta</button>
        <button id="authBackToLogin" class="btn-auth-link" type="button">Ya tengo una cuenta</button>
      </form>`);

    document.getElementById('authCreateForm').addEventListener('submit', event => this.handleCreate(event));
    document.getElementById('authBackToLogin').addEventListener('click', () => this.renderLogin());
    document.getElementById('authCreateUser').focus();
  },

  renderChangePassword(message = '', messageType = 'error') {
    const messageClass = messageType === 'success' ? 'auth-success' : 'auth-error';
    this.renderShell(`
      <h1>Cambia tu contraseña</h1>
      <p>Elige una contraseña nueva para tu cuenta.</p>
      ${message ? `<div class="auth-message ${messageClass}">${this.escapeHTML(message)}</div>` : ''}
      <form id="authChangePasswordForm" class="auth-form">
        <label>Nueva contraseña
          <input id="authNewPassword" type="password" autocomplete="new-password" minlength="8" required placeholder="Mínimo 8 caracteres">
        </label>
        <label>Confirmar contraseña
          <input id="authNewPasswordConfirm" type="password" autocomplete="new-password" minlength="8" required placeholder="Repite la contraseña">
        </label>
        <button class="btn-auth" type="submit">Guardar contraseña</button>
      </form>`);

    document.getElementById('authChangePasswordForm').addEventListener('submit', event => this.handleChangePassword(event));
    document.getElementById('authNewPassword').focus();
  },

  renderConnectionError() {
    this.renderShell(`
      <h1>No se pudo conectar</h1>
      <div class="auth-message auth-error">No se pudo cargar el servicio de autenticación. Comprueba tu conexión a Internet y recarga la página.</div>
      <button class="btn-auth" type="button" onclick="window.location.reload()">Reintentar</button>`);
  },

  async handleCreate(event) {
    event.preventDefault();
    const displayName = document.getElementById('authCreateUser').value.trim();
    const email = document.getElementById('authCreateEmail').value.trim().toLowerCase();
    const password = document.getElementById('authCreatePassword').value;
    const confirmation = document.getElementById('authCreateConfirm').value;

    if (!displayName) return this.renderCreateAccess('Escribe un nombre para mostrar.');
    if (password.length < 8) return this.renderCreateAccess('La contraseña debe tener al menos 8 caracteres.');
    if (password !== confirmation) return this.renderCreateAccess('Las contraseñas no coinciden.');

    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName, userName: displayName },
        emailRedirectTo: this.redirectUrl()
      }
    });

    if (error) {
      this.renderCreateAccess(this.translateAuthError(error));
      return;
    }

    if (data.session) {
      await this.unlock(data.session);
    } else {
      this.renderLogin('Cuenta creada. Revisa tu correo y confirma la cuenta antes de iniciar sesión.', 'success', email);
    }
  },

  async handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('authLoginEmail').value.trim().toLowerCase();
    const password = document.getElementById('authLoginPassword').value;

    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) {
      this.renderLogin(this.translateAuthError(error), 'error', email);
      return;
    }
    await this.unlock(data.session);
  },

  async sendPasswordReset() {
    const emailInput = document.getElementById('authLoginEmail');
    const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
    if (!email) {
      this.renderLogin('Escribe tu correo para enviarte el enlace de recuperación.');
      return;
    }

    const { error } = await this.client.auth.resetPasswordForEmail(email, {
      redirectTo: this.redirectUrl()
    });
    if (error) {
      this.renderLogin(this.translateAuthError(error), 'error', email);
      return;
    }
    this.renderLogin('Si el correo existe, recibirás un enlace para cambiar la contraseña.', 'success', email);
  },

  async handleChangePassword(event) {
    event.preventDefault();
    const password = document.getElementById('authNewPassword').value;
    const confirmation = document.getElementById('authNewPasswordConfirm').value;
    if (password.length < 8) return this.renderChangePassword('La contraseña debe tener al menos 8 caracteres.');
    if (password !== confirmation) return this.renderChangePassword('Las contraseñas no coinciden.');

    const { error } = await this.client.auth.updateUser({ password });
    if (error) {
      this.renderChangePassword(this.translateAuthError(error));
      return;
    }
    this.renderLogin('Contraseña actualizada. Ya puedes iniciar sesión.', 'success');
  },

  async unlock(session) {
    if (!session || !session.user) {
      this.renderLogin('La sesión no es válida. Inicia sesión nuevamente.');
      return;
    }

    const screen = document.getElementById('authScreen');
    this.clearCredentialInputs(screen);

    try {
      if (!this._authenticatedNotified && typeof this._onAuthenticated === 'function') {
        await this._onAuthenticated();
        this._authenticatedNotified = true;
      }
      const displayName = String(session.user.user_metadata?.display_name || session.user.user_metadata?.userName || '').trim();
      if (displayName && globalThis.StorageManager) {
        StorageManager.saveSettings({ userName: displayName });
        if (window.App && typeof window.App.updateDashboard === 'function') window.App.updateDashboard();
      }
      document.body.classList.remove('auth-locked');
      document.body.classList.add('auth-unlocked');
    } catch (error) {
      console.error('No se pudo inicializar la aplicación:', error);
      await this.client.auth.signOut();
      this._authenticatedNotified = false;
      this.renderInitializationError();
    }
  },

  renderInitializationError() {
    document.body.classList.add('auth-locked');
    document.body.classList.remove('auth-unlocked');
    this.renderShell(`
      <h1>No se pudo abrir la aplicación</h1>
      <div class="auth-message auth-error">La sesión es válida, pero la aplicación no pudo inicializar sus módulos. Recarga la página para volver a intentarlo.</div>
      <button class="btn-auth" type="button" onclick="window.location.reload()">Reintentar</button>`);
  },

  async resetAccess() {
    const { data, error } = await this.client.auth.getUser();
    if (error || !data.user?.email) {
      alert('No se pudo identificar tu cuenta para enviar el enlace de recuperación.');
      return;
    }

    const shouldContinue = confirm('Se enviará un enlace a tu correo para cambiar la contraseña. Tus datos no se eliminarán. ¿Continuar?');
    if (!shouldContinue) return;

    const { error: resetError } = await this.client.auth.resetPasswordForEmail(data.user.email, {
      redirectTo: this.redirectUrl()
    });
    if (resetError) {
      alert(this.translateAuthError(resetError));
      return;
    }
    alert('Revisa tu correo para cambiar la contraseña.');
  },

  async logout() {
    const { error } = await this.client.auth.signOut();
    if (error) {
      alert('No se pudo cerrar la sesión. Intenta nuevamente.');
      return;
    }
    window.location.hash = '';
    window.location.reload();
  },

  clearCredentialInputs(screen) {
    if (!screen) return;
    screen.querySelectorAll('input').forEach(input => {
      input.value = '';
      input.removeAttribute('value');
    });
    screen.replaceChildren();
    screen.remove();
  },

  redirectUrl() {
    return `${window.location.origin}${window.location.pathname}`;
  },

  translateAuthError(error) {
    const message = String(error?.message || '').toLowerCase();
    if (message.includes('email not confirmed')) return 'Confirma tu correo electrónico antes de iniciar sesión.';
    if (message.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.';
    if (message.includes('user already registered')) return 'Ese correo ya tiene una cuenta. Intenta iniciar sesión.';
    if (message.includes('password')) return 'La contraseña no cumple los requisitos de Supabase.';
    if (message.includes('rate limit')) return 'Demasiados intentos. Espera un momento y vuelve a intentar.';
    return error?.message || 'No se pudo completar la operación de autenticación.';
  },

  escapeHTML(value) {
    return String(value || '').replace(/[&<>'"]/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[character]));
  }
};

globalThis.AuthManager = AuthManager;
