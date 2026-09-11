"""茶叶核心域：茶叶 / 产区 / 工艺。"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Tea(Base):
    __tablename__ = "teas"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, comment="茶名")
    category = Column(String(20), nullable=False, comment="茶类")
    origin = Column(String(200), comment="产地")
    region_id = Column(Integer, ForeignKey("tea_regions.id"), nullable=True, comment="关联产区")
    process_id = Column(Integer, ForeignKey("tea_processes.id"), nullable=True, comment="关联工艺")
    season = Column(String(50), comment="采摘季节")
    grade = Column(String(50), comment="等级")
    altitude = Column(String(50), comment="海拔")
    best_temp = Column(Integer, comment="最佳水温")
    best_time = Column(Integer, comment="最佳时间")
    infusions = Column(Integer, default=3, comment="可冲泡次数")
    flavor = Column(JSON, default=list, comment="风味标签")
    story = Column(Text, comment="文化故事")
    description = Column(Text, comment="简介")
    historical_period = Column(String(100), comment="历史时期")
    water_requirement = Column(String(100), comment="水质要求")
    soup_color_min = Column(String(20), comment="浅汤色")
    soup_color_max = Column(String(20), comment="深汤色")
    dry_tea_color = Column(String(20), comment="干茶色")
    created_at = Column(DateTime, default=_utcnow)

    region = relationship("TeaRegion", back_populates="teas")
    process = relationship("TeaProcess", back_populates="teas")


class TeaRegion(Base):
    __tablename__ = "tea_regions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, comment="产区名")
    province = Column(String(50), comment="省份")
    city = Column(String(50), comment="城市")
    latitude = Column(Float, nullable=True, comment="纬度")
    longitude = Column(Float, nullable=True, comment="经度")
    altitude = Column(String(50), comment="海拔范围")
    climate = Column(String(200), comment="气候")
    soil = Column(String(200), comment="土壤")
    history = Column(Text, comment="历史")
    famous_for = Column(JSON, default=list, comment="代表茶")
    description = Column(Text, comment="简介")

    teas = relationship("Tea", back_populates="region")


class TeaProcess(Base):
    __tablename__ = "tea_processes"

    id = Column(Integer, primary_key=True, index=True)
    tea_category = Column(String(20), nullable=False, comment="适用茶类")
    name = Column(String(100), comment="工艺名")
    summary = Column(Text, comment="概述")
    steps = Column(JSON, default=list, comment="步骤数组")

    teas = relationship("Tea", back_populates="process")
