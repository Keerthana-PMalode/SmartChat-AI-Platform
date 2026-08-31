from alembic import op


revision = "b48f2c4ab1ae"
down_revision = "1e6a6b0b17d3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "files",
        "encryption_key",
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "files",
        "encryption_key",
        nullable=False,
    )
