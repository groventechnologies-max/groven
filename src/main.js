import { createClient } from '@supabase/supabase-js';
import './style.css';

history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

// ── Intro splash ──────────────────────────────────────────────────────────
(function initIntro() {
  document.body.style.overflow = 'hidden';
  const intro = document.getElementById('intro');
  setTimeout(() => document.querySelector('.ilb1')?.classList.add('go'), 80);
  setTimeout(() => document.querySelector('.ilb2')?.classList.add('go'), 230);
  setTimeout(() => document.querySelector('.ilb3')?.classList.add('go'), 400);
  setTimeout(() => document.querySelector('.intro-name')?.classList.add('show'), 620);
  setTimeout(() => document.querySelector('.intro-tagline')?.classList.add('show'), 830);
  setTimeout(() => {
    intro?.classList.add('exit');
    document.body.style.overflow = '';
    setTimeout(() => intro?.remove(), 780);
  }, 2100);
})();

// ── Typewriter ────────────────────────────────────────────────────────────
(function initTypewriter() {
  const phrases = ['em outro nível.', 'mais produtivo.', 'mais organizado.', 'mais lucrativo.'];
  let pi = 0, ci = 0, erasing = false;
  const el = document.getElementById('tw-text');
  if (!el) return;
  function tick() {
    const phrase = phrases[pi];
    if (!erasing) {
      el.textContent = phrase.slice(0, ++ci);
      if (ci === phrase.length) { erasing = true; setTimeout(tick, 2400); return; }
      setTimeout(tick, 72);
    } else {
      el.textContent = phrase.slice(0, --ci);
      if (ci === 0) { erasing = false; pi = (pi + 1) % phrases.length; setTimeout(tick, 320); return; }
      setTimeout(tick, 38);
    }
  }
  setTimeout(tick, 150);
})();

const SUPA_URL = 'https://urmzqtldzpinvsmcpjyo.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVybXpxdGxkenBpbnZzbWNwanlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMDEzNTUsImV4cCI6MjA5MzY3NzM1NX0.XlfpM7W2O5QCLgy_zRH5vkKCiHjccpXz60Ak0OQjFsw';
const sb = createClient(SUPA_URL, SUPA_KEY);

let currentUser = null, currentProfile = null, pendingAction = null,
    activeContactId = null, chatChannel = null, notifChannel = null;

// ── Auth overlay helpers ──────────────────────────────────────────────────
function openAuth() {
  const o = document.getElementById('authOverlay');
  if (o) { o.classList.add('open'); document.body.style.overflow = 'hidden'; }
  const e = document.getElementById('auth-error');
  const s = document.getElementById('auth-success');
  if (e) e.style.display = 'none';
  if (s) s.style.display = 'none';
}
function closeAuth() {
  const o = document.getElementById('authOverlay');
  if (o) { o.classList.remove('open'); document.body.style.overflow = ''; }
  pendingAction = null;
}
function scrollToSection(id) { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); }
function closeDash() {
  const o = document.getElementById('dashOverlay');
  if (o) { o.classList.remove('open'); document.body.style.overflow = ''; }
}

// ── Init ──────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('btn-login')?.addEventListener('click', doLogin);
  document.getElementById('btn-register')?.addEventListener('click', doRegister);
  document.getElementById('l-pass')?.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  document.getElementById('r-pass')?.addEventListener('keydown', e => { if (e.key === 'Enter') doRegister(); });
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session) await loadProfile(session.user);
  } catch (e) {}
});

async function loadProfile(user) {
  currentUser = user;
  const { data } = await sb.from('profiles').select('*').eq('id', user.id).single();
  currentProfile = data;
  updateNavState();
  loadNotifications();
  subscribeNotifications();
}

function getInitials(s) {
  if (!s) return '?';
  return s.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function setAvatar(id, url, ini) {
  const el = document.getElementById(id);
  if (!el) return;
  if (url) { el.innerHTML = `<img src="${url}" alt="av" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`; el.textContent = ''; }
  else { el.innerHTML = ''; el.textContent = ini; }
}

function updateNavState() {
  const p = currentProfile;
  if (!p) return;
  const ini = getInitials(p.full_name || p.email);
  document.getElementById('nav-login-btn').style.display = 'none';
  document.getElementById('nav-user-state').style.display = 'flex';
  setAvatar('nav-av', p.avatar_url, ini);
  document.getElementById('nav-nm').textContent = p.full_name?.split(' ')[0] || p.email;
  document.getElementById('mobile-auth-link').style.display = 'none';
  document.getElementById('mobile-dash-link').style.display = 'block';
}

// ── Notifications ─────────────────────────────────────────────────────────
function subscribeNotifications() {
  if (!currentUser) return;
  notifChannel = sb.channel(`notif:${currentUser.id}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUser.id}` }, (payload) => {
      loadNotifications();
      showToast(payload.new.message, 'success');
      triggerEmail(payload.new.user_id, payload.new.type, payload.new.message, payload.new.contact_id);
    }).subscribe();
}

async function triggerEmail(userId, type, message, contactId) {
  try {
    let contact_subject = '';
    if (contactId) {
      const { data } = await sb.from('contacts').select('subject').eq('id', contactId).single();
      contact_subject = data?.subject || '';
    }
    const subjectMap = {
      status_change: 'Atualização no seu contato — Groven',
      new_message: 'Nova mensagem da Groven',
      project_update: 'Atualização no seu projeto — Groven'
    };
    await fetch(`${SUPA_URL}/functions/v1/send-notification-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPA_KEY}` },
      body: JSON.stringify({ user_id: userId, type, subject: subjectMap[type] || 'Notificação Groven', message, contact_subject })
    });
  } catch (e) { console.log('Email trigger error:', e); }
}

async function loadNotifications() {
  if (!currentUser) return;
  const { data } = await sb.from('notifications').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(20);
  const unread = data?.filter(n => !n.read).length || 0;
  const badge = document.getElementById('notif-badge');
  badge.textContent = unread || '';
  badge.style.display = unread > 0 ? 'flex' : 'none';
  const list = document.getElementById('notif-list');
  if (!data?.length) { list.innerHTML = '<div class="notif-empty">Nenhuma notificação</div>'; return; }
  list.innerHTML = data.map(n => `<div class="notif-item ${n.read ? '' : 'unread'}" onclick="readNotif('${n.id}')"><div class="notif-dot ${n.read ? 'read' : ''}"></div><div><div class="notif-text">${escHtml(n.message)}</div><div class="notif-time">${timeAgo(n.created_at)}</div></div></div>`).join('');
}

async function readNotif(id) { await sb.from('notifications').update({ read: true }).eq('id', id); loadNotifications(); }
async function markAllRead() { await sb.from('notifications').update({ read: true }).eq('user_id', currentUser.id).eq('read', false); loadNotifications(); }
function toggleNotif(e) { e.stopPropagation(); document.getElementById('notifDropdown').classList.toggle('open'); }
document.addEventListener('click', () => document.getElementById('notifDropdown')?.classList.remove('open'));

