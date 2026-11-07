/// <reference types="vite/client" />
import { type IStyleStore, type OnStyleChangedCallback } from "../definitions";
import { getStyleUrlFromAddressbarAndRemoveItIfNeeded, loadStyleUrl } from "../urlopen";
import { emptyStyle } from "../style";
import { loadOpenmapStyle, OpenmapLoadError, startOpenmapSession, type OpenmapFailure, type OpenmapSession } from "../openmap";
import { ApiStyleStore } from "./apistore";
import { StyleStore } from "./stylestore";

// Told to the app when the editor was opened from openmap.lt.
export type OpenmapStartInfo = {
  session: OpenmapSession
  // Set when the profile's style could not be read; saving is then disabled.
  loadError: OpenmapFailure | null
};

export async function createStyleStore(
  onStyleChanged: OnStyleChangedCallback,
  onOpenmapStart?: (info: OpenmapStartInfo) => void,
): Promise<IStyleStore> {
  // Opened from openmap.lt: the profile's style from the server is the source,
  // not whatever is in local storage, and there is no "discard changes?" prompt.
  const openmap = startOpenmapSession();
  if (openmap) {
    let loadError: OpenmapFailure | null = null;
    let style = emptyStyle;
    try {
      style = await loadOpenmapStyle(openmap);
    } catch (error) {
      loadError = error instanceof OpenmapLoadError ? error.failure : { kind: "other", message: "Nepavyko užkrauti stiliaus." };
    }
    onOpenmapStart?.({ session: openmap, loadError });
    onStyleChanged(style, {initialLoad: true, save: false});
    return new StyleStore();
  }

  const styleUrl = getStyleUrlFromAddressbarAndRemoveItIfNeeded();
  const useStyleUrl = styleUrl && window.confirm("Load style from URL: " + styleUrl + " and discard current changes?");
  let styleStore: IStyleStore;
  if (import.meta.env.MODE === "desktop" && !useStyleUrl) {
    const apiStyleStore = new ApiStyleStore({
      onLocalStyleChange: mapStyle => onStyleChanged(mapStyle, {save: false}),
    });
    try {
      await apiStyleStore.init();
      styleStore = apiStyleStore;
    } catch {
      styleStore = new StyleStore();
    }
  } else {
    styleStore = new StyleStore();
  }
  const styleToLoad = useStyleUrl ? await loadStyleUrl(styleUrl) : await styleStore.getLatestStyle();
  onStyleChanged(styleToLoad, {initialLoad: true, save: false});
  return styleStore;
}

export type { IStyleStore };
