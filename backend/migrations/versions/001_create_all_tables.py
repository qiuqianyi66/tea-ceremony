"""创建一盏茶文化数据库（初始迁移）

Revision ID: 001
Revises:
Create Date: 2026-07-27
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ============ 1. 茶山产区 ============
    op.create_table(
        "tea_regions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("province", sa.String(50)),
        sa.Column("city", sa.String(50)),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("altitude", sa.String(50)),
        sa.Column("climate", sa.Text()),
        sa.Column("soil", sa.Text()),
        sa.Column("history", sa.Text()),
        sa.Column("famous_for", JSONB(), default=list),
        sa.Column("description", sa.Text()),
    )

    # ============ 2. 制茶工艺 ============
    op.create_table(
        "tea_processes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tea_category", sa.String(20), nullable=False),
        sa.Column("name", sa.String(100)),
        sa.Column("summary", sa.Text()),
        sa.Column("steps", JSONB(), default=list),
    )

    # ============ 3. 茶叶主表 ============
    op.create_table(
        "teas",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("category", sa.String(20), nullable=False),
        sa.Column("origin", sa.String(200)),
        sa.Column("region_id", sa.Integer(), sa.ForeignKey("tea_regions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("process_id", sa.Integer(), sa.ForeignKey("tea_processes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("season", sa.String(50)),
        sa.Column("grade", sa.String(50)),
        sa.Column("altitude", sa.String(50)),
        sa.Column("best_temp", sa.Integer()),
        sa.Column("best_time", sa.Integer()),
        sa.Column("infusions", sa.Integer(), default=3),
        sa.Column("flavor", JSONB(), default=list),
        sa.Column("story", sa.Text()),
        sa.Column("description", sa.Text()),
        sa.Column("historical_period", sa.String(100)),
        sa.Column("water_requirement", sa.String(100)),
        sa.Column("soup_color_min", sa.String(20)),
        sa.Column("soup_color_max", sa.String(20)),
        sa.Column("dry_tea_color", sa.String(20)),
        sa.Column("created_at", sa.DateTime(), default=sa.func.now()),
    )

    # ============ 4. 茶人 ============
    op.create_table(
        "tea_people",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("dynasty", sa.String(50)),
        sa.Column("title", sa.String(100)),
        sa.Column("identity", sa.String(100)),
        sa.Column("description", sa.Text()),
        sa.Column("contribution", sa.Text()),
        sa.Column("quote", sa.Text()),
        sa.Column("avatar", sa.String(200)),
        sa.Column("related_tea_ids", JSONB(), default=list),
    )

    # ============ 5. 茶诗 ============
    op.create_table(
        "tea_poems",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(200)),
        sa.Column("author", sa.String(100)),
        sa.Column("dynasty", sa.String(50)),
        sa.Column("content", sa.Text()),
        sa.Column("related_tea_ids", JSONB(), default=list),
        sa.Column("description", sa.Text()),
    )

    # ============ 6. 茶器 ============
    op.create_table(
        "teawares_v2",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("ware_type", sa.String(20)),
        sa.Column("material", sa.String(100)),
        sa.Column("capacity", sa.Integer()),
        sa.Column("origin", sa.String(100)),
        sa.Column("dynasty", sa.String(50)),
        sa.Column("craft", sa.String(200)),
        sa.Column("description", sa.Text()),
        sa.Column("culture_story", sa.Text()),
        sa.Column("bonus", JSONB(), default=dict),
        sa.Column("recommended", JSONB(), default=list),
        sa.Column("rarity", sa.String(20), default="common"),
    )

    # ============ 7. 茶礼 ============
    op.create_table(
        "tea_etiquettes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("occasion", sa.String(100)),
        sa.Column("description", sa.Text()),
        sa.Column("steps", JSONB(), default=list),
    )

    # ============ 8. 知识图谱关系 ============
    op.create_table(
        "tea_relations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_type", sa.String(50)),
        sa.Column("source_id", sa.Integer()),
        sa.Column("target_type", sa.String(50)),
        sa.Column("target_id", sa.Integer()),
        sa.Column("relation", sa.String(100)),
    )

    # ============ 9. 用户 ============
    op.create_table(
        "users_v2",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(50), unique=True, nullable=False),
        sa.Column("display_name", sa.String(100)),
        sa.Column("hashed_password", sa.String(200), nullable=False),
        sa.Column("level", sa.Integer(), default=1),
        sa.Column("xp", sa.Integer(), default=0),
        sa.Column("preferred_type", sa.String(20)),
        sa.Column("preferred_temp", sa.Integer()),
        sa.Column("preferred_aroma", JSONB(), default=list),
        sa.Column("preferred_ware_id", sa.Integer(), sa.ForeignKey("teawares_v2.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), default=sa.func.now()),
    )

    # ============ 10. 品鉴记录 ============
    op.create_table(
        "tasting_records_v2",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users_v2.id")),
        sa.Column("tea_id", sa.Integer(), sa.ForeignKey("teas.id")),
        sa.Column("tea_name", sa.String(100), nullable=False),
        sa.Column("brew_temp", sa.Integer()),
        sa.Column("brew_time", sa.Integer()),
        sa.Column("infusions", sa.Integer(), default=1),
        sa.Column("water_type", sa.String(20)),
        sa.Column("ware_id", sa.Integer(), sa.ForeignKey("teawares_v2.id")),
        sa.Column("dimensions", JSONB(), default=dict),
        sa.Column("overall_score", sa.Float()),
        sa.Column("process_factor", sa.Float()),
        sa.Column("aroma_type", sa.String(50)),
        sa.Column("notes", sa.Text()),
        sa.Column("weather", sa.String(50)),
        sa.Column("mood", sa.String(50)),
        sa.Column("created_at", sa.DateTime(), default=sa.func.now()),
    )

    # ============ 11. 水源 ============
    op.create_table(
        "water_sources",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("location", sa.String(100)),
        sa.Column("quality", sa.String(200)),
        sa.Column("history", sa.Text()),
        sa.Column("suitable_teas", JSONB(), default=list),
    )

    # ============ 12. 茶人生 ============
    op.create_table(
        "tea_journeys",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users_v2.id")),
        sa.Column("tea_count", sa.Integer(), default=0),
        sa.Column("favorite_category", sa.String(50)),
        sa.Column("favorite_aroma", JSONB(), default=list),
        sa.Column("tea_level", sa.String(50), default="初识茶客"),
        sa.Column("experience", sa.Integer(), default=0),
    )

    # ============ 13. 茶人关联 ============
    op.create_table(
        "tea_person_relations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tea_id", sa.Integer(), sa.ForeignKey("teas.id")),
        sa.Column("person_id", sa.Integer(), sa.ForeignKey("tea_people.id")),
    )

    # ============ 14. 文化文档（AI 知识库）============
    op.create_table(
        "culture_documents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(200)),
        sa.Column("category", sa.String(50)),
        sa.Column("content", sa.Text()),
        sa.Column("source_type", sa.String(50)),
        sa.Column("chunk_index", sa.Integer(), default=0),
        sa.Column("embedding", JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(), default=sa.func.now()),
    )

    # ============ 索引 ============
    op.create_index("idx_teas_name", "teas", ["name"])
    op.create_index("idx_teas_category", "teas", ["category"])
    op.create_index("idx_teas_region", "teas", ["region_id"])
    op.create_index("idx_teas_process", "teas", ["process_id"])
    op.create_index("idx_tea_people_dynasty", "tea_people", ["dynasty"])
    op.create_index("idx_tea_poems_author", "tea_poems", ["author"])
    op.create_index("idx_tasting_records_user", "tasting_records_v2", ["user_id"])
    op.create_index("idx_culture_documents_category", "culture_documents", ["category"])


def downgrade() -> None:
    op.drop_table("culture_documents")
    op.drop_table("tea_person_relations")
    op.drop_table("tea_journeys")
    op.drop_table("water_sources")
    op.drop_table("tasting_records_v2")
    op.drop_table("users_v2")
    op.drop_table("tea_relations")
    op.drop_table("tea_etiquettes")
    op.drop_table("teawares_v2")
    op.drop_table("tea_poems")
    op.drop_table("tea_people")
    op.drop_table("teas")
    op.drop_table("tea_processes")
    op.drop_table("tea_regions")
