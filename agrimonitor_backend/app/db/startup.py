from pathlib import Path

from alembic import command
from alembic.config import Config

from app.db.seed import run_seed


def prepare_database() -> None:
    project_root = Path(__file__).resolve().parents[2]
    alembic_config = Config(str(project_root / "alembic.ini"))
    alembic_config.set_main_option("script_location", str(project_root / "alembic"))

    command.upgrade(alembic_config, "head")
    run_seed()