// ── Chat realtime ─────────────────────────────────────────────────────────
async function openThread(contactId, subject) {
  activeContactId = contactId;
  document.getElementById('thread-title').textContent = subject;
  document.getElementById('modalThread').classList.add('open');
  document.getElementById('chat-messages').innerHTML = '<div style="text-align:center;color:var(--gray);font-size:0.8rem;padding:20px"><span class="loader-sm loader-sm-w"></span></div>';
  await loadMessages();
  subscribeChatRealtime(contactId);
}

function closeThread() {
  closeEdit('modalThread');
  if (chatChannel) { sb.removeChannel(chatChannel); chatChannel = null; }
  activeContactId = null;
}

function subscribeChatRealtime(contactId) {
  if (chatChannel) sb.removeChannel(chatChannel);
  chatChannel = sb.channel(`chat:${contactId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `contact_id=eq.${contactId}` }, (payload) => { appendMessage(payload.new); })
    .subscribe();
}

async function loadMessages() {
  const { data: msgs } = await sb.from('messages').select('*,profiles(full_name,avatar_url)').eq('contact_id', activeContactId).order('created_at', { ascending: true });
  const { data: atts } = await sb.from('attachments').select('*,profiles(full_name)').eq('contact_id', activeContactId).order('created_at', { ascending: true });
  const el = document.getElementById('chat-messages');
  const items = [...(msgs || []).map(m => ({ ...m, _type: 'msg' })), ...(atts || []).map(a => ({ ...a, _type: 'att' }))].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  if (!items.length) { el.innerHTML = '<div class="msg-bubble system">Nenhuma mensagem ainda. Inicie a conversa!</div>'; return; }
  el.innerHTML = '';
  items.forEach(item => { if (item._type === 'msg') appendMessage(item, false); else appendAttachment(item, false); });
  scrollChat();
}

function appendMessage(m, scroll = true) {
  const el = document.getElementById('chat-messages');
  const mine = m.sender_id === currentUser.id;
  const name = mine ? 'Você' : (m.profiles?.full_name || 'Suporte');
  const div = document.createElement('div');
  div.className = `msg-bubble ${mine ? 'mine' : 'theirs'}`;
  div.innerHTML = `${escHtml(m.content)}<div class="msg-meta"><span>${name}</span><span>·</span><span>${timeAgo(m.created_at)}</span></div>`;
  el.appendChild(div);
  if (scroll) scrollChat();
}

function appendAttachment(a, scroll = true) {
  const el = document.getElementById('chat-messages');
  const mine = a.uploaded_by === currentUser.id;
  const name = mine ? 'Você' : (a.profiles?.full_name || 'Suporte');
  const safeUrl = (a.file_url && a.file_url.startsWith(SUPA_URL)) ? a.file_url : '#';
  const div = document.createElement('div');
  div.className = `msg-bubble ${mine ? 'mine' : 'theirs'}`;
  div.style.padding = '8px 12px';
  const inner = document.createElement('div');
  inner.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer';
  inner.addEventListener('click', () => { if (safeUrl !== '#') window.open(safeUrl, '_blank', 'noopener,noreferrer'); });
  inner.innerHTML = `<span style="display:inline-flex;align-items:center;opacity:0.7">${fileIcon(a.mime_type)}</span><div><div style="font-size:0.8rem;font-weight:500">${escHtml(a.file_name)}</div><div style="font-size:0.68rem;color:rgba(255,255,255,0.4);display:flex;align-items:center;gap:3px">${formatBytes(a.file_size)} · <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Baixar</div></div>`;
  const meta = document.createElement('div');
  meta.className = 'msg-meta';
  meta.innerHTML = `<span>${escHtml(name)}</span><span>·</span><span>${timeAgo(a.created_at)}</span>`;
  div.appendChild(inner);
  div.appendChild(meta);
  el.appendChild(div);
  if (scroll) scrollChat();
}

function scrollChat() { const el = document.getElementById('chat-messages'); el.scrollTop = el.scrollHeight; }

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const content = input.value.trim();
  if (!content || !activeContactId) return;
  input.value = '';
  document.getElementById('btn-chat-send').disabled = true;
  await sb.from('messages').insert({ contact_id: activeContactId, sender_id: currentUser.id, content });
  document.getElementById('btn-chat-send').disabled = false;
  input.focus();
}

async function uploadAttachments(files) {
  if (!files?.length || !activeContactId) return;
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain'];
  const MAX_SIZE = 10 * 1024 * 1024;
  showToast('Enviando...');
  let uploaded = 0;
  for (const file of Array.from(files)) {
    if (!ALLOWED_TYPES.includes(file.type)) { showToast(`Tipo não permitido: ${file.name}`, 'error'); continue; }
    if (file.size > MAX_SIZE) { showToast(`Arquivo muito grande (máx 10MB): ${file.name}`, 'error'); continue; }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
    const path = `${activeContactId}/${Date.now()}_${safeName}`;
    const { error } = await sb.storage.from('attachments').upload(path, file, { contentType: file.type });
    if (error) { showToast('Erro: ' + file.name, 'error'); continue; }
    const { data: { publicUrl } } = sb.storage.from('attachments').getPublicUrl(path);
    const { data: att } = await sb.from('attachments').insert({ contact_id: activeContactId, uploaded_by: currentUser.id, file_name: file.name, file_url: publicUrl, file_size: file.size, mime_type: file.type }).select().single();
    if (att) appendAttachment({ ...att, profiles: { full_name: 'Você' }, _type: 'att' });
    uploaded++;
  }
  if (uploaded > 0) showToast(`${uploaded} arquivo(s) enviado(s)!`, 'success');
  document.getElementById('attach-input').value = '';
}

// ── CTA ───────────────────────────────────────────────────────────────────
function handleCtaClick(action) {
  if (action === 'email') { window.open('mailto:groventecnologies@gmail.com', '_blank'); return; }
  if (action === 'whatsapp') { window.open('https://wa.me/5511941441309', '_blank'); return; }
  if (currentUser) {
    openDash();
    if (action) setTimeout(() => { document.getElementById('nc-channel').value = action === 'whatsapp' ? 'whatsapp' : 'email'; document.getElementById('nc-subject').focus(); }, 300);
  } else { pendingAction = action || null; openAuth(); }
}

// ── Auth ──────────────────────────────────────────────────────────────────
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((t, i) => t.classList.toggle('active', (tab === 'login') === (i === 0)));
  document.getElementById('auth-form-login').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('auth-form-register').style.display = tab === 'register' ? 'block' : 'none';
  clearAuthMsgs();
}

async function doLogin() {
  const email = document.getElementById('l-email').value.trim(), pass = document.getElementById('l-pass').value;
  if (!email || !pass) return showAuthError('Preencha todos os campos.');
  setBtnLoad('btn-login', true, 'Entrando...');
  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
    setBtnLoad('btn-login', false, 'Entrar');
    if (error) return showAuthError('Erro: ' + error.message);
    await loadProfile(data.user);
    closeAuth();
    if (pendingAction !== null) handleCtaClick(pendingAction); else openDash();
  } catch (e) { setBtnLoad('btn-login', false, 'Entrar'); showAuthError('Erro de conexão.'); console.error(e); }
}

async function doRegister() {
  const name = document.getElementById('r-name').value.trim(), email = document.getElementById('r-email').value.trim();
  const pass = document.getElementById('r-pass').value, company = document.getElementById('r-company').value.trim();
  if (!name || !email || !pass) return showAuthError('Preencha todos os campos obrigatórios.');
  if (pass.length < 6) return showAuthError('Senha deve ter ao menos 6 caracteres.');
  setBtnLoad('btn-register', true, 'Criando conta...');
  try {
    const { data, error } = await sb.auth.signUp({ email, password: pass, options: { data: { full_name: name, company } } });
    setBtnLoad('btn-register', false, 'Criar conta');
    if (error) return showAuthError('Erro: ' + error.message);
    if (data.session) { await loadProfile(data.user); closeAuth(); openDash(); }
    else showAuthSuccess('Conta criada! Verifique seu e-mail para confirmar.');
  } catch (e) { setBtnLoad('btn-register', false, 'Criar conta'); showAuthError('Erro de conexão.'); console.error(e); }
}

async function doLogout() {
  if (chatChannel) sb.removeChannel(chatChannel);
  if (notifChannel) sb.removeChannel(notifChannel);
  await sb.auth.signOut();
  currentUser = null; currentProfile = null;
  document.getElementById('nav-login-btn').style.display = '';
  document.getElementById('nav-user-state').style.display = 'none';
  document.getElementById('mobile-auth-link').style.display = 'block';
  document.getElementById('mobile-dash-link').style.display = 'none';
  closeDash();
}

// ── Dashboard ─────────────────────────────────────────────────────────────
function openDash() {
  const p = currentProfile;
  if (!p) return;
  document.getElementById('dashOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  setAvatar('d-av', p.avatar_url, getInitials(p.full_name || p.email));
  document.getElementById('d-nm').textContent = p.full_name || p.email;
  const rp = document.getElementById('d-role');
  rp.textContent = p.role === 'admin' ? 'Admin' : 'Cliente';
  rp.className = 'role-pill ' + (p.role === 'admin' ? 'role-admin' : 'role-client');
  if (p.role === 'admin') {
    document.getElementById('sidebar-client').style.display = 'none';
    document.getElementById('sidebar-admin').style.display = 'block';
    ['page-overview', 'page-contacts', 'page-projects', 'page-profile', 'page-notifications'].forEach(id => document.getElementById(id).style.display = 'none');
    showAdminPage('contacts');
  } else {
    document.getElementById('sidebar-client').style.display = 'block';
    document.getElementById('sidebar-admin').style.display = 'none';
    ['admin-contacts-page', 'admin-clients-page', 'admin-projects-page'].forEach(id => document.getElementById(id).style.display = 'none');
    document.getElementById('d-greeting').textContent = `Olá, ${p.full_name?.split(' ')[0] || 'bem-vindo'}!`;
    showDashPage('overview');
  }
}

function showDashPage(page) {
  ['overview', 'contacts', 'projects', 'profile', 'notifications'].forEach(p => document.getElementById(`page-${p}`).style.display = p === page ? 'block' : 'none');
  document.querySelectorAll('#sidebar-client .dash-nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));
  const activeEl = document.getElementById(`page-${page}`);
  activeEl.classList.remove('page-enter');
  void activeEl.offsetWidth;
  activeEl.classList.add('page-enter');
  if (page === 'overview') loadClientOverview();
  else if (page === 'contacts') loadClientContacts();
  else if (page === 'projects') loadClientProjects();
  else if (page === 'profile') loadProfilePage();
  else if (page === 'notifications') loadNotifPrefs();
}

function showAdminPage(page) {
  ['contacts', 'clients', 'projects'].forEach(p => document.getElementById(`admin-${p}-page`).style.display = p === page ? 'block' : 'none');
  document.querySelectorAll('#sidebar-admin .dash-nav-item').forEach(el => el.classList.toggle('active', el.dataset.apage === page));
  const activeEl = document.getElementById(`admin-${page}-page`);
  activeEl.classList.remove('page-enter');
  void activeEl.offsetWidth;
  activeEl.classList.add('page-enter');
  if (page === 'contacts') loadAdminContacts();
  else if (page === 'clients') loadAdminClients();
  else if (page === 'projects') loadAdminProjects();
}

// ── Client ────────────────────────────────────────────────────────────────
async function loadClientOverview() {
  const [{ data: c }, { data: projects }] = await Promise.all([
    sb.from('contacts').select('*').eq('client_id', currentUser.id).order('created_at', { ascending: false }),
    sb.from('projects').select('*').eq('client_id', currentUser.id)
  ]);
  document.getElementById('d-client-stats').innerHTML = `
    <div class="dstat-card"><div class="dstat-label">Contatos</div><div class="dstat-val">${c?.length || 0}</div></div>
    <div class="dstat-card"><div class="dstat-label">Abertos</div><div class="dstat-val" style="color:var(--yellow)">${c?.filter(x => x.status === 'open').length || 0}</div></div>
    <div class="dstat-card"><div class="dstat-label">Em andamento</div><div class="dstat-val" style="color:var(--blue)">${c?.filter(x => x.status === 'in_progress').length || 0}</div></div>
    <div class="dstat-card"><div class="dstat-label">Resolvidos</div><div class="dstat-val" style="color:var(--green)">${c?.filter(x => x.status === 'resolved').length || 0}</div></div>
    <div class="dstat-card"><div class="dstat-label">Projetos</div><div class="dstat-val">${projects?.length || 0}</div></div>`;
}

async function loadClientContacts() {
  const { data } = await sb.from('contacts').select('*').eq('client_id', currentUser.id).order('created_at', { ascending: false });
  const tbody = document.getElementById('d-client-tbody');
  if (!data?.length) { tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg></div>Nenhum contato ainda.</div></td></tr>`; return; }
  tbody.innerHTML = data.map(x => `<tr>
    <td>${escHtml(x.subject)}</td><td>${chLabel(x.channel)}</td><td>${stBadge(x.status)}</td>
    <td style="color:var(--gray);white-space:nowrap">${fmtDate(x.created_at)}</td>
    <td><button class="dbtn-sm" data-id="${x.id}" data-subject="${escHtml(x.subject)}" onclick="clientOpenChat(this)">Chat</button></td>
  </tr>`).join('');
}

