const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const corpusFile = path.join(__dirname, '../data/tirukkural_corpus.json');
const buffer = fs.readFileSync(corpusFile);
const actualSha256 = crypto.createHash('sha256').update(buffer).digest('hex');
const items = JSON.parse(buffer.toString('utf8'));

console.log('=== தணிக்கை அறிக்கை 1: தரவுத்தள சரிபார்ப்பு ===');
console.log('கோப்பின் அளவு (பைட்டுகள்):', buffer.length);
console.log('கணக்கிடப்பட்ட உண்மை SHA-256:', actualSha256);
console.log('மொத்தப் பதிவுகள்:', items.length);

const numSet = new Set();
const duplicates = [];
const missing = [];
let malformed = 0;

items.forEach((item, index) => {
  if (numSet.has(item.number)) {
    duplicates.push(item.number);
  }
  numSet.add(item.number);

  if (!item.number || !item.line1 || !item.line2 || !item.couplet || !item.chapter || !item.chapterNumber || !item.sourceUrl) {
    malformed++;
    console.error(`செம்மையற்ற பதிவு: ${index + 1}`);
  }
});

for (let i = 1; i <= 1330; i++) {
  if (!numSet.has(i)) {
    missing.push(i);
  }
}

console.log('விடுபட்ட குறள் எண்கள்:', missing.length === 0 ? 'எதுவுமில்லை (1 முதல் 1330 வரை முழுமை)' : missing);
console.log('இருமுறை வந்த குறள் எண்கள்:', duplicates.length === 0 ? 'எதுவுமில்லை' : duplicates);
console.log('செம்மையற்ற பதிவுகள்:', malformed);
console.log('தரவகம் (Source URL):', items[0].sourceUrl);
console.log('பதிப்பு / குறிப்பு:', items[0].edition);

// Generate corpus_meta.js with actual SHA-256 and metadata dynamically so browser can access it without hardcoding
const metaData = {
  sha256: actualSha256,
  totalItems: items.length,
  sourceUrl: items[0].sourceUrl,
  datasetLabel: 'திறந்தநிலைத் திருக்குறள் தரவுத்தொகுப்பு (GitHub: tk120404/thirukkural)',
  lastAudited: new Date().toISOString()
};

fs.writeFileSync(path.join(__dirname, '../data/corpus_meta.json'), JSON.stringify(metaData, null, 2), 'utf8');
fs.writeFileSync(path.join(__dirname, '../data/corpus_meta.js'), 'window.CORPUS_META = ' + JSON.stringify(metaData) + ';\n', 'utf8');
console.log('corpus_meta.js மற்றும் corpus_meta.json உண்மையான கோப்பு ஹாஷுடன் வெற்றிகரமாகப் புதுப்பிக்கப்பட்டன.');
