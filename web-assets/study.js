(() => {
  const layout = document.querySelector(".reader-layout");
  if (layout) {
    const menu = layout.querySelector(".reader-menu");
    const select = layout.querySelector("[data-reading-size]");
    const sizeKey = "on-thi-21-ngay:co-chu";
    const narrow = matchMedia("(max-width: 56rem)");
    menu.open = !narrow.matches;
    narrow.addEventListener("change", () => { menu.open = !narrow.matches; });
    try {
      const size = localStorage.getItem(sizeKey);
      if (["small", "normal", "large"].includes(size)) select.value = size;
    } catch { /* The control also works without storage. */ }
    layout.dataset.size = select.value;
    select.addEventListener("change", () => {
      layout.dataset.size = select.value;
      try { localStorage.setItem(sizeKey, select.value); } catch { /* Size applies to this page. */ }
    });
    const links = [...menu.querySelectorAll("nav a")];
    menu.addEventListener("click", event => {
      if (narrow.matches && event.target.closest("a")) menu.open = false;
    });
    function markSection() {
      const target = document.getElementById(location.hash.slice(1));
      const section = target?.closest(".chapter-subsection");
      const activeHash = section ? "#" + section.id : location.hash;
      for (const item of links) {
        if (item.hash === activeHash) item.setAttribute("aria-current", "location");
        else item.removeAttribute("aria-current");
      }
    }
    const panel = layout.querySelector("[data-notebook]");
    if (panel) {
      const toggle = layout.querySelector("[data-notebook-toggle]");
      const sections = [...layout.querySelectorAll(".chapter-subsection")];
      const notes = [...panel.querySelectorAll("[data-note-number]")];
      const storageKey = "on-thi-21-ngay:so-tay:v1:" + panel.dataset.notebook;
      let unlocked = 0;
      try {
        const stored = Number(localStorage.getItem(storageKey));
        if (Number.isInteger(stored)) unlocked = Math.max(0, Math.min(notes.length, stored));
      } catch { /* The notebook also works for the current visit. */ }
      let active = -1, lastCount = -1;
      function present(position) {
        if (position > unlocked) {
          unlocked = position;
          try {
            const other = Number(localStorage.getItem(storageKey));
            if (Number.isInteger(other)) unlocked = Math.max(unlocked, Math.min(notes.length, other));
            localStorage.setItem(storageKey, String(unlocked));
          } catch { /* Use memory only. */ }
        }
        if (position === active && unlocked === lastCount) return;
        lastCount = unlocked;
        toggle.querySelector("[data-note-count]").textContent = unlocked + "/" + notes.length;
        panel.querySelector(".rail-empty").hidden = unlocked > 0;
        panel.querySelector(".rail-ending").hidden = unlocked < notes.length;
        notes.forEach((note, i) => {
          note.hidden = i >= unlocked;
          note.classList.toggle("current-note", i + 1 === position);
          if (position !== active && i + 1 === position) {
            const past = notes[active - 1];
            if (past && !past.contains(document.activeElement)) past.querySelector("details").open = false;
            note.querySelector("details").open = true;
          }
        });
        active = position;
      }
      function positionOnPage() {
        const boundary = narrow.matches
          ? Math.min(innerHeight * .45, layout.querySelector(".reader-rail").getBoundingClientRect().bottom + 75)
          : Math.min(175, innerHeight * .25);
        let index = 0;
        for (const [i, section] of sections.entries()) {
          if (section.getBoundingClientRect().top > boundary) break;
          index = i + 1;
        }
        present(index);
      }
      function presentHash() {
        const target = document.getElementById(location.hash.slice(1));
        const section = target?.closest(".chapter-subsection");
        if (section && sections.includes(section)) present(sections.indexOf(section) + 1);
        else if (target?.closest(".chapter-assessment")) present(sections.length);
        else positionOnPage();
      }
      function setPanel(open) {
        panel.hidden = !open;
        toggle.setAttribute("aria-expanded", String(open));
        layout.querySelector(".reader-rail").classList.toggle("show-notebook", open);
        if (open && active > 0) notes[active - 1].querySelector("details").open = true;
      }
      toggle.hidden = false;
      toggle.addEventListener("click", () => setPanel(panel.hidden));
      panel.addEventListener("click", event => {
        if (narrow.matches && event.target.closest("a")) setPanel(false);
      });
      layout.querySelector(".reader-rail").addEventListener("keydown", event => {
        if (event.key === "Escape" && !panel.hidden) { setPanel(false); toggle.focus(); }
      });
      let frame = 0;
      function schedulePosition() {
        if (frame) return;
        frame = requestAnimationFrame(() => { frame = 0; positionOnPage(); });
      }
      presentHash();
      window.addEventListener("scroll", schedulePosition, { passive: true });
      window.addEventListener("resize", schedulePosition);
      window.addEventListener("hashchange", presentHash);
      window.addEventListener("pageshow", presentHash);
      window.addEventListener("storage", event => {
        if (event.key !== storageKey) return;
        const count = Number(event.newValue);
        if (Number.isInteger(count) && count > unlocked && count <= notes.length) {
          unlocked = count;
          present(Math.max(active, 0));
        }
      });
    }
    markSection();
    window.addEventListener("hashchange", markSection);
  }
  const filters = document.querySelector(".notebook-filters");
  if (filters) {
    filters.hidden = false;
    const search = filters.querySelector("[data-note-search]");
    const onlyFormulas = filters.querySelector("[data-only-formulas]");
    const chapters = [...document.querySelectorAll(".lookup-chapter")];
    const tables = [...document.querySelectorAll(".notebook-tables > section")];
    const fold = value => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi").replaceAll("đ", "d");
    const entries = chapters.map(ch => [...ch.querySelectorAll(".lookup-entry")].map(el => ({
      el, text: fold(ch.dataset.chapterTitle + " " + el.textContent)
    })));
    function filter() {
      const terms = fold(search.value).trim().split(/\s+/).filter(Boolean);
      let count = 0, foundTables = 0;
      tables.forEach(table => {
        table.hidden = onlyFormulas.checked || !terms.every(t => fold(table.textContent).includes(t));
        if (!table.hidden) foundTables++;
      });
      chapters.forEach((chapter, i) => {
        let found = 0;
        for (const row of entries[i]) {
          row.el.hidden = (onlyFormulas.checked && row.el.dataset.formula !== "1") || !terms.every(t => row.text.includes(t));
          if (!row.el.hidden) found++;
        }
        chapter.hidden = !found;
        count += found;
      });
      filters.querySelector("output").textContent = count + " tiểu mục" + (foundTables ? " · " + foundTables + " bảng tra" : "");
    }
    search.addEventListener("input", filter);
    onlyFormulas.addEventListener("change", filter);
    filter();
  }
  const landingLink = document.querySelector("[data-current-lesson]");
  if (landingLink) {
    const formatter = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
    });
    const today = formatter.format(new Date());
    const scheduled = document.querySelector('time[datetime="' + today + '"]');
    const lesson = scheduled?.closest("li").querySelector("a");
    if (lesson) {
      landingLink.href = lesson.href;
      const row = scheduled.closest("li");
      document.querySelector("[data-today-course]").textContent = scheduled.textContent + " · " + row.dataset.course;
      document.querySelector("[data-today-focus]").textContent = lesson.textContent;
      document.querySelector("[data-today-stop]").textContent = row.dataset.stop;
    }
  }

  function showAnswer(hash) {
    const target = document.getElementById(hash.slice(1));
    const answers = target?.closest("details.embedded-answers");
    if (answers) {
      answers.open = true;
      if (target !== answers) target.scrollIntoView();
    }
  }

  for (const trigger of document.querySelectorAll("[data-open-answer]")) {
    trigger.addEventListener("click", () => showAnswer(trigger.hash));
  }
  window.addEventListener("hashchange", () => showAnswer(location.hash));
  showAnswer(location.hash);

  document.addEventListener("click", event => {
    const opener = event.target.closest("[data-zoom]");
    if (!opener) return;
    const figure = opener.closest("figure");
    const dialog = document.createElement("dialog");
    dialog.className = "diagram-zoom";
    dialog.setAttribute("aria-label", figure.querySelector("svg").getAttribute("aria-label"));
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Đóng hình";
    close.addEventListener("click", () => dialog.close());
    const viewport = document.createElement("div");
    viewport.className = "diagram-pan";
    // A standalone image also isolates clip paths in the enlarged drawing.
    const img = document.createElement("img");
    const svg = figure.querySelector("svg");
    img.alt = svg.getAttribute("aria-label");
    const asset = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], {type: "image/svg+xml"}));
    img.src = asset;
    viewport.append(img);
    dialog.append(close, viewport);
    if (figure.querySelector(".figure-key[open]")) dialog.append(figure.querySelector(".figure-labels").cloneNode(true));
    dialog.addEventListener("close", () => { URL.revokeObjectURL(asset); dialog.remove(); opener.focus(); }, {once:true});
    document.body.append(dialog);
    dialog.showModal();
  });

  function setupStudyForm(form) {
    const fields = [...form.querySelectorAll('input[type="radio"][data-response]')];
    const essays = [...form.querySelectorAll("textarea[data-response]")];
    const marks = [...form.querySelectorAll("[data-criterion]")];
    const gradeButton = form.querySelector("[data-grade]");
    const score = form.querySelector(".daily-score");
    const status = form.querySelector(".save-status");
    const key = "on-thi-21-ngay:v1:" + form.dataset.study;
    const total = new Set(fields.map(field => field.name)).size;
    const groups = [...form.querySelectorAll("[data-group-progress]")].map(label => ({
      label,
      questions: [...document.getElementById(label.dataset.groupProgress).querySelectorAll("fieldset")],
    }));
    let storageAvailable = true;

    function restore() {
      try {
        const saved = JSON.parse(localStorage.getItem(key) || "{}") || {};
        const choices = saved.choices || {};
        for (const field of fields) field.checked = choices[field.name] === field.value;
        for (const essay of essays) {
          const value = saved.essays?.[essay.id] ?? (essays.length === 1 ? saved.essay : "");
          if (typeof value === "string") essay.value = value;
        }
        for (const mark of marks) mark.checked = saved.marks?.[mark.id] === true;
      } catch {
        storageAvailable = false;
      }
    }
    restore();

    const progress = document.createElement("p");
    progress.className = "meta";
    const meter=document.createElement("progress"); meter.className="form-meter"; meter.max=Math.max(total,1); meter.setAttribute("aria-label","Trắc nghiệm đã chọn đáp án");
    form.prepend(progress,meter);

    function updateProgress() {
      const selected = fields.filter(field => field.checked);
      meter.value=selected.length;
      progress.textContent = selected.length + "/" + total + " câu trắc nghiệm đã chọn";
      for (const {label, questions} of groups) {
        const count = questions.filter(item => item.querySelector("input:checked")).length;
        label.textContent = count + "/" + questions.length;
        label.setAttribute("aria-label", "Đã chọn " + count + " trên " + questions.length + " câu");
      }
      for (const box of form.querySelectorAll(".rubric")) {
        box.querySelector("[data-rubric-score]").textContent = box.querySelectorAll(":checked").length + "/" + box.querySelectorAll("[data-criterion]").length;
      }
      return selected;
    }

    function updateStatus() {
      status.textContent = storageAvailable
        ? "Bài làm được lưu trong trình duyệt này."
        : "Sao chép bài làm trước khi đóng trang nếu bạn muốn giữ lại.";
    }

    form.addEventListener("submit", event => event.preventDefault());
    for (const button of form.querySelectorAll("[data-grade-group]")) {
      const group = button.closest(".bank-group");
      const feedback = group.querySelector(".group-score");
      group.addEventListener("change", () => { feedback.textContent = ""; });
      button.addEventListener("click", () => {
        const items = [...group.querySelectorAll("[data-correct]")];
        const answered = items.filter(item => item.querySelector("input:checked"));
        if (answered.length !== items.length) {
          feedback.textContent = "Còn " + (items.length - answered.length) + " câu chưa chọn.";
          return;
        }
        const misses = items.filter(item => item.querySelector("input:checked").value !== item.dataset.correct);
        feedback.textContent = "Đúng " + (items.length - misses.length) + "/" + items.length + " câu.";
        if (misses.length) feedback.append(" Xem lời giải ");
        misses.forEach((item, index) => {
          const target = document.createElement("a");
          target.href = "#giai-" + item.id;
          target.textContent = item.querySelector(".question-code").textContent;
          target.addEventListener("click", () => showAnswer(target.hash));
          feedback.append(target, index + 1 === misses.length ? "." : ", ");
        });
      });
    }
    if (gradeButton) gradeButton.addEventListener("click", () => {
      const items = [...form.querySelectorAll("[data-correct]")];
      const missed = [];
      let attempted = 0;
      for (const item of items) {
        const checked = item.querySelector("input:checked");
        if (checked) attempted++;
        const correct = checked?.value === item.dataset.correct;
        if (!correct) missed.push(item);
      }
      if (attempted < items.length) {
        score.textContent = "Bạn đã chọn " + attempted + "/" + items.length + " câu. Chọn tiếp các câu còn trống để chấm bài.";
      } else {
        score.textContent = "Bạn đúng " + (items.length - missed.length) + "/" + items.length + " câu. " +
          (missed.length ? "Xem lời giải " : form.hasAttribute("data-daily") ? "Đối chiếu với điểm dừng của buổi học." : "Tự chấm bài viết theo từng ý trong phần lời giải.");
        missed.forEach((item, index) => {
          const link = document.createElement("a");
          link.href = "#giai-" + item.id;
          link.textContent = item.querySelector(".question-code").textContent;
          score.append(link, index === missed.length - 1 ? "." : ", ");
        });
        form.parentElement.querySelector(".daily-key").open = missed.length > 0;
      }
    });
    form.addEventListener("input", event => {
      const field = event.target;
      updateProgress();
      if (score) score.textContent = "";
      try {
        const previous = JSON.parse(localStorage.getItem(key) || "{}") || {};
        if (fields.includes(field)) (previous.choices ??= {})[field.name] = field.value;
        else if (essays.includes(field)) (previous.essays ??= {})[field.id] = field.value;
        else if (marks.includes(field)) (previous.marks ??= {})[field.id] = field.checked;
        localStorage.setItem(key, JSON.stringify(previous));
        storageAvailable = true;
      } catch {
        storageAvailable = false;
      }
      updateStatus();
    });
    function refresh() { restore(); updateProgress(); updateStatus(); }
    window.addEventListener("pageshow", event => { if (event.persisted) refresh(); });
    window.addEventListener("storage", event => { if (event.key === key) refresh(); });

    updateProgress();
    updateStatus();
  }

  document.querySelectorAll("form[data-study]").forEach(setupStudyForm);
})();


