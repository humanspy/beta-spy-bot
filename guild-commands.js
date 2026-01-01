import { SlashCommandBuilder } from "discord.js";

export const guildCommands = [

  /* ===================== MODERATION ===================== */

  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Interactive setup wizard")
    .addSubcommand(sub => sub.setName("start").setDescription("Run setup"))
    .addSubcommand(sub => sub.setName("view").setDescription("View setup"))
    .addSubcommand(sub => sub.setName("reset").setDescription("Reset setup")),
  
  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Manage warnings")
    .addSubcommand(sub =>
      sub.setName("add")
        .setDescription("Warn a user")
        .addUserOption(o =>
          o.setName("user").setDescription("User").setRequired(true)
        )
        .addStringOption(o =>
          o.setName("reason").setDescription("Reason").setRequired(true)
        )
        .addStringOption(o =>
          o.setName("severity").setDescription("minor / moderate / severe")
        )
        .addBooleanOption(o =>
          o.setName("silent").setDescription("Do not DM the user")
        )
    )
    .addSubcommand(sub =>
      sub.setName("remove")
        .setDescription("Clear warnings for a user")
        .addUserOption(o =>
          o.setName("user").setDescription("User").setRequired(true)
        )
    ),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Manage timeouts")
    .addSubcommand(sub =>
      sub.setName("add")
        .setDescription("Timeout a user")
        .addUserOption(o =>
          o.setName("user").setDescription("User").setRequired(true)
        )
        .addStringOption(o =>
          o.setName("duration")
            .setDescription("Duration")
            .setRequired(true)
            .addChoices(
              { name: "1 minute", value: "1min" },
              { name: "5 minutes", value: "5min" },
              { name: "10 minutes", value: "10min" },
              { name: "1 hour", value: "1hour" },
              { name: "1 day", value: "1day" },
              { name: "1 week", value: "1week" }
            )
        )
        .addStringOption(o =>
          o.setName("reason").setDescription("Reason").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName("remove")
        .setDescription("Remove a timeout")
        .addUserOption(o =>
          o.setName("user").setDescription("User").setRequired(true)
        )
        .addStringOption(o =>
          o.setName("reason").setDescription("Reason")
        )
    ),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Manage bans")
    .addSubcommand(sub =>
      sub.setName("add")
        .setDescription("Ban a user")
        .addStringOption(o =>
          o.setName("target").setDescription("User mention or ID").setRequired(true)
        )
        .addStringOption(o =>
          o.setName("reason").setDescription("Reason").setRequired(true)
        )
        .addBooleanOption(o =>
          o.setName("hackban").setDescription("Ban by ID")
        )
        .addIntegerOption(o =>
          o.setName("delete_days").setDescription("Delete messages (0–7)")
        )
        .addStringOption(o =>
          o.setName("override_code").setDescription("Override code")
        )
    )
    .addSubcommand(sub =>
      sub.setName("remove")
        .setDescription("Unban a user")
        .addStringOption(o =>
          o.setName("user_id").setDescription("User ID").setRequired(true)
        )
        .addStringOption(o =>
          o.setName("reason").setDescription("Reason")
        )
        .addStringOption(o =>
          o.setName("override_code").setDescription("Override code")
        )
    ),

  new SlashCommandBuilder()
    .setName("case")
    .setDescription("Manage cases")
    .addSubcommand(sub =>
      sub.setName("view")
        .setDescription("View cases")
        .addIntegerOption(o =>
          o.setName("number").setDescription("Case number")
        )
        .addUserOption(o =>
          o.setName("user").setDescription("User")
        )
        .addStringOption(o =>
          o.setName("severity").setDescription("minor / moderate / severe")
        )
    )
    .addSubcommand(sub =>
      sub.setName("remove")
        .setDescription("Delete a case")
        .addIntegerOption(o =>
          o.setName("number").setDescription("Case number").setRequired(true)
        )
        .addBooleanOption(o =>
          o.setName("revert_warn").setDescription("Undo warning")
        )
    ),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages")
    .addIntegerOption(o =>
      o.setName("amount").setDescription("Amount").setRequired(true)
    )
    .addUserOption(o =>
      o.setName("user").setDescription("Only messages from this user")
    ),

  new SlashCommandBuilder()
    .setName("generatebancode")
    .setDescription("Generate a one-time ban override code"),

  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show all moderation commands"),

  /* ===================== MUSIC ===================== */

 new SlashCommandBuilder()
  .setName("music")
  .setDescription("Music controls")
  .addSubcommand(sub =>
    sub
      .setName("play")
      .setDescription("Play a song")
      .addStringOption(o =>
        o.setName("query")
          .setDescription("Song name or URL")
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName("pause")
      .setDescription("Pause the music")
  )
  .addSubcommand(sub =>
    sub
      .setName("stop")
      .setDescription("Stop music and leave the voice channel")
  )
  .addSubcommand(sub =>
    sub
      .setName("skip")
      .setDescription("Skip the current song")
  )
  .addSubcommand(sub =>
    sub
      .setName("queue")
      .setDescription("Show the music queue")
  )
  .addSubcommand(sub =>
    sub
      .setName("current")
      .setDescription("Show the currently playing song")
  )
  .addSubcommand(sub =>
    sub
      .setName("volume")
      .setDescription("Set the music volume")
      .addIntegerOption(o =>
        o.setName("level")
          .setDescription("Volume (0–100)")
          .setRequired(true)
          .setMinValue(0)
          .setMaxValue(100)
      )
  ),

  /* ===================== LEVEL ===================== */
 
  new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Show your level or another user's")
    .addUserOption(o =>
      o.setName("user").setDescription("Target user")
    ),

  new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Show the server leaderboard"),
 
  new SlashCommandBuilder()
    .setName("lvlroles")
    .setDescription("Configure level-based roles using a setup wizard")
    .addSubcommand(sub =>
      sub
        .setName("setup")
        .setDescription("Start the level roles setup wizard")
    )
    .addSubcommand(sub =>
      sub
        .setName("config")
        .setDescription("Edit existing level roles using the setup wizard")
    ),


].map(cmd => cmd.toJSON());


