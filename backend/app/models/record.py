"""品鉴记录域。"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, Text, ForeignKey
from app.database import Base


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class TastingRecordV2(Base):
    __tablename__ = "tasting_records_v2"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users_v2.id"), nullable=True)
    client_id = Column(String(64), nullable=True, comment="客户端记录 ID，用于幂等同步")
    tea_id = Column(Integer, ForeignKey("teas.id"), nullable=True, comment="茶叶 ID")
    tea_name = Column(String(100), nullable=False)
    brew_temp = Column(Integer, comment="实际水温")
    brew_time = Column(Integer, comment="浸泡时间")
    infusions = Column(Integer, default=1, comment="第几泡")
    water_type = Column(String(20), comment="水源")
    ware_id = Column(Integer, ForeignKey("teawares_v2.id"), nullable=True, comment="茶器")
    dimensions = Column(JSON, default=dict, comment="八维评分")
    overall_score = Column(Float, comment="综合评分")
    process_factor = Column(Float, comment="工艺系数")
    aroma_type = Column(String(50), comment="香气类型")
    notes = Column(Text, comment="品鉴笔记")
    weather = Column(String(50), comment="天气")
    mood = Column(String(50), comment="心情")
    created_at = Column(DateTime, default=_utcnow)
