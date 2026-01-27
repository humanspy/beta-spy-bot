import { hasPermission } from "../../../moderation/core.js";

async function updateNickname({ interaction, member, nickname, reason }) {
  try {
    await member.setNickname(nickname, reason);
    return true;
  } catch {
    await interaction.editReply(
      "❌ Unable to update nickname. Check bot permissions and role position."
    );
    return false;
  }
}

export default async function nick(interaction) {
  if (!interaction.inGuild()) {
    return interaction.reply({
      content: "❌ This command can only be used in a server.",
      flags: 64,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const sub = interaction.options.getSubcommand();
  const guild = interaction.guild;
  const actor = interaction.user;

  if (sub === "add") {
    const name = interaction.options.getString("name", true);
    const member = await guild.members.fetch(actor.id).catch(() => null);
    if (!member) {
      return interaction.editReply("❌ Unable to find your member record.");
    }

    const updated = await updateNickname({
      interaction,
      member,
      nickname: name,
      reason: `Nickname set by ${actor.tag}`,
    });
    if (!updated) return false;

    return interaction.editReply(`✅ Your nickname is now **${name}**.`);
  }

  if (sub === "reset") {
    const member = await guild.members.fetch(actor.id).catch(() => null);
    if (!member) {
      return interaction.editReply("❌ Unable to find your member record.");
    }

    const updated = await updateNickname({
      interaction,
      member,
      nickname: null,
      reason: `Nickname reset by ${actor.tag}`,
    });
    if (!updated) return false;

    return interaction.editReply("✅ Your nickname has been reset.");
  }

  if (sub === "force" || sub === "forcereset") {
    if (!(await hasPermission(interaction.member, "warn"))) {
      return interaction.editReply("❌ No permission.");
    }

    const target = interaction.options.getUser("target", true);
    const member = await guild.members.fetch(target.id).catch(() => null);
    if (!member) {
      return interaction.editReply("❌ Unable to find that member.");
    }

    const nickname =
      sub === "force" ? interaction.options.getString("name", true) : null;
    const reason =
      sub === "force"
        ? `Nickname forced by ${actor.tag}`
        : `Nickname reset by ${actor.tag}`;

    const updated = await updateNickname({
      interaction,
      member,
      nickname,
      reason,
    });
    if (!updated) return false;

    return interaction.editReply(
      sub === "force"
        ? `✅ **${target.tag}** is now **${nickname}**.`
        : `✅ **${target.tag}** nickname has been reset.`
    );
  }

  return interaction.editReply("❌ Invalid subcommand.");
}
