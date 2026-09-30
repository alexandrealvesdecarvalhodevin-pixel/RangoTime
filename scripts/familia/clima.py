"""Coleta a previsão do tempo (Open-Meteo) para São Paulo, passeios e praias e classifica cada dia.

Uso: python3 scripts/familia/clima.py [--saida arquivo.json]
"""

import argparse
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

from comum import CONFIG, gravar_json

FORECAST = "https://api.open-meteo.com/v1/forecast"
MARINE = "https://marine-api.open-meteo.com/v1/marine"
DIARIO = [
    "weather_code", "temperature_2m_max", "temperature_2m_min", "apparent_temperature_max",
    "precipitation_sum", "precipitation_probability_max", "sunshine_duration",
    "wind_speed_10m_max", "wind_gusts_10m_max", "uv_index_max",
]
REGRAS = CONFIG["regras_clima"]

# Códigos WMO usados pelo Open-Meteo.
CEU = {0: "céu limpo", 1: "predomínio de sol", 2: "parcialmente nublado", 3: "nublado", 45: "neblina", 48: "neblina",
       51: "garoa", 53: "garoa", 55: "garoa forte", 61: "chuva fraca", 63: "chuva", 65: "chuva forte",
       80: "pancadas de chuva", 81: "pancadas de chuva", 82: "pancadas fortes", 95: "trovoadas", 96: "trovoadas com granizo", 99: "trovoadas com granizo"}


def buscar(url: str, params: dict) -> list:
    consulta = urllib.parse.urlencode(params, safe=",")
    with urllib.request.urlopen(f"{url}?{consulta}", timeout=30) as resp:
        dados = json.load(resp)
    return dados if isinstance(dados, list) else [dados]


def classificar(d: dict) -> str:
    prob, mm, tmax, sens = d["chuva_prob"] or 0, d["chuva_mm"] or 0, d["tmax"], d["sensacao_max"] or d["tmax"]
    r = REGRAS["chuvoso"]
    if mm >= r["chuva_mm_min"] or (prob >= r["chuva_prob_min"] and mm >= r["chuva_mm_com_prob"]):
        return "chuvoso"
    if prob >= REGRAS["instavel"]["chuva_prob_forte"]:
        return "instavel"
    if tmax >= REGRAS["muito_quente"]["tmax_min"] or sens >= REGRAS["muito_quente"]["sensacao_min"]:
        return "muito_quente"
    if prob >= REGRAS["instavel"]["chuva_prob_min"] or mm >= REGRAS["instavel"]["chuva_mm_min"]:
        return "instavel"
    if tmax >= REGRAS["quente_sol"]["tmax_min"]:
        return "quente_sol"
    if tmax < REGRAS["frio"]["tmax_max"]:
        return "frio"
    return "ameno_seco"


def avaliar_praia(d: dict) -> tuple[str, list[str]]:
    r = REGRAS["praia"]
    motivos = []
    if (d["chuva_prob"] or 0) > r["chuva_prob_max"] or (d["chuva_mm"] or 0) > r["chuva_mm_max"]:
        motivos.append(f"chuva {d['chuva_prob']}% / {d['chuva_mm']} mm")
    if d["tmax"] < r["tmax_min"]:
        motivos.append(f"máxima de {d['tmax']:.0f} °C")
    if (d["vento_max"] or 0) > r["vento_max"]:
        motivos.append(f"vento de {d['vento_max']:.0f} km/h")
    if d.get("ondas_max") is not None and d["ondas_max"] > r["ondas_max"]:
        motivos.append(f"ondas de {d['ondas_max']:.1f} m")
    if not motivos:
        return "boa", ["sol, pouca chuva e vento moderado"]
    if len(motivos) == 1 and d["classe"] != "chuvoso" and (d["chuva_prob"] or 0) < REGRAS["instavel"]["chuva_prob_forte"]:
        return "parcial", motivos
    return "ruim", motivos


def coletar() -> dict:
    locais = CONFIG["locais_clima"]
    dias = CONFIG["janela_dias"]
    base = {"timezone": CONFIG["fuso"], "forecast_days": dias, "wind_speed_unit": "kmh"}
    previsoes = buscar(FORECAST, {**base, "latitude": ",".join(str(l["lat"]) for l in locais),
                                  "longitude": ",".join(str(l["lon"]) for l in locais), "daily": ",".join(DIARIO)})
    praias = [l for l in locais if l["tipo"] == "praia"]
    ondas = {}
    try:
        marinhas = buscar(MARINE, {"timezone": CONFIG["fuso"], "forecast_days": min(dias, 8),
                                   "latitude": ",".join(str(l["lat"]) for l in praias),
                                   "longitude": ",".join(str(l["lon"]) for l in praias), "daily": "wave_height_max"})
        for local, m in zip(praias, marinhas):
            ondas[local["id"]] = dict(zip(m["daily"]["time"], m["daily"]["wave_height_max"]))
    except Exception as erro:  # a previsão de ondas é complementar
        print(f"aviso: ondas indisponíveis ({erro})", file=sys.stderr)

    saida = {"fonte": {"nome": "Open-Meteo", "url": "https://open-meteo.com"}, "locais": {}}
    for local, p in zip(locais, previsoes):
        dd = p["daily"]
        lista = []
        for i, dia in enumerate(dd["time"]):
            if dd["temperature_2m_max"][i] is None:
                continue
            item = {
                "data": dia,
                "ceu": CEU.get(dd["weather_code"][i], "variável"),
                "tmax": round(dd["temperature_2m_max"][i], 1),
                "tmin": round(dd["temperature_2m_min"][i], 1),
                "sensacao_max": round(dd["apparent_temperature_max"][i], 1) if dd["apparent_temperature_max"][i] is not None else None,
                "chuva_mm": round(dd["precipitation_sum"][i] or 0, 1),
                "chuva_prob": dd["precipitation_probability_max"][i],
                "sol_h": round((dd["sunshine_duration"][i] or 0) / 3600, 1),
                "vento_max": round(dd["wind_speed_10m_max"][i] or 0),
                "rajada_max": round(dd["wind_gusts_10m_max"][i] or 0),
                "uv_max": round(dd["uv_index_max"][i], 1) if dd["uv_index_max"][i] is not None else None,
            }
            item["classe"] = classificar(item)
            if local["tipo"] == "praia":
                item["ondas_max"] = ondas.get(local["id"], {}).get(dia)
                item["praia"], item["praia_motivos"] = avaliar_praia(item)
            lista.append(item)
        saida["locais"][local["id"]] = {k: local[k] for k in ("nome", "tipo", "distancia_km", "tempo_carro")} | {"dias": lista}
    return saida


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--saida", type=Path)
    args = parser.parse_args()
    dados = coletar()
    if args.saida:
        gravar_json(args.saida, dados)
    else:
        print(json.dumps(dados, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
