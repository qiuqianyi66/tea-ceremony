/**
 * 「调用技能」单元格解析（从 audit-skill-usage.cjs 拆出，供回归锁直接测）。
 * 返回值必须区分两种空：declaredNone（主动写「无」）与 names 为空（写法坏了）。
 * 混为一谈会让「填错格式」看起来像「没用技能」，正是静默失败的样子。
 */
function parseSkillNames(cell) {
  // 只取说明括号前的部分：容忍 `plan-control（评审）` 这类尾注，避免把说明文字当成技能名
  const body = String(cell).split('（')[0].trim();
  if (/^无$/.test(body)) return { declaredNone: true, names: [] };
  // 双模式：优先反引号（模板推荐形态）；没有反引号时按顿号/逗号/空白切，并只接受 kebab-case 名，
  // 这样「照模板直接填 plan-control、coding-skill」也能解析，而夹带的散文不会被当成技能名。
  const ticked = [...body.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim()).filter(Boolean);
  const names = ticked.length
    ? ticked
    : body
        .split(/[、,，\s]+/)
        .map((s) => s.trim())
        .filter((s) => /^[a-z0-9-]+$/.test(s));
  return { declaredNone: false, names };
}

module.exports = { parseSkillNames };
