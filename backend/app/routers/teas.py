"""茶叶数据 API"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Tea
from app.schemas import TeaResponse

router = APIRouter()


@router.get("/", response_model=list[TeaResponse])
def list_teas(type: str = None, db: Session = Depends(get_db)):
    query = db.query(Tea)
    if type:
        query = query.filter(Tea.category == type)
    return query.all()


@router.get("/{tea_id}", response_model=TeaResponse)
def get_tea(tea_id: int, db: Session = Depends(get_db)):
    tea = db.query(Tea).filter(Tea.id == tea_id).first()
    if not tea:
        raise HTTPException(status_code=404, detail="茶叶不存在")
    return tea
