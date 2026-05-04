"""add tuition gift requests

Revision ID: 20260504_tuition_gift_requests
Revises: 20260504_sales_order_enhance
Create Date: 2026-05-04 12:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260504_tuition_gift_requests"
down_revision = "20260504_sales_order_enhance"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tuition_gift_requests",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("customer_id", sa.String(length=36), sa.ForeignKey("customers.id"), nullable=False),
        sa.Column("sales_user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sales_note", sa.Text(), nullable=True),
        sa.Column("admin_note", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("reviewed_by_user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_tuition_gift_requests_customer_id", "tuition_gift_requests", ["customer_id"])
    op.create_index("ix_tuition_gift_requests_sales_user_id", "tuition_gift_requests", ["sales_user_id"])
    op.create_index("ix_tuition_gift_requests_status", "tuition_gift_requests", ["status"])
    op.create_index("ix_tuition_gift_requests_reviewed_by_user_id", "tuition_gift_requests", ["reviewed_by_user_id"])
    op.create_index("ix_tuition_gift_requests_created_at", "tuition_gift_requests", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_tuition_gift_requests_created_at", table_name="tuition_gift_requests")
    op.drop_index("ix_tuition_gift_requests_reviewed_by_user_id", table_name="tuition_gift_requests")
    op.drop_index("ix_tuition_gift_requests_status", table_name="tuition_gift_requests")
    op.drop_index("ix_tuition_gift_requests_sales_user_id", table_name="tuition_gift_requests")
    op.drop_index("ix_tuition_gift_requests_customer_id", table_name="tuition_gift_requests")
    op.drop_table("tuition_gift_requests")
