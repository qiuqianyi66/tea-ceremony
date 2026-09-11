"""茶园域：种植记录 / 水源。"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, JSON, Boolean, Text, ForeignKey
from app.database import Base


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class GardenPlant(Base):
    __tablename__ = "garden_plants"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users_v2.id"), nullable=True)
    client_id = Column(String(64), comment="客户端本地 ID，用于幂等同步")
    region_id = Column(String(50), comment="产区 ID")
    tea_id = Column(String(50), comment="茶种 ID")
    planted_at = Column(DateTime, comment="种植时间")
    last_watered_at = Column(DateTime, comment="上次浇水时间")
    water_level = Column(Integer, default=100, comment="土壤湿度 0-100")
    pruned = Column(Boolean, default=False, comment="是否定型修剪")
    status = Column(String(20), default="growing", comment="状态: growing/harvested/dead")
    harvest_count = Column(Integer, default=0, comment="已采摘次数")
    harvested_at = Column(DateTime, nullable=True, comment="上次采摘时间")
    created_at = Column(DateTime, default=_utcnow)


class WaterSource(Base):
    __tablename__ = "water_sources"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, comment="名称")
    location = Column(String(100), comment="位置")
    quality = Column(String(200), comment="水质特点")
    history = Column(Text, comment="历史故事")
    suitable_teas = Column(JSON, default=list, comment="适配茶类")
