"""add client_wechat_name and make customer phone nullable

Revision ID: 20260506_customer_client_wechat_name
Revises: 20260504_tuition_gift_requests
Create Date: 2026-05-06
"""

from alembic import op
import sqlalchemy as sa


revision = "20260506_customer_client_wechat_name"
down_revision = "20260504_tuition_gift_requests"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("customers", sa.Column("client_wechat_name", sa.String(length=100), nullable=True))
    op.alter_column("customers", "phone", existing_type=sa.String(length=20), nullable=True)


def downgrade() -> None:
    op.alter_column("customers", "phone", existing_type=sa.String(length=20), nullable=False)
    op.drop_column("customers", "client_wechat_name")
