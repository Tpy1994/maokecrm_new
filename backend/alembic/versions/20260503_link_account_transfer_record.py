"""add link account last transfer fields

Revision ID: 20260503_link_account_transfer_record
Revises: 20260503_consultation_count_field
Create Date: 2026-05-03
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260503_link_account_transfer_record"
down_revision = "20260503_consultation_count_field"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("link_accounts", sa.Column("last_transfer_at", sa.DateTime(), nullable=True))
    op.add_column("link_accounts", sa.Column("last_transfer_from_owner_name", sa.String(length=50), nullable=True))


def downgrade() -> None:
    op.drop_column("link_accounts", "last_transfer_from_owner_name")
    op.drop_column("link_accounts", "last_transfer_at")
