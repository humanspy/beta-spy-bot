import { SlashCommandBuilder } from "discord.js";

export const commands = [
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Initialize the bot for this server")
].map(c => c.toJSON());
