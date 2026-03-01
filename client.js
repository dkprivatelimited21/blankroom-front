/* BlankRoom — client.js */

// ── SOCKET INIT ──
// On Vercel: BACKEND_URL is injected into index.html at build time.
// Locally: defaults to same origin (relative).
const BACKEND = window.BACKEND_URL || '';
const socket = io(BACKEND, {
  transports: ['websocket', 'polling'],
  withCredentials: true,
});

// ── STATE ──
let nickname = 'You';
let currentPage = 'landing';
let chatMode = null;
let inPair = false;
let currentRoom = null;
let reportTarget = null;

// ── UTILS ──
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  currentPage = id;
}

function appendMessage(boxId, who, text, cls) {
  const box = document.getElementById(boxId);
  const msg = document.createElement('div');
  msg.className = 'msg ' + (cls || who);

  if (cls === 'system') {
    msg.textContent = text;
  } else {
    const bubble = document.createElement('div');
    bubble.className = 'bubble';

    // In group chat, show sender name above stranger bubbles
    if (cls === 'stranger' && boxId === 'messages-group') {
      const sender = document.createElement('div');
      sender.className = 'sender';
      sender.textContent = who;
      bubble.appendChild(sender);
    }

    bubble.appendChild(document.createTextNode(text));
    msg.appendChild(bubble);
  }

  box.appendChild(msg);
  box.scrollTop = box.scrollHeight;
}

function sysMsg(boxId, text) {
  appendMessage(boxId, null, text, 'system');
}

function clearMessages(id) {
  document.getElementById(id).innerHTML = '';
}

// ── LANDING ──
document.getElementById('btn-1v1').addEventListener('click', () => {
  if (!document.getElementById('age-check').checked) {
    alert('You must confirm you are 18 or older.');
    return;
  }
  const nick = document.getElementById('nickname-input').value.trim();
  nickname = nick || 'You';
  socket.emit('set_nickname', { nickname });
  showPage('1v1');
  chatMode = '1v1';
  startSearch();
});

document.getElementById('btn-group').addEventListener('click', () => {
  if (!document.getElementById('age-check').checked) {
    alert('You must confirm you are 18 or older.');
    return;
  }
  const nick = document.getElementById('nickname-input').value.trim();
  nickname = nick || 'Stranger';
  socket.emit('set_nickname', { nickname });
  showPage('group');
  chatMode = 'group';
  socket.emit('get_rooms');
});

// ── 1v1 CHAT ──
function startSearch() {
  inPair = false;
  setStatus1v1('Searching for a stranger...');
  setInput1v1(false);
  clearMessages('messages-1v1');
  socket.emit('find_stranger');
}

function setStatus1v1(text) {
  document.getElementById('status-1v1').textContent = text;
}

function setInput1v1(enabled) {
  document.getElementById('input-1v1').disabled = !enabled;
  document.getElementById('btn-send-1v1').disabled = !enabled;
  if (enabled) document.getElementById('input-1v1').focus();
}

document.getElementById('btn-send-1v1').addEventListener('click', send1v1);
document.getElementById('input-1v1').addEventListener('keydown', e => {
  if (e.key === 'Enter') send1v1();
});

function send1v1() {
  const input = document.getElementById('input-1v1');
  const msg = input.value.trim();
  if (!msg || !inPair) return;
  socket.emit('send_message_1v1', { message: msg });
  input.value = '';
}

document.getElementById('btn-end-1v1').addEventListener('click', () => {
  socket.emit('end_chat');
  inPair = false;
  setInput1v1(false);
  setStatus1v1('Chat ended.');
  sysMsg('messages-1v1', 'You ended the chat.');
});

document.getElementById('btn-new-1v1').addEventListener('click', startSearch);

document.getElementById('btn-back-1v1').addEventListener('click', () => {
  socket.emit('end_chat');
  showPage('landing');
});

document.getElementById('btn-report-1v1').addEventListener('click', () => openReport('1v1'));

// ── 1v1 SOCKET EVENTS ──
socket.on('searching', () => {
  setStatus1v1('Searching for a stranger...');
  sysMsg('messages-1v1', 'Looking for someone to chat with...');
});

socket.on('paired', (data) => {
  inPair = true;
  setStatus1v1(data.message);
  sysMsg('messages-1v1', data.message);
  setInput1v1(true);
});

socket.on('message_1v1', (data) => {
  if (data.from === 'you') {
    appendMessage('messages-1v1', nickname, data.text, 'you');
  } else {
    appendMessage('messages-1v1', 'Stranger', data.text, 'stranger');
  }
});

