import "./index.css";

const FLYFF_URL = "https://universe.flyff.com/play";

type Profile = {
  id: string;
  name: string;
  createdAt: string;
  job?: string;
  launchMode: "tabs" | "window";
};

function qs() {
  const u = new URL(window.location.href);
  return u.searchParams;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function clear(root: HTMLElement) {
  root.innerHTML = "";
}

// (Legacy/optional) – wird im Tab-Modus nicht mehr benutzt
function createWebview(profileId: string) {
  const wv = document.createElement("webview") as any;
  wv.className = "webview";
  wv.setAttribute("partition", `persist:${profileId}`);
  wv.setAttribute("src", "about:blank");

  wv.style.position = "absolute";
  wv.style.top = "0";
  wv.style.left = "0";
  wv.style.right = "0";
  wv.style.bottom = "0";
  wv.style.display = "block";

  return wv as HTMLElement;
}

function reorderIds(ids: string[], fromId: string, toId: string, after: boolean) {
  const arr = [...ids];
  const from = arr.indexOf(fromId);
  let to = arr.indexOf(toId);
  if (from < 0 || to < 0) return arr;
  if (from === to) return arr;

  arr.splice(from, 1);
  if (from < to) to--;
  if (after) to++;

  arr.splice(to, 0, fromId);
  return arr;
}

async function renderLauncher(root: HTMLElement) {
  clear(root);
  root.className = "launcherRoot";

  const header = el("div", "topbar");
  header.append(el("div", "title", "FlyffU Launcher"), el("div", "spacer"));

  const btnCreate = el("button", "btn primary", "Create Profile");
  header.append(btnCreate);

  const body = el("div", "layout");
  const left = el("div", "panel left");
  const right = el("div", "panel right");

  const list = el("div", "list");

  const createPanel = el("div", "manage hidden");
  const createGrid = el("div", "manageGrid");

  const createName = document.createElement("input");
  createName.className = "input";
  createName.placeholder = "Profilname…";
  createGrid.append(createName);

  const createActions = el("div", "manageActions");
  const btnAdd = el("button", "btn primary", "Add");
  const btnCancel = el("button", "btn", "Cancel");
  createActions.append(btnAdd, btnCancel);

  createPanel.append(createGrid, createActions);
  left.append(createPanel, list);

  right.append(el("div", "panelTitle", "Newsfeed (später)"), el("div", "muted", "später"));

  root.append(header, body);
  body.append(left, right);

  async function reload() {
    list.innerHTML = "";

    let profiles: Profile[] = [];
    try {
      profiles = await window.api.profilesList();
    } catch (e) {
      console.error(e);
      list.append(el("div", "muted", "Fehler beim Laden der Profile. Siehe Konsole (Ctrl+Shift+I)."));
      return;
    }

    if (profiles.length === 0) {
      list.append(el("div", "muted", "Noch keine Profile. Erstelle eins mit 'Create Profile'."));
      return;
    }

    let draggingId: string | null = null;

    for (const p of profiles) {
      const card = el("div", "card");

      const row = el("div", "row");
      const leftInfo = el("div", "rowLeft");

      const dragHandle = el("span", "dragHandle", "≡");
      const name = el("div", "rowName", p.name);
      leftInfo.append(dragHandle, name);

      (dragHandle as any).draggable = true;

      dragHandle.addEventListener("dragstart", (e) => {
        draggingId = p.id;
        card.classList.add("dragging");
        e.dataTransfer?.setData("text/plain", p.id);
        e.dataTransfer!.effectAllowed = "move";
        e.dataTransfer?.setDragImage(row, 20, 20);
      });

      dragHandle.addEventListener("dragend", () => {
        draggingId = null;
        card.classList.remove("dragging", "dropBefore", "dropAfter");
      });

      if (p.job?.trim()) leftInfo.append(el("span", "badge", p.job));
      leftInfo.append(el("span", "badge subtle", p.launchMode === "tabs" ? "Tabs" : "Window"));

      const actions = el("div", "rowActions");
      const btnManage = el("button", "btn", "Einstellungen");
      const btnPlay = el("button", "btn primary", "Spielen");
      const btnDel = el("button", "btn danger", "Löschen");

      btnDel.onclick = async () => {
        await window.api.profilesDelete(p.id);
        await reload();
      };

      actions.append(btnManage, btnPlay, btnDel);
      row.append(leftInfo, actions);

      const manage = el("div", "manage hidden");

      const nameInput = document.createElement("input");
      nameInput.className = "input";
      nameInput.value = p.name;

      const jobSelect = document.createElement("select");
      jobSelect.className = "select";
      const jobs = ["", "Blade", "Ringmaster", "Ranger", "Vagrant", "Jester", "Knight", "Psykeeper", "Elementor", "Billposter"];
      for (const j of jobs) {
        const opt = document.createElement("option");
        opt.value = j;
        opt.textContent = j === "" ? "— Job —" : j;
        if ((p.job ?? "") === j) opt.selected = true;
        jobSelect.append(opt);
      }

      const modeWrap = el("div", "modeWrap");
      const modeLabel = el("label", "checkbox");
      const modeCheck = document.createElement("input");
      modeCheck.type = "checkbox";
      modeCheck.checked = p.launchMode === "tabs";
      modeLabel.append(modeCheck, el("span", "", "In Tabs verwenden"));
      modeWrap.append(modeLabel);

      // ... nachdem modeCheck erstellt wurde (nach: modeCheck.checked = p.launchMode === "tabs";)

function currentMode(): "tabs" | "window" {
  return modeCheck.checked ? "tabs" : "window";
}

btnPlay.onclick = async () => {
  // optional: direkt persistieren, damit Badge & main.ts sicher konsistent sind:
  await window.api.profilesUpdate({
    id: p.id,
    launchMode: currentMode(),
  });

  if (currentMode() === "tabs") {
    await window.api.openTab(p.id);
  } else {
    await window.api.openWindow(p.id);
  }
};


      const btnSave = el("button", "btn primary", "Save");
      const btnClone = el("button", "btn", "Clone");
      const btnClose = el("button", "btn", "Close");

      const clonePanel = el("div", "clonePanel hidden");
      const cloneInput = document.createElement("input");
      cloneInput.className = "input";
      cloneInput.placeholder = "Name für Kopie…";
      cloneInput.value = `${p.name} (Copy)`;

      const cloneActions = el("div", "manageActions");
      const btnDoClone = el("button", "btn primary", "Clone");
      const btnCloneCancel = el("button", "btn", "Cancel");
      cloneActions.append(btnDoClone, btnCloneCancel);
      clonePanel.append(cloneInput, cloneActions);

      btnSave.onclick = async () => {
        await window.api.profilesUpdate({
          id: p.id,
          name: nameInput.value.trim() || p.name,
          job: jobSelect.value,
          launchMode: modeCheck.checked ? "tabs" : "window",
        });
        await reload();
      };

      btnClone.onclick = () => {
        clonePanel.classList.toggle("hidden");
        cloneInput.focus();
        cloneInput.select();
      };

      btnCloneCancel.onclick = () => clonePanel.classList.add("hidden");

      btnDoClone.onclick = async () => {
        const newName = cloneInput.value.trim() || `${p.name} (Copy)`;
        await window.api.profilesClone(p.id, newName);
        clonePanel.classList.add("hidden");
        manage.classList.add("hidden");
        await reload();
      };

      btnClose.onclick = () => {
        clonePanel.classList.add("hidden");
        manage.classList.add("hidden");
      };

      const grid = el("div", "manageGrid");
      grid.append(nameInput, jobSelect, modeWrap);

      const actionBar = el("div", "manageActions");
      actionBar.append(btnSave, btnClone, btnClose);

      manage.append(grid, actionBar, clonePanel);
      btnManage.onclick = () => manage.classList.toggle("hidden");

      card.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (!draggingId || draggingId === p.id) return;

        const rect = card.getBoundingClientRect();
        const after = (e.clientY - rect.top) > rect.height / 2;

        card.classList.toggle("dropAfter", after);
        card.classList.toggle("dropBefore", !after);
        e.dataTransfer!.dropEffect = "move";
      });

      card.addEventListener("dragleave", () => {
        card.classList.remove("dropBefore", "dropAfter");
      });

      card.addEventListener("drop", async (e) => {
        e.preventDefault();
        card.classList.remove("dropBefore", "dropAfter");

        const fromId = draggingId ?? e.dataTransfer?.getData("text/plain");
        const toId = p.id;
        if (!fromId || fromId === toId) return;

        const rect = card.getBoundingClientRect();
        const after = (e.clientY - rect.top) > rect.height / 2;

        const orderedIds = reorderIds(profiles.map((x) => x.id), fromId, toId, after);
        await window.api.profilesReorder(orderedIds);
        await reload();
      });

      card.append(row, manage);
      list.append(card);
    }
  }

  btnCreate.onclick = () => {
    createPanel.classList.toggle("hidden");
    createName.focus();
  };

  btnAdd.onclick = async () => {
    const name = createName.value.trim();
    if (!name) return;
    await window.api.profilesCreate(name);
    createName.value = "";
    createPanel.classList.add("hidden");
    await reload();
  };

  btnCancel.onclick = () => createPanel.classList.add("hidden");

  await reload();
}