async function sendContact() {
  const subject = document.getElementById('nc-subject').value.trim();
  const message = document.getElementById('nc-msg').value.trim();
  const channel = document.getElementById('nc-channel').value;
  if (!subject || !message) return showToast('Preencha o assunto e a mensagem.', 'error');
  setBtnLoad('btn-send', true, 'Enviando...');
  const { error } = await sb.from('contacts').insert({ client_id: currentUser.id, subject, message, channel });
  setBtnLoad('btn-send', false, 'Enviar');
  if (error) return showToast('Erro ao enviar.', 'error');
  document.getElementById('nc-subject').value = '';
  document.getElementById('nc-msg').value = '';
  showToast('Contato enviado com sucesso!', 'success');
  loadClientOverview();
}

function clientOpenChat(btn) {
  sb.from('messages').update({ read_by_client: true }).eq('contact_id', btn.dataset.id).eq('read_by_client', false);
  openThread(btn.dataset.id, btn.dataset.subject);
}

async function loadClientProjects() {
  const { data } = await sb.from('projects').select('*,project_steps(*)').eq('client_id', currentUser.id).order('created_at', { ascending: false });
  const el = document.getElementById('d-projects-list');
  if (!data?.length) { el.innerHTML = `<div class="empty-state"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg></div>Nenhum projeto ainda.</div>`; return; }
  el.innerHTML = data.map(p => renderProjectCard(p)).join('');
}

