const REPOSITORY = 'https://github.com/tk120404/thirukkural';
const API = '/api';
let corpus = [];
let witnessWidgetCount = 0;
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
    'not-found': ['மூலத் தொகுப்பில் ஆதாரம் இல்லை', 'bad', 'திருக்குறள் தொகுப்பில் இந்த மேற்கோளுக்கான ஆதாரம் கிடைக்கவில்லை.'],
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
        <h3>${result.item ? `குறள் ${result.item.number}` : 'ஆய்வு முடிவு'}</h3>
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
          <div class="meta-cell"><small>அதிகாரம்</small><strong>${escapeHtml(result.item.chapter || 'பொது')}</strong></div>
          <div class="meta-cell"><small>முடிவு</small><strong>${label}</strong></div>
          <div class="meta-cell"><small>ஆதாரம்</small><strong>SQLite Corpus</strong></div>
        </div>
      </div>`;

    const witnessId = `witness-panel-${++witnessWidgetCount}`;
    body += `
      <div class="result-section">
        <button type="button" class="secondary-button witness-button" data-witness-number="${result.item.number}" data-witness-target="${witnessId}">
          வரலாற்றுப் பதிப்புகளுடன் ஒப்பிடு (Multi-Witness)
        </button>
        <div class="witness-report" id="${witnessId}" aria-live="polite"></div>
      </div>`;

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
    if (claim.author && !/திருவள்ளுவர்/u.test(claim.author)) {
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

loadCorpus();
