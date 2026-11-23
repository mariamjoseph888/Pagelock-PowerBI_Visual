"use strict";
import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import * as models from "powerbi-models";
import "./../style/visual.less";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import IVisualEventService = powerbi.extensibility.IVisualEventService;
import FilterAction = powerbi.FilterAction;

import { VisualFormattingSettingsModel } from "./settings";
import { sha256Hex } from "./sha";

interface Cred { email: string; hash: string; }

export class Visual implements IVisual {
    private host: IVisualHost;
    private events: IVisualEventService;
    private root: HTMLElement;
    private fsService: FormattingSettingsService;
    private fs: VisualFormattingSettingsModel;

    private creds = new Map<string, Cred>();
    private target: models.IFilterColumnTarget | null = null;
    private unlockedEmail: string | null = null;
    private hasData = false;

    private emailVal = "";
    private passVal = "";
    private toolEmail = "";
    private toolPass = "";
    private msg = "";
    private fails = 0;
    private lockUntil = 0;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.events = options.host.eventService;
        this.fsService = new FormattingSettingsService();
        this.root = document.createElement("div");
        this.root.className = "pagelock";
        options.element.appendChild(this.root);
    }

    public update(options: VisualUpdateOptions): void {
        this.events.renderingStarted(options);
        try {
            const dv = options.dataViews && options.dataViews[0];
            this.fs = this.fsService.populateFormattingSettingsModel(VisualFormattingSettingsModel, dv);
            this.readData(dv);

            const f = options.jsonFilters && (options.jsonFilters[0] as models.IBasicFilter | undefined);
            const val = f && f.values && f.values.length === 1 ? String(f.values[0]) : null;
            this.unlockedEmail = val && this.creds.has(val.toLowerCase()) ? val : null;
            if (this.unlockedEmail === null && val !== null && this.creds.size === 0) {
                this.unlockedEmail = val; // table is filtered to the signed-in user: keep showing unlocked
            }
            this.render();
            this.events.renderingFinished(options);
        } catch (e) {
            this.events.renderingFailed(options, String(e));
        }
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.fsService.buildFormattingModel(this.fs);
    }

    private readData(dv: powerbi.DataView | undefined): void {
        this.creds.clear();
        this.hasData = false;
        const t = dv && dv.table;
        if (!t) { return; }
        const ei = t.columns.findIndex(c => c.roles && c.roles["email"]);
        const hi = t.columns.findIndex(c => c.roles && c.roles["hash"]);
        if (ei < 0 || hi < 0) { return; }
        this.hasData = true;
        const q = t.columns[ei].queryName || "";
        const dot = q.indexOf(".");
        this.target = dot > 0 ? { table: q.substring(0, dot), column: q.substring(dot + 1) } : null;
        for (const r of t.rows) {
            const email = r[ei] == null ? "" : String(r[ei]).trim();
            const hash = r[hi] == null ? "" : String(r[hi]).trim().toLowerCase();
            if (email && hash) { this.creds.set(email.toLowerCase(), { email, hash }); }
        }
    }

    private salt(): string { return this.fs.gateCard.salt.value || "pagelock"; }
    private hashOf(email: string, pass: string): Promise<string> {
        return sha256Hex(this.salt() + ":" + email.trim().toLowerCase() + ":" + pass);
    }

    private async tryUnlock(): Promise<void> {
        if (Date.now() < this.lockUntil) { this.msg = "Too many attempts. Try again in a few seconds."; this.render(); return; }
        const rec = this.creds.get(this.emailVal.trim().toLowerCase());
        const h = await this.hashOf(this.emailVal, this.passVal);
        if (rec && this.target && h === rec.hash) {
            this.fails = 0; this.msg = ""; this.passVal = "";
            const filter = new models.BasicFilter(this.target, "In", [rec.email]);
            this.host.applyJsonFilter(filter, "general", "filter", FilterAction.merge);
            return;
        }
        this.fails++;
        this.msg = "Email or password is incorrect.";
        if (this.fails >= 5) { this.fails = 0; this.lockUntil = Date.now() + 30000; this.msg = "Too many attempts. Try again in 30 seconds."; }
        this.passVal = "";
        this.render();
    }

    private lock(): void {
        this.host.applyJsonFilter(null, "general", "filter", FilterAction.remove);
        this.msg = ""; this.passVal = "";
    }

    private el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
        const e = document.createElement(tag);
        if (cls) { e.className = cls; }
        if (text !== undefined) { e.textContent = text; }
        return e;
    }

    private render(): void {
        const accent = this.fs.gateCard.accent.value.value || "#2F6DB5";
        this.root.replaceChildren();
        const title = this.fs.gateCard.title.value || "Protected pages";

        if (!this.hasData) {
            this.root.appendChild(this.el("div", "hint", "Add Access[Email] and Access[PasswordHash] to the Email and Password hash fields."));
            return;
        }
        const row = this.el("div", "row");
        if (this.unlockedEmail) {
            row.appendChild(this.el("span", "ok", "🔓 Unlocked: " + this.unlockedEmail));
            const b = this.el("button", undefined, "Lock");
            b.style.background = accent;
            b.onclick = () => this.lock();
            row.appendChild(b);
        } else {
            row.appendChild(this.el("span", "title", "🔒 " + title));
            const em = this.el("input"); em.type = "text"; em.placeholder = "Email"; em.value = this.emailVal; em.autocomplete = "off";
            em.oninput = () => { this.emailVal = em.value; };
            const pw = this.el("input"); pw.type = "password"; pw.placeholder = "Password"; pw.value = this.passVal; pw.autocomplete = "off";
            pw.oninput = () => { this.passVal = pw.value; };
            const go = () => { void this.tryUnlock(); };
            pw.onkeydown = (ev) => { if (ev.key === "Enter") { go(); } };
            em.onkeydown = (ev) => { if (ev.key === "Enter") { go(); } };
            const b = this.el("button", undefined, "Unlock");
            b.style.background = accent;
            b.onclick = go;
            row.append(em, pw, b);
            if (this.msg) { row.appendChild(this.el("span", "msg", this.msg)); }
        }
        this.root.appendChild(row);

        if (this.fs.gateCard.showHashTool.value) {
            const tool = this.el("div", "row tool");
            tool.appendChild(this.el("span", "hint", "Hash generator:"));
            const e2 = this.el("input"); e2.type = "text"; e2.placeholder = "Email"; e2.value = this.toolEmail;
            const p2 = this.el("input"); p2.type = "text"; p2.placeholder = "Password"; p2.value = this.toolPass;
            const out = this.el("input", "out"); out.readOnly = true; out.placeholder = "Hash to paste into the Access table";
            const calc = () => {
                this.toolEmail = e2.value; this.toolPass = p2.value;
                if (!e2.value || !p2.value) { out.value = ""; return; }
                void this.hashOf(e2.value, p2.value).then(h => { out.value = h; });
            };
            e2.oninput = calc; p2.oninput = calc;
            out.onclick = () => out.select();
            tool.append(e2, p2, out);
            this.root.appendChild(tool);
            calc();
        }
    }
}
