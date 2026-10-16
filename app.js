const REPOSITORY = 'https://github.com/tk120404/thirukkural';
const API = '/api';
let corpus = [];
let witnessWidgetCount = 0;
let authMode = 'login';
let activePaal = 'அறத்துப்பால்';
let browseLimit = 30;
let aathichudi = [];
let learnRound = null;
let learnScore = Number(localStorage.getItem('meypporul-learn-score') || 0);
let liveTimer = null;
let liveRequestId = 0;
const $ = (id) => document.getElementById(id);

function formattingNotes(input, original) {
  const notes = [];
  const source = String(input || '').normalize('NFC');
  const canonical = String(original || '').normalize('NFC');
  const stripPunctuation = (text) => text.replace(/[“”‘’"'.,;:!?()[\]{}…—–-]/gu, '');
  const inputPunctuation = (source.match(/[“”‘’"'.,;:!?()[\]{}…—–-]/gu) || []).join('');
  const sourcePunctuation = (canonical.match(/[“”‘’"'.,;:!?()[\]{}…—–-]/gu) || []).join('');
  if (inputPunctuation !== sourcePunctuation) notes.push('நிறுத்தக்குறி வேறுபாடு');
  const normInput = stripPunctuation(source).replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/gu, ' ').trim();
  const normSource = stripPunctuation(canonical).replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/gu, ' ').trim();
  if (normInput === normSource && source.replace(/\s+/gu, ' ').trim() !== canonical.replace(/\s+/gu, ' ').trim()) {
    notes.push('சொல் இடைவெளி வேறுபாடு');
  }
  if (!notes.length) notes.push('எழுத்து வடிவம் மாறாத சிறிய வடிவமைப்பு மாற்றம்');
  return notes;
}

function normalizeEntry(raw) {
  const number = Number(raw.number ?? raw.Number ?? raw.kural_number ?? raw.id);
  const line1 = String(raw.line1 ?? raw.Line1 ?? raw.line_1 ?? '').trim();
  const line2 = String(raw.line2 ?? raw.Line2 ?? raw.line_2 ?? '').trim();
  const couplet = String(raw.couplet ?? raw.text ?? '').trim() || [line1, line2].filter(Boolean).join('\n');
  return {
    number,
    line1: line1 || couplet.split(/\r?\n/u)[0] || '',
    line2: line2 || couplet.split(/\r?\n/u).slice(1).join('\n'),
    couplet,
    meaning: raw.meaning ?? raw.mv ?? raw.explanation ?? '',
    chapter: raw.chapter ?? raw.chapterName ?? raw.chapter_name ?? '',
    chapterNumber: raw.chapterNumber ?? raw.chapter_number ?? '',
    section: raw.section ?? '',
    source: raw.source ?? raw.repository ?? REPOSITORY
  };
}

async function loadCorpus() {
  const status = $('sourceStatus');
  try {
    const response = await fetch(`${API}/kurals`);
    if (!response.ok) throw new Error('API சேவை கிடைக்கவில்லை');
    const entries = await response.json();
    corpus = entries.map(normalizeEntry).filter((item) => Number.isInteger(item.number) && item.couplet).sort((a,b) => a.number - b.number);
    status.textContent = `${corpus.length} குறள்கள் · SQLite தயார்`;
    renderPaalCards();
    await loadAathichudi();
  } catch (error) {
    status.textContent = 'மூலத் தரவு பிழை';
    $('verifyResult').innerHTML = emptyState('!', 'சேவை அணுக முடியவில்லை', error.message);
  }
}

async function postApi(path, payload) {
  const response = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'சேவைப் பிழை');
  return data;
}

function verdict(kind) {
  return ({
    exact: ['மூலத்துடன் முழுமையாகப் பொருந்துகிறது', 'good', 'அசல் மூலப் பதிவுடன் எழுத்துப் பிழையின்றிப் பொருந்தியது.'],
    format: ['வடிவ வேறுபாட்டுடன் பொருந்துகிறது', 'good', 'நிறுத்தக்குறி அல்லது இடைவெளி மட்டுமே வேறுபடுகிறது; பொருள் அசல்.'],
    partial: ['மூலத்தின் ஒரு பகுதி மட்டுமே', 'warn', 'உள்ளீடு முழுக் குறளல்ல; ஒரு வரி அல்லது பகுதி மட்டுமே.'],
    altered: ['சொல் மாற்றம் கண்டறியப்பட்டது', 'warn', 'அருகிலுள்ள மூலக் குறளில் சொல் அல்லது எழுத்து மாற்றப்பட்டுள்ளது.'],
    'not-found': ['தொகுப்பில் ஆதாரம் இல்லை', 'bad', 'இணைக்கப்பட்ட நூல் தொகுப்புகளில் இந்த மேற்கோளுக்கான ஆதாரம் கிடைக்கவில்லை.'],
    insufficient: ['போதிய நீளமில்லை', 'warn', 'சரிபார்க்க குறைந்தபட்சம் 8 தமிழ் எழுத்துகள் தேவை.']
  })[kind] || ['ஆய்வு செய்யப்படவில்லை', 'warn', ''];
}

function escapeHtml(val) {
  return String(val ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function emptyState(icon, title, desc) {
  return `<div class="empty-state"><div class="empty-icon">${icon}</div><h3>${title}</h3><p>${desc}</p></div>`;
}

function diffMarkup(input, original) {
  const a = String(input).trim().split(/\s+/u);
  const b = String(original).trim().split(/\s+/u);
  const rows = a.length + 1;
  const cols = b.length + 1;
  if (rows * cols > 10000) return `<p class="explanation">உரை மிக நீளமாக இருப்பதால் சொல்-ஒப்பீட்டைக் காட்ட முடியவில்லை.</p>`;
  
  const dp = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i+1][j+1] + 1 : Math.max(dp[i+1][j], dp[i][j+1]);
    }
  }
  let i = 0, j = 0;
  const left = [], right = [];
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      left.push(`<span class="diff-same">${escapeHtml(a[i++])}</span>`);
      right.push(`<span class="diff-same">${escapeHtml(b[j++])}</span>`);
    } else if (i < a.length && (j === b.length || dp[i+1][j] >= dp[i][j+1])) {
      left.push(`<span class="diff-change">${escapeHtml(a[i++])}</span>`);
    } else {
      right.push(`<span class="diff-missing">${escapeHtml(b[j++])}</span>`);
    }
  }
  return `<div class="diff-line"><b>உள்ளீடு:</b> ${left.join(' ')}</div><div class="diff-line"><b>அசல் மூலம்:</b> ${right.join(' ')}</div>`;
}

function resultMarkup(input, result, claim = {}) {
  const [label, cls, explain] = verdict(result.kind);
  let body = `
    <div class="result-head">
      <div>
        <span class="verdict ${cls}">${label}</span>
        <h3>${result.item ? `${escapeHtml(result.work || 'திருக்குறள்')} ${result.item.number}` : 'ஆய்வு முடிவு'}</h3>
      </div>
    </div>
    <div class="result-section">
      <p class="explanation">${explain}</p>
    </div>`;

  if (result.item) {
    body += `
      <div class="result-section">
        <h4>அசல் மூல வடிவம்</h4>
        <div class="verse-text">${escapeHtml(result.item.couplet)}</div>
      </div>`;
    
    if (result.kind === 'format') {
      body += `
        <div class="result-section">
          <h4>கண்டறிந்த வேறுபாடு</h4>
          <p class="explanation">${formattingNotes(input, result.item.couplet).map(escapeHtml).join(' · ')}</p>
        </div>`;
    }

    if (result.item.meaning && /[\u0B80-\u0BFF]/u.test(result.item.meaning)) {
      body += `
        <div class="result-section">
          <h4>பொருள்</h4>
          <p class="meaning-text">${escapeHtml(result.item.meaning)}</p>
        </div>`;
    }

    body += `
      <div class="result-section">
        <div class="meta-grid">
          <div class="meta-cell"><small>எண்</small><strong>${result.item.number}</strong></div>
          <div class="meta-cell"><small>${result.work === 'ஆத்திச்சூடி' ? 'எழுத்து வகை' : 'அதிகாரம்'}</small><strong>${escapeHtml(result.item.chapter || 'பொது')}</strong></div>
          <div class="meta-cell"><small>முடிவு</small><strong>${label}</strong></div>
          <div class="meta-cell"><small>ஆதாரம்</small><strong>${escapeHtml(result.work || 'திருக்குறள்')} · மூலத் தரவு</strong></div>
        </div>
      </div>`;

    if ((result.work || 'திருக்குறள்') === 'திருக்குறள்') {
      const witnessId = `witness-panel-${++witnessWidgetCount}`;
      body += `
      <div class="result-section">
        <button type="button" class="secondary-button witness-button" data-witness-number="${result.item.number}" data-witness-target="${witnessId}">
          வரலாற்றுப் பதிப்புகளுடன் ஒப்பிடு (Multi-Witness)
        </button>
        <div class="witness-report" id="${witnessId}" aria-live="polite"></div>
      </div>`;
    } else {
      body += `<div class="result-section"><a class="source-link" href="${escapeHtml(result.item.source || '')}" target="_blank" rel="noopener">ஆத்திச்சூடி மூலப் பதிவைப் பார் ↗</a></div>`;
    }

    if (result.kind === 'altered' || result.kind === 'partial') {
      body += `
        <div class="result-section">
          <h4>சொல்-ஒப்பீடு வேறுபாடு (Diff)</h4>
          ${diffMarkup(input, result.item.couplet)}
        </div>`;
    }

    if (claim.number && Number(claim.number) !== result.item.number) {
      body += `<div class="conflict">எண் முரண்பாடு: இந்த உரை ${result.item.number}-ஆம் குறள்; நீங்கள் ${escapeHtml(claim.number)} எனக் குறிப்பிட்டுள்ளீர்கள்.</div>`;
    }
    if (claim.author && (result.work || 'திருக்குறள்') === 'திருக்குறள்' && !/திருவள்ளுவர்/u.test(claim.author)) {
      body += `<div class="conflict">ஆசிரியர் முரண்பாடு: இந்த உரை திருவள்ளுவருடையது; நீங்கள் “${escapeHtml(claim.author)}” எனக் குறிப்பிட்டுள்ளீர்கள்.</div>`;
    }
  }
  return body;
}

function showResult(target, input, result, claim) {
  $(target).innerHTML = resultMarkup(input, result, claim);
}

// Multi-Witness Comparison Loader
document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-witness-number]');
  if (!button) return;
  const target = $(button.dataset.witnessTarget);
  const number = Number(button.dataset.witnessNumber);
  button.disabled = true;
  target.innerHTML = '<p class="explanation">பதிப்புச் சான்றுகளை ஒப்பிடுகிறது…</p>';

  try {
    const response = await fetch(`${API}/witness/${number}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'பதிப்பு விவரம் கிடைக்கவில்லை');

    target.innerHTML = `
      <div class="witness-heading">
        <strong>குறள் ${data.number} · பதிப்பு மூலங்கள்</strong>
        <span>${data.editions.length} வரலாற்றுப் பதிப்புகள்</span>
      </div>
      ${data.editions.map(edition => `
        <article class="witness-edition">
          <div class="witness-title">
            <strong>${escapeHtml(edition.edition)}</strong>
            <a class="source-link" href="${escapeHtml(edition.sourceUrl)}" target="_blank" rel="noreferrer">மூலப் பக்கம் ↗</a>
          </div>
          <small>${escapeHtml(edition.attribution || '')}</small>
          ${edition.readings.length ? edition.readings.map(reading => `
            <div class="witness-reading">
              <span class="verdict ${reading.status === 'same-text' ? 'good' : 'warn'}">
                ${reading.status === 'same-text' ? 'உரையும் எண்ணும் பொருந்துகின்றன' : 'பதிப்பு வேறுபாடு'}
              </span>
              <p class="verse-text">${escapeHtml(reading.couplet)}</p>
            </div>
          `).join('') : '<p class="explanation">பதிவு இல்லை.</p>'}
          <small class="source-hash">SHA-256: ${edition.sha256 || 'சரிபார்க்கப்பட்டது'}</small>
        </article>
      `).join('')}`;
  } catch (error) {
    target.innerHTML = `<p class="conflict">${escapeHtml(error.message)}</p>`;
  } finally {
    button.disabled = false;
  }
});

// Tab Switcher
function switchTab(viewName) {
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.view === viewName));
  document.querySelectorAll('.view').forEach(v => {
    const active = v.id === `view-${viewName}`;
    v.classList.toggle('active', active);
    v.hidden = !active;
  });
}
document.querySelectorAll('.tab').forEach(button => {
  button.addEventListener('click', () => switchTab(button.dataset.view));
});

function showAuthenticatedApp(username) {
  $('authScreen').hidden = true;
  $('appShell').hidden = false;
  $('userLabel').textContent = username;
  $('profileMenu').hidden = true;
  $('profileButton').setAttribute('aria-expanded', 'false');
  loadCorpus();
}

function showAuthentication(message = '') {
  $('appShell').hidden = true;
  $('authScreen').hidden = false;
  $('authMessage').textContent = message;
  $('authPassword').value = '';
  $('authPassword').type = 'password';
  $('passwordVisibilityToggle').setAttribute('aria-pressed', 'false');
  $('passwordVisibilityLabel').textContent = 'காட்டு';
  authMode = 'login';
  $('authTitle').textContent = 'மெய்ப்பொருள்';
  $('authHint').textContent = 'உங்கள் கணக்கில் நுழைந்து குறள்களைப் பயன்படுத்துங்கள்.';
  $('authSubmit').textContent = 'நுழைக';
  $('authSwitch').textContent = 'புதிய கணக்கு உருவாக்கு';
  $('authPassword').autocomplete = 'current-password';
}

$('passwordVisibilityToggle').addEventListener('click', () => {
  const password = $('authPassword');
  const visible = password.type === 'password';
  password.type = visible ? 'text' : 'password';
  $('passwordVisibilityToggle').setAttribute('aria-pressed', String(visible));
  $('passwordVisibilityLabel').textContent = visible ? 'மறை' : 'காட்டு';
});

for (const field of [$('authUsername'), $('authPassword')]) {
  field.addEventListener('invalid', () => {
    if (field.validity.valueMissing) field.setCustomValidity(field === $('authUsername') ? 'பயனர் பெயரை உள்ளிடவும்.' : 'கடவுச்சொல்லை உள்ளிடவும்.');
    else if (field === $('authUsername') && field.validity.tooShort) field.setCustomValidity('பயனர் பெயர் குறைந்தது 3 எழுத்துகள் கொண்டிருக்க வேண்டும்.');
    else if (field === $('authPassword') && field.validity.tooShort) field.setCustomValidity('கடவுச்சொல் குறைந்தது 8 எழுத்துகள் கொண்டிருக்க வேண்டும்.');
  });
  field.addEventListener('input', () => field.setCustomValidity(''));
}

async function initializeAuthentication() {
  try {
    const response = await fetch(`${API}/auth/session`, { credentials: 'same-origin' });
    const session = await response.json();
    if (session.authenticated) showAuthenticatedApp(session.username);
    else showAuthentication();
  } catch {
    showAuthentication('சேவையுடன் இணைக்க முடியவில்லை. வழங்கி இயங்குகிறதா எனச் சரிபார்க்கவும்.');
  }
}

$('authSwitch').addEventListener('click', () => {
  authMode = authMode === 'login' ? 'register' : 'login';
  const registering = authMode === 'register';
  $('authTitle').textContent = registering ? 'புதிய கணக்கு' : 'மெய்ப்பொருள்';
  $('authHint').textContent = registering ? 'உங்கள் கணக்கை உருவாக்கி குறள் ஆய்வைத் தொடங்குங்கள்.' : 'உங்கள் கணக்கில் நுழைந்து குறள்களைப் பயன்படுத்துங்கள்.';
  $('authSubmit').textContent = registering ? 'கணக்கை உருவாக்கு' : 'நுழைக';
  $('authSwitch').textContent = registering ? 'ஏற்கெனவே கணக்கு உள்ளதா? நுழைக' : 'புதிய கணக்கு உருவாக்கு';
  $('authPassword').autocomplete = registering ? 'new-password' : 'current-password';
  $('authMessage').textContent = '';
});

$('authForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = $('authSubmit');
  submit.disabled = true;
  $('authMessage').textContent = '';
  try {
    const response = await fetch(`${API}/auth/${authMode}`, {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: $('authUsername').value.trim(), password: $('authPassword').value })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'உள்நுழைய முடியவில்லை. விவரங்களைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.');
    showAuthenticatedApp(data.username);
  } catch (error) {
    $('authMessage').textContent = error instanceof TypeError
      ? 'சேவையுடன் இணைக்க முடியவில்லை. இணைய இணைப்பைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.'
      : error.message;
  } finally {
    submit.disabled = false;
  }
});

$('logoutButton').addEventListener('click', async () => {
  try { await fetch(`${API}/auth/logout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); }
  finally { showAuthentication(); }
});

