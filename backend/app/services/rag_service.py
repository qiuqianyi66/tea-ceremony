"""
RAG 知识检索服务
从文化数据库中检索相关知识，为 LLM 提供上下文
"""

from app.database import SessionLocal
from app.models import Tea, TeaRegion, TeaPerson, TeaPoem, CultureDocument


def search_tea_knowledge(query: str, limit: int = 5) -> list[dict]:
    """
    在茶文化知识库中检索与 query 相关的内容。
    返回结构化知识片段列表。
    """
    results = []
    db = SessionLocal()
    try:
        # 1. 搜索茶叶
        teas = db.query(Tea).filter(Tea.name.ilike(f"%{query}%")).limit(limit).all()
        for t in teas:
            results.append({
                "type": "茶叶",
                "title": t.name,
                "content": f"{t.name}是{t.category}，产于{t.origin}。{t.story or ''}",
                "score": 1.0,
            })

        # 2. 搜索产区
        regions = db.query(TeaRegion).filter(TeaRegion.name.ilike(f"%{query}%")).limit(limit).all()
        for r in regions:
            results.append({
                "type": "产区",
                "title": r.name,
                "content": f"{r.name}位于{r.province}，海拔{r.altitude or '不详'}，{r.history or ''}",
                "score": 0.9,
            })

        # 3. 搜索茶人
        people = db.query(TeaPerson).filter(TeaPerson.name.ilike(f"%{query}%")).limit(limit).all()
        for p in people:
            results.append({
                "type": "茶人",
                "title": p.name,
                "content": f"{p.name}（{p.dynasty}），{p.identity or ''}。{p.biography or p.description or ''}",
                "score": 0.9,
            })

        # 4. 搜索茶诗
        poems = db.query(TeaPoem).filter(TeaPoem.content.ilike(f"%{query}%")).limit(limit).all()
        for p in poems:
            results.append({
                "type": "茶诗",
                "title": p.title,
                "content": f"《{p.title}》{p.author}（{p.dynasty}）：{p.content}",
                "score": 0.8,
            })

        # 5. 搜索文化文档（AI 知识库）
        docs = db.query(CultureDocument).filter(
            CultureDocument.content.ilike(f"%{query}%")
        ).limit(limit).all()
        for d in docs:
            results.append({
                "type": "文化资料",
                "title": d.title,
                "content": d.content[:500],
                "score": 0.7,
            })

    finally:
        db.close()

    return results[:limit]


def build_rag_context(query: str, max_sources: int = 3) -> str:
    """
    构建 RAG 上下文文本，供 LLM 使用。
    """
    sources = search_tea_knowledge(query, max_sources)
    if not sources:
        return ""

    parts = ["以下是茶文化数据库中与查询相关的资料：\n"]
    for i, s in enumerate(sources, 1):
        parts.append(f"[{i}] {s['type']}：{s['title']}")
        parts.append(f"    {s['content']}")
        parts.append("")

    return "\n".join(parts)
