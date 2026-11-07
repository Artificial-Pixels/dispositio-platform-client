/**
 * Kleiner Zwischenspeicher mit Ablaufzeit je Eintrag und Obergrenze (älteste zuerst raus). Für die Sitzungen der Plattform: Schlüssel
 * ist der Hash des Cookies, nie das Cookie selbst.
 */
export class TtlCache {
    maxEntries;
    now;
    entries = new Map();
    constructor(maxEntries = 5000, now = Date.now) {
        this.maxEntries = maxEntries;
        this.now = now;
    }
    get(key) {
        const hit = this.entries.get(key);
        if (!hit)
            return undefined;
        if (hit.expires <= this.now()) {
            this.entries.delete(key);
            return undefined;
        }
        return hit.value;
    }
    set(key, value, ttlMs) {
        this.entries.delete(key);
        this.entries.set(key, { value, expires: this.now() + ttlMs });
        while (this.entries.size > this.maxEntries) {
            const oldest = this.entries.keys().next().value;
            if (oldest === undefined)
                break;
            this.entries.delete(oldest);
        }
    }
    delete(key) {
        this.entries.delete(key);
    }
    get size() {
        return this.entries.size;
    }
}
//# sourceMappingURL=cache.js.map