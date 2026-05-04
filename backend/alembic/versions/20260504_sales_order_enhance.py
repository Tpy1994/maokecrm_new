"""enhance orders for sales course lifecycle

Revision ID: 20260504_sales_order_enhance
Revises: 20260504_audit_logs
Create Date: 2026-05-04 11:30:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260504_sales_order_enhance"
down_revision = "20260504_audit_logs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("list_price", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("orders", sa.Column("deal_price", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("orders", sa.Column("refund_total", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("orders", sa.Column("status", sa.String(length=30), nullable=False, server_default="active"))
    op.add_column("orders", sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")))
    op.add_column("customer_course_enrollments", sa.Column("refunded_at", sa.DateTime(), nullable=True))

    op.execute("UPDATE orders SET list_price = amount, deal_price = amount WHERE list_price = 0 AND deal_price = 0")

    op.alter_column("orders", "list_price", server_default=None)
    op.alter_column("orders", "deal_price", server_default=None)
    op.alter_column("orders", "refund_total", server_default=None)
    op.alter_column("orders", "status", server_default=None)
    op.alter_column("orders", "updated_at", server_default=None)


def downgrade() -> None:
    op.drop_column("customer_course_enrollments", "refunded_at")
    op.drop_column("orders", "updated_at")
    op.drop_column("orders", "status")
    op.drop_column("orders", "refund_total")
    op.drop_column("orders", "deal_price")
    op.drop_column("orders", "list_price")
