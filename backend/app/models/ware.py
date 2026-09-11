"""茶器域。"""

from sqlalchemy import Column, Integer, String, Text, JSON
from app.database import Base


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
