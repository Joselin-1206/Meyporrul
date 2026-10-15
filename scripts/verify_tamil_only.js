const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

// Strip script and style blocks
const cleanHtml = html
  .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
  // strip source URLs, SHA-256 and hexadecimal hash
  .replace(/https:\/\/github\.com\/tk120404\/thirukkural/g, '')
  .replace(/SHA-256:\s*[a-f0-9]{64}/gi, '')
  .replace(/SHA-256/g, '')
  .replace(/GitHub:\s*tk120404\/thirukkural/g, '')
  // strip HTML tags
  .replace(/<[^>]+>/g, ' ');

// Match any english words (a-z, A-Z) of length > 1 (excluding allowed 'AI')
const englishWords = (cleanHtml.match(/[a-zA-Z]{2,}/g) || []).filter(w => w !== 'AI');

console.log('Detected English words in HTML text content:', englishWords);
if (englishWords.length > 0) {
  console.log('Warning: Some English words found in HTML text!');
  process.exit(1);
} else {
  console.log('SUCCESS: Zero unpermitted English words in user-visible HTML content!');
}