(() => {
  const panel = document.getElementById("reading-notes");
  if (!panel) return;
  const dialog = document.getElementById("term-dialog");
  const shortcut = document.querySelector("[data-note-open]");
  const wide = matchMedia("(min-width: 70rem)");
  const position = document.createComment("Ghi chú khi đọc");
  panel.before(position);
  const cards = new Map([...panel.querySelectorAll(".term-card")].map(card => [card.dataset.key, card]));
  const select = panel.querySelector("[data-term-select]");
  const nearby = panel.querySelector(".term-neighbors");
  const close = dialog.querySelector("[data-term-close]");
  const contexts = [...document.querySelectorAll(".chapter-reading [data-reading-keys]")];
  if (!cards.size || !contexts.length || !dialog.showModal) return;

  const announce = document.createElement("span");
  announce.className = "reading-announcement";
  announce.setAttribute("role", "status");
  announce.setAttribute("aria-live", "polite");
  panel.append(announce);
  const back = document.createElement("button");
  back.className = "back-to-term";
  back.type = "button";
  back.textContent = "Về từ vừa chọn";
  back.hidden = true;
  let lastLink;
  back.addEventListener("click", () => lastLink?.focus());
  panel.append(back);
  let current, picked, returnTo, pending = false;
  function show(key) {
    if (!cards.has(key)) return;
    for (const [id, card] of cards) card.hidden = id !== key;
    picked = select.value = key;
    nearby.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.key === key)));
  }
  function setContext(node) {
    if (!node || current === node) return;
    current = node;
    nearby.replaceChildren();
    const keys = node.dataset.readingKeys.split(/\s+/).filter(key => cards.has(key));
    for (const key of keys.slice(0, 4)) {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.key = key;
      b.textContent = cards.get(key).querySelector("h3").textContent;
      nearby.append(b);
    }
    if (keys.length) show(keys[0]);
    const unit = node.closest(".chapter-subsection");
    const jump = panel.querySelector(".reading-note-return");
    jump.hidden = !unit;
    if (unit) jump.href = "#" + unit.id + "-chot";
  }
  function contextAtScreen() {
    const edge = Math.min(innerHeight * .34, 235);
    let active = contexts[0];
    for (const context of contexts) {
      if (context.getBoundingClientRect().top > edge) break;
      active = context;
    }
    return active;
  }
  function open(key, trigger) {
    if (!wide.matches) {
      returnTo = trigger;
      if (!dialog.open) {
        dialog.append(panel);
        dialog.showModal();
        close.focus({preventScroll: true});
      }
    }
    show(key);
    if (wide.matches) {
      panel.scrollTop = 0;
      if (trigger?.classList.contains("term-link")) {
        const bottom = cards.get(key).querySelector(".term-example").getBoundingClientRect().bottom;
        const needed = bottom - innerHeight + 20;
        const available = Math.min(panel.getBoundingClientRect().top - 16, trigger.getBoundingClientRect().top - 72);
        if (needed > 0 && available > 0) window.scrollBy(0, Math.min(needed, available));
      }
    }
  }
  function backToReading() {
    position.after(panel);
    if (returnTo?.isConnected) returnTo.focus({preventScroll:true});
    returnTo = null;
  }
  panel.querySelector(".term-controls").hidden = false;
  panel.append(nearby);
  const jump = document.createElement("a");
  jump.className = "reading-note-return";
  jump.textContent = "Xem ý chốt của tiểu mục";
  jump.hidden = true;
  panel.append(jump);
  document.documentElement.classList.add("term-notes-ready");
  shortcut.hidden = wide.matches;
  select.addEventListener("change", () => show(select.value));
  nearby.addEventListener("click", e => {
    const b = e.target.closest("button[data-key]");
    if (b) show(b.dataset.key);
  });
  document.addEventListener("click", e => {
    const a = e.target.closest(".term-link");
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0 || !cards.has(a.dataset.term)) return;
    e.preventDefault();
    const block = a.closest("[data-reading-keys]") ||
      a.closest(".chapter-subsection")?.querySelector(".reading-leadin");
    if (block) setContext(block);
    open(a.dataset.term, a);
    lastLink = a;
    back.hidden = !wide.matches;
    const card = cards.get(a.dataset.term);
    if (wide.matches && e.detail === 0) card.focus({preventScroll:true});
    if (wide.matches && e.detail !== 0) announce.textContent = card.querySelector("h3").textContent + ". " + card.querySelector("p").textContent;
  });
  shortcut.addEventListener("click", () => { setContext(contextAtScreen()); open(picked, shortcut); });
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", backToReading);
  dialog.addEventListener("click", e => {
    if (e.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
    }
  });
  panel.addEventListener("click", e => {
    if (dialog.open && e.target.closest("a[href]")) {returnTo = null; dialog.close();}
  });
  wide.addEventListener("change", () => {
    shortcut.hidden = wide.matches;
    back.hidden = !wide.matches || !lastLink;
    if (wide.matches && dialog.open) dialog.close();
  });
  function refresh() {
    pending = false;
    if (!dialog.open) setContext(contextAtScreen());
  }
  window.addEventListener("scroll", () => {
    if (!pending) { pending = true; requestAnimationFrame(refresh); }
  }, {passive:true});
  refresh();
  const target = document.getElementById(location.hash.slice(1));
  if (target?.classList.contains("term-card")) open(target.dataset.key, shortcut);
})();