function renderProjectCard(p) {
  const sm = { planning: ['Planejamento', 'var(--gray)'], in_progress: ['Em andamento', 'var(--blue)'], review: ['Revisão', 'var(--yellow)'], completed: ['Concluído', 'var(--green)'] };
  const [sl, sc] = sm[p.status] || ['—', 'var(--gray)'];
  const steps = p.project_steps || [];
  return `<div class="project-card">
    <div class="project-header"><div class="project-title-text">${escHtml(p.title)}</div><span class="dbadge" style="background:${sc}22;color:${sc};border:1px solid ${sc}44">${sl}</span></div>
    ${p.description ? `<div class="project-desc">${escHtml(p.description)}</div>` : ''}
    <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${p.progress}%"></div></div>
    <div class="progress-label"><span>Progresso</span><span>${p.progress}%</span></div>
    ${steps.length ? `<div class="project-steps">${steps.map(s => `<div class="project-step-item"><div class="step-check ${s.done ? 'done' : ''}">${s.done ? '✓' : ''}</div><span style="${s.done ? 'text-decoration:line-through;color:var(--gray)' : ''}">${escHtml(s.title)}</span></div>`).join('')}</div>` : ''}
    <div class="project-meta">${p.deadline ? `<div class="project-meta-item"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Prazo: ${new Date(p.deadline).toLocaleDateString('pt-BR')}</div>` : ''}<div class="project-meta-item"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> ${steps.filter(s => s.done).length}/${steps.length} etapas</div></div>
  </div>`;
}

function renderAdminProjectCard(p) {
  const clientName = p.profiles?.full_name || p.profiles?.email || '—';
  const sm = { planning: ['Planejamento', 'var(--gray)'], in_progress: ['Em andamento', 'var(--blue)'], review: ['Revisão', 'var(--yellow)'], completed: ['Concluído', 'var(--green)'] };
  const [sl, sc] = sm[p.status] || ['—', 'var(--gray)'];
  const steps = p.project_steps || [];
  return `<div class="project-card">
    <div style="font-size:0.72rem;color:var(--gray);margin-bottom:8px;display:flex;align-items:center;gap:4px"><svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>${escHtml(clientName)}</div>
    <div class="project-header"><div class="project-title-text">${escHtml(p.title)}</div><span class="dbadge" style="background:${sc}22;color:${sc};border:1px solid ${sc}44">${sl}</span></div>
    ${p.description ? `<div class="project-desc">${escHtml(p.description)}</div>` : ''}
    <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${p.progress}%"></div></div>
    <div class="progress-label"><span>Progresso</span><span>${p.progress}%</span></div>
    ${steps.length ? `<div class="project-steps">${steps.map(s => `<div class="project-step-item"><div class="step-check ${s.done ? 'done' : ''}">${s.done ? '✓' : ''}</div><span style="${s.done ? 'text-decoration:line-through;color:var(--gray)' : ''}">${escHtml(s.title)}</span></div>`).join('')}</div>` : ''}
    <div class="project-meta">${p.deadline ? `<div class="project-meta-item"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Prazo: ${new Date(p.deadline).toLocaleDateString('pt-BR')}</div>` : ''}<div class="project-meta-item"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> ${steps.filter(s => s.done).length}/${steps.length} etapas</div></div>
    <div style="margin-top:12px"><button class="dbtn-sm" onclick="openEditProject('${p.id}')"><svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Editar</button></div>
  </div>`;
}

async function loadProfilePage() {
  const p = currentProfile;
  document.getElementById('p-name').value = p.full_name || '';
  document.getElementById('p-company').value = p.company || '';
  document.getElementById('p-email').value = p.email || '';
  const big = document.getElementById('profile-avatar-big');
  if (p.avatar_url) { big.innerHTML = `<img src="${p.avatar_url}" alt="av" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`; big.textContent = ''; }
  else { big.innerHTML = ''; big.textContent = getInitials(p.full_name || p.email); }
}

async function saveProfile() {
  const full_name = document.getElementById('p-name').value.trim();
  const company = document.getElementById('p-company').value.trim();
  await sb.from('profiles').update({ full_name, company }).eq('id', currentUser.id);
  currentProfile = { ...currentProfile, full_name, company };
  updateNavState();
  showToast('Perfil atualizado!', 'success');
}

async function uploadAvatar(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 2097152) return showToast('Imagem muito grande. Máx 2MB.', 'error');
  showToast('Enviando foto...');
  const ext = file.name.split('.').pop();
  const path = `${currentUser.id}/avatar.${ext}`;
  await sb.storage.from('avatars').remove([path]).catch(() => {});
  const { error } = await sb.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
  if (error) { return showToast('Erro no upload: ' + error.message, 'error'); }
  const { data: { publicUrl } } = sb.storage.from('avatars').getPublicUrl(path);
  await sb.from('profiles').update({ avatar_url: publicUrl }).eq('id', currentUser.id);
  const urlDisplay = publicUrl + '?t=' + Date.now();
  currentProfile = { ...currentProfile, avatar_url: publicUrl };
  setAvatar('nav-av', urlDisplay, getInitials(currentProfile.full_name || currentProfile.email));
  setAvatar('d-av', urlDisplay, getInitials(currentProfile.full_name || currentProfile.email));
  const big = document.getElementById('profile-avatar-big');
  if (big) { big.innerHTML = `<img src="${urlDisplay}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`; }
  showToast('Foto atualizada!', 'success');
}

