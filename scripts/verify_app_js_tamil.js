const fs = require('fs');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');

// Look for strings assigned to textContent or innerHTML or verdict
const lines = code.split('\n');
const suspicious = [];

lines.forEach((line, idx) => {
  // Ignore console.log, DOM element IDs, attribute names, class names, data-types, variable declarations
  if (line.includes('console.') || line.includes('getElementById') || line.includes('addEventListener') || line.includes('className') || line.includes('classList') || line.includes('setAttribute') || line.includes('localStorage') || line.includes('fetch(') || line.includes('style.')) {
    return;
  }
  // Check if line sets text or template with English words
  const matches = line.match(/'([^']+)'|"([^"]+)"|`([^`]+)`/g);
  if (matches) {
    matches.forEach(m => {
      // remove quotes
      const clean = m.slice(1, -1);
      // If contains ASCII letters and also Tamil or seems like UI text
      if (/[a-zA-Z]{3,}/.test(clean)) {
        // filter out pure CSS classes, keys, IDs, HTML tags
        if (!clean.includes('-') && !clean.includes('#') && !clean.includes('.') && !clean.includes('token') && !clean.includes('verdict') && !clean.includes('kural') && !clean.includes('data/') && !clean.includes('match') && !clean.includes('altered') && !clean.includes('missing') && !clean.includes('type') && !clean.includes('input') && !clean.includes('canonical')) {
          suspicious.push({ line: idx + 1, text: clean });
        }
      }
    });
  }
});

console.log('Suspicious user strings in app.js:', suspicious);
