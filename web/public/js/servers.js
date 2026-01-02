async function ensureAuth() {
  const res = await fetch("/api/me");
  if (res.status === 401) {
    window.location = "/";
    return null;
  }
  return res.json();
}

async function loadGuilds() {
  const res = await fetch("/api/guilds");
  const guilds = await res.json();

  const el = document.getElementById("guilds");
  el.innerHTML = "";

  guilds.forEach(g => {
    const div = document.createElement("div");
    div.className = "guild fade-in";
    div.textContent = g.name;

    div.onclick = () => {
      window.location = `/cases.html?guildId=${g.id}`;
    };

    el.appendChild(div);
  });
}

async function logout() {
  await fetch("/api/logout", { method: "POST" });
  window.location = "/";
}

(async () => {
  await ensureAuth();
  await loadGuilds();
})();
