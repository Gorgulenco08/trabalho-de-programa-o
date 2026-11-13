/* Progresso real dos hábitos no painel principal. Não interfere com as tarefas. */
(() => {
  'use strict';
  const list=document.getElementById('dashboardHabitList');
  const streakElement=document.getElementById('habitDashboardStreak');
  if(!list||!streakElement)return;
  const dayKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const shift=(date,delta)=>{const d=new Date(date.getFullYear(),date.getMonth(),date.getDate());d.setDate(d.getDate()+delta);return d;};
  const monday=date=>shift(date,-(date.getDay()+6)%7);
  const el=(tag,className,text)=>{const x=document.createElement(tag);if(className)x.className=className;if(text!==undefined)x.textContent=text;return x;};
  async function load(){
    if(!window.supabase||!window.NOVA_SUPABASE_KEY||!window.NOVA_SUPABASE_URL)return;
    const client=window.supabase.createClient(window.NOVA_SUPABASE_URL,window.NOVA_SUPABASE_KEY);
    const {data:{user},error:authError}=await client.auth.getUser();
    if(authError||!user)return;
    const now=new Date();
    const [h,l]=await Promise.all([
      client.from('habits').select('id,name,target_per_week').eq('user_id',user.id).eq('active',true).order('created_at',{ascending:false}),
      client.from('habit_logs').select('habit_id,done_on').eq('user_id',user.id).gte('done_on',dayKey(shift(now,-370)))
    ]);
    if(h.error||l.error){list.replaceChildren(el('p','', 'Não foi possível carregar os hábitos.'));streakElement.textContent='—';return;}
    const habits=h.data||[],logs=l.data||[];
    list.replaceChildren();
    let maximum=0;
    for(const habit of habits){
      const keys=new Set(logs.filter(x=>x.habit_id===habit.id).map(x=>x.done_on));
      let date=keys.has(dayKey(now))?now:shift(now,-1),current=0;
      while(keys.has(dayKey(date))&&current<365){current++;date=shift(date,-1);}
      maximum=Math.max(maximum,current);
      const weekStart=monday(now);let count=0;
      for(let i=0;i<7;i++)if(keys.has(dayKey(shift(weekStart,i))))count++;
      const row=el('div','habit');
      const icon=el('div','habit-icon','✦');
      const info=el('div','habit-info');
      const label=el('div','habit-caption');label.append(el('span','',habit.name),el('span','',`${count}/${habit.target_per_week}`));
      const track=el('div','track');const fill=el('div','fill');fill.style.width=`${Math.min(100,Math.round(count/habit.target_per_week*100))}%`;track.append(fill);
      info.append(label,track);row.append(icon,info);list.append(row);
    }
    streakElement.textContent=`${maximum} dias`;
    if(!habits.length)list.append(el('p','', 'Ainda não tens hábitos. Cria o primeiro na página Hábitos.'));
  }
  const safeLoad=()=>load().catch(()=>{list.replaceChildren(el('p','','Não foi possível carregar os hábitos.'));});
  safeLoad();
  window.addEventListener('pageshow',event=>{if(event.persisted)safeLoad();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)safeLoad();});
})();
