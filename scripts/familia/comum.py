"""Caminhos e utilidades compartilhadas pelos scripts do Assistente da Família."""

import json
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

RAIZ = Path(__file__).resolve().parents[2]
PASTA = RAIZ / "docs" / "familia"
HISTORICO = PASTA / "historico"
CONFIG = json.loads((PASTA / "config.json").read_text(encoding="utf-8"))
FUSO = ZoneInfo(CONFIG["fuso"])


def agora() -> datetime:
    return datetime.now(FUSO)


def hoje() -> date:
    return agora().date()


def ler_json(caminho: Path):
    return json.loads(caminho.read_text(encoding="utf-8"))


def gravar_json(caminho: Path, dados) -> None:
    caminho.parent.mkdir(parents=True, exist_ok=True)
    caminho.write_text(json.dumps(dados, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
