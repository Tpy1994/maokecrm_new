"""consultant indexes and constraints

Revision ID: 20260503_consultant_indexes
Revises: 
Create Date: 2026-05-03 23:30:00
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260503_consultant_indexes"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("ix_consultant_customers_consultant_id", "consultant_customers", ["consultant_id"], unique=False)
    op.create_index("ix_consultant_customers_customer_id", "consultant_customers", ["customer_id"], unique=False)
    op.create_index("ix_consultant_customers_status", "consultant_customers", ["status"], unique=False)
    op.create_index("ix_consultant_customers_next_consultation", "consultant_customers", ["next_consultation"], unique=False)

    op.create_index("ix_consultation_logs_customer_id", "consultation_logs", ["customer_id"], unique=False)
    op.create_index("ix_consultation_logs_consultant_id", "consultation_logs", ["consultant_id"], unique=False)
    op.create_index("ix_consultation_logs_log_date", "consultation_logs", ["log_date"], unique=False)

    op.create_index(
        "uq_consultant_customer_active",
        "consultant_customers",
        ["consultant_id", "customer_id", "status"],
        unique=True,
        postgresql_where=sa.text("status = 'active' AND consultant_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_consultant_customer_active", table_name="consultant_customers")

    op.drop_index("ix_consultation_logs_log_date", table_name="consultation_logs")
    op.drop_index("ix_consultation_logs_consultant_id", table_name="consultation_logs")
    op.drop_index("ix_consultation_logs_customer_id", table_name="consultation_logs")

    op.drop_index("ix_consultant_customers_next_consultation", table_name="consultant_customers")
    op.drop_index("ix_consultant_customers_status", table_name="consultant_customers")
    op.drop_index("ix_consultant_customers_customer_id", table_name="consultant_customers")
    op.drop_index("ix_consultant_customers_consultant_id", table_name="consultant_customers")
