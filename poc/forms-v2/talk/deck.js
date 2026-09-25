(function () {
  const deck = document.getElementById("deck");
  const stage = document.getElementById("stage");
  const slides = Array.from(stage.querySelectorAll(".slide"));
  const cur = document.getElementById("cur");
  const drawer = document.getElementById("drawer");
  const drawerBody = document.getElementById("drawer-body");
  let i = 0;
  let overview = null;

  // ── scale the 1280x720 stage to the viewport ──
  function fit() {
    const drawerH = drawer.hidden ? 0 : drawer.getBoundingClientRect().height;
    const w = window.innerWidth, h = window.innerHeight - drawerH - 28;
    const s = Math.min(w / 1280, h / 720);
    stage.style.setProperty("--s", String(s));
    stage.style.top = drawerH ? `calc(50% - ${drawerH / 2}px)` : "50%";
  }
  window.addEventListener("resize", fit);

  // ── navigation ──
  function show(n, push) {
    i = Math.max(0, Math.min(slides.length - 1, n));
    slides.forEach((s, k) => s.classList.toggle("active", k === i));
    cur.textContent = String(i + 1);
    if (push !== false) history.replaceState(null, "", `#/${i + 1}`);
    renderNotes();
  }
  function fromHash() {
    const m = location.hash.match(/#\/(\d+)/);
    show(m ? parseInt(m[1], 10) - 1 : 0, false);
  }
  window.addEventListener("hashchange", fromHash);

  function renderNotes() {
    if (drawer.hidden) return;
    const notes = slides[i].querySelector(".notes");
    const text = notes ? notes.textContent.trim() : "";
    drawerBody.innerHTML = text
      .split(/\n\s*\n/)
      .map((p) => `<p>${p.replace(/\s*\n\s*/g, " ").replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`)
      .join("");
  }
  function toggleNotes() {
    drawer.hidden = !drawer.hidden;
    try { localStorage.setItem("deck-notes", drawer.hidden ? "0" : "1"); } catch (e) {}
    renderNotes();
    fit();
  }

  function toggleOverview() {
    if (overview) {
      overview.remove(); overview = null; deck.hidden = false; return;
    }
    overview = document.createElement("div");
    overview.className = "overview";
    slides.forEach((s, k) => {
      const t = document.createElement("div");
      t.className = "thumb" + (k === i ? " current" : "");
      const c = s.cloneNode(true);
      c.classList.add("active");
      c.style.transform = "scale(0.2)";
      t.appendChild(c);
      const n = document.createElement("span");
      n.className = "n"; n.textContent = String(k + 1);
      t.appendChild(n);
      t.addEventListener("click", () => { show(k); toggleOverview(); });
      overview.appendChild(t);
    });
    deck.hidden = true;
    document.body.appendChild(overview);
    // thumbs scale with their cell: 0.2 assumes 256px cells; correct after layout
    requestAnimationFrame(() => {
      overview.querySelectorAll(".thumb").forEach((t) => {
        const w = t.getBoundingClientRect().width;
        t.querySelector(".slide").style.transform = `scale(${w / 1280})`;
      });
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    switch (e.key) {
      case "ArrowRight": case "ArrowDown": case " ": case "PageDown": case "Enter":
        e.preventDefault(); if (overview) toggleOverview(); show(i + 1); break;
      case "ArrowLeft": case "ArrowUp": case "PageUp": case "Backspace":
        e.preventDefault(); if (overview) toggleOverview(); show(i - 1); break;
      case "Home": show(0); break;
      case "End": show(slides.length - 1); break;
      case "n": case "N": toggleNotes(); break;
      case "o": case "O": toggleOverview(); break;
      case "f": case "F":
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen?.();
        break;
      case "Escape": if (overview) toggleOverview(); break;
    }
  });
  document.addEventListener("fullscreenchange", () => {
    deck.classList.toggle("fullscreen", !!document.fullscreenElement);
    fit();
  });
  // click right/left third to advance/retreat (touch-friendly)
  stage.addEventListener("click", (e) => {
    if (e.target.closest("a, button, .frame")) return;
    const x = e.clientX / window.innerWidth;
    if (x > 0.66) show(i + 1); else if (x < 0.2) show(i - 1);
  });

  // ── syntax highlighting: small, predictable, no CDN ──
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const span = (cls, t) => (cls ? `<span class="tk-${cls}">${esc(t)}</span>` : esc(t));
  const KW = /^(?:const|let|var|function|return|import|from|export|type|interface|null|undefined|true|false|new|if|else|await|async|as|extends|typeof)\b/;

  function tokTsx(src) {
    let out = "", i = 0;
    const stack = []; // "tag" | {expr depth}
    const top = () => stack[stack.length - 1];
    while (i < src.length) {
      const rest = src.slice(i);
      let m;
      if ((m = rest.match(/^(?:\/\/.*|\/\*[\s\S]*?\*\/)/))) { out += span("com", m[0]); i += m[0].length; continue; }
      if ((m = rest.match(/^(?:"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)/))) { out += span("str", m[0]); i += m[0].length; continue; }
      const t = top();
      if (t === "tag") {
        if ((m = rest.match(/^\/?>/))) { out += span("punc", m[0]); stack.pop(); i += m[0].length; continue; }
        if ((m = rest.match(/^[A-Za-z_$][\w$-]*/))) { out += span("attr", m[0]); i += m[0].length; continue; }
        if (rest[0] === "{") { out += span("punc", "{"); stack.push({ d: 0 }); i++; continue; }
        if ((m = rest.match(/^(?:\.\.\.|=|\s+)/))) { out += span(m[0] === "=" || m[0] === "..." ? "punc" : null, m[0]); i += m[0].length; continue; }
        out += esc(rest[0]); i++; continue;
      }
      // code, or an expression inside a tag / between tags
      const prev = out.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trimEnd().slice(-1);
      if ((m = rest.match(/^<\/[A-Za-z][\w.]*\s*>/))) { out += span("punc", "</") + span("tag", m[0].slice(2, -1).trim()) + span("punc", ">"); i += m[0].length; continue; }
      if ((m = rest.match(/^<\/?>/))) { out += span("punc", m[0]); i += m[0].length; continue; }
      if ((m = rest.match(/^<[A-Za-z][\w.]*/)) && !/[\w)\]]/.test(prev)) {
        out += span("punc", "<") + span("tag", m[0].slice(1)); stack.push("tag"); i += m[0].length; continue;
      }
      if (rest[0] === "{") { if (t && typeof t === "object") t.d++; out += span("punc", "{"); i++; continue; }
      if (rest[0] === "}") {
        if (t && typeof t === "object") { if (t.d === 0) stack.pop(); else t.d--; }
        out += span("punc", "}"); i++; continue;
      }
      if ((m = rest.match(KW))) { out += span("kw", m[0]); i += m[0].length; continue; }
      if ((m = rest.match(/^\d+(?:\.\d+)?\b/))) { out += span("num", m[0]); i += m[0].length; continue; }
      if ((m = rest.match(/^[A-Za-z_$][\w$]*/))) { out += esc(m[0]); i += m[0].length; continue; }
      if ((m = rest.match(/^(?:=>|\.\.\.|[=(){}[\];,.:?|&<>!+\-*/])/))) { out += span("punc", m[0]); i += m[0].length; continue; }
      out += esc(rest[0]); i++;
    }
    return out;
  }

  function tokJson(src) {
    return src.replace(
      /("(?:[^"\\]|\\.)*")(\s*:)|("(?:[^"\\]|\\.)*")|(\b-?\d+(?:\.\d+)?\b)|\b(true|false|null)\b|([{}[\],])/g,
      (all, key, colon, str, num, lit, punc) => {
        if (key) return span("key", key) + span("punc", colon);
        if (str) return span("str", str);
        if (num) return span("num", num);
        if (lit) return span("kw", lit);
        if (punc) return span("punc", punc);
        return esc(all);
      },
    );
  }
  // tokJson escapes inside span(); the untouched remainder needs escaping too
  function highlightJson(src) {
    let out = "", last = 0;
    const re = /("(?:[^"\\]|\\.)*")(\s*:)|("(?:[^"\\]|\\.)*")|(\b-?\d+(?:\.\d+)?\b)|\b(true|false|null)\b|([{}[\],])/g;
    let m;
    while ((m = re.exec(src))) {
      out += esc(src.slice(last, m.index));
      out += tokJson(m[0]);
      last = m.index + m[0].length;
    }
    return out + esc(src.slice(last));
  }

  document.querySelectorAll("pre.code").forEach((pre) => {
    const code = pre.querySelector("code");
    const src = code.textContent;
    code.innerHTML = pre.dataset.lang === "json" ? highlightJson(src) : tokTsx(src);
  });

  // ── boot ──
  try { if (localStorage.getItem("deck-notes") === "1") drawer.hidden = false; } catch (e) {}
  fromHash();
  fit();
})();
