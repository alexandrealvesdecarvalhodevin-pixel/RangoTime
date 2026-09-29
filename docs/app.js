const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const STORE_KEY = "planejamento-semanal:v1";
const TABS = ["planejamento", "compras", "preparo"];

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

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
let listaAtual = "compra1";
let tabAtual = null;
const HOJE = new Date().getDay();

const chips = (items, cls = "chips") => `<div class="${cls}">${items.map((i) => `<span class="chip">${esc(i)}</span>`).join("")}</div>`;
const bullets = (items) => `<ul class="bullets">${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
const sectionTitle = (title, aside = "") => `<div class="section__title"><h2>${esc(title)}</h2>${aside ? `<span>${esc(aside)}</span>` : ""}</div>`;
const checkItem = (key, label) => `<label class="check"><input type="checkbox" data-key="${esc(key)}" ${store.get(key) ? "checked" : ""}><span>${esc(label)}</span></label>`;
const compraDoDia = (d) => DATA.compras.find((c) => c.id !== "despensa" && c.dia === d);
const refeicaoDoDia = (d) => DATA.refeicoes.find((r) => r.dia === d);
const compraDaSemana = (d) => (d === 0 || d < DATA.compras.find((c) => c.id === "compra2").dia ? "compra1" : "compra2");

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("is-visible");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove("is-visible"), 2200);
}

function renderHoje() {
  const refHoje = refeicaoDoDia(HOJE);
  const refAmanha = refeicaoDoDia((HOJE + 1) % 7);
  const compraHoje = compraDoDia(HOJE);
  let hero;
  if (refHoje) {
    hero = `<div class="hero" id="today">
      <div class="eyebrow">Hoje · Refeição ${refHoje.numero}</div>
      <h2>${esc(refHoje.resumo)}</h2>
      <div class="pills"><span class="pill">⏱ ~${esc(refHoje.tempo)}</span><span class="pill">${refHoje.etapas.length} etapas</span></div>
      <button class="hero__cta" data-goto-meal="${refHoje.numero}">Começar preparo →</button>
    </div>`;
  } else if (compraHoje) {
    hero = `<div class="hero" id="today">
      <div class="eyebrow">Hoje · Dia de compras</div>
      <h2>${esc(compraHoje.titulo)} · ${esc(compraHoje.descricao)}</h2>
      <div class="pills"><span class="pill">🛒 ${compraHoje.itens.length} itens</span></div>
      <button class="hero__cta" data-goto-list="${compraHoje.id}">Abrir lista →</button>
    </div>`;
  } else {
    hero = `<div class="hero" id="today"><div class="eyebrow">Hoje</div><h2>Dia livre! Aproveite para conferir o que tem em casa antes da Compra 1.</h2></div>`;
  }
  const alertas = [];
  if (compraHoje && refHoje) {
    alertas.push(`<button class="alert alert--green" data-goto-list="${compraHoje.id}"><span class="card__icon">🛒</span><div><strong>Dia da ${esc(compraHoje.titulo)}</strong><p>${compraHoje.itens.length} itens · ${esc(compraHoje.descricao)}</p></div><span class="chev">›</span></button>`);
  }
  if (refAmanha) {
    alertas.push(`<button class="alert alert--orange" data-goto-meal="${refAmanha.numero}"><span class="card__icon">❄️</span><div><strong>Descongelar ${esc(refAmanha.descongelar)}</strong><p>Passe do freezer para a geladeira hoje para a Refeição ${refAmanha.numero} de amanhã.</p></div><span class="chev">›</span></button>`);
  }
  return hero + alertas.join("");
}

function renderPlanejamento() {
  const dias = [1, 2, 3, 4, 5, 6, 0].map((d) => {
    const ref = refeicaoDoDia(d);
    const compra = compraDoDia(d);
    const cls = ["day", d === HOJE ? "is-today" : "", compra && !ref ? "day--shop" : ""].join(" ");
    const meta = [
      compra ? `<span class="pill pill--green">🛒 ${esc(compra.titulo)}</span>` : "",
      ref ? `<span class="pill">⏱ ${esc(ref.tempo)}</span>` : "",
    ].join("");
    const title = ref ? esc(ref.resumo) : compra ? "Fazer a compra e organizar a geladeira" : "Livre";
    const attrs = ref ? `data-goto-meal="${ref.numero}"` : compra ? `data-goto-list="${compra.id}"` : "";
    return `<button class="${cls}" data-dia="${d}" ${attrs}>
      <div class="day__name">${DIAS[d]}${d === HOJE ? " · hoje" : ""}</div>
      <div class="day__num">${ref ? `Refeição ${ref.numero}` : "&nbsp;"}</div>
      <div class="day__title">${title}</div>
      <div class="day__meta">${meta}</div>
    </button>`;
  });

  $("#planejamento").innerHTML = `
    <h1 class="large-title">Sua <span class="grad">semana</span></h1>
    <p class="subtitle">${esc(DATA.titulo)}</p>
    ${renderHoje()}

    <div class="section">
      ${sectionTitle("Cardápio", "deslize →")}
      <div class="carousel" id="week">${dias.join("")}</div>
    </div>

    <div class="section">
      ${sectionTitle("Estratégia de preparo", "3 blocos")}
      <div class="carousel carousel--wide">
        ${DATA.blocos.map((b) => `<div class="card"><div class="letter">${esc(b.letra)}</div><h3>${esc(b.titulo)}</h3><p>${esc(b.descricao)}</p>${chips(b.itens)}</div>`).join("")}
      </div>
    </div>

    <div class="section">
      ${sectionTitle("Organização da semana")}
      ${DATA.semana.map((s, i) => `<div class="card ${i === 0 ? "card--accent" : ""}"><div class="eyebrow">Bloco ${i + 1}</div><h3>${esc(s.titulo)}</h3>${chips(s.itens)}${s.nota ? `<p style="margin-top:10px">${esc(s.nota)}</p>` : ""}</div>`).join("")}
    </div>

    <div class="section">
      ${sectionTitle("Onde guardar")}
      ${DATA.armazenamento.map((a, i) => `<details class="card" ${i === 0 ? "open" : ""}><summary><div class="card-row"><span class="card__icon">${a.icone}</span><div><h3>${esc(a.titulo)}</h3><p>${a.itens.length} itens</p></div></div><span class="step__chev">▾</span></summary>${bullets(a.itens)}</details>`).join("")}
    </div>

    <div class="section">
      ${sectionTitle("Antes da semana", `${DATA.antesDaSemana.length} passos`)}
      <div class="list">${DATA.antesDaSemana.map((t, i) => checkItem(`antes:${i}`, t)).join("")}</div>
    </div>

    <div class="section">
      ${sectionTitle("Objetivo")}
      <div class="card">${bullets(DATA.objetivo)}</div>
      <div class="note"><span>💡</span><span>${esc(DATA.observacao)}</span></div>
    </div>

    <div class="section">
      ${sectionTitle("Próxima etapa: quantidades")}
      <div class="card"><p style="margin-bottom:6px">Para transformar o planejamento em uma lista definitiva, definir:</p>${bullets(DATA.proximaEtapa)}</div>
    </div>`;
}

function renderCompras() {
  const seg = DATA.compras.map((c) => `<button class="seg__btn ${c.id === listaAtual ? "is-active" : ""}" data-list-btn="${esc(c.id)}">${esc(c.titulo)}<small>${esc(c.quando)}</small></button>`).join("");
  const c = DATA.compras.find((x) => x.id === listaAtual);
  const refs = c.refeicoes.map((n) => DATA.refeicoes.find((r) => r.numero === n));

  $("#compras").innerHTML = `
    <h1 class="large-title">Compras</h1>
    <p class="subtitle">Duas compras para não lotar a geladeira pequena.</p>
    <div class="seg" role="group" aria-label="Listas">${seg}</div>

    <div class="card card--accent" style="margin-top:14px" data-list="${esc(c.id)}">
      <div class="card-row">
        <span class="card__icon">${c.icone}</span>
        <div><h3>${esc(c.titulo)}</h3><p>${esc(c.quando)} · ${esc(c.descricao)}</p></div>
      </div>
      <div class="progress"><div class="progress__bar"></div></div>
      <div class="progress__label"></div>
    </div>

    ${refs.length ? `<div class="section" style="margin-top:18px">${sectionTitle("Para as refeições")}<div class="carousel">${refs.map((r) => `<button class="meal-card" data-goto-meal="${r.numero}"><span class="meal-card__n">Refeição ${r.numero}</span><span class="meal-card__t">${esc(r.resumo)}</span><span class="meal-card__d">${DIAS[r.dia]}</span></button>`).join("")}</div></div>` : ""}

    <div class="section" style="margin-top:18px">
      ${sectionTitle("Itens", `${c.itens.length} itens`)}
      <div class="list" data-list-items="${esc(c.id)}">${c.itens.map((item, i) => checkItem(`${c.id}:${i}`, item)).join("")}</div>
    </div>

    <div class="actions">
      <button class="btn btn--ghost" data-reset="${esc(c.id)}:">Limpar</button>
      <button class="btn" data-share>Compartilhar</button>
    </div>`;
  updateProgress();
}

function renderMealPicker() {
  const cards = DATA.refeicoes.map((m) => `<button class="meal-card ${m.numero === mealAtual ? "is-active" : ""}" data-meal="${m.numero}">
      <span class="meal-card__n">Refeição ${m.numero}</span>
      <span class="meal-card__t">${esc(m.resumo)}</span>
      <span class="meal-card__d">${DIAS[m.dia]}${m.dia === HOJE ? " · hoje" : ""} · ${esc(m.tempo)}</span>
    </button>`);
  cards.push(`<button class="meal-card ${mealAtual === 0 ? "is-active" : ""}" data-meal="0">
      <span class="meal-card__n">⚡ Estratégia</span>
      <span class="meal-card__t">Preparo paralelo</span>
      <span class="meal-card__d">Como ganhar tempo</span>
    </button>`);
  return `<div class="carousel" id="meal-picker">${cards.join("")}</div>`;
}

function renderPreparo() {
  const head = `<h1 class="large-title">Preparo</h1>${renderMealPicker()}`;

  if (mealAtual === 0) {
    const p = DATA.paralelo;
    $("#preparo").innerHTML = `${head}
      <div class="meal-title"><div class="eyebrow">Estratégia</div><h2>Preparo paralelo</h2></div>
      <div class="card card--accent"><h3>Regra principal</h3><p style="color:var(--text);font-weight:600">${esc(p.regra)}</p><p style="margin-top:6px">${esc(p.dica)}</p></div>
      <div class="section">
        ${sectionTitle(`Exemplo · ${p.exemplo}`)}
        <div class="timeline">${p.linha.map((l) => `<div class="tl-item card"><h4>${esc(l.tempo)}</h4>
          <h5>Na panela</h5>${bullets(l.fazer)}
          ${l.enquanto.length ? `<h5>Enquanto isso</h5>${bullets(l.enquanto)}` : ""}
        </div>`).join("")}</div>
      </div>`;
    scrollPickerToActive();
    return;
  }

  const r = DATA.refeicoes.find((x) => x.numero === mealAtual);
  const steps = r.etapas.map((e, i) => {
    const keys = e.passos.map((_, j) => `ref${r.numero}:${i}:${j}`);
    const done = keys.every((k) => store.get(k));
    return `<details class="step ${done ? "is-done" : ""}" data-step>
      <summary><span class="step__n">${done ? "✓" : i + 1}</span><span class="step__title">${esc(e.titulo)}</span>
        <span class="step__count">${keys.filter((k) => store.get(k)).length}/${keys.length}</span><span class="step__chev">▾</span></summary>
      <div class="step__body">
        ${e.intro ? `<p class="step__intro">${esc(e.intro)}</p>` : ""}
        ${e.passos.map((p, j) => checkItem(keys[j], p)).join("")}
        ${e.dica ? `<div class="tip">⚠️ ${esc(e.dica)}</div>` : ""}
      </div>
    </details>`;
  });

  $("#preparo").innerHTML = `${head}
    <div class="meal-title">
      <div class="eyebrow">Refeição ${r.numero} · ${DIAS[r.dia]}</div>
      <h2>${esc(r.titulo)}</h2>
      <div class="pills">
        <span class="pill">⏱ ~${esc(r.tempo)}</span>
        <span class="pill pill--green">🛒 ${esc(DATA.compras.find((c) => c.id === r.compra).titulo)}</span>
        <span class="pill pill--orange">❄️ Descongelar ${esc(r.descongelar)} na véspera</span>
      </div>
    </div>

    <details class="card" style="margin-top:16px" open><summary><div class="card-row"><span class="card__icon">🥕</span><div><h3>Ingredientes</h3><p>${r.ingredientes.length} itens</p></div></div><span class="step__chev">▾</span></summary>${chips(r.ingredientes)}</details>
    <details class="card"><summary><div class="card-row"><span class="card__icon">🍳</span><div><h3>Materiais</h3><p>${r.materiais.length} itens</p></div></div><span class="step__chev">▾</span></summary>${bullets(r.materiais)}</details>
    <details class="card"><summary><div class="card-row"><span class="card__icon">🍽️</span><div><h3>Montagem do prato</h3><p>${r.montagem.length} itens</p></div></div><span class="step__chev">▾</span></summary>${chips(r.montagem, "chips chips--plate")}${r.nota ? `<p style="margin-top:10px">${esc(r.nota)}</p>` : ""}</details>

    <div class="stepbar">
      <h2>Passo a passo</h2>
      <div class="stepbar__btns"><button class="btn btn--ghost btn--sm" data-expand>Expandir</button><button class="btn btn--ghost btn--sm" data-reset="ref${r.numero}:">Recomeçar</button></div>
    </div>
    <div class="steps">${steps.join("")}</div>`;
  const first = $$("#preparo [data-step]").find((d) => !d.classList.contains("is-done"));
  if (first) first.open = true;
  scrollPickerToActive();
}

function scrollPickerToActive() {
  const picker = $("#meal-picker");
  const active = picker && $(".is-active", picker);
  if (active) picker.scrollLeft = active.offsetLeft - picker.offsetLeft - 16;
}

function updateProgress() {
  $$("[data-list]").forEach((card) => {
    const boxes = $$(`[data-list-items="${card.dataset.list}"] input[type=checkbox]`);
    const done = boxes.filter((b) => b.checked).length;
    const pct = boxes.length ? Math.round((done / boxes.length) * 100) : 0;
    $(".progress__bar", card).style.width = `${pct}%`;
    $(".progress", card).classList.toggle("is-done", pct === 100);
    $(".progress__label", card).textContent = pct === 100 ? "Tudo comprado! 🎉" : `${done} de ${boxes.length} itens`;
  });
  updateBadge();
}

function updateBadge() {
  const badge = $("#badge-compras");
  const compra = compraDoDia(HOJE);
  const faltam = compra ? compra.itens.filter((_, i) => !store.get(`${compra.id}:${i}`)).length : 0;
  badge.hidden = !faltam;
  badge.textContent = faltam;
  $("#tab-compras").setAttribute("aria-label", faltam ? `Compras, ${faltam} itens pendentes` : "Compras");
}

function updateStep(details) {
  const boxes = $$("input[type=checkbox]", details);
  const done = boxes.filter((b) => b.checked).length;
  const all = done === boxes.length;
  details.classList.toggle("is-done", all);
  $(".step__count", details).textContent = `${done}/${boxes.length}`;
  const n = [...details.parentElement.children].indexOf(details) + 1;
  $(".step__n", details).textContent = all ? "✓" : n;
}

function setTab(tab) {
  if (!TABS.includes(tab)) tab = "planejamento";
  TABS.forEach((t) => {
    $(`#${t}`).classList.toggle("is-active", t === tab);
    $(`#tab-${t}`).setAttribute("aria-selected", String(t === tab));
  });
  tabAtual = tab;
}

