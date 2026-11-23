"use strict";
import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

class GateCardSettings extends FormattingSettingsCard {
    title = new formattingSettings.TextInput({
        name: "title", displayName: "Title", value: "Protected pages", placeholder: "Protected pages"
    });
    salt = new formattingSettings.TextInput({
        name: "salt", displayName: "Salt (must match the one used to make hashes)", value: "pagelock", placeholder: "pagelock"
    });
    accent = new formattingSettings.ColorPicker({
        name: "accent", displayName: "Accent colour", value: { value: "#2F6DB5" }
    });
    showHashTool = new formattingSettings.ToggleSwitch({
        name: "showHashTool", displayName: "Show hash generator (admin only)", value: false
    });
    name: string = "gate";
    displayName: string = "Lock settings";
    slices: Array<FormattingSettingsSlice> = [this.title, this.salt, this.accent, this.showHashTool];
}

export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    gateCard = new GateCardSettings();
    cards = [this.gateCard];
}
