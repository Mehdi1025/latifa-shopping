/** Court bip pour feedback scan (Web Audio, silencieux si indisponible). */
export function playScanBeep(): void {
  if (typeof window === "undefined") return;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
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
    // Permission / autoplay: ignorer
  }
}
