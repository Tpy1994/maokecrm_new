"""add audit logs and consultation composite indexes

Revision ID: 20260504_audit_logs
Revises: 20260503_consultation_count_field
Create Date: 2026-05-04 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260504_audit_logs"
down_revision = "20260503_consultation_count_field"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("resource_type", sa.String(length=40), nullable=False),
        sa.Column("resource_id", sa.String(length=36), nullable=False),
        sa.Column("customer_id", sa.String(length=36), nullable=True),
        sa.Column("action", sa.String(length=60), nullable=False),
        sa.Column("changes", sa.Text(), nullable=True),
        sa.Column("amount_delta", sa.Integer(), nullable=True),
        sa.Column("operator_user_id", sa.String(length=36), nullable=True),
        sa.Column("operator_role", sa.String(length=20), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("related_event_id", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"]),
        sa.ForeignKeyConstraint(["operator_user_id"], ["users.id"]),
    )
    op.create_index("ix_audit_logs_resource_type", "audit_logs", ["resource_type"], unique=False)
    op.create_index("ix_audit_logs_resource_id", "audit_logs", ["resource_id"], unique=False)
    op.create_index("ix_audit_logs_customer_id", "audit_logs", ["customer_id"], unique=False)
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"], unique=False)
    op.create_index("ix_audit_logs_operator_user_id", "audit_logs", ["operator_user_id"], unique=False)
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"], unique=False)

    op.execute("DROP INDEX IF EXISTS ix_consultation_logs_customer_id")
    op.execute("DROP INDEX IF EXISTS ix_consultation_logs_consultant_id")
    op.execute("DROP INDEX IF EXISTS ix_consultation_logs_log_date")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_consultation_logs_customer_date "
        "ON consultation_logs (customer_id, log_date, created_at)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_consultation_logs_consultant_date "
        "ON consultation_logs (consultant_id, log_date)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_consultation_logs_consultant_date")
    op.execute("DROP INDEX IF EXISTS ix_consultation_logs_customer_date")
    op.execute("CREATE INDEX IF NOT EXISTS ix_consultation_logs_log_date ON consultation_logs (log_date)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_consultation_logs_consultant_id ON consultation_logs (consultant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_consultation_logs_customer_id ON consultation_logs (customer_id)")

    op.drop_index("ix_audit_logs_created_at", table_name="audit_logs")
    op.drop_index("ix_audit_logs_operator_user_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_action", table_name="audit_logs")
    op.drop_index("ix_audit_logs_customer_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_resource_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_resource_type", table_name="audit_logs")
    op.drop_table("audit_logs")
