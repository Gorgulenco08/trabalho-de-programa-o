(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const supa = window.supabase && window.NOVA_SUPABASE_URL && window.NOVA_SUPABASE_KEY
    ? window.supabase.createClient(window.NOVA_SUPABASE_URL, window.NOVA_SUPABASE_KEY) : null;
  let user = null;
  const message = (text, error = false) => {
    $('message').textContent = text;
    $('message').hidden = false;
    $('message').classList.toggle('error', error);
    $('message').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  const applyTheme = value => {
    const theme = value === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('nova-theme', theme); } catch (_) {}
    document.querySelector('meta[name="theme-color"]').content = theme === 'light' ? '#f5f7ff' : '#090f20';
    document.querySelectorAll('[data-choice]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.choice === theme)));
  };
  document.querySelectorAll('[data-choice]').forEach(b => b.addEventListener('click', () => applyTheme(b.dataset.choice)));
  applyTheme(document.documentElement.dataset.theme);
  const setBusy = (id, busy) => { $(id).disabled = busy; };
  async function init() {
    if (!supa) { $('loading').textContent = 'Configuração do Supabase em falta. Confirma supabase-config.js.'; return; }
    try {
      const { data, error } = await supa.auth.getUser();
      if (error || !data?.user) { location.replace('./login.html'); return; }
      user = data.user;
      const { data: profile, error: pError } = await supa.from('profiles').select('full_name').eq('id',user.id).maybeSingle();
      // Fallback para os metadados de autenticação se o perfil não existir ainda.
      const name = !pError && profile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || '';
      $('fullName').value = name;
      $('topName').textContent = (name || user.email || 'Conta NOVA').split(' ')[0];
      $('email').value = user.email || '';
      const providers = user.app_metadata?.providers || [user.app_metadata?.provider || 'email'];
      $('providerText').textContent = providers.includes('google') ? 'Google' + (providers.includes('email') ? ' e email' : '') : 'Email e palavra-passe';
      $('loading').hidden = true; $('app').hidden = false;
    } catch (_) { $('loading').textContent = 'Não foi possível verificar a sessão. Verifica a ligação e recarrega a página.'; }
  }
  $('profileForm').addEventListener('submit', async e => {
    e.preventDefault();
    const fullName = $('fullName').value.trim();
    if (!fullName || fullName.length > 80) { message('Introduz um nome entre 1 e 80 caracteres.',true);return; }
    setBusy('saveProfile',true);
    try {
      // Atualizar a tabela e os metadados usados pelo Dashboard.
      const {error} = await supa.from('profiles').update({full_name:fullName}).eq('id', user.id);
      if(error) throw error;
      const {error:metaError} = await supa.auth.updateUser({data:{full_name:fullName}});
      if(metaError) throw metaError;
      $('topName').textContent = fullName.split(' ')[0];
      message('Nome atualizado! O Dashboard mostrará o novo nome.');
    } catch (err) {message('Não foi possível guardar: '+(err?.message || 'erro desconhecido'),true);}
    finally {setBusy('saveProfile',false);}
  });
  $('resetPassword').addEventListener('click', async () => {
    if (!user?.email) return;
    setBusy('resetPassword',true);
    try {
      const redirectTo = new URL('redefinir-password.html', location.href).href;
      const {error} = await supa.auth.resetPasswordForEmail(user.email, {redirectTo});
      if(error) throw error;
      message('Se o endereço estiver apto a receber emails de recuperação, vais receber instruções na tua caixa de entrada.');
    } catch(err) {message('Não foi possível enviar o email: '+(err?.message || 'erro desconhecido'),true);}
    finally {setBusy('resetPassword',false);}
  });
  async function logout() {
    $('logout').disabled = true; $('logoutSecondary').disabled = true;
    try { const {error} = await supa.auth.signOut(); if(error) throw error; location.replace('./login.html'); }
    catch(err) { message('Não foi possível terminar sessão: '+(err?.message || 'erro desconhecido'),true);$('logout').disabled=false;$('logoutSecondary').disabled=false; }
  }
  $('logout').addEventListener('click',logout);
  $('logoutSecondary').addEventListener('click',logout);
  init();
})();
