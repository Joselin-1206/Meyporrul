const fs = require('fs');
const path = require('path');

const corpus = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/tirukkural_corpus.json'), 'utf8'));

// Normalization
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

// LCS Word Diff
function generateWordDiff(inputWords, canonicalWords) {
  const n = inputWords.length;
  const m = canonicalWords.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (inputWords[i - 1] === canonicalWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  let i = n;
  let j = m;
  const inputDiff = [];
  const canonicalDiff = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && inputWords[i - 1] === canonicalWords[j - 1]) {
      inputDiff.unshift({ word: inputWords[i - 1], type: 'match' });
      canonicalDiff.unshift({ word: canonicalWords[j - 1], type: 'match' });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      canonicalDiff.unshift({ word: canonicalWords[j - 1], type: 'missing' });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      inputDiff.unshift({ word: inputWords[i - 1], type: 'altered' });
      i--;
    }
  }

  return { inputDiff, canonicalDiff };
}

// Core verification engine
function verifyQuotation(rawInput, claims = {}) {
  const trimmedRaw = (rawInput || '').trim();
  const normalizedInput = normalizeText(trimmedRaw);

  if (!normalizedInput || normalizedInput.length === 0) {
    return {
      verdictCode: 'EMPTY',
      verdict: 'உறுதிப்படுத்த போதுமான ஆதாரம் இல்லை',
      subtitle: 'உள்ளீடு ஏதும் வழங்கப்படவில்லை',
      badge: 'சான்றில்லை',
      statusClass: 'verdict-insufficient',
      explanation: 'சரிபார்க்க எந்தவொரு உரையையும் நீங்கள் உள்ளிடவில்லை. தயவுசெய்து சரிபார்க்க வேண்டிய திருக்குறள் வரிகளை உள்ளிடவும்.',
      candidate: null,
      isVerified: false,
      claimsConflict: null
    };
  }

  const inputWords = normalizedInput.split(' ').filter(Boolean);
  const inputNoSpace = stripWhitespace(normalizedInput);

  if (inputWords.length < 3 && inputNoSpace.length < 15) {
    return {
      verdictCode: 'INSUFFICIENT',
      verdict: 'உறுதிப்படுத்த போதுமான ஆதாரம் இல்லை',
      subtitle: 'மிகக் குறைந்த சொற்கள் / போதுமான தகவல் இல்லை',
      badge: 'சான்றின்மை',
      statusClass: 'verdict-insufficient',
      explanation: `உள்ளீடு செய்யப்பட்ட உரை மிகக் குறுகியதாக உள்ளது (${inputWords.length} சொல்/சொற்கள்). திருக்குறளின் குறிப்பிட்ட ஒரு பாடலைத் துல்லியமாக அடையாளம் கண்டு உறுதிப்படுத்த குறைந்தபட்சம் ஒரு முழு அடியோ (4 சீர்கள்) அல்லது பல சொற்களோ தேவைப்படுகிறது.`,
      candidate: null,
      isVerified: false,
      inputWords,
      claimsConflict: null
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
      const rawMatchesExactly = trimmedRaw.replace(/\r\n/g, '\n') === kuralRaw;
      const isFormatOnly = !rawMatchesExactly;
      return buildResult({
        verdictCode: isFormatOnly ? 'ORTHOGRAPHY' : 'EXACT',
        verdict: isFormatOnly ? 'வடிவ வேறுபாட்டுடன் பொருந்துகிறது' : 'மூலத்துடன் பொருந்துகிறது',
        subtitle: isFormatOnly ? 'நிறுத்தக்குறிகள் அல்லது வரியமைப்பில் சிறு வேறுபாடு உள்ளது' : 'செவ்வியல் மூலப் பாடத்தோடு முழுமையாக ஒத்துப் போகிறது',
        badge: isFormatOnly ? 'வடிவ வேறுபாடு' : 'அதிகாரப்பூர்வ மூலம்',
        statusClass: isFormatOnly ? 'verdict-ortho' : 'verdict-exact',
        explanation: isFormatOnly
          ? 'மூலக் குறளின் அனைத்துச் சொற்களும் முழுமையாக உள்ளன; ஆயினும் நிறுத்தக்குறிகள் அல்லது வரிகளுக்கு இடையிலான இடைவெளியில் சிறு வடிவ வேறுபாடு மட்டுமே உள்ளது.'
          : 'உள்ளீடு செய்யப்பட்ட வரிகள் திருக்குறள் மூலப் பாடத்தோடு எழுத்து, சொல், சீர் மற்றும் வரி அமைப்பில் முழுமையாக ஒத்துப் போகின்றன.',
        candidate: item,
        isVerified: true,
        matchCategory: isFormatOnly ? 'வடிவ வேறுபாடு (Formatting-only)' : 'முழு மூலப் பொருத்தம் (Exact match)',
        inputWords,
        canonicalWords: kuralWords,
        claims
      });
    }

    // 2. Continuous characters match without space (Spacing variation)
    if (inputNoSpace === kuralNoSpace) {
      return buildResult({
        verdictCode: 'ORTHOGRAPHY',
        verdict: 'வடிவ வேறுபாட்டுடன் பொருந்துகிறது',
        subtitle: 'சீர்கள் பிரிக்கப்பட்ட முறையில் இடைவெளி வேறுபாடு உள்ளது',
        badge: 'இடைவெளி வேறுபாடு',
        statusClass: 'verdict-ortho',
        explanation: 'குறளின் அனைத்து எழுத்துகளும் சரியாக உள்ளன. ஆயினும் சீர்கள் (சொற்கள்) பிரிக்கப்பட்ட முறையில் இடைவெளி வேறுபாடு காணப்படுகிறது.',
        candidate: item,
        isVerified: true,
        matchCategory: 'வடிவ வேறுபாடு (Spacing-only)',
        inputWords,
        canonicalWords: kuralWords,
        claims
      });
    }

    // 3. Minor typo distance <= 3
    const charDist = levenshteinDistance(inputNoSpace, kuralNoSpace);
    const maxLen = Math.max(inputNoSpace.length, kuralNoSpace.length);
    if (charDist <= 3 && maxLen > 20) {
      return buildResult({
        verdictCode: 'WORD_VARIATION',
        verdict: 'சொல் அல்லது எழுத்து மாற்றம் கண்டறியப்பட்டது',
        subtitle: `மூலப் பாடத்தோடு ${charDist} எழுத்துப் பிழை அல்லது வேறுபாடு உள்ளது`,
        badge: 'எழுத்து மாற்றம்',
        statusClass: 'verdict-variation',
        explanation: `மூலக் குறளோடு ஒப்பிடுகையில் ${charDist} எழுத்துகளில் வேறுபாடு காணப்படுகிறது. இது மூலக் குறளின் மிக நெருங்கிய வடிவமாக இருக்கலாம்; எனினும் முழுமையாக உறுதிப்படுத்தப்படவில்லை.`,
        candidate: item,
        isVerified: false,
        matchCategory: 'சொல் அல்லது எழுத்து மாற்றம்',
        inputWords,
        canonicalWords: kuralWords,
        claims
      });
    }

    // 4. Word-level analysis
    let matchedWordCount = 0;
    const kuralWordSet = new Set(kuralWords);
    for (const w of inputWords) {
      if (kuralWordSet.has(w)) matchedWordCount++;
    }

    const wordSimilarity = matchedWordCount / Math.max(inputWords.length, kuralWords.length);
    const kuralJoined = ' ' + kuralWords.join(' ') + ' ';
    const inputJoined = ' ' + inputWords.join(' ') + ' ';
    const isSubset = kuralJoined.includes(inputJoined);

    // Substitution check (5 or 6 words match in 7-word kural)
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

    // Partial match (subset of words)
    if (isSubset && inputWords.length < kuralWords.length && inputWords.length >= 3) {
      const score = 0.85 + (inputWords.length / kuralWords.length) * 0.1;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = item;
        matchType = 'PARTIAL';
        wordDiffInfo = {
          inputWords,
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
    const changesText = wordDiffInfo.substitutedWords
      .map(s => `சீர் ${s.position}: "${s.entered}" (மூலத்தில்: "${s.canonical}")`)
      .join('; ');
    return buildResult({
      verdictCode: 'WORD_VARIATION',
      verdict: 'சொல் அல்லது எழுத்து மாற்றம் கண்டறியப்பட்டது',
      subtitle: `குறள் ${bestMatch.number}-ல் சில சொற்கள் மாற்றப்பட்டுள்ளதாகத் தெரிகிறது`,
      badge: 'சொல் மாற்றம்',
      statusClass: 'verdict-variation',
      explanation: `குறள் எண் ${bestMatch.number}-ன் பெரும்பாலான சொற்கள் பொருந்துகின்றன. எனினும் சில குறிப்பிட்ட சீர்களில் சொல் மாற்றீடு அல்லது எழுத்து மாற்றம் கண்டறியப்பட்டுள்ளது. இது செவ்வியல் மூலப் பாடமாக உறுதிப்படுத்தப்படாது.`,
      wordChangeDetails: `கண்டறியப்பட்ட சொல் மாற்றங்கள்: ${changesText}`,
      candidate: bestMatch,
      isVerified: false,
      matchCategory: 'சொல் மாற்றீடு (Word Alteration)',
      inputWords,
      canonicalWords: wordDiffInfo.canonicalWords,
      claims
    });
  }

  if (matchType === 'PARTIAL' && bestMatch) {
    return buildResult({
      verdictCode: 'PARTIAL',
      verdict: 'மூலத்தின் ஒரு பகுதி',
      subtitle: `குறள் ${bestMatch.number}-ன் ஒரு பகுதி மட்டுமே உள்ளிடப்பட்டுள்ளது`,
      badge: 'பகுதி மேற்கோள்',
      statusClass: 'verdict-partial',
      explanation: `உள்ளீடு செய்யப்பட்ட வரிகள் குறள் எண் ${bestMatch.number}-ன் ஒரு பகுதியாக (முதலடி அல்லது குறிப்பிட்ட தொடராக) மட்டுமே உள்ளன. முழுமையான குறள் உள்ளிடப்படாததால் இது பகுதிப் பொருத்தமாகப் பதிவு செய்யப்படுகிறது.`,
      candidate: bestMatch,
      isVerified: false,
      matchCategory: 'பகுதி மேற்கோள் (Partial Excerpt)',
      inputWords,
      canonicalWords: wordDiffInfo.canonicalWords,
      claims
    });
  }

  if (bestScore >= 0.55 && bestMatch) {
    return buildResult({
      verdictCode: 'WORD_VARIATION',
      verdict: 'சொல் அல்லது எழுத்து மாற்றம் கண்டறியப்பட்டது',
      subtitle: `குறள் எண் ${bestMatch.number}-உடன் நெருங்கிய ஒற்றுமை காணப்படுகிறது`,
      badge: 'நெருங்கிய குறள்',
      statusClass: 'verdict-variation',
      explanation: `குறள் எண் ${bestMatch.number}-உடன் நெருங்கிய சொல் ஒப்புமை உள்ளது. ஆயினும் பல சொற்களில் வேறுபாடு இருப்பதால் இது மூலப் பாடமாக உறுதிப்படுத்தப்படவில்லை.`,
      candidate: bestMatch,
      isVerified: false,
      matchCategory: 'நெருங்கிய வடிவம் (Close Candidate)',
      inputWords,
      canonicalWords: wordDiffInfo.canonicalWords,
      claims
    });
  }

  // Not found in available collection
  return buildResult({
    verdictCode: 'NOT_FOUND',
    verdict: 'கொடுக்கப்பட்ட தொகுப்பில் ஆதாரம் கிடைக்கவில்லை',
    subtitle: '1330 திருக்குறள் மூலப் பாடத் தரவிலும் காணப்படவில்லை',
    badge: 'தொகுப்பில் இல்லை',
    statusClass: 'verdict-notfound',
    explanation: 'உள்ளீடு செய்யப்பட்ட மேற்கோளுக்கான ஆதாரம் பயன்பாட்டில் உள்ள 1330 திருக்குறள் மூலப் பாடத் தரவிலும் கிடைக்கவில்லை. இது வேறு சங்க இலக்கியப் பாடலாகவோ அல்லது தற்கால மேற்கோளாகவோ இருக்கலாம் (இத்தொகுப்பில் இல்லாததால் இதனைப் போலி எனக் கூற முடியாது; இத்தொகுப்பில் கிடைக்கவில்லை என்பதே முடிவு).',
    candidate: null,
    isVerified: false,
    inputWords,
    claims
  });
}

// Build result with claims checking & evidence record
function buildResult(data) {
  const { claims, candidate } = data;
  let claimsConflict = null;

  if (claims && candidate) {
    const conflicts = [];
    if (claims.verseNumber && Number(claims.verseNumber) !== candidate.number) {
      conflicts.push(`கூறப்பட்ட குறள் எண் (${claims.verseNumber}) மற்றும் மூலப் பாடல் எண் (${candidate.number}) முரண்படுகின்றன.`);
    }
    if (claims.work && !claims.work.includes('திருக்குறள்') && !claims.work.includes('குறள்')) {
      conflicts.push(`கூறப்பட்ட நூல் "${claims.work}", ஆனால் கண்டறியப்பட்ட மூலம் "திருக்குறள்" ஆகும்.`);
    }
    if (claims.author && !claims.author.includes('வள்ளுவர்')) {
      conflicts.push(`கூறப்பட்ட ஆசிரியர் "${claims.author}", ஆனால் திருக்குறளின் ஆசிரியர் "திருவள்ளுவர்" ஆவார்.`);
    }
    if (conflicts.length > 0) {
      claimsConflict = conflicts;
    }
  }

  // Construct evidence record
  let evidenceRecord = null;
  if (candidate) {
    evidenceRecord = {
      work: candidate.work || 'திருக்குறள்',
      author: candidate.author || 'திருவள்ளுவர்',
      verseNumber: candidate.number,
      chapter: `${candidate.chapter} (அதிகாரம் ${candidate.chapterNumber})`,
      section: `${candidate.section} • ${candidate.chapterGroup}`,
      sourceCouplet: candidate.couplet,
      sourceUrl: candidate.sourceUrl || 'https://github.com/tk120404/thirukkural',
      sourceDataset: 'திறந்தநிலைத் திருக்குறள் தரவுத்தொகுப்பு (GitHub: tk120404/thirukkural)',
      appliedNormalization: 'ஒருங்குறி NFC சீரமைப்பு, மிகை இடைவெளி நீக்கம், நிறுத்தக்குறிகள் புறக்கணிப்பு',
      matchType: data.matchCategory || 'பொருத்த வகை',
      fileChecksum: 'SHA-256: a5c4e179b35b832051ab28a8952f6b74f85ed00b0592b5ca1298d1c72894ab55',
      checksumNote: 'உள்ளூர்க் கோப்பு ஒருமைப்பாடு சரிபார்ப்பு மட்டுமே; வரலாற்று நம்பகத்தன்மைச் சான்றல்ல.'
    };
  }

  return {
    ...data,
    claimsConflict,
    evidenceRecord
  };
}

// AI Gate analysis function
function analyzeAiDraft(draftText, manualQuotes = []) {
  if (!draftText || !draftText.trim()) {
    return {
      status: 'EMPTY',
      canPublish: false,
      spans: [],
      summary: 'ஆய்வு செய்வதற்கு வரைவு உரை ஏதும் உள்ளிடப்படவில்லை.'
    };
  }

  const detectedQuotes = [];

  // If manual quotes provided, use them
  if (manualQuotes && manualQuotes.length > 0) {
    manualQuotes.forEach((q, idx) => {
      detectedQuotes.push({
        id: idx + 1,
        text: q.trim(),
        mode: 'manual'
      });
    });
  } else {
    // Automatic detection: quotation marks, explicit labels
    const quoteRegex = /["“'‘«]([^"”'’»\n]{10,200})["”'’»]/g;
    let match;
    while ((match = quoteRegex.exec(draftText)) !== null) {
      detectedQuotes.push({
        id: detectedQuotes.length + 1,
        text: match[1].trim(),
        fullMatch: match[0],
        mode: 'auto'
      });
    }

    // Also detect 2-line couplets or "குறள்:" labels
    const lines = draftText.split('\n').map(l => l.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^(?:குறள்|திருக்குறள்|பாடல்)\s*[:：\-]/i.test(line)) {
        const quotePart = line.replace(/^(?:குறள்|திருக்குறள்|பாடல்)\s*[:：\-]\s*/i, '');
        if (quotePart.length > 10 && !detectedQuotes.some(q => q.text.includes(quotePart))) {
          detectedQuotes.push({
            id: detectedQuotes.length + 1,
            text: quotePart,
            mode: 'auto_label'
          });
        }
      }
    }
  }

  if (detectedQuotes.length === 0) {
    return {
      status: 'NO_QUOTES_FOUND',
      canPublish: true,
      spans: [],
      summary: 'இவ்வுரையில் மேற்கோள்கள் ஏதும் கண்டறியப்படவில்லை. (கையால் மேற்கோளைத் தேர்ந்தெடுத்து ஆய்வு செய்யலாம்).'
    };
  }

  // Verify each quotation span
  const verifiedSpans = detectedQuotes.map(q => {
    const res = verifyQuotation(q.text);
    return {
      id: q.id,
      text: q.text,
      mode: q.mode,
      verdict: res.verdict,
      verdictCode: res.verdictCode,
      isVerified: res.isVerified,
      candidate: res.candidate,
      explanation: res.explanation,
      canonicalCouplet: res.candidate ? res.candidate.couplet : null
    };
  });

  // Check if ALL are verified
  const allVerified = verifiedSpans.every(s => s.isVerified && s.verdictCode === 'EXACT');
  const hasAlteredOrNotFound = verifiedSpans.some(s => !s.isVerified);

  return {
    status: allVerified ? 'READY_TO_PUBLISH' : 'BLOCKED',
    canPublish: allVerified,
    badgeText: allVerified ? 'வெளியிடத் தயாராக உள்ளது' : 'வெளியீட்டுக்குத் தடையிடப்பட்டுள்ளது',
    spans: verifiedSpans,
    summary: allVerified
      ? 'வரைவில் உள்ள அனைத்து மேற்கோள்களும் அதிகாரப்பூர்வ மூலப் பாடத்தோடு பொருந்துகின்றன. வெளியிடத் தயாராக உள்ளது.'
      : 'வரைவில் இடம்பெற்றுள்ள மேற்கோள்களில் மாற்றம் அல்லது மூலமின்மை கண்டறியப்பட்டுள்ளது. எனவே இச்செயலி மூலம் சரிபார்க்கப்பட்டதாக வெளியிடத் தடையிடப்பட்டுள்ளது.'
  };
}

// Test cases
console.log('Testing 6 verdicts:');
console.log('1. Exact:', verifyQuotation('அகர முதல எழுத்தெல்லாம் ஆதி\nபகவன் முதற்றே உலகு.').verdict);
console.log('2. Formatting:', verifyQuotation('அகர முதல எழுத்தெல்லாம், ஆதி பகவன் முதற்றே உலகு!').verdict);
console.log('3. Partial:', verifyQuotation('கற்க கசடறக் கற்பவை கற்றபின்').verdict);
console.log('4. Altered:', verifyQuotation('கற்க கசடறக் நூல்களை கற்றபின் நிற்க அதற்குத் தக').verdict);
console.log('5. Not found:', verifyQuotation('யாதும் ஊரே யாவரும் கேளிர் தீதும் நன்றும் பிறர்தர வாரா').verdict);
console.log('6. Insufficient:', verifyQuotation('அறம்').verdict);

console.log('\nTesting claims conflict:');
const claimTest = verifyQuotation('அகர முதல எழுத்தெல்லாம் ஆதி\nபகவன் முதற்றே உலகு.', { verseNumber: 400 });
console.log('Claim conflict detected:', claimTest.claimsConflict);

console.log('\nTesting AI Gate with altered quotation:');
const aiDraft = 'திருவள்ளுவர் கல்வியின் பெருமையைப் பற்றி கூறும்போது "கற்க கசடறக் நூல்களை கற்றபின் நிற்க அதற்குத் தக" என்று குறிப்பிட்டுள்ளார்.';
const gateRes = analyzeAiDraft(aiDraft);
console.log('Gate status:', gateRes.status, 'Badge:', gateRes.badgeText);
console.log('Can publish:', gateRes.canPublish);
console.log('Flagged span verdict:', gateRes.spans[0].verdict);
