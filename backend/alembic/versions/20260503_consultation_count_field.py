"""add consultation_count to consultant_customers

Revision ID: 20260503_consultation_count_field
Revises: 20260503_consultant_indexes
Create Date: 2026-05-03 23:58:00
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260503_consultation_count_field"
down_revision = "20260503_consultant_indexes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "consultant_customers",
        sa.Column("consultation_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.alter_column("consultant_customers", "consultation_count", server_default=None)


def downgrade() -> None:
    op.drop_column("consultant_customers", "consultation_count")
