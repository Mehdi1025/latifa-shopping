function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    return Ctx ? new Ctx() : null;
  } catch {
    return null;
  }
}

/** Court bip aigu pour scan réussi (Web Audio, silencieux si indisponible). */
export function playScanBeep(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(920, ctx.currentTime);
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + 0.1);
    o.onended = () => void ctx.close();
  } catch {
    void ctx.close();
  }
}

/** Son grave bref en cas d’échec (code inconnu, rupture, etc.). */
export function playScanErrorBeep(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(180, ctx.currentTime);
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.14, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + 0.18);
    o.onended = () => void ctx.close();
  } catch {
    void ctx.close();
  }
}
