/**
 * Elect one stable migration owner from the currently connected GMs. Foundry
 * synchronizes the same world setting to every client, but it does not make a
 * read-then-write migration transaction atomic. Sorting by user id gives every
 * client the same owner without relying on connection order.
 *
 * @return {boolean} Whether this client is allowed to run world migrations.
 */
export const isMigrationAuthority = function() {
  const activeGMs = Array.from(game.users ?? [])
    .filter(user => user.active && user.isGM)
    .sort((left, right) => {
      const leftId = String(left.id);
      const rightId = String(right.id);
      return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
    });

  // `game.users` is always available in Foundry. The fallback keeps direct
  // migration callers and minimal test environments backward compatible.
  if (!activeGMs.length) return game.user?.isGM ?? true;
  return game.user?.id === activeGMs[0].id;
};

/**
 * Perform the legacy 0.5.4 actor migration for the entire World.
 * @return {Promise<boolean>} Whether this client applied a migration.
 */
export const migrateWorld = async function() {
  if (!isMigrationAuthority()) return false;

  // Re-read after authority election. Another active GM may have completed the
  // migration while this client was starting up.
  const currentVersion = String(game.settings.get("brinkwood-reforged", "systemMigrationVersion") ?? "0");
  if (!foundry.utils.isNewerVersion(game.system.version, currentVersion)) return false;

  ui.notifications.info(`Applying Brinkwood Actors migration for version ${game.version}. Please be patient and do not close your game or shut down your server.`, {permanent: true});

  if (foundry.utils.isNewerVersion("0.5.4", currentVersion)) {
    const classPack = game.packs.get("brinkwood-reforged.class");
    const professionPack = game.packs.get("brinkwood-reforged.profession");
    const [classIndex, professionIndex] = await Promise.all([
      classPack.getIndex({fields: ["name"]}),
      professionPack.getIndex({fields: ["name"]})
    ]);

    for (const actor of game.actors) {
      const oldClass = actor.items.find(item => item.type === "class");
      const oldProfession = actor.items.find(item => item.type === "profession");

      if (oldClass) {
        const entry = classIndex.find(item => item.name === oldClass.name);
        const replacement = entry ? await classPack.getDocument(entry._id) : null;
        if (replacement) {
          const update = replacement.toObject();
          delete update._id;
          await oldClass.update(update);
        }
      }

      if (oldProfession) {
        const entry = professionIndex.find(item => item.name === oldProfession.name);
        const replacement = entry ? await professionPack.getDocument(entry._id) : null;
        if (replacement) {
          const update = replacement.toObject();
          delete update._id;
          await oldProfession.update(update);
        }
      }
    }
  }

  // v13 initially created automatic source traits without source flags.
  // Run this once as the GM, not from a sheet render, so adoption and future
  // source deletion use the actor's authoritative embedded-document path.
  if (foundry.utils.isNewerVersion("0.6.13", currentVersion)) {
    for (const actor of game.actors) {
      if (actor.type !== "character") continue;
      if (typeof actor.reconcileTraitGrants !== "function") {
        throw new Error(`Character actor ${actor.id ?? actor.name ?? "<unknown>"} must implement reconcileTraitGrants for migration.`);
      }
      await actor.reconcileTraitGrants();
    }
  }

  // Tyranny stopped being a four-segment clock in 0.7.1.  Keep the legacy
  // max field for backwards compatibility, while making the migration safe
  // to repeat and preserving every existing level.
  if (foundry.utils.isNewerVersion("0.7.1", currentVersion)) {
    for (const actor of game.actors) {
      if (actor.type !== "rebelion") continue;
      const tyranny = actor.system?.tyranny ?? {};
      const value = Math.max(0, Math.trunc(Number(tyranny.value) || 0));
      const max = Math.max(4, Math.trunc(Number(tyranny.max) || 4));
      if (value !== tyranny.value || max !== tyranny.max) await actor.update({ "system.tyranny": { ...tyranny, value, max } });
    }
  }

  await game.settings.set("brinkwood-reforged", "systemMigrationVersion", game.system.version);
  ui.notifications.info(`Brinkwood System Migration version ${game.system.version} completed!`, {permanent: true});
  return true;
};
