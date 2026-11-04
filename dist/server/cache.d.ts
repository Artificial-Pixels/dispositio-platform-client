/**
 * Kleiner Zwischenspeicher mit Ablaufzeit je Eintrag und Obergrenze (älteste zuerst raus). Für die Sitzungen der Plattform: Schlüssel
 * ist der Hash des Cookies, nie das Cookie selbst.
 */
export declare class TtlCache<V> {
    private readonly maxEntries;
    private readonly now;
    private readonly entries;
    constructor(maxEntries?: number, now?: () => number);
    get(key: string): V | undefined;
    set(key: string, value: V, ttlMs: number): void;
    delete(key: string): void;
    get size(): number;
}
//# sourceMappingURL=cache.d.ts.map