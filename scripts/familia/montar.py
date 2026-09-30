"""Valida a pesquisa do dia, cruza com o clima e publica docs/familia/atual.json + histórico.

Uso:
  python3 scripts/familia/montar.py --entrada pesquisa.json [--clima clima.json]
  python3 scripts/familia/montar.py --reaproveitar      # só atualiza o clima, mantendo as atividades de atual.json
"""

import argparse
import re
import sys
from datetime import date, timedelta
from pathlib import Path

import clima as mod_clima
from comum import CONFIG, HISTORICO, PASTA, agora, gravar_json, hoje, ler_json

CATEGORIAS = set(CONFIG["categorias"])
AMBIENTES = {"indoor", "outdoor", "misto"}
ADEQUACAO = {"sim", "parcial", "nao"}
OBRIGATORIOS = ("id", "nome", "categoria", "ambiente", "link", "fonte", "por_que", "adequado_0_6")
DIAS_PT = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"]
URL = re.compile(r"^https?://\S+$")

# Ordem de preferência de categorias por tipo de dia (primeiro = mais indicado).
PREFERENCIAS = {
    "quente_sol": ["praia", "agua", "parque", "zoologico_aquario", "fazenda", "playground", "evento_infantil", "oficina", "cultural", "museu", "teatro", "indoor", "cinema", "shopping"],
    "muito_quente": ["agua", "praia", "zoologico_aquario", "museu", "indoor", "oficina", "teatro", "cinema", "evento_infantil", "shopping", "cultural", "parque", "playground", "fazenda"],
    "ameno_seco": ["parque", "playground", "evento_infantil", "zoologico_aquario", "fazenda", "museu", "oficina", "cultural", "teatro", "indoor", "praia", "agua", "cinema", "shopping"],
    "instavel": ["museu", "evento_infantil", "zoologico_aquario", "oficina", "teatro", "indoor", "parque", "playground", "cultural", "cinema", "shopping", "fazenda", "agua", "praia"],
    "chuvoso": ["teatro", "museu", "indoor", "oficina", "evento_infantil", "cinema", "cultural", "zoologico_aquario", "shopping", "agua", "parque", "playground", "fazenda", "praia"],
    "frio": ["museu", "teatro", "indoor", "oficina", "evento_infantil", "cinema", "parque", "playground", "zoologico_aquario", "cultural", "shopping", "fazenda", "agua", "praia"],
}
CLASSE_TXT = {
    "quente_sol": ("☀️", "Quente e ensolarado"),
    "muito_quente": ("🥵", "Muito quente"),
    "ameno_seco": ("🌤️", "Ameno e sem chuva"),
    "instavel": ("⛅", "Instável, pode chover"),
    "chuvoso": ("🌧️", "Chuvoso"),
    "frio": ("🧥", "Frio"),
}
CONSELHO = {
    "quente_sol": "Bom dia para praia, parques e atividades ao ar livre. Evite sol forte entre 10h e 16h.",
    "muito_quente": "Muito calor: prefira locais climatizados, cobertos ou com água. Ao ar livre, só cedo (antes das 10h) ou no fim da tarde.",
    "ameno_seco": "Clima ideal para parques, playgrounds e eventos ao ar livre.",
    "instavel": "Pode chover: prefira programas com plano B coberto ou locais indoor próximos.",
    "chuvoso": "Dia de programa coberto: teatro, museus, oficinas e atrações indoor.",
    "frio": "Dia frio: atrações indoor e passeios curtos ao ar livre, bem agasalhados.",
}
OUTDOOR_OK = {"quente_sol", "ameno_seco"}