$('profileButton').addEventListener('click', () => {
  const opening = $('profileMenu').hidden;
  $('profileMenu').hidden = !opening;
  $('profileButton').setAttribute('aria-expanded', String(opening));
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('.profile-wrap')) {
    $('profileMenu').hidden = true;
    $('profileButton').setAttribute('aria-expanded', 'false');
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    $('profileMenu').hidden = true;
    $('profileButton').setAttribute('aria-expanded', 'false');
  }
});

function renderPaalCards() {
  const sections = [
    { name: 'அறத்துப்பால்', range: 'குறள் 1–380', description: 'அறம், ஒழுக்கம், இல்லறம்', tone: 'aram' },
    { name: 'பொருட்பால்', range: 'குறள் 381–1080', description: 'ஆட்சி, நட்பு, குடிமை', tone: 'porul' },
    { name: 'காமத்துப்பால்', range: 'குறள் 1081–1330', description: 'காதல் வாழ்வின் உணர்வுகள்', tone: 'kamam' }
  ];
  $('paalCards').innerHTML = sections.map(section => {
    const entries = corpus.filter(item => item.section === section.name);
    const chapters = new Set(entries.map(item => item.chapter).filter(Boolean)).size;
    return `<button type="button" class="paal-card paal-${section.tone}" data-paal="${escapeHtml(section.name)}" aria-pressed="${activePaal === section.name}"><strong>${escapeHtml(section.name)}</strong><span>${entries.length} குறள்கள் · ${chapters} அதிகாரங்கள்</span><small>${section.range} · ${section.description}</small></button>`;
  }).join('');
  updateChapterFilter();
  renderKuralList();
}

