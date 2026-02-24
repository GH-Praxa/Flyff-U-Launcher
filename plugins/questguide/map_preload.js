'use strict';

/**
 * Preload script for the NPC map window.
 *
 * The map window is opened by quest:map:open. The token stored in
 * window.location.hash identifies which map dataset to fetch from the
 * main process (keyed in mapWindowData by token).
 */
const { contextBridge, ipcRenderer } = require('electron');

// Token is placed in the URL hash by main.js when loading the file.
const token = window.location.hash.slice(1);

contextBridge.exposeInMainWorld('mapApi', {
    getMapData: () => ipcRenderer.invoke('questguide:map-data', token)
});
