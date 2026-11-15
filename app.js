(() => {
  const S = window.SITE || {};
  const reduzir = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const celular = matchMedia("(max-width: 760px)").matches;


  /* ── Rolagem que toca o vídeo ─────────────────────────────────────────── */
  const cine = document.querySelector(".cine");
  const canvas = cine && cine.querySelector(".cine-canvas");
  if (cine && canvas && S.frames && S.frames.total) {
    const ctx = canvas.getContext("2d");
    const total = S.frames.total;
    const padrao = celular ? S.frames.mobile : S.frames.desktop;
    const src = (i) => padrao.replace("{n}", String(i + 1).padStart(4, "0"));
    const quadros = new Array(total);
    const momentos = [...cine.querySelectorAll(".momento")];
    let alvo = 0, atual = 0, desenhado = -1;

    const carregar = (i) => {
      if (quadros[i]) return quadros[i];
      const img = new Image();
      img.decoding = "async";
      img.src = src(i);
      img.onload = () => { if (Math.round(atual) === i || desenhado === -1) desenhar(i, true); };
      return (quadros[i] = img);
    };

    // Carrega em passadas (1 a cada 8, depois 1 a cada 4…) para cobrir o filme inteiro cedo
    carregar(0);
    if (!reduzir) {
      const fila = [];
      for (const passo of [8, 4, 2, 1]) for (let i = 0; i < total; i += passo) if (!fila.includes(i)) fila.push(i);
      let k = 0;
      const lote = () => { for (let n = 0; n < 6 && k < fila.length; n++) carregar(fila[k++]); if (k < fila.length) setTimeout(lote, 40); };
      lote();
    }

    const pronto = (i) => quadros[i] && quadros[i].complete && quadros[i].naturalWidth;
    const maisProximo = (i) => {
      for (let d = 0; d < total; d++) {
        if (pronto(i - d)) return i - d;
        if (pronto(i + d)) return i + d;
      }
      return -1;
    };

    const ajustar = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      desenhado = -1;
      desenhar(Math.round(atual), true);
    };

    function desenhar(i, forcar) {
      const j = maisProximo(i);
      if (j < 0 || (j === desenhado && !forcar)) return;
      const img = quadros[j];
      const cw = canvas.width, ch = canvas.height;
      const escala = Math.max(cw / img.naturalWidth, ch / img.naturalHeight); // "cover"
      const w = img.naturalWidth * escala, h = img.naturalHeight * escala;
      ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
      desenhado = j;
    }

    const progresso = () => {
      const r = cine.getBoundingClientRect();
      const curso = cine.offsetHeight - innerHeight;
      return Math.min(1, Math.max(0, -r.top / (curso || 1)));
    };

    const atualizarMomentos = (p) => {
      for (const m of momentos) {
        const de = parseFloat(m.dataset.de || 0), ate = parseFloat(m.dataset.ate || 1);
        m.classList.toggle("ativo", p >= de && (p < ate || (ate >= 1 && p >= 1)));
      }
      cine.classList.toggle("andou", p > 0.02);
    };

    const quadro = () => {
      alvo = progresso() * (total - 1);
      atual += (alvo - atual) * 0.18; // suaviza: sensação de filme, não de slide
      if (Math.abs(alvo - atual) < 0.05) atual = alvo;
      desenhar(Math.round(atual));
      atualizarMomentos(atual / (total - 1));
      requestAnimationFrame(quadro);
    };

    addEventListener("resize", ajustar);
    ajustar();
    if (reduzir) atualizarMomentos(0);
    else requestAnimationFrame(quadro);
  }

  /* ── Parallax leve nas artes ──────────────────────────────────────────── */
  const artes = reduzir ? [] : [...document.querySelectorAll(".arte")];
  if (artes.length) {
    const mover = () => {
      for (const a of artes) {
        const r = a.parentElement.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight) continue;
        const c = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
        a.style.transform = `translate3d(0, ${(c * -60).toFixed(1)}px, 0) scale(1.08)`;
      }
    };
    addEventListener("scroll", () => requestAnimationFrame(mover), { passive: true });
    mover();
  }

  /* ── Topo, revelar e ano ──────────────────────────────────────────────── */
  const topo = document.querySelector(".topo");
  const whats = document.querySelector(".whats");
  let formNaTela = false; // o botão flutuante se recolhe para não cobrir o "Enviar"
  const aoRolar = () => {
    topo && topo.classList.toggle("rolou", scrollY > 40);
    whats && whats.classList.toggle("visivel", scrollY > innerHeight * 0.6 && !formNaTela);
  };
  const formEl = document.querySelector(".form");
  if (formEl) new IntersectionObserver(([e]) => { formNaTela = e.isIntersecting; aoRolar(); }).observe(formEl);
  addEventListener("scroll", aoRolar, { passive: true });
  aoRolar();

  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("visto"); io.unobserve(e.target); }
  }), { threshold: 0.18 });
  document.querySelectorAll(".revelar").forEach((el) => io.observe(el));
  document.querySelectorAll("[data-ano]").forEach((el) => (el.textContent = new Date().getFullYear()));

  /* ── Conteúdo editável (Pages CMS → data/*.json) ──────────────────────── */
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const negrito = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  const caminho = (u) => String(u || "").replace(/^\/+/, ""); // o site vive em /cakes-by-luna/: caminho relativo
  const visivel = (x) => x && x.visible !== false;
  const carregarJSON = (url) => fetch(url, { cache: "no-cache" }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
  const pronto = (el) => el && el.removeAttribute("aria-busy");
  const falhou = (el, e) => {
    console.warn("Content failed to load:", e);
    if (el) { pronto(el); el.innerHTML = '<p class="cms-aviso">We couldn\'t load this section. Please message us on WhatsApp.</p>'; }
  };

  const elMenu = document.querySelector('[data-cms="menu"]');
  if (elMenu) carregarJSON("data/menu.json").then((d) => {
    const nota = document.querySelector('[data-cms="menu-nota"]');
    if (nota && d.nota) nota.textContent = d.nota;
    elMenu.innerHTML = (d.categorias || []).map((c) => {
      const itens = (c.productos || []).filter(visivel);
      if (!itens.length) return "";
      return `<div class="painel cardapio revelar"><h3 class="cardapio-titulo">${esc(c.titulo)}</h3><ul class="ofertas">${itens.map((p) => {
        const preco = String(p.precio || "").trim()
          ? `<span class="oferta-preco">${esc(p.precio)}${p.unidad ? ` <small>${esc(p.unidad)}</small>` : ""}</span>`
          : `<span class="oferta-preco oferta-preco--consulta">Ask for price</span>`;
        return `<li class="oferta"><div class="oferta-barra"><span class="oferta-nome">${esc(p.nombre)}${p.detalle ? ` <small>${esc(p.detalle)}</small>` : ""}</span>${preco}</div>${p.descripcion ? `<p>${negrito(p.descripcion)}</p>` : ""}</li>`;
      }).join("")}</ul></div>`;
    }).join("");
    pronto(elMenu);
    elMenu.querySelectorAll(".revelar").forEach((el) => io.observe(el));
  }).catch((e) => falhou(elMenu, e));

  const elGaleria = document.querySelector('[data-cms="galeria"]');
  if (elGaleria) carregarJSON("data/galeria.json").then((d) => {
    elGaleria.innerHTML = (d.fotos || []).filter((f) => visivel(f) && f.imagen).map((f) =>
      `<li><figure><img src="${esc(caminho(f.imagen))}" alt="${esc(f.descripcion || f.titulo)}" width="720" height="900" loading="lazy" decoding="async"><figcaption>${esc(f.titulo)}</figcaption></figure></li>`
    ).join("");
    pronto(elGaleria);
  }).catch((e) => falhou(elGaleria, e));

  const elSabores = document.querySelector('[data-cms="sabores"]');
  const elRellenos = document.querySelector('[data-cms="rellenos"]');
  if (elSabores || elRellenos) carregarJSON("data/sabores.json").then((d) => {
    const lista = (arr) => (arr || []).filter((x) => String(x || "").trim()).map((x) => `<li>${esc(x)}</li>`).join("");
    if (elSabores) elSabores.innerHTML = lista(d.sabores);
    if (elRellenos) elRellenos.innerHTML = lista(d.rellenos);
  }).catch((e) => falhou(elSabores, e));

  /* ── WhatsApp ─────────────────────────────────────────────────────────── */
  if (whats && S.whatsapp) {
    const num = String(S.whatsapp.numero || "").replace(/\D/g, "");
    whats.href = `https://wa.me/${num}?text=${encodeURIComponent(S.whatsapp.mensagem || "")}`;
  }

  /* ── Formulário → e-mail ──────────────────────────────────────────────── */
  const form = document.querySelector(".form");
  if (form && S.contato) {
    const status = form.querySelector(".form-status");
    const botao = form.querySelector("button[type=submit]");
    const avisar = (txt, tipo) => { status.textContent = txt; status.className = `form-status campo--inteiro ${tipo || ""}`; };

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      if (form.elements._honey.value) return; // robô
      let valido = true;
      form.querySelectorAll("[required]").forEach((c) => {
        const ok = c.type === "email" ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.value) : c.value.trim().length > 1;
        c.closest(".campo").classList.toggle("erro", !ok);
        if (!ok) valido = false;
      });
      if (!valido) return avisar("Please check the highlighted fields.", "falha");

      const dados = Object.fromEntries(new FormData(form));
      delete dados._honey;
      const assunto = S.contato.assunto || `New inquiry from ${S.nome || "the website"}`;
      let url, corpo;
      if (S.contato.web3formsChave) {
        url = "https://api.web3forms.com/submit";
        corpo = { access_key: S.contato.web3formsChave, subject: assunto, from_name: S.nome, ...dados };
      } else {
        url = `https://formsubmit.co/ajax/${encodeURIComponent(S.contato.email)}`;
        corpo = { _subject: assunto, _template: "table", _captcha: "false", ...dados };
      }

      botao.disabled = true;
      avisar("Sending…");
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(corpo),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || j.success === false || j.success === "false") throw new Error(j.message || r.status);
        form.reset();
        avisar("Thank you! We got your message and will be in touch soon.", "ok");
      } catch (e) {
        console.warn("Form submission failed:", e);
        avisar("We couldn't send it right now. Please message us on WhatsApp.", "falha");
      } finally {
        botao.disabled = false;
      }
    });
  }

  /* ── Menu móvel ───────────────────────────────────────────────────────── */
  const cabecalho = document.querySelector(".topo");
  const botaoMenu = document.querySelector(".menu-botao");
  const painelMenu = document.getElementById("menu-movel");
  if (cabecalho && botaoMenu && painelMenu) {
    const definir = (aberto) => {
      cabecalho.classList.toggle("menu-aberto", aberto);
      botaoMenu.setAttribute("aria-expanded", String(aberto));
      botaoMenu.setAttribute("aria-label", aberto ? "Close menu" : "Open menu");
    };
    const aberto = () => cabecalho.classList.contains("menu-aberto");
    botaoMenu.addEventListener("click", () => definir(!aberto()));
    painelMenu.addEventListener("click", (e) => { if (e.target.closest("a")) definir(false); });
    document.addEventListener("click", (e) => { if (aberto() && !cabecalho.contains(e.target)) definir(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && aberto()) { definir(false); botaoMenu.focus(); } });
    matchMedia("(min-width: 761px)").addEventListener("change", (e) => { if (e.matches) definir(false); });
  }
})();
