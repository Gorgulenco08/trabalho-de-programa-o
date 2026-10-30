(() => {
  'use strict';
  const el = (id) => document.getElementById(id);
  const client = window.supabase && window.NOVA_SUPABASE_URL && window.NOVA_SUPABASE_KEY
    ? window.supabase.createClient(window.NOVA_SUPABASE_URL, window.NOVA_SUPABASE_KEY) : null;
  const welcome = el('welcome');
  const messages = el('conversation');
  const form = el('chatForm');
  const prompt = el('prompt');
  const sendButton = el('sendButton');
  const status = el('status');
  let mode = 'life';
  let busy = false;
  let lastMessageAt = 0;
  const suggestions = {
    life: ['Organiza o meu dia em 5 passos', 'Ajuda-me a criar uma rotina de estudo', 'Como posso melhorar os meus hábitos?', 'Divide um objetivo em tarefas pequenas'],
    quest: ['Explica o que é JavaScript', 'Cria 5 perguntas sobre HTML', 'Ajuda-me a estudar matemática', 'Como funciona o método Pomodoro?']
  };
  function icons() { if (window.lucide?.createIcons) window.lucide.createIcons(); }
  function changeMode(next) {
    mode = next === 'quest' ? 'quest' : 'life';
    document.querySelectorAll('.ai-mode-btn').forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.mode === mode)));
    el('welcomeDesc').textContent = mode === 'quest'
      ? 'Pronto para aprender? Posso explicar matérias, criar exercícios e ajudar-te a estudar.'
      : 'Estou aqui para te ajudar a organizar tarefas, alcançar objetivos e criar planos mais inteligentes.';
    const holder = el('suggestions');
    holder.replaceChildren();
    suggestions[mode].forEach(question => {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = question;
      button.addEventListener('click', () => { prompt.value = question; prompt.focus(); });
      holder.append(button);
    });
  }
  // Simple, safe Markdown renderer. Text is always inserted through textContent.
  function appendInline(parent, text) {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    for (const part of parts) {
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        const strong = document.createElement('strong'); strong.textContent = part.slice(2,-2); parent.append(strong);
      } else if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
        const code = document.createElement('code'); code.textContent = part.slice(1,-1); parent.append(code);
      } else parent.append(document.createTextNode(part));
    }
  }
  function renderAnswer(parent, text) {
    const lines = text.split('\n');
    let currentList = null;
    let codeBlock = null;
    for (const line of lines) {
      if (/^\s*```/.test(line)) {
        if (!codeBlock) { codeBlock=document.createElement('pre'); codeBlock.append(document.createElement('code')); parent.append(codeBlock); }
        else codeBlock=null;
        currentList=null; continue;
      }
      if (codeBlock) { codeBlock.firstChild.textContent += line + '\n'; continue; }
      if (!line.trim()) { currentList=null; continue; }
      const list = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)$/);
      if (list) {
        const type = /^\s*\d+\./.test(line) ? 'ol' : 'ul';
        if (!currentList || currentList.tagName.toLowerCase() !== type) { currentList=document.createElement(type); parent.append(currentList); }
        const li = document.createElement('li'); appendInline(li,list[1]); currentList.append(li); continue;
      }
      currentList=null;
      const heading=line.match(/^#{1,4}\s+(.*)$/);
      if (heading) { const h=document.createElement('h3'); appendInline(h,heading[1]); parent.append(h); continue; }
      const p=document.createElement('p'); appendInline(p,line); parent.append(p);
    }
  }
  function addMessage(author, text, typing=false) {
    welcome.hidden = true;
    const row = document.createElement('div'); row.className='ai-message '+author;
    const avatar=document.createElement('div'); avatar.className='ai-msg-icon';
    const icon=document.createElement('i'); icon.dataset.lucide=author==='user'?'user-round':'sparkles';avatar.append(icon);
    const bubble=document.createElement('div');bubble.className='ai-bubble';
    if(typing){const t=document.createElement('div');t.className='ai-typing';for(let i=0;i<3;i++)t.append(document.createElement('span'));bubble.append(t);}
    else if(author==='assistant')renderAnswer(bubble,text);
    else bubble.textContent=text;
    row.append(avatar,bubble);messages.append(row);messages.scrollTop=messages.scrollHeight;icons();
    return row;
  }
  function setStatus(text, error=false) {status.textContent=text||'';status.classList.toggle('error',error);}
  async function send(text) {
    const question=text.trim();
    if (!question || busy) return;
    if (!client) {setStatus('Configuração do Supabase indisponível.',true);return;}
    if (Date.now()-lastMessageAt < 4000) {setStatus('Espera alguns segundos antes de enviar outra pergunta.',true);return;}
    lastMessageAt=Date.now();busy=true;sendButton.disabled=true;prompt.disabled=true;setStatus('A NOVA AI está a responder…');
    addMessage('user',question);prompt.value='';
    const pending=addMessage('assistant','',true);
    try {
      const {data,error}=await client.functions.invoke('nova-ai',{body:{message:question,mode}});
      if(error){
        let message=error.message||'Falha na ligação à IA.';
        if(error.context?.json){try{const extra=await error.context.json();message=extra.error||extra.message||message;}catch(_){}}
        throw new Error(message);
      }
      if(!data?.answer)throw new Error(data?.error||'A IA não devolveu uma resposta.');
      pending.remove();addMessage('assistant',String(data.answer));setStatus('');
    }catch(error){pending.remove();addMessage('assistant','Não consegui responder desta vez. '+(error.message||'Tenta novamente.'));setStatus('Ocorreu um erro no pedido.',true);}
    finally{busy=false;sendButton.disabled=false;prompt.disabled=false;prompt.focus();}
  }
  document.querySelectorAll('.ai-mode-btn').forEach(btn=>btn.addEventListener('click',()=>changeMode(btn.dataset.mode)));
  form.addEventListener('submit',e=>{e.preventDefault();send(prompt.value);});
  prompt.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();form.requestSubmit();}});
  el('clearChat').addEventListener('click',()=>{if(busy)return;messages.querySelectorAll('.ai-message').forEach(node=>node.remove());welcome.hidden=false;setStatus('');prompt.value='';prompt.focus();});
  changeMode('life');icons();
})();