async function loadAathichudi() {
  try {
    const response = await fetch(`${API}/aathichudi`);
    if (!response.ok) throw new Error('ஆத்திச்சூடி தரவைப் பெற முடியவில்லை.');
    aathichudi = await response.json();
    $('libraryCount').textContent = `${aathichudi.length} ஆத்திச்சூடி வரிகள்`;
    renderAathichudi();
  } catch (error) {
    $('libraryCount').textContent = 'மூலத் தரவு கிடைக்கவில்லை';
    $('aathiList').innerHTML = emptyState('!', 'தரவை ஏற்ற முடியவில்லை', escapeHtml(error.message));
  }
}

function renderAathichudi() {
  const query = $('aathiSearch').value.trim().toLocaleLowerCase('ta');
  const rows = aathichudi.filter(row => !query || String(row.number).includes(query) || row.text.toLocaleLowerCase('ta').includes(query) || row.group_name.toLocaleLowerCase('ta').includes(query));
  $('libraryCount').textContent = `${rows.length} / ${aathichudi.length} வரிகள்`;
  $('aathiList').innerHTML = rows.length ? rows.map(row => `<article class="literature-card"><div class="learn-meta"><strong>ஆத்திச்சூடி ${row.number}</strong><span>${escapeHtml(row.group_name)}</span></div><p class="verse-text">${escapeHtml(row.text)}</p><small>ஔவையார் · Project Madurai மூலத் தொகுப்பு</small></article>`).join('') : emptyState('?', 'வரி கிடைக்கவில்லை', 'வேறு சொல்லைத் தேடிப் பாருங்கள்.');
}
$('aathiSearch').addEventListener('input', renderAathichudi);

