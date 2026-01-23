import { handleModeration } from "./moderation/commands/index.js";
import { handleProfile } from "./profile/router.js";
import { handleModmail } from "./modmail/index.js";
import { handleInviteSyncCommand } from "./invite-handler/index.js";
import { handleAnnouncementSyncCommand } from "./announcement-handler/index.js";

/**
 * Central interaction router
 * This file is the single source of truth for command routing.
 */
export async function routeInteraction(interaction) {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.commandName;

  console.log(`[ROUTER] /${command}`);

  /* ===================== INVITE HANDLER ===================== */
  try {
    const handled = await handleInviteSyncCommand(interaction, interaction.client);
    if (handled) {
      console.log("[ROUTER] → invite-handler");
      return;
    }
  } catch (err) {
    console.error("[ROUTER] Invite handler error:", err);
    throw err;
  }

  /* ===================== ANNOUNCEMENT HANDLER ===================== */
  try {
    const handled = await handleAnnouncementSyncCommand(
      interaction,
      interaction.client
    );
    if (handled) {
      console.log("[ROUTER] → announcement-handler");
      return;
    }
  } catch (err) {
    console.error("[ROUTER] Announcement handler error:", err);
    throw err;
  }

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






