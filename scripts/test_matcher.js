const fs = require('fs');
const path = require('path');

const corpus = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/tirukkural_corpus.json'), 'utf8'));

// Normalization function
function normalizeText(str) {
  if (!str) return '';
  return str
    .normalize('NFC')
    // Replace punctuation with space
    .replace(/[.,!?;:\"'‘’“”\-–—()[\]{}…/\\<>*&^%$#@~`+=|]/g, ' ')
    // Collapse multiple whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

function stripWhitespace(str) {
  return str.replace(/\s+/g, '');
}

// Levenshtein distance
function levenshteinDistance(s1, s2) {
  const m = s1.length;
  const n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // deletion
          dp[i][j - 1],     // insertion
          dp[i - 1][j - 1]  // substitution
        );
      }
    }
  }
  return dp[m][n];
}

// Verify quotation against corpus
function verifyQuotation(rawInput) {
  const trimmedRaw = (rawInput || '').trim();
  const normalizedInput = normalizeText(trimmedRaw);

  if (!normalizedInput || normalizedInput.length === 0) {
    return {
      verdictCode: 'EMPTY',
      verdict: 'உறுதிப்படுத்த போதுமான ஆதாரம் இல்லை',
      explanation: 'சரிபார்க்க எந்தவொரு உரையையும் நீங்கள் உள்ளிடவில்லை. தயவுசெய்து ஒரு குறளை உள்ளிடவும்.',
      candidate: null,
      details: null
    };
  }

  const inputWords = normalizedInput.split(' ').filter(Boolean);
  const inputNoSpace = stripWhitespace(normalizedInput);

  // Insufficient evidence rule: fewer than 3 words and length < 15
  if (inputWords.length < 3 && inputNoSpace.length < 15) {
    return {
      verdictCode: 'INSUFFICIENT',
      verdict: 'உறுதிப்படுத்த போதுமான ஆதாரம் இல்லை',
      explanation: `உள்ளீடு செய்யப்பட்ட உரை மிகக் குறுகியதாக உள்ளது (${inputWords.length} சொல்/சொற்கள்). திருக்குறளின் குறிப்பிட்ட ஒரு பாடலைத் துல்லியமாக உறுதிப்படுத்த குறைந்தபட்சம் ஒரு முழு அடியோ (4 சீர்கள்) அல்லது பல சொற்களோ தேவை.`,
      candidate: null,
      details: {
        wordCount: inputWords.length,
        charCount: inputNoSpace.length
      }
    };
  }

  let bestMatch = null;
  let bestScore = -1;
  let matchType = null;
  let wordDiffInfo = null;

  for (const item of corpus) {
    const kuralRaw = item.couplet;
    const kuralNorm = normalizeText(kuralRaw);
    const kuralWords = kuralNorm.split(' ').filter(Boolean);
    const kuralNoSpace = stripWhitespace(kuralNorm);

    // 1. Exact string match after normalization
    if (normalizedInput === kuralNorm) {
      // Check if original had punctuation/spacing differences
      const rawMatchesExactly = trimmedRaw.replace(/\r\n/g, '\n') === kuralRaw;
      return {
        verdictCode: rawMatchesExactly ? 'EXACT' : 'ORTHOGRAPHY',
        verdict: rawMatchesExactly ? 'மூலத்துடன் பொருந்துகிறது' : 'எழுத்து / இடைவெளி வேறுபாடு உள்ளது',
        explanation: rawMatchesExactly
          ? 'உள்ளீடு செய்யப்பட்ட வரிகள் திருக்குறள் மூலப் பாடத்தோடு எழுத்து, சீர், வரி அமைப்பு என அனைத்திலும் முழுமையாக ஒத்துப் போகின்றன.'
          : 'மூலக் குறளின் அனைத்துச் சொற்களும் முழுமையாக உள்ளன; ஆயினும் நிறுத்தக்குறிகள் அல்லது வரிகளுக்கு இடையிலான இடைவெளியில் சிறு வேறுபாடு உள்ளது.',
        candidate: item,
        isVerified: true,
        details: {
          inputWords,
          canonicalWords: kuralWords,
          differenceNote: rawMatchesExactly ? 'முழுமையான மூலப் பொருத்தம்' : 'நிறுத்தக்குறி / இடைவெளி மாற்றம் மட்டும்'
        }
      };
    }

    // 2. Continuous characters match exactly without space (spacing difference only)
    if (inputNoSpace === kuralNoSpace) {
      return {
        verdictCode: 'ORTHOGRAPHY',
        verdict: 'எழுத்து / இடைவெளி வேறுபாடு உள்ளது',
        explanation: 'குறளின் எழுத்துகள் அனைத்தும் சரியாக உள்ளன. ஆயினும் சீர்கள் (சொற்கள்) பிரிக்கப்பட்ட முறையில் இடைவெளி வேறுபாடு காணப்படுகிறது.',
        candidate: item,
        isVerified: true,
        details: {
          inputWords,
          canonicalWords: kuralWords,
          differenceNote: 'சீர் பிரிப்பு / இடைவெளி வேறுபாடு'
        }
      };
    }

    // 3. Very close edit distance on full text (minor spelling typo)
    const charDist = levenshteinDistance(inputNoSpace, kuralNoSpace);
    const maxLen = Math.max(inputNoSpace.length, kuralNoSpace.length);
    if (charDist <= 3 && maxLen > 20) {
      return {
        verdictCode: 'ORTHOGRAPHY',
        verdict: 'எழுத்து / இடைவெளி வேறுபாடு உள்ளது',
        explanation: `மூலக் குறளோடு ஒப்பிடுகையில் ${charDist} எழுத்துப் பிழை/வேறுபாடு மட்டுமே உள்ளது. இது மூலக் குறளின் மிக நெருங்கிய வடிவமாகும்.`,
        candidate: item,
        isVerified: true,
        details: {
          inputWords,
          canonicalWords: kuralWords,
          charDist,
          differenceNote: `${charDist} எழுத்து வேறுபாடு கண்டறியப்பட்டது`
        }
      };
    }

    // 4. Word-level analysis
    let matchedWordCount = 0;
    const diffs = [];
    const minWords = Math.min(inputWords.length, kuralWords.length);

    // Check consecutive subset match (partial line match)
    const kuralJoined = ' ' + kuralWords.join(' ') + ' ';
    const inputJoined = ' ' + inputWords.join(' ') + ' ';
    const isSubset = kuralJoined.includes(inputJoined);

    // Count matching words
    const kuralWordSet = new Set(kuralWords);
    for (const w of inputWords) {
      if (kuralWordSet.has(w)) {
        matchedWordCount++;
      }
    }

    // Word similarity ratio
    const wordSimilarity = matchedWordCount / Math.max(inputWords.length, kuralWords.length);
    const inputCoverage = matchedWordCount / inputWords.length;

    // Check for Word Substitution (e.g., 5 or 6 words match out of 7)
    if (inputWords.length >= 5 && kuralWords.length === 7) {
      let positionMatches = 0;
      const substitutedWords = [];
      for (let i = 0; i < Math.min(inputWords.length, 7); i++) {
        if (inputWords[i] === kuralWords[i]) {
          positionMatches++;
        } else {
          substitutedWords.push({
            position: i + 1,
            entered: inputWords[i],
            canonical: kuralWords[i]
          });
        }
      }
      if (positionMatches >= 5 && substitutedWords.length <= 2) {
        const score = 0.95 + positionMatches * 0.01;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = item;
          matchType = 'WORD_VARIATION';
          wordDiffInfo = {
            positionMatches,
            substitutedWords,
            inputWords,
            canonicalWords: kuralWords
          };
        }
      }
    }

    // Check for Partial Match (subset of consecutive words or full line match)
    if (isSubset && inputWords.length < kuralWords.length && inputWords.length >= 3) {
      const score = 0.85 + (inputWords.length / kuralWords.length) * 0.1;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = item;
        matchType = 'PARTIAL';
        wordDiffInfo = {
          matchedWords: inputWords,
          canonicalWords: kuralWords,
          isSubset: true
        };
      }
    } else if (wordSimilarity > 0.5 && wordSimilarity > bestScore) {
      bestScore = wordSimilarity;
      bestMatch = item;
      matchType = 'CLOSE_CANDIDATE';
      wordDiffInfo = {
        matchedWordCount,
        inputWords,
        canonicalWords: kuralWords,
        similarity: wordSimilarity
      };
    }
  }

  if (matchType === 'WORD_VARIATION' && bestMatch) {
    const changes = wordDiffInfo.substitutedWords
      .map(s => `சீர் ${s.position}: "${s.entered}" (மூலத்தில்: "${s.canonical}")`)
      .join(', ');
    return {
      verdictCode: 'WORD_VARIATION',
      verdict: 'சொல் மாற்றம் இருக்கலாம்',
      explanation: `குறள் ${bestMatch.number}-ன் பெரும்பாலான சொற்கள் பொருந்துகின்றன. எனினும் சில சொற்களில் மாற்றம் செய்யப்பட்டுள்ளது காணப்படுகிறது (${changes}).`,
      candidate: bestMatch,
      isVerified: false,
      details: wordDiffInfo
    };
  }

  if (matchType === 'PARTIAL' && bestMatch) {
    return {
      verdictCode: 'PARTIAL',
      verdict: 'பகுதி மட்டும் பொருந்துகிறது',
      explanation: `உள்ளீடு செய்யப்பட்ட வரிகள் குறள் எண் ${bestMatch.number}-ன் ஒரு பகுதியாக (முதலடி அல்லது குறிப்பிட்ட தொடராக) மட்டுமே உள்ளன. முழு குறளும் வழங்கப்படவில்லை.`,
      candidate: bestMatch,
      isVerified: false,
      details: wordDiffInfo
    };
  }

  if (bestScore >= 0.55 && bestMatch) {
    return {
      verdictCode: 'WORD_VARIATION',
      verdict: 'சொல் மாற்றம் இருக்கலாம்',
      explanation: `குறள் எண் ${bestMatch.number}-உடன் நெருங்கிய சொல் ஒப்புமை உள்ளது. ஆயினும் பல சொற்களில் வேறுபாடு இருப்பதால் இது முழுமையாக உறுதிப்படுத்தப்படவில்லை.`,
      candidate: bestMatch,
      isVerified: false,
      details: wordDiffInfo
    };
  }

  // Not found in source
  return {
    verdictCode: 'NOT_FOUND',
    verdict: 'கொடுக்கப்பட்ட மூலத்தில் கிடைக்கவில்லை',
    explanation: 'உள்ளீடு செய்யப்பட்ட மேற்கோள் இத்தொகுப்பில் உள்ள 1330 திருக்குறள் மூலப் பாடங்களிலும் காணப்படவில்லை. இது வேறு சங்க இலக்கியப் பாடலாகவோ அல்லது தற்கால மேற்கோளாகவோ இருக்கலாம்.',
    candidate: null,
    details: {
      searchedCorpusCount: corpus.length
    }
  };
}

