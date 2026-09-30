/* Aba "Passeios": curadoria diária de atividades para a família (dados em familia/atual.json). */
const Passeios = (() => {
  const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const SEMANA_PY = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"]; // dias_semana usa 0 = segunda
  const cache = {};
  let config = null;
  let snap = null;
  let dataAberta = null;
  let fdsDia = "sabado";

  const fmtData = (iso) => { const d = new Date(`${iso}T12:00:00`); return `${SEMANA[d.getDay()]}, ${iso.slice(8)}/${iso.slice(5, 7)}`; };
  const hojeISO = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const nc = '<span class="nc">não confirmado</span>';
  const campo = (rotulo, valor) => `<div><dt>${rotulo}</dt><dd>${valor === null || valor === undefined || valor === "" ? nc : esc(valor)}</dd></div>`;
  const cat = (c) => (config && config.categorias[c]) || { rotulo: c, icone: "📍" };

  async function carregar(nome) {
    if (!cache[nome]) cache[nome] = fetch(`familia/${nome}`, { cache: "no-cache" }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
    return cache[nome];
  }

  function quando(a) {
    if (a.datas && a.datas.length) {
      const mostra = a.datas.slice(0, 4).map(fmtData).join(" · ");
      return a.datas.length > 4 ? `${mostra} (+${a.datas.length - 4})` : mostra;
    }
    if (a.permanente) return a.dias_semana ? `Aberto: ${a.dias_semana.map((d) => SEMANA_PY[d]).join(", ")}` : "Todos os dias";
    return null;
  }

  function cardAtividade(ref, extraTags = []) {
    const a = snap.atividades[ref.id];
    if (!a) return "";
    const c = cat(a.categoria);
    const tags = [...new Set([...(ref.tags || []), ...extraTags])];
    const idade = a.faixa_etaria || (a.idade_min !== null && a.idade_min !== undefined ? `a partir de ${a.idade_min} ano(s)` : null);
    const verificado = a.verificado_em ? ` · verificado em ${a.verificado_em.slice(8, 10)}/${a.verificado_em.slice(5, 7)}` : "";
    return `<details class="card act">
      <summary>
        <span class="card__icon">${c.icone}</span>
        <div class="act__head">
          <h3>${esc(a.nome)}</h3>
          <p>${esc(c.rotulo)} · ${esc(a.local || a.cidade || "")}${a.horario ? ` · ${esc(a.horario)}` : ""}</p>
          <div class="pills">${a.destaque ? '<span class="pill pill--pink">⭐ Destaque</span>' : ""}${tags.slice(0, 4).map((t) => `<span class="pill ${t === "Combina com o clima" || t === "Praia boa no dia" ? "pill--green" : t.startsWith("Tempo não") || t.startsWith("Pouco") ? "pill--orange" : ""}">${esc(t)}</span>`).join("")}</div>
        </div>
        <span class="step__chev">▾</span>
      </summary>
      <p class="act__why">${esc(a.por_que)}</p>
      <dl class="act__info">
        ${campo("Quando", quando(a))}
        ${campo("Horário", a.horario)}
        ${campo("Local", [a.local, a.cidade].filter(Boolean).join(" · ") || null)}
        ${campo("Endereço", a.endereco)}
        ${campo("Preço", a.preco)}
        ${campo("Idade", idade)}
        ${a.classificacao ? campo("Classificação", a.classificacao) : ""}
        ${campo("Duração", a.duracao)}
        ${campo("Reserva", a.reserva)}
        ${a.ingressos ? campo("Ingressos", a.ingressos) : ""}
        ${a.acompanhante_adulto !== undefined && a.acompanhante_adulto !== null ? campo("Adulto junto", a.acompanhante_adulto ? "obrigatório" : "não obrigatório") : ""}
      </dl>
      ${a.observacoes ? `<p class="act__obs">ℹ️ ${esc(a.observacoes)}</p>` : ""}
      <div class="act__foot">
        <a class="btn btn--sm" href="${esc(a.link)}" target="_blank" rel="noopener">Site oficial ↗</a>
        <span>Fonte: <a href="${esc(a.fonte.url)}" target="_blank" rel="noopener">${esc(a.fonte.nome || a.fonte.url)}</a>${verificado}</span>
      </div>
    </details>`;
  }

  function cardTempo(dia, titulo) {
    const t = dia.tempo;
    if (!t) return `<div class="card wx"><div class="wx__top"><span class="wx__icon">❔</span><div><div class="eyebrow">${esc(titulo)}</div><h3>Previsão indisponível</h3></div></div></div>`;
    return `<div class="card wx wx--${dia.classe}">
      <div class="wx__top">
        <span class="wx__icon">${dia.icone}</span>
        <div><div class="eyebrow">${esc(titulo)} · ${fmtData(dia.data)}</div><h3>${esc(dia.rotulo)}</h3><p>${esc(t.ceu)}</p></div>
        <div class="wx__temp">${Math.round(t.tmax)}°<small>${Math.round(t.tmin)}°</small></div>
      </div>
      <div class="wx__grid">
        <div><span>Sensação</span><b>${t.sensacao_max !== null ? `${Math.round(t.sensacao_max)}°` : "–"}</b></div>
        <div><span>Chuva</span><b>${t.chuva_prob ?? "–"}%</b><small>${t.chuva_mm} mm</small></div>
        <div><span>Sol</span><b>${t.sol_h} h</b></div>
        <div><span>Vento</span><b>${t.vento_max}</b><small>km/h</small></div>
        <div><span>UV</span><b>${t.uv_max ?? "–"}</b></div>
      </div>
      <p class="wx__tip">${esc(dia.conselho)}</p>
    </div>`;
  }

  const listaAtividades = (refs, vazio, limite = 8) => {
    if (!refs.length) return `<div class="note"><span>🔎</span><span>${esc(vazio)}</span></div>`;
    const principais = refs.slice(0, limite).map((r) => cardAtividade(r)).join("");
    const resto = refs.slice(limite);
    return principais + (resto.length ? `<details class="more"><summary class="btn btn--ghost">Mais ${resto.length} opções</summary>${resto.map((r) => cardAtividade(r)).join("")}</details>` : "");
  };

  function melhoresRefs(filtro) {
    const melhor = {};
    ["hoje", "sabado", "domingo"].forEach((d) => snap.dias[d].atividades.forEach((r) => {
      if (!filtro(snap.atividades[r.id])) return;
      if (!melhor[r.id] || r.ordem < melhor[r.id].ordem) melhor[r.id] = r;
    }));
    return Object.values(melhor).sort((a, b) => a.ordem - b.ordem);
  }

  function cardPraia(p) {
    const rot = { boa: ["✅", "Boa"], parcial: ["⚠️", "Parcial"], ruim: ["❌", "Ruim"] };
    const nomes = [snap.data, snap.fim_de_semana.sabado, snap.fim_de_semana.domingo];
    const label = (iso) => (iso === snap.data ? "Hoje" : iso === snap.fim_de_semana.sabado ? "Sábado" : "Domingo");
    const dias = p.dias.filter((d) => nomes.includes(d.data));
    const vistos = new Set();
    return `<div class="card beach">
      <div class="beach__head"><h3>${esc(p.nome)}</h3><span>${p.distancia_km} km · ${esc(p.tempo_carro || "")}</span></div>
      <div class="beach__days">${dias.filter((d) => !vistos.has(d.data) && vistos.add(d.data)).map((d) => `<div class="beach__day beach__day--${d.avaliacao}">
        <div class="beach__lbl">${label(d.data)}</div>
        <div class="beach__eval">${rot[d.avaliacao][0]} ${rot[d.avaliacao][1]}</div>
        <div class="beach__data">${Math.round(d.tempo.tmax)}° · ${d.tempo.chuva_prob}% chuva<br>vento ${d.tempo.vento_max} km/h${d.tempo.ondas_max !== null && d.tempo.ondas_max !== undefined ? ` · ondas ${d.tempo.ondas_max} m` : ""}${d.tempo.uv_max ? ` · UV ${Math.round(d.tempo.uv_max)}` : ""}</div>
        ${d.avaliacao !== "boa" ? `<div class="beach__why">${esc(d.motivos.join(", "))}</div>` : ""}
      </div>`).join("")}</div>
    </div>`;
  }

  function render() {
    const el = $("#passeios");
    const s = snap;
    const hoje = s.dias.hoje;
    const fase = { inicial: "Primeira leitura da semana, previsão ainda pode mudar", atualizada: "Atualizado no meio da semana", consolidada: "Visão consolidada" }[s.fase_semana];
    const velho = !dataAberta && s.data !== hojeISO();
    const destaques = melhoresRefs((a) => a.adequado_0_6 !== "nao").filter((r) => r.ordem < 20 || s.atividades[r.id].destaque).slice(0, 4);
    const praiaRefs = melhoresRefs((a) => a.categoria === "praia" || a.categoria === "agua");
    const parques = melhoresRefs((a) => ["parque", "playground", "zoologico_aquario", "fazenda"].includes(a.categoria));
    const chuva = melhoresRefs((a) => a.ambiente !== "outdoor" && a.categoria !== "praia");
    const fdsInfo = s.dias[fdsDia];
    const diaFds = (k) => `${k === "sabado" ? "Sábado" : "Domingo"}<small>${s.dias[k].icone} ${s.dias[k].tempo ? `${Math.round(s.dias[k].tempo.tmax)}° · ${s.dias[k].tempo.chuva_prob}%` : "–"}</small>`;
    const recomendados = (refs) => refs.filter((r) => r.ordem < 40);

    el.innerHTML = `
      <h1 class="large-title">Passeios <span class="grad">em família</span></h1>
      <p class="subtitle">Curadoria diária para crianças de ${s.publico.idade_min} a ${s.publico.idade_max} anos · São Paulo e região</p>
      ${dataAberta ? `<button class="alert alert--orange" data-passeios-atual><span class="card__icon">🕘</span><div><strong>Histórico de ${fmtData(s.data)}</strong><p>Toque para voltar aos dados de hoje.</p></div><span class="chev">›</span></button>` : ""}
      ${velho ? `<div class="alert alert--orange"><span class="card__icon">⚠️</span><div><strong>Dados de ${fmtData(s.data)}</strong><p>A atualização de hoje ainda não rodou.</p></div></div>` : ""}

      <div class="section" style="margin-top:16px">${cardTempo(hoje, dataAberta ? "Neste dia" : "Hoje")}</div>

      <div class="section">
        ${sectionTitle("👶 O que fazer hoje", `${recomendados(hoje.atividades).length} opções`)}
        ${listaAtividades(recomendados(hoje.atividades), "Nenhuma opção confirmada para hoje. Veja o fim de semana e os próximos dias.")}
      </div>

      ${destaques.length ? `<div class="section">${sectionTitle("⭐ Destaques")}${destaques.map((r) => cardAtividade(r)).join("")}</div>` : ""}

      <div class="section" id="fds">
        ${sectionTitle("📅 Próximo fim de semana", fase)}
        <div class="card card--accent"><p style="color:var(--text);font-weight:600">${esc(s.fim_de_semana.comparacao)}</p></div>
        <div class="seg" role="group" aria-label="Dia do fim de semana">
          <button class="seg__btn ${fdsDia === "sabado" ? "is-active" : ""}" data-fds="sabado">${diaFds("sabado")}</button>
          <button class="seg__btn ${fdsDia === "domingo" ? "is-active" : ""}" data-fds="domingo">${diaFds("domingo")}</button>
        </div>
        <div style="margin-top:12px">${cardTempo(fdsInfo, fdsDia === "sabado" ? "Sábado" : "Domingo")}</div>
        <div style="margin-top:12px">${listaAtividades(recomendados(fdsInfo.atividades), "Ainda não há opções confirmadas para este dia. A pesquisa é refeita todos os dias.")}</div>
      </div>

      <div class="section">
        ${sectionTitle("🏖️ Se o tempo estiver bom", "praias")}
        <div class="carousel carousel--wide">${s.praias.map(cardPraia).join("")}</div>
        <p class="hint">${esc(s.nota_distancias)}</p>
        ${praiaRefs.length ? `<div style="margin-top:12px">${listaAtividades(praiaRefs, "", 4)}</div>` : ""}
      </div>

      <div class="section">
        ${sectionTitle("🌳 Parques e ar livre", `${parques.length}`)}
        ${listaAtividades(parques, "Nenhum parque na curadoria de hoje.", 5)}
      </div>

      <div class="section">
        ${sectionTitle("🌧️ Se chover", `${chuva.length} cobertos`)}
        ${listaAtividades(chuva, "Nenhuma opção coberta na curadoria de hoje.", 5)}
      </div>

      <div class="section">
        ${sectionTitle("📆 Próximos dias")}
        ${s.proximos.length ? s.proximos.map((d) => `<div class="day-group"><div class="day-group__head"><b>${fmtData(d.data)}</b><span>${d.icone} ${esc(d.rotulo)}${d.tempo ? ` · ${Math.round(d.tempo.tmax)}°` : ""}</span></div>${d.atividades.map((id) => cardAtividade({ id, tags: [] })).join("")}</div>`).join("") : '<div class="note"><span>🔎</span><span>Nenhum evento com data marcada nos próximos 14 dias.</span></div>'}
      </div>

      <div class="section">
        ${sectionTitle("ℹ️ Sobre estes dados")}
        <div class="card">
          <p>Atualizado em ${esc(s.gerado_em.replace("T", " às ").slice(0, 22))} · ${s.origem_execucao === "pesquisa-completa" ? "pesquisa completa" : "só clima atualizado (sem pesquisa nova)"}.</p>
          <p style="margin-top:6px">Clima: <a href="${esc(s.clima.fonte.url)}" target="_blank" rel="noopener">${esc(s.clima.fonte.nome)}</a>. Informações de eventos sempre com link da fonte. Campos marcados como <span class="nc">não confirmado</span> não foram encontrados na fonte oficial.</p>
          ${s.observacoes_pesquisa ? `<p style="margin-top:6px">${esc(s.observacoes_pesquisa)}</p>` : ""}
          ${s.fontes_consultadas.length ? `<details style="margin-top:10px"><summary class="link">Fontes consultadas (${s.fontes_consultadas.length})</summary><ul class="bullets">${s.fontes_consultadas.map((f) => `<li><a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.nome || f.url)}</a></li>`).join("")}</ul></details>` : ""}
        </div>
        <div class="card"><h3>🕘 Histórico</h3><p>Veja o que foi encontrado em outros dias.</p><div class="chips" id="historico"></div></div>
      </div>`;
    carregar("indice.json").then((idx) => {
      const alvo = $("#historico");
      if (alvo) alvo.innerHTML = idx.datas.map((d) => `<button class="chip ${d === s.data ? "chip--on" : ""}" data-historico="${d}">${fmtData(d)}</button>`).join("");
    }).catch(() => {});
  }

  function vazio(msg) {
    $("#passeios").innerHTML = `<h1 class="large-title">Passeios <span class="grad">em família</span></h1>
      <div class="note" style="margin-top:16px"><span>⏳</span><span>${esc(msg)}</span></div>`;
  }

  async function abrir(param) {
    const data = /^\d{4}-\d{2}-\d{2}$/.test(param || "") ? param : null;
    if (snap && dataAberta === data) return;
    try {
      [config, snap] = await Promise.all([carregar("config.json"), carregar(data ? `historico/${data}.json` : "atual.json")]);
      dataAberta = data;
      render();
    } catch (_) {
      vazio(data ? "Não encontrei os dados desse dia." : "Ainda não há dados. A primeira pesquisa roda automaticamente de manhã.");
    }
  }

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-fds],[data-historico],[data-passeios-atual]");
    if (!t) return;
    if (t.dataset.fds) {
      fdsDia = t.dataset.fds;
      const y = window.scrollY;
      render();
      window.scrollTo({ top: y });
    } else if (t.dataset.historico) {
      location.hash = t.dataset.historico === hojeISO() ? "passeios" : `passeios/${t.dataset.historico}`;
      window.scrollTo({ top: 0 });
    } else {
      location.hash = "passeios";
      window.scrollTo({ top: 0 });
    }
  });

  return { abrir };
})();
