/* NOVA Life — Objetivos. Dados individuais em public.goals (ver supabase-objetivos.sql). */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const client = window.supabase && window.NOVA_SUPABASE_URL && window.NOVA_SUPABASE_KEY
    ? window.supabase.createClient(window.NOVA_SUPABASE_URL, window.NOVA_SUPABASE_KEY) : null;
  let user = null, goals = [], editingId = null, busy = false;

  const pad = n => String(n).padStart(2, '0');
  const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  // Interpreta 'YYYY-MM-DD' como data local (evita erros de fuso horário).
  const parseDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const startOfToday = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
  const daysLeft = goal => Math.round((parseDate(goal.deadline) - startOfToday()) / 86400000);
  const fmtDate = s => parseDate(s).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
  const isDone = g => g.progress >= 100;

  const node = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const showError = m => { const el = $('goalsAlert'); el.hidden = false; el.textContent = m; };
  const clearError = () => { $('goalsAlert').hidden = true; $('goalsAlert').textContent = ''; };
  const btn = (text, title, onClick) => { const b = node('button', 'goal-outline-button', text); b.type = 'button'; b.title = title; b.addEventListener('click', onClick); return b; };

  function deadlinePill(goal) {
    if (isDone(goal)) return node('span', 'goal-pill ok', '✓ Concluído');
    const d = daysLeft(goal);
    if (d < 0) return node('span', 'goal-pill late', `Em atraso há ${-d} ${-d === 1 ? 'dia' : 'dias'}`);
    if (d === 0) return node('span', 'goal-pill late', 'Termina hoje');
    return node('span', 'goal-pill', `Faltam ${d} ${d === 1 ? 'dia' : 'dias'}`);
  }

  function renderSummary() {
    const active = goals.filter(g => !isDone(g));
    const avg = active.length ? Math.round(active.reduce((s, g) => s + g.progress, 0) / active.length) : 0;
    const soon = active.filter(g => { const d = daysLeft(g); return d >= 0 && d <= 7; }).length;
    $('goalActive').textContent = String(active.length);
    $('goalDone').textContent = String(goals.length - active.length);
    $('goalAvg').textContent = `${avg}%`;
    $('goalSoon').textContent = String(soon);
  }

  function renderCard(goal) {
    const card = node('article', 'goal-card' + (isDone(goal) ? ' done' : ''));
    const top = node('div', 'goal-top');
    const heading = node('div'); heading.append(node('h3', '', goal.title));
    if (goal.description) heading.append(node('p', '', goal.description));
    const actions = node('div', 'goal-actions');
    actions.append(btn('Editar', 'Editar objetivo', () => openDialog(goal)), btn('Eliminar', 'Eliminar objetivo', () => removeGoal(goal)));
    top.append(heading, actions);

    const meta = node('div', 'goal-meta');
    meta.append(node('span', 'goal-pill', goal.category || 'Outro'), node('span', 'goal-pill', `📅 ${fmtDate(goal.deadline)}`), deadlinePill(goal));

    const head = node('div', 'goal-progress-head');
    head.append(node('strong', '', `${goal.progress}% concluído`), node('span', '', isDone(goal) ? 'Meta alcançada!' : 'Arrasta para atualizar'));
    const bar = node('div', 'goal-progress'); const fill = node('div', 'goal-progress-fill'); fill.style.width = `${goal.progress}%`; bar.append(fill);

    const slider = node('input', 'goal-slider'); slider.type = 'range'; slider.min = 0; slider.max = 100; slider.step = 5; slider.value = goal.progress;
    slider.setAttribute('aria-label', `Progresso de ${goal.title}`);
    slider.addEventListener('input', () => { fill.style.width = `${slider.value}%`; head.firstChild.textContent = `${slider.value}% concluído`; });
    slider.addEventListener('change', () => updateProgress(goal, Number(slider.value)));

    card.append(top, meta, head, bar, slider);
    if (!isDone(goal)) {
      const foot = node('div', 'goal-card-foot');
      foot.append(btn('Marcar como concluído', 'Colocar o progresso a 100%', () => updateProgress(goal, 100)));
      card.append(foot);
    }
    return card;
  }

  function visible() {
    const f = $('goalFilter').value;
    const list = goals.filter(g => f === 'all' ? true : f === 'done' ? isDone(g) : f === 'overdue' ? (!isDone(g) && daysLeft(g) < 0) : !isDone(g));
    return list.sort((a, b) => a.deadline.localeCompare(b.deadline));
  }

  function render() {
    renderSummary();
    const list = visible();
    $('goalList').replaceChildren(...list.map(renderCard));
    $('goalsEmpty').hidden = list.length > 0;
    $('goalsEmpty').querySelector('h2').textContent = goals.length ? 'Nada nesta vista' : 'Define o teu primeiro objetivo';
    $('goalsEmpty').querySelector('p').textContent = goals.length ? 'Muda o filtro para veres outros objetivos.' : 'Escolhe uma meta, define um prazo e vai atualizando o progresso.';
    $('firstGoal').hidden = goals.length > 0;
  }

  async function reload() {
    if (!client || !user) return;
    const { data, error } = await client.from('goals')
      .select('id,title,description,category,deadline,progress,created_at').eq('user_id', user.id).order('deadline', { ascending: true });
    if (error) { showError('Não foi possível carregar os objetivos. ' + error.message); return; }
    goals = data || []; clearError(); render();
  }

  async function updateProgress(goal, value) {
    if (busy || !user) return; busy = true; clearError();
    const { error } = await client.from('goals').update({ progress: value }).eq('id', goal.id).eq('user_id', user.id);
    busy = false;
    if (error) { showError('Não foi possível atualizar o progresso: ' + error.message); }
    await reload();
  }

  function openDialog(goal = null) {
    editingId = goal?.id || null;
    $('goalDialogTitle').textContent = goal ? 'Editar objetivo' : 'Novo objetivo';
    $('goalTitle').value = goal?.title || '';
    $('goalDescription').value = goal?.description || '';
    $('goalCategory').value = goal?.category || 'Estudos';
    $('goalDeadline').value = goal?.deadline || '';
    $('goalDeadline').min = goal ? '' : dateKey(startOfToday());
    $('goalProgress').value = goal?.progress ?? 0;
    $('goalProgressValue').textContent = `${$('goalProgress').value}%`;
    $('goalDialog').showModal(); $('goalTitle').focus();
  }

  async function saveGoal(e) {
    e.preventDefault(); if (busy || !user) return;
    const payload = {
      title: $('goalTitle').value.trim(),
      description: $('goalDescription').value.trim() || null,
      category: $('goalCategory').value,
      deadline: $('goalDeadline').value,
      progress: Number($('goalProgress').value)
    };
    if (!payload.title || payload.title.length > 90 || !/^\d{4}-\d{2}-\d{2}$/.test(payload.deadline) || !(payload.progress >= 0 && payload.progress <= 100)) {
      showError('Preenche o título e escolhe um prazo válido.'); return;
    }
    busy = true; $('saveGoal').disabled = true; clearError();
    try {
      const result = editingId
        ? await client.from('goals').update(payload).eq('id', editingId).eq('user_id', user.id)
        : await client.from('goals').insert({ ...payload, user_id: user.id });
      if (result.error) throw result.error;
      $('goalDialog').close(); await reload();
    } catch (err) { $('goalDialog').close(); showError('Não foi possível guardar o objetivo: ' + err.message); }
    finally { busy = false; $('saveGoal').disabled = false; }
  }

  async function removeGoal(goal) {
    if (busy || !user || !window.confirm(`Eliminar «${goal.title}»? Esta ação não pode ser anulada.`)) return;
    busy = true; clearError();
    const { error } = await client.from('goals').delete().eq('id', goal.id).eq('user_id', user.id);
    busy = false;
    if (error) showError('Não foi possível eliminar o objetivo: ' + error.message); else await reload();
  }

  $('newGoal').addEventListener('click', () => openDialog());
  $('firstGoal').addEventListener('click', () => openDialog());
  $('goalFilter').addEventListener('change', render);
  $('goalForm').addEventListener('submit', saveGoal);
  $('goalProgress').addEventListener('input', () => { $('goalProgressValue').textContent = `${$('goalProgress').value}%`; });
  $('closeGoalDialog').addEventListener('click', () => $('goalDialog').close());
  $('cancelGoal').addEventListener('click', () => $('goalDialog').close());

  (async function init() {
    if (!client) return;
    try {
      const { data, error } = await client.auth.getUser();
      if (error || !data?.user) return; // nova-uniform.js trata do redirecionamento.
      user = data.user; await reload();
    } catch (e) { showError('Não foi possível ligar ao Supabase: ' + e.message); }
  })();
})();
