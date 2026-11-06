/** Wert eines Cookies aus dem Cookie-Header (ohne Abhängigkeit von @fastify/cookie); null, wenn es fehlt. */
export function readCookie(header, name) {
    if (!header)
        return null;
    for (const part of header.split(';')) {
        const eq = part.indexOf('=');
        if (eq < 0)
            continue;
        if (part.slice(0, eq).trim() !== name)
            continue;
        const raw = part.slice(eq + 1).trim();
        try {
            return decodeURIComponent(raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw);
        }
        catch {
            return null;
        }
    }
    return null;
}
//# sourceMappingURL=cookies.js.map