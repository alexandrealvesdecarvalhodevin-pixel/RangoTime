"""Envia o resumo diário do Assistente da Família pelos canais configurados.

Canais (variável NOTIFICAR_CANAIS, separados por vírgula; padrão "email"):
  email     — SMTP (EMAIL_USUARIO, EMAIL_SENHA, EMAIL_DESTINO, SMTP_HOST, SMTP_PORT)
  whatsapp  — reservado para o futuro (WHATSAPP_*); hoje apenas registra que não está configurado

Para adicionar um canal, crie uma função enviar_<canal>(assunto, texto) e registre em CANAIS.
"""

import os
import smtplib
import ssl
import sys
from email.message import EmailMessage

from comum import PASTA, hoje, ler_json


def enviar_email(assunto: str, texto: str) -> bool:
    usuario, senha = os.environ.get("EMAIL_USUARIO"), os.environ.get("EMAIL_SENHA")
    if not usuario or not senha:
        print("email: EMAIL_USUARIO/EMAIL_SENHA não configurados, pulando.")
        return False
    msg = EmailMessage()
    msg["Subject"], msg["From"], msg["To"] = assunto, usuario, os.environ.get("EMAIL_DESTINO") or usuario
    msg.set_content(texto)
    host, port = os.environ.get("SMTP_HOST", "smtp.gmail.com"), int(os.environ.get("SMTP_PORT", "465"))
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
    print("email: enviado.")
    return True


def enviar_whatsapp(assunto: str, texto: str) -> bool:
    # Ponto de extensão: implementar com Meta WhatsApp Cloud API, Twilio ou CallMeBot
    # usando secrets WHATSAPP_TOKEN / WHATSAPP_DESTINO. O texto já está no formato de mensagem.
    print("whatsapp: ainda não implementado, pulando.")
    return False


CANAIS = {"email": enviar_email, "whatsapp": enviar_whatsapp}


def main() -> None:
    atual = ler_json(PASTA / "atual.json")
    texto = atual["resumo"]["texto"]
    if atual["data"] != hoje().isoformat():
        texto = f"⚠️ Os dados são de {atual['data']} (a atualização de hoje não rodou).\n\n{texto}"
    assunto = f"👶 Passeios da família — {atual['dia_semana']}, {atual['data'][8:]}/{atual['data'][5:7]}"
    canais = [c.strip() for c in os.environ.get("NOTIFICAR_CANAIS", "email").split(",") if c.strip()]
    falhas = 0
    for canal in canais:
        if canal not in CANAIS:
            print(f"{canal}: canal desconhecido.", file=sys.stderr)
            continue
        try:
            CANAIS[canal](assunto, texto)
        except Exception as erro:
            falhas += 1
            print(f"{canal}: falhou ({erro}).", file=sys.stderr)
    sys.exit(1 if falhas else 0)


if __name__ == "__main__":
    main()
