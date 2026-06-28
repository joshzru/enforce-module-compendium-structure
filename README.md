# Enforce Module Compendium Structure

Foundry VTT stores compendium folder assignments in the `core.compendiumConfiguration`
setting. If a module's compendium folder structure is modified, Foundry does not
automatically rebuild the expected structure. The usual fix is to clear the
setting from the console by running

```javascript
await game.settings.set("core", "compendiumConfiguration", {});
```

This module automates that recovery process for module and system compendiums.

On startup it records the expected compendium folder structure defined by active
modules and the current game system. Irrepairable compendium configuration
entries are automatically removed allowing Foundry to regenerate the correct
structure on a world reload.

Additionally, users are prevented from:

* Moving protected module or system compendium folders
* Deleting protected module or system compendium folders
* Reassigning module or system compendium packs to different folders.