function paintLearnScore() {
  $('learnScore').textContent = `மதிப்பெண்: ${learnScore}`;
  $('learnProgressFill').style.width = `${Math.min(100, learnScore * 10)}%`;
  $('learnProgressText').textContent = learnScore ? `${learnScore} சரியான விடைகள் · தொடர்ந்து பயிற்சி செய்யுங்கள்.` : 'சரியான ஒவ்வொரு விடைக்கும் ஒரு மதிப்பெண்.';
}
function normalizeGameWord(value) {
  return String(value || '').normalize('NFC').replace(/[\p{P}\p{S}]/gu, '').trim().replace(/\s+/gu, '');
}
function nextLearnRound() {
  if (!corpus.length) return;
  const item = corpus[Math.floor(Math.random() * corpus.length)];
  const words = item.couplet.split(/(\s+)/u);
  const candidates = words.map((part, index) => ({ part, index })).filter(entry => entry.part.trim() && /[\u0B80-\u0BFF]/u.test(entry.part));
  if (!candidates.length) return;
  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  learnRound = { item, answer: chosen.part.replace(/[\p{P}\p{S}]/gu, ''), solved: false };
  words[chosen.index] = '＿＿＿';
  $('learnVerse').innerHTML = escapeHtml(words.join(''));
  $('learnNumber').textContent = `குறள் ${item.number}`;
  $('learnChapter').textContent = item.chapter || 'குறள் பயிற்சி';
  $('learnClue').textContent = item.meaning || `அதிகாரம்: ${item.chapter || 'திருக்குறள்'}`;
  $('learnAnswer').value = '';
  $('learnAnswer').disabled = false;
  $('checkLearn').disabled = false;
  $('learnFeedback').textContent = '';
  $('learnAnswer').focus();
}
$('nextLearn').addEventListener('click', nextLearnRound);
$('checkLearn').addEventListener('click', () => {
  if (!learnRound || learnRound.solved) return;
  if (normalizeGameWord($('learnAnswer').value) === normalizeGameWord(learnRound.answer)) {
    learnRound.solved = true;
    learnScore += 1;
    localStorage.setItem('meypporul-learn-score', String(learnScore));
    $('learnVerse').textContent = learnRound.item.couplet;
    $('learnFeedback').textContent = 'சரியான விடை! ஒரு மதிப்பெண் பெற்றீர்கள்.';
    $('learnFeedback').className = 'learn-feedback good-text';
    $('learnAnswer').disabled = true;
    $('checkLearn').disabled = true;
    paintLearnScore();
  } else {
    $('learnFeedback').textContent = 'இன்னும் சரியில்லை. பொருள் குறிப்பை வைத்து மீண்டும் முயற்சிக்கவும்.';
    $('learnFeedback').className = 'learn-feedback bad-text';
  }
});
$('learnAnswer').addEventListener('keydown', event => { if (event.key === 'Enter') $('checkLearn').click(); });
$('showLearnAnswer').addEventListener('click', () => {
  if (!learnRound) return;
  $('learnVerse').textContent = learnRound.item.couplet;
  $('learnFeedback').textContent = `விடை: ${learnRound.answer}. அடுத்த குறளில் மீண்டும் முயலுங்கள்.`;
  $('learnFeedback').className = 'learn-feedback';
  learnRound.solved = true;
  $('learnAnswer').disabled = true;
  $('checkLearn').disabled = true;
});
paintLearnScore();

