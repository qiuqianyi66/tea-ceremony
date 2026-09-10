/* audit-teas.cjs — teas.ts 49 款数据完整性核查（v2：兼容单行/多行两种格式） */
const fs = require('fs');

const s = fs.readFileSync('src/data/teas.ts', 'utf8');

// 解析：匹配所有条目起点 { id: '...'
const entries = [];
const re = /\{\s*id: '([^']+)',\s*name: '([^']+)',\s*type: TeaType\.(\w+)/g;
let m;
while ((m = re.exec(s))) entries.push({ id: m[1], name: m[2], type: m[3] });

console.log('茶总数:', entries.length, '| 类型:', [...new Set(entries.map(e => e.type))].join('/'));
const dupId = entries.map(e => e.id).filter((v, i, a) => a.indexOf(v) !== i);
const dupName = entries.map(e => e.name).filter((v, i, a) => a.indexOf(v) !== i);
console.log('重复 id:', dupId.length ? [...new Set(dupId)].join(',') : '无');
console.log('重复 name:', dupName.length ? [...new Set(dupName)].join(',') : '无');

const ids = new Set(entries.map(e => e.id));

// 反向断链
const ms = fs.readFileSync('src/data/teaMasters.ts', 'utf8');
const related = [...ms.matchAll(/relatedTeas: \[([^\]]+)\]/g)].flatMap(m =>
  [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]));
console.log('teaMasters.relatedTeas 断链:', [...new Set(related.filter(x => !ids.has(x)))].join(',') || '无');

const gr = fs.readFileSync('src/data/gardenRegions.ts', 'utf8');
const teaIds = [...gr.matchAll(/teaIds: \[([^\]]+)\]/g)].flatMap(m =>
  [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]));
console.log('gardenRegions.teaIds 断链:', [...new Set(teaIds.filter(x => !ids.has(x)))].join(',') || '无');

// 图片引用 vs 文件存在
const imgMap = {};
for (const im of s.matchAll(/import (\w+) from '(@\/assets\/[^']+)'/g)) imgMap[im[1]] = im[2].replace('@/', 'src/');
const used = [...s.matchAll(/image: (\w+)/g)].map(m => m[1]);
const miss = [...new Set(used)].filter(i => !imgMap[i] || !fs.existsSync(imgMap[i]));
console.log('图片引用缺失:', miss.length ? miss.join(',') : '无');

// SOURCES.md 登记的茶叶图文件都存在
const src = fs.readFileSync('src/assets/SOURCES.md', 'utf8');
const files = [...src.matchAll(/\| teas\/([\w-]+\.jpg) \|/g)].map(m => m[1]);
const missFile = files.filter(f => !fs.existsSync('src/assets/teas/' + f));
console.log('SOURCES 登记文件缺失:', missFile.length ? missFile.join(',') : '无');
console.log('SOURCES 茶叶图登记数:', files.length);
