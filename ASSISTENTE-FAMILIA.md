# Assistente Diário da Família

Aba **Passeios** do RangoTime: todo dia de manhã a página mostra o que fazer hoje e no próximo fim de semana com criança de 0 a 6 anos em São Paulo e região, cruzando clima, eventos e atrações.

Link: https://alexandrealvesdecarvalhodevin-pixel.github.io/RangoTime/#passeios

## Arquitetura

```
06:17 (Brasília)  Devin Automation (diária)
   1. scripts/familia/clima.py   → Open-Meteo: SP, passeios e praias; classifica cada dia
   2. pesquisa na internet       → fontes.json + busca livre → docs/familia/pesquisa/AAAA-MM-DD.json
   3. scripts/familia/montar.py  → valida, cruza clima × atividade, ordena, gera resumo
   4. commit direto na main (só docs/familia/**) → GitHub Pages republica em ~1 min

07:23 (Brasília)  GitHub Actions (grátis) — ativar-workflow/familia.yml
   5. se a pesquisa de hoje não rodou: montar.py --reaproveitar (atualiza só o clima)
   6. notificar.py → e-mail hoje; WhatsApp no futuro (mesmo texto)
```

- A pesquisa aberta e a curadoria precisam de um agente (Devin). Todo o resto é determinístico e roda em scripts Python sem dependências externas.
- O Devin segue as instruções versionadas em [`scripts/familia/PROMPT.md`](scripts/familia/PROMPT.md). Para mudar o comportamento da pesquisa, edite esse arquivo.
- Cada dia gera um snapshot em `docs/familia/historico/AAAA-MM-DD.json`. Durante a semana o fim de semana é recalculado todo dia (novos eventos, cancelamentos e previsão mais precisa); a página indica a fase: *primeira leitura* (seg–ter), *atualizado* (qua–qui) e *visão consolidada* (sex–dom).

## Arquivos

| Arquivo | O que é |
|---|---|
| `docs/familia/config.json` | Origem das distâncias, faixa etária, locais de clima (cidade, passeios, praias), regras de classificação do tempo e categorias. |
| `docs/familia/fontes.json` | Lista de fontes de eventos e atrações consultadas pela pesquisa. |
| `docs/familia/pesquisa/AAAA-MM-DD.json` | Resultado bruto da pesquisa do dia (entrada do `montar.py`). |
| `docs/familia/atual.json` | Snapshot publicado que a página lê. |
| `docs/familia/historico/AAAA-MM-DD.json` | Snapshot de cada dia (clima, atividades, fontes, análise e resumo). |
| `docs/familia/indice.json` | Lista das datas com histórico (alimenta o seletor de histórico da página). |
| `scripts/familia/clima.py` | Coleta e classifica o clima. |
| `scripts/familia/montar.py` | Valida a pesquisa e gera `atual.json` + histórico. |
| `scripts/familia/notificar.py` | Envia o resumo pelos canais configurados. |
| `docs/passeios.js` | Interface da aba Passeios. |

## APIs

- **Open-Meteo Forecast** (`api.open-meteo.com/v1/forecast`): temperatura, sensação térmica, chuva (mm e probabilidade), horas de sol, vento, rajadas e UV, 16 dias. Grátis, sem chave.
- **Open-Meteo Marine** (`marine-api.open-meteo.com/v1/marine`): altura máxima de ondas nas praias. Grátis, sem chave.
- Eventos: não há API pública confiável e gratuita que cubra a programação infantil de SP, por isso a pesquisa é feita pelo Devin navegando nas fontes. Todo item publicado tem link da fonte e data de verificação.

### Como o clima muda as recomendações

`clima.py` classifica cada dia (limites em `config.json → regras_clima`):

| Classe | Quando | O que sobe na lista |
|---|---|---|
| `quente_sol` | máx ≥ 26 °C, pouca chuva | praia, água, parques, zoológico |
| `muito_quente` | máx ≥ 32 °C ou sensação ≥ 34 °C | água, praia, aquário, museus climatizados |
| `ameno_seco` | sem chuva, 18–26 °C | parques, playgrounds, eventos ao ar livre |
| `instavel` | chuva 40–70 % ou ≥ 1 mm | museus, eventos cobertos, parque com plano B |
| `chuvoso` | ≥ 8 mm ou (≥ 60 % e ≥ 2 mm) | teatro, museus, atrações indoor, oficinas, cinema |
| `frio` | máx < 18 °C | indoor, passeios curtos |

Praias recebem avaliação própria (boa/parcial/ruim) considerando chuva, temperatura, vento e ondas. Atividades ao ar livre em dia ruim não somem: vão para o fim da lista com o aviso correspondente.

## Horários

- **Pesquisa (Devin)**: definida na Automation do Devin (padrão 06:17, `America/Sao_Paulo`). Para mudar, edite o agendamento da Automation em https://app.devin.ai (Automations) ou peça ao Devin.
- **Clima de reserva + e-mail (Actions)**: `cron` em `.github/workflows/familia.yml`, em UTC (`23 10 * * *` = 07:23 em Brasília). Mantenha pelo menos ~1h depois da pesquisa.

## Secrets

Nenhuma chave é necessária para clima e página. Para o e-mail, o workflow reutiliza os mesmos secrets dos lembretes do cardápio:

- `EMAIL_USUARIO`, `EMAIL_SENHA` (senha de app do Gmail), `EMAIL_DESTINO` (opcional).
- Variables opcionais: `SMTP_HOST`, `SMTP_PORT`, `NOTIFICAR_CANAIS` (padrão `email`; ex.: `email,whatsapp`).

## Ativar o workflow

Assim como o dos lembretes, o GitHub não deixa integrações criarem arquivos em `.github/workflows/`. Abra `ativar-workflow/familia.yml` no GitHub, clique em **Edit** e troque o caminho para `.github/workflows/familia.yml`. O workflow usa `contents: write` para poder commitar a atualização de clima de reserva.

## Adicionar fontes

Inclua um objeto em `docs/familia/fontes.json`:

```json
{ "id": "teatro-x", "nome": "Teatro X — infantil", "url": "https://teatrox.com.br/infantil", "tipo": "oficial", "prioridade": 1, "dica": "opcional" }
```

`prioridade`: 1 = site oficial do local, 2 = agenda oficial ou plataforma de ingressos, 3 = guia (sempre confirmar no oficial). A próxima execução já passa a consultar a fonte. Para acompanhar outra praia ou cidade, adicione um item em `config.json → locais_clima` (com `lat`, `lon`, `tipo`, `distancia_km`).

## WhatsApp (futuro)

Tudo já gera `resumo.texto` em formato de mensagem (ex.: "Encontrei 15 opções interessantes para o fim de semana…"). Para ativar:

1. Escolha o provedor: Meta WhatsApp Cloud API (oficial, grátis até certo volume), Twilio (pago) ou CallMeBot (grátis, uso pessoal).
2. Implemente `enviar_whatsapp()` em `scripts/familia/notificar.py` usando secrets `WHATSAPP_TOKEN` e `WHATSAPP_DESTINO`.
3. Crie a variable `NOTIFICAR_CANAIS=email,whatsapp`.

## Rodar manualmente

```bash
python3 scripts/familia/clima.py --saida /tmp/clima.json
python3 scripts/familia/montar.py --entrada docs/familia/pesquisa/2026-09-30.json --clima /tmp/clima.json
python3 scripts/familia/montar.py --reaproveitar      # só atualiza o clima
EMAIL_USUARIO=... EMAIL_SENHA=... python3 scripts/familia/notificar.py
```
