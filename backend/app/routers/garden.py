"""茶园种植 API：离线优先，client_id 幂等同步"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User, GardenPlant
from app.schemas import GardenPlantCreate, GardenPlantResponse

router = APIRouter()


@router.post("/", response_model=GardenPlantResponse)
def upsert_plant(data: GardenPlantCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """按 user_id + client_id 幂等 upsert：已存在则更新状态，否则新建。"""
    existing = db.query(GardenPlant).filter(
        GardenPlant.user_id == user.id,
        GardenPlant.client_id == data.client_id,
    ).first()
    if existing:
        for field, value in data.model_dump().items():
            setattr(existing, field, value)
        db.commit()
        db.refresh(existing)
        return existing
    plant = GardenPlant(**data.model_dump(), user_id=user.id)
    db.add(plant)
    db.commit()
    db.refresh(plant)
    return plant


@router.get("/", response_model=list[GardenPlantResponse])
def list_plants(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(GardenPlant).filter(GardenPlant.user_id == user.id).order_by(GardenPlant.created_at.desc()).all()
