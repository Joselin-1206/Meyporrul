const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const corpusPath = path.join(__dirname, '../data/tirukkural_corpus.json');
const rawBytes = fs.readFileSync(corpusPath);
const sha256 = crypto.createHash('sha256').update(rawBytes).digest('hex');

console.log('=== திருக்குறள் தரவுத்தள சரிபார்ப்பு அறிக்கை ===');
console.log('கோப்புப் பாதை:', corpusPath);
console.log('கோப்பின் அளவு (Bytes):', rawBytes.length);
console.log('SHA-256 ஒருமைப்பாடு சரிபார்ப்பு எண்:', sha256);

const data = JSON.parse(rawBytes.toString('utf8'));
console.log('பதிவுகளின் மொத்த எண்ணிக்கை:', data.length);

const seenNumbers = new Set();
const missingNumbers = [];
let emptyTexts = 0;
let invalidChapters = 0;

for (let i = 1; i <= 1330; i++) {
  seenNumbers.add(i);
}

const foundNumbers = new Set();
data.forEach((entry, idx) => {
  if (!entry.number || typeof entry.number !== 'number') {
    console.error(`பிழை: பதிவு ${idx}-ல் குறள் எண் இல்லை`);
  } else {
    if (foundNumbers.has(entry.number)) {
      console.error(`பிழை: குறள் எண் ${entry.number} இருமுறை உள்ளது!`);
    }
    foundNumbers.add(entry.number);
  }

  if (!entry.line1 || !entry.line2 || !entry.couplet) {
    emptyTexts++;
  }

  if (!entry.chapterNumber || entry.chapterNumber < 1 || entry.chapterNumber > 133) {
    invalidChapters++;
  }
});

for (let i = 1; i <= 1330; i++) {
  if (!foundNumbers.has(i)) {
    missingNumbers.push(i);
  }
}

console.log('விடுபட்ட எண்கள்:', missingNumbers.length === 0 ? 'எதுவுமில்லை (முழுமையானது)' : missingNumbers);
console.log('வெற்று உரைகள்:', emptyTexts);
console.log('தவறான அதிகார எண்கள்:', invalidChapters);
console.log('முதல் குறள்:', data[0].number, data[0].chapter, data[0].line1);
console.log('கடைசி குறள்:', data[data.length - 1].number, data[data.length - 1].chapter, data[data.length - 1].line1);
console.log('தற்போதைய பதிப்புப் புலம்:', data[0].edition);

module.exports = { sha256, count: data.length };
