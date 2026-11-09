/**
 * 轨迹扫描 —— 技能「真被打开过」的唯一口径实现
 *
 * 由 audit-skill-usage-from-trajectory.cjs 与 audit-skill-layering.cjs 共用。
 * 单独放一处的原因：两个脚本此前各写一套正则，口径一漂就出现「同一批轨迹一个报 57 次、一个报 95 次」。
 *
 * 口径（改这里等于改所有下游结论，动之前先想清楚）：
 *  1. 只认 Read 工具调用的 file_path = 真加载；正文里的文本提及是另一列，不可混。
 *  2. 只认 tea 仓库两个技能根（.agents/skills、.harness/skills）内的路径。
 *     不写死克隆目录名 —— 早期版本用 /Desktop/tea/ 前缀，在 worktree 或换机器克隆时静默漏计。
 *  3. 入口分四类统计：技能正文(SKILL.md)、路由表 README、族 README、AGENTS.md。
 *     只数 SKILL.md 会系统性低估「通道②」（先读路由表再读技能）的使用量。
 *  4. 目录不存在返回 { missing: true }，调用方必须报「未测」，不得按 0 计。
 */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

/** 豆包客户端会话轨迹目录；只在开发机存在 */
function defaultSessionsDir() {
  const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')
  return path.join(
    local,
    'Doubao',
    'User Data',
    'Default',
    '.doubao',
    'agent_mode',
    'workspace',
    '.sessions',
  )
}

function listTrajectories(dir) {
  const out = []
  ;(function walk(d) {
    let entries = []
    try {
      entries = fs.readdirSync(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name === 'trajectory.jsonl') out.push(p)
    }
  })(dir)
  return out
}

const toPosix = (p) => p.replace(/\\/g, '/')

const inSkillRoot = (p) => p.includes('/.agents/skills/') || p.includes('/.harness/skills/')

/** 入口分类；返回 null 表示不是本仓库技能入口
 * inScope 由 scan 传入，用来把「本机其它技能根」（如 ~/.agents/skills）排除在外
 */
function classify(p, inScope = () => true) {
  if (!inScope(p)) return null
  if (!inSkillRoot(p)) {
    if (/(^|\/)AGENTS\.md$/.test(p) && !p.includes('node_modules')) return 'agentsMd'
    return null
  }
  if (/\/SKILL\.md$/.test(p)) return 'skillMd'
  if (/\/\.agents\/skills\/[^/]+\.md$/.test(p)) return 'routeReadme' // 总表 README.md / threejs-INDEX.md
  if (/\/\.harness\/skills\/[^/]+\/README\.md$/.test(p)) return 'familyReadme'
  return 'skillRootOther'
}

/** 技能名：技能根后的第一段目录；.harness 跳过族目录取第二段 */
function skillNameOf(p) {
  const seg = p.split('/')
  const i = seg.lastIndexOf('skills')
  if (i < 0) return null
  if (p.includes('/.harness/skills/')) {
    const fam = seg[i + 1]
    const name = seg[i + 2]
    if (!name) return null
    // 族 README 已在 classify 里归 routeReadme，不会走到这里
    return name.replace(/^\d{2}-/, '')
  }
  return seg[i + 1] || null
}

function scan({ sessionsDir, repoMarks = [] }) {
  if (!fs.existsSync(sessionsDir)) {
    return { missing: true, sessionsDir }
  }

  // 仓库范围：路径须含任一标记（默认「Desktop/tea」覆盖主树与 worktree）。
  // 不加这层，本机 ~/.agents/skills 下的技能会被误算成本仓库的读取。
  const marks = repoMarks.map(toPosix).filter(Boolean)
  const inScope = (p) => (marks.length ? marks.some((m) => p.includes(m)) : true)

  const files = listTrajectories(sessionsDir)
  const skillReads = new Map()
  const entry = { skillMd: 0, routeReadme: 0, familyReadme: 0, agentsMd: 0, skillRootOther: 0 }
  const sessions = { total: files.length, withAny: 0, withSkillMd: 0, withRoute: 0, withAgentsMd: 0 }
  const perSession = []

  let lines = 0
  let badLines = 0
  let readCalls = 0

  for (const f of files) {
    let text = ''
    try {
      text = fs.readFileSync(f, 'utf8')
    } catch {
      continue
    }
    const sid = path.basename(path.dirname(path.dirname(f)))
    let sSkill = 0
    let sRoute = 0
    let sAgents = 0
    const seq = [] // 入口打开顺序，用来判断「AGENTS 先于技能」是否成立

    for (const rawLine of text.split('\n')) {
      if (!rawLine.trim()) continue
      lines += 1
      let obj
      try {
        obj = JSON.parse(rawLine)
      } catch {
        badLines += 1
        continue
      }
      for (const tc of obj.tool_calls || []) {
        const fn = tc.function || tc
        if (fn.name !== 'Read') continue
        readCalls += 1
        let args = fn.arguments
        if (typeof args === 'string') {
          try {
            args = JSON.parse(args)
          } catch {
            continue
          }
        }
        const fp = args && (args.file_path || args.path)
        if (typeof fp !== 'string') continue
        const normPath = toPosix(fp)
        const cls = classify(normPath, inScope)
        if (!cls) continue
        entry[cls] += 1
        if (cls === 'skillMd') seq.push('S')
        else if (cls === 'routeReadme' || cls === 'familyReadme') seq.push('R')
        else if (cls === 'agentsMd') seq.push('A')
        if (cls === 'skillMd') {
          const n = skillNameOf(normPath)
          if (n) skillReads.set(n, (skillReads.get(n) || 0) + 1)
          sSkill += 1
        } else if (cls === 'routeReadme' || cls === 'familyReadme') {
          sRoute += 1
        } else if (cls === 'agentsMd') {
          sAgents += 1
        }
      }
    }

    if (sSkill || sRoute || sAgents) {
      sessions.withAny += 1
      if (sSkill) sessions.withSkillMd += 1
      if (sRoute) sessions.withRoute += 1
      if (sAgents) sessions.withAgentsMd += 1
      perSession.push({ sid, skill: sSkill, route: sRoute, agents: sAgents, seq })
    }
  }

  return {
    missing: false,
    sessionsDir,
    repoMarks: marks,
    files: files.length,
    lines,
    badLines,
    readCalls,
    skillReads,
    entry,
    sessions,
    perSession,
  }
}

module.exports = { scan, classify, skillNameOf, defaultSessionsDir }
