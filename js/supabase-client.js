/* ========================================================================
   CONTROL FINANCIERO - CONEXIÓN INICIAL CON SUPABASE
   Solo contiene datos públicos de conexión. No colocar aquí claves secretas.
   ======================================================================== */

const SUPABASE_CONFIG = Object.freeze({
  url: 'https://eozpqcnosthbzzbrwvpc.supabase.co',
  publishableKey: 'sb_publishable_NUzLGZXYAw-8QXzRACW0PA_R5BbktIv'
});

const SupabaseManager = {
  client: null,
  status: 'not-initialized',

  init() {
    if (this.client) return this.client;

    if (!globalThis.supabase || typeof globalThis.supabase.createClient !== 'function') {
      this.status = 'library-unavailable';
      throw new Error('La librería de Supabase todavía no está disponible.');
    }

    this.client = globalThis.supabase.createClient(
      SUPABASE_CONFIG.url,
      SUPABASE_CONFIG.publishableKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );
    this.status = 'connected';
    return this.client;
  },

  isReady() {
    return this.status === 'connected' && Boolean(this.client);
  }
};

globalThis.SupabaseManager = SupabaseManager;
