# SFT 语料构建（T11，2026-10-12）：从 ai_eval_traces CSV 导出构建 mentor 微调语料
# 读 raw-traces.csv → 过滤（judge 评委调用 / 空输出 / 无问题）→ 提取 question → 去重 → 输出 SFT JSONL + 统计
import csv
import json
import os

SFT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)))

MENTOR_SYSTEM = """你是「一盏茶」的成长导师（mentor），一位温和的茶路引路人。
语气：鼓励克制，先肯定再建议，像陪练而非考官；不评判、不施压。
输出形态：「成长建议」——回顾最近品鉴轨迹（次数/口味偏好/记录习惯），给 1~2 条可落地的下一步尝试。
规则：
1. 优先基于下方「用户品鉴记录」给出可落地的建议；无记录时给通用的茶路入门建议（如从识茶辨类开始、建立品鉴记录习惯），并引导开始记录，不凭空点评用户数据。
2. 知识库（茶文化常识）作背景；未命中时明确说明"知识库未命中，以下为常识回答"。
3. 不编造用户记录；不确定处标注"待核实"。
4. 回答简洁（≤200 字），一次一个主题。
5. 涉功效（减肥/治病/养生）须说明茶是饮品而非药物、需配合饮食运动；禁引经据典暗示疗效；拒配合极端节食等危害健康的请求。涉咖啡因须提示影响并给低因替代。"""

JUDGE_MARK = "独立评委"
MIN_OUTPUT = 40

def extract_question(input_text):
    try:
        obj = json.loads(input_text)
        q = obj.get("question") or obj.get("input") or ""
        return str(q).strip()
    except Exception:
        return ""

stats = {"total": 0, "filtered": {"judge": 0, "short": 0, "no_question": 0}, "by_agent": {}, "corpus": 0}
seen = set()
corpus = []

with open(os.path.join(SFT_DIR, "raw-traces.csv"), encoding="utf-8-sig", newline="") as f:
    for row in csv.DictReader(f):
        stats["total"] += 1
        q = extract_question(row.get("input", ""))
        out = (row.get("output") or "").strip()
        if not q:
            stats["filtered"]["no_question"] += 1
            continue
        if JUDGE_MARK in q:
            stats["filtered"]["judge"] += 1
            continue
        if len(out) < MIN_OUTPUT:
            stats["filtered"]["short"] += 1
            continue
        if q in seen:
            continue
        seen.add(q)
        agent = row.get("agent_type", "?")
        stats["by_agent"][agent] = stats["by_agent"].get(agent, 0) + 1
        corpus.append({
            "messages": [
                {"role": "system", "content": MENTOR_SYSTEM},
                {"role": "user", "content": q},
                {"role": "assistant", "content": out},
            ],
            "source": "real",
            "agent": agent,
            "traceId": row.get("id"),
        })

stats["corpus"] = len(corpus)
with open(os.path.join(SFT_DIR, "corpus-real.jsonl"), "w", encoding="utf-8") as f:
    for c in corpus:
        f.write(json.dumps(c, ensure_ascii=False) + "\n")
with open(os.path.join(SFT_DIR, "corpus-stats.json"), "w", encoding="utf-8") as f:
    json.dump(stats, f, ensure_ascii=False, indent=2)
print(json.dumps(stats, ensure_ascii=False, indent=2))
print(f"真实语料 {len(corpus)} 条 → scripts/sft/corpus-real.jsonl")
