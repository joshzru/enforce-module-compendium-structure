const CONFIG = "compendiumConfiguration";
const expectedFolders = new Map();
const protectedFolders = new Set();


// Setup the expected folder information for each pack
Hooks.once("setup", () => {
    // Map each module folder
    for ( const module of game.modules ) {
        if ( !module.active ) continue;
        for (const folder of module.packFolders.values()) {
            mapFolders(folder, 1, module.id, []);
        }
    }

    // Map each system folder
    const system = game.system;
    for (const folder of system.packFolders) {
        mapFolders(folder, 1, system.id, []);
    }
})

Hooks.once("ready", validatePackFolders);

Hooks.on("preUpdateFolder", (folder, changed) => {
    if ( !protectedFolders.has(folder._id) ) return;
    if ( "folder" in changed ) {
        ui.notifications.info("Action prevented: Module folders cannot be moved")
        delete changed.folder;
    }
})

Hooks.on("preDeleteFolder", (folder) => {
    if ( protectedFolders.has(folder._id) ) {
        ui.notifications.info("Action prevented: Module folders cannot be deleted");
        return false;
    }
})

Hooks.on("preUpdateSetting", async (setting, changed) => {
    if ( setting.key !== `core.${CONFIG}` ) return;
    const changedConfig = JSON.parse(changed.value);
    let invalid = false;
    let modified = false;

    for (const [collection, folderData] of Object.entries(changedConfig ?? {})) {
        const moduleId = collection.split(".")[0];
        if ( moduleId === "world" ) continue;

        const correctFolder = expectedFolders.get(collection);
        if ( !correctFolder || !game.folders.has(correctFolder.id) ) {
            delete changedConfig[collection];
            invalid = true;
        }
        else if ( correctFolder.id !== folderData.folder ) {
            folderData.folder = correctFolder.id;
            modified = true;
        }
    }
    if ( modified || invalid ) {
        if ( invalid ) ui.notifications.warn("Expected module folder not found, please reload the world to fix");
        if ( modified ) ui.notifications.info("Action prevented: Module packs cannot be moved to another folder");
        changed.value = JSON.stringify(changedConfig);
    }
})

async function validatePackFolders() {
    const config = getConfig();
    let changed = false;
    let repairable = true;

    for ( const pack of game.packs ) {
        if ( pack.packageType === "world" ) continue;

        const correctFolder = expectedFolders.get(pack.collection);

        // If the folder information is invalid, or if the expected folder
        // doesn't exist, invalidate its entry in compendiumConfiguration
        if ( !correctFolder?.id || !game.folders.has(correctFolder.id) ) {
            if ( Object.hasOwn(config, pack.collection) ) {
                delete config[pack.collection];
                changed = true;
                repairable = false;
            }
        }

        // If the actual folder is different from the expected folder, revert
        // to the expected folder
        else if ( config[pack.collection]?.folder !== correctFolder.id ) {
            config[pack.collection] ??= {};
            config[pack.collection].folder = correctFolder.id;
            changed = true;
        }
    }
    if ( changed ) await setConfig(config);
    if ( !repairable ) ui.notifications.warn("Irrepairable compendium configuration detected, please reload the world to fix")
    
}


function invalidateModule(module, config) {
    // Delete each entry in compendiumConfiguration and our recorded folder
    // information for packs in this module
    for (const packData of module.packs.values()) {
        if ( Object.hasOwn(config, packData.id) ) delete config[packData.id];
        if ( expectedFolders.has(packData.id) ) expectedFolders.delete(packData.id)
    }
}


function mapFolders(folder, depth, prefix, path) {
    const folderId = getFolderIdFromName(folder.name, depth, path);
    if ( !folderId ) return;

    protectedFolders.add(folderId);
    // Assign each pack's expected folder information
    for ( const packName of folder.packs.values() ) {
        expectedFolders.set(`${prefix}.${packName}`,
            {
                id: folderId
            });
    }

    // Recursively map each subfolder
    for ( const subFolder of folder.folders.values() ) {
        mapFolders(subFolder, depth + 1, prefix, path.concat(folder.name))
    }
}


function getFolderIdFromName(name, depth, path) {
    for ( const folder of game.folders ) {
        // Ignore any folder without the same name and depth
        if ( folder.name !== name || folder.depth !== depth ) continue;

        // If both folders have the same path, they're the same
        const folderPath = folder.ancestors.map(f => f.name).reverse();
        if ( folderPath.join("/") === path.join("/") ) return folder._id; 
    }
    return null;
}


function getConfig() {
    return foundry.utils.deepClone(
        game.settings.get("core", CONFIG)
    );
}

async function setConfig(config) {
    await game.settings.set("core", CONFIG, config);
}
