"""茶文化数据 API（V2.0 知识库）"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import RegionResponse, PersonResponse, PoemResponse
from app.services import culture_service as svc

router = APIRouter()


# ============ 产区 ============

@router.get("/regions", response_model=list[RegionResponse])
async def list_regions(province: str | None = None, db: AsyncSession = Depends(get_db)):
    return await svc.list_regions(db, province)


@router.get("/regions/{region_id}", response_model=RegionResponse)
async def get_region(region_id: int, db: AsyncSession = Depends(get_db)):
    region = await svc.get_region(db, region_id)
    if not region:
        raise HTTPException(status_code=404, detail="产区不存在")
    return region


# ============ 茶人 ============

@router.get("/people", response_model=list[PersonResponse])
async def list_people(dynasty: str | None = None, db: AsyncSession = Depends(get_db)):
    return await svc.list_people(db, dynasty)


@router.get("/people/{person_id}", response_model=PersonResponse)
async def get_person(person_id: int, db: AsyncSession = Depends(get_db)):
    person = await svc.get_person(db, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="茶人不存在")
    return person


# ============ 茶诗 ============

@router.get("/poems", response_model=list[PoemResponse])
async def list_poems(author: str | None = None, db: AsyncSession = Depends(get_db)):
    return await svc.list_poems(db, author)


@router.get("/poems/{poem_id}", response_model=PoemResponse)
async def get_poem(poem_id: int, db: AsyncSession = Depends(get_db)):
    poem = await svc.get_poem(db, poem_id)
    if not poem:
        raise HTTPException(status_code=404, detail="诗词不存在")
    return poem


# ============ 制茶工艺 ============

@router.get("/processes")
async def list_processes(db: AsyncSession = Depends(get_db)):
    return await svc.list_processes(db)


@router.get("/processes/{process_id}")
async def get_process(process_id: int, db: AsyncSession = Depends(get_db)):
    process = await svc.get_process(db, process_id)
    if not process:
        raise HTTPException(status_code=404, detail="工艺不存在")
    return process


# ============ 茶叶详情（含关联数据）============

@router.get("/teas/{tea_id}/detail")
async def get_tea_detail(tea_id: int, db: AsyncSession = Depends(get_db)):
    result = await svc.get_tea_detail(db, tea_id)
    if not result:
        raise HTTPException(status_code=404, detail="茶叶不存在")
    return result


# ============ 知识图谱 ============

@router.get("/graph/{tea_id}")
async def get_tea_graph(tea_id: int, db: AsyncSession = Depends(get_db)):
    result = await svc.get_tea_graph(db, tea_id)
    if not result:
        raise HTTPException(status_code=404, detail="茶叶不存在")
    return result


# ============ 搜索 ============

@router.get("/search")
async def search_culture(q: str = "", db: AsyncSession = Depends(get_db)):
    return await svc.search_culture(db, q)
