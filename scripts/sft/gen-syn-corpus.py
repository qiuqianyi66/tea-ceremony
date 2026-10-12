# SFT 合成语料批量生成（T11）：调后端 /api/v1/ai/chat?agent=mentor 生成回答
# 读 questions.json + 评测 case inputs（正则提取）→ 逐条 POST（delay 7s 守限流 10/min）→ corpus-syn.jsonl（断点续跑）
import json
import os
import re
import time
import urllib.request

SFT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE = os.environ.get("SFT_BASE", "http://localhost:18080")
API = f"{BASE}/api/v1/ai/chat"
DELAY = 7.0

def load_questions():
    with open(os.path.join(SFT_DIR, "questions.json"), encoding="utf-8") as f:
        return json.load(f)

def load_eval_case_inputs():
    inputs = []
    cases_dir = os.path.join(os.path.dirname(SFT_DIR), "..", "docs", "ai-eval", "cases")
    for fn in sorted(os.listdir(cases_dir)):
        if not fn.endswith(".yaml"):
            continue
        cur_id, cur_input = None, None
        with open(os.path.join(cases_dir, fn), encoding="utf-8") as f:
            for line in f:
                s = line.rstrip("\n")
                m = re.match(r"^\s+- id:\s*(\S+)\s*$", s)
                if m:
                    if cur_id and cur_input:
                        inputs.append({"question": cur_input, "theme": "eval-case", "sourceCase": cur_id})
                    cur_id, cur_input = m.group(1), None
                    continue
                m = re.match(r"^\s+input:\s*(.*)$", s)
                if m and cur_id and not cur_input:
                    cur_input = m.group(1).strip().strip('"\'')
        if cur_id and cur_input:
            inputs.append({"question": cur_input, "theme": "eval-case", "sourceCase": cur_id})
    return inputs

def call_mentor(question, timeout=90):
    body = json.dumps({"messages": [{"role": "user", "content": question}], "agent": "mentor"}, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(API, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data.get("data", {}).get("answer") or data.get("data", {}).get("content") or ""

def main():
    questions = load_questions() + load_eval_case_inputs()
    out_path = os.path.join(SFT_DIR, "corpus-syn.jsonl")
    done = {}
    if os.path.exists(out_path):
        for line in open(out_path, encoding="utf-8"):
            try:
                rec = json.loads(line)
                done[rec["question"]] = rec
            except Exception:
                pass
    todo = [q for q in questions if q["question"] not in done]
    print(f"问题 {len(questions)}，已完成 {len(done)}，待生成 {len(todo)}", flush=True)
    ok = fail = 0
    for i, q in enumerate(todo, 1):
        try:
            ans = call_mentor(q["question"])
            if len(ans) < 20:
                raise ValueError(f"回答过短 {len(ans)}")
            rec = {"question": q["question"], "answer": ans, "theme": q["theme"],
                   "sourceCase": q.get("sourceCase"), "agent": "mentor", "source": "syn"}
            with open(out_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(rec, ensure_ascii=False) + "\n")
            ok += 1
        except Exception as e:
            fail += 1
            print(f"[{i}/{len(todo)}] FAIL {q['question'][:30]}: {e}", flush=True)
        if i % 10 == 0:
            print(f"进度 {i}/{len(todo)} ok={ok} fail={fail}", flush=True)
        time.sleep(DELAY)
    print(f"完成：新增 {ok}，失败 {fail}，累计 {len(done) + ok}", flush=True)

if __name__ == "__main__":
    main()
