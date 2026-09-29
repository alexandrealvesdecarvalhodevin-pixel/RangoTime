const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const STORE_KEY = "planejamento-semanal:v1";
const TABS = ["planejamento", "compras", "preparo"];

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = (sel, root = document) => root.querySelector(sel);

const store = {
  data: JSON.parse(localStorage.getItem(STORE_KEY) || "{}"),
  get(key) { return Boolean(this.data[key]); },
  set(key, value) {
    if (value) this.data[key] = true; else delete this.data[key];
    localStorage.setItem(STORE_KEY, JSON.stringify(this.data));
  },
  clear(prefix) {
    Object.keys(this.data).filter((k) => k.startsWith(prefix)).forEach((k) => delete this.data[k]);
    localStorage.setItem(STORE_KEY, JSON.stringify(this.data));
  },
};

let DATA;
let mealAtual = 1;

const chips = (items, cls = "chips") => `<div class="${cls}">${items.map((i) => `<span class="chip">${esc(i)}</span>`).join("")}</div>`;
const bullets = (items) => `<ul class="list-check">${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
const sectionHead = (title, desc) => `<div class="section__head"><h2>${esc(title)}</h2>${desc ? `<p>${esc(desc)}</p>` : ""}</div>`;
const checkItem = (key, label) => `<label class="check"><input type="checkbox" data-key="${esc(key)}" ${store.get(key) ? "checked" : ""}><span>${esc(label)}</span></label>`;

function renderToday() {
  const hoje = new Date().getDay();
  const amanha = (hoje + 1) % 7;
  const refHoje = DATA.refeicoes.find((r) => r.dia === hoje);
  const refAmanha = DATA.refeicoes.find((r) => r.dia === amanha);
  const compraHoje = DATA.compras.find((c) => c.id !== "despensa" && c.dia === hoje);
  const linhas = [];
  if (compraHoje) linhas.push(`Dia de <strong>${esc(compraHoje.titulo)}</strong> — confira a lista de compras.`);
  if (refHoje) linhas.push(`Hoje: <strong>Refeição ${refHoje.numero}</strong> — ${esc(refHoje.resumo)}.`);
  if (refAmanha) linhas.push(`Passe o(a) <strong>${esc(refAmanha.descongelar)}</strong> do freezer para a geladeira para amanhã.`);
  if (!linhas.length) linhas.push("Dia livre! Aproveite para conferir o que tem em casa antes da Compra 1.");
  $("#today").innerHTML = `<div class="today-card"><span class="today-card__icon">📅</span><div><small>${DIAS[hoje]}</small>${linhas.map((l) => `<p>${l}</p>`).join("")}</div></div>`;
}

function renderPlanejamento() {
  const hoje = new Date().getDay();
  const dias = [0, 1, 2, 3, 4, 5, 6].map((d) => {
    const ref = DATA.refeicoes.find((r) => r.dia === d);
    const compra = DATA.compras.find((c) => c.id !== "despensa" && c.dia === d);
    const cls = ["day", d === hoje ? "is-today" : "", compra && !ref ? "day--shop" : ""].join(" ");
    const meta = [
      compra ? `<span class="pill pill--green">🛒 ${esc(compra.titulo)}</span>` : "",
      ref ? `<span class="pill">⏱ ${esc(ref.tempo)}</span>` : "",
    ].join("");
    const title = ref ? esc(ref.resumo) : compra ? "Fazer a compra e organizar a geladeira" : "Livre";
    const attrs = ref ? `data-goto-meal="${ref.numero}"` : compra ? `data-goto-tab="compras"` : "";
    return `<button class="${cls}" ${attrs}>
      <div class="day__name">${DIAS[d]}</div>
      <div class="day__num">${ref ? `Refeição ${ref.numero}` : "&nbsp;"}</div>
      <div class="day__title">${title}</div>
      <div class="day__meta">${meta}</div>
    </button>`;
  });

  $("#planejamento").innerHTML = `
    <div class="section">
      ${sectionHead("Semana", "Clique em um dia para ver o passo a passo da refeição.")}
      <div class="week">${dias.join("")}</div>
    </div>

    <div class="section">
      ${sectionHead("Objetivo", "Organizar as refeições da semana considerando:")}
      <div class="card">${bullets(DATA.objetivo)}</div>
      <div class="note"><span>💡</span><span>${esc(DATA.observacao)}</span></div>
    </div>

    <div class="section">
      ${sectionHead("Estratégia geral de preparo", "Trabalhar em três grandes blocos.")}
      <div class="grid grid--3">
        ${DATA.blocos.map((b) => `<div class="card"><div class="letter">${esc(b.letra)}</div><h3>${esc(b.titulo)}</h3><p>${esc(b.descricao)}</p>${chips(b.itens)}</div>`).join("")}
      </div>
    </div>

    <div class="section">
      ${sectionHead("Organização da semana", "Blocos de preparo ao longo da semana.")}
      <div class="grid grid--3">
        ${DATA.semana.map((s, i) => `<div class="card ${i === 0 ? "card--highlight" : ""}"><h3>${esc(s.titulo)}</h3>${chips(s.itens)}${s.nota ? `<p style="margin-top:.9rem">${esc(s.nota)}</p>` : ""}</div>`).join("")}
      </div>
    </div>

    <div class="section">
      ${sectionHead("Organização da geladeira", "Dividir os alimentos em três categorias.")}
      <div class="grid grid--3">
        ${DATA.armazenamento.map((a) => `<div class="card"><h3>${a.icone} ${esc(a.titulo)}</h3>${bullets(a.itens)}</div>`).join("")}
      </div>
    </div>

    <div class="section">
      ${sectionHead("Antes da semana", "Fluxo recomendado.")}
      <div class="card"><div class="checklist">${DATA.antesDaSemana.map((t, i) => checkItem(`antes:${i}`, t)).join("")}</div></div>
    </div>

    <div class="section">
      ${sectionHead("Próxima etapa: quantidades", "Para transformar o planejamento em uma lista definitiva, definir:")}
      <div class="card">${bullets(DATA.proximaEtapa)}</div>
    </div>`;
}

function renderCompras() {
  const cards = DATA.compras.map((c) => {
    const refs = c.refeicoes.map((n) => DATA.refeicoes.find((r) => r.numero === n));
    return `<div class="card shop-card" data-list="${esc(c.id)}">
      <div class="shop-card__head">
        <div><h3>${esc(c.titulo)}</h3><p>${esc(c.quando)} · ${esc(c.descricao)}</p></div>
        <span class="shop-card__icon">${c.icone}</span>
      </div>
      ${refs.length ? `<div class="chips">${refs.map((r) => `<span class="chip">${r.numero}. ${esc(r.resumo)}</span>`).join("")}</div>` : ""}
      <div class="progress"><div class="progress__bar"></div></div>
      <div class="progress__label"></div>
      <div class="checklist">${c.itens.map((item, i) => checkItem(`${c.id}:${i}`, item)).join("")}</div>
      <div style="margin-top:1rem"><button class="btn btn--ghost" data-reset="${esc(c.id)}:">Limpar marcações</button></div>
    </div>`;
  });

  $("#compras").innerHTML = `
    <div class="shop-toolbar">
      ${sectionHead("Lista de compras", "Duas compras para não lotar a geladeira pequena. Marque os itens conforme for comprando.")}
      <button class="btn" data-share>📋 Copiar listas</button>
    </div>
    <div class="grid grid--3">${cards.join("")}</div>`;
  updateProgress();
}

function renderPreparo() {
  const r = DATA.refeicoes.find((x) => x.numero === mealAtual);
  const picker = DATA.refeicoes.map((m) => `<button class="meal-btn ${m.numero === mealAtual ? "is-active" : ""}" data-meal="${m.numero}">Refeição ${m.numero}<small>${DIAS[m.dia]}</small></button>`).join("")
    + `<button class="meal-btn ${mealAtual === 0 ? "is-active" : ""}" data-meal="0">⚡ Preparo paralelo<small>Estratégia</small></button>`;

  if (mealAtual === 0) {
    const p = DATA.paralelo;
    $("#preparo").innerHTML = `
      <div class="meal-picker">${picker}</div>
      <div class="meal-head"><div><div class="eyebrow">Estratégia</div><h2>Preparo paralelo</h2></div></div>
      <div class="grid grid--3" style="margin-top:1.5rem">
        <div class="card card--highlight"><h3>Regra principal</h3><p class="rule">${esc(p.regra)}</p><p style="margin-top:.6rem">${esc(p.dica)}</p></div>
      </div>
      <div class="section">
        ${sectionHead(`Exemplo — ${p.exemplo}`)}
        <div class="timeline">${p.linha.map((l) => `<div class="tl-item card"><h4>${esc(l.tempo)}</h4><div class="tl-cols">
          <div><h5>Na panela</h5>${bullets(l.fazer)}</div>
          ${l.enquanto.length ? `<div><h5>Enquanto isso</h5>${bullets(l.enquanto)}</div>` : ""}
        </div></div>`).join("")}</div>
      </div>`;
    return;
  }

  const steps = r.etapas.map((e, i) => {
    const keys = e.passos.map((_, j) => `ref${r.numero}:${i}:${j}`);
    const done = keys.every((k) => store.get(k));
    return `<details class="step ${done ? "is-done" : ""}" data-step>
      <summary><span class="step__n">${done ? "✓" : i + 1}</span><span class="step__title">${esc(e.titulo)}</span>
        <span class="step__count">${keys.filter((k) => store.get(k)).length}/${keys.length}</span><span class="step__chev">▾</span></summary>
      <div class="step__body">
        ${e.intro ? `<p class="step__intro">${esc(e.intro)}</p>` : ""}
        <div class="checklist">${e.passos.map((p, j) => checkItem(keys[j], p)).join("")}</div>
        ${e.dica ? `<div class="tip">⚠️ ${esc(e.dica)}</div>` : ""}
      </div>
    </details>`;
  });

  $("#preparo").innerHTML = `
    <div class="meal-picker">${picker}</div>
    <div class="meal-head">
      <div><div class="eyebrow">Refeição ${r.numero} · ${DIAS[r.dia]}</div><h2>${esc(r.titulo)}</h2></div>
      <div class="meal-meta">
        <span class="pill">⏱ ~${esc(r.tempo)}</span>
        <span class="pill pill--green">🛒 ${esc(DATA.compras.find((c) => c.id === r.compra).titulo)}</span>
        <span class="pill">❄️ Descongelar ${esc(r.descongelar)} na véspera</span>
      </div>
    </div>
    <div class="meal-layout">
      <aside class="meal-side">
        <div class="card"><h3>🥕 Ingredientes</h3>${chips(r.ingredientes)}</div>
        <div class="card"><h3>🍳 Materiais</h3>${bullets(r.materiais)}</div>
        <div class="card card--highlight"><h3>🍽️ Montagem</h3>${chips(r.montagem, "chips plate")}${r.nota ? `<p style="margin-top:.8rem">${esc(r.nota)}</p>` : ""}</div>
      </aside>
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.8rem;gap:1rem;flex-wrap:wrap">
          <h3 style="font-size:1.1rem">Passo a passo</h3>
          <div style="display:flex;gap:.5rem"><button class="btn btn--ghost" data-expand>Expandir tudo</button><button class="btn btn--ghost" data-reset="ref${r.numero}:">Recomeçar</button></div>
        </div>
        <div class="steps">${steps.join("")}</div>
      </div>
    </div>`;
  const first = [...document.querySelectorAll("#preparo [data-step]")].find((d) => !d.classList.contains("is-done"));
  if (first) first.open = true;
}

function updateProgress() {
  document.querySelectorAll("[data-list]").forEach((card) => {
    const boxes = card.querySelectorAll("input[type=checkbox]");
    const done = [...boxes].filter((b) => b.checked).length;
    const pct = boxes.length ? Math.round((done / boxes.length) * 100) : 0;
    card.querySelector(".progress__bar").style.width = `${pct}%`;
    card.querySelector(".progress").classList.toggle("is-done", pct === 100);
    card.querySelector(".progress__label").textContent = pct === 100 ? "Tudo comprado! 🎉" : `${done} de ${boxes.length} itens`;
  });
}

function updateStep(details) {
  const boxes = [...details.querySelectorAll("input[type=checkbox]")];
  const done = boxes.filter((b) => b.checked).length;
  const all = done === boxes.length;
  details.classList.toggle("is-done", all);
  details.querySelector(".step__count").textContent = `${done}/${boxes.length}`;
  const n = [...details.parentElement.children].indexOf(details) + 1;
  details.querySelector(".step__n").textContent = all ? "✓" : n;
}

function setTab(tab) {
  if (!TABS.includes(tab)) tab = "planejamento";
  TABS.forEach((t) => {
    $(`#${t}`).classList.toggle("is-active", t === tab);
    $(`#tab-${t}`).setAttribute("aria-selected", String(t === tab));
  });
}