function route() {
  const [tab, param] = location.hash.slice(1).split("/");
  const anterior = tabAtual;
  if (tab === "preparo" && param !== undefined) {
    const n = Number(param);
    if (param !== "" && (n === 0 || DATA.refeicoes.some((r) => r.numero === n)) && n !== mealAtual) { mealAtual = n; renderPreparo(); }
  }
  if (tab === "compras" && param && param !== listaAtual && DATA.compras.some((c) => c.id === param)) {
    listaAtual = param;
    renderCompras();
  }
  setTab(tab);
  if (anterior !== tabAtual) window.scrollTo({ top: 0 });
}

function listasTexto() {
  return DATA.compras.map((c) => `${c.titulo} (${c.quando})\n${c.itens.map((i, n) => `${store.get(`${c.id}:${n}`) ? "✔" : "-"} ${i}`).join("\n")}`).join("\n\n");
}

document.addEventListener("change", (e) => {
  const el = e.target;
  if (!el.matches("input[data-key]")) return;
  store.set(el.dataset.key, el.checked);
  if (navigator.vibrate) navigator.vibrate(8);
  updateProgress();
  const details = el.closest("[data-step]");
  if (details) updateStep(details);
});

document.addEventListener("click", async (e) => {
  const t = e.target.closest("[data-tab],[data-meal],[data-goto-meal],[data-goto-list],[data-list-btn],[data-reset],[data-expand],[data-share]");
  if (!t) return;
  if (t.dataset.tab) {
    if (tabAtual === t.dataset.tab) window.scrollTo({ top: 0, behavior: "smooth" });
    location.hash = t.dataset.tab === "preparo" ? `preparo/${mealAtual}` : t.dataset.tab === "compras" ? `compras/${listaAtual}` : t.dataset.tab;
  } else if (t.dataset.meal !== undefined) location.hash = `preparo/${t.dataset.meal}`;
  else if (t.dataset.gotoMeal) { location.hash = `preparo/${t.dataset.gotoMeal}`; window.scrollTo({ top: 0 }); }
  else if (t.dataset.gotoList) { location.hash = `compras/${t.dataset.gotoList}`; window.scrollTo({ top: 0 }); }
  else if (t.dataset.listBtn) location.hash = `compras/${t.dataset.listBtn}`;
  else if (t.dataset.reset) {
    store.clear(t.dataset.reset);
    $$(`input[data-key^="${t.dataset.reset}"]`).forEach((b) => { b.checked = false; });
    updateProgress();
    $$("[data-step]").forEach(updateStep);
    toast("Marcações limpas");
  } else if (t.dataset.expand !== undefined) {
    const steps = $$("#preparo [data-step]");
    const open = steps.some((s) => !s.open);
    steps.forEach((s) => { s.open = open; });
    t.textContent = open ? "Recolher" : "Expandir";
  } else if (t.dataset.share !== undefined) {
    const texto = listasTexto();
    try {
      if (navigator.share) await navigator.share({ title: "Listas de compras · RangoTime", text: texto });
      else { await navigator.clipboard.writeText(texto); toast("Listas copiadas!"); }
    } catch (_) { /* compartilhamento cancelado */ }
  }
});

window.addEventListener("hashchange", route);

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

fetch("data.json")
  .then((r) => r.json())
  .then((data) => {
    DATA = data;
    $("#appbar-day").textContent = DIAS[HOJE];
    mealAtual = (refeicaoDoDia(HOJE) || DATA.refeicoes[0]).numero;
    listaAtual = compraDaSemana(HOJE);
    renderPlanejamento();
    renderCompras();
    renderPreparo();
    route();
  });
