// main.js - kiosk JS: upload, websocket, controls, progress + reconnect
(() => {
  const wsUrl = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
  let socket = null;
  let reconnectTimer = null;
  let connected = false;
  let currentFileName = null;
  let totalLines = 0, sentLines = 0, startTs = null;

  const el = id => document.getElementById(id);
  const logEl = el('log');
  const statusBadge = el('statusBadge');
  const fileInput = el('fileInput');
  const currentFile = el('currentFile');
  const progressFill = el('progressFill');
  const progressText = el('progressText');
  const elapsedEl = el('elapsed');

  function setStatus(s) {
    statusBadge.className = 'status ' + (s === 'Running' ? 'running' : s === 'Error' ? 'error' : 'idle');
    statusBadge.textContent = s;
  }

  function appendLog(text) {
    logEl.textContent += text + '\n';
    logEl.scrollTop = logEl.scrollHeight;
  }

  function connectWs() {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
    appendLog('WS: connecting...');
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      connected = true;
      appendLog('WS: connected');
      setStatus('Idle');
      if (currentFileName) {
        socket.send(JSON.stringify({ type: 'queryStatus' }));
      }
    };

    socket.onmessage = (ev) => {
      // backend should emit plain strings or JSON; handle both
      let data = ev.data;
      try { data = JSON.parse(ev.data); } catch(e){}
      if (typeof data === 'object') {
        handleMessage(data);
      } else {
        appendLog('RAW: ' + data);
      }
    };

    socket.onclose = () => {
      connected = false;
      appendLog('WS: disconnected - retrying...');
      setStatus('Idle');
      // reconnect with backoff
      if (!reconnectTimer) reconnectTimer = setTimeout(() => { reconnectTimer = null; connectWs(); }, 1500);
    };

    socket.onerror = (e) => {
      appendLog('WS error');
      setStatus('Error');
    };
  }

  function handleMessage(msg) {
    // expect messages like:
    // {type:'serial', text:'ok'} or {type:'progress', sent:10, total:100} or {type:'status', state:'Running'}
    switch(msg.type) {
      case 'serial':
        appendLog('[device] ' + msg.text);
        break;
      case 'log':
        appendLog(msg.text);
        break;
      case 'status':
        setStatus(msg.state || 'Idle');
        if (msg.state === 'Running') startTs = msg.startTs || startTs || Date.now();
        break;
      case 'progress':
        sentLines = msg.sent || sentLines;
        totalLines = msg.total || totalLines;
        updateProgress();
        break;
      case 'jobComplete':
        appendLog('Job complete');
        setStatus('Idle');
        sentLines = totalLines;
        updateProgress();
        break;
      default:
        appendLog('MSG: ' + JSON.stringify(msg));
    }
  }

  function updateProgress() {
    const pct = totalLines ? Math.round((sentLines / totalLines)*100) : 0;
    progressFill.style.width = pct + '%';
    progressText.textContent = `${pct}% • ${sentLines} / ${totalLines}`;
  }

  // elapsed timer
  setInterval(() => {
    if (!startTs) { elapsedEl.textContent = '00:00'; return; }
    const s = Math.floor((Date.now() - startTs) / 1000);
    const mm = String(Math.floor(s/60)).padStart(2,'0');
    const ss = String(s%60).padStart(2,'0');
    elapsedEl.textContent = `${mm}:${ss}`;
  }, 500);

  // UI actions
  el('uploadBtn').addEventListener('click', async () => {
    const f = fileInput.files[0];
    if (!f) return alert('Pick a file first');
    currentFileName = f.name;
    currentFile.textContent = currentFileName;
    const fd = new FormData();
    fd.append('file', f);
    appendLog('Uploading ' + f.name + ' ...');
    try {
      const res = await fetch('/upload', { method: 'POST', body: fd });
      const txt = await res.text();
      appendLog('Upload: ' + txt);
      // Ask backend to index/count lines (optional)
      if (connected) socket.send(JSON.stringify({ type:'uploaded', filename: f.name }));
    } catch (err) { appendLog('Upload error: ' + err.message); }
  });

  el('startBtn').addEventListener('click', () => {
    if (!currentFileName) return alert('Upload a file first');
    appendLog('START -> ' + currentFileName);
    if (connected) socket.send(JSON.stringify({ type:'start', filename: currentFileName }));
    startTs = Date.now();
    setStatus('Running');
  });

  el('stopBtn').addEventListener('click', () => {
    appendLog('STOP');
    if (connected) socket.send(JSON.stringify({ type:'stop' }));
    setStatus('Idle');
    startTs = null;
  });

  // jog buttons & laser
  document.querySelectorAll('.jog').forEach(btn => {
    btn.addEventListener('click', () => {
      const axis = btn.dataset.axis;
      const dir = btn.dataset.dir;
      const distance = 1; // mm - tune to preference or add UI
      appendLog(`Jog ${axis}${dir}${distance}`);
      if (connected) socket.send(JSON.stringify({ type:'jog', axis, dir, distance }));
    });
  });

  el('laserOn').addEventListener('click', () => {
    appendLog('Laser ON');
    if (connected) socket.send(JSON.stringify({ type:'laser', state:'on' }));
  });

  el('laserOff').addEventListener('click', () => {
    appendLog('Laser OFF');
    if (connected) socket.send(JSON.stringify({ type:'laser', state:'off' }));
  });

  // restore last picked file name from server? (optional)
  // Start WS
  connectWs();
  // Try to open immediately; connectWs handles reconnects
})();
