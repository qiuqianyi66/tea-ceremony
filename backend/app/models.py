"""数据库模型定义 — V2.0 文化知识图谱版"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base


# ============ 1. 茶叶 ============

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
    created_at = Column(DateTime, default=datetime.utcnow)

    region = relationship("TeaRegion", back_populates="teas")
    process = relationship("TeaProcess", back_populates="teas")


# ============ 2. 茶山产区 ============

class TeaRegion(Base):
    __tablename__ = "tea_regions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, comment="产区名")
    province = Column(String(50), comment="省份")
    latitude = Column(Float, nullable=True, comment="纬度")
    longitude = Column(Float, nullable=True, comment="经度")
    altitude = Column(String(50), comment="海拔范围")
    climate = Column(String(200), comment="气候")
    soil = Column(String(200), comment="土壤")
    history = Column(Text, comment="历史")
    famous_for = Column(JSON, default=list, comment="代表茶")
    description = Column(Text, comment="简介")

    teas = relationship("Tea", back_populates="region")


# ============ 3. 制茶工艺 ============

class TeaProcess(Base):
    __tablename__ = "tea_processes"

    id = Column(Integer, primary_key=True, index=True)
    tea_category = Column(String(20), nullable=False, comment="适用茶类")
    name = Column(String(100), comment="工艺名")
    summary = Column(Text, comment="概述")
    steps = Column(JSON, default=list, comment="步骤数组")

    teas = relationship("Tea", back_populates="process")


# ============ 4. 茶人历史 ============

class TeaPerson(Base):
    __tablename__ = "tea_people"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, comment="姓名")
    dynasty = Column(String(50), comment="朝代")
    title = Column(String(100), comment="称号")
    identity = Column(String(100), comment="身份")
    description = Column(Text, comment="简介")
    contribution = Column(Text, comment="主要贡献")
    quote = Column(Text, comment="名言")
    avatar = Column(String(50), comment="图标")
    related_tea_ids = Column(JSON, default=list, comment="关联茶 ID")


# ============ 5. 茶诗词 ============

class TeaPoem(Base):
    __tablename__ = "tea_poems"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), comment="作品名")
    author = Column(String(100), comment="作者")
    dynasty = Column(String(50), comment="朝代")
    content = Column(Text, comment="内容")
    related_tea_ids = Column(JSON, default=list, comment="关联茶")
    description = Column(Text, comment="文化背景")


# ============ 6. 茶器（升级版）============

class TeaWareV2(Base):
    __tablename__ = "teawares_v2"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, comment="名称")
    ware_type = Column(String(20), comment="类型")
    material = Column(String(100), comment="材质")
    capacity = Column(Integer, comment="容量ml")
    origin = Column(String(100), comment="产地")
    dynasty = Column(String(50), comment="年代")
    craft = Column(String(200), comment="制作工艺")
    description = Column(Text, comment="描述")
    culture_story = Column(Text, comment="文化故事")
    bonus = Column(JSON, default=dict, comment="加成属性")
    recommended = Column(JSON, default=list, comment="推荐茶类")
    rarity = Column(String(20), default="common", comment="稀有度")


# ============ 7. 茶礼 ============

class TeaEtiquette(Base):
    __tablename__ = "tea_etiquettes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, comment="礼名")
    occasion = Column(String(100), comment="场合")
    description = Column(Text, comment="描述")
    steps = Column(JSON, default=list, comment="步骤")


# ============ 8. 知识图谱关系 ============

class TeaRelation(Base):
    __tablename__ = "tea_relations"

    id = Column(Integer, primary_key=True, index=True)
    source_type = Column(String(50), comment="源类型")
    source_id = Column(Integer, comment="源ID")
    target_type = Column(String(50), comment="目标类型")
    target_id = Column(Integer, comment="目标ID")
    relation = Column(String(100), comment="关系描述")


# ============ 9. 用户（升级版）============

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
    created_at = Column(DateTime, default=datetime.utcnow)


# ============ 10. 品鉴记录（升级版）============

class TastingRecordV2(Base):
    __tablename__ = "tasting_records_v2"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users_v2.id"), nullable=True)
    tea_id = Column(String(50), comment="茶叶标识")
    tea_name = Column(String(100), nullable=False)
    brew_temp = Column(Integer, comment="实际水温")
    brew_time = Column(Integer, comment="浸泡时间")
    infusions = Column(Integer, default=1, comment="第几泡")
    water_type = Column(String(20), comment="水源")
    ware_id = Column(Integer, nullable=True, comment="茶器")
    dimensions = Column(JSON, default=dict, comment="八维评分")
    overall_score = Column(Float, comment="综合评分")
    process_factor = Column(Float, comment="工艺系数")
    aroma_type = Column(String(50), comment="香气类型")
    notes = Column(Text, comment="品鉴笔记")
    weather = Column(String(50), comment="天气")
    mood = Column(String(50), comment="心情")
    created_at = Column(DateTime, default=datetime.utcnow)


# ============ 11. 水源 ============

class WaterSource(Base):
    __tablename__ = "water_sources"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, comment="名称")
    location = Column(String(100), comment="位置")
    quality = Column(String(200), comment="水质特点")
    history = Column(Text, comment="历史故事")
    suitable_teas = Column(JSON, default=list, comment="适配茶类")


# ============ 12. 茶人生 ============

class TeaJourney(Base):
    __tablename__ = "tea_journeys"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users_v2.id"), nullable=True)
    tea_count = Column(Integer, default=0)
    favorite_category = Column(String(50), comment="偏好茶类")
    favorite_aroma = Column(JSON, default=list, comment="偏好香型")
    tea_level = Column(String(50), default="初识茶客")
    experience = Column(Integer, default=0)


# ============ 13. 茶人关联表 ============

class TeaPersonRelation(Base):
    __tablename__ = "tea_person_relations"

    id = Column(Integer, primary_key=True, index=True)
    tea_id = Column(Integer, ForeignKey("teas.id"))
    person_id = Column(Integer, ForeignKey("tea_people.id"))


# ============ 14. 文化文档（AI 知识库）============

class CultureDocument(Base):
    __tablename__ = "culture_documents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), comment="标题")
    category = Column(String(50), comment="分类")
    content = Column(Text, comment="文档内容")
    source_type = Column(String(50), comment="来源类型")
    chunk_index = Column(Integer, default=0, comment="切片序号")
    embedding = Column(JSON, nullable=True, comment="向量（预留）")
    created_at = Column(DateTime, default=datetime.utcnow)


# ============ 向后兼容别名 ============
User = UserV2
TastingRecord = TastingRecordV2
TeaWare = TeaWareV2
