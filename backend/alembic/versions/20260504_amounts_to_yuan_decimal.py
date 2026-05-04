"""migrate money fields from cents int to yuan numeric(12,2)

Revision ID: 20260504_amounts_to_yuan_decimal
Revises: 20260504_sales_order_enhance
Create Date: 2026-05-04
"""

from alembic import op


revision = "20260504_amounts_to_yuan_decimal"
down_revision = "20260504_sales_order_enhance"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE orders ALTER COLUMN amount TYPE NUMERIC(12,2) USING (amount::numeric / 100)")
    op.execute("ALTER TABLE orders ALTER COLUMN list_price TYPE NUMERIC(12,2) USING (list_price::numeric / 100)")
    op.execute("ALTER TABLE orders ALTER COLUMN deal_price TYPE NUMERIC(12,2) USING (deal_price::numeric / 100)")
    op.execute("ALTER TABLE orders ALTER COLUMN refund_total TYPE NUMERIC(12,2) USING (refund_total::numeric / 100)")

    op.execute("ALTER TABLE customer_course_enrollments ALTER COLUMN amount_paid TYPE NUMERIC(12,2) USING (amount_paid::numeric / 100)")
    op.execute("ALTER TABLE customers ALTER COLUMN gifted_tuition_amount TYPE NUMERIC(12,2) USING (gifted_tuition_amount::numeric / 100)")
    op.execute("ALTER TABLE products ALTER COLUMN price TYPE NUMERIC(12,2) USING (price::numeric / 100)")
    op.execute("ALTER TABLE tuition_gift_requests ALTER COLUMN amount TYPE NUMERIC(12,2) USING (amount::numeric / 100)")
    op.execute("ALTER TABLE audit_logs ALTER COLUMN amount_delta TYPE NUMERIC(12,2) USING (amount_delta::numeric / 100)")

    op.execute("ALTER TABLE orders ALTER COLUMN amount SET DEFAULT 0")
    op.execute("ALTER TABLE orders ALTER COLUMN list_price SET DEFAULT 0")
    op.execute("ALTER TABLE orders ALTER COLUMN deal_price SET DEFAULT 0")
    op.execute("ALTER TABLE orders ALTER COLUMN refund_total SET DEFAULT 0")
    op.execute("ALTER TABLE customer_course_enrollments ALTER COLUMN amount_paid SET DEFAULT 0")
    op.execute("ALTER TABLE customers ALTER COLUMN gifted_tuition_amount SET DEFAULT 0")
    op.execute("ALTER TABLE products ALTER COLUMN price SET DEFAULT 0")
    op.execute("ALTER TABLE tuition_gift_requests ALTER COLUMN amount SET DEFAULT 0")


def downgrade():
    op.execute("ALTER TABLE orders ALTER COLUMN amount TYPE INTEGER USING round(amount * 100)")
    op.execute("ALTER TABLE orders ALTER COLUMN list_price TYPE INTEGER USING round(list_price * 100)")
    op.execute("ALTER TABLE orders ALTER COLUMN deal_price TYPE INTEGER USING round(deal_price * 100)")
    op.execute("ALTER TABLE orders ALTER COLUMN refund_total TYPE INTEGER USING round(refund_total * 100)")

    op.execute("ALTER TABLE customer_course_enrollments ALTER COLUMN amount_paid TYPE INTEGER USING round(amount_paid * 100)")
    op.execute("ALTER TABLE customers ALTER COLUMN gifted_tuition_amount TYPE INTEGER USING round(gifted_tuition_amount * 100)")
    op.execute("ALTER TABLE products ALTER COLUMN price TYPE INTEGER USING round(price * 100)")
    op.execute("ALTER TABLE tuition_gift_requests ALTER COLUMN amount TYPE INTEGER USING round(amount * 100)")
    op.execute("ALTER TABLE audit_logs ALTER COLUMN amount_delta TYPE INTEGER USING round(amount_delta * 100)")
