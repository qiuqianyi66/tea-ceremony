/** audit-states.cjs — 五态（hover/disabled/loading/error/empty）覆盖扫描 */
const fs = require('fs');
const { execSync } = require('child_process');
const files = execSync('git ls-files', { encoding: 'utf8' }).trim().split('\n')
  .filter(f => /^src\/(views|components)\//.test(f) && f.endsWith('.vue'));

const patterns = {
  disabled: /disabled:|:disabled\b|disabled\.|isDisabled/,
  loading: /loading|isSaving|isSubmitting|isSubmitting|saving\b/,
  error: /error|Error|errMsg|fail/i,
  empty: /empty|暂无|还没有|length === 0|\.length\s*===?\s*0|v-if="!.*length/,
  hover: /hover:/,
};

const stats = {};
for (const k of Object.keys(patterns)) stats[k] = [];

for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  for (const k of Object.keys(patterns)) {
    if (patterns[k].test(s)) stats[k].push(f.replace('src/', ''));
  }
}

for (const k of Object.keys(stats)) {
  console.log(k.padEnd(9), stats[k].length, '文件');
  console.log('  ', stats[k].join(', '));
}

// 关键交互页面的五态缺口：TasteView 保存、LoginView、HistoryView 空态
console.log('\n--- 关键页面专项 ---');
for (const f of ['views/TasteView.vue', 'views/LoginView.vue', 'views/HistoryView.vue', 'views/CollectionView.vue', 'views/SelectView.vue']) {
  const p = 'src/' + f;
  const s = fs.readFileSync(p, 'utf8');
  const miss = Object.keys(patterns).filter(k => !patterns[k].test(s));
  console.log(f, '缺:', miss.length ? miss.join(', ') : '无');
}