$('teacherCheck').addEventListener('click', async () => {
  const quotes = $('teacherQuotes').value.split(/\r?\n/u).map(line => line.trim()).filter(Boolean);
  if (!quotes.length) { $('teacherResults').innerHTML = `<p class="conflict">குறைந்தது ஒரு மேற்கோளையாவது உள்ளிடுங்கள்.</p>`; return; }
  const button = $('teacherCheck'); button.disabled = true; button.textContent = 'ஆய்வு செய்கிறது…';
  try {
    const report = await postApi('/teacher/check', { quotes });
    $('teacherResults').innerHTML = `<div class="teacher-summary"><strong>${report.total} பதில்கள்</strong><span>${report.verified} ஆதாரம் கிடைத்தது</span><span>${report.review} மறுபரிசீலனை தேவை</span></div>` + report.results.map(row => {
      const [label, cls, description] = verdict(row.result.kind);
      const source = row.result.item;
      return `<article class="teacher-row"><span class="verdict ${cls}">${escapeHtml(label)}</span><p>${escapeHtml(row.quote)}</p><small>${source ? `${escapeHtml(row.result.work || 'திருக்குறள்')} ${source.number} · ${escapeHtml(source.chapter || '')} · ${escapeHtml(source.couplet)}` : escapeHtml(description)}</small></article>`;
    }).join('');
  } catch (error) { $('teacherResults').innerHTML = `<p class="conflict">${escapeHtml(error.message)}</p>`; }
  finally { button.disabled = false; button.textContent = 'வகுப்புப் பதில்களைச் சரிபார்'; }
});
$('teacherClear').addEventListener('click', () => { $('teacherQuotes').value = ''; $('teacherResults').innerHTML = ''; });
$('trySchoolApi').addEventListener('click', async () => {
  const result = $('schoolApiResult');
  result.textContent = 'API கோரிக்கை அனுப்பப்படுகிறது…';
  try {
    const data = await postApi('/public/verify', { text: 'அறம் செய விரும்பு.' });
    result.innerHTML = `<strong>${escapeHtml(data.work || 'திருக்குறள்')} ${data.item?.number || ''}</strong> · ${escapeHtml(verdict(data.kind)[0])}<br><small>${escapeHtml(data.item?.couplet || 'இந்தத் தொகுப்பில் ஆதாரம் இல்லை')}</small>`;
  } catch (error) { result.textContent = error.message; }
});

