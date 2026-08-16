(function(){
try {
var vscode;
try {
  vscode = acquireVsCodeApi();
} catch(e) {
  console.log('acquireVsCodeApi fallback:', e);
}

var chatFlow = document.getElementById('chatFlow');
var logFlow = document.getElementById('logFlow');
var fullLogStream = document.getElementById('fullLogStream');
var promptInput = document.getElementById('promptInput');
var ctxCheck = document.getElementById('ctxCheck');
var currentTranscript = [], streamBuffer = '', activeBotMsg = null, activeStreamBody = null, activeStreamHeader = null;

function switchTab(t){
var tabChatBtn = document.getElementById('tabChatBtn');
var tabLogBtn = document.getElementById('tabLogBtn');
var quickBar = document.getElementById('quickBar');
if (tabChatBtn) tabChatBtn.className = 'tab-btn ' + (t==='chat'?'active':'');
if (tabLogBtn) tabLogBtn.className = 'tab-btn ' + (t==='logs'?'active':'');
if (chatFlow) chatFlow.style.display = t==='chat' ? 'flex' : 'none';
if (logFlow) logFlow.style.display = t==='logs' ? 'flex' : 'none';
if (quickBar) quickBar.style.display = t==='chat' ? 'flex' : 'none';
}

function submitPrompt(){
var t = promptInput ? promptInput.value.trim() : '';
if (!t) return;
appendMessage(t, 'user');
if (promptInput) promptInput.value = '';
appendLog('USER: ' + t);
if (vscode) {
  vscode.postMessage({ type: 'sendPrompt', prompt: t, includeContext: Boolean(ctxCheck && ctxCheck.checked) });
}
}

function toggleSettings(){
var drawer = document.getElementById('settingsDrawer');
if (drawer) drawer.classList.toggle('open');
}

function saveSettings(){
var m = document.getElementById('cfgModelCustom').value.trim() || document.getElementById('cfgModelSelect').value;
var h = document.getElementById('cfgHost').value.trim(), temp = parseFloat(document.getElementById('cfgTemp').value) || 0;
var iter = parseInt(document.getElementById('cfgMaxIter').value, 10) || 12, rep = document.getElementById('cfgAutoRepair').checked;
if (vscode) {
  vscode.postMessage({ type: 'updateConfig', config: { model: m, host: h, temperature: temp, maxIterations: iter, autoRepair: rep } });
}
toggleSettings();
}

function openVSCodeSettings(){
if (vscode) vscode.postMessage({ type: 'openVSCodeSettings' });
}

function quickAction(act){
var labels = {
explain: '💡 Explain active script',
fix: '🔧 Fix errors & bugs in active script',
optimize: '⚡ Optimize performance of active script',
migrate: '🚀 Migrate active script to Pine v6',
validate: '✓ Validate Pine v6 conformance'
};
appendMessage(labels[act] || ('Action: ' + act), 'user');
appendLog('QUICK ACTION: ' + act);
if (vscode) {
  vscode.postMessage({ type: 'quickAction', action: act });
}
}

function copyToClipboard(text){
if (!text) return;
if (navigator.clipboard && navigator.clipboard.writeText) {
  navigator.clipboard.writeText(text).catch(function(){ fallbackCopy(text); });
} else {
  fallbackCopy(text);
}
}
function fallbackCopy(text){
var ta = document.createElement('textarea');
ta.value = text;
ta.style.position = 'fixed';
ta.style.opacity = '0';
document.body.appendChild(ta);
ta.select();
try { document.execCommand('copy'); } catch(e){}
document.body.removeChild(ta);
}

function copyLog(){
if (fullLogStream) copyToClipboard(fullLogStream.innerText || fullLogStream.textContent || '');
}

function clearChat(){
if (chatFlow) chatFlow.innerHTML = '<div class="msg bot">Chat cleared. Ready for your Pine Script v6 requests.</div>';
if (fullLogStream) fullLogStream.innerText = 'Log cleared.\n';
}

function appendLog(text){
if (fullLogStream) fullLogStream.innerText += text + '\n';
if (logFlow) logFlow.scrollTop = logFlow.scrollHeight;
}

function appendMessage(c, t, trans){
var d = document.createElement('div');
d.className = 'msg ' + t;
var html = '';
if (trans && trans.length > 0) {
html += '<details class="transcript-box"><summary>⚡ <strong>Execution Transcript (' + trans.length + ' steps)</strong></summary><div class="transcript-steps">';
trans.forEach(function(s){ html += '<div class="transcript-step"><span class="t-time">[' + s.time + ']</span><span class="t-state">[' + s.state + ']</span> <span>' + s.message + '</span></div>'; });
html += '</div></details>';
}
html += renderMarkdown(c);
d.innerHTML = html;
if (chatFlow) {
  chatFlow.appendChild(d);
  chatFlow.scrollTop = chatFlow.scrollHeight;
}
return d;
}

function renderMarkdown(src){
if (!src) return '';
var codeBlocks = [];
function escapeHtml(s) {
return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

var text = src.replace(/```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g, function(_, lang, code) {
var cleanCode = code.trim();
var isPine = !lang || lang === 'pine' || lang === 'pinescript' || cleanCode.indexOf('//@version') !== -1 || cleanCode.indexOf('indicator(') !== -1 || cleanCode.indexOf('strategy(') !== -1;
var actions = isPine 
? '<div class="code-actions"><button class="btn-sm btn-apply">Apply</button><button class="btn-sm btn-insert">Insert</button><button class="btn-sm btn-copy">Copy</button></div>'
: '<div class="code-actions"><button class="btn-sm btn-copy">Copy</button></div>';
var tag = lang ? '<span class="code-lang-tag">' + lang + '</span>' : '';
var html = '<div class="code-container">' + tag + '<pre><code>' + escapeHtml(cleanCode) + '</code></pre>' + actions + '</div>';
codeBlocks.push(html);
return '___CODE_BLOCK_' + (codeBlocks.length - 1) + '___';
});

text = escapeHtml(text);

text = text.replace(/((?:^|\n)\|[^\n]+\|\n\|[-: |]+\|\n(?:\|[^\n]+\|\n?)+)/g, function(match) {
var lines = match.trim().split('\n').map(function(l){ return l.trim().replace(/^\|/, '').replace(/\|$/, ''); });
if (lines.length < 2) return match;
var headers = lines[0].split('|').map(function(h){ return '<th>' + h.trim() + '</th>'; }).join('');
var rows = lines.slice(2).map(function(row){
var cells = row.split('|').map(function(c){ return '<td>' + c.trim() + '</td>'; }).join('');
return '<tr>' + cells + '</tr>';
}).join('');
return '\n<div class="table-wrapper"><table class="md-table"><thead><tr>' + headers + '</tr></thead><tbody>' + rows + '</tbody></table></div>\n';
});

text = text.replace(/^### (.*$)/gim, '<h3 class="md-h3">$1</h3>');
text = text.replace(/^## (.*$)/gim, '<h2 class="md-h2">$1</h2>');
text = text.replace(/^# (.*$)/gim, '<h1 class="md-h1">$1</h1>');
text = text.replace(/^(?:---|\*\*\*|___)\s*$/gim, '<hr class="md-hr">');
text = text.replace(/^>\s*(.*$)/gim, '<blockquote class="md-quote">$1</blockquote>');
text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
text = text.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
text = text.replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>');

text = text.replace(/(?:^|\n)[*-]\s+(.*)/g, '\n<li class="md-li">$1</li>');
text = text.replace(/((?:\n<li class="md-li">.*<\/li>)+)/g, '<ul class="md-ul">$1\n</ul>');
text = text.replace(/(?:^|\n)\d+\.\s+(.*)/g, '\n<li class="md-oli">$1</li>');
text = text.replace(/((?:\n<li class="md-oli">.*<\/li>)+)/g, '<ol class="md-ol">$1\n</ol>');

text = text.replace(/\n\n+/g, '<div class="md-p-gap"></div>');
text = text.replace(/\n/g, '<br>');

text = text.replace(/___CODE_BLOCK_(\d+)___/g, function(_, i) {
return codeBlocks[parseInt(i, 10)];
});

return text;
}

document.addEventListener('click', function(e){
var target = (e.target && e.target.nodeType === 3) ? e.target.parentElement : e.target;
if (!target || typeof target.closest !== 'function') return;

var chip = target.closest('.chip');
if (chip) {
var act = chip.getAttribute('data-action');
if (act) quickAction(act);
return;
}

if (target.closest('#sendBtn')) {
submitPrompt();
return;
}
if (target.closest('#modelTag') || target.closest('#btnSettingsToggle')) {
toggleSettings();
return;
}
if (target.closest('#btnClearChat')) {
clearChat();
return;
}
if (target.closest('#btnSaveSettings')) {
saveSettings();
return;
}
if (target.closest('#btnVSCodeSettings')) {
openVSCodeSettings();
return;
}
if (target.closest('#tabChatBtn')) {
switchTab('chat');
return;
}
if (target.closest('#tabLogBtn')) {
switchTab('logs');
return;
}
if (target.closest('#btnCopyLog')) {
copyLog();
return;
}

var applyBtn = target.closest('.btn-apply');
if (applyBtn) {
var pre = applyBtn.closest('.code-container').querySelector('code');
if (pre && vscode) vscode.postMessage({ type: 'applyCode', code: pre.textContent || pre.innerText, mode: 'replace' });
return;
}
var insertBtn = target.closest('.btn-insert');
if (insertBtn) {
var pre = insertBtn.closest('.code-container').querySelector('code');
if (pre && vscode) vscode.postMessage({ type: 'applyCode', code: pre.textContent || pre.innerText, mode: 'insert' });
return;
}
var copyBtn = target.closest('.btn-copy');
if (copyBtn) {
var pre = copyBtn.closest('.code-container').querySelector('code');
if (pre) {
copyToClipboard(pre.textContent || pre.innerText);
copyBtn.innerText = 'Copied!';
setTimeout(function(){ copyBtn.innerText = 'Copy'; }, 1500);
}
return;
}
});



document.addEventListener('keydown', function(e){
if (e.target && e.target.id === 'promptInput') {
if (e.key === 'Enter' && !e.shiftKey) {
e.preventDefault();
submitPrompt();
}
}
});

var cfgSelect = document.getElementById('cfgModelSelect');
if (cfgSelect) {
cfgSelect.addEventListener('change', function(e){ if (e.target.value) document.getElementById('cfgModelCustom').value = e.target.value; });
}

window.addEventListener('message', function(e){
var m = e.data;
if (!m) return;
if (m.type === 'statusUpdate') {
var modelNameEl = document.getElementById('modelName');
var statusDotEl = document.getElementById('statusDot');
var activeFileEl = document.getElementById('activeFileLabel');
var cfgHostEl = document.getElementById('cfgHost');
var cfgModelEl = document.getElementById('cfgModelCustom');
var cfgTempEl = document.getElementById('cfgTemp');
var cfgMaxIterEl = document.getElementById('cfgMaxIter');
var cfgAutoRepairEl = document.getElementById('cfgAutoRepair');
var sel = document.getElementById('cfgModelSelect');

if (modelNameEl) modelNameEl.innerText = m.connected ? (m.model || 'Connected') : 'Disconnected';
if (statusDotEl) statusDotEl.className = 'dot ' + (m.connected ? 'online' : '');
if (activeFileEl) activeFileEl.innerText = m.activeFile || 'No active file';
if (cfgHostEl) cfgHostEl.value = m.host || 'http://localhost:11434';
if (cfgModelEl) cfgModelEl.value = m.model || '';
if (cfgTempEl) cfgTempEl.value = m.temperature !== undefined ? m.temperature : 0;
if (cfgMaxIterEl) cfgMaxIterEl.value = m.maxIterations || 12;
if (cfgAutoRepairEl) cfgAutoRepairEl.checked = Boolean(m.autoRepair);

if (sel) {
  sel.innerHTML = '';
  var list = m.models && m.models.length > 0 ? m.models : [m.model].filter(Boolean);
  list.forEach(function(item){
    var opt = document.createElement('option');
    opt.value = item; opt.innerText = item;
    if (item === m.model) opt.selected = true;
    sel.appendChild(opt);
  });
}
} else if (m.type === 'startStreaming') {
streamBuffer = ''; currentTranscript = [];
activeBotMsg = document.createElement('div'); activeBotMsg.className = 'msg bot';
activeStreamHeader = document.createElement('div'); activeStreamHeader.className = 'active-stream-header';
activeStreamHeader.innerHTML = '<span class="pulse-dot"></span><span>Thinking...</span>';
activeStreamBody = document.createElement('div'); activeStreamBody.className = 'stream-body';
activeBotMsg.appendChild(activeStreamHeader); activeBotMsg.appendChild(activeStreamBody);
if (chatFlow) {
  chatFlow.appendChild(activeBotMsg);
  chatFlow.scrollTop = chatFlow.scrollHeight;
}
} else if (m.type === 'progress') {
currentTranscript = m.transcript || [];
if (m.step && m.step.state === 'RESET_STREAM') {
streamBuffer = '';
if (activeStreamBody) { activeStreamBody.innerHTML = ''; }
} else {
appendLog('[' + m.step.time + '] [' + m.step.state + '] ' + m.step.message);
if (activeStreamHeader) { activeStreamHeader.innerHTML = '<span class="pulse-dot"></span><span>[' + m.step.state + '] ' + m.step.message + '</span>'; }
}
} else if (m.type === 'streamChunk') {
streamBuffer += m.chunk;
if (activeStreamBody) {
  activeStreamBody.innerHTML = renderMarkdown(streamBuffer);
  if (chatFlow) chatFlow.scrollTop = chatFlow.scrollHeight;
}
} else if (m.type === 'streamEnd' || m.type === 'botResponse') {
var trans = m.transcript || currentTranscript, content = m.content || streamBuffer;
if (activeBotMsg) { activeBotMsg.remove(); activeBotMsg = null; activeStreamBody = null; activeStreamHeader = null; }
appendMessage(content, 'bot', trans);
appendLog('AGENT:\n' + content + '\n---');
currentTranscript = []; streamBuffer = '';
} else if (m.type === 'streamError') {
var trans = m.transcript || currentTranscript;
if (activeBotMsg) { activeBotMsg.remove(); activeBotMsg = null; activeStreamBody = null; activeStreamHeader = null; }
appendMessage('Error: ' + m.error, 'bot', trans);
appendLog('ERROR: ' + m.error);
currentTranscript = []; streamBuffer = '';
}
});

if (vscode) {
  vscode.postMessage({ type: 'webviewReady' });
  setInterval(function(){ vscode.postMessage({ type: 'refreshStatus' }); }, 5000);
}
} catch(err) {
console.error('PineForge UI error:', err);
}
})();
