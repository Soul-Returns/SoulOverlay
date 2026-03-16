<script setup lang="ts">
import { ref, onMounted, toRaw } from "vue";
import PanelHeader from "@/components/ui/PanelHeader.vue";
import AlertBanner from "@/components/ui/AlertBanner.vue";
import ToggleSwitch from "@/components/ui/ToggleSwitch.vue";
import SettingsField from "@/components/settings/SettingsField.vue";
import OpacitySlider from "@/components/settings/OpacitySlider.vue";
import CacheSettingsPanel from "@/components/settings/CacheSettingsPanel.vue";
import { useSettingsStore } from "@/stores/settings";
import type { Settings } from "@/stores/settings";

const appVersion = __APP_VERSION__;

const emit = defineEmits<{
  (e: "close"): void;
  (e: "open-keybinds"): void;
  (e: "open-update-modal"): void;
}>();

const settingsStore = useSettingsStore();

const form = ref<Settings>(structuredClone(toRaw(settingsStore.settings)));

const saving = ref(false);
const saveError = ref<string | null>(null);
const saveSuccess = ref(false);

onMounted(() => {
  form.value = structuredClone(toRaw(settingsStore.settings));
});

async function handleSave() {
  saving.value = true;
  saveError.value = null;
  saveSuccess.value = false;

  try {
    // Preserve fields edited by other panels — their values in form.value may be stale.
    // cache_ttls: edited inline by CacheSettingsPanel
    // hotkey + keybinds: edited by KeybindsModal
    // layout_widths: edited by drag handles in App.vue
    const live = toRaw(settingsStore.settings);
    const toSave: Settings = {
      ...form.value,
      cache_ttls: live.cache_ttls,
      hotkey: live.hotkey,
      keybinds: { ...live.keybinds },
      layout_widths: { ...live.layout_widths },
    };
    await settingsStore.saveSettings(toSave);
    saveSuccess.value = true;
    setTimeout(() => {
      saveSuccess.value = false;
    }, 2000);
  } catch (e) {
    saveError.value = String(e);
  } finally {
    saving.value = false;
  }
}

function resetDefaults() {
  form.value = structuredClone(settingsStore.defaults);
}
</script>

<template>
  <div class="h-full bg-[#111318] border-l border-white/10 flex flex-col overflow-hidden">
    <PanelHeader title="Settings" @close="emit('close')" />

    <div class="flex-1 overflow-y-auto px-5 py-4 space-y-5">
      <!-- Application -->
      <div>
        <label class="block text-white/60 text-xs font-medium uppercase tracking-wider mb-1.5">
          Application
        </label>
        <div class="flex items-center gap-3">
          <span class="text-white/40 text-xs flex-1">Version {{ appVersion }}</span>
          <button
            @click="emit('open-update-modal')"
            class="bg-white/5 border border-white/10 hover:border-white/20 rounded-lg px-3 py-1.5 text-sm text-white/70 hover:text-white transition-colors"
          >
            Check for Updates
          </button>
        </div>
      </div>

      <!-- Keybinds editor shortcut -->
      <div>
        <button
          @click="emit('open-keybinds')"
          class="w-full bg-white/5 border border-white/10 hover:border-white/20 rounded-lg px-3 py-2 text-sm text-white/70 hover:text-white text-left transition-colors flex items-center justify-between"
        >
          <span>Edit All Keybinds</span>
          <svg class="w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <!-- UEX API Key -->
      <div>
        <label class="block text-white/60 text-xs font-medium uppercase tracking-wider mb-1.5">
          UEX API Key
        </label>
        <input
          v-model="form.uex_api_key"
          type="password"
          placeholder="Enter your UEX Corp API key"
          class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
        />
        <p class="text-white/30 text-xs mt-1">
          Get your API key from
          <a href="https://uexcorp.space" class="text-blue-400/60 hover:text-blue-400">uexcorp.space</a>
        </p>
      </div>

      <!-- UEX Secret Key -->
      <div>
        <label class="block text-white/60 text-xs font-medium uppercase tracking-wider mb-1.5">
          UEX Secret Key
        </label>
        <input
          v-model="form.uex_secret_key"
          type="password"
          placeholder="Enter your UEX Corp secret key"
          class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
        />
        <p class="text-white/30 text-xs mt-1">
          Required for Hangar. Found in your
          <a href="https://uexcorp.space/account" class="text-blue-400/60 hover:text-blue-400">account settings</a>
          on uexcorp.space
        </p>
      </div>

      <!-- Log Path -->
      <SettingsField
        label="Game Log Path (optional)"
        hint="Default: %APPDATA%\..\Local\Star Citizen\StarCitizen\LIVE\game.log"
      >
        <input
          v-model="form.log_path"
          type="text"
          placeholder="Leave empty for default path"
          class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
        />
      </SettingsField>

      <!-- Opacity Slider -->
      <OpacitySlider v-model="form.overlay_opacity" />

      <!-- Font Size -->
      <SettingsField
        label="Font Size"
        :hint="`Base font size: ${form.font_size}px`"
      >
        <div class="flex items-center gap-3">
          <input
            v-model.number="form.font_size"
            type="range"
            min="8"
            max="32"
            step="1"
            class="flex-1 accent-blue-500"
          />
          <span class="text-white/60 text-xs w-10 text-right">{{ form.font_size }}px</span>
        </div>
      </SettingsField>

      <!-- ESC closes overlay -->
      <ToggleSwitch
        v-model="form.esc_closes_overlay"
        label="ESC closes overlay"
        description="When disabled, ESC only clears the search bar"
      />

      <!-- Reset on open -->
      <ToggleSwitch
        v-model="form.reset_on_open"
        label="Reset on open"
        description="Switch to Search tab and focus input when overlay opens"
      />

      <!-- Max search results -->
      <SettingsField
        label="Max Search Results"
        hint="Limits results returned per search query (1–500)"
      >
        <input
          v-model.number="form.max_search_results"
          type="number"
          min="1"
          max="500"
          step="1"
          class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
        />
      </SettingsField>

      <!-- Cache Management -->
      <CacheSettingsPanel />

      <!-- Feedback -->
      <AlertBanner v-if="saveError" variant="error" :message="saveError" />
      <AlertBanner v-if="saveSuccess" variant="success" message="Settings saved successfully!" />
    </div>

    <!-- Actions -->
    <div class="px-5 py-4 border-t border-white/10 flex items-center gap-3">
      <button
        @click="handleSave"
        :disabled="saving"
        class="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
      >
        {{ saving ? "Saving..." : "Save Settings" }}
      </button>
      <button
        @click="resetDefaults"
        class="text-white/40 hover:text-white text-sm py-2 px-3 rounded-lg hover:bg-white/5 transition-colors"
      >
        Reset
      </button>
    </div>
  </div>
</template>