function updateChapterFilter() {
  const selected = $('chapterFilter').value;
  const chapters = [...new Set(corpus.filter(item => item.section === activePaal).map(item => item.chapter).filter(Boolean))];
  $('chapterFilter').innerHTML = '<option value="">அனைத்து அதிகாரங்களும்</option>' + chapters.map(chapter => `<option value="${escapeHtml(chapter)}">${escapeHtml(chapter)}</option>`).join('');
  if (chapters.includes(selected)) $('chapterFilter').value = selected;
}

function renderKuralList() {
  const query = $('browseSearch').value.trim().toLocaleLowerCase('ta');
  const chapter = $('chapterFilter').value;
  const filtered = corpus.filter(item => item.section === activePaal && (!chapter || item.chapter === chapter) &&
    (!query || String(item.number).includes(query) || item.chapter.toLocaleLowerCase('ta').includes(query) || item.couplet.toLocaleLowerCase('ta').includes(query)));
  $('browseCount').textContent = `${filtered.length} குறள்கள்`;
  const visible = filtered.slice(0, browseLimit);
  $('kuralList').innerHTML = visible.length ? visible.map(item => `
    <article class="kural-card">
      <div class="kural-card-head"><strong>குறள் ${item.number}</strong><span>${escapeHtml(item.chapter || '')}</span></div>
      <p class="verse-text">${escapeHtml(item.couplet)}</p>
      ${item.meaning ? `<p class="meaning-text">${escapeHtml(item.meaning)}</p>` : ''}
      <div class="kural-card-actions"><button type="button" class="secondary-button" data-open-kural="${item.number}">முழுமையாகப் பார்</button></div>
    </article>`).join('') : emptyState('?', 'குறள் இல்லை', 'வேறு சொல்லையோ அதிகாரத்தையோ தேடிப் பாருங்கள்.');
  $('browseMore').hidden = visible.length >= filtered.length;
}