async function loadNotifPrefs() {
  const { data } = await sb.from('email_preferences').select('*').eq('user_id', currentUser.id).single();
  if (data) {
    document.getElementById('pref-status').checked = data.notify_status_change !== false;
    document.getElementById('pref-message').checked = data.notify_new_message !== false;
    document.getElementById('pref-project').checked = data.notify_project_update !== false;
  }
}

async function savePref(field, value) {
  await sb.from('email_preferences').upsert({ user_id: currentUser.id, [field]: value }, { onConflict: 'user_id' });
  showToast('Preferência salva!', 'success');
}

// ── Admin contacts ────────────────────────────────────────────────────────
async function loadAdminContacts() {
  const tbody = document.getElementById('d-admin-contacts');
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--gray)"><span class="loader-sm loader-sm-w"></span> Carregando...</td></tr>`;
  const { data, error } = await sb.from('contacts').select('*,profiles(full_name,email)').order('created_at', { ascending: false });
  if (error) { tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>Erro: ${escHtml(error.message)}</div></td></tr>`; return; }
  const { data: unreadMsgs } = await sb.from('messages').select('contact_id').eq('read_by_admin', false);
  const unreadMap = {};
  unreadMsgs?.forEach(m => { unreadMap[m.contact_id] = (unreadMap[m.contact_id] || 0) + 1; });
  tbody.innerHTML = !data?.length
    ? `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg></div>Nenhum contato.</div></td></tr>`
    : data.map(c => {
        const unread = unreadMap[c.id] || 0;
        const badge = unread > 0 ? `<span style="position:absolute;top:-6px;right:-6px;background:var(--red);color:#fff;font-size:0.6rem;font-weight:700;min-width:16px;height:16px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;padding:0 3px">${unread > 9 ? '+9' : unread}</span>` : '';
        return `<tr>
          <td>${escHtml(c.profiles?.full_name || c.profiles?.email || '—')}</td>
          <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(c.subject)}</td>
          <td>${chLabel(c.channel)}</td><td>${stBadge(c.status)}</td>
          <td style="color:var(--gray);white-space:nowrap">${fmtDate(c.created_at)}</td>
          <td style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="dbtn-sm" style="position:relative" onclick="adminOpenChat(this)" data-id="${c.id}" data-subject="${escHtml(c.subject)}">Chat${badge}</button>
            <button class="dbtn-sm" style="color:var(--red);border-color:rgba(248,113,113,0.2)" onclick="adminDeleteContact(this)" data-id="${c.id}" data-subject="${escHtml(c.subject)}">Remover</button>
          </td>
        </tr>`;
      }).join('');
}

function adminOpenChat(btn) {
  const id = btn.dataset.id, subject = btn.dataset.subject;
  const badge = btn.querySelector('span');
  if (badge) badge.remove();
  sb.from('messages').update({ read_by_admin: true }).eq('contact_id', id).eq('read_by_admin', false);
  openThread(id, subject);
}

function adminDeleteContact(btn) {
  document.getElementById('del-id').value = btn.dataset.id;
  document.getElementById('del-subject').textContent = '"' + btn.dataset.subject + '"';
  document.getElementById('deleteConfirm').classList.add('open');
}

function openEditContact(id, status, notes) {
  document.getElementById('ec-id').value = id;
  document.getElementById('ec-status').value = status;
  document.getElementById('ec-notes').value = notes;
  document.getElementById('editContact').classList.add('open');
}

async function saveContact() {
  const id = document.getElementById('ec-id').value;
  const status = document.getElementById('ec-status').value;
  const admin_notes = document.getElementById('ec-notes').value;
  await sb.from('contacts').update({ status, admin_notes }).eq('id', id);
  closeEdit('editContact');
  loadAdminContacts();
  showToast('Contato atualizado!', 'success');
}

async function confirmDelete() {
  const id = document.getElementById('del-id').value;
  await sb.from('contacts').delete().eq('id', id);
  closeEdit('deleteConfirm');
  loadAdminContacts();
  showToast('Contato removido.', 'success');
}

// ── Admin clients ─────────────────────────────────────────────────────────
async function loadAdminClients() {
  const { data } = await sb.from('profiles').select('*').order('created_at', { ascending: false });
  const tbody = document.getElementById('d-admin-clients');
  tbody.innerHTML = !data?.length
    ? `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>Nenhum cliente.</div></td></tr>`
    : data.map(c => {
        const avatarEl = c.avatar_url
          ? `<img src="${c.avatar_url}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:1px solid var(--border)"/>`
          : `<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#333,#555);display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:500;color:#fff;flex-shrink:0">${getInitials(c.full_name || c.email)}</div>`;
        return `<tr>
          <td><div style="display:flex;align-items:center;gap:10px">${avatarEl}<span>${escHtml(c.full_name || '—')}</span></div></td>
          <td style="color:var(--gray)">${escHtml(c.email)}</td>
          <td style="color:var(--gray)">${escHtml(c.company || '—')}</td>
          <td><span class="role-pill ${c.role === 'admin' ? 'role-admin' : 'role-client'}">${c.role === 'admin' ? 'Admin' : 'Cliente'}</span></td>
          <td style="color:var(--gray);white-space:nowrap">${fmtDate(c.created_at)}</td>
          <td><button class="dbtn-sm" data-id="${c.id}" data-role="${c.role}" onclick="openEditRole(this.dataset.id,this.dataset.role)">Alterar</button>
          ${c.role !== 'admin' ? `<button class="dbtn-sm" style="margin-left:4px" data-id="${c.id}" data-name="${escHtml(c.full_name || c.email)}" onclick="adminStartChat(this)">Chat</button>` : ''}</td>
        </tr>`;
      }).join('');
}

function openEditRole(id, role) {
  document.getElementById('er-id').value = id;
  document.getElementById('er-role').value = role;
  document.getElementById('editRole').classList.add('open');
}

async function saveRole() {
  const id = document.getElementById('er-id').value, role = document.getElementById('er-role').value;
  await sb.from('profiles').update({ role }).eq('id', id);
  closeEdit('editRole');
  loadAdminClients();
  showToast('Função atualizada!', 'success');
}

function adminStartChat(btn) {
  document.getElementById('asc-client-id').value = btn.dataset.id;
  document.getElementById('asc-name').textContent = btn.dataset.name;
  document.getElementById('asc-subject').value = '';
  document.getElementById('asc-message').value = '';
  document.getElementById('adminStartChatModal').classList.add('open');
}

async function confirmAdminStartChat() {
  const clientId = document.getElementById('asc-client-id').value;
  const subject = document.getElementById('asc-subject').value.trim();
  const message = document.getElementById('asc-message').value.trim();
  if (!subject || !message) return showToast('Preencha o assunto e a mensagem.', 'error');
  const { data: contact, error } = await sb.from('contacts').insert({ client_id: clientId, subject, message, channel: 'support' }).select().single();
  if (error) return showToast('Erro ao criar contato: ' + error.message, 'error');
  await sb.from('messages').insert({ contact_id: contact.id, sender_id: currentUser.id, content: message });
  await sb.from('notifications').insert({ user_id: clientId, type: 'new_message', message: `Nova mensagem da Groven: "${subject}"` });
  closeEdit('adminStartChatModal');
  showToast('Conversa iniciada!', 'success');
  setTimeout(() => openThread(contact.id, subject), 300);
}

