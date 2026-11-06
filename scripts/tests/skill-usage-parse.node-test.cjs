/**
 * 「调用技能」解析回归锁（node --test）。
 * 锁的是真实写法：裸名、反引号、中文尾注、主动写「无」、散文误填。
 * 格式一旦漂移，这里先红，而不是等到统计数字悄悄归零才发现。
 */
const test = require('node:test');
const assert = require('node:assert');
const { parseSkillNames } = require('../skill-usage-parse.cjs');

test('裸名（顿号分隔）解析出两个技能', () => {
  const r = parseSkillNames('plan-control、coding-skill');
  assert.equal(r.declaredNone, false);
  assert.deepEqual(r.names, ['plan-control', 'coding-skill']);
});

test('反引号 + 中文尾注：尾注不进入技能名', () => {
  const r = parseSkillNames('`plan-control`、`coding-skill`（评审阶段）');
  assert.deepEqual(r.names, ['plan-control', 'coding-skill']);
});

test('主动写「无」= declaredNone，不算解析失败', () => {
  const r = parseSkillNames('无');
  assert.equal(r.declaredNone, true);
  assert.deepEqual(r.names, []);
});

test('散文误填（含路径）不会被当成技能名，names 为空交由调用方响亮报错', () => {
  const r = parseSkillNames('由 scripts/audit-skill-usage.cjs 统计');
  assert.equal(r.declaredNone, false);
  assert.deepEqual(r.names, []);
});

test('单个反引号技能名', () => {
  const r = parseSkillNames('`request-analysis`');
  assert.deepEqual(r.names, ['request-analysis']);
});
