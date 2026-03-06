/* BlankRoom — client.js */

// ── SOCKET INIT with better Instagram compatibility ──
const BACKEND = window.BACKEND_URL || '';
const socket = io(BACKEND, {
  transports: ['websocket', 'polling'],
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 20000,
});

// ── STATE ──
let nickname = 'You';
let currentPage = 'landing';
let chatMode = null;
let inPair = false;
let currentRoom = null;
let reportTarget = null;
let strangerName = 'Stranger';

// ── RANDOM NAME GENERATORS ──
const adjectives = ['Happy', 'Sleepy', 'Hungry', 'Clever', 'Brave', 'Swift', 'Wild', 'Calm', 'Bold', 'Wise', 'Kind', 'Bright', 'Mystic', 'Silent', 'Gentle', 'Wandering', 'Cosmic', 'Solar', 'Lunar', 'Shadow', 'Misty', 'Crimson', 'Azure', 'Emerald'];
const nouns = ['Panda', 'Tiger', 'Eagle', 'Fox', 'Wolf', 'Bear', 'Owl', 'Dolphin', 'Lion', 'Deer', 'Hawk', 'Falcon', 'Phoenix', 'Raven', 'Dragon', 'Whale', 'Koala', 'Lynx', 'Hedgehog', 'Otter', 'Panther', 'Coyote', 'Hawk', 'Falcon'];
const strangerPrefixes = ['Mysterious', 'Wandering', 'Silent', 'Random', 'Curious', 'Anonymous', 'Secret', 'Hidden', 'Friendly', 'Quiet'];

function generateRandomName() {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 1000);
  return `${adj}${noun}${num}`;
}