function route() {
  const [tab, param] = location.hash.slice(1).split("/");
  if (tab === "preparo" && param !== undefined) {
    const n = Number(param);
    if (n === 0 || DATA.refeicoes.some((r) => r.numero === n)) { mealAtual = n; renderPreparo(); }
  }
  setTab(tab);
}

function listasTexto() {
  return DATA.compras.map((c) => `${c.titulo} (${c.quando})\n${c.itens.map((i) => `- ${i}`).join("\n")}`).join("\n\n");
}

document.addEventListener("change", (e) => {
  const el = e.target;
  if (!el.matches("input[data-key]")) return;
  store.set(el.dataset.key, el.checked);
  updateProgress();
  const details = el.closest("[data-step]");
  if (details) updateStep(details);
});

document.addEventListener("click", async (e) => {
  const t = e.target.closest("[data-tab],[data-meal],[data-goto-meal],[data-goto-tab],[data-reset],[data-expand],[data-share]");
  if (!t) return;
  if (t.dataset.tab) location.hash = t.dataset.tab;
  else if (t.dataset.meal !== undefined) location.hash = `preparo/${t.dataset.meal}`;
  else if (t.dataset.gotoMeal) { location.hash = `preparo/${t.dataset.gotoMeal}`; window.scrollTo({ top: 0 }); }
  else if (t.dataset.gotoTab) location.hash = t.dataset.gotoTab;
  else if (t.dataset.reset) {
    store.clear(t.dataset.reset);
    document.querySelectorAll(`input[data-key^="${t.dataset.reset}"]`).forEach((b) => { b.checked = false; });
    updateProgress();
    document.querySelectorAll("[data-step]").forEach(updateStep);
  } else if (t.dataset.expand !== undefined) {
    const steps = document.querySelectorAll("#preparo [data-step]");
    const open = [...steps].some((s) => !s.open);
    steps.forEach((s) => { s.open = open; });
    t.textContent = open ? "Recolher tudo" : "Expandir tudo";
  } else if (t.dataset.share !== undefined) {
    const texto = listasTexto();
    try {
      if (navigator.share) await navigator.share({ title: "Listas de compras", text: texto });
      else { await navigator.clipboard.writeText(texto); t.textContent = "✅ Copiado!"; setTimeout(() => { t.textContent = "📋 Copiar listas"; }, 2000); }
    } catch (_) { /* compartilhamento cancelado */ }
  }
});

window.addEventListener("hashchange", route);

fetch("data.json")
  .then((r) => r.json())
  .then((data) => {
    DATA = data;
    const hoje = new Date().getDay();
    mealAtual = (DATA.refeicoes.find((r) => r.dia === hoje) || DATA.refeicoes[0]).numero;
    renderToday();
    renderPlanejamento();
    renderCompras();
    renderPreparo();
    route();
  });
