(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const status = message => { byId('status').textContent = message; };
  const result = message => { byId('result').textContent = message; };
  let client;

  async function init() {
    if (!window.supabase?.createClient || !window.NOVA_SUPABASE_URL || !window.NOVA_SUPABASE_KEY) {
      byId('sessionInfo').textContent = 'Falta carregar o Supabase. Confirma que esta página está na mesma pasta que supabase-config.js.';
      status('Não é possível testar sem a configuração da NOVA.');
      return;
    }
    client = window.supabase.createClient(window.NOVA_SUPABASE_URL, window.NOVA_SUPABASE_KEY);
    try {
      const {data, error} = await client.auth.getSession();
      if (error) throw error;
      if (!data.session) {
        byId('sessionInfo').textContent = 'Não há sessão iniciada. Abre o login, inicia sessão e volta a esta página.';
        status('Teste bloqueado: precisas de iniciar sessão.');
        return;
      }
      byId('sessionInfo').textContent = 'Sessão NOVA encontrada. Podes testar a IA.';
      byId('send').disabled = false;
      status('Tudo pronto para enviar um pedido de teste.');
    } catch (_) {
      byId('sessionInfo').textContent = 'Não foi possível verificar a sessão. Confirma a ligação à Internet.';
      status('O teste não pode começar.');
    }
  }

  byId('send').addEventListener('click', async () => {
    if (!client) return;
    const message = byId('message').value.trim();
    if (!message || message.length > 2000) {
      status('Escreve uma pergunta entre 1 e 2000 caracteres.');
      return;
    }
    byId('send').disabled = true;
    status('A enviar pergunta à função nova-ai...');
    result('A aguardar resposta...');
    try {
      const {data, error} = await client.functions.invoke('nova-ai', {
        body: {message, mode: byId('mode').value}
      });
      if (error) {
        const response = error.context;
        let body = {};
        if (response && typeof response.clone === 'function') {
          try {body = await response.clone().json();} catch (_) {}
        }
        const http = typeof response?.status === 'number' ? `HTTP ${response.status}` : 'Erro de rede';
        status(`O pedido falhou: ${http}.`);
        result(String(body.error || body.message || error.message || 'Consulta os logs da Edge Function no Supabase.'));
        return;
      }
      if (data?.error) {
        status('A função respondeu com um erro.');
        result(String(data.error));
        return;
      }
      status('Ligação à NOVA AI concluída com sucesso!');
      result(String(data?.answer || 'A resposta não incluiu o campo answer.'));
    } catch (err) {
      status('Erro inesperado no pedido.');
      result(String(err?.message || 'Erro desconhecido'));
    } finally {
      byId('send').disabled = false;
    }
  });
  init();
})();
