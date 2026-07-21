(() => {
  "use strict";

  const STORAGE_KEY = "modern-todos.v1";
  const THEME_KEY = "modern-todos.theme";

  // ---------- State ----------
  let todos = load();
  let filter = "all";
  let pendingDue = null; // due date for the next new task (YYYY-MM-DD)

  // ---------- Elements ----------
  const form = document.getElementById("todoForm");
  const input = document.getElementById("todoInput");
  const list = document.getElementById("todoList");
  const emptyState = document.getElementById("emptyState");
  const footer = document.getElementById("appFooter");
  const itemsLeft = document.getElementById("itemsLeft");
  const clearCompleted = document.getElementById("clearCompleted");
  const filtersNav = document.getElementById("filters");
  const themeToggle = document.getElementById("themeToggle");
  const dateLabel = document.getElementById("dateLabel");

  // Due picker (composer)
  const dueBtn = document.getElementById("dueBtn");
  const dueInput = document.getElementById("dueInput");
  const dueBtnLabel = document.getElementById("dueBtnLabel");

  // Progress
  const doneCount = document.getElementById("doneCount");
  const totalCount = document.getElementById("totalCount");
  const pctLabel = document.getElementById("pctLabel");
  const progressFill = document.getElementById("progressFill");

  // ---------- Theme ----------
  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = saved || (prefersDark ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
  }
  themeToggle.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
  });

  // ---------- Date label ----------
  dateLabel.textContent = new Date().toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric",
  });

  // ---------- Persistence ----------
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }
  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  }

  // ---------- Date helpers ----------
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function parseDue(str) {
    // str = 'YYYY-MM-DD' -> local Date at midnight (avoids timezone shift)
    if (!str) return null;
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function daysFromToday(str) {
    const due = parseDue(str);
    if (!due) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((due - today) / 86400000);
  }

  function formatDue(str, isDone) {
    const diff = daysFromToday(str);
    if (diff === null) return null;
    const due = parseDue(str);
    let label;
    if (diff === 0) label = "Today";
    else if (diff === 1) label = "Tomorrow";
    else if (diff === -1) label = "Yesterday";
    else if (diff > 1 && diff < 7) label = due.toLocaleDateString(undefined, { weekday: "long" });
    else if (diff < 0 && diff > -7) label = due.toLocaleDateString(undefined, { weekday: "long" });
    else label = due.toLocaleDateString(undefined, { month: "short", day: "numeric" });

    let cls = "";
    if (!isDone) {
      if (diff < 0) cls = "is-overdue";
      else if (diff === 0) cls = "is-today";
    }
    return { label, cls };
  }

  // ---------- Composer due picker ----------
  // The date input is a transparent overlay inside its <label>, so a direct
  // tap opens the OS picker natively (reliable on iOS). On desktop a plain
  // click won't open it, so nudge with showPicker() when available.
  function nudgePicker(el) {
    try { el.showPicker(); } catch (_) { /* touch already opened it */ }
  }
  dueInput.addEventListener("click", () => nudgePicker(dueInput));
  dueInput.addEventListener("change", () => {
    pendingDue = dueInput.value || null;
    updateDueBtn();
  });
  function updateDueBtn() {
    if (pendingDue) {
      const f = formatDue(pendingDue, false);
      dueBtnLabel.textContent = f ? f.label : "";
      dueBtn.classList.add("is-set");
    } else {
      dueBtnLabel.textContent = "";
      dueBtn.classList.remove("is-set");
    }
  }

  // ---------- CRUD ----------
  function addTodo(text, due) {
    todos.unshift({ id: uid(), text: text.trim(), done: false, due: due || null, created: Date.now() });
    save();
    render();
  }
  function toggleTodo(id) {
    const t = todos.find((x) => x.id === id);
    if (t) { t.done = !t.done; save(); render(); }
  }
  function removeTodo(id, el) {
    const finish = () => { todos = todos.filter((x) => x.id !== id); save(); render(); };
    if (el) {
      el.classList.add("is-removing");
      el.addEventListener("transitionend", finish, { once: true });
      setTimeout(finish, 350);
    } else finish();
  }
  function editTodo(id, newText) {
    const t = todos.find((x) => x.id === id);
    if (!t) return;
    const trimmed = newText.trim();
    if (trimmed) t.text = trimmed;
    save();
    render();
  }
  function setDue(id, due) {
    const t = todos.find((x) => x.id === id);
    if (!t) return;
    t.due = due || null;
    save();
    render();
  }

  function getFiltered() {
    if (filter === "active") return todos.filter((t) => !t.done);
    if (filter === "completed") return todos.filter((t) => t.done);
    return todos;
  }

  // ---------- Rendering ----------
  function render() {
    const filtered = getFiltered();

    list.innerHTML = "";
    filtered.forEach((todo) => list.appendChild(createTaskEl(todo)));

    const showEmpty = filtered.length === 0;
    emptyState.hidden = !showEmpty;
    if (showEmpty) {
      const msg = todos.length === 0
        ? { t: "Nothing here yet", s: "Add your first task above to get started." }
        : filter === "active"
        ? { t: "All caught up!", s: "You have no active tasks. Nice work. 🎉" }
        : { t: "No completed tasks", s: "Finish a task to see it here." };
      emptyState.querySelector(".empty__title").textContent = msg.t;
      emptyState.querySelector(".empty__sub").textContent = msg.s;
    }

    const total = todos.length;
    const done = todos.filter((t) => t.done).length;
    const active = total - done;
    const pct = total ? Math.round((done / total) * 100) : 0;

    doneCount.textContent = done;
    totalCount.textContent = total;
    pctLabel.textContent = pct + "%";
    progressFill.style.width = pct + "%";

    setCount("all", total);
    setCount("active", active);
    setCount("completed", done);

    footer.hidden = total === 0;
    itemsLeft.textContent = `${active} item${active === 1 ? "" : "s"} left`;
    clearCompleted.hidden = done === 0;
  }

  function setCount(key, n) {
    const el = document.querySelector(`[data-count="${key}"]`);
    if (el) el.textContent = n;
  }

  const CAL_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="17" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>`;

  function createTaskEl(todo) {
    const li = document.createElement("li");
    li.className = "task" + (todo.done ? " completed" : "");
    li.dataset.id = todo.id;

    // Checkbox
    const check = document.createElement("button");
    check.className = "task__check";
    check.type = "button";
    check.setAttribute("aria-label", todo.done ? "Mark as not done" : "Mark as done");
    check.setAttribute("aria-pressed", String(todo.done));
    check.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9 17.5 20 6"/></svg>`;
    check.addEventListener("click", () => toggleTodo(todo.id));

    // Main column: label + due badge
    const main = document.createElement("div");
    main.className = "task__main";

    const label = document.createElement("span");
    label.className = "task__label";
    label.textContent = todo.text;
    label.title = "Double-click to edit";
    label.addEventListener("click", () => toggleTodo(todo.id));
    label.addEventListener("dblclick", (e) => { e.stopPropagation(); startEdit(main, label, todo); });

    const due = createDueEl(todo);

    main.append(label, due);

    // Drag handle
    const handle = document.createElement("button");
    handle.className = "task__handle";
    handle.type = "button";
    handle.setAttribute("aria-label", "Drag to reorder");
    handle.title = filter === "all" ? "Drag to reorder" : "Reordering available in “All” view";
    handle.hidden = filter !== "all";
    handle.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>`;
    handle.addEventListener("pointerdown", (e) => startDrag(e, li));

    // Delete
    const del = document.createElement("button");
    del.className = "task__delete";
    del.type = "button";
    del.setAttribute("aria-label", "Delete task");
    del.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>`;
    del.addEventListener("click", () => removeTodo(todo.id, li));

    li.append(check, main, handle, del);
    return li;
  }

  function createDueEl(todo) {
    const wrap = document.createElement("label");
    wrap.className = "task__due";

    const native = document.createElement("input");
    native.type = "date";
    native.className = "task__due-native";
    if (todo.due) native.value = todo.due;
    native.addEventListener("change", () => setDue(todo.id, native.value));
    native.addEventListener("click", () => nudgePicker(native));

    const f = todo.due ? formatDue(todo.due, todo.done) : null;
    if (f) {
      wrap.classList.add(f.cls);
      wrap.innerHTML = CAL_SVG + `<span>${f.label}</span>`;
      native.setAttribute("aria-label", "Due " + f.label + ". Change due date.");
    } else {
      wrap.classList.add("is-empty");
      wrap.innerHTML = CAL_SVG + `<span>Add date</span>`;
      native.setAttribute("aria-label", "Add due date");
    }

    wrap.appendChild(native);
    return wrap;
  }

  function startEdit(main, label, todo) {
    const editor = document.createElement("input");
    editor.type = "text";
    editor.className = "task__label";
    editor.value = todo.text;
    editor.maxLength = 140;
    editor.style.background = "transparent";
    editor.style.border = "none";
    editor.style.outline = "none";
    editor.style.font = "inherit";
    editor.style.color = "var(--text)";
    editor.style.width = "100%";

    label.replaceWith(editor);
    editor.focus();
    editor.setSelectionRange(editor.value.length, editor.value.length);

    const commit = () => editTodo(todo.id, editor.value);
    editor.addEventListener("blur", commit, { once: true });
    editor.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); editor.blur(); }
      if (e.key === "Escape") { editor.value = todo.text; editor.blur(); }
    });
  }

  // ---------- Drag to reorder (pointer-based, works on touch + mouse) ----------
  let drag = null;

  function startDrag(e, li) {
    if (filter !== "all") return;   // order maps 1:1 to storage only in All view
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();

    const rect = li.getBoundingClientRect();
    const placeholder = document.createElement("li");
    placeholder.className = "task-placeholder";
    placeholder.style.height = rect.height + "px";
    li.after(placeholder);

    drag = {
      li,
      placeholder,
      pointerId: e.pointerId,
      offsetY: e.clientY - rect.top,
      width: rect.width,
      left: rect.left,
    };

    li.classList.add("dragging");
    li.style.width = rect.width + "px";
    li.style.left = rect.left + "px";
    li.style.top = rect.top + "px";
    document.body.classList.add("is-dragging");

    try { li.setPointerCapture(e.pointerId); } catch {}
    document.addEventListener("pointermove", onDragMove, { passive: false });
    document.addEventListener("pointerup", onDragEnd);
    document.addEventListener("pointercancel", onDragEnd);
  }

  function onDragMove(e) {
    if (!drag) return;
    e.preventDefault();

    drag.li.style.top = (e.clientY - drag.offsetY) + "px";

    const siblings = [...list.querySelectorAll(".task:not(.dragging)")];
    let inserted = false;
    for (const sib of siblings) {
      const r = sib.getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) {
        list.insertBefore(drag.placeholder, sib);
        inserted = true;
        break;
      }
    }
    if (!inserted) list.appendChild(drag.placeholder);
  }

  function onDragEnd() {
    if (!drag) return;
    const { li, placeholder } = drag;

    list.insertBefore(li, placeholder);
    placeholder.remove();

    li.classList.remove("dragging");
    li.style.width = li.style.left = li.style.top = "";
    document.body.classList.remove("is-dragging");

    document.removeEventListener("pointermove", onDragMove);
    document.removeEventListener("pointerup", onDragEnd);
    document.removeEventListener("pointercancel", onDragEnd);
    drag = null;

    // Persist new order from DOM
    const order = [...list.querySelectorAll(".task")].map((el) => el.dataset.id);
    todos.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    save();
    render();
  }

  // ---------- Events ----------
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    addTodo(text, pendingDue);
    input.value = "";
    pendingDue = null;
    dueInput.value = "";
    updateDueBtn();
    input.focus();
  });

  filtersNav.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    filter = btn.dataset.filter;
    document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("is-active", c === btn));
    render();
  });

  clearCompleted.addEventListener("click", () => {
    todos = todos.filter((t) => !t.done);
    save();
    render();
  });

  // ---------- Service worker (installable PWA) ----------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }

  // ---------- Init ----------
  initTheme();
  updateDueBtn();
  render();
})();