socket.on('stranger_left', () => {
  inPair = false;
  setInput1v1(false);
  setStatus1v1('Stranger disconnected.');
  sysMsg('messages-1v1', 'Stranger has disconnected.');
});

socket.on('chat_ended', () => {
  inPair = false;
  setInput1v1(false);
  setStatus1v1('Chat ended.');
});

// ── GROUP CHAT ──
socket.on('rooms_list', (rooms) => renderRoomList(rooms));
socket.on('rooms_updated', (rooms) => {
  if (currentPage === 'group' && !currentRoom) renderRoomList(rooms);
});

function renderRoomList(rooms) {
  const list = document.getElementById('room-list');
  list.innerHTML = '';
  if (rooms.length === 0) {
    list.innerHTML = '<div class="no-rooms">No active rooms. Create one above.</div>';
    return;
  }
  rooms.forEach(r => {
    const item = document.createElement('div');
    item.className = 'room-item';
    item.innerHTML = `<span>${escHtml(r.name)} <span class="room-count">(${r.count})</span></span><button>Join</button>`;
    item.querySelector('button').addEventListener('click', () => joinRoom(r.name));
    list.appendChild(item);
  });
}

function joinRoom(name) {
  currentRoom = name;
  socket.emit('join_room', { room: name });
}

document.getElementById('btn-join-room').addEventListener('click', () => {
  const name = document.getElementById('room-name-input').value.trim();
  if (!name) { alert('Enter a room name.'); return; }
  joinRoom(name);
});

document.getElementById('room-name-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-join-room').click();
});

socket.on('room_joined', (data) => {
  document.getElementById('room-selector').style.display = 'none';
  const msgBox = document.getElementById('messages-group');
  msgBox.style.display = 'flex';
  msgBox.style.flexDirection = 'column';
  document.getElementById('group-input-row').style.display = 'flex';
  document.getElementById('btn-leave-room').style.display = 'inline-block';
  document.getElementById('status-group').textContent = `#${data.room} (${data.count} online)`;
  clearMessages('messages-group');
});

socket.on('room_message', (data) => {
  if (data.from === 'system') {
    sysMsg('messages-group', data.text);
  } else {
    const isMe = data.selfId === socket.id;
    appendMessage('messages-group', isMe ? nickname : data.from, data.text, isMe ? 'you' : 'stranger');
  }
});

document.getElementById('btn-send-group').addEventListener('click', sendGroup);
document.getElementById('input-group').addEventListener('keydown', e => {
  if (e.key === 'Enter') sendGroup();
});

function sendGroup() {
  const input = document.getElementById('input-group');
  const msg = input.value.trim();
  if (!msg) return;
  socket.emit('send_message_group', { message: msg });
  input.value = '';
  input.focus();
}

document.getElementById('btn-leave-room').addEventListener('click', leaveRoom);

function leaveRoom() {
  currentRoom = null;
  socket.emit('join_room', { room: '__none__' });
  document.getElementById('room-selector').style.display = 'block';
  document.getElementById('messages-group').style.display = 'none';
  document.getElementById('group-input-row').style.display = 'none';
  document.getElementById('btn-leave-room').style.display = 'none';
  document.getElementById('status-group').textContent = 'Group Chat';
  document.getElementById('room-name-input').value = '';
  socket.emit('get_rooms');
}

document.getElementById('btn-back-group').addEventListener('click', () => {
  if (currentRoom) leaveRoom();
  showPage('landing');
});

document.getElementById('btn-report-group').addEventListener('click', () => openReport('group'));

// ── RATE LIMIT NOTICE ──
socket.on('rate_limited', (data) => {
  sysMsg(currentPage === '1v1' ? 'messages-1v1' : 'messages-group', `⚠ ${data.message}`);
});

// ── REPORT ──
function openReport(mode) {
  reportTarget = mode;
  document.getElementById('report-modal').style.display = 'flex';
}

document.getElementById('btn-submit-report').addEventListener('click', () => {
  const reason = document.getElementById('report-reason').value;
  socket.emit('report_user', { targetId: reportTarget, reason });
  document.getElementById('report-modal').style.display = 'none';
});

document.getElementById('btn-cancel-report').addEventListener('click', () => {
  document.getElementById('report-modal').style.display = 'none';
});

socket.on('report_received', () => alert('Report submitted. Thank you.'));

document.getElementById('report-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
});

// ── HELPERS ──
function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
