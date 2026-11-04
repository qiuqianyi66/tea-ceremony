/**
 * RAG 审计口径回归锁（node --test，纯 fs 无依赖，跑在 CI harness-consistency job 里）。
 *
 * 锁三件事：
 *   ① scripts/lib/eval-rag-rules.cjs 与 Java CultureSearchService.splitKeywords 的口径一致
 *      ——镜像被单侧改坏时这里红，而不是等下一次评测数字莫名其妙变了才发现；
 *   ② KB 依赖判定两口径（语义 / 现有）的差别被显式测出来，防「只认四个字」的口径悄悄扩散；
 *   ③ 种子语料对评测实体的覆盖断言（君山银针 有、茶寿 无）——这是 audit-eval-rag.cjs
 *      语料缺口结论的牙齿：语料补上后本条会红，提醒删掉对应豁免。
 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const {
  splitKeywords,
  stripTailParticles,
  appendBigrams,
  MAX_KEYWORDS,
  isKbDependent,
  isKbDependentNarrow,
  expectedMentionsKbHits,
} = require('../lib/eval-rag-rules.cjs')

const JAVA = 'backend/src/main/java/com/tea/culture/service/CultureSearchService.java'
const SEED = 'backend/src/main/resources/db/migration/V2__culture_seed.sql'

test('splitKeywords 剥离尾部虚词：陆羽的 → 陆羽（评测 LIB-002/003 抓出的历史 bug）', () => {
  const kws = splitKeywords('陆羽的茶经讲了什么')
  assert.ok(kws.includes('陆羽'), `应含「陆羽」，实际 ${JSON.stringify(kws)}`)
})

test('splitKeywords 二次拆词能保留三字实体前缀（君山银针 → 君山）', () => {
  const kws = splitKeywords('君山银针是什么茶，有什么特点？')
  assert.ok(kws.includes('君山'), `应含「君山」，实际 ${JSON.stringify(kws)}`)
})

test('splitKeywords 按连接词切开多实体（铁观音/武夷岩茶）', () => {
  const kws = splitKeywords('铁观音和武夷岩茶有什么区别？')
  assert.ok(kws.includes('铁观音'), `应含「铁观音」，实际 ${JSON.stringify(kws)}`)
  assert.ok(
    kws.some((k) => k.startsWith('武夷')),
    `应含「武夷…」，实际 ${JSON.stringify(kws)}`,
  )
})

test('splitKeywords bigram 召回：长 token 追加 2 字切片（冲泡普洱熟茶 → 普洱/熟茶）', () => {
  const kws = splitKeywords('冲泡普洱熟茶要注意什么？')
  assert.ok(kws.includes('普洱') || kws.includes('熟茶'), `应含 2 字切片，实际 ${JSON.stringify(kws)}`)
})

test('splitKeywords 类目别名展开：岩茶 → 含「青茶」', () => {
  const kws = splitKeywords('岩茶')
  assert.ok(kws.includes('青茶'), `应含「青茶」，实际 ${JSON.stringify(kws)}`)
})

test('stripTailParticles 只剥语气虚词、不剥实体字', () => {
  assert.equal(stripTailParticles('陆羽的'), '陆羽')
  assert.equal(stripTailParticles('茶'), '茶')
  assert.equal(stripTailParticles('龙井'), '龙井')
})

test('appendBigrams：4 字给 2 片，奇数长度补尾部一片', () => {
  const four = []
  appendBigrams(four, '普洱熟茶')
  assert.deepEqual(four, ['普洱', '熟茶'])
  const five = []
  appendBigrams(five, '武夷岩茶香')
  assert.equal(five.length, 3, `奇数长度应补尾片，实际 ${JSON.stringify(five)}`)
  assert.equal(five.at(-1), '茶香')
})

test('KB 依赖两口径的差额固定：只有「引用…出处」的 case 语义上也算 KB 依赖', () => {
  const lib001 = [
    { name: '茶类归属正确', check: 'program' },
    { name: '引用知识库出处', check: 'judge' },
  ]
  assert.equal(isKbDependentNarrow(lib001), false, '历史窄口径只认「知识库命中」，此处应为 false')
  assert.equal(isKbDependent(lib001), true, '语义口径应把「引用知识库出处」算作 KB 依赖')
  const lib002 = [{ name: '知识库命中', check: 'program' }]
  assert.equal(isKbDependentNarrow(lib002), true)
  assert.equal(isKbDependent(lib002), true)
})

test('漏标信号：expected 里写了「知识库命中」应被识别（LIB-005 一类漏标靠它发现）', () => {
  assert.equal(expectedMentionsKbHits('特征（知识库命中）'), true)
  assert.equal(expectedMentionsKbHits('黄茶工艺特征准确'), false)
  assert.equal(expectedMentionsKbHits(null), false)
})

test('单一口径源：eval-tea-ai.cjs 必须引用 lib 判据，不得自己再写一份', () => {
  const text = fs.readFileSync('scripts/eval-tea-ai.cjs', 'utf8')
  assert.ok(
    text.includes("require('./lib/eval-rag-rules.cjs')"),
    'eval-tea-ai.cjs 应 require lib 判据（此前两份判据漂移过，导致 ragRecallK 分母被悄悄缩小）',
  )
  assert.ok(
    !/kbDependent\s*=\s*\(caseDef\.points[\s\S]{0,80}includes\('知识库命中'\)/.test(text),
    'eval-tea-ai.cjs 不应再保留内联的窄判据',
  )
})

test('空白/无实体输入不崩：回退整句，不返回空数组', () => {
  assert.deepEqual(splitKeywords('你好'), ['你好'])
  assert.deepEqual(splitKeywords(''), [''])
})

test('镜像漂移锁：Java 侧 MAX_KEYWORDS 与类目别名必须与 JS 镜像同值', () => {
  const java = fs.readFileSync(JAVA, 'utf8')
  const m = java.match(/MAX_KEYWORDS\s*=\s*(\d+)/)
  assert.ok(m, 'Java 侧应能找到 MAX_KEYWORDS 常量')
  assert.equal(
    Number(m[1]),
    MAX_KEYWORDS,
    `Java MAX_KEYWORDS=${m[1]} 与 JS 镜像 ${MAX_KEYWORDS} 不一致（改一侧必须同步另一侧）`,
  )
  for (const alias of ['乌龙茶', '乌龙', '岩茶']) {
    assert.ok(java.includes(`"${alias}"`), `Java 侧 CATEGORY_ALIASES 应含别名 ${alias}`)
  }
})

test('语料覆盖断言：君山银针在种子语料里（有数据），茶寿不在（LIB-006 考的是优雅降级、不是命中）', () => {
  const seed = fs.readFileSync(SEED, 'utf8')
  assert.ok(seed.includes('君山银针'), '君山银针 应在 V2 种子里——否则 LIB-005 的 miss 归因要重写')
  assert.ok(
    !seed.includes('茶寿'),
    '茶寿 不该出现在种子里；若已补语料，需重新判定 LIB-006 是否要改成 KB 依赖 case',
  )
})
