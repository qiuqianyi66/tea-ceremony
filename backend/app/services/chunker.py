"""
知识切片工具
将茶叶数据拆分为 AI 可检索的知识片段
"""

from app.database import SessionLocal
from app.models import CultureDocument, Tea, TeaPerson, TeaRegion, TeaPoem


def chunk_teas(db):
    """将茶叶数据切片为知识文档"""
    teas = db.query(Tea).all()
    count = 0
    for tea in teas:
        # 基本信息
        doc = CultureDocument(
            title=f"{tea.name}基本信息",
            category="茶叶",
            content=f"{tea.name}属于{tea.category}类，产于{tea.origin or '未知产地'}。"
                    f"最佳冲泡水温{tea.best_temp or '未知'}°C，推荐浸泡{tea.best_time or '未知'}秒。"
                    f"风味特征：{', '.join(tea.flavor or [])}。{tea.description or ''}",
            source_type="tea",
        )
        db.add(doc)
        count += 1

        # 文化故事
        if tea.story:
            doc2 = CultureDocument(
                title=f"{tea.name}文化故事",
                category="茶文化",
                content=tea.story,
                source_type="tea_story",
            )
            db.add(doc2)
            count += 1

    db.commit()
    return count


def chunk_people(db):
    """将茶人数据切片为知识文档"""
    people = db.query(TeaPerson).all()
    count = 0
    for p in people:
        content = f"{p.name}（{p.dynasty or '未知朝代'}），{p.identity or ''}。"
        if p.description:
            content += p.description
        if p.contribution:
            content += f"主要贡献：{p.contribution}"
        if p.quote:
            content += f"名言：{p.quote}"

        doc = CultureDocument(
            title=f"{p.name}（{p.dynasty}）",
            category="茶人",
            content=content,
            source_type="person",
        )
        db.add(doc)
        count += 1

    db.commit()
    return count


def chunk_poems(db):
    """将茶诗数据切片为知识文档"""
    poems = db.query(TeaPoem).all()
    count = 0
    for p in poems:
        doc = CultureDocument(
            title=f"《{p.title}》{p.author}",
            category="茶诗",
            content=f"《{p.title}》{p.author}（{p.dynasty or '未知朝代'}）：{p.content}",
            source_type="poem",
        )
        db.add(doc)
        count += 1

    db.commit()
    return count


def run_all_chunks():
    """运行全部切片任务"""
    db = SessionLocal()
    try:
        total = 0
        total += chunk_teas(db)
        total += chunk_people(db)
        total += chunk_poems(db)
        print(f"✅ 知识切片完成：共生成 {total} 篇文档")
    except Exception as e:
        print(f"❌ 切片失败: {e}")
        db.rollback()
    finally:
        db.close()