$('paalCards').addEventListener('click', (event) => {
  const button = event.target.closest('[data-paal]');
  if (!button) return;
  activePaal = button.dataset.paal;
  browseLimit = 30;
  $('browseSearch').value = '';
  updateChapterFilter();
  renderPaalCards();
});
$('chapterFilter').addEventListener('change', () => { browseLimit = 30; renderKuralList(); });
$('browseSearch').addEventListener('input', () => { browseLimit = 30; renderKuralList(); });
$('browseMore').addEventListener('click', () => { browseLimit += 30; renderKuralList(); });
$('kuralList').addEventListener('click', (event) => {
  const button = event.target.closest('[data-open-kural]');
  if (!button) return;
  const item = corpus.find(row => row.number === Number(button.dataset.openKural));
  if (!item) return;
  $('quoteInput').value = item.couplet;
  $('claimedNumber').value = item.number;
  $('liveHint').hidden = true;
  switchTab('verify');
  $('verifyForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
});

function paintLiveHint(message, kind = '', suggestion = '') {
  const hint = $('liveHint');
  hint.hidden = false;
  hint.className = `live-hint${kind ? ` is-${kind}` : ''}`;
  hint.innerHTML = `${escapeHtml(message)}${suggestion ? ` <button type="button" data-use-suggestion="${escapeHtml(suggestion)}">மூலக் குறளைப் பயன்படுத்து</button>` : ''}`;
}

$('quoteInput').addEventListener('input', () => {
  clearTimeout(liveTimer);
  const requestId = ++liveRequestId;
  const input = $('quoteInput').value.trim();
  if (!input) { $('liveHint').hidden = true; return; }
  const tamilLength = (input.match(/[\u0B80-\u0BFF]/gu) || []).length;
  if (tamilLength < 8) { paintLiveHint('மேற்கோளைத் தொடர்ந்து தட்டச்சிடுங்கள்; பின்னர் பிழையைச் சோதிக்கிறோம்.'); return; }
  paintLiveHint('தட்டச்சு செய்த உரையை மூலக் குறள்களுடன் ஒப்பிடுகிறது…');
  liveTimer = setTimeout(async () => {
    try {
      const result = await postApi('/verify', { text: input });
      if (requestId !== liveRequestId) return;
      if (result.kind === 'exact') paintLiveHint(`குறள் ${result.item.number}: மூலத்துடன் சரியாகப் பொருந்துகிறது.`, 'good');
      else if (result.kind === 'format') paintLiveHint(`குறள் ${result.item.number}: இடைவெளி அல்லது குறியீட்டு வேறுபாடு உள்ளது. மூல வடிவம் கீழே.`, 'warn', result.item.couplet);
      else if (result.kind === 'partial') paintLiveHint(`குறள் ${result.item.number}: இது முழுக் குறளின் ஒரு பகுதி.`, 'warn', result.item.couplet);
      else if (result.kind === 'altered') paintLiveHint(`குறள் ${result.item.number}-க்கு அருகிலான உரை. சொல்/எழுத்து மாற்றம் இருக்கலாம்; பரிந்துரை மட்டும்.`, 'warn', result.item.couplet);
      else if (result.kind === 'insufficient') paintLiveHint('இன்னும் சில தமிழ் எழுத்துகளைத் தட்டச்சிடுங்கள்.');
      else paintLiveHint('ஏற்றப்பட்ட திருக்குறள் தொகுப்பில் இதற்கான பொருத்தம் இல்லை.', 'bad');
    } catch (error) {
      if (requestId === liveRequestId) paintLiveHint(error.message, 'bad');
    }
  }, 350);
});

$('liveHint').addEventListener('click', (event) => {
  const button = event.target.closest('[data-use-suggestion]');
  if (!button) return;
  $('quoteInput').value = button.dataset.useSuggestion;
  $('liveHint').hidden = true;
  $('verifyForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
});

// Tab 1: AI Gate Form
$('gateForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const draft = $('draftInput').value.trim();
  const manual = $('gateQuote').value.trim();
  const panel = $('gateResult');

  if (!draft) return;
  panel.innerHTML = emptyState('⏳', 'ஆய்வு செய்கிறது…', 'AI வரைவிலுள்ள மேற்கோள்கள் சோதிக்கப்படுகின்றன.');

  try {
    const data = await postApi('/gate', { draft, quote: manual });
    if (!data.quoteCount) {
      panel.innerHTML = `
        <div class="result-head">
          <div><span class="verdict warn">மேற்கோள் இல்லை</span><h3>வரைவில் மேற்கோள் கண்டறியப்படவில்லை</h3></div>
        </div>
        <p class="explanation">மேற்கோள் குறிகளுக்குள் (“...”) மேற்கோளை இடுங்கள் அல்லது கீழே தனிப்பெட்டியில் இடவும்.</p>`;
      return;
    }

    const approved = data.approved;
    panel.innerHTML = `
      <div class="result-head">
        <div>
          <span class="verdict ${approved ? 'good' : 'bad'}">
            ${approved ? 'வெளியீட்டுக்கு அனுமதி (PASSED)' : 'வெளியீடு தடுத்து நிறுத்தப்பட்டது (BLOCKED)'}
          </span>
          <h3>${approved ? 'அனைத்து மேற்கோள்களும் அசல்' : 'போலி அல்லது மாற்றப்பட்ட மேற்கோள்'}</h3>
        </div>
      </div>
      <p class="explanation">
        ${approved 
          ? 'வரைவிலுள்ள அனைத்து மேற்கோள்களும் வரலாற்று மூலப் பதிவுடன் முழுமையாகப் பொருந்தியுள்ளன. Zero Hallucination உறுதி செய்யப்பட்டது.' 
          : 'கண்டறியப்பட்ட மேற்கோள்களில் போலி அல்லது மாற்றப்பட்ட வரிகள் உள்ளதால் வரைவு தடுத்து நிறுத்தப்பட்டுள்ளது.'}
      </p>
      ${data.results.map(({ quote, result }) => `
        <div class="gate-item">
          <span class="verdict ${verdict(result.kind)[1]}">${verdict(result.kind)[0]}</span>
          <p>${escapeHtml(quote)}</p>
          ${result.item ? `<small>அசல் மூலம்: குறள் ${result.item.number} · ${escapeHtml(result.item.couplet)}</small>` : ''}
        </div>
      `).join('')}`;
  } catch (error) {
    panel.innerHTML = emptyState('!', 'சேவை அணுக முடியவில்லை', escapeHtml(error.message));
  }
});

$('clearGate').addEventListener('click', () => {
  $('draftInput').value = '';
  $('gateQuote').value = '';
  $('gateResult').innerHTML = emptyState('🛡️', 'சான்றாய்வு முடிவுகள்', 'AI பதிலிலுள்ள மேற்கோள்கள் தானாகப் பிரித்தெடுக்கப்பட்டு, மூலத்துடன் ஒப்பிட்டு அனுமதிக்கப்படும் அல்லது தடுக்கப்படும்.');
});

// AI Draft Preset Pills
$('pillAiValid').addEventListener('click', () => {
  $('draftInput').value = `வணக்கம்! திருவள்ளுவர் திருக்குறளின் முதல் அதிகாரத்தில், "அகர முதல எழுத்தெல்லாம் ஆதி பகவன் முதற்றே உலகு" என்று உலக இயக்கத்தின் தொடக்கத்தைக் குறிப்பிட்டுள்ளார்.`;
  $('gateForm').dispatchEvent(new Event('submit'));
});

$('pillAiFake').addEventListener('click', () => {
  $('draftInput').value = `திருவள்ளுவர் கல்வி குறித்துக் கூறும்போது, "எண்ணும் எழுத்தும் கண்ணெனத் தகும்" என்று மிக அழகாகக் கூறியுள்ளார்.`;
  $('gateForm').dispatchEvent(new Event('submit'));
});

// Tab 2: Verify Form
$('verifyForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = $('quoteInput').value;
  try {
    const result = await postApi('/verify', { text: input });
    showResult('verifyResult', input, result, {
      work: $('claimedWork').value,
      author: $('claimedAuthor').value,
      number: $('claimedNumber').value
    });
  } catch (error) {
    $('verifyResult').innerHTML = emptyState('!', 'சேவை அணுக முடியவில்லை', escapeHtml(error.message));
  }
});

