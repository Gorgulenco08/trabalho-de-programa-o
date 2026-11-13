/* NOVA Life — Hábitos. Dados individuais em public.habits e public.habit_logs. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const client = window.supabase && window.NOVA_SUPABASE_URL && window.NOVA_SUPABASE_KEY
    ? window.supabase.createClient(window.NOVA_SUPABASE_URL, window.NOVA_SUPABASE_KEY) : null;
  let user = null, habits = [], logs = [], editingId = null, busy = false;
  const dateKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const dayAt = (origin, delta) => { const d = new Date(origin.getFullYear(), origin.getMonth(), origin.getDate()); d.setDate(d.getDate()+delta); return d; };
  const today = () => new Date();
  const monday = date => dayAt(date, -(date.getDay()+6)%7);
  const weekday = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const showError = message => { const el=$('habitsAlert'); el.hidden=false; el.textContent=message; };
  const clearError = () => { $('habitsAlert').hidden=true; $('habitsAlert').textContent=''; };
  const node = (tag, className, text) => {
    const n=document.createElement(tag); if(className)n.className=className; if(text!==undefined)n.textContent=text; return n;
  };
  const getKeys = id => new Set(logs.filter(log=>log.habit_id===id).map(log=>log.done_on));
  function streak(keys) {
    let count=0, d=today();
    if(!keys.has(dateKey(d)))d=dayAt(d,-1);
    while(keys.has(dateKey(d)) && count<3650){count++; d=dayAt(d,-1);}
    return count;
  }
  function weekDone(keys) {
    const first=monday(today());
    let count=0;
    for(let n=0;n<7;n++)if(keys.has(dateKey(dayAt(first,n))))count++;
    return count;
  }
  function getMetrics(habit) {
    const keys=getKeys(habit.id);
    return { keys, done:weekDone(keys), sequence:streak(keys), todayDone:keys.has(dateKey(today())) };
  }
  function renderSummary() {
    const active=habits.filter(h=>h.active);
    const metrics=active.map(getMetrics);
    $('habitCount').textContent=String(active.length);
    $('habitTodayCount').textContent=`${metrics.filter(m=>m.todayDone).length} / ${active.length}`;
    $('habitStreak').textContent=`${Math.max(0,...metrics.map(m=>m.sequence))} dias`;
    const hit=active.filter((h,i)=>metrics[i].done>=h.target_per_week).length;
    $('habitWeeklyRate').textContent=`${hit} / ${active.length}`;
  }
  function button(text, title, onClick) {
    const b=node('button','habit-outline-button',text);b.type='button';b.title=title;b.addEventListener('click',onClick);return b;
  }
  function renderCard(habit) {
    const info=getMetrics(habit);
    const card=node('article','habits-card'+(habit.active?'':' archived'));
    const head=node('div','habit-card-top');
    const heading=node('div');heading.append(node('h3','',habit.name));
    if(habit.description)heading.append(node('p','',habit.description));
    const actions=node('div','habit-card-actions');
    actions.append(button('Editar','Editar hábito',()=>openDialog(habit)));
    actions.append(button(habit.active?'Arquivar':'Reativar',habit.active?'Arquivar hábito':'Reativar hábito',()=>toggleActive(habit)));
    actions.append(button('Eliminar','Eliminar hábito',()=>deleteHabit(habit)));
    head.append(heading,actions);card.append(head);
    const stats=node('div','habit-card-stats');
    stats.append(node('strong','',`${info.done} / ${habit.target_per_week} dias esta semana`),node('span','',`${Math.min(100,Math.round(info.done/habit.target_per_week*100))}% da meta`));
    const progress=node('div','habit-progress');const fill=node('div','habit-progress-fill');fill.style.width=`${Math.min(100,info.done/habit.target_per_week*100)}%`;progress.append(fill);
    card.append(stats,progress);
    if(habit.active){
      const weekLabel=node('div','habit-week-label');weekLabel.append(node('span','','Últimos 7 dias'),node('span','','Clica num dia para marcar ou desmarcar'));
      card.append(weekLabel);
      const days=node('div','habit-days');
      const now=today();
      for(let i=-6;i<=0;i++){
        const d=dayAt(now,i), key=dateKey(d), done=info.keys.has(key);
        const day=node('button','habit-day'+(done?' done':'')+(i===0?' today':'')); day.type='button';
        day.setAttribute('aria-pressed',String(done));
        day.setAttribute('aria-label',`${weekday[d.getDay()]} ${d.getDate()}: ${done?'concluído':'por concluir'}`);
        day.append(node('b','',weekday[d.getDay()]),node('em','',String(d.getDate())),node('span','',done?'✓':'○'));
        day.addEventListener('click',()=>markDay(habit.id,key,day));
        days.append(day);
      }
      card.append(days);
    }
    const foot=node('div','habit-card-foot');
    foot.append(node('span','habit-pill',habit.active?(info.todayDone?'✓ Feito hoje':'Por fazer hoje'):'Arquivado'));
    foot.append(node('span','habit-pill',`🔥 ${info.sequence} dias seguidos`));
    card.append(foot);
    return card;
  }
  function render() {
    renderSummary();
    const display=habits.filter(h=>h.active || $('showArchived').checked);
    const list=$('habitList');list.replaceChildren(...display.map(renderCard));
    $('habitsEmpty').hidden=display.length>0;
    $('habitsEmpty').querySelector('h2').textContent=habits.length?'Não há hábitos nesta vista':'Começa com um hábito';
    $('habitsEmpty').querySelector('p').textContent=habits.length?'Ativa «Mostrar arquivados» para veres os hábitos que guardaste.':'Uma pequena rotina é um bom primeiro passo. Cria o teu primeiro hábito e marca os dias em que o cumprires.';
  }
  async function reload() {
    if(!client || !user)return;
    const [h,l]=await Promise.all([
      client.from('habits').select('id,user_id,name,description,target_per_week,active,created_at').eq('user_id',user.id).order('created_at',{ascending:false}),
      client.from('habit_logs').select('id,habit_id,done_on').eq('user_id',user.id).gte('done_on',dateKey(dayAt(today(),-370)))
    ]);
    if(h.error||l.error){showError('Não foi possível carregar os hábitos. '+(h.error||l.error).message);return;}
    habits=h.data||[];logs=l.data||[];clearError();render();
  }
  async function markDay(id,date,control) {
    if(busy||!user)return;busy=true;control.disabled=true;clearError();
    try{
      const found=logs.find(log=>log.habit_id===id && log.done_on===date);
      const result=found
        ? await client.from('habit_logs').delete().eq('id',found.id).eq('user_id',user.id)
        : await client.from('habit_logs').insert({habit_id:id,user_id:user.id,done_on:date});
      if(result.error)throw result.error;
      await reload();
    }catch(e){showError('Não foi possível atualizar o dia: '+e.message);}
    finally{busy=false;control.disabled=false;}
  }
  function openDialog(habit=null){
    editingId=habit?.id||null;
    $('habitDialogTitle').textContent=habit?'Editar hábito':'Novo hábito';
    $('habitName').value=habit?.name||'';
    $('habitDescription').value=habit?.description||'';
    $('habitTarget').value=String(habit?.target_per_week||7);
    $('habitDialog').showModal();$('habitName').focus();
  }
  async function saveHabit(e){
    e.preventDefault();if(busy||!user)return;
    const payload={name:$('habitName').value.trim(),description:$('habitDescription').value.trim()||null,target_per_week:Number($('habitTarget').value)};
    if(!payload.name||payload.name.length>90||!Number.isInteger(payload.target_per_week)||payload.target_per_week<1||payload.target_per_week>7){showError('Preenche um nome e escolhe uma meta entre 1 e 7 dias.');return;}
    busy=true;$('saveHabit').disabled=true;clearError();
    try{
      const result=editingId
        ? await client.from('habits').update(payload).eq('id',editingId).eq('user_id',user.id)
        : await client.from('habits').insert({...payload,user_id:user.id});
      if(result.error)throw result.error;
      $('habitDialog').close();await reload();
    }catch(e){showError('Não foi possível guardar o hábito: '+e.message);$('habitDialog').close();}
    finally{busy=false;$('saveHabit').disabled=false;}
  }
  async function toggleActive(habit){
    if(busy||!user)return;busy=true;clearError();
    const {error}=await client.from('habits').update({active:!habit.active}).eq('id',habit.id).eq('user_id',user.id);
    if(error)showError('Não foi possível atualizar o hábito: '+error.message);
    else await reload();busy=false;
  }
  async function deleteHabit(habit){
    if(busy||!user||!window.confirm(`Eliminar «${habit.name}» e todo o histórico deste hábito? Esta ação não pode ser anulada.`))return;
    busy=true;clearError();
    const {error}=await client.from('habits').delete().eq('id',habit.id).eq('user_id',user.id);
    if(error)showError('Não foi possível eliminar o hábito: '+error.message);
    else await reload();busy=false;
  }
  $('newHabit').addEventListener('click',()=>openDialog());
  $('firstHabit').addEventListener('click',()=>openDialog());
  $('showArchived').addEventListener('change',render);
  $('habitForm').addEventListener('submit',saveHabit);
  $('closeHabitDialog').addEventListener('click',()=>$('habitDialog').close());
  $('cancelHabit').addEventListener('click',()=>$('habitDialog').close());
  async function init(){
    if(!client)return;
    try{
      const {data,error}=await client.auth.getUser();
      if(error||!data?.user)return; // nova-uniform.js gere o redirecionamento.
      user=data.user;
      await reload();
    }catch(e){showError('Não foi possível ligar ao Supabase: '+e.message);}
  }
  init();
})();
