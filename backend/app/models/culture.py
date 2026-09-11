"""茶文化域：茶人 / 茶诗 / 茶礼 / 知识图谱关系。"""

from sqlalchemy import Column, Integer, String, Text, JSON, ForeignKey
from app.database import Base


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


class TeaPoem(Base):
    __tablename__ = "tea_poems"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), comment="作品名")
    author = Column(String(100), comment="作者")
    dynasty = Column(String(50), comment="朝代")
    content = Column(Text, comment="内容")
    related_tea_ids = Column(JSON, default=list, comment="关联茶")
    description = Column(Text, comment="文化背景")


class TeaEtiquette(Base):
    __tablename__ = "tea_etiquettes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, comment="礼名")
    occasion = Column(String(100), comment="场合")
    description = Column(Text, comment="描述")
    steps = Column(JSON, default=list, comment="步骤")


class TeaRelation(Base):
    __tablename__ = "tea_relations"

    id = Column(Integer, primary_key=True, index=True)
    source_type = Column(String(50), comment="源类型")
    source_id = Column(Integer, comment="源ID")
    target_type = Column(String(50), comment="目标类型")
    target_id = Column(Integer, comment="目标ID")
    relation = Column(String(100), comment="关系描述")


class TeaPersonRelation(Base):
    __tablename__ = "tea_person_relations"

    id = Column(Integer, primary_key=True, index=True)
    tea_id = Column(Integer, ForeignKey("teas.id"))
    person_id = Column(Integer, ForeignKey("tea_people.id"))
