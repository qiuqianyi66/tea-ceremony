const https = require('https'); const fs = require('fs');
const slugs = ['aerial_grass_rock', 'forest_ground_04', 'brown_mud_dry', 'rock_ground_02'];
const OUT = 'public/3d/textures/terrain/';
function get(url) { return new Promise((res, rej) => { https.get(url, r => { let d = []; r.on('data', c => d.push(c)); r.on('end', () => res(Buffer.concat(d))); }).on('error', rej); }); }
(async () => {
  for (const slug of slugs) {
    const meta = JSON.parse(await get('https://api.polyhaven.com/files/' + slug));
    for (const [map, suffix] of [['Diffuse','diff'], ['nor_gl','nor_gl']]) {
      const u = meta[map]?.['2k']?.jpg?.url;
      if (!u) { console.log('skip', slug, map); continue; }
      const buf = await get(u);
      fs.writeFileSync(OUT + slug + '_' + suffix + '_2k.jpg', buf);
      console.log('OK', slug + '_' + suffix, (buf.length/1024/1024).toFixed(2) + 'MB');
    }
  }
})().catch(e => { console.error(e.message); process.exit(1); });