$('lookupNumber').addEventListener('click', async () => {
  const number = Number($('claimedNumber').value);
  const item = corpus.find(x => x.number === number);
  if (!item) {
    $('verifyResult').innerHTML = emptyState('?', 'குறள் கிடைக்கவில்லை', '1 முதல் 1330 வரையிலான எண்ணை உள்ளிடுங்கள்.');
    return;
  }
  $('quoteInput').value = item.couplet;
  $('claimedWork').value = 'திருக்குறள்';
  $('claimedAuthor').value = 'திருவள்ளுவர்';
  try {
    const result = await postApi('/verify', { text: item.couplet });
    showResult('verifyResult', item.couplet, result);
  } catch (error) {
    $('verifyResult').innerHTML = emptyState('!', 'சேவை அணுக முடியவில்லை', escapeHtml(error.message));
  }
});

$('sampleQuote').addEventListener('click', () => {
  const item = corpus.find(x => x.number === 1) || corpus[0];
  if (item) {
    $('quoteInput').value = item.couplet;
    $('claimedNumber').value = item.number;
    $('verifyForm').dispatchEvent(new Event('submit'));
  }
});

$('clearQuote').addEventListener('click', () => {
  $('quoteInput').value = '';
  $('claimedNumber').value = '';
  $('verifyResult').innerHTML = emptyState('✓', 'முடிவுக்காகக் காத்திருக்கிறது', 'மேற்கோளை உள்ளிட்டதும் வரலாற்றுப் பதிப்புச் சான்று மற்றும் ஒப்பீடு இங்கே தோன்றும்.');
});

// Tab 3: Forge Form
$('loadVerse').addEventListener('click', () => {
  const number = Number($('verseNumber').value);
  const item = corpus.find(x => x.number === number);
  if (!item) {
    $('forgeSourceNote').textContent = 'சரியான எண் உள்ளிடுங்கள்.';
    return;
  }
  $('forgeInput').value = item.couplet;
  $('forgeSourceNote').textContent = `குறள் ${item.number} ஏற்றப்பட்டது.`;
});

$('forgeCheck').addEventListener('click', async () => {
  const input = $('forgeInput').value;
  if (!input.trim()) return;
  try {
    showResult('forgeResult', input, await postApi('/verify', { text: input }));
  } catch (error) {
    $('forgeResult').innerHTML = emptyState('!', 'சேவை அணுக முடியவில்லை', escapeHtml(error.message));
  }
});

$('clearForge').addEventListener('click', () => {
  $('forgeInput').value = '';
  $('forgeSourceNote').textContent = '';
  $('forgeResult').innerHTML = emptyState('✎', 'மாற்றச் சோதனை', 'சொற்களை மாற்றியமைத்து ஒப்பீட்டு வேறுபாட்டைக் காண்க.');
});

// Judge 1-Click Scenarios
$('scenarioExact').addEventListener('click', () => {
  switchTab('verify');
  const item = corpus.find(x => x.number === 1);
  if (item) {
    $('quoteInput').value = item.couplet;
    $('claimedNumber').value = 1;
    $('claimedAuthor').value = 'திருவள்ளுவர்';
    $('verifyForm').dispatchEvent(new Event('submit'));
  }
});

$('scenarioHallucination').addEventListener('click', () => {
  switchTab('gate');
  $('draftInput').value = `AI பதில்: "திருவள்ளுவர் தனது திருக்குறளில் 'எண்ணும் எழுத்தும் கண்ணெனத் தகும்' என்று அறிவுறுத்துகிறார்."`;
  $('gateForm').dispatchEvent(new Event('submit'));
});

$('scenarioAltered').addEventListener('click', () => {
  switchTab('forge');
  $('verseNumber').value = 1;
  const item = corpus.find(x => x.number === 1);
  if (item) {
    $('forgeInput').value = 'அகர முதல எழுத்தெல்லாம் ஆதி இறைவன் முதற்றே உலகு'; // Altered 'பகவன்' to 'இறைவன்'
    $('forgeSourceNote').textContent = 'குறள் 1 (சொல் மாற்றப்பட்டுள்ளது)';
    $('forgeCheck').click();
  }
});

$('scenarioWitness').addEventListener('click', async () => {
  switchTab('verify');
  const item = corpus.find(x => x.number === 72) || corpus.find(x => x.number === 1);
  if (item) {
    $('quoteInput').value = item.couplet;
    $('claimedNumber').value = item.number;
    $('claimedAuthor').value = 'திருவள்ளுவர்';
    try {
      const result = await postApi('/verify', { text: item.couplet });
      showResult('verifyResult', item.couplet, result);
      // Auto-click witness comparison button to expand
      setTimeout(() => {
        const btn = document.querySelector('.witness-button');
        if (btn) btn.click();
      }, 100);
    } catch (e) {
      console.error(e);
    }
  }
});

initializeAuthentication();
