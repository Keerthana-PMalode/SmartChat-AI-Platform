"""enforce file access audit invariants

Revision ID: <GENERATED_REVISION_ID>
Revises: <PHASE_2_REVISION_ID>
"""

from typing import Sequence, Union

from alembic import op


revision: str = "7048022bff12"
down_revision: Union[str, Sequence[str], None] = "3bdfd3ff740c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_check_constraint(
        "ck_file_access_logs_access_context",
        "file_access_logs",
        """
        (
            access_method = 'AUTHENTICATED'
            AND user_id IS NOT NULL
            AND share_link_id IS NULL
        )
        OR
        (
            access_method = 'SHARE_LINK'
            AND user_id IS NULL
            AND share_link_id IS NOT NULL
        )
        """,
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_file_access_logs_access_context",
        "file_access_logs",
        type_="check",
    )
