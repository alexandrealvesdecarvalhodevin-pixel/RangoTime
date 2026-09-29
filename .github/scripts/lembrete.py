"""Envia o lembrete diário do planejamento semanal por e-mail (SMTP)."""

import json
import os
import smtplib
import ssl
import sys
from datetime import datetime
from email.message import EmailMessage
from html import escape
from pathlib import Path
from zoneinfo import ZoneInfo

DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]
DATA = json.loads((Path(__file__).resolve().parents[2] / "docs" / "data.json").read_text(encoding="utf-8"))


def dia_da_semana() -> int:
    forcado = os.environ.get("DIA", "").strip()
    if forcado:
        return int(forcado) % 7
    # isoweekday: segunda=1 ... domingo=7 -> domingo=0
    return datetime.now(ZoneInfo("America/Sao_Paulo")).isoweekday() % 7


def montar(dia: int, site: str) -> tuple[str, str, str] | None:
    amanha = (dia + 1) % 7
    compra = next((c for c in DATA["compras"] if c["id"] != "despensa" and c["dia"] == dia), None)
    ref_amanha = next((r for r in DATA["refeicoes"] if r["dia"] == amanha), None)
    if not compra and not ref_amanha:
        return None

    texto: list[str] = []
    html: list[str] = []
    assunto: list[str] = []

    if compra:
        assunto.append(compra["titulo"])
        listas = [compra] + ([c for c in DATA["compras"] if c["id"] == "despensa"] if compra["id"] == "compra1" else [])
        for lista in listas:
            texto.append(f"{lista['icone']} {lista['titulo']} ({lista['quando']})")
            texto += [f"  - {i}" for i in lista["itens"]]
            texto.append("")
            itens = "".join(f"<li>{escape(i)}</li>" for i in lista["itens"])
            html.append(f"<h2 style='color:#8257e5'>{lista['icone']} {escape(lista['titulo'])} <small style='color:#7c7c8a'>({escape(lista['quando'])})</small></h2><ul>{itens}</ul>")

    if ref_amanha:
        assunto.append(f"descongelar {ref_amanha['descongelar']}")
        linha = f"Amanhã ({DIAS[amanha]}): Refeição {ref_amanha['numero']} — {ref_amanha['resumo']}"
        acao = f"Passe o(a) {ref_amanha['descongelar']} do freezer para a geladeira hoje."
        texto += [f"❄️ {acao}", linha, ""]
        html.append(
            f"<h2 style='color:#8257e5'>❄️ Descongelar hoje</h2><p><strong>{escape(acao)}</strong></p>"
            f"<p>{escape(linha)}</p><p><a href='{site}#preparo/{ref_amanha['numero']}'>Ver passo a passo</a></p>"
        )

    texto.append(f"Página: {site}")
    corpo_html = (
        "<div style='font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#202024'>"
        f"<h1 style='background:#8257e5;color:#fff;padding:16px;border-radius:8px'>🍽️ RangoTime · {DIAS[dia]}</h1>"
        + "".join(html)
        + f"<p style='margin-top:24px'><a href='{site}' style='background:#8257e5;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none'>Abrir planejamento</a></p></div>"
    )
    return f"🍽️ {DIAS[dia]}: " + " + ".join(assunto), "\n".join(texto), corpo_html


def main() -> None:
    dia = dia_da_semana()
    site = os.environ.get("SITE_URL", "")
    conteudo = montar(dia, site)
    if conteudo is None:
        print(f"{DIAS[dia]}: nada para lembrar hoje.")
        return
    assunto, texto, corpo_html = conteudo

    usuario = os.environ.get("EMAIL_USUARIO")
    senha = os.environ.get("EMAIL_SENHA")
    destino = os.environ.get("EMAIL_DESTINO") or usuario
    if not usuario or not senha:
        print("::warning::Secrets EMAIL_USUARIO/EMAIL_SENHA não configurados; e-mail não enviado.")
        print(assunto, texto, sep="\n\n")
        return

    msg = EmailMessage()
    msg["Subject"] = assunto
    msg["From"] = usuario
    msg["To"] = destino
    msg.set_content(texto)
    msg.add_alternative(corpo_html, subtype="html")

    host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
    port = int(os.environ.get("SMTP_PORT", "465"))
    contexto = ssl.create_default_context()
    if port == 465:
        with smtplib.SMTP_SSL(host, port, context=contexto) as smtp:
            smtp.login(usuario, senha)
            smtp.send_message(msg)
    else:
        with smtplib.SMTP(host, port) as smtp:
            smtp.starttls(context=contexto)
            smtp.login(usuario, senha)
            smtp.send_message(msg)
    print(f"Lembrete enviado para {destino}: {assunto}")


if __name__ == "__main__":
    try:
        main()
    except smtplib.SMTPException as erro:
        print(f"::error::Falha ao enviar e-mail: {erro}")
        sys.exit(1)
