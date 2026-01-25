/**
 * Killfeed Plugin - Settings UI Script
 */

(function() {
  'use strict';

  // DOM elements
  const enabledToggle = document.getElementById('enabled');
  const discordToggle = document.getElementById('allowDiscord');
  const discordSettingsSection = document.getElementById('discordSettings');
  const discordWebhookInput = document.getElementById('discordWebhook');
  const discordPlayerNameInput = document.getElementById('discordPlayerName');
  const discordServerNameInput = document.getElementById('discordServerName');
  const persistModeRadios = document.querySelectorAll('input[name="persistMode"]');
  const epsilonInput = document.getElementById('epsilon');
  const rollingWindowInput = document.getElementById('rollingWindow');
  const saveBtn = document.getElementById('saveBtn');
  const resetBtn = document.getElementById('resetBtn');
  const statusMessage = document.getElementById('statusMessage');

  let currentConfig = null;

  /**
   * Show status message
   */
  function showStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.className = 'status-message ' + (isError ? 'error' : 'success');

    // Auto-hide after 3 seconds
    setTimeout(() => {
      statusMessage.className = 'status-message';
    }, 3000);
  }

  /**
   * Show/hide Discord specific settings
   */
  function updateDiscordVisibility(enabled) {
    if (discordSettingsSection) {
      discordSettingsSection.style.display = enabled ? 'block' : 'none';
    }
  }

  /**
   * Load config from plugin
   */
  async function loadConfig() {
    try {
      currentConfig = await window.plugin.ipc.invoke('cfg:get');
      applyConfigToUI(currentConfig);
    } catch (err) {
      console.error('Failed to load config:', err);
      showStatus('Failed to load settings', true);
    }
  }

  /**
   * Apply config values to UI elements
   */
  function applyConfigToUI(config) {
    if (!config) return;

    enabledToggle.checked = config.enabled !== false;
    discordToggle.checked = config.allowDiscordLeaderboard === true;
    updateDiscordVisibility(discordToggle.checked);

    if (discordWebhookInput) {
      discordWebhookInput.value = config.discordWebhookUrl || '';
    }
    if (discordPlayerNameInput) {
      discordPlayerNameInput.value = config.discordPlayerName || '';
    }
    if (discordServerNameInput) {
      discordServerNameInput.value = config.discordServerName || '';
    }

    // Set persist mode radio
    for (const radio of persistModeRadios) {
      radio.checked = radio.value === config.persistMode;
    }

  epsilonInput.value = config.epsilon || 0.001;
    rollingWindowInput.value = config.rollingWindowSec || 300;
  }

  /**
   * Gather values from UI into config object
   */
  function gatherConfigFromUI() {
    let persistMode = 'none';
    for (const radio of persistModeRadios) {
      if (radio.checked) {
        persistMode = radio.value;
        break;
      }
    }

    return {
      enabled: enabledToggle.checked,
      allowDiscordLeaderboard: discordToggle.checked,
      discordWebhookUrl: (discordWebhookInput?.value || '').trim(),
      discordPlayerName: (discordPlayerNameInput?.value || '').trim(),
      discordServerName: (discordServerNameInput?.value || '').trim(),
      persistMode: persistMode,
      epsilon: parseFloat(epsilonInput.value) || 0.001,
      rollingWindowSec: parseInt(rollingWindowInput.value, 10) || 300
    };
  }

  /**
   * Save config to plugin
   */
  async function saveConfig() {
    try {
      const newConfig = gatherConfigFromUI();
      const result = await window.plugin.ipc.invoke('cfg:set', newConfig);

      if (result.success) {
        currentConfig = { ...currentConfig, ...newConfig };
        showStatus('Settings saved successfully');
      } else {
        showStatus('Validation failed: ' + (result.errors || []).join(', '), true);
      }
    } catch (err) {
      console.error('Failed to save config:', err);
      showStatus('Failed to save settings', true);
    }
  }

  /**
   * Reset config to defaults
   */
  async function resetConfig() {
    try {
      const result = await window.plugin.ipc.invoke('cfg:reset');

      if (result.success) {
        currentConfig = result.config;
        applyConfigToUI(currentConfig);
        showStatus('Settings reset to defaults');
      } else {
        showStatus('Failed to reset settings', true);
      }
    } catch (err) {
      console.error('Failed to reset config:', err);
      showStatus('Failed to reset settings', true);
    }
  }

  // Event listeners
  saveBtn.addEventListener('click', saveConfig);
  resetBtn.addEventListener('click', resetConfig);
  discordToggle.addEventListener('change', () => updateDiscordVisibility(discordToggle.checked));

  // Initial load
  window.addEventListener('load', loadConfig);
})();
