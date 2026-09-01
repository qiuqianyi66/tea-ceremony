"""为品鉴记录增加客户端幂等 ID

Revision ID: 002
Revises: 001
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tasting_records_v2",
        sa.Column("client_id", sa.String(64), nullable=True),
    )
    op.create_index(
        "idx_tasting_records_client",
        "tasting_records_v2",
        ["user_id", "client_id"],
        unique=True,
        postgresql_where=sa.text("client_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("idx_tasting_records_client", table_name="tasting_records_v2")
    op.drop_column("tasting_records_v2", "client_id")
