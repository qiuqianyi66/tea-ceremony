"""用户域：用户 / 茶人生旅程。"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey
from app.database import Base


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class UserV2(Base):
    __tablename__ = "users_v2"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False)
    display_name = Column(String(100))
    hashed_password = Column(String(200))
    level = Column(Integer, default=1, comment="茶修等级")
    xp = Column(Integer, default=0)
    preferred_type = Column(String(20), comment="偏好茶类")
    preferred_temp = Column(Integer, comment="偏好水温")
    preferred_aroma = Column(JSON, default=list, comment="偏好香型")
    preferred_ware_id = Column(Integer, nullable=True, comment="常用茶器")
    created_at = Column(DateTime, default=_utcnow)


class TeaJourney(Base):
    __tablename__ = "tea_journeys"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users_v2.id"), nullable=True)
    tea_count = Column(Integer, default=0)
    favorite_category = Column(String(50), comment="偏好茶类")
    favorite_aroma = Column(JSON, default=list, comment="偏好香型")
    tea_level = Column(String(50), default="初识茶客")
    experience = Column(Integer, default=0)
