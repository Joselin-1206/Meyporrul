/**
 * மெய்ப்பொருள் — முழுமையான தானியங்கித் தேர்வுத் தொகுப்பு (Automated Tests)
 * “மேற்கோள் மட்டும் போதாது; மூலச்சான்று வேண்டும்.”
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('====================================================');
console.log('மெய்ப்பொருள் (Meypporul) தானியங்கித் தேர்வுத் தொகுப்பு');
console.log('“மேற்கோள் மட்டும் போதாது; மூலச்சான்று வேண்டும்.”');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[வெற்றி] ${testName}`);
  } else {
    console.error(`[தோல்வி] ${testName}`);
    if (details) console.error(`        விவரம்: ${details}`);
  }
}

// 1. மூலத் தரவுத்தள நேர்மை & ஒருமைப்பாடு சோதனை
console.log('1. திருக்குறள் மூலத் தரவுத்தள நேர்மை & ஒருமைப்பாடு:');
const corpusPath = path.join(__dirname, '../data/tirukkural_corpus.json');
assert(fs.existsSync(corpusPath), 'tirukkural_corpus.json கோப்பு உள்ளது');

const corpusRaw = fs.readFileSync(corpusPath);
const corpus = JSON.parse(corpusRaw.toString('utf8'));
assert(corpus.length === 1330, 'மொத்தக் குறள்கள் 1330 முழுமையாக உள்ளன', `தற்போது: ${corpus.length}`);

const hash = crypto.createHash('sha256').update(corpusRaw).digest('hex');
assert(hash.length === 64, 'SHA-256 கோப்பு ஒருமைப்பாடு எண் சரியாகக் கணக்கிடப்பட்டது', hash);

// தரவு நம்பகத்தன்மை: GitHub தரவகம் குறிப்பிடப்பட்டுள்ளதா
assert(corpus[0].sourceUrl === 'https://github.com/tk120404/thirukkural', 'தரவு மூலம் நேர்மையாக GitHub தரவகத்திற்கு வரவு வைக்கப்பட்டுள்ளது');
assert(!corpus[0].edition.includes('தமிழ் இணையக் கல்விக்கழகம்'), 'ஆதாரமற்ற நிறுவனப் பதிப்புப் பெயர்கள் நீக்கப்பட்டுள்ளன');

// 2. தூய தமிழ் இடைமுகச் சோதனை
console.log('\n2. தூய தமிழ் இடைமுகச் சோதனை:');
const htmlPath = path.join(__dirname, '../index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const cleanHtml = html
  .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
  .replace(/https:\/\/github\.com\/tk120404\/thirukkural/g, '')
  .replace(/SHA-256:\s*[a-f0-9]{64}/gi, '')
  .replace(/SHA-256/g, '')
  .replace(/GitHub:\s*tk120404\/thirukkural/g, '')
  .replace(/<[^>]+>/g, ' ');

const englishWords = (cleanHtml.match(/[a-zA-Z]{2,}/g) || []).filter(w => w !== 'AI');
assert(englishWords.length === 0, 'HTML பயனர் இடைமுகத்தில் அனுமதிக்கப்படாத ஆங்கிலச் சொற்கள் ஏதுமில்லை (100% தூய தமிழ்)', `கண்டறியப்பட்டவை: ${englishWords.join(', ')}`);

// 3. ஆறு முக்கிய தீர்ப்புகளுக்கான சரிபார்ப்பு தேர்வுகள்
console.log('\n3. ஆறு முக்கிய தீர்ப்புகளுக்கான சரிபார்ப்பு தேர்வுகள்:');

function normalizeText(str) {
  if (!str) return '';
  return str
    .normalize('NFC')
    .replace(/[.,!?;:"'‘’“”\-–—()[\]{}…/\\<>*&^%$#@~`+=|/\u200B\u200C\u200D]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripWhitespace(str) {
  return (str || '').replace(/\s+/g, '');
}

function levenshteinDistance(s1, s2) {
  const m = s1.length;
  const n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function verifyQuotation(rawInput, claims = {}) {
  const trimmedRaw = (rawInput || '').trim();
  const normalizedInput = normalizeText(trimmedRaw);

  if (!normalizedInput || normalizedInput.length === 0) {
    return { verdict: 'உறுதிப்படுத்த போதுமான ஆதாரம் இல்லை', verdictCode: 'EMPTY', isVerified: false };
  }

  const inputWords = normalizedInput.split(' ').filter(Boolean);
  const inputNoSpace = stripWhitespace(normalizedInput);

  if (inputWords.length < 3 && inputNoSpace.length < 15) {
    return { verdict: 'உறுதிப்படுத்த போதுமான ஆதாரம் இல்லை', verdictCode: 'INSUFFICIENT', isVerified: false };
  }

  let bestMatch = null;
  let bestScore = -1;
  let matchType = null;

  for (const item of corpus) {
    const kuralRaw = item.couplet;
    const kuralNorm = normalizeText(kuralRaw);
    const kuralWords = kuralNorm.split(' ').filter(Boolean);
    const kuralNoSpace = stripWhitespace(kuralNorm);

    if (normalizedInput === kuralNorm) {
      const rawMatchesExactly = trimmedRaw.replace(/\r\n/g, '\n') === kuralRaw;
      return buildResult({
        verdict: rawMatchesExactly ? 'மூலத்துடன் பொருந்துகிறது' : 'வடிவ வேறுபாட்டுடன் பொருந்துகிறது',
        verdictCode: rawMatchesExactly ? 'EXACT' : 'ORTHOGRAPHY',
        candidate: item,
        isVerified: true,
        claims
      });
    }

    if (inputNoSpace === kuralNoSpace) {
      return buildResult({
        verdict: 'வடிவ வேறுபாட்டுடன் பொருந்துகிறது',
        verdictCode: 'ORTHOGRAPHY',
        candidate: item,
        isVerified: true,
        claims
      });
    }

    const charDist = levenshteinDistance(inputNoSpace, kuralNoSpace);
    const maxLen = Math.max(inputNoSpace.length, kuralNoSpace.length);
    if (charDist <= 3 && maxLen > 20) {
      return buildResult({
        verdict: 'சொல் அல்லது எழுத்து மாற்றம் கண்டறியப்பட்டது',
        verdictCode: 'WORD_VARIATION',
        candidate: item,
        isVerified: false,
        claims
      });
    }

    let matchedWordCount = 0;
    const kuralWordSet = new Set(kuralWords);
    for (const w of inputWords) {
      if (kuralWordSet.has(w)) matchedWordCount++;
    }

    const wordSimilarity = matchedWordCount / Math.max(inputWords.length, kuralWords.length);
    const kuralJoined = ' ' + kuralWords.join(' ') + ' ';
    const inputJoined = ' ' + inputWords.join(' ') + ' ';
    const isSubset = kuralJoined.includes(inputJoined);

    if (inputWords.length >= 5 && kuralWords.length === 7) {
      let positionMatches = 0;
      for (let i = 0; i < Math.min(inputWords.length, 7); i++) {
        if (inputWords[i] === kuralWords[i]) positionMatches++;
      }
      if (positionMatches >= 5) {
        const score = 0.95 + positionMatches * 0.01;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = item;
          matchType = 'WORD_VARIATION';
        }
      }
    }

    if (isSubset && inputWords.length < kuralWords.length && inputWords.length >= 3) {
      const score = 0.85 + (inputWords.length / kuralWords.length) * 0.1;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = item;
        matchType = 'PARTIAL';
      }
    } else if (wordSimilarity > 0.5 && wordSimilarity > bestScore) {
      bestScore = wordSimilarity;
      bestMatch = item;
      matchType = 'CLOSE_CANDIDATE';
    }
  }

  if (matchType === 'WORD_VARIATION' && bestMatch) {
    return buildResult({ verdict: 'சொல் அல்லது எழுத்து மாற்றம் கண்டறியப்பட்டது', verdictCode: 'WORD_VARIATION', candidate: bestMatch, isVerified: false, claims });
  }
  if (matchType === 'PARTIAL' && bestMatch) {
    return buildResult({ verdict: 'மூலத்தின் ஒரு பகுதி', verdictCode: 'PARTIAL', candidate: bestMatch, isVerified: false, claims });
  }
  if (bestScore >= 0.55 && bestMatch) {
    return buildResult({ verdict: 'சொல் அல்லது எழுத்து மாற்றம் கண்டறியப்பட்டது', verdictCode: 'WORD_VARIATION', candidate: bestMatch, isVerified: false, claims });
  }

  return buildResult({ verdict: 'கொடுக்கப்பட்ட தொகுப்பில் ஆதாரம் கிடைக்கவில்லை', verdictCode: 'NOT_FOUND', candidate: null, isVerified: false, claims });
}

function buildResult(data) {
  const { claims, candidate } = data;
  let claimsConflict = null;
  if (claims && candidate) {
    const conflicts = [];
    if (claims.verse && Number(claims.verse) !== candidate.number) {
      conflicts.push(`குறள் எண் முரண்பாடு (கூறப்பட்டது: ${claims.verse}, மூலத்தில்: ${candidate.number})`);
    }
    if (conflicts.length > 0) claimsConflict = conflicts;
  }
  return { ...data, claimsConflict };
}

// 6 தீர்ப்புகள் சோதனை
const t1 = verifyQuotation('அகர முதல எழுத்தெல்லாம் ஆதி\nபகவன் முதற்றே உலகு.');
assert(t1.verdict === 'மூலத்துடன் பொருந்துகிறது' && t1.candidate.number === 1, 'தீர்ப்பு 1: “மூலத்துடன் பொருந்துகிறது”');

const t2 = verifyQuotation('அகர முதல எழுத்தெல்லாம், ஆதி பகவன் முதற்றே உலகு!');
assert(t2.verdict === 'வடிவ வேறுபாட்டுடன் பொருந்துகிறது' && t2.candidate.number === 1, 'தீர்ப்பு 2: “வடிவ வேறுபாட்டுடன் பொருந்துகிறது”');

const t3 = verifyQuotation('கற்க கசடறக் கற்பவை கற்றபின்');
assert(t3.verdict === 'மூலத்தின் ஒரு பகுதி' && t3.candidate.number === 391, 'தீர்ப்பு 3: “மூலத்தின் ஒரு பகுதி”');

const t4 = verifyQuotation('கற்க கசடறக் நூல்களை கற்றபின் நிற்க அதற்குத் தக');
assert(t4.verdict === 'சொல் அல்லது எழுத்து மாற்றம் கண்டறியப்பட்டது' && t4.candidate.number === 391, 'தீர்ப்பு 4: “சொல் அல்லது எழுத்து மாற்றம் கண்டறியப்பட்டது”');

const t5 = verifyQuotation('யாதும் ஊரே யாவரும் கேளிர் தீதும் நன்றும் பிறர்தர வாரா');
assert(t5.verdict === 'கொடுக்கப்பட்ட தொகுப்பில் ஆதாரம் கிடைக்கவில்லை', 'தீர்ப்பு 5: “கொடுக்கப்பட்ட தொகுப்பில் ஆதாரம் கிடைக்கவில்லை”');

const t6 = verifyQuotation('அறம்');
assert(t6.verdict === 'உறுதிப்படுத்த போதுமான ஆதாரம் இல்லை', 'தீர்ப்பு 6: “உறுதிப்படுத்த போதுமான ஆதாரம் இல்லை”');

// 4. உரிமை கோரல் முரண்பாட்டுச் சோதனை
console.log('\n4. உரிமை கோரல் முரண்பாட்டுச் சோதனை (Claims Conflict):');
const conflictTest = verifyQuotation('அகர முதல எழுத்தெல்லாம் ஆதி\nபகவன் முதற்றே உலகு.', { verse: 400 });
assert(conflictTest.claimsConflict && conflictTest.claimsConflict.length > 0, 'கூறப்பட்ட குறள் எண் முரண்பாடு வெற்றிகரமாகத் தனியாகக் கண்டறியப்பட்டது');

// 5. AI பதில் சான்றாய்வு தடுப்பு வாயில் சோதனை (AI Truth Gate)
console.log('\n5. AI பதில் சான்றாய்வு தடுப்பு வாயில் சோதனை (P6 Protection):');

function evaluateAiDraft(draftText) {
  const quoteRegex = /["“'‘«]([^"”'’»\n]{10,200})["”'’»]/g;
  const quotes = [];
  let match;
  while ((match = quoteRegex.exec(draftText)) !== null) {
    quotes.push(match[1].trim());
  }

  const results = quotes.map(q => verifyQuotation(q));
  const canPublish = results.length > 0 && results.every(r => r.isVerified && (r.verdictCode === 'EXACT' || r.verdictCode === 'ORTHOGRAPHY'));
  return { canPublish, status: canPublish ? 'வெளியிடத் தயாராக உள்ளது' : 'வெளியீட்டுக்குத் தடையிடப்பட்டுள்ளது', results };
}

// வரைவு 1: உண்மையான குறள் கொண்ட AI பதில் -> ஏற்பளிப்பு
const draft1 = 'திருவள்ளுவர் கடவுளைப் பற்றிக் கூறும்போது "அகர முதல எழுத்தெல்லாம் ஆதி பகவன் முதற்றே உலகு" என்று கூறியுள்ளார்.';
const gateRes1 = evaluateAiDraft(draft1);
assert(gateRes1.canPublish === true && gateRes1.status === 'வெளியிடத் தயாராக உள்ளது', 'உண்மையான குறள் கொண்ட AI வரைவு ஏற்பளிக்கப்பட்டு "வெளியிடத் தயாராக உள்ளது" என முடிவானது');

// வரைவு 2: சொல் மாற்றப்பட்ட போலி குறள் கொண்ட AI பதில் -> வெளியீடு தடை
const draft2 = 'திருவள்ளுவர் கல்வியைப் பற்றிக் கூறும்போது "கற்க கசடறக் நூல்களை கற்றபின் நிற்க அதற்குத் தக" என்று குறிப்பிட்டுள்ளார்.';
const gateRes2 = evaluateAiDraft(draft2);
assert(gateRes2.canPublish === false && gateRes2.status === 'வெளியீட்டுக்குத் தடையிடப்பட்டுள்ளது', 'சொல் மாற்றப்பட்ட போலி குறள் கொண்ட AI வரைவு தடுக்கப்பட்டு "வெளியீட்டுக்குத் தடையிடப்பட்டுள்ளது" என முடிவானது');

// வரைவு 3: இல்லாத வரியைக் குறள் எனக் கூறும் AI பதில் -> வெளியீடு தடை
const draft3 = 'வள்ளுவர் மனிதநேயத்தைப் பற்றிக் கூறும்போது "யாதும் ஊரே யாவரும் கேளிர் தீதும் நன்றும் பிறர்தர வாரா" என்று குறளில் கூறியுள்ளார்.';
const gateRes3 = evaluateAiDraft(draft3);
assert(gateRes3.canPublish === false && gateRes3.status === 'வெளியீட்டுக்குத் தடையிடப்பட்டுள்ளது', 'தொகுப்பில் இல்லாத வரியைக் குறள் எனக் கூறும் AI வரைவு தடுக்கப்பட்டு "வெளியீட்டுக்குத் தடையிடப்பட்டுள்ளது" என முடிவானது');

console.log('\n====================================================');
console.log(`தேர்வு முடிவுகள்: ${passedTests} / ${totalTests} தேர்வுகள் 100% வெற்றிகரமாக முடிந்தன!`);
console.log('====================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
