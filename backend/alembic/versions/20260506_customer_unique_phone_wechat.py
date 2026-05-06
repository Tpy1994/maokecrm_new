"""enforce unique customer phone and client wechat

Revision ID: 20260506_customer_unique_phone_wechat
Revises: 20260506_customer_client_wechat_name
Create Date: 2026-05-06
"""

from alembic import op


revision = "20260506_customer_unique_phone_wechat"
down_revision = "20260506_customer_client_wechat_name"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_client_wechat_name_norm
        ON customers (lower(trim(client_wechat_name)))
        WHERE client_wechat_name IS NOT NULL AND trim(client_wechat_name) <> ''
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_phone_norm
        ON customers (
            regexp_replace(
                regexp_replace(
                    regexp_replace(coalesce(phone, ''), '[\\s\\-()]+', '', 'g'),
                    '^\\+86',
                    '',
                    'g'
                ),
                '^86',
                '',
                'g'
            )
        )
        WHERE phone IS NOT NULL AND trim(phone) <> ''
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_customers_phone_norm")
    op.execute("DROP INDEX IF EXISTS uq_customers_client_wechat_name_norm")
