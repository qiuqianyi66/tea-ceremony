"""茶器数据 API"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import TeaWare

router = APIRouter()


@router.get("/")
def list_teawares(db: Session = Depends(get_db)):
    return db.query(TeaWare).all()
