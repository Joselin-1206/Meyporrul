/**
 * மெய்ப்பொருள் (Meypporul) — முதன்மை பயன்பாட்டு நிரல் (app.js)
 * “மேற்கோள் மட்டும் போதாது; மூலச்சான்று வேண்டும்.”
 */

(function () {
  'use strict';

  // 1. பயன்பாட்டு நிலை (Application State)
  let corpus = [];
  let isCorpusLoaded = false;
  let corpusSha256 = '';

  // DOM உறுப்புகள் — மேல்தளம் & தாவல்கள்
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const themeIcon = document.getElementById('themeIcon');
  const themeLabel = document.getElementById('themeLabel');
  const corpusBadge = document.getElementById('corpusBadge');
  const homeBrand = document.getElementById('homeBrand');
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  // DOM உறுப்புகள் — பிரிவு 1: மேற்கோள் ஆய்வகம்
  const kuralInput = document.getElementById('kuralInput');
  const claimWorkInput = document.getElementById('claimWorkInput');
  const claimAuthorInput = document.getElementById('claimAuthorInput');
  const claimVerseInput = document.getElementById('claimVerseInput');
  const verifyBtn = document.getElementById('verifyBtn');
  const clearBtn = document.getElementById('clearBtn');
  const randomBtn = document.getElementById('randomBtn');
  const wordCountEl = document.getElementById('wordCount');
  const charCountEl = document.getElementById('charCount');

  // ஆய்வக முடிவு உறுப்புகள்
  const resultSection = document.getElementById('resultSection');
  const verdictBanner = document.getElementById('verdictBanner');
  const verdictIcon = document.getElementById('verdictIcon');
  const verdictBadge = document.getElementById('verdictBadge');
  const verdictTitle = document.getElementById('verdictTitle');
  const verdictSubtitle = document.getElementById('verdictSubtitle');
  const verdictStatusTag = document.getElementById('verdictStatusTag');
  const claimsConflictCard = document.getElementById('claimsConflictCard');
  const claimsConflictList = document.getElementById('claimsConflictList');
  const explanationText = document.getElementById('explanationText');
  const wordChangeNote = document.getElementById('wordChangeNote');

  // மூல மற்றும் ஒப்பீட்டு உறுப்புகள்
  const candidateContainer = document.getElementById('candidateContainer');
  const canonicalCandidateLabel = document.getElementById('canonicalCandidateLabel');
  const canonicalCouplet = document.getElementById('canonicalCouplet');
  const canonicalMeaning = document.getElementById('canonicalMeaning');
  const diffInputTokens = document.getElementById('diffInputTokens');
  const diffCanonicalTokens = document.getElementById('diffCanonicalTokens');
  const metricInputWords = document.getElementById('metricInputWords');
  const metricCanonicalWords = document.getElementById('metricCanonicalWords');
  const metricMatchedWords = document.getElementById('metricMatchedWords');
  const metricSimilarity = document.getElementById('metricSimilarity');

  // அதிகாரப்பூர்வ ஆதாரப் பதிவு உறுப்புகள்
  const evWorkAuthor = document.getElementById('evWorkAuthor');
  const evVerseNumber = document.getElementById('evVerseNumber');
  const evChapter = document.getElementById('evChapter');
  const evSectionGroup = document.getElementById('evSectionGroup');
  const evSourceLink = document.getElementById('evSourceLink');
  const evDatasetLabel = document.getElementById('evDatasetLabel');
  const evNormalization = document.getElementById('evNormalization');

  const evFileChecksum = document.getElementById('evFileChecksum');
  const poeticMetricsContent = document.getElementById('poeticMetricsContent');

  // DOM உறுப்புகள் — பிரிவு 2: குறள் மாற்றிப் பார்ப்பு
  const forgeKuralNumber = document.getElementById('forgeKuralNumber');
  const forgeLoadBtn = document.getElementById('forgeLoadBtn');
  const forgeRandomBtn = document.getElementById('forgeRandomBtn');
  const forgeTextarea = document.getElementById('forgeTextarea');
  const forgeVerifyBtn = document.getElementById('forgeVerifyBtn');
  const forgeStats = document.getElementById('forgeStats');
  const forgeResultArea = document.getElementById('forgeResultArea');
  const forgeVerdictBanner = document.getElementById('forgeVerdictBanner');
  const forgeVerdictIcon = document.getElementById('forgeVerdictIcon');
  const forgeVerdictBadge = document.getElementById('forgeVerdictBadge');
  const forgeVerdictTitle = document.getElementById('forgeVerdictTitle');
  const forgeVerdictSubtitle = document.getElementById('forgeVerdictSubtitle');
  const forgeExplanation = document.getElementById('forgeExplanation');
  const forgeDiffInput = document.getElementById('forgeDiffInput');
  const forgeDiffCanonical = document.getElementById('forgeDiffCanonical');
  const forgeKuralMeta = document.getElementById('forgeKuralMeta');
  const forgeCanonicalCouplet = document.getElementById('forgeCanonicalCouplet');

  const demoExactBtn = document.getElementById('demoExactBtn');
  const demoPartialBtn = document.getElementById('demoPartialBtn');
  const demoAlterBtn = document.getElementById('demoAlterBtn');
  const demoUnsupportedBtn = document.getElementById('demoUnsupportedBtn');

  // DOM உறுப்புகள் — பிரிவு 3: AI பதில் சான்றாய்வு
  const aiDraftTextarea = document.getElementById('aiDraftTextarea');
  const evaluateDraftBtn = document.getElementById('evaluateDraftBtn');
  const clearDraftBtn = document.getElementById('clearDraftBtn');
  const gateResultArea = document.getElementById('gateResultArea');
  const gateStatusBanner = document.getElementById('gateStatusBanner');
  const gateStatusIcon = document.getElementById('gateStatusIcon');
  const gateStatusTitle = document.getElementById('gateStatusTitle');
  const gateStatusSummary = document.getElementById('gateStatusSummary');
  const spansListContainer = document.getElementById('spansListContainer');
  const aiReplaceNotice = document.getElementById('aiReplaceNotice');

  const gateModeAuto = document.getElementById('gateModeAuto');
  const gateModeManual = document.getElementById('gateModeManual');
  const manualQuoteSpanContainer = document.getElementById('manualQuoteSpanContainer');
  const manualQuoteInput = document.getElementById('manualQuoteInput');

  const presetAiAuthentic = document.getElementById('presetAiAuthentic');
  const presetAiAltered = document.getElementById('presetAiAltered');
  const presetAiNonKural = document.getElementById('presetAiNonKural');

  // நடுவர் பார்வைக்கான 5 படிகள் பொத்தான்கள்
  const judgeStep1 = document.getElementById('judgeStep1');
  const judgeStep2 = document.getElementById('judgeStep2');
  const judgeStep3 = document.getElementById('judgeStep3');
  const judgeStep4 = document.getElementById('judgeStep4');
  const judgeStep5 = document.getElementById('judgeStep5');

  // விரைவு மாதிரி மேற்கோள்கள் (Presets for Lab)
  const presetExamples = {
    exact: {
      text: 'அகர முதல எழுத்தெல்லாம் ஆதி\nபகவன் முதற்றே உலகு.',
      claims: { work: 'திருக்குறள்', author: 'திருவள்ளுவர்', verse: 1 }
    },
    orthography_punct: {
      text: 'அகர முதல எழுத்தெல்லாம், ஆதி பகவன் முதற்றே உலகு!',
      claims: { work: 'திருக்குறள்', author: 'திருவள்ளுவர்', verse: 1 }
    },
    orthography_sandhi: {
      text: 'அகரமுதல எழுத்தெல்லாம் ஆதிபகவன் முதற்றே உலகு',
      claims: { work: 'திருக்குறள்', author: 'திருவள்ளுவர்', verse: 1 }
    },
    partial: {
      text: 'கற்க கசடறக் கற்பவை கற்றபின்',
      claims: { work: 'திருக்குறள்', author: 'திருவள்ளுவர்', verse: 391 }
    },
    variation: {
      text: 'கற்க கசடறக் நூல்களை கற்றபின் நிற்க அதற்குத் தக',
      claims: { work: 'திருக்குறள்', author: 'திருவள்ளுவர்', verse: 391 }
    },
    notfound: {
      text: 'யாதும் ஊரே யாவரும் கேளிர் தீதும் நன்றும் பிறர்தர வாரா',
      claims: { work: 'புறநானூறு', author: 'கணியன் பூங்குன்றனார்', verse: 192 }
    },
    insufficient: {
      text: 'அன்பு',
      claims: {}
    }
  };

  // 2. தரவுத்தளத்தை ஏற்றுதல் & உண்மை SHA-256 கணக்கிடுதல் (Load Corpus & Compute Real Hash)
  async function loadCorpus() {
    // 1. Check window.CORPUS_META if available
    if (window.CORPUS_META && window.CORPUS_META.sha256) {
      corpusSha256 = window.CORPUS_META.sha256;
    }

    // 2. Check window.TIRUKKURAL_CORPUS
    if (window.TIRUKKURAL_CORPUS && Array.isArray(window.TIRUKKURAL_CORPUS) && window.TIRUKKURAL_CORPUS.length > 0) {
      corpus = window.TIRUKKURAL_CORPUS;
      isCorpusLoaded = true;
      updateCorpusBadge(corpus.length);
      if (!corpusSha256 && window.crypto && window.crypto.subtle) {
        try {
          const enc = new TextEncoder().encode(JSON.stringify(corpus));
          const hashBuf = await window.crypto.subtle.digest('SHA-256', enc);
          corpusSha256 = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (e) {
          console.warn('Crypto hash calculation fallback');
        }
      }
      return;
    }

    // 3. Fetch from JSON
    try {
      const response = await fetch('data/tirukkural_corpus.json');
      if (!response.ok) throw new Error('நெட்வொர்க் பிழை');
      const clone = response.clone();
      const arrayBuf = await clone.arrayBuffer();

      if (window.crypto && window.crypto.subtle) {
        const hashBuf = await window.crypto.subtle.digest('SHA-256', arrayBuf);
        corpusSha256 = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
      }

      corpus = await response.json();
      isCorpusLoaded = true;
      updateCorpusBadge(corpus.length);
    } catch (err) {
      console.warn('JSON fetch failed, using fallback minimal verified set:', err);
      corpus = getFallbackKurals();
      isCorpusLoaded = true;
      updateCorpusBadge(corpus.length);
    }
  }

  function updateCorpusBadge(count) {
    if (corpusBadge) {
      corpusBadge.innerHTML = `<span class="badge-dot"></span> ${count} மூலக் குறள்கள்`;
    }
  }

  // 3. பாதுகாப்பான உரைச் சீரமைப்பு நெறிமுறைகள் (Safe Text Normalization)
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
        if (s1[i - 1] === s2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(
            dp[i - 1][j],
            dp[i][j - 1],
            dp[i - 1][j - 1]
          );
        }
      }
    }
    return dp[m][n];
  }

  // சொல் வரிசை ஒப்பீடு (LCS Diff distinguishing match, altered, extra, missing)
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
        // If canonical also had an unaligned word at this position, it's altered, else extra
        const isAltered = (j > 0);
        inputDiff.unshift({ word: inputWords[i - 1], type: isAltered ? 'altered' : 'extra' });
        i--;
      }
    }

    return { inputDiff, canonicalDiff };
  }

  // 4. முதன்மை சரிபார்ப்பு நெறிமுறை (Core Deterministic Engine)
  function verifyQuotation(rawInput, claims = {}) {
    const trimmedRaw = (rawInput || '').trim();
    const normalizedInput = normalizeText(trimmedRaw);

    if (!normalizedInput || normalizedInput.length === 0) {
      return buildResult({
        verdictCode: 'EMPTY',
        verdict: 'உறுதிப்படுத்த போதுமான ஆதாரம் இல்லை',
        subtitle: 'உள்ளீடு ஏதும் வழங்கப்படவில்லை',
        badge: 'சான்றில்லை',
        statusClass: 'verdict-insufficient',
        explanation: 'சரிபார்க்க எந்தவொரு உரையையும் நீங்கள் உள்ளிடவில்லை. தயவுசெய்து சரிபார்க்க வேண்டிய திருக்குறள் வரிகளை உள்ளிடவும்.',
        candidate: null,
        isVerified: false,
        claimsConflict: null
      });
    }

    const inputWords = normalizedInput.split(' ').filter(Boolean);
    const inputNoSpace = stripWhitespace(normalizedInput);

    if (inputWords.length < 3 && inputNoSpace.length < 15) {
      return buildResult({
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
      });
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

      // 1. முழுமையான சொல் பொருத்தம் (Exact match)
      if (normalizedInput === kuralNorm) {
        const rawMatchesExactly = trimmedRaw.replace(/\r\n/g, '\n') === kuralRaw;
        const isFormatOnly = !rawMatchesExactly;
        return buildResult({
          verdictCode: isFormatOnly ? 'ORTHOGRAPHY' : 'EXACT',
          verdict: isFormatOnly ? 'வடிவ வேறுபாட்டுடன் பொருந்துகிறது' : 'மூலத்துடன் பொருந்துகிறது',
          subtitle: isFormatOnly ? 'நிறுத்தக்குறிகள் அல்லது வரியமைப்பில் சிறு வேறுபாடு உள்ளது' : 'மூலத் தரவுடன் முழுமையாகப் பொருந்துகிறது',
          badge: isFormatOnly ? 'வடிவ வேறுபாடு' : 'தரவுத்தொகுப்பு மூலம்',
          statusClass: isFormatOnly ? 'verdict-ortho' : 'verdict-exact',
          explanation: isFormatOnly
            ? 'மூலக் குறளின் அனைத்துச் சொற்களும் முழுமையாக உள்ளன; ஆயினும் நிறுத்தக்குறிகள் அல்லது வரிகளுக்கு இடையிலான இடைவெளியில் சிறு வடிவ வேறுபாடு மட்டுமே உள்ளது.'
            : 'முழு உரையும் தரவுத்தொகுப்பில் பொருந்தியது.',
          candidate: item,
          isVerified: true,
          matchCategory: isFormatOnly ? 'வடிவ வேறுபாடு' : 'முழு மூலப் பொருத்தம்',
          inputWords,
          canonicalWords: kuralWords,
          claims
        });
      }

      // 2. இடைவெளியின்றி முழுமையாகப் பொருந்தும் நிலை (Spacing / Sandhi)
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
          matchCategory: 'வடிவ வேறுபாடு (சீர் இடைவெளி)',
          inputWords,
          canonicalWords: kuralWords,
          claims
        });
      }

      // 3. சிறிய எழுத்துப் பிழை
      const charDist = levenshteinDistance(inputNoSpace, kuralNoSpace);
      const maxLen = Math.max(inputNoSpace.length, kuralNoSpace.length);
      if (charDist <= 3 && maxLen > 20) {
        return buildResult({
          verdictCode: 'WORD_VARIATION',
          verdict: 'சொல் அல்லது எழுத்து மாற்றம் கண்டறியப்பட்டது',
          subtitle: `மூலப் பாடத்தோடு ${charDist} எழுத்துப் பிழை அல்லது வேறுபாடு உள்ளது`,
          badge: 'எழுத்து மாற்றம்',
          statusClass: 'verdict-variation',
          explanation: `மூலக் குறளோடு ஒப்பிடுகையில் ${charDist} எழுத்துகளில் வேறுபாடு காணப்படுகிறது. இது மூலக் குறளின் நெருங்கிய வடிவமாக இருக்கலாம்; எனினும் அதிகாரப்பூர்வ மூலமாக உறுதிப்படுத்தப்படாது.`,
          candidate: item,
          isVerified: false,
          matchCategory: 'சொல் அல்லது எழுத்து மாற்றம்',
          inputWords,
          canonicalWords: kuralWords,
          claims
        });
      }

      // 4. சொல் வாரியான பகுப்பாய்வு
      let matchedWordCount = 0;
      const kuralWordSet = new Set(kuralWords);
      for (const w of inputWords) {
        if (kuralWordSet.has(w)) matchedWordCount++;
      }

      const wordSimilarity = matchedWordCount / Math.max(inputWords.length, kuralWords.length);
      const kuralJoined = ' ' + kuralWords.join(' ') + ' ';
      const inputJoined = ' ' + inputWords.join(' ') + ' ';
      const isSubset = kuralJoined.includes(inputJoined);

      // சொல் மாற்றீடு பகுப்பாய்வு (5 or 6 words match in 7-word kural)
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

      // பகுதி பொருத்தம் (Subset of consecutive words)
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
        explanation: `குறள் எண் ${bestMatch.number}-ன் பெரும்பாலான சொற்கள் பொருந்துகின்றன. எனினும் சில குறிப்பிட்ட சீர்களில் சொல் மாற்றீடு கண்டறியப்பட்டுள்ளது. இது செவ்வியல் மூலப் பாடமாக உறுதிப்படுத்தப்படாது.`,
        wordChangeDetails: `கண்டறியப்பட்ட சொல் மாற்றங்கள்: ${changesText}`,
        candidate: bestMatch,
        isVerified: false,
        matchCategory: 'சொல் மாற்றீடு',
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
        matchCategory: 'பகுதி மேற்கோள்',
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
        matchCategory: 'நெருங்கிய வடிவம்',
        inputWords,
        canonicalWords: wordDiffInfo.canonicalWords,
        claims
      });
    }

    // தொகுப்பில் கிடைக்கவில்லை
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

  function buildResult(data) {
    const { claims, candidate } = data;
    let claimsConflict = null;

    if (claims && candidate) {
      const conflicts = [];
      if (claims.verse && Number(claims.verse) !== candidate.number) {
        conflicts.push(`கூறப்பட்ட குறள் எண் (${claims.verse}) மற்றும் மூலப் பாடல் எண் (${candidate.number}) முரண்படுகின்றன.`);
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

    return {
      ...data,
      claimsConflict
    };
  }

  // 5. பிரிவு 1: முடிவுகளைத் திரையில் காட்டுதல் (Render Lab Results)
  function renderLabResult(result) {
    if (!result) return;

    verdictBanner.className = `verdict-banner ${result.statusClass}`;
    verdictTitle.textContent = result.verdict;
    verdictSubtitle.textContent = result.subtitle;
    verdictBadge.textContent = result.badge;

    if (result.statusClass === 'verdict-exact') verdictIcon.textContent = '✓';
    else if (result.statusClass === 'verdict-ortho') verdictIcon.textContent = '≈';
    else if (result.statusClass === 'verdict-partial') verdictIcon.textContent = '½';
    else if (result.statusClass === 'verdict-variation') verdictIcon.textContent = '∿';
    else if (result.statusClass === 'verdict-notfound') verdictIcon.textContent = '✕';
    else verdictIcon.textContent = '?';

    if (result.isVerified) {
      verdictStatusTag.textContent = 'தரவுத்தொகுப்புடன் பொருந்துகிறது';
      verdictStatusTag.style.color = '#065f46';
    } else if (result.candidate) {
      verdictStatusTag.textContent = 'நெருங்கிய குறள்; உறுதிப்படுத்தப்படவில்லை';
      verdictStatusTag.style.color = '#b45309';
    } else {
      verdictStatusTag.textContent = 'உறுதிப்படுத்த இயலவில்லை';
      verdictStatusTag.style.color = '#64748b';
    }

    // உரிமை கோரல் முரண்பாடு
    if (result.claimsConflict && result.claimsConflict.length > 0) {
      claimsConflictList.innerHTML = result.claimsConflict.map(c => `<li>${c}</li>`).join('');
      claimsConflictCard.style.display = 'block';
    } else {
      claimsConflictCard.style.display = 'none';
    }

    // விளக்கம்
    explanationText.textContent = result.explanation;
    if (result.wordChangeDetails) {
      wordChangeNote.textContent = result.wordChangeDetails;
      wordChangeNote.style.display = 'block';
    } else {
      wordChangeNote.style.display = 'none';
    }

    // மூலப் பாடம் & ஆதாரப் பதிவு
    if (result.candidate) {
      candidateContainer.style.display = 'flex';
      const c = result.candidate;

      if (result.isVerified) {
        canonicalCandidateLabel.textContent = 'மூலத் தரவுப் பாடம்';
        canonicalCandidateLabel.style.color = 'var(--verdict-exact-badge)';
      } else {
        canonicalCandidateLabel.textContent = 'நெருங்கிய குறள்; உறுதிப்படுத்தப்படவில்லை';
        canonicalCandidateLabel.style.color = 'var(--verdict-variation-badge)';
      }

      canonicalCouplet.textContent = c.couplet;
      canonicalMeaning.textContent = c.meaning || 'உரை விளக்கம் கிடைக்கவில்லை.';

      // ஆதாரப் பதிவு (Evidence Record)
      evWorkAuthor.textContent = `${c.work || 'திருக்குறள்'} — ${c.author || 'திருவள்ளுவர்'}`;
      evVerseNumber.textContent = `குறள் ${c.number} / 1330`;
      evChapter.textContent = `${c.chapter} (அதிகாரம் ${c.chapterNumber})`;
      evSectionGroup.textContent = `${c.section} • ${c.chapterGroup}`;
      if (evSourceLink) {
        evSourceLink.href = c.sourceUrl || 'https://github.com/tk120404/thirukkural';
        evSourceLink.textContent = c.sourceUrl || 'https://github.com/tk120404/thirukkural';
      }
      if (evDatasetLabel) {
        evDatasetLabel.textContent = c.sourceDataset || 'திறந்தநிலைத் திருக்குறள் தரவுத்தொகுப்பு (GitHub: tk120404/thirukkural)';
      }
      if (evFileChecksum) {
        evFileChecksum.textContent = 'SHA-256: ' + (corpusSha256 || 'கணக்கிடப்படுகிறது...');
      }

      // பக்கவாட்டு ஒப்பீடு
      const inputWords = result.inputWords || [];
      const canonicalWords = (c.couplet ? normalizeText(c.couplet).split(' ').filter(Boolean) : []);
      const diff = generateWordDiff(inputWords, canonicalWords);

      renderDiffTokens(diffInputTokens, diff.inputDiff);
      renderDiffTokens(diffCanonicalTokens, diff.canonicalDiff);

      // அளவீடுகள்
      const matchedCount = diff.canonicalDiff.filter(d => d.type === 'match').length;
      metricInputWords.textContent = inputWords.length;
      metricCanonicalWords.textContent = canonicalWords.length;
      metricMatchedWords.textContent = matchedCount;
      const simPct = Math.round((matchedCount / Math.max(inputWords.length, canonicalWords.length, 1)) * 100);
      metricSimilarity.textContent = `${simPct}%`;

      // யாப்பு குறிப்பு
    } else {
      candidateContainer.style.display = 'none';
    }

    resultSection.style.display = 'flex';
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }


  function renderDiffTokens(container, tokens) {
    container.innerHTML = '';
    if (!tokens || tokens.length === 0) {
      container.innerHTML = '<span class="token-chip">—</span>';
      return;
    }

    tokens.forEach(t => {
      const chip = document.createElement('span');
      chip.className = 'token-chip';

      if (t.type === 'match') {
        chip.classList.add('token-match');
        chip.textContent = t.word;
      } else if (t.type === 'altered') {
        chip.classList.add('token-altered');
        chip.innerHTML = `${t.word} <span class="token-tag">மாற்றப்பட்டது</span>`;
      } else if (t.type === 'extra') {
        chip.classList.add('token-altered');
        chip.innerHTML = `${t.word} <span class="token-tag">கூடுதல் சொல்</span>`;
      } else if (t.type === 'missing') {
        chip.classList.add('token-missing');
        chip.innerHTML = `${t.word} <span class="token-tag">விடுபட்டது</span>`;
      } else {
        chip.textContent = t.word;
      }

      container.appendChild(chip);
    });
  }

  // 6. பிரிவு 2: குறள் மாற்றிப் பார்ப்பு (Forgery Forge Logic)
  let currentForgeKural = null;

  function loadForgeKural(num) {
    if (!corpus || corpus.length === 0) return;
        const parsed = Number(num);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > corpus.length) {
      forgeKuralNumber.value = '';
      forgeTextarea.value = '';
      forgeResultArea.innerHTML = '<div class="empty-state"><h3>செல்லாத குறள் எண்</h3><p>1 முதல் 1330 வரையிலான எண்ணை உள்ளிடுங்கள்.</p></div>';
      forgeResultArea.style.display = 'flex';
      return;
    }
    const idx = parsed - 1;
    currentForgeKural = corpus[idx];
    forgeKuralNumber.value = currentForgeKural.number;
    forgeTextarea.value = currentForgeKural.couplet;

    if (forgeKuralMeta) {
      forgeKuralMeta.textContent = `குறள் ${currentForgeKural.number} — ${currentForgeKural.chapter} (${currentForgeKural.section})`;
    }
    if (forgeCanonicalCouplet) {
      forgeCanonicalCouplet.textContent = currentForgeKural.couplet;
    }

    updateForgeStats();
    verifyForgeText();
  }

  function updateForgeStats() {
    const text = forgeTextarea.value || '';
    const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
    forgeStats.textContent = `சொற்கள்: ${words} | எழுத்துகள்: ${text.length}`;
  }

  function verifyForgeText() {
    const raw = forgeTextarea.value;
    const result = verifyQuotation(raw);

    forgeVerdictBanner.className = `verdict-banner ${result.statusClass}`;
    forgeVerdictTitle.textContent = result.verdict;
    forgeVerdictSubtitle.textContent = result.subtitle;
    forgeVerdictBadge.textContent = result.badge;

    if (result.statusClass === 'verdict-exact') forgeVerdictIcon.textContent = '✓';
    else if (result.statusClass === 'verdict-ortho') forgeVerdictIcon.textContent = '≈';
    else if (result.statusClass === 'verdict-partial') forgeVerdictIcon.textContent = '½';
    else if (result.statusClass === 'verdict-variation') forgeVerdictIcon.textContent = '∿';
    else if (result.statusClass === 'verdict-notfound') forgeVerdictIcon.textContent = '✕';
    else forgeVerdictIcon.textContent = '?';

    forgeExplanation.textContent = result.explanation;

    const targetKural = result.candidate || currentForgeKural;
    if (forgeKuralMeta && targetKural) {
      forgeKuralMeta.textContent = `குறள் ${targetKural.number} — ${targetKural.chapter} (${targetKural.section})`;
    }
    if (forgeCanonicalCouplet && targetKural) {
      forgeCanonicalCouplet.textContent = targetKural.couplet;
    }

    const inputWords = result.inputWords || [];
    const canonicalWords = targetKural && targetKural.couplet ? normalizeText(targetKural.couplet).split(' ').filter(Boolean) : [];
    const diff = generateWordDiff(inputWords, canonicalWords);

    renderDiffTokens(forgeDiffInput, diff.inputDiff);
    renderDiffTokens(forgeDiffCanonical, diff.canonicalDiff);

    forgeResultArea.style.display = 'flex';
  }

  // 7. பிரிவு 3: AI பதில் சான்றாய்வு (AI Truth Gate Logic)
  function evaluateAiDraft() {
    const draft = aiDraftTextarea.value || '';
    const isManual = gateModeManual.checked;
    let quotesToVerify = [];

    if (isManual) {
      const manualText = (manualQuoteInput.value || '').trim();
      if (!manualText) {
        alert('கையால் மேற்கோளைக் குறிப்பிடும் முறையில் ஒரு மேற்கோள் பகுதியை உள்ளிடவும்.');
        return;
      }
      if (!draft.includes(manualText)) {
        gateStatusBanner.className = 'gate-status-banner status-blocked';
        gateStatusIcon.textContent = '🛡️✕';
        gateStatusTitle.textContent = 'தேர்ந்தெடுத்த மேற்கோள் வரைவில் இல்லை';
        gateStatusSummary.textContent = 'வரைவிலுள்ள மேற்கோளையே தேர்ந்தெடுத்து மீண்டும் சரிபார்க்கவும்.';
        spansListContainer.innerHTML = '';
        gateResultArea.style.display = 'flex';
        return;
      }
      quotesToVerify.push({ id: 1, text: manualText, mode: 'manual' });
    } else {
      // Automatic detection: quotes inside "", “”, '', ‘’, or prefixed with குறள்:
      const quoteRegex = /["“'‘«]([^"”'’»\n]{10,200})["”'’»]/g;
      let match;
      while ((match = quoteRegex.exec(draft)) !== null) {
        quotesToVerify.push({
          id: quotesToVerify.length + 1,
          text: match[1].trim(),
          fullMatch: match[0],
          mode: 'auto'
        });
      }

      const lines = draft.split('\n').map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        if (/^(?:குறள்|திருக்குறள்|பாடல்)\s*[:：\-]/i.test(line)) {
          const part = line.replace(/^(?:குறள்|திருக்குறள்|பாடல்)\s*[:：\-]\s*/i, '');
          if (part.length > 10 && !quotesToVerify.some(q => q.text.includes(part))) {
            quotesToVerify.push({
              id: quotesToVerify.length + 1,
              text: part,
              mode: 'auto_label'
            });
          }
        }
      }
    }

    if (quotesToVerify.length === 0) {
      gateStatusBanner.className = 'gate-status-banner status-approved';
      gateStatusIcon.textContent = 'ℹ️';
      gateStatusTitle.textContent = 'மேற்கோள்கள் ஏதும் கண்டறியப்படவில்லை';
      gateStatusSummary.textContent = 'இவ்வரைவு உரையில் மேற்கோள் வரிகள் ஏதும் நேரடியாகக் கண்டறியப்படவில்லை. (கையால் மேற்கோளைக் குறிப்பிடும் முறை மூலம் சரிபார்க்கலாம்).';
      spansListContainer.innerHTML = '<p class="explanation-content">ஆய்வு செய்வதற்குரிய மேற்கோள்கள் எதுவும் வரைவில் கண்டறியப்படவில்லை.</p>';
      gateResultArea.style.display = 'flex';
      return;
    }

    // Verify each quote through deterministic engine
    const evaluatedSpans = quotesToVerify.map(q => {
      const res = verifyQuotation(q.text);
      return {
        ...q,
        result: res
      };
    });

    // Check if ALL are EXACT or ORTHOGRAPHY (strictly authentic)
    const allAuthentic = evaluatedSpans.every(s => s.result.isVerified && (s.result.verdictCode === 'EXACT' || s.result.verdictCode === 'ORTHOGRAPHY'));

    if (allAuthentic && !isManual) {
      gateStatusBanner.className = 'gate-status-banner status-approved';
      gateStatusIcon.textContent = '🛡️✓';
      gateStatusTitle.textContent = 'வெளியிடத் தயாராக உள்ளது';
      gateStatusSummary.textContent = 'கண்டறிந்த மேற்கோள்கள் அனைத்தும் தரவுத்தொகுப்புடன் பொருந்தின.';
    } else if (allAuthentic && isManual) {
      gateStatusBanner.className = 'gate-status-banner status-blocked';
      gateStatusIcon.textContent = '🛡️✓';
      gateStatusTitle.textContent = 'தேர்ந்தெடுத்த மேற்கோள் சரிபார்க்கப்பட்டது';
      gateStatusSummary.textContent = 'இந்த மேற்கோள் மூலத்துடன் பொருந்துகிறது. முழு வரைவு தானாகச் சோதிக்கப்படாததால், வெளியீட்டுக்கு ஒப்புதல் அளிக்கப்படவில்லை.';
    } else {
      gateStatusBanner.className = 'gate-status-banner status-blocked';
      gateStatusIcon.textContent = '🛡️✕';
      gateStatusTitle.textContent = 'வெளியீட்டுக்குத் தடையிடப்பட்டுள்ளது';
      gateStatusSummary.textContent = 'ஒரு மேற்கோளுக்காவது தரவுப் பொருத்தம் இல்லை; வெளியீடு தடுக்கப்பட்டது.';
    }

    // Render individual span cards
    spansListContainer.innerHTML = '';
    evaluatedSpans.forEach(item => {
      const card = document.createElement('div');
      const isOk = item.result.isVerified && (item.result.verdictCode === 'EXACT' || item.result.verdictCode === 'ORTHOGRAPHY');
      card.className = `span-card ${isOk ? 'span-verified' : 'span-blocked'}`;

      let replaceBtnHtml = '';
      if (!isOk && item.result.candidate) {
        replaceBtnHtml = `
          <button type="button" class="btn-replace-quote" data-quote="${escapeHtml(item.text)}" data-canonical="${escapeHtml(item.result.candidate.couplet)}">
            ✨ மூலக் குறளால் வரைவில் மாற்றீடு செய்க
          </button>
        `;
      }

      card.innerHTML = `
        <div class="span-header">
          <span class="span-title">மேற்கோள் ஆய்வு #${item.id} (${item.mode === 'manual' ? 'கையால் குறிப்பிடப்பட்டது' : 'தானாகக் கண்டறியப்பட்டது'})</span>
          <span class="span-badge ${isOk ? 'verified' : 'blocked'}">${item.result.badge}</span>
        </div>
        <div class="span-text-box">"${escapeHtml(item.text)}"</div>
        <div class="span-verdict-row">
          <span>தீர்ப்பு:</span>
          <span class="span-verdict-val">${item.result.verdict}</span>
        </div>
        <p class="span-explanation">${item.result.explanation}</p>
        ${item.result.candidate ? `<p class="span-explanation"><strong>நெருங்கிய மூலம்:</strong> குறள் ${item.result.candidate.number} (${item.result.candidate.chapter}) — ${escapeHtml(item.result.candidate.couplet.replace(/\n/g, ' '))}</p>` : ''}
        ${replaceBtnHtml}
      `;

      spansListContainer.appendChild(card);
    });

    // Setup replace button clicks with in-page feedback notice
    const replaceBtns = spansListContainer.querySelectorAll('.btn-replace-quote');
    replaceBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetQuote = btn.getAttribute('data-quote');
        const canonical = btn.getAttribute('data-canonical');
        if (targetQuote && canonical) {
          aiDraftTextarea.value = aiDraftTextarea.value.replace(targetQuote, canonical);
          if (aiReplaceNotice) {
            aiReplaceNotice.innerHTML = `
              <strong>✓ மாற்றீடு செய்யப்பட்டது:</strong> வரைவில் இருந்த திரிந்த மேற்கோள் அகற்றப்பட்டு, தரவுத்தொகுப்பிலுள்ள குறள் (${escapeHtml(canonical.replace(/\n/g, ' '))}) வெற்றிகரமாகப் பொருத்தப்பட்டது.
            `;
            aiReplaceNotice.style.display = 'block';
          }
          evaluateAiDraft();
        }
      });
    });

    gateResultArea.style.display = 'flex';
    gateResultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function switchTab(tabId) {
    tabBtns.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => {
      c.classList.remove('active');
      c.style.display = 'none';
    });

    const activeBtn = Array.from(tabBtns).find(b => b.getAttribute('data-tab') === tabId);
    if (activeBtn) activeBtn.classList.add('active');

    const activeContent = document.getElementById(tabId);
    if (activeContent) {
      activeContent.classList.add('active');
      activeContent.style.display = 'block';
    }
  }

  // 8. நிகழ்வு கையாளுதல் (Event Handlers)
  function setupEvents() {
    homeBrand.addEventListener('click', event => {
      event.preventDefault();
      switchTab('labTab');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        switchTab(targetTab);
      });
    });

    kuralInput.addEventListener('input', () => {
      const text = kuralInput.value || '';
      const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
      wordCountEl.textContent = words;
      charCountEl.textContent = text.length;
    });

    verifyBtn.addEventListener('click', () => {
      const claims = {
        work: claimWorkInput.value.trim(),
        author: claimAuthorInput.value.trim(),
        verse: claimVerseInput.value.trim()
      };
      const res = verifyQuotation(kuralInput.value, claims);
      renderLabResult(res);
    });

    clearBtn.addEventListener('click', () => {
      kuralInput.value = '';
      claimWorkInput.value = '';
      claimAuthorInput.value = '';
      claimVerseInput.value = '';
      wordCountEl.textContent = '0';
      charCountEl.textContent = '0';
      resultSection.style.display = 'none';
      kuralInput.focus();
    });

    randomBtn.addEventListener('click', () => {
      if (!corpus || corpus.length === 0) return;
      const r = corpus[Math.floor(Math.random() * corpus.length)];
      kuralInput.value = r.couplet;
      claimWorkInput.value = 'திருக்குறள்';
      claimAuthorInput.value = 'திருவள்ளுவர்';
      claimVerseInput.value = r.number;
      kuralInput.dispatchEvent(new Event('input'));
      verifyBtn.click();
    });

    document.querySelectorAll('.pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const type = pill.getAttribute('data-type');
        const ex = presetExamples[type];
        if (ex) {
          kuralInput.value = ex.text;
          claimWorkInput.value = ex.claims.work || '';
          claimAuthorInput.value = ex.claims.author || '';
          claimVerseInput.value = ex.claims.verse || '';
          kuralInput.dispatchEvent(new Event('input'));
          verifyBtn.click();
        }
      });
    });

    // பிரிவு 2: குறள் மாற்றிப் பார்ப்பு
    forgeLoadBtn.addEventListener('click', () => loadForgeKural(forgeKuralNumber.value));
    forgeRandomBtn.addEventListener('click', () => {
      const randNum = Math.floor(Math.random() * 1330) + 1;
      loadForgeKural(randNum);
    });
    forgeTextarea.addEventListener('input', updateForgeStats);
    forgeVerifyBtn.addEventListener('click', verifyForgeText);

    demoExactBtn.addEventListener('click', () => loadForgeKural(1));

    demoPartialBtn.addEventListener('click', () => {
      loadForgeKural(391);
      forgeTextarea.value = 'கற்க கசடறக் கற்பவை கற்றபின்';
      updateForgeStats();
      verifyForgeText();
    });

    demoAlterBtn.addEventListener('click', () => {
      loadForgeKural(391);
      forgeTextarea.value = 'கற்க கசடறக் நூல்களை கற்றபின்\nநிற்க அதற்குத் தக.';
      updateForgeStats();
      verifyForgeText();
    });

    demoUnsupportedBtn.addEventListener('click', () => {
      forgeTextarea.value = 'யாதும் ஊரே யாவரும் கேளிர் தீதும் நன்றும் பிறர்தர வாரா';
      updateForgeStats();
      verifyForgeText();
    });

    // பிரிவு 3: AI வாயில்
    evaluateDraftBtn.addEventListener('click', evaluateAiDraft);
    clearDraftBtn.addEventListener('click', () => {
      aiDraftTextarea.value = '';
      manualQuoteInput.value = '';
      if (aiReplaceNotice) aiReplaceNotice.style.display = 'none';
      gateResultArea.style.display = 'none';
      aiDraftTextarea.focus();
    });

    gateModeAuto.addEventListener('change', () => {
      manualQuoteSpanContainer.style.display = 'none';
    });
    gateModeManual.addEventListener('change', () => {
      manualQuoteSpanContainer.style.display = 'flex';
    });

    presetAiAuthentic.addEventListener('click', () => {
      aiDraftTextarea.value = 'திருவள்ளுவர் கடவுளின் பெருமையைக் கூறும்போது "அகர முதல எழுத்தெல்லாம் ஆதி பகவன் முதற்றே உலகு" என்று கூறியுள்ளார்.';
      evaluateAiDraft();
    });

    presetAiAltered.addEventListener('click', () => {
      aiDraftTextarea.value = 'கல்வியின் சிறப்பை விளக்கும் திருவள்ளுவர் "கற்க கசடறக் நூல்களை கற்றபின் நிற்க அதற்குத் தக" என்று குறிப்பிட்டுள்ளார்.';
      evaluateAiDraft();
    });

    presetAiNonKural.addEventListener('click', () => {
      aiDraftTextarea.value = 'வள்ளுவர் மனிதநேயத்தைப் பற்றிக் கூறும்போது "யாதும் ஊரே யாவரும் கேளிர் தீதும் நன்றும் பிறர்தர வாரா" என்று குறளில் கூறியுள்ளார்.';
      evaluateAiDraft();
    });

    // நடுவர் பார்வைக்கான 5 நேரடி செயல்விளக்கப் படிகள்
    if (judgeStep1) {
      judgeStep1.addEventListener('click', () => {
        switchTab('labTab');
        kuralInput.value = 'அகர முதல எழுத்தெல்லாம் ஆதி\nபகவன் முதற்றே உலகு.';
        claimWorkInput.value = 'திருக்குறள்';
        claimAuthorInput.value = 'திருவள்ளுவர்';
        claimVerseInput.value = 1;
        kuralInput.dispatchEvent(new Event('input'));
        verifyBtn.click();
      });
    }

    if (judgeStep2) {
      judgeStep2.addEventListener('click', () => {
        switchTab('labTab');
        kuralInput.value = 'கற்க கசடறக் கற்பவை கற்றபின்';
        claimWorkInput.value = 'திருக்குறள்';
        claimAuthorInput.value = 'திருவள்ளுவர்';
        claimVerseInput.value = 391;
        kuralInput.dispatchEvent(new Event('input'));
        verifyBtn.click();
      });
    }

    if (judgeStep3) {
      judgeStep3.addEventListener('click', () => {
        switchTab('forgeTab');
        loadForgeKural(391);
        forgeTextarea.value = 'கற்க கசடறக் நூல்களை கற்றபின்\nநிற்க அதற்குத் தக.';
        updateForgeStats();
        verifyForgeText();
        forgeResultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    if (judgeStep4) {
      judgeStep4.addEventListener('click', () => {
        switchTab('aiGateTab');
        aiDraftTextarea.value = 'கல்வியின் சிறப்பை விளக்கும் திருவள்ளுவர் "கற்க கசடறக் நூல்களை கற்றபின் நிற்க அதற்குத் தக" என்று குறிப்பிட்டுள்ளார்.';
        evaluateAiDraft();
      });
    }

    if (judgeStep5) {
      judgeStep5.addEventListener('click', () => {
        switchTab('labTab');
        kuralInput.value = 'யாதும் ஊரே யாவரும் கேளிர் தீதும் நன்றும் பிறர்தர வாரா';
        claimWorkInput.value = 'புறநானூறு';
        claimAuthorInput.value = 'கணியன் பூங்குன்றனார்';
        claimVerseInput.value = 192;
        kuralInput.dispatchEvent(new Event('input'));
        verifyBtn.click();
      });
    }

    // பயன்முறை மாற்றம்
    themeToggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      setTheme(current === 'light' ? 'dark' : 'light');
    });
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('meypporul_theme', theme); } catch (e) {}
    if (theme === 'dark') {
      themeIcon.textContent = '☀️';
      themeLabel.textContent = 'ஒளி பயன்முறை';
    } else {
      themeIcon.textContent = '🌙';
      themeLabel.textContent = 'இருள் பயன்முறை';
    }
  }

  function initTheme() {
    let saved = 'light';
    try { saved = localStorage.getItem('meypporul_theme') || 'light'; } catch (e) {}
    setTheme(saved);
  }

  // 9. தொடக்க நிலை
  async function init() {
    initTheme();
    setupEvents();
    await loadCorpus();
    loadForgeKural(1);
    console.log('மெய்ப்பொருள் வெற்றிகரமாக ஏற்றப்பட்டது. மொத்தக் குறள்கள்:', corpus.length);
  }

  function getFallbackKurals() {
    return [
      {
        number: 1,
        line1: 'அகர முதல எழுத்தெல்லாம் ஆதி',
        line2: 'பகவன் முதற்றே உலகு.',
        couplet: 'அகர முதல எழுத்தெல்லாம் ஆதி\nபகவன் முதற்றே உலகு.',
        work: 'திருக்குறள்',
        author: 'திருவள்ளுவர்',
        section: 'அறத்துப்பால்',
        chapterGroup: 'பாயிரவியல்',
        chapter: 'கடவுள் வாழ்த்து',
        chapterNumber: 1,
        sourceDataset: 'திறந்தநிலைத் திருக்குறள் தரவுத்தொகுப்பு',
        sourceUrl: 'https://github.com/tk120404/thirukkural',
        edition: 'தரவுத்தொகுப்பு மூலம்: https://github.com/tk120404/thirukkural',
        meaning: 'எழுத்துக்கள் எல்லாம் அகரத்தை அடிப்படையாக கொண்டிருக்கின்றன. அதுபோல உலகம் கடவுளை அடிப்படையாக கொண்டிருக்கிறது.'
      },
      {
        number: 391,
        line1: 'கற்க கசடறக் கற்பவை கற்றபின்',
        line2: 'நிற்க அதற்குத் தக.',
        couplet: 'கற்க கசடறக் கற்பவை கற்றபின்\nநிற்க அதற்குத் தக.',
        work: 'திருக்குறள்',
        author: 'திருவள்ளுவர்',
        section: 'பொருட்பால்',
        chapterGroup: 'அரசியல்',
        chapter: 'கல்வி',
        chapterNumber: 40,
        sourceDataset: 'திறந்தநிலைத் திருக்குறள் தரவுத்தொகுப்பு',
        sourceUrl: 'https://github.com/tk120404/thirukkural',
        edition: 'தரவுத்தொகுப்பு மூலம்: https://github.com/tk120404/thirukkural',
        meaning: 'கல்வி கற்க நல்ல நூல்களைக் குற்றமறக் கற்க வேண்டும், அவ்வாறு கற்ற பிறகு, கற்ற கல்விக்கு தக்கவாறு நெறியில் நிற்க வேண்டும்.'
      }
    ];
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
