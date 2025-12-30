import fs from "fs/promises";

export async function logAudit(entry) {
  const record = {
    ...entry,
    timestamp: new Date().toISOString(),
  };

  await fs.appendFile(
    "./web/audit.log",
    JSON.stringify(record) + "\n"
  );
}

export async function logConfirmation(entry) {
  await logAudit({
    ...entry,
    type: "CONFIRMATION",
  });
}
