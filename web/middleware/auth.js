export function requireAuth(req, res, next) {
  if (!req.cookies.session) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

export function requireGuildAccess(req, res, next) {
  const { guildId } = req.params;
  const session = req.cookies.session;

  const allowed = session.guilds.some(
    g => g.id === guildId && (g.permissions & 0x8)
  );

  if (!allowed) {
    return res.status(403).json({ error: "Forbidden" });
  }

  next();
}
