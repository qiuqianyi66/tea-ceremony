"""茶文化数据 API（V2.0 知识库）"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Tea, TeaRegion, TeaPerson, TeaPoem, TeaProcess

router = APIRouter()


# ============ 产区 ============

@router.get("/regions")
def list_regions(province: str = None, db: Session = Depends(get_db)):
    query = db.query(TeaRegion)
    if province:
        query = query.filter(TeaRegion.province == province)
    return query.all()


@router.get("/regions/{region_id}")
def get_region(region_id: int, db: Session = Depends(get_db)):
    region = db.query(TeaRegion).filter(TeaRegion.id == region_id).first()
    if not region:

        raise HTTPException(status_code=404, detail="产区不存在")
    return region


# ============ 茶人 ============

@router.get("/people")
def list_people(dynasty: str = None, db: Session = Depends(get_db)):
    query = db.query(TeaPerson)
    if dynasty:
        query = query.filter(TeaPerson.dynasty == dynasty)
    return query.all()


@router.get("/people/{person_id}")
def get_person(person_id: int, db: Session = Depends(get_db)):
    person = db.query(TeaPerson).filter(TeaPerson.id == person_id).first()
    if not person:

        raise HTTPException(status_code=404, detail="茶人不存在")
    return person


# ============ 茶诗 ============

@router.get("/poems")
def list_poems(author: str = None, db: Session = Depends(get_db)):
    query = db.query(TeaPoem)
    if author:
        query = query.filter(TeaPoem.author == author)
    return query.all()


@router.get("/poems/{poem_id}")
def get_poem(poem_id: int, db: Session = Depends(get_db)):
    poem = db.query(TeaPoem).filter(TeaPoem.id == poem_id).first()
    if not poem:

        raise HTTPException(status_code=404, detail="诗词不存在")
    return poem


# ============ 制茶工艺 ============

@router.get("/processes")
def list_processes(db: Session = Depends(get_db)):
    return db.query(TeaProcess).all()


@router.get("/processes/{process_id}")
def get_process(process_id: int, db: Session = Depends(get_db)):
    process = db.query(TeaProcess).filter(TeaProcess.id == process_id).first()
    if not process:

        raise HTTPException(status_code=404, detail="工艺不存在")
    return process


# ============ 茶叶详情（含关联数据）============

@router.get("/teas/{tea_id}/detail")
def get_tea_detail(tea_id: int, db: Session = Depends(get_db)):
    """返回茶叶完整文化信息（含关联的产区/茶人/工艺/诗词）"""
    tea = db.query(Tea).filter(Tea.id == tea_id).first()
    if not tea:

        raise HTTPException(status_code=404, detail="茶叶不存在")

    result = {
        "id": tea.id,
        "name": tea.name,
        "category": tea.category,
        "description": tea.description,
        "story": tea.story,
    }

    # 关联产区
    if tea.region_id:
        region = db.query(TeaRegion).filter(TeaRegion.id == tea.region_id).first()
        if region:
            result["region"] = {
                "name": region.name,
                "province": region.province,
                "history": region.history,
            }

    # 关联工艺
    if tea.process_id:
        process = db.query(TeaProcess).filter(TeaProcess.id == tea.process_id).first()
        if process:
            result["process"] = {
                "name": process.name,
                "steps": process.steps,
            }

    # 关联茶人
    people = db.query(TeaPerson).filter(
        TeaPerson.related_tea_ids.contains([str(tea.id)])
    ).all()
    if people:
        result["people"] = [
            {"name": p.name, "dynasty": p.dynasty, "quote": p.quote}
            for p in people
        ]

    return result


# ============ 知识图谱 ============

@router.get("/graph/{tea_id}")
def get_tea_graph(tea_id: int, db: Session = Depends(get_db)):
    """返回茶叶的知识图谱（节点+边）"""
    tea = db.query(Tea).filter(Tea.id == tea_id).first()
    if not tea:
        raise HTTPException(status_code=404, detail="茶叶不存在")

    nodes = [{"id": f"tea_{tea.id}", "name": tea.name, "type": "tea"}]
    edges = []

    # 关联产区
    if tea.region_id:
        region = db.query(TeaRegion).filter(TeaRegion.id == tea.region_id).first()
        if region:
            nodes.append({"id": f"region_{region.id}", "name": region.name, "type": "region"})
            edges.append({"source": f"tea_{tea.id}", "target": f"region_{region.id}", "relation": "产自"})

    # 关联工艺
    if tea.process_id:
        process = db.query(TeaProcess).filter(TeaProcess.id == tea.process_id).first()
        if process:
            nodes.append({"id": f"process_{process.id}", "name": process.name, "type": "process"})
            edges.append({"source": f"tea_{tea.id}", "target": f"process_{process.id}", "relation": "工艺"})

    # 关联茶人
    people = db.query(TeaPerson).filter(
        TeaPerson.related_tea_ids.contains([str(tea.id)])
    ).all()
    for p in people:
        nodes.append({"id": f"person_{p.id}", "name": p.name, "type": "person"})
        edges.append({"source": f"tea_{tea.id}", "target": f"person_{p.id}", "relation": "历史关联"})

    return {"nodes": nodes, "edges": edges}


# ============ 搜索 ============

@router.get("/search")
def search_culture(q: str = "", db: Session = Depends(get_db)):
    """跨实体搜索"""
    if not q:
        return {"teas": [], "people": [], "regions": [], "poems": []}

    results = {}

    # 搜索茶叶
    teas_result = db.query(Tea).filter(Tea.name.ilike(f"%{q}%")).limit(5).all()
    results["teas"] = [{"id": t.id, "name": t.name, "type": "tea"} for t in teas_result]

    # 搜索茶人
    people_result = db.query(TeaPerson).filter(TeaPerson.name.ilike(f"%{q}%")).limit(5).all()
    results["people"] = [{"id": p.id, "name": p.name, "dynasty": p.dynasty, "type": "person"} for p in people_result]

    # 搜索产区
    regions_result = db.query(TeaRegion).filter(TeaRegion.name.ilike(f"%{q}%")).limit(5).all()
    results["regions"] = [{"id": r.id, "name": r.name, "province": r.province, "type": "region"} for r in regions_result]

    # 搜索茶诗
    poems_result = db.query(TeaPoem).filter(TeaPoem.content.ilike(f"%{q}%")).limit(5).all()
    results["poems"] = [{"id": p.id, "title": p.title, "author": p.author, "type": "poem"} for p in poems_result]

    return results
