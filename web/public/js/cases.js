/* ===================== URL PARAMS ===================== */

const params = new URLSearchParams(window.location.search);
const guildId = params.get("guildId");

if (!guildId) {
  window.location = "/servers";
}

/* ===================== AUTH ===================== */

async function ensureAuth() {
  const res = await fetch("/api/me");
  if (res.status === 401) {
    window.location = "/";
    return null;
  }
  return res.json();
}

/* ===================== LOAD ROLE ===================== */

async function loadRole() {
  const res = await fetch(`/api/role/${guildId}`);
  const data = await res.json();

  const roleEl = document.getElementById("roleName");
  roleEl.textContent = data?.role ?? "Member";
}

/* ===================== LOAD PERMISSIONS ===================== */

async function loadPermissions() {
  const res = await fetch(`/api/permissions/${guildId}`);
  return res.json();
}

/* ===================== LOAD CASES ===================== */

async function loadCases(perms) {
  const res = await fetch(`/api/cases/${guildId}`);
  const data = await res.json();

  const container = document.getElementById("cases");
  container.innerHTML = "";

  if (!data?.cases?.length) {
    const empty = document.createElement("div");
    empty.className = "box";
    empty.textContent = "No cases found.";
    container.appendChild(empty);
    return;
  }

  data.cases.forEach(c => {
    const div = document.createElement("div");
    div.className = "box";

    div.innerHTML = `
      <div>
        <span class="tag">${c.type}</span>
        <strong>${c.username}</strong>
      </div>
      <div style="font-size:13px;opacity:.8;margin-top:4px;">
        ${c.reason ?? "—"}
      </div>
      <div style="font-size:11px;opacity:.6;margin-top:6px;">
        Case #${c.caseNumber}
      </div>
    `;

    /* ===================== CASE ACTIONS ===================== */

    if (perms.case) {
      div.style.cursor = "pointer";
      div.onclick = () => {
        alert(
          `Case #${c.caseNumber}\n` +
          `User: ${c.username}\n` +
          `Type: ${c.type}\n` +
          `Reason: ${c.reason ?? "—"}`
        );
      };
    }

    container.appendChild(div);
  });
}

/* ===================== ACTION BUTTONS ===================== */

function createButton(label, onClick, variant = "") {
  const btn = document.createElement("button");
  btn.textContent = label;
  if (variant) btn.classList.add(variant);
  btn.onclick = onClick;
  return btn;
}

async function loadActions(perms) {
  const actions = document.getElementById("actions");
  actions.innerHTML = "";

  if (perms.warn) {
    actions.appendChild(
      createButton("Warn", () => {
        alert("Warn action (UI only, hook later)");
      })
    );
  }

  if (perms.hackban) {
    actions.appendChild(
      createButton(
        "Hackban",
        () => {
          alert("Hackban action (confirmation flow hook)");
        },
        "danger"
      )
    );
  }

  if (!actions.children.length) {
    const span = document.createElement("span");
    span.style.fontSize = "12px";
    span.style.opacity = ".6";
    span.textContent = "No actions available";
    actions.appendChild(span);
  }
}

/* ===================== INIT ===================== */

(async () => {
  await ensureAuth();
  await loadRole();

  const perms = await loadPermissions();
  await loadActions(perms);
  await loadCases(perms);
})();
