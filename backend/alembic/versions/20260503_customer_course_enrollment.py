"""add customer course enrollment and gifted tuition

Revision ID: 20260503_customer_course_enrollment
Revises: 20260503_sales_customer_fields
Create Date: 2026-05-03
"""

from alembic import op
import sqlalchemy as sa


revision = "20260503_customer_course_enrollment"
down_revision = "20260503_sales_customer_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("customers", sa.Column("gifted_tuition_amount", sa.Integer(), nullable=False, server_default="0"))

    op.create_table(
        "customer_course_enrollments",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("customer_id", sa.String(length=36), sa.ForeignKey("customers.id"), nullable=False),
        sa.Column("order_id", sa.String(length=36), sa.ForeignKey("orders.id"), nullable=False),
        sa.Column("product_id", sa.String(length=36), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("amount_paid", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="purchased_not_started"),
        sa.Column("status_updated_by", sa.String(length=36), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("status_updated_role", sa.String(length=20), nullable=True),
        sa.Column("status_updated_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_customer_course_enrollments_customer_id", "customer_course_enrollments", ["customer_id"])
    op.create_index("ix_customer_course_enrollments_order_id", "customer_course_enrollments", ["order_id"])
    op.create_index("ix_customer_course_enrollments_product_id", "customer_course_enrollments", ["product_id"])
    op.create_index("ix_customer_course_enrollments_status", "customer_course_enrollments", ["status"])


def downgrade() -> None:
    op.drop_index("ix_customer_course_enrollments_status", table_name="customer_course_enrollments")
    op.drop_index("ix_customer_course_enrollments_product_id", table_name="customer_course_enrollments")
    op.drop_index("ix_customer_course_enrollments_order_id", table_name="customer_course_enrollments")
    op.drop_index("ix_customer_course_enrollments_customer_id", table_name="customer_course_enrollments")
    op.drop_table("customer_course_enrollments")
    op.drop_column("customers", "gifted_tuition_amount")
