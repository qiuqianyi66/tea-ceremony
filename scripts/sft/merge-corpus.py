# SFT 语料合并与质检（T11）：真实(54) + 合成(267) → 去重 → 拆分 90/10 → 抽检样本
# 输出：corpus-final.jsonl（messages 格式，训练+留出全集）、corpus-train.jsonl / corpus-eval.jsonl、
#       corpus-sample-10pct.jsonl（抽检清单，供人工复核）
import json
import os
import random

SFT_DIR = os.path.dirname(os.path.abspath(__file__))
random.seed(42)

MENTOR_SYSTEM = """你是「一盏茶」的成长导师（mentor），一位温和的茶路引路人。
语气：鼓励克制，先肯定再建议，像陪练而非考官；不评判、不施压。
输出形态：「成长建议」——回顾最近品鉴轨迹（次数/口味偏好/记录习惯），给 1~2 条可落地的下一步尝试。
规则：
1. 优先基于下方「用户品鉴记录」给出可落地的建议；无记录时给通用的茶路入门建议（如从识茶辨类开始、建立品鉴记录习惯），并引导开始记录，不凭空点评用户数据。
2. 知识库（茶文化常识）作背景；未命中时明确说明"知识库未命中，以下为常识回答"。
3. 不编造用户记录；不确定处标注"待核实"。
4. 回答简洁（≤200 字），一次一个主题。
5. 涉功效（减肥/治病/养生）须说明茶是饮品而非药物、需配合饮食运动；禁引经据典暗示疗效；拒配合极端节食等危害健康的请求。涉咖啡因须提示影响并给低因替代。"""

def load_jsonl(p):
    rows = []
    if os.path.exists(p):
        for line in open(p, encoding="utf-8"):
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows

real = load_jsonl(os.path.join(SFT_DIR, "corpus-real.jsonl"))
syn = load_jsonl(os.path.join(SFT_DIR, "corpus-syn.jsonl"))

# 合成层：转 messages 格式（真实层已是 messages）
syn_msgs = []
for r in syn:
    syn_msgs.append({
        "messages": [
            {"role": "system", "content": MENTOR_SYSTEM},
            {"role": "user", "content": r["question"]},
            {"role": "assistant", "content": r["answer"]},
        ],
        "source": r.get("source", "syn"),
        "agent": "mentor",
        "theme": r.get("theme", ""),
        "sourceCase": r.get("sourceCase"),
    })

# 去重：按 user 问题文本
seen = set()
merged = []
for r in real + syn_msgs:
    q = r["messages"][1]["content"]
    if q in seen:
        continue
    seen.add(q)
    merged.append(r)

random.shuffle(merged)
n = len(merged)
split = int(n * 0.9)
train, ev = merged[:split], merged[split:]

def write_jsonl(p, rows):
    with open(p, "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

write_jsonl(os.path.join(SFT_DIR, "corpus-final.jsonl"), merged)
write_jsonl(os.path.join(SFT_DIR, "corpus-train.jsonl"), train)
write_jsonl(os.path.join(SFT_DIR, "corpus-eval.jsonl"), ev)

# 抽检 10%（从 train 里抽，不含留出集）
sample = random.sample(train, max(1, int(len(train) * 0.1)))
write_jsonl(os.path.join(SFT_DIR, "corpus-sample-10pct.jsonl"), sample)

from collections import Counter
print(f"真实 {len(real)} + 合成 {len(syn_msgs)} = 合并 {n}（去重后）")
print(f"训练 {len(train)} / 留出 {len(ev)}（90/10），抽检 {len(sample)}")
print(f"主题分布: {dict(Counter(r.get('theme', '?') for r in merged))}")
