"""茶园种植表（离线同步）

Revision ID: 003
Revises: 002
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "garden_plants",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("client_id", sa.String(64), nullable=True, comment="客户端本地 ID，用于幂等同步"),
        sa.Column("region_id", sa.String(50), nullable=True, comment="产区 ID"),
        sa.Column("tea_id", sa.String(50), nullable=True, comment="茶种 ID"),
        sa.Column("planted_at", sa.DateTime(), nullable=True, comment="种植时间"),
        sa.Column("last_watered_at", sa.DateTime(), nullable=True, comment="上次浇水时间"),
        sa.Column("water_level", sa.Integer(), nullable=False, server_default=sa.text("100"), comment="土壤湿度 0-100"),
        sa.Column("pruned", sa.Boolean(), nullable=False, server_default=sa.text("false"), comment="是否定型修剪"),
        sa.Column("status", sa.String(20), nullable=False, server_default=sa.text("'growing'"), comment="状态"),
        sa.Column("harvest_count", sa.Integer(), nullable=False, server_default=sa.text("0"), comment="已采摘次数"),
        sa.Column("harvested_at", sa.DateTime(), nullable=True, comment="上次采摘时间"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users_v2.id"]),
    )
    op.create_index(
        "idx_garden_plants_client",
        "garden_plants",
        ["user_id", "client_id"],
        unique=True,
        postgresql_where=sa.text("client_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("idx_garden_plants_client", table_name="garden_plants")
    op.drop_table("garden_plants")
