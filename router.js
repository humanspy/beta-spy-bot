import { handleModeration } from "./moderation/commands/index.js";
import { handleProfile } from "./profile/router.js";
import { handleModmail } from "./modmail/index.js";

/**
 * Central interaction router
 * This file is the single source of truth for command routing.
 */
export async function routeInteraction(interaction) {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.commandName;

  console.log(`[ROUTER] /${command}`);

  /* ===================== PROFILE ===================== */
  try {
    const handled = await handleProfile(interaction);
    if (handled) {
      console.log("[ROUTER] → profile");
      return;
    }
  } catch (err) {
    console.error("[ROUTER] Profile error:", err);
    throw err;
  }

  /* ===================== MODERATION ===================== */
  try {
    const handled = await handleModeration(interaction);
    if (handled) {
      console.log("[ROUTER] → moderation");
      return;
    }
  } catch (err) {
    console.error("[ROUTER] Moderation error:", err);
  
    if (!interaction.replied && interaction.isRepliable()) {
      await interaction.reply({
        content: "❌ Moderation command failed. Check permissions or logs.",
        flags: 64,
      });
    }

  return;
}

  
  /* ===================== MODMAIL ===================== */
  try {
    const handled = await handleModmail(interaction);
    if (handled) {
      console.log("[ROUTER] → modmail");
      return;
    }
  } catch (err) {
    console.error("[ROUTER] ModMail error:", err);
    throw err;
  }


  /* ===================== FALLBACK ===================== */
  console.warn(`[ROUTER] Unhandled command: /${command}`);
}






