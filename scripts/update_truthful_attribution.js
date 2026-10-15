const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dataDir = path.join(__dirname, '../data');
const jsonPath = path.join(dataDir, 'tirukkural_corpus.json');
const jsPath = path.join(dataDir, 'tirukkural_data.js');

const corpus = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

const updated = corpus.map(k => ({
  number: k.number,
  line1: k.line1,
  line2: k.line2,
  couplet: k.couplet,
  work: 'திருக்குறள்',
  author: 'திருவள்ளுவர்',
  section: k.section,
  chapterGroup: k.chapterGroup,
  chapter: k.chapter,
  chapterNumber: k.chapterNumber,
  sourceDataset: 'திறந்தநிலைத் திருக்குறள் தரவுத்தொகுப்பு',
  sourceUrl: 'https://github.com/tk120404/thirukkural',
  edition: 'தரவுத்தொகுப்பு மூலம்: https://github.com/tk120404/thirukkural',
  meaning: k.meaning || ''
}));

fs.writeFileSync(jsonPath, JSON.stringify(updated, null, 2), 'utf8');

const jsContent = '/* மெய்ப்பொருள் — திருக்குறள் மூலத் தரவுத்தளம் (1330 குறள்கள்) */\n' +
  '/* தரவு மூலம்: https://github.com/tk120404/thirukkural */\n' +
  'window.TIRUKKURAL_CORPUS = ' + JSON.stringify(updated) + ';\n';
fs.writeFileSync(jsPath, jsContent, 'utf8');

const updatedRaw = fs.readFileSync(jsonPath);
const newSha256 = crypto.createHash('sha256').update(updatedRaw).digest('hex');

console.log('தரவுத்தொகுப்பு நேர்மை மற்றும் நம்பகத்தன்மை புதுப்பிக்கப்பட்டது:');
console.log('புதிய SHA-256 ஒருமைப்பாடு சரிபார்ப்பு எண்:', newSha256);
console.log('பதிவுகள் எண்ணிக்கை:', updated.length);
console.log('முதல் குறள் மூலம்:', updated[0].edition);

// Save hash info for app display
const metaInfo = {
  itemCount: updated.length,
  sha256: newSha256,
  sourceUrl: 'https://github.com/tk120404/thirukkural',
  sourceDataset: 'திறந்தநிலைத் திருக்குறள் தரவுத்தொகுப்பு (GitHub: tk120404/thirukkural)'
};
fs.writeFileSync(path.join(dataDir, 'corpus_meta.json'), JSON.stringify(metaInfo, null, 2), 'utf8');
