
(() => {
  const supa = window.supabase && window.NOVA_SUPABASE_URL && window.NOVA_SUPABASE_KEY
    ? window.supabase.createClient(window.NOVA_SUPABASE_URL, window.NOVA_SUPABASE_KEY) : null;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const setTheme = (value) => {
    const theme = value === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('nova-theme', theme); } catch (_) {}
    if (themeMeta) themeMeta.content = theme === 'light' ? '#f5f7ff' : '#090f20';
    const label = document.getElementById('themeLabel');
    if (label) label.textContent = theme === 'light' ? 'Modo claro' : 'Modo escuro';
    $$('[data-choice]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.choice === theme)));
  };
  const openSidebar = (show) => {
    const sb = $('#sidebar');
    const ov = $('#overlay');
    if (!sb || !ov) return;
    sb.classList.toggle('open', !!show);
    ov.classList.toggle('show', !!show);
  };
  document.getElementById('mobileMenu')?.addEventListener('click', () => openSidebar(true));
  document.getElementById('overlay')?.addEventListener('click', () => openSidebar(false));
  document.getElementById('themeToggle')?.addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  $$('[data-choice]').forEach(b => b.addEventListener('click', () => setTheme(b.dataset.choice)));
  setTheme(document.documentElement.dataset.theme);
  async function initUser() {
    const loading = document.getElementById('loading');
    const app = document.getElementById('app');
    if (!supa) {
      if (loading) loading.textContent = 'Configuração do Supabase em falta.';
      return;
    }
    try {
      const { data, error } = await supa.auth.getUser();
      if (error || !data?.user) {
        const prefix = document.body.dataset.prefix || './';
        location.replace(prefix + 'login.html');
        return;
      }
      const user = data.user;
      const name = user.user_metadata?.full_name || user.user_metadata?.name || (user.email ? user.email.split('@')[0] : 'Utilizador');
      const shortName = name.split(' ')[0];
      document.getElementById('userName') && (document.getElementById('userName').textContent = shortName);
      document.getElementById('topName') && (document.getElementById('topName').textContent = shortName);
      document.getElementById('avatar') && (document.getElementById('avatar').textContent = shortName.charAt(0).toUpperCase());
      if (loading) loading.hidden = true;
      if (app) app.hidden = false;
      if (window.lucide?.createIcons) window.lucide.createIcons();
      document.getElementById('logoutButton')?.addEventListener('click', async () => {
        const { error: outError } = await supa.auth.signOut();
        if (!outError) location.replace((document.body.dataset.prefix || './') + 'login.html');
      });
    } catch (e) {
      if (loading) loading.textContent = 'Não foi possível verificar a sessão. Recarrega a página.';
    }
  }
  initUser();
})();
