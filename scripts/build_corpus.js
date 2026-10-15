const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

async function downloadAndPrepare() {
  console.log('Downloading datasets...');
  const [tkRes, detRes] = await Promise.all([
    fetch('https://raw.githubusercontent.com/tk120404/thirukkural/master/thirukkural.json').then(r => r.json()),
    fetch('https://raw.githubusercontent.com/tk120404/thirukkural/master/detail.json').then(r => r.json())
  ]);

  const chapters = [];
  const root = detRes[0];
  for (const sec of root.section.detail) {
    const secName = sec.name;
    for (const grp of sec.chapterGroup.detail) {
      const grpName = grp.name;
      for (const ch of grp.chapters.detail) {
        chapters.push({
          number: ch.number,
          name: ch.name,
          section: secName,
          group: grpName,
          start: ch.start,
          end: ch.end
        });
      }
    }
  }

  const findChapter = (num) => {
    return chapters.find(c => num >= c.start && num <= c.end) || {
      number: 0,
      name: 'பொது',
      section: 'பொது',
      group: 'பொது'
    };
  };

  const kurals = tkRes.kural.map(k => {
    const ch = findChapter(k.Number);
    const line1 = k.Line1.trim();
    const line2 = k.Line2.trim();
    return {
      number: k.Number,
      line1: line1,
      line2: line2,
      couplet: line1 + '\n' + line2,
      section: ch.section,
      chapterGroup: ch.group,
      chapter: ch.name,
      chapterNumber: ch.number,
      edition: 'செவ்வியல் மூலப் பாடம் (பரிமேலழகர் உரைநெறி / தமிழ் இணையக் கல்விக்கழகப் பதிப்பு)',
      meaning: k.mv || ''
    };
  });

  console.log('Processed kurals count:', kurals.length);
  const jsonPath = path.join(dataDir, 'tirukkural_corpus.json');
  fs.writeFileSync(jsonPath, JSON.stringify(kurals, null, 2), 'utf8');

  const jsPath = path.join(dataDir, 'tirukkural_data.js');
  const jsContent = '/* திருக்குறள் முழுமைத் தரவுத்தளம் (1330 குறள்கள்) */\nwindow.TIRUKKURAL_CORPUS = ' + JSON.stringify(kurals) + ';';
  fs.writeFileSync(jsPath, jsContent, 'utf8');

  console.log('Successfully saved to:', jsonPath, 'and', jsPath);
}

downloadAndPrepare().catch(e => {
  console.error('Error generating corpus:', e);
  process.exit(1);
});