def validar(atividades: list, referencia: date) -> tuple[list, list]:
    validas, erros = [], []
    vistos = set()
    for i, a in enumerate(atividades):
        nome = a.get("nome") or f"item {i}"
        falta = [c for c in OBRIGATORIOS if not a.get(c)]
        if falta:
            erros.append(f"{nome}: faltam campos {falta}")
            continue
        fonte_url = a["fonte"].get("url") if isinstance(a["fonte"], dict) else None
        if not URL.match(a["link"]) or not fonte_url or not URL.match(fonte_url):
            erros.append(f"{nome}: link/fonte sem URL válida")
            continue
        if a["categoria"] not in CATEGORIAS or a["ambiente"] not in AMBIENTES or a["adequado_0_6"] not in ADEQUACAO:
            erros.append(f"{nome}: categoria/ambiente/adequado_0_6 inválido")
            continue
        if a["id"] in vistos:
            erros.append(f"{nome}: id duplicado")
            continue
        try:
            datas = sorted({date.fromisoformat(d) for d in a.get("datas") or []})
        except ValueError:
            erros.append(f"{nome}: data inválida")
            continue
        if not datas and not a.get("permanente"):
            erros.append(f"{nome}: sem datas e não é permanente")
            continue
        try:
            ate = date.fromisoformat(a["ate"]) if a.get("ate") else None
        except ValueError:
            erros.append(f"{nome}: 'ate' inválido")
            continue
        if ate and ate < referencia:
            continue  # temporada encerrada
        futuras = [d for d in datas if d >= referencia]
        if datas and not futuras and not a.get("permanente"):
            continue  # evento já passou
        a["datas"] = [d.isoformat() for d in futuras]
        vistos.add(a["id"])
        validas.append(a)
    return validas, erros


def disponivel(a: dict, dia: date) -> bool:
    if dia.isoformat() in a["datas"]:
        return True
    if a.get("permanente"):
        if a.get("ate") and dia.isoformat() > a["ate"]:
            return False
        dias = a.get("dias_semana")  # 0 = segunda ... 6 = domingo
        fechado = a.get("fechado_em") or []
        return (dias is None or dia.weekday() in dias) and dia.isoformat() not in fechado
    return False


def clima_do_dia(clima: dict, local_id: str, dia: date):
    local = clima["locais"].get(local_id)
    if not local:
        return None
    return next((d for d in local["dias"] if d["data"] == dia.isoformat()), None)


def avaliar(a: dict, dia: date, clima: dict) -> tuple[int, list[str]]:
    """Menor = mais relevante. Retorna (ordem, etiquetas)."""
    tempo = clima_do_dia(clima, a.get("clima_local") or "sp", dia) or clima_do_dia(clima, "sp", dia)
    classe = tempo["classe"] if tempo else "ameno_seco"
    prefs = PREFERENCIAS[classe]
    ordem = prefs.index(a["categoria"]) * 2
    tags = []
    if a["categoria"] == "praia":
        praia = (tempo or {}).get("praia")
        if praia == "boa":
            ordem -= 4
            tags.append("Praia boa no dia")
        elif praia == "ruim":
            ordem += 30
            tags.append("Tempo não favorece a praia")
    elif a["ambiente"] == "outdoor" and classe not in OUTDOOR_OK:
        ordem += {"chuvoso": 30, "instavel": 10, "muito_quente": 8, "frio": 6}[classe]
    elif a["ambiente"] == "indoor" and classe in {"chuvoso", "muito_quente", "frio"}:
        ordem -= 2
    if prefs.index(a["categoria"]) < 5 and ordem < 14:
        tags.append("Combina com o clima")
    if a["adequado_0_6"] == "parcial":
        ordem += 5
    elif a["adequado_0_6"] == "nao":
        ordem += 60
        tags.append("Pouco indicado para 0–6")
    if a.get("destaque"):
        ordem -= 3
    if a.get("gratuito"):
        ordem -= 1
        tags.append("Gratuito")
    reserva = (a.get("reserva") or "").lower()
    if "necess" in reserva and not reserva.startswith("não"):
        tags.append("Precisa reservar")
    tags.append({"indoor": "Coberto", "outdoor": "Ao ar livre", "misto": "Coberto + ar livre"}[a["ambiente"]])
    if not a.get("confirmado", False):
        tags.append("Confirmar no site")
    return ordem, tags


def resumo_dia(clima: dict, dia: date) -> dict:
    t = clima_do_dia(clima, "sp", dia)
    if not t:
        return {"data": dia.isoformat(), "classe": None, "rotulo": "Previsão indisponível", "icone": "❔", "conselho": "Previsão ainda não disponível para este dia."}
    icone, rotulo = CLASSE_TXT[t["classe"]]
    conselho = CONSELHO[t["classe"]]
    if t.get("uv_max") and t["uv_max"] >= CONFIG["regras_clima"]["uv_alto"]:
        conselho += f" Índice UV {t['uv_max']:.0f} (muito alto): protetor, chapéu e sombra."
    return {"data": dia.isoformat(), "classe": t["classe"], "rotulo": rotulo, "icone": icone, "conselho": conselho, "tempo": t}


