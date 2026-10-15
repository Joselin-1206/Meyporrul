// Word token alignment and diff generator
function generateWordDiff(inputWords, canonicalWords) {
  // Simple Longest Common Subsequence (LCS) for word sequence alignment
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

  // Backtrack to find aligned tokens
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
      // Word missing from input
      canonicalDiff.unshift({ word: canonicalWords[j - 1], type: 'missing_in_input' });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      // Extra or altered word in input
      inputDiff.unshift({ word: inputWords[i - 1], type: 'extra_or_altered' });
      i--;
    }
  }

  return { inputDiff, canonicalDiff };
}

const res = generateWordDiff(
  ['கற்க', 'கசடறக்', 'நூல்களை', 'கற்றபின்', 'நிற்க', 'அதற்குத்', 'தக'],
  ['கற்க', 'கசடறக்', 'கற்பவை', 'கற்றபின்', 'நிற்க', 'அதற்குத்', 'தக']
);
console.log('Input diff:', JSON.stringify(res.inputDiff));
console.log('Canonical diff:', JSON.stringify(res.canonicalDiff));