// Run test cases
const testCases = [
  {
    name: '1. Exact match',
    input: 'அகர முதல எழுத்தெல்லாம் ஆதி\nபகவன் முதற்றே உலகு.'
  },
  {
    name: '2. Punctuation/spacing variance',
    input: 'அகர முதல எழுத்தெல்லாம், ஆதி பகவன் முதற்றே உலகு!'
  },
  {
    name: '3. Sandhi/spacing joined',
    input: 'அகரமுதல எழுத்தெல்லாம் ஆதிபகவன் முதற்றே உலகு'
  },
  {
    name: '4. Partial match (Line 1 only)',
    input: 'கற்க கசடறக் கற்பவை கற்றபின்'
  },
  {
    name: '5. Word variation/substitution',
    input: 'கற்க கசடறக் நூல்களை கற்றபின் நிற்க அதற்குத் தக'
  },
  {
    name: '6. Not found (Puranaanooru)',
    input: 'யாதும் ஊரே யாவரும் கேளிர் தீதும் நன்றும் பிறர்தர வாரா'
  },
  {
    name: '7. Insufficient evidence (1 word)',
    input: 'அறம்'
  }
];

console.log('Running matcher tests:');
for (const tc of testCases) {
  const res = verifyQuotation(tc.input);
  console.log(`\n--- ${tc.name} ---`);
  console.log('Input:', tc.input.replace(/\n/g, ' '));
  console.log('Verdict:', res.verdict);
  console.log('VerdictCode:', res.verdictCode);
  if (res.candidate) console.log('Matched Kural #:', res.candidate.number, res.candidate.chapter);
  console.log('Explanation:', res.explanation);
}
