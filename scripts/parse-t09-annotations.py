# 解析 T09 人工复核完成版 TXT → 回填 samples-judge-t09.json 的 human 字段
import json
import re
import sys

SRC = sys.argv[1] if len(sys.argv) > 1 else r"D:\T09_judge_%E4%BA%BA%E5%B7%A5%E5%A4%8D%E6%A0%B8%E5%AE%8C%E6%88%90.txt"
SAMPLES = "docs/ai-eval/samples-judge-t09.json"

# 解析 TXT：每条 id 标题行 + 后续 human（你来判）：值
human_map = {}
cur_id = None
for line in open(SRC, encoding="utf-8"):
    m = re.match(r"^([A-Z]+-\d+::\s*.+)$", line.strip())
    if m:
        cur_id = m.group(1).strip()
        continue
    m = re.match(r"^human（你来判）：(.+)$", line.strip())
    if m and cur_id:
        human_map[cur_id] = m.group(1).strip()
        cur_id = None

samples = json.load(open(SAMPLES, encoding="utf-8"))
matched = 0
for s in samples:
    key = s["id"]
    val = human_map.get(key)
    if val is None:
        for k, v in human_map.items():
            if k.replace(" ", "") == key.replace(" ", ""):
                val = v
                break
    if val is not None:
        # 脚本期望 human 为数字 0/1（'UNKNOWN' 保持字符串）
        s["human"] = 1 if val == "1" else 0 if val == "0" else "UNKNOWN"
        matched += 1

json.dump(samples, open(SAMPLES, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"回填 {matched}/{len(samples)}，human_map 共 {len(human_map)}")
# 一致性快算
valid = [s for s in samples if s["human"] not in (None, "UNKNOWN")]
agree = sum(1 for s in valid if str(s["machine"]) == str(0 if s["human"] == "0" else 1))
print(f"有效对照 {len(valid)}，一致 {agree}，一致率 {agree/len(valid)*100:.1f}%")
