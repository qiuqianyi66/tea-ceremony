"""AI 知识库：文化文档切片。"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, JSON
from app.database import Base


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class CultureDocument(Base):
    __tablename__ = "culture_documents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), comment="标题")
    category = Column(String(50), comment="分类")
    content = Column(Text, comment="文档内容")
    source_type = Column(String(50), comment="来源类型")
    chunk_index = Column(Integer, default=0, comment="切片序号")
    embedding = Column(JSON, nullable=True, comment="向量（预留）")
    created_at = Column(DateTime, default=_utcnow)