function generateStrangerName() {
  const prefix = strangerPrefixes[Math.floor(Math.random() * strangerPrefixes.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${prefix}${noun}`;
}

// Set default random name if input is empty
function getEffectiveNickname(inputValue) {
  return inputValue.trim() || generateRandomName();
}

// ── UTILS ──
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
    p.style.opacity = '0';
  });
  
  const newPage = document.getElementById('page-' + id);
  newPage.classList.add('active');
  setTimeout(() => {
    newPage.style.opacity = '1';
  }, 50);
  
  currentPage = id;
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// FIXED: Timestamp now shows outside the bubble
function appendMessage(boxId, who, text, cls, data = {}) {
  const box = document.getElementById(boxId);
  const msg = document.createElement('div');
  msg.className = `msg ${cls || who}`;
  msg.dataset.messageId = data.messageId || '';
  
  // Add fade-in animation
  msg.style.animation = 'msgIn 0.2s ease forwards';

  if (cls === 'system') {
    msg.textContent = text;
  } else {
    // Create message container
    const msgContainer = document.createElement('div');
    msgContainer.className = 'message-container';
    
    // Add sender name for stranger messages in group chat
    if (cls === 'stranger' && boxId === 'messages-group') {
      const senderSpan = document.createElement('span');
      senderSpan.className = 'msg-sender';
      senderSpan.textContent = who;
      msgContainer.appendChild(senderSpan);
    }
    
    // Create bubble with text only (no timestamp inside)
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = text;
    msgContainer.appendChild(bubble);
    
    msg.appendChild(msgContainer);
    
    // Add timestamp as separate element outside bubble
    const timeSpan = document.createElement('span');
    timeSpan.className = 'msg-time';
    timeSpan.textContent = formatTime(data.timestamp || Date.now());
    msg.appendChild(timeSpan);
  }

  box.appendChild(msg);
  box.scrollTop = box.scrollHeight;
}

function sysMsg(boxId, text) {
  appendMessage(boxId, null, text, 'system');
}

function clearMessages(id) {
  const box = document.getElementById(id);
  box.style.opacity = '0';
  setTimeout(() => {
    box.innerHTML = '';
    box.style.opacity = '1';
  }, 200);
}

// ── CONNECTION STATUS ──
socket.on('connect', () => {
  console.log('Connected to server');
  if (currentPage === 'landing') {
    if (chatMode === 'group') {
      socket.emit('get_rooms');
    }
  }
});

socket.on('disconnect', () => {
  sysMsg(currentPage === '1v1' ? 'messages-1v1' : 'messages-group', '⚠ Disconnected from server. Reconnecting...');
});

socket.on('reconnect', () => {
  sysMsg(currentPage === '1v1' ? 'messages-1v1' : 'messages-group', '✅ Reconnected!');
  if (chatMode === '1v1' && inPair) {
    socket.emit('find_stranger');
  } else if (chatMode === 'group' && currentRoom) {
    socket.emit('join_room', { room: currentRoom });
  }
});

// ── LANDING ──
document.getElementById('btn-1v1').addEventListener('click', () => {
  if (!document.getElementById('age-check').checked) {
    alert('You must confirm you are 18 or older.');
    return;
  }
  const inputNick = document.getElementById('nickname-input').value;
  nickname = getEffectiveNickname(inputNick);
  strangerName = generateStrangerName();
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
  const inputNick = document.getElementById('nickname-input').value;
  nickname = getEffectiveNickname(inputNick);
  socket.emit('set_nickname', { nickname });
  showPage('group');
  chatMode = 'group';
  socket.emit('get_rooms');
});

// ── 1v1 CHAT ──
function startSearch() {
  inPair = false;
  strangerName = generateStrangerName();
  setStatus1v1('Searching...');
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
  setStatus1v1('Chat ended');
  sysMsg('messages-1v1', 'You ended the chat. 👋');
});

document.getElementById('btn-new-1v1').addEventListener('click', startSearch);

document.getElementById('btn-back-1v1').addEventListener('click', () => {
  socket.emit('end_chat');
  showPage('landing');
});

document.getElementById('btn-report-1v1').addEventListener('click', () => openReport('1v1'));

// ── 1v1 SOCKET EVENTS ──
socket.on('searching', () => {
  setStatus1v1('Searching...');
  sysMsg('messages-1v1', 'Looking for someone to chat with...');
});

socket.on('paired', (data) => {
  inPair = true;
  strangerName = generateStrangerName();
  setStatus1v1('Connected!');
  
  if (data.commonInterests && data.commonInterests.length > 0) {
    sysMsg('messages-1v1', `✨ You both like: ${data.commonInterests.join(', ')}`);
  }
  
  sysMsg('messages-1v1', 'You are now connected. Say hi! 👋');
  setInput1v1(true);
});

socket.on('message_1v1', (data) => {
  if (data.from === 'you') {
    appendMessage('messages-1v1', 'You', data.text, 'you', { timestamp: data.timestamp, messageId: data.messageId });
  } else {
    appendMessage('messages-1v1', strangerName, data.text, 'stranger', { timestamp: data.timestamp, messageId: data.messageId });
  }
});

socket.on('stranger_left', () => {
  inPair = false;
  setInput1v1(false);
  setStatus1v1('Stranger left');
  sysMsg('messages-1v1', `${strangerName} has disconnected. 😔`);
  strangerName = generateStrangerName();
});

socket.on('chat_ended', () => {
  inPair = false;
  setInput1v1(false);
  setStatus1v1('Chat ended');
});

// ── GROUP CHAT ──
socket.on('rooms_list', (rooms) => {
  renderRoomList(rooms);
});

socket.on('rooms_updated', (rooms) => {
  if (currentPage === 'group' && !currentRoom) {
    renderRoomList(rooms);
  }
});

function renderRoomList(rooms) {
  const list = document.getElementById('room-list');
  list.innerHTML = '';
  
  if (!rooms || rooms.length === 0) {
    list.innerHTML = '<div class="no-rooms">✨ No active rooms. Create one above!</div>';
    return;
  }
  
  const sorted = [...rooms].sort((a, b) => {
    if (a.permanent && !b.permanent) return -1;
    if (!a.permanent && b.permanent) return 1;
    return b.count - a.count;
  });
  
  sorted.forEach(r => {
    const item = document.createElement('div');
    item.className = 'room-item';
    const permBadge = r.permanent ? '<span class="perm-badge">📌</span>' : '';
    const countDisplay = r.count > 0 ? `(${r.count})` : '(empty)';
    item.innerHTML = `<span>${permBadge} ${escHtml(r.name)} <span class="room-count">${countDisplay}</span></span><button>Join</button>`;
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
  if (!name) { 
    alert('Enter a room name.'); 
    return; 
  }
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
  sysMsg('messages-group', `You joined #${data.room}`);
});

socket.on('room_message', (data) => {
  if (data.from === 'system') {
    sysMsg('messages-group', data.text);
  } else {
    const isMe = data.selfId === socket.id;
    const senderName = isMe ? 'You' : (data.from || generateStrangerName());
    appendMessage('messages-group', senderName, data.text, isMe ? 'you' : 'stranger', { 
      timestamp: data.timestamp,
      messageId: data.messageId 
    });
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

socket.on('report_received', (data) => alert(data.message || 'Report submitted. Thank you.'));

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

// Request room list on page load
socket.emit('get_rooms');