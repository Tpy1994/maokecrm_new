"""add sales note and follow-up fields to customers

Revision ID: 20260503_sales_customer_fields
Revises: 20260503_link_account_transfer_record
Create Date: 2026-05-03
"""

from alembic import op
import sqlalchemy as sa


revision = "20260503_sales_customer_fields"
down_revision = "20260503_link_account_transfer_record"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("customers", sa.Column("sales_note", sa.String(), nullable=True))
    op.add_column("customers", sa.Column("next_follow_up", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("customers", "next_follow_up")
    op.drop_column("customers", "sales_note")
