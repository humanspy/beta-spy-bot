import lvlrolesSetup from "./lvlroles-setup.js";

export default async function lvlrolesConfig(interaction) {
  // Just reuse the setup wizard
  return lvlrolesSetup(interaction);
}