// ── Admin projects ────────────────────────────────────────────────────────
async function loadAdminProjects() {
  const { data } = await sb.from('projects').select('*,profiles(full_name,email),project_steps(*)').order('created_at', { ascending: false });
  const el = document.getElementById('d-admin-projects-list');
  if (!data?.length) { el.innerHTML = `<div class="empty-state"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg></div>Nenhum projeto.</div>`; return; }
  el.innerHTML = data.map(p => renderAdminProjectCard(p)).join('');
}

async function openNewProject() {
  document.getElementById('project-modal-title').textContent = 'Novo projeto';
  ['ep-id', 'ep-title', 'ep-desc'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('ep-status').value = 'planning';
  document.getElementById('ep-progress').value = 0;
  document.getElementById('ep-deadline').value = '';
  document.getElementById('ep-steps').innerHTML = '';
  const { data: clients } = await sb.from('profiles').select('id,full_name,email').eq('role', 'client');
  document.getElementById('ep-client').innerHTML = clients?.map(c => `<option value="${escHtml(c.id)}">${escHtml(c.full_name || c.email)}</option>`).join('') || '';
  document.getElementById('editProject').classList.add('open');
}

async function openEditProject(id) {
  const { data: p } = await sb.from('projects').select('*,project_steps(*)').eq('id', id).single();
  document.getElementById('project-modal-title').textContent = 'Editar projeto';
  document.getElementById('ep-id').value = p.id;
  document.getElementById('ep-title').value = p.title;
  document.getElementById('ep-desc').value = p.description || '';
  document.getElementById('ep-status').value = p.status;
  document.getElementById('ep-progress').value = p.progress;
  document.getElementById('ep-deadline').value = p.deadline || '';
  const { data: clients } = await sb.from('profiles').select('id,full_name,email').eq('role', 'client');
  document.getElementById('ep-client').innerHTML = clients?.map(c => `<option value="${escHtml(c.id)}"${c.id === p.client_id ? ' selected' : ''}>${escHtml(c.full_name || c.email)}</option>`).join('') || '';
  document.getElementById('ep-steps').innerHTML = '';
  p.project_steps?.sort((a, b) => a.position - b.position).forEach(s => addStepInput(s.title, s.done));
  document.getElementById('editProject').classList.add('open');
}

function addStepInput(title = '', done = false) {
  const div = document.createElement('div');
  div.style = 'display:flex;gap:8px;margin-bottom:8px;align-items:center';
  div.innerHTML = `<input class="dash-input" type="text" placeholder="Nome da etapa" value="${escHtml(title)}" style="flex:1"/><label style="display:flex;align-items:center;gap:4px;font-size:0.78rem;color:var(--gray);cursor:pointer;white-space:nowrap"><input type="checkbox" ${done ? 'checked' : ''}/> Feita</label><button class="dbtn-sm" style="color:var(--red);border-color:rgba(248,113,113,0.2)" onclick="this.parentElement.remove()">✕</button>`;
  document.getElementById('ep-steps').appendChild(div);
}

async function saveProject() {
  const id = document.getElementById('ep-id').value, client_id = document.getElementById('ep-client').value;
  const title = document.getElementById('ep-title').value.trim(), description = document.getElementById('ep-desc').value.trim();
  const status = document.getElementById('ep-status').value;
  const progress = parseInt(document.getElementById('ep-progress').value) || 0;
  const deadline = document.getElementById('ep-deadline').value || null;
  if (!title) return showToast('Informe o título.', 'error');
  let projectId = id;
  if (id) { await sb.from('projects').update({ client_id, title, description, status, progress, deadline }).eq('id', id); }
  else { const { data } = await sb.from('projects').insert({ client_id, title, description, status, progress, deadline }).select().single(); projectId = data.id; }
  await sb.from('project_steps').delete().eq('project_id', projectId);
  const stepEls = document.getElementById('ep-steps').querySelectorAll('div');
  for (let i = 0; i < stepEls.length; i++) {
    const t = stepEls[i].querySelector('input[type="text"]')?.value.trim();
    const d = stepEls[i].querySelector('input[type="checkbox"]')?.checked || false;
    if (t) await sb.from('project_steps').insert({ project_id: projectId, title: t, done: d, position: i });
  }
  if (client_id) { await sb.from('notifications').insert({ user_id: client_id, type: 'project_update', message: `Seu projeto "${title}" foi atualizado!` }); }
  closeEdit('editProject');
  loadAdminProjects();
  showToast('Projeto salvo!', 'success');
}

// ── Contact form ──────────────────────────────────────────────────────────
async function sendContactForm() {
  const name = document.getElementById('cf-name').value.trim();
  const email = document.getElementById('cf-email').value.trim();
  const subject = document.getElementById('cf-subject').value.trim();
  const message = document.getElementById('cf-message').value.trim();
  const status = document.getElementById('cf-status');
  const btn = document.getElementById('cf-send');
  if (!name || !email || !subject || !message) {
    status.textContent = '⚠ Preencha todos os campos.';
    status.style.color = 'var(--yellow)';
    status.style.display = 'inline';
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    status.textContent = '⚠ Digite um e-mail válido.';
    status.style.color = 'var(--yellow)';
    status.style.display = 'inline';
    return;
  }
  btn.disabled = true;
  btn.innerHTML = '<span class="loader-sm"></span>Enviando...';
  status.style.display = 'none';
  try {
    const res = await fetch(`${SUPA_URL}/functions/v1/send-contact-email`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, subject, message }) });
    const data = await res.json();
    if (data.success) {
      status.textContent = '✓ Mensagem enviada! Retornaremos em breve.';
      status.style.color = 'var(--green)';
      status.style.display = 'inline';
      ['cf-name', 'cf-email', 'cf-subject', 'cf-message'].forEach(id => document.getElementById(id).value = '');
    } else throw new Error(data.error || 'Erro');
  } catch (e) {
    status.textContent = '✕ Erro ao enviar. Tente pelo WhatsApp.';
    status.style.color = 'var(--red)';
    status.style.display = 'inline';
  }
  btn.disabled = false;
  btn.innerHTML = 'Enviar mensagem';
}

// ── Helpers ───────────────────────────────────────────────────────────────
function closeEdit(id) { document.getElementById(id).classList.remove('open'); }

function setBtnLoad(id, loading, label) {
  const b = document.getElementById(id);
  if (!b) return;
  if (loading) { if (!b.dataset.orig) b.dataset.orig = b.textContent.trim(); b.disabled = true; b.innerHTML = `<span class="loader-sm"></span>${label}`; }
  else { b.disabled = false; b.innerHTML = b.dataset.orig || label; }
}

