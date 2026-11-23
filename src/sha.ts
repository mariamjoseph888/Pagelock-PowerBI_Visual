const hex = (b: Uint8Array): string => Array.from(b).map(x => x.toString(16).padStart(2, "0")).join("");

function fallback(msg: Uint8Array): string {
    const K: number[] = [];
    const H: number[] = [];
    let c = 0;
    for (let n = 2; c < 64; n++) {
        let prime = true;
        for (let i = 2; i * i <= n; i++) { if (n % i === 0) { prime = false; break; } }
        if (!prime) { continue; }
        if (c < 8) { H[c] = (Math.pow(n, 0.5) % 1 * 4294967296) | 0; }
        K[c] = (Math.pow(n, 1 / 3) % 1 * 4294967296) | 0;
        c++;
    }
    const l = msg.length;
    const padded = new Uint8Array(((l + 9 + 63) >> 6) << 6);
    padded.set(msg);
    padded[l] = 0x80;
    const dv = new DataView(padded.buffer);
    dv.setUint32(padded.length - 8, Math.floor(l * 8 / 4294967296));
    dv.setUint32(padded.length - 4, (l * 8) >>> 0);
    const w: number[] = new Array<number>(64);
    const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));
    for (let off = 0; off < padded.length; off += 64) {
        for (let i = 0; i < 16; i++) { w[i] = dv.getUint32(off + i * 4); }
        for (let i = 16; i < 64; i++) {
            const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
            const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
            w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
        }
        let [a, b, c2, d, e, f, g, h] = H;
        for (let i = 0; i < 64; i++) {
            const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
            const ch = (e & f) ^ (~e & g);
            const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
            const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
            const maj = (a & b) ^ (a & c2) ^ (b & c2);
            const t2 = (S0 + maj) | 0;
            h = g; g = f; f = e; e = (d + t1) | 0; d = c2; c2 = b; b = a; a = (t1 + t2) | 0;
        }
        const add = [a, b, c2, d, e, f, g, h];
        for (let i = 0; i < 8; i++) { H[i] = (H[i] + add[i]) | 0; }
    }
    return H.map(x => (x >>> 0).toString(16).padStart(8, "0")).join("");
}

export async function sha256Hex(text: string): Promise<string> {
    const bytes = new TextEncoder().encode(text);
    const subtle = (globalThis as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle;
    if (subtle) {
        try { return hex(new Uint8Array(await subtle.digest("SHA-256", bytes))); } catch { /* use fallback */ }
    }
    return fallback(bytes);
}