def montar_dia(atividades: list, clima: dict, dia: date) -> dict:
    itens = []
    for a in atividades:
        if disponivel(a, dia):
            ordem, tags = avaliar(a, dia, clima)
            itens.append({"id": a["id"], "ordem": ordem, "tags": tags})
    itens.sort(key=lambda x: (x["ordem"], x["id"]))
    return resumo_dia(clima, dia) | {"atividades": itens}


def praias(clima: dict, dias: list[date]) -> list:
    saida = []
    for lid, local in clima["locais"].items():
        if local["tipo"] != "praia":
            continue
        por_dia = []
        for d in dias:
            t = clima_do_dia(clima, lid, d)
            if t:
                por_dia.append({"data": d.isoformat(), "avaliacao": t["praia"], "motivos": t["praia_motivos"], "tempo": t})
        nota = sum({"boa": 0, "parcial": 1, "ruim": 3}[p["avaliacao"]] for p in por_dia)
        saida.append({"id": lid, "nome": local["nome"], "distancia_km": local["distancia_km"], "tempo_carro": local["tempo_carro"], "dias": por_dia, "_nota": nota})
    saida.sort(key=lambda p: (p["_nota"], p["distancia_km"]))
    for p in saida:
        del p["_nota"]
    return saida


def fase_da_semana(ref: date) -> str:
    wd = ref.weekday()
    if wd <= 1:
        return "inicial"
    if wd <= 3:
        return "atualizada"
    return "consolidada"


def comparar_fim_de_semana(sab: dict, dom: dict) -> str:
    ordem = ["quente_sol", "ameno_seco", "muito_quente", "frio", "instavel", "chuvoso", None]
    a, b = ordem.index(sab["classe"]), ordem.index(dom["classe"])
    if sab["classe"] is None and dom["classe"] is None:
        return "A previsão do fim de semana ainda não está disponível."
    if a == b:
        if sab["classe"] in OUTDOOR_OK:
            return "Sábado e domingo parecem bons para atividades ao ar livre."
        return "Sábado e domingo parecem parecidos: tenha opções cobertas à mão."
    melhor = "sábado" if a < b else "domingo"
    return f"O {melhor} parece mais favorável para atividades ao ar livre."


def texto_resumo(snapshot: dict) -> str:
    atv = snapshot["atividades"]
    fds = {i["id"] for d in ("sabado", "domingo") for i in snapshot["dias"][d]["atividades"] if i["ordem"] < 40}
    cont = {"praia": 0, "parque": 0, "evento": 0, "coberto": 0}
    for i in fds:
        c = atv[i]["categoria"]
        if c == "praia":
            cont["praia"] += 1
        elif c in {"parque", "playground", "fazenda", "zoologico_aquario"}:
            cont["parque"] += 1
        elif c in {"evento_infantil", "oficina", "teatro"}:
            cont["evento"] += 1
        else:
            cont["coberto"] += 1
    praias_boas = [p["nome"] for p in snapshot["praias"] if any(d["avaliacao"] == "boa" for d in p["dias"][1:])]
    hoje_d = snapshot["dias"]["hoje"]
    linhas = [
        f"{hoje_d['icone']} Bom dia! Hoje: {hoje_d['rotulo'].lower()}"
        + (f", {hoje_d['tempo']['tmin']:.0f}–{hoje_d['tempo']['tmax']:.0f} °C, chuva {hoje_d['tempo']['chuva_prob']}%." if hoje_d.get("tempo") else "."),
        "",
        f"Encontrei {len(fds)} opções interessantes para o fim de semana ({snapshot['dias']['sabado']['data'][8:]}/{snapshot['dias']['sabado']['data'][5:7]} e {snapshot['dias']['domingo']['data'][8:]}/{snapshot['dias']['domingo']['data'][5:7]}).",
        "",
    ]
    if cont["praia"] or praias_boas:
        linhas.append(f"🏖️ {max(cont['praia'], len(praias_boas))} opções de praia")
    if cont["parque"]:
        linhas.append(f"🌳 {cont['parque']} parques e passeios ao ar livre")
    if cont["evento"]:
        linhas.append(f"👶 {cont['evento']} eventos infantis")
    if cont["coberto"]:
        linhas.append(f"🏛️ {cont['coberto']} museus e atrações cobertas")
    linhas += ["", snapshot["fim_de_semana"]["comparacao"], "", "Veja tudo:", CONFIG["site"]]
    return "\n".join(linhas)


