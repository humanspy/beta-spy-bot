import { handleModeration } from "./moderation/commands/index.js";
import { handleMusic } from "./music/router.js";
import { handleProfile } from "./profile/level/index.js";
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

  /* ===================== MUSIC ===================== */
  try {
    const handled = await handleMusic(interaction);
    if (handled) {
      console.log("[ROUTER] → music");
      return;
    }
  } catch (err) {
    console.error("[ROUTER] Music error:", err);
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
    throw err;
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



