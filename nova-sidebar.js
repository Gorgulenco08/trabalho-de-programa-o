/* NOVA · Menu partilhado (Bootstrap 5 + navegação NOVA) */
(() => {
  const placeholder = document.getElementById('sidebar');
  if (!placeholder || placeholder.dataset.novaShared === 'true') return;
  // Resolves all links from the folder containing nova-sidebar.js, not the current page.
  const scriptUrl = document.currentScript?.src || document.querySelector('script[src*="nova-sidebar.js"]')?.src;
  const base = new URL('./', scriptUrl || location.href);
  const itemsLife = [
    ['Painel','menu_principal.html','layout-dashboard'],
    ['Tarefas','paginas_dashboard/tarefas.html','list-checks'],
    ['Hábitos','paginas_dashboard/habitos.html','check-circle-2'],
    ['Objetivos','paginas_dashboard/objetivos.html','target'],
    ['Calendário','paginas_dashboard/calendário.html','calendar-days'],
    ['Dicas','paginas_dashboard/dicas.html','lightbulb'],
    ['NOVA AI Life','paginas_dashboard/nova-ai.html','sparkles']
  ];
  const itemsQuest = [
    ['Centro de estudo','Nova Quest/Centro_estudo.html','book-open'],
    ['Missões','Nova Quest/Missões.html','shield-check'],
    ['Quizzes','Nova Quest/quizzes.html','clipboard-list'],
    ['Conquistas','Nova Quest/Conquistas.html','trophy'],
    ['Ranking','Nova Quest/Ranking.html','chart-no-axes-column-increasing'],
    ['NOVA AI Quest','paginas_dashboard/nova-ai-quest.html','sparkles']
  ];
  const path = new URL(location.href).pathname;
  const escapeText = value => String(value).replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  const makeNav = (items, title) => `<div class="nav-section">${title}</div><nav class="nav-list d-flex flex-column" aria-label="${title}">${items.map(([label,url,icon]) => {
    const full = new URL(url, base);
    const active = decodeURIComponent(full.pathname) === decodeURIComponent(path);
    return `<a class="nav-item${active ? ' active' : ''}" href="${escapeText(full.href)}"${active ? ' aria-current="page"' : ''}><i data-lucide="${icon}" class="ico"></i>${label}</a>`;
  }).join('')}</nav>`;
  placeholder.dataset.novaShared = 'true';
  placeholder.setAttribute('aria-label', 'Menu principal da NOVA');
  placeholder.innerHTML = `
    <a class="logo" href="${escapeText(new URL('menu_principal.html', base).href)}"><span class="logo-star">✦</span> NOVA</a>
    ${makeNav(itemsLife,'NOVA Life')}
    ${makeNav(itemsQuest,'NOVA Quest / Zona de estudo')}
    <div class="sidebar-bottom">
      <a class="nav-item" id="settingsButton" href="${escapeText(new URL('Definicoes.html', base).href)}"><i data-lucide="settings" class="ico"></i>Definições</a>
      <button class="appearance" type="button" id="themeToggle"><i data-lucide="moon-star" class="ico"></i><span id="themeLabel">Modo escuro</span><span class="theme-switch" aria-hidden="true"></span></button>
      <button class="nav-item" type="button" id="logoutButton"><i data-lucide="log-out" class="ico"></i>Terminar sessão</button>
    </div>`;
  // The existing page scripts own the theme and logout listeners.
  const collapse = () => {
    placeholder.classList.remove('open');
    document.getElementById('overlay')?.classList.remove('show');
    document.getElementById('mobileOverlay')?.classList.remove('show');
  };
  placeholder.querySelectorAll('a').forEach(a => a.addEventListener('click', collapse));
  // Dashboard buttons are now normal links. All destinations are defined only above.
  if (window.lucide?.createIcons) window.lucide.createIcons();
})();