def main() -> None:
    parser = argparse.ArgumentParser()
    grupo = parser.add_mutually_exclusive_group(required=True)
    grupo.add_argument("--entrada", type=Path, help="JSON da pesquisa do dia")
    grupo.add_argument("--reaproveitar", action="store_true", help="reutiliza as atividades de atual.json")
    parser.add_argument("--clima", type=Path, help="JSON gerado por clima.py (padrão: coleta agora)")
    parser.add_argument("--data", type=date.fromisoformat, help="data de referência (padrão: hoje em SP)")
    args = parser.parse_args()

    ref = args.data or hoje()
    if args.reaproveitar:
        anterior = ler_json(PASTA / "atual.json")
        entrada = {"atividades": list(anterior["atividades"].values()), "fontes_consultadas": anterior.get("fontes_consultadas", []),
                   "observacoes": anterior.get("observacoes_pesquisa"), "pesquisado_em": anterior.get("pesquisado_em")}
        origem = "clima-atualizado"
    else:
        entrada = ler_json(args.entrada)
        origem = "pesquisa-completa"
    clima = ler_json(args.clima) if args.clima else mod_clima.coletar()

    atividades, erros = validar(entrada.get("atividades", []), ref)
    for e in erros:
        print(f"descartado: {e}", file=sys.stderr)

    sab = ref + timedelta(days=(5 - ref.weekday()) % 7)
    dom = sab + timedelta(days=1)
    if ref.weekday() == 6:  # domingo: o "fim de semana" relevante é o próximo
        sab, dom = ref + timedelta(days=6), ref + timedelta(days=7)

    dias = {"hoje": montar_dia(atividades, clima, ref), "sabado": montar_dia(atividades, clima, sab), "domingo": montar_dia(atividades, clima, dom)}
    semana = [ref + timedelta(days=i) for i in range(1, 15)]
    proximos = []
    for d in semana:
        if d in (sab, dom):
            continue
        ids = [a["id"] for a in atividades if d.isoformat() in a["datas"] and not a.get("permanente")]
        if ids:
            proximos.append(resumo_dia(clima, d) | {"atividades": ids})

    snapshot = {
        "versao": 1,
        "data": ref.isoformat(),
        "dia_semana": DIAS_PT[ref.weekday()],
        "gerado_em": agora().isoformat(timespec="minutes"),
        "pesquisado_em": entrada.get("pesquisado_em") or agora().isoformat(timespec="minutes"),
        "origem_execucao": origem,
        "fase_semana": fase_da_semana(ref),
        "publico": CONFIG["publico"],
        "dias": dias,
        "fim_de_semana": {"sabado": sab.isoformat(), "domingo": dom.isoformat(), "comparacao": comparar_fim_de_semana(dias["sabado"], dias["domingo"])},
        "praias": praias(clima, [ref, sab, dom]),
        "proximos": proximos,
        "atividades": {a["id"]: a for a in atividades},
        "clima": clima,
        "fontes_consultadas": entrada.get("fontes_consultadas", []),
        "observacoes_pesquisa": entrada.get("observacoes"),
        "descartados": erros,
        "nota_distancias": CONFIG["nota_distancias"],
    }
    snapshot["resumo"] = {"texto": texto_resumo(snapshot), "link": CONFIG["site"]}

    gravar_json(HISTORICO / f"{ref.isoformat()}.json", snapshot)
    gravar_json(PASTA / "atual.json", snapshot)
    datas = sorted({p.stem for p in HISTORICO.glob("*.json")}, reverse=True)
    gravar_json(PASTA / "indice.json", {"datas": datas})
    print(f"ok: {len(atividades)} atividades, {len(erros)} descartadas, hoje={dias['hoje']['classe']}, sab={dias['sabado']['classe']}, dom={dias['domingo']['classe']}")
    print(snapshot["resumo"]["texto"])


if __name__ == "__main__":
    main()
