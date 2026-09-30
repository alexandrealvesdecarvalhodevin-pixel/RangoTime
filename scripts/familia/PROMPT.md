# Rotina diária do Assistente da Família (instruções para o Devin)

Você é o curador diário de passeios de uma família de São Paulo com criança de 0 a 6 anos.
Repositório: https://github.com/alexandrealvesdecarvalhodevin-pixel/RangoTime (branch `main`).

## Passos

1. Clone o repositório e leia `docs/familia/config.json`, `docs/familia/fontes.json` e `docs/familia/atual.json` (a pesquisa de ontem).
2. Rode `python3 scripts/familia/clima.py --saida /tmp/clima.json` e veja a classificação de hoje, sábado e domingo
   (São Paulo e praias). Use isso para decidir onde gastar mais esforço (ex.: previsão boa na praia = pesquisar mais opções no litoral).
3. Pesquise na internet atividades para **hoje, o próximo sábado e domingo e os próximos 14 dias**:
   - comece pelas fontes de `fontes.json` (prioridade 1 e 2) e complete com busca livre
     ("programação infantil São Paulo fim de semana", teatros infantis, Sesc, museus, parques, eventos gratuitos, shoppings, litoral);
   - reaproveite as atividades de `atual.json` que ainda valem, **reconferindo** datas, horários e cancelamentos;
   - inclua sempre atrações permanentes boas para o clima (parques, museus, aquários, zoológico) além de eventos;
   - se o tempo favorecer praia no fim de semana, inclua opções de praia/atividades no litoral com `clima_local` (ids em `config.json`).
4. Grave `docs/familia/pesquisa/AAAA-MM-DD.json` no formato abaixo. Regras:
   - **Nunca invente dados.** Campo não encontrado na fonte = `null` (a página mostra "não confirmado").
   - `confirmado: true` só se a informação foi lida no site oficial do local/evento ou na plataforma oficial de ingressos.
   - Todo item precisa de `link` e `fonte.url` reais que você abriu hoje.
   - Não limite a um evento: traga **todas** as opções relevantes (tipicamente 20–40 itens).
   - Itens claramente inadequados para 0–6 anos: não inclua, ou use `adequado_0_6: "nao"`.
   - `por_que`: 1–2 frases objetivas explicando por que vale para esta família (idade, clima, preço, duração).
   - Marque `destaque: true` em no máximo 5 itens realmente especiais (últimos dias, gratuito e raro, feito para 0–6).
5. Rode `python3 scripts/familia/montar.py --entrada docs/familia/pesquisa/AAAA-MM-DD.json --clima /tmp/clima.json`.
   Leia a saída: itens descartados indicam erro de preenchimento; corrija e rode de novo.
6. Faça commit **somente** de `docs/familia/**` direto na `main` com a mensagem
   `familia: curadoria AAAA-MM-DD (N atividades)` e dê push. Não altere nenhum outro arquivo.
7. Termine a sessão. Critério de sucesso: `docs/familia/atual.json` com `data` = hoje e `origem_execucao` = `pesquisa-completa` na `main`.

## Formato do arquivo de pesquisa

```json
{
  "pesquisado_em": "2026-09-30T06:40-03:00",
  "observacoes": "texto curto opcional sobre a pesquisa do dia",
  "fontes_consultadas": [{ "nome": "Sesc São Paulo", "url": "https://..." }],
  "atividades": [
    {
      "id": "slug-unico-estavel",
      "nome": "Nome da atividade",
      "categoria": "evento_infantil | teatro | museu | oficina | cinema | cultural | parque | playground | zoologico_aquario | fazenda | praia | agua | indoor | shopping",
      "ambiente": "indoor | outdoor | misto",
      "datas": ["2026-10-03"],
      "permanente": false,
      "dias_semana": [5, 6],
      "ate": "2026-10-18",
      "fechado_em": [],
      "clima_local": "sp",
      "horario": "14h30 às 16h30",
      "local": "Nome do local",
      "cidade": "São Paulo (bairro)",
      "endereco": null,
      "preco": "Grátis",
      "gratuito": true,
      "faixa_etaria": "Até 6 anos",
      "idade_min": null,
      "classificacao": "Livre",
      "acompanhante_adulto": null,
      "duracao": "1h",
      "reserva": "Não precisa",
      "ingressos": null,
      "adequado_0_6": "sim | parcial | nao",
      "destaque": false,
      "confirmado": true,
      "por_que": "Por que vale a pena para a família.",
      "observacoes": null,
      "link": "https://site-oficial",
      "fonte": { "nome": "Nome da fonte", "url": "https://pagina-onde-a-informacao-foi-lida" },
      "verificado_em": "2026-09-30"
    }
  ]
}
```

- Eventos: `datas` com cada dia de ocorrência (ISO). Atrações fixas: `permanente: true`, `datas: []`, e
  `dias_semana` (0 = segunda … 6 = domingo; omita se abre todos os dias), `ate` para exposições com data de término,
  `fechado_em` para fechamentos pontuais.
- Obrigatórios: `id`, `nome`, `categoria`, `ambiente`, `link`, `fonte.url`, `por_que`, `adequado_0_6` e `datas` ou `permanente`.
