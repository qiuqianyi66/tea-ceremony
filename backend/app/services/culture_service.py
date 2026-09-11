"""茶文化领域服务：封装茶叶/产区/茶人/茶诗/工艺的查询逻辑。"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Tea, TeaRegion, TeaPerson, TeaPoem, TeaProcess


async def list_regions(db: AsyncSession, province: str | None = None) -> list[TeaRegion]:
    stmt = select(TeaRegion)
    if province:
        stmt = stmt.filter(TeaRegion.province == province)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_region(db: AsyncSession, region_id: int) -> TeaRegion | None:
    result = await db.execute(select(TeaRegion).filter(TeaRegion.id == region_id))
    return result.scalar_one_or_none()


async def list_people(db: AsyncSession, dynasty: str | None = None) -> list[TeaPerson]:
    stmt = select(TeaPerson)
    if dynasty:
        stmt = stmt.filter(TeaPerson.dynasty == dynasty)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_person(db: AsyncSession, person_id: int) -> TeaPerson | None:
    result = await db.execute(select(TeaPerson).filter(TeaPerson.id == person_id))
    return result.scalar_one_or_none()


async def list_poems(db: AsyncSession, author: str | None = None) -> list[TeaPoem]:
    stmt = select(TeaPoem)
    if author:
        stmt = stmt.filter(TeaPoem.author == author)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_poem(db: AsyncSession, poem_id: int) -> TeaPoem | None:
    result = await db.execute(select(TeaPoem).filter(TeaPoem.id == poem_id))
    return result.scalar_one_or_none()


async def list_processes(db: AsyncSession) -> list[TeaProcess]:
    result = await db.execute(select(TeaProcess))
    return list(result.scalars().all())


async def get_process(db: AsyncSession, process_id: int) -> TeaProcess | None:
    result = await db.execute(select(TeaProcess).filter(TeaProcess.id == process_id))
    return result.scalar_one_or_none()


async def _people_for_tea(db: AsyncSession, tea_id: int) -> list[TeaPerson]:
    """按关联茶 ID 过滤茶人。related_tea_ids 是 JSON 列，数据量小直接 Python 过滤。
    TODO: 数据量增长后改关联表。"""
    result = await db.execute(select(TeaPerson))
    people = result.scalars().all()
    return [p for p in people if str(tea_id) in (p.related_tea_ids or [])]


async def get_tea_detail(db: AsyncSession, tea_id: int) -> dict | None:
    """返回茶叶完整文化信息（含关联的产区/茶人/工艺/诗词）。"""
    # selectinload 一次查出关联对象，避免 N+1
    stmt = (
        select(Tea)
        .options(selectinload(Tea.region), selectinload(Tea.process))
        .filter(Tea.id == tea_id)
    )
    result = await db.execute(stmt)
    tea = result.scalar_one_or_none()
    if not tea:
        return None

    result_dict: dict = {
        "id": tea.id,
        "name": tea.name,
        "category": tea.category,
        "description": tea.description,
        "story": tea.story,
    }
    if tea.region:
        result_dict["region"] = {
            "name": tea.region.name,
            "province": tea.region.province,
            "history": tea.region.history,
        }
    if tea.process:
        result_dict["process"] = {
            "name": tea.process.name,
            "steps": tea.process.steps,
        }
    people = await _people_for_tea(db, tea.id)
    if people:
        result_dict["people"] = [
            {"name": p.name, "dynasty": p.dynasty, "quote": p.quote}
            for p in people
        ]
    return result_dict


async def get_tea_graph(db: AsyncSession, tea_id: int) -> dict | None:
    """返回茶叶的知识图谱（节点+边）。"""
    stmt = (
        select(Tea)
        .options(selectinload(Tea.region), selectinload(Tea.process))
        .filter(Tea.id == tea_id)
    )
    result = await db.execute(stmt)
    tea = result.scalar_one_or_none()
    if not tea:
        return None

    nodes = [{"id": f"tea_{tea.id}", "name": tea.name, "type": "tea"}]
    edges = []

    if tea.region:
        nodes.append({"id": f"region_{tea.region.id}", "name": tea.region.name, "type": "region"})
        edges.append({"source": f"tea_{tea.id}", "target": f"region_{tea.region.id}", "relation": "产自"})

    if tea.process:
        nodes.append({"id": f"process_{tea.process.id}", "name": tea.process.name, "type": "process"})
        edges.append({"source": f"tea_{tea.id}", "target": f"process_{tea.process.id}", "relation": "工艺"})

    people = await _people_for_tea(db, tea_id)
    for p in people:
        nodes.append({"id": f"person_{p.id}", "name": p.name, "type": "person"})
        edges.append({"source": f"tea_{tea.id}", "target": f"person_{p.id}", "relation": "历史关联"})

    return {"nodes": nodes, "edges": edges}


async def search_culture(db: AsyncSession, q: str) -> dict:
    """跨实体搜索。"""
    if not q:
        return {"teas": [], "people": [], "regions": [], "poems": []}

    teas_result = await db.execute(select(Tea).filter(Tea.name.ilike(f"%{q}%")).limit(5))
    people_result = await db.execute(select(TeaPerson).filter(TeaPerson.name.ilike(f"%{q}%")).limit(5))
    regions_result = await db.execute(select(TeaRegion).filter(TeaRegion.name.ilike(f"%{q}%")).limit(5))
    poems_result = await db.execute(select(TeaPoem).filter(TeaPoem.content.ilike(f"%{q}%")).limit(5))

    return {
        "teas": [{"id": t.id, "name": t.name, "type": "tea"} for t in teas_result.scalars().all()],
        "people": [
            {"id": p.id, "name": p.name, "dynasty": p.dynasty, "type": "person"}
            for p in people_result.scalars().all()
        ],
        "regions": [
            {"id": r.id, "name": r.name, "province": r.province, "type": "region"}
            for r in regions_result.scalars().all()
        ],
        "poems": [
            {"id": p.id, "title": p.title, "author": p.author, "type": "poem"}
            for p in poems_result.scalars().all()
        ],
    }
