// Download the public dataset into the app's local data folder.
// Source: https://github.com/tk120404/thirukkural
const fs = require('node:fs');
const path = require('node:path');

const urls = {
  verses: 'https://raw.githubusercontent.com/tk120404/thirukkural/master/thirukkural.json',
  details: 'https://raw.githubusercontent.com/tk120404/thirukkural/master/detail.json'
};

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`);
  return response.json();
}

function collectChapters(data) {
  const root = Array.isArray(data) ? data[0] : data;
  const chapters = [];
  for (const section of root?.section?.detail || []) {
    for (const group of section.chapterGroup?.detail || []) {
      for (const chapter of group.chapters?.detail || []) {
        chapters.push({ number: Number(chapter.number), name: chapter.name,
          section: section.name, group: group.name,
          start: Number(chapter.start), end: Number(chapter.end) });
      }
    }
  }
  return chapters;
}

async function main() {
  const [verseData, detailData] = await Promise.all([getJson(urls.verses), getJson(urls.details)]);
  const rawVerses = verseData.kural || verseData.kurals || [];
  if (!Array.isArray(rawVerses) || !rawVerses.length) throw new Error('Downloaded verse file has no recognized Kural entries.');
  const chapters = collectChapters(detailData);
  const corpus = rawVerses.map((verse) => {
    const number = Number(verse.Number ?? verse.number);
    const line1 = String(verse.Line1 ?? verse.line1 ?? '').trim();
    const line2 = String(verse.Line2 ?? verse.line2 ?? '').trim();
    const chapter = chapters.find((item) => number >= item.start && number <= item.end);
    return { number, line1, line2, couplet: `${line1}\n${line2}`,
      chapter: chapter?.name || '', chapterNumber: chapter?.number || '',
      section: chapter?.section || '', chapterGroup: chapter?.group || '',
      meaning: verse.mv || verse.meaning || '', source: urls.verses };
  }).sort((a, b) => a.number - b.number);
  const numbers = new Set(corpus.map((item) => item.number));
  const missing = Array.from({ length: 1330 }, (_, i) => i + 1).filter((n) => !numbers.has(n));
  const duplicates = corpus.length - numbers.size;
  if (corpus.length !== 1330 || missing.length || duplicates) {
    throw new Error(`Corpus validation failed: entries=${corpus.length}, missing=${missing.length}, duplicates=${duplicates}. No output written.`);
  }
  const output = path.join(__dirname, '..', 'data', 'tirukkural.json');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(corpus, null, 2)}\n`, 'utf8');
  console.log(`Saved ${corpus.length} entries to ${output}`);
  console.log(`Dataset source: ${urls.verses}`);
  console.log('Numbering was validated; this does not establish historical or editorial authenticity.');
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
