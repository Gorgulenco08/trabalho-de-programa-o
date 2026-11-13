(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const client = window.supabase && window.NOVA_SUPABASE_URL && window.NOVA_SUPABASE_KEY
    ? window.supabase.createClient(window.NOVA_SUPABASE_URL, window.NOVA_SUPABASE_KEY) : null;
  const mode = document.body.dataset.aiMode === 'quest' ? 'quest' : 'life';
  const welcome = el('welcome');
  const messages = el('conversation');
  const form = el('chatForm');
  const prompt = el('prompt');
  const sendButton = el('sendButton');
  const status = el('status');
  const suggestions = mode === 'quest'
    ? ['Explica o que é JavaScript', 'Cria 5 perguntas sobre HTML', 'Ajuda-me a estudar matemática', 'Como funciona o método Pomodoro?']
    : ['Cria uma tarefa para estudar matemática', 'Cria 3 tarefas para organizar a minha semana', 'Cria um hábito de ler todos os dias', 'Divide um objetivo em passos pequenos'];
  let busy = false;
  let lastMessageAt = 0;
  let userId = null;
  let historyKey = null;
  let history = [];

  function icons() { window.lucide?.createIcons?.(); }
  function setStatus(text, error = false) { status.textContent = text || ''; status.classList.toggle('error', error); }
  function persist() {
    if (!historyKey) return;
    try { localStorage.setItem(historyKey, JSON.stringify(history.slice(-40))); } catch (_) {}
  }
  function record(author, text) {
    if (!historyKey) return;
    history.push({ author, text: String(text).slice(0, 12000) });
    history = history.slice(-40);
    persist();
  }
  function appendInline(parent, text) {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    for (const part of parts) {
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        const strong = document.createElement('strong'); strong.textContent = part.slice(2, -2); parent.append(strong);
      } else if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
        const code = document.createElement('code'); code.textContent = part.slice(1, -1); parent.append(code);
      } else parent.append(document.createTextNode(part));
    }
  }
  function renderAnswer(parent, text) {
    let currentList = null;
    let codeBlock = null;
    for (const line of String(text).split('\n')) {
      if (/^\s*```/.test(line)) {
        if (!codeBlock) { codeBlock = document.createElement('pre'); codeBlock.append(document.createElement('code')); parent.append(codeBlock); }
        else codeBlock = null;
        currentList = null;
        continue;
      }
      if (codeBlock) { codeBlock.firstChild.textContent += line + '\n'; continue; }
      if (!line.trim()) { currentList = null; continue; }
      const list = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)$/);
      if (list) {
        const type = /^\s*\d+\./.test(line) ? 'ol' : 'ul';
        if (!currentList || currentList.tagName.toLowerCase() !== type) { currentList = document.createElement(type); parent.append(currentList); }
        const li = document.createElement('li'); appendInline(li, list[1]); currentList.append(li);
        continue;
      }
      currentList = null;
      const heading = line.match(/^#{1,4}\s+(.*)$/);
      if (heading) { const h = document.createElement('h3'); appendInline(h, heading[1]); parent.append(h); continue; }
      const p = document.createElement('p'); appendInline(p, line); parent.append(p);
    }
  }
  function addMessage(author, text, { typing = false, save = true } = {}) {
    welcome.hidden = true;
    const row = document.createElement('div'); row.className = 'ai-message ' + author;
    const avatar = document.createElement('div'); avatar.className = 'ai-msg-icon';
    const icon = document.createElement('i'); icon.dataset.lucide = author === 'user' ? 'user-round' : 'sparkles'; avatar.append(icon);
    const bubble = document.createElement('div'); bubble.className = 'ai-bubble';
    if (typing) { const t = document.createElement('div'); t.className = 'ai-typing'; for (let i = 0; i < 3; i++) t.append(document.createElement('span')); bubble.append(t); }
    else if (author === 'assistant') renderAnswer(bubble, text);
    else bubble.textContent = text;
    row.append(avatar, bubble); messages.append(row); messages.scrollTop = messages.scrollHeight; icons();
    if (!typing && save) record(author, text);
    return row;
  }
  function setupSuggestions() {
    const holder = el('suggestions'); holder.replaceChildren();
    suggestions.forEach(question => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = question;
      button.addEventListener('click', () => { prompt.value = question; prompt.focus(); }); holder.append(button);
    });
  }
  function isTaskRequest(text) {
    if (mode !== 'life') return false;
    const request = String(text).trim();
    // Perguntas de ajuda sobre tarefas não devem executar uma ação.
    if (/^(?:como|onde|porque|porquê|qual|quais|explica|ensina|o que|será que)\b/i.test(request)) return false;
    if (/\b(?:não|nao)\s+(?:cries|criar|adiciones|adicionar|agendes|agendar)\b/i.test(request)) return false;
    return /\b(?:cria|criar|adiciona|adicionar|mete|coloca|regista|registar|agenda|agendar|lembra|lembrar|marca|marcar)\b/i.test(request)
      && (/\b(?:tarefa|tarefas|lembrete|lembretes)\b/i.test(request)
        || /^(?:(?:por favor|pfv)[,\s]*)?(?:cria|adiciona|mete|coloca|regista|agenda|marca|lembra)(?:-me)?\b/i.test(request)
        || /\b(?:podes|poderias|consegues)\s+(?:(?:por favor)\s+)?(?:criar|adicionar|agendar|registar|colocar|lembrar)\b/i.test(request));
  }
  function isHabitRequest(text) {
    if (mode !== 'life') return false;
    const request = String(text).trim();
    if (/^(?:como|onde|porque|porquê|qual|quais|explica|ensina|o que|será que)\b/i.test(request)) return false;
    if (/\b(?:não|nao)\s+(?:cries|criar|adiciones|adicionar|registes|registar)\b/i.test(request)) return false;
    return /\b(?:hábito|habito|hábitos|habitos|rotina|rotinas)\b/i.test(request)
      && /\b(?:cria|criar|adiciona|adicionar|mete|coloca|regista|registar|começa|comecar|começar|quero|gostava|podes|poderias|consegues)\b/i.test(request);
  }
  function parseHabits(text) {
    let parsed;
    try { parsed = JSON.parse(String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); }
    catch (_) { return []; }
    const raw = Array.isArray(parsed) ? parsed : parsed?.habits;
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    return raw.slice(0, 8).map(item => ({
      name: String(item?.name || '').trim().slice(0, 90),
      description: String(item?.description || '').trim().slice(0, 350),
      target_per_week: Number(item?.target_per_week)
    })).filter(h => {
      if (h.name.length < 3 || !Number.isInteger(h.target_per_week) || h.target_per_week < 1 || h.target_per_week > 7 || seen.has(h.name.toLocaleLowerCase('pt'))) return false;
      seen.add(h.name.toLocaleLowerCase('pt')); return true;
    });
  }
  function habitPreview(row, habits) {
    const bubble = row.querySelector('.ai-bubble');
    const card = document.createElement('section'); card.className = 'ai-task-preview';
    const heading = document.createElement('strong'); heading.textContent = habits.length === 1 ? 'Hábito sugerido' : 'Hábitos sugeridos';
    const list = document.createElement('ul');
    habits.forEach(h => { const li=document.createElement('li'); li.textContent=`${h.name} · ${h.target_per_week} ${h.target_per_week===1?'dia':'dias'} por semana${h.description?' · '+h.description:''}`; list.append(li); });
    const controls=document.createElement('div'); controls.className='ai-task-actions';
    const confirm=document.createElement('button');confirm.type='button';confirm.className='ai-task-confirm';confirm.textContent=habits.length===1?'Guardar hábito':`Guardar ${habits.length} hábitos`;
    const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancelar';
    const feedback=document.createElement('p');feedback.className='ai-task-feedback';feedback.setAttribute('role','status');
    cancel.addEventListener('click',()=>{confirm.remove();cancel.remove();feedback.textContent='Criação cancelada.';});
    confirm.addEventListener('click',async()=>{
      confirm.disabled=true;cancel.disabled=true;feedback.textContent='A guardar hábitos…';feedback.classList.remove('error');
      try {
        const {data,error:authError}=await client.auth.getUser();
        if (authError || !userId || data?.user?.id!==userId) throw new Error('A sessão expirou. Inicia sessão novamente.');
        const payload=habits.map(h=>({...h,user_id:userId,active:true}));
        const {error}=await client.from('habits').insert(payload);
        if(error) throw error;
        confirm.remove();cancel.remove();feedback.textContent=`${habits.length} hábito(s) guardado(s) com sucesso. `;
        const link=document.createElement('a');link.href='habitos.html';link.textContent='Ver os meus hábitos';feedback.append(link);
      } catch(error) {
        feedback.textContent='Não foi possível guardar: '+(error.message||'Erro desconhecido.');feedback.classList.add('error');confirm.disabled=false;cancel.disabled=false;
      }
    });
    controls.append(confirm,cancel);card.append(heading,list,controls,feedback);bubble.append(card);messages.scrollTop=messages.scrollHeight;
  }
  async function replyToHabit(text,pending) {
    const instruction=`Quero registar hábitos pessoais na NOVA Life. Converte APENAS a intenção explícita do utilizador em 1 a 8 hábitos. Responde APENAS com JSON válido, sem markdown: {"habits":[{"name":"Ler 20 minutos","description":"","target_per_week":7}]}. 'target_per_week' é o número de dias de prática por semana (inteiro de 1 a 7). Todos os dias = 7; 3 vezes por semana = 3. Se não houver frequência, usa 7. NÃO inventes hábitos que o utilizador não pediu. Não executes ações. Pedido: ${JSON.stringify(text)}`;
    const habits=parseHabits(await invokeAI(instruction));
    pending.remove();
    if(!habits.length){addMessage('assistant','Não consegui identificar o hábito. Experimenta: “Cria um hábito de ler 20 minutos todos os dias” ou “Cria um hábito de estudar 3 vezes por semana”.');return;}
    const row=addMessage('assistant','Preparei estes hábitos para a NOVA Life. Confirma para os guardar:');
    habitPreview(row,habits);
  }

  const dateLabel = value => new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(new Date(value));

  // O JavaScript calcula o instante no fuso horário LOCAL do navegador,
  // convertendo-o em UTC apenas para o guardar no Supabase.
  const TIME_PATTERN = /(?:^|\s)(?:(?:às|as|pelas|para\s+as|para\s+às)\s*)?(\d{1,2})(?:\s*:\s*(\d{1,2})|\s*h(?:\s*(\d{1,2}))?)\s*(?:horas?)?(?=$|\s|[.,!?])/i;
  const INTRO_TIME_PATTERN = /(?:^|\s)(?:às|as|pelas|para\s+as|para\s+às)\s*(\d{1,2})(?:\s*:\s*(\d{1,2})|\s*h(?:\s*(\d{1,2}))?)?\s*(?:horas?)?(?=$|\s|[.,!?])/i;
  const DATE_PATTERN = /\b(?:dia\s+)?(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{4}))?\b/;
  function timeMatch(text) { return INTRO_TIME_PATTERN.exec(text) || TIME_PATTERN.exec(text); }
  function hasDateTime(text) {
    return Boolean(timeMatch(text) || DATE_PATTERN.test(text) || /(?:^|\s)(?:amanhã|amanha|hoje)(?=$|\s|[.,!?])/i.test(text));
  }
  function parseDueAt(text) {
    const hour = timeMatch(text);
    const dateOnly = DATE_PATTERN.exec(text);
    const relative = /(?:^|\s)(amanhã|amanha|hoje)(?=$|\s|[.,!?])/i.exec(text);
    if (!hour && !dateOnly && !relative) return null;
    const now = new Date();
    let due = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (dateOnly) {
      const day = Number(dateOnly[1]), month = Number(dateOnly[2]) - 1;
      const year = dateOnly[3] ? Number(dateOnly[3]) : now.getFullYear();
      due = new Date(year, month, day);
      if (due.getFullYear() !== year || due.getMonth() !== month || due.getDate() !== day) return null;
      if (!dateOnly[3] && due < new Date(now.getFullYear(), now.getMonth(), now.getDate())) due.setFullYear(year + 1);
    } else if (relative && /^amanh/i.test(relative[1])) due.setDate(due.getDate() + 1);
    if (hour) {
      const h = Number(hour[1]), m = Number(hour[2] || hour[3] || 0);
      if (h > 23 || m > 59) return null;
      due.setHours(h, m, 0, 0);
      // As horas locais inexistentes na mudança de hora de verão não são válidas.
      if (due.getHours() !== h || due.getMinutes() !== m) return null;
    } else due.setHours(23, 59, 0, 0);
    if (hour && !dateOnly && !relative && due <= now) due.setDate(due.getDate() + 1);
    return due.toISOString();
  }
  function cleanTaskTitle(text) {
    return text.replace(/(?:^|\s)(?:hoje|amanhã|amanha)(?=$|\s|[.,!?])/gi, '')
      .replace(INTRO_TIME_PATTERN, ' ')
      .replace(TIME_PATTERN, ' ')
      .replace(DATE_PATTERN, ' ')
      .replace(/\b(?:por favor|pfv)\b/gi, '')
      .replace(/^[\s:.,-]+|[\s:.,!?-]+$/g, '').replace(/\s+/g, ' ').trim();
  }
  function directTask(text) {
    const normalized = String(text).trim()
      .replace(/^(?:por favor|pfv)[,\s]*/i, '')
      .replace(/^(?:podes|poderias|consegues)\s+(?:por favor\s+)?(?:criar|adicionar|agendar|registar|colocar|lembrar)\b/i, 'cria');
    const match = normalized.match(/^\s*(?:cria|adiciona|mete|coloca|regista|agenda|marca|lembra)(?:-me)?\s+(?:(?:uma?\s+)?(?:tarefa|lembrete)\s+)?(?:(?:para|de|que|me\s+de)\s+|[:\-]\s*)?(.+)$/i);
    if (!match?.[1] || /\b(?:\d+|duas|dois|três|tres|quatro|cinco)\s+tarefas?\b/i.test(text)) return null;
    const name = cleanTaskTitle(match[1]).slice(0, 160);
    if (name.length < 3) return null;
    return [{ title: name.charAt(0).toUpperCase() + name.slice(1), priority: 'media', due_at: parseDueAt(text) }];
  }
  function parseTasks(text) {
    const cleaned = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    let parsed;
    try { parsed = JSON.parse(cleaned); } catch (_) { return []; }
    const raw = Array.isArray(parsed) ? parsed : parsed?.tasks;
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    return raw.slice(0, 10).map(t => {
      const title = String(typeof t === 'string' ? t : t?.title || '').trim().slice(0, 160);
      const priority = ['alta', 'media', 'baixa'].includes(String(t?.priority || '').toLowerCase()) ? String(t.priority).toLowerCase() : 'media';
      const timestamp = typeof t?.due_at === 'string' ? new Date(t.due_at) : null;
      const due_at = timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp.toISOString() : null;
      return { title, priority, due_at };
    }).filter(t => {
      if (t.title.length < 3 || seen.has(t.title.toLowerCase())) return false;
      seen.add(t.title.toLowerCase()); return true;
    });
  }
  async function invokeAI(message) {
    const { data, error } = await client.functions.invoke('nova-ai', { body: { message, mode } });
    if (error) {
      let detail = error.message || 'Falha na ligação à IA.';
      if (error.context?.json) { try { const extra = await error.context.json(); detail = extra.error || extra.message || detail; } catch (_) {} }
      throw new Error(detail);
    }
    if (!data?.answer) throw new Error(data?.error || 'A IA não devolveu uma resposta.');
    return String(data.answer);
  }
  function taskPreview(row, tasks) {
    const bubble = row.querySelector('.ai-bubble');
    const card = document.createElement('section'); card.className = 'ai-task-preview';
    const heading = document.createElement('strong'); heading.textContent = tasks.length === 1 ? 'Tarefa sugerida' : 'Tarefas sugeridas';
    const list = document.createElement('ul');
    tasks.forEach(t => { const li = document.createElement('li'); li.textContent = t.title + (t.due_at ? ` · ${dateLabel(t.due_at)}` : ' · Sem data definida') + (t.priority !== 'media' ? ` · Prioridade ${t.priority}` : ''); list.append(li); });
    const controls = document.createElement('div'); controls.className = 'ai-task-actions';
    const confirm = document.createElement('button'); confirm.type = 'button'; confirm.className = 'ai-task-confirm'; confirm.textContent = tasks.length === 1 ? 'Guardar tarefa' : `Guardar ${tasks.length} tarefas`;
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancelar';
    const feedback = document.createElement('p'); feedback.className = 'ai-task-feedback'; feedback.setAttribute('role', 'status');
    cancel.addEventListener('click', () => { confirm.remove(); cancel.remove(); feedback.textContent = 'Criação cancelada.'; });
    confirm.addEventListener('click', async () => {
      if (!client || !userId) { feedback.textContent = 'Precisas de ter sessão iniciada para guardar tarefas.'; feedback.classList.add('error'); return; }
      confirm.disabled = true; cancel.disabled = true; feedback.textContent = 'A guardar no Supabase…';
      const { data: authData, error: authError } = await client.auth.getUser();
      if (authError || authData?.user?.id !== userId) {
        feedback.textContent = 'A sessão expirou. Inicia sessão novamente para guardar.';
        feedback.classList.add('error'); confirm.disabled = false; cancel.disabled = false;
        return;
      }
      const payload = tasks.map(t => ({ user_id: userId, title: t.title, status: 'pendente', priority: t.priority, due_at: t.due_at || null }));
      let error;
      try { ({ error } = await client.from('tasks').insert(payload)); }
      catch (e) { error = e; }
      if (error) {
        feedback.textContent = 'Não foi possível guardar: ' + error.message; feedback.classList.add('error');
        confirm.disabled = false; cancel.disabled = false;
      } else {
        confirm.remove(); cancel.remove(); feedback.textContent = `${tasks.length} tarefa(s) guardada(s) com sucesso. `;
        const link = document.createElement('a'); link.href = 'tarefas.html'; link.textContent = 'Ver as minhas tarefas'; feedback.append(link);
      }
    });
    controls.append(confirm, cancel); card.append(heading, list, controls, feedback); bubble.append(card);
    messages.scrollTop = messages.scrollHeight;
  }
  async function replyToTask(text, pending) {
    let tasks = directTask(text);
    if (!tasks) {
      const instruction = `O utilizador quer criar tarefas na NOVA Life. Transforma o pedido seguinte em tarefas concretas e curtas (máximo 10). Responde APENAS com JSON válido no formato {"tasks":[{"title":"...","priority":"media"}]}. Prioridades permitidas: alta, media, baixa. Não inventes datas nem horários. Usa \"due_at\": null em todas as tarefas; o navegador atribui datas explícitas. Não uses Markdown nem texto fora do JSON. Não executes ações. Pedido do utilizador: ${JSON.stringify(text)}`;
      tasks = parseTasks(await invokeAI(instruction));
    }
    // Uma data/hora escrita pelo utilizador tem precedência sobre datas inventadas pela IA.
    // Quando é comum a todas as tarefas, aplica-a a todas.
    const explicitDue = parseDueAt(text);
    if (hasDateTime(text) && !explicitDue) {
      pending.remove();
      addMessage('assistant', 'A data ou hora indicada parece inválida. Confirma, por exemplo: “Cria uma tarefa para ler amanhã às 23h”.');
      return;
    }
    if (explicitDue) tasks?.forEach(t => { t.due_at = explicitDue; });
    else tasks?.forEach(t => { t.due_at = null; });
    pending.remove();
    if (!tasks?.length) { addMessage('assistant', 'Não consegui identificar as tarefas. Experimenta: “Cria uma tarefa para estudar matemática” ou “Cria 3 tarefas para preparar o teste”.'); return; }
    const row = addMessage('assistant', 'Preparei estas tarefas para a NOVA Life. Confirma para as guardar na tua lista:');
    taskPreview(row, tasks);
  }
  async function send(text) {
    const question = text.trim();
    if (!question || busy) return;
    if (!client) { setStatus('Configuração do Supabase indisponível.', true); return; }
    if (Date.now() - lastMessageAt < 4000) { setStatus('Espera alguns segundos antes de enviar outra pergunta.', true); return; }
    lastMessageAt = Date.now(); busy = true; sendButton.disabled = true; prompt.disabled = true;
    setStatus('A NOVA AI está a responder…'); addMessage('user', question); prompt.value = '';
    const pending = addMessage('assistant', '', { typing: true, save: false });
    try {
      if (isHabitRequest(question)) await replyToHabit(question, pending);
      else if (isTaskRequest(question)) await replyToTask(question, pending);
      else {
        const answer = await invokeAI(question);
        pending.remove(); addMessage('assistant', answer);
      }
      setStatus('');
    } catch (error) {
      pending.remove();
      addMessage('assistant', 'Não consegui responder desta vez. ' + (error.message || 'Tenta novamente.'));
      setStatus('Ocorreu um erro no pedido.', true);
    } finally { busy = false; sendButton.disabled = false; prompt.disabled = false; prompt.focus(); }
  }
  async function restoreHistory() {
    if (!client) { setStatus('Configuração do Supabase indisponível.', true); return; }
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user) { window.location.replace('../login.html'); return; }
    userId = data.user.id;
    historyKey = `nova-ai-chat-v1:${userId}:${mode}`;
    try {
      const saved = JSON.parse(localStorage.getItem(historyKey) || '[]');
      if (Array.isArray(saved)) history = saved.filter(m => ['user', 'assistant'].includes(m?.author) && typeof m?.text === 'string').slice(-40);
    } catch (_) { history = []; }
    history.forEach(m => addMessage(m.author, m.text, { save: false }));
  }
  form.addEventListener('submit', e => { e.preventDefault(); send(prompt.value); });
  prompt.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
  el('clearChat').addEventListener('click', () => {
    if (busy) return;
    messages.querySelectorAll('.ai-message').forEach(node => node.remove());
    history = []; persist(); welcome.hidden = false; setStatus(''); prompt.value = ''; prompt.focus();
  });
  setupSuggestions(); icons(); restoreHistory().catch(() => setStatus('Não foi possível recuperar o histórico.', true));
})();
