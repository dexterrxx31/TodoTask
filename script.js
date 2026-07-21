(() => {
  "use strict";

  const STORAGE_KEY = "modern-todos.v1";
  const THEME_KEY = "modern-todos.theme";

  // ---------- State ----------
  let todos = load();
  let filter = "all";

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

  // ---------- Helpers ----------
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function addTodo(text) {
    todos.unshift({ id: uid(), text: text.trim(), done: false, created: Date.now() });
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
      setTimeout(finish, 350); // fallback
    } else finish();
  }

  function editTodo(id, newText) {
    const t = todos.find((x) => x.id === id);
    if (!t) return;
    const trimmed = newText.trim();
    if (trimmed) { t.text = trimmed; } // keep old if emptied
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

    // Empty state
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

    // Counts + progress
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

    // Footer
    footer.hidden = total === 0;
    itemsLeft.textContent = `${active} item${active === 1 ? "" : "s"} left`;
    clearCompleted.hidden = done === 0;
  }

  function setCount(key, n) {
    const el = document.querySelector(`[data-count="${key}"]`);
    if (el) el.textContent = n;
  }

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

    // Label
    const label = document.createElement("span");
    label.className = "task__label";
    label.textContent = todo.text;
    label.setAttribute("role", "textbox");
    label.title = "Double-click to edit";
    label.addEventListener("click", () => toggleTodo(todo.id));
    label.addEventListener("dblclick", (e) => { e.stopPropagation(); startEdit(li, label, todo); });

    // Delete
    const del = document.createElement("button");
    del.className = "task__delete";
    del.type = "button";
    del.setAttribute("aria-label", "Delete task");
    del.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>`;
    del.addEventListener("click", () => removeTodo(todo.id, li));

    li.append(check, label, del);
    return li;
  }

  function startEdit(li, label, todo) {
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

  // ---------- Events ----------
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    addTodo(text);
    input.value = "";
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

  // ---------- Init ----------
  initTheme();
  render();
})();