// ---------- Session (BrowserView Tabs) ----------
async function renderSession(root: HTMLElement) {
  clear(root);
  root.className = "sessionRoot";

  const tabsBar = el("div", "tabs");
  const content = el("div", "content"); // nur Platzhalter, BrowserView liegt drüber
  root.append(tabsBar, content);

  type Tab = { profileId: string; tabBtn: HTMLButtonElement };
  const tabs: Tab[] = [];
  let activeId: string | null = null;

  const btnPlus = el("button", "tabBtn plus", "+") as HTMLButtonElement;
  btnPlus.draggable = false;
  tabsBar.append(btnPlus);

  function isOpen(profileId: string) {
    return tabs.some((t) => t.profileId === profileId);
  }

  function pushBounds() {
    const y = Math.round(tabsBar.getBoundingClientRect().height);
    const width = Math.round(window.innerWidth);
    const height = Math.max(1, Math.round(window.innerHeight - y));
    window.api.sessionTabsSetBounds({ x: 0, y, width, height });
  }

  let raf = 0;
  function kickBounds() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      pushBounds();
    });
  }

  window.addEventListener("resize", kickBounds);
  new ResizeObserver(kickBounds).observe(tabsBar);

  async function setActive(profileId: string) {
    activeId = profileId;
    for (const t of tabs) t.tabBtn.classList.toggle("active", t.profileId === profileId);
    await window.api.sessionTabsSwitch(profileId);
    kickBounds();
  }

  function renderTabsOrder() {
    // in der Reihenfolge der Array-Liste wieder vor den + Button einsetzen
    for (const t of tabs) {
      tabsBar.insertBefore(t.tabBtn, btnPlus);
    }
  }

  function moveTab(fromId: string, toId: string, after: boolean) {
    const fromIdx = tabs.findIndex((t) => t.profileId === fromId);
    const toIdx = tabs.findIndex((t) => t.profileId === toId);
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;

    const [item] = tabs.splice(fromIdx, 1);
    let insertIdx = toIdx;
    if (fromIdx < toIdx) insertIdx -= 1;
    if (after) insertIdx += 1;

    tabs.splice(insertIdx, 0, item);
    renderTabsOrder();
  }

  // ---- Drag & Drop ----
  let draggingId: string | null = null;

  function attachDnd(tabBtn: HTMLButtonElement, profileId: string) {
    tabBtn.draggable = true;

    tabBtn.addEventListener("dragstart", (e) => {
      draggingId = profileId;
      tabBtn.classList.add("dragging");
      e.dataTransfer?.setData("text/plain", profileId);
      e.dataTransfer!.effectAllowed = "move";
    });

    tabBtn.addEventListener("dragend", () => {
      draggingId = null;
      tabBtn.classList.remove("dragging", "dropBefore", "dropAfter");
      // cleanup aller drop marker
      for (const t of tabs) t.tabBtn.classList.remove("dropBefore", "dropAfter");
    });

    tabBtn.addEventListener("dragover", (e) => {
      e.preventDefault();
      const fromId = draggingId ?? e.dataTransfer?.getData("text/plain");
      if (!fromId || fromId === profileId) return;

      // links/rechts Entscheidung
      const rect = tabBtn.getBoundingClientRect();
      const after = (e.clientX - rect.left) > rect.width / 2;

      tabBtn.classList.toggle("dropAfter", after);
      tabBtn.classList.toggle("dropBefore", !after);
      e.dataTransfer!.dropEffect = "move";
    });

    tabBtn.addEventListener("dragleave", () => {
      tabBtn.classList.remove("dropBefore", "dropAfter");
    });

    tabBtn.addEventListener("drop", (e) => {
      e.preventDefault();
      const fromId = draggingId ?? e.dataTransfer?.getData("text/plain");
      if (!fromId || fromId === profileId) return;

      const rect = tabBtn.getBoundingClientRect();
      const after = (e.clientX - rect.left) > rect.width / 2;

      tabBtn.classList.remove("dropBefore", "dropAfter");
      moveTab(fromId, profileId, after);
    });
  }

  async function openTab(profileId: string) {
    const existing = tabs.find((t) => t.profileId === profileId);
    if (existing) return setActive(profileId);

    const profiles: Profile[] = await window.api.profilesList();
    const p = profiles.find((x) => x.id === profileId);

    // ✅ 2) Job NICHT in den Tabnamen
    const title = p?.name ?? profileId;

    const tabBtn = document.createElement("button");
    tabBtn.className = "tabBtn";
    tabBtn.textContent = title;

    // optional: Job nur als Tooltip
    if (p?.job?.trim()) tabBtn.title = p.job;

    const closeBtn = el("span", "tabClose", "×");
    closeBtn.onclick = async (e) => {
      e.stopPropagation();
      await window.api.sessionTabsClose(profileId);

      const idx = tabs.findIndex((t) => t.profileId === profileId);
      if (idx >= 0) tabs.splice(idx, 1);
      tabBtn.remove();

      if (activeId === profileId) {
        const next = tabs[idx] ?? tabs[idx - 1] ?? null;
        activeId = null;
        if (next) await setActive(next.profileId);
      }

      renderTabsOrder();
    };
    tabBtn.append(closeBtn);

    tabBtn.onclick = () => setActive(profileId);

    attachDnd(tabBtn, profileId);

    tabsBar.insertBefore(tabBtn, btnPlus);
    tabs.push({ profileId, tabBtn });

    await window.api.sessionTabsOpen(profileId);
    await setActive(profileId);

    renderTabsOrder();
  }

  async function showPicker() {
    await window.api.sessionTabsSetVisible(false);

    const overlay = el("div", "modalOverlay");
    const modal = el("div", "modal");
    const header = el("div", "modalHeader", "Select Profile");
    const body = el("div", "modalBody");
    const list = el("div", "pickerList");
    modal.append(header, body);
    body.append(list);
    overlay.append(modal);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close().catch(console.error);
    };

    const close = async () => {
      overlay.remove();
      window.removeEventListener("keydown", onKey);
      await window.api.sessionTabsSetVisible(true);
      kickBounds();
    };

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close().catch(console.error);
    });
    window.addEventListener("keydown", onKey);

    document.body.append(overlay);

    const profiles: Profile[] = await window.api.profilesList();
    const candidates = profiles.filter((p) => p.launchMode === "tabs" && !isOpen(p.id));

    if (candidates.length === 0) {
      list.append(el("div", "pickerEmpty", "Keine weiteren Tab-Profile verfügbar."));
      return;
    }

    for (const p of candidates) {
      const item = el("button", "pickerItem", p.name) as HTMLButtonElement;
      item.onclick = async () => {
        await openTab(p.id);
        await close();
      };
      list.append(item);
    }
  }

  btnPlus.onclick = () => showPicker().catch(console.error);

  window.api.onOpenTab((profileId: string) => {
    openTab(profileId).catch(console.error);
  });

  const initial = qs().get("openProfileId");
  if (initial) openTab(initial).catch(console.error);

  kickBounds();
}


// ---------- Instance (unused/legacy) ----------
async function renderInstance(root: HTMLElement, profileId: string) {
  clear(root);
  root.className = "instanceRoot";

  const wv = createWebview(profileId) as any;
  wv.setAttribute("src", FLYFF_URL);
  root.append(wv);
}

async function main() {
  const root = document.getElementById("app")!;
  const view = qs().get("view") ?? "launcher";

  if (view === "launcher") return renderLauncher(root);
  if (view === "session") return renderSession(root);
  if (view === "instance") {
    const profileId = qs().get("profileId") ?? "";
    return renderInstance(root, profileId);
  }

  return renderLauncher(root);
}

main().catch(console.error);