function showAuthError(msg) { const e = document.getElementById('auth-error'); e.textContent = msg; e.style.display = 'block'; document.getElementById('auth-success').style.display = 'none'; }
function showAuthSuccess(msg) { const e = document.getElementById('auth-success'); e.textContent = msg; e.style.display = 'block'; document.getElementById('auth-error').style.display = 'none'; }
function clearAuthMsgs() { document.getElementById('auth-error').style.display = 'none'; document.getElementById('auth-success').style.display = 'none'; }
function fmtDate(s) { return new Date(s).toLocaleDateString('pt-BR'); }
function timeAgo(s) { const d = Date.now() - new Date(s), m = Math.floor(d / 60000); if (m < 1) return 'agora'; if (m < 60) return `${m}min`; const h = Math.floor(m / 60); if (h < 24) return `${h}h`; return `${Math.floor(h / 24)}d`; }
function chLabel(c) { return { email: 'E-mail', whatsapp: 'WhatsApp', other: 'Outro', support: 'Suporte' }[c] || c; }
function stBadge(s) { const m = { open: ['dbadge-open', 'Aberto'], in_progress: ['dbadge-progress', 'Em andamento'], resolved: ['dbadge-resolved', 'Resolvido'] }; const [cls, lbl] = m[s] || ['', '']; return `<span class="dbadge ${cls}">● ${lbl}</span>`; }
function fileIcon(m) {
  if (m && m.startsWith('image')) return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
  if (m && m.includes('pdf')) return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
  if (m && (m.includes('sheet') || m.includes('excel'))) return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>';
  if (m && m.includes('word')) return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
  return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>';
}
function formatBytes(b) { if (!b) return ''; if (b < 1024) return b + 'B'; if (b < 1048576) return (b / 1024).toFixed(1) + 'KB'; return (b / 1048576).toFixed(1) + 'MB'; }
function escHtml(s) { if (!s) return ''; return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

let toastTimer;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

function openLegalModal(id) { const el = document.getElementById(id); if (el) { el.style.display = 'block'; document.body.style.overflow = 'hidden'; el.scrollTop = 0; } }
function closeLegalModal(id) { const el = document.getElementById(id); if (el) { el.style.display = 'none'; document.body.style.overflow = ''; } }

// ── Chatbot ───────────────────────────────────────────────────────────────
const CB_FAQ = [
  { q: ['orçamento','orcamento','quanto custa','preço','preco','valor','custo'], a: 'O orçamento é baseado na complexidade do projeto e na infraestrutura da sua empresa. Cada proposta é personalizada — entre em contato e montamos um orçamento negociável para você.' },
  { q: ['prazo','entrega','demora','tempo','quando fica pronto'], a: 'O prazo varia conforme a complexidade do projeto. Mas garantimos retorno em até 24h após o primeiro contato para já começarmos a conversa.' },
  { q: ['serviços','servicos','oferece','faz','produto','erp','crm','site','automação','automacao'], a: 'A Groven oferece: ERP para microempresas, CRM automatizado, criação de sites e automações em geral. Tudo depende do seu pedido — trabalhamos de forma personalizada.' },
  { q: ['contratar','como começo','começo','inicio','começar'], a: 'Simples: entre em contato via e-mail ou WhatsApp com o seu pedido. Trazemos um prazo estimado e um orçamento negociável para você.' },
  { q: ['porte','tamanho','empresa','microempresa','pequena','autonomo','autônomo'], a: 'Estamos começando com foco em microempresas e pequenos servidores autônomos. Se você está começando ou quer crescer, a Groven é para você.' },
  { q: ['manutenção','manutencao','atualização','atualizacao','suporte','depois'], a: 'Sim, fazemos manutenção e atualizações após a entrega. É só manter o contato com a gente.' },
  { q: ['pagamento','pagar','pix','cartão','cartao','boleto'], a: 'Aceitamos Pix e cartões. Os detalhes são combinados no momento do fechamento do contrato.' },
  { q: ['técnico','tecnico','conhecimento','programar','saber','difícil'], a: 'Nenhum conhecimento técnico é necessário. A única coisa que você precisa ter é vontade de crescer — o resto é com a gente.' },
  { q: ['site','criar site','como funciona site','desenvolvimento'], a: 'Os sites são desenvolvidos com base em raciocínio lógico humano e refinados com auxílio de IA. O resultado é um site profissional, personalizado e pronto para converter.' },
  { q: ['olá','ola','oi','bom dia','boa tarde','boa noite'], a: 'Olá! Sou o assistente da Groven. Posso responder dúvidas sobre nossos serviços, prazos, orçamentos e muito mais. Como posso ajudar?' }
];

let cbHistory = [], cbOpen = false, cbInitialized = false, cbEscalated = false;

function toggleChat() {
  cbOpen = !cbOpen;
  const win = document.getElementById('cbWindow');
  const icon = document.getElementById('cbBtnIcon');
  win.classList.toggle('open', cbOpen);
  icon.innerHTML = cbOpen
    ? '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
    : '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  document.getElementById('cbBadge').classList.remove('show');
  if (cbOpen && !cbInitialized) {
    cbInitialized = true;
    setTimeout(() => addCbMsg('bot', 'Olá! Sou o assistente da Groven. Posso ajudar com dúvidas sobre nossos serviços, prazos e orçamentos. Como posso ajudar?'), 400);
  }
  if (cbOpen) document.getElementById('cbInput').focus();
}

function addCbMsg(type, text) {
  const el = document.getElementById('cbMessages');
  const div = document.createElement('div');
  div.className = `cb-msg ${type}`;
  div.textContent = text;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

function showCbTyping() {
  const el = document.getElementById('cbMessages');
  const t = document.createElement('div');
  t.className = 'cb-typing show'; t.id = 'cbTyping';
  t.innerHTML = '<span></span><span></span><span></span>';
  el.appendChild(t); el.scrollTop = el.scrollHeight;
}

function hideCbTyping() { const t = document.getElementById('cbTyping'); if (t) t.remove(); }

function askSuggestion(text) {
  document.getElementById('cbInput').value = text;
  sendChatbotMsg();
  document.getElementById('cbSuggestions').style.display = 'none';
}

function getFaqAnswer(text) {
  const lower = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const faq of CB_FAQ) {
    if (faq.q.some(k => lower.includes(k.normalize('NFD').replace(/[̀-ͯ]/g, '')))) return faq.a;
  }
  return null;
}

async function sendChatbotMsg() {
  const input = document.getElementById('cbInput');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  document.getElementById('cbSend').disabled = true;
  document.getElementById('cbSuggestions').style.display = 'none';
  addCbMsg('user', text);
  cbHistory.push({ role: 'user', content: text });
  const faqAnswer = getFaqAnswer(text);
  if (faqAnswer) {
    showCbTyping();
    await new Promise(r => setTimeout(r, 700));
    hideCbTyping();
    addCbMsg('bot', faqAnswer);
    cbHistory.push({ role: 'assistant', content: faqAnswer });
    document.getElementById('cbSend').disabled = false;
    return;
  }
  showCbTyping();
  try {
    const res = await fetch(`${SUPA_URL}/functions/v1/claude-chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: cbHistory }) });
    const data = await res.json();
    hideCbTyping();
    const reply = data.content?.[0]?.text || 'Não entendi. Posso te encaminhar para nossa equipe.';
    if (reply.includes('[ESCALAR]') || !data.content) {
      addCbMsg('bot', reply.replace('[ESCALAR]', '').trim() || 'Vou encaminhar para nossa equipe.');
      escalatePrompt();
    } else {
      addCbMsg('bot', reply);
      cbHistory.push({ role: 'assistant', content: reply });
    }
  } catch (e) {
    hideCbTyping();
    addCbMsg('bot', 'Não consegui processar. Tente falar diretamente com nossa equipe.');
    escalatePrompt();
  }
  document.getElementById('cbSend').disabled = false;
}

function escalatePrompt() { if (!cbEscalated) { cbEscalated = true; document.getElementById('cbEscalate').style.display = 'block'; } }

// ── Portfolio carousel ────────────────────────────────────────────────────
let pfIdx = 0;
function pfGo(idx) {
  const cards = document.querySelectorAll('.pf-track .pf-card');
  pfIdx = Math.max(0, Math.min(cards.length - 1, idx));
  const track = document.getElementById('pfTrack');
  const carousel = document.querySelector('.pf-carousel');
  if (track && carousel) track.style.transform = `translateX(-${pfIdx * carousel.offsetWidth}px)`;
  document.querySelectorAll('.pf-dot').forEach((d, i) => d.classList.toggle('active', i === pfIdx));
}
function pfNav(dir) {
  const count = document.querySelectorAll('.pf-track .pf-card').length;
  pfGo((pfIdx + dir + count) % count);
}
// Swipe support
(function() {
  const carousel = document.querySelector('.pf-carousel');
  if (!carousel) return;
  let sx = 0;
  carousel.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
  carousel.addEventListener('touchend', e => {
    const dx = sx - e.changedTouches[0].clientX;
    if (Math.abs(dx) > 48) pfNav(dx > 0 ? 1 : -1);
  }, { passive: true });
})();

// ── Portfolio iframe scroll ───────────────────────────────────────────────
(function initPortfolioScroll() {
  document.querySelectorAll('.pf-frame-wrap').forEach(wrap => {
    const iframe = wrap.querySelector('.pf-iframe');
    const overlay = wrap.querySelector('.pf-overlay');
    if (!iframe || !overlay) return;
    let scrollY = 0;
    function scale() { return wrap.clientWidth / 1440; }
    function applyScroll() {
      const sc = scale();
      const max = Math.max(0, iframe.offsetHeight * sc - wrap.clientHeight);
      scrollY = Math.max(0, Math.min(max, scrollY));
      iframe.style.transform = `scale(${sc}) translateY(-${scrollY / sc}px)`;
    }
    overlay.addEventListener('wheel', e => { e.preventDefault(); scrollY += e.deltaY; applyScroll(); }, { passive: false });
    let lastTY = 0;
    overlay.addEventListener('touchstart', e => { lastTY = e.touches[0].clientY; }, { passive: true });
    overlay.addEventListener('touchmove', e => { e.preventDefault(); scrollY += lastTY - e.touches[0].clientY; lastTY = e.touches[0].clientY; applyScroll(); }, { passive: false });
    window.addEventListener('resize', () => { applyScroll(); });
    applyScroll();
  });
})();

// ── Portfolio iframe scale ────────────────────────────────────────────────
function updatePfScale() {
  const isMobile = window.innerWidth <= 768;
  const iframeW = isMobile ? 768 : 1440;
  const iframeH = isMobile ? 1100 : 900;
  document.querySelectorAll('.pf-frame-wrap').forEach(wrap => {
    const iframe = wrap.querySelector('.pf-iframe');
    if (!iframe) return;
    iframe.style.width = iframeW + 'px';
    iframe.style.height = iframeH + 'px';
    const scale = wrap.offsetWidth / iframeW;
    iframe.style.transform = `scale(${scale})`;
    iframe.style.transformOrigin = 'top left';
    wrap.style.height = (iframeH * scale) + 'px';
  });
  const track = document.getElementById('pfTrack');
  const carousel = document.querySelector('.pf-carousel');
  if (track && carousel) track.style.transform = `translateX(-${pfIdx * carousel.offsetWidth}px)`;
}
window.addEventListener('load', updatePfScale);
window.addEventListener('resize', updatePfScale);

// ── DOM event listeners ───────────────────────────────────────────────────
document.getElementById('authOverlay').addEventListener('click', e => { if (e.target === document.getElementById('authOverlay')) closeAuth(); });
document.querySelectorAll('.edit-overlay').forEach(el => el.addEventListener('click', e => { if (e.target === el && el.id !== 'modalThread') el.classList.remove('open'); }));

const hamburger = document.getElementById('hamburger'), mobileMenu = document.getElementById('mobileMenu');
hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('open');
  mobileMenu.classList.toggle('open');
  document.body.style.overflow = mobileMenu.classList.contains('open') ? 'hidden' : '';
});
document.querySelectorAll('.mobile-link').forEach(l => l.addEventListener('click', () => {
  hamburger.classList.remove('open');
  mobileMenu.classList.remove('open');
  document.body.style.overflow = '';
}));

const obs = new IntersectionObserver((entries) => {
  entries.forEach((e, i) => { if (e.isIntersecting) setTimeout(() => e.target.classList.add('visible'), i * 80); });
}, { threshold: 0.05 });
document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
setTimeout(() => { document.querySelectorAll('.reveal:not(.visible)').forEach(el => el.classList.add('visible')); }, 2000);

document.querySelectorAll('.feature-card').forEach(c => {
  c.addEventListener('mousemove', e => {
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
    c.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
  });
});

// ── Window exports (inline onclick handlers) ──────────────────────────────
Object.assign(window, {
  openAuth, closeAuth, scrollToSection, closeDash, openDash, doLogout,
  toggleNotif, markAllRead, readNotif,
  switchAuthTab, handleCtaClick,
  showDashPage, showAdminPage,
  sendContact, clientOpenChat, adminOpenChat, adminDeleteContact, openEditContact,
  openEditRole, adminStartChat, confirmAdminStartChat,
  closeThread, sendChatMessage, uploadAttachments,
  openLegalModal, closeLegalModal,
  closeEdit, saveContact, confirmDelete,
  saveRole, openNewProject, openEditProject, addStepInput, saveProject,
  saveProfile, uploadAvatar, savePref,
  toggleChat, askSuggestion, sendChatbotMsg,
  sendContactForm,
  pfNav, pfGo,
});
