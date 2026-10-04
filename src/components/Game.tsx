import { useEffect, useRef, useState } from "react";

type Weapon = { id: string; name: string; price: number; dmg: number; rate: number; color: string };
const WEAPONS: Weapon[] = [
  { id: "pistol", name: "Pistol", price: 0, dmg: 25, rate: 380, color: "#ddd" },
  { id: "smg", name: "SMG", price: 2500, dmg: 20, rate: 110, color: "#ffd24a" },
  { id: "ak", name: "AK-47", price: 7500, dmg: 45, rate: 140, color: "#ff5a3c" },
];
const WORLD = 1400;
const SHOP = { x: WORLD / 2, y: WORLD / 2 - 260, r: 60 };

type Enemy = { x: number; y: number; hp: number; hit: number; cd: number };
type Bullet = { x: number; y: number; vx: number; vy: number; life: number; dmg: number; color: string };
type State = {
  px: number; py: number; hp: number; money: number; xp: number; level: number;
  weapon: string; owned: string[]; enemies: Enemy[]; bullets: Bullet[]; kills: number;
  missionDone: boolean; lastShot: number; flash: number; dead: boolean;
};

function newState(keep?: State): State {
  const s: State = {
    px: WORLD / 2, py: WORLD / 2, hp: 100, money: keep?.money ?? 0, xp: keep?.xp ?? 0,
    level: keep?.level ?? 1, weapon: keep?.weapon ?? "pistol", owned: keep?.owned ?? ["pistol"],
    enemies: [], bullets: [], kills: 0, missionDone: false, lastShot: 0, flash: 0, dead: false,
  };
  spawn(s);
  return s;
}
function spawn(s: State) {
  s.enemies = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.random();
    s.enemies.push({ x: WORLD / 2 + Math.cos(a) * 550, y: WORLD / 2 + Math.sin(a) * 550, hp: 100, hit: 0, cd: 0 });
  }
}
// static buildings
const BUILDINGS: { x: number; y: number; w: number; h: number }[] = [];
for (let gx = 0; gx < 7; gx++) for (let gy = 0; gy < 7; gy++) {
  if ((gx === 3 && gy === 3) || (gx === 3 && gy === 2)) continue;
  if ((gx * 7 + gy) % 3 === 0) BUILDINGS.push({ x: gx * 200 + 40, y: gy * 200 + 40, w: 110, h: 110 });
}
function blocked(x: number, y: number, r: number) {
  if (x < r || y < r || x > WORLD - r || y > WORLD - r) return true;
  return BUILDINGS.some((b) => x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h);
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const st = useRef<State | null>(null);
  const joy = useRef({ active: false, id: -1, cx: 0, cy: 0, dx: 0, dy: 0 });
  const firing = useRef(false);
  const keys = useRef<Record<string, boolean>>({});
  const [screen, setScreen] = useState<"start" | "play" | "shop" | "dead">("start");
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const [hud, setHud] = useState({ money: 0, hp: 100, xp: 0, level: 1, weapon: "Pistol", kills: 0, done: false, nearShop: false });
  const [toast, setToast] = useState("");
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const kd = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = true; if (e.key === " ") firing.current = true; };
    const ku = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false; if (e.key === " ") firing.current = false; };
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
    let raf = 0, last = performance.now(), hudT = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const s = st.current;
      if (s && screenRef.current === "play") update(s, dt, now);
      if (s) draw(s, now);
      hudT += dt;
      if (s && hudT > 0.1) {
        hudT = 0;
        const near = Math.hypot(s.px - SHOP.x, s.py - SHOP.y) < SHOP.r + 30;
        setHud({ money: s.money, hp: Math.max(0, Math.round(s.hp)), xp: s.xp, level: s.level,
          weapon: WEAPONS.find((w) => w.id === s.weapon)!.name, kills: s.kills, done: s.missionDone, nearShop: near });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
  }, []);

  function flashToast(t: string) { setToast(t); setTimeout(() => setToast(""), 2200); }

  function update(s: State, dt: number, now: number) {
    let mx = joy.current.dx, my = joy.current.dy;
    const k = keys.current;
    if (k["w"] || k["arrowup"]) my = -1; if (k["s"] || k["arrowdown"]) my = 1;
    if (k["a"] || k["arrowleft"]) mx = -1; if (k["d"] || k["arrowright"]) mx = 1;
    const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
    const sp = 220;
    const nx = s.px + mx * sp * dt, ny = s.py + my * sp * dt;
    if (!blocked(nx, s.py, 14)) s.px = nx;
    if (!blocked(s.px, ny, 14)) s.py = ny;

    const w = WEAPONS.find((x) => x.id === s.weapon)!;
    if (firing.current && now - s.lastShot > w.rate) {
      let best: Enemy | null = null, bd = 600;
      for (const e of s.enemies) { const d = Math.hypot(e.x - s.px, e.y - s.py); if (d < bd) { bd = d; best = e; } }
      if (best) {
        const a = Math.atan2(best.y - s.py, best.x - s.px) + (Math.random() - 0.5) * 0.06;
        s.bullets.push({ x: s.px, y: s.py, vx: Math.cos(a) * 900, vy: Math.sin(a) * 900, life: 0.8, dmg: w.dmg, color: w.color });
        s.lastShot = now; s.flash = 0.06;
      }
    }
    s.flash -= dt;
    for (const b of s.bullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (blocked(b.x, b.y, 1)) b.life = 0;
      for (const e of s.enemies) if (b.life > 0 && Math.hypot(e.x - b.x, e.y - b.y) < 16) { e.hp -= b.dmg; e.hit = 0.1; b.life = 0; }
    }
    s.bullets = s.bullets.filter((b) => b.life > 0);
    const before = s.enemies.length;
    s.enemies = s.enemies.filter((e) => e.hp > 0);
    const killed = before - s.enemies.length;
    if (killed) { s.kills += killed; s.money += 100 * killed; addXp(s, 20 * killed); }
    if (!s.missionDone && s.kills >= 5) {
      s.missionDone = true; s.money += 3000; addXp(s, 150);
      flashToast("MISSION COMPLETE  +$3000  +150 XP");
      setTimeout(() => { if (st.current === s && !s.dead) { s.kills = 0; s.missionDone = false; spawn(s); flashToast("NEW CREW INBOUND"); } }, 4000);
    }
    for (const e of s.enemies) {
      const dx = s.px - e.x, dy = s.py - e.y, d = Math.hypot(dx, dy) || 1;
      e.hit -= dt; e.cd -= dt;
      if (d > 22) {
        const ex = e.x + (dx / d) * 120 * dt, ey = e.y + (dy / d) * 120 * dt;
        if (!blocked(ex, e.y, 13)) e.x = ex; if (!blocked(e.x, ey, 13)) e.y = ey;
      } else if (e.cd <= 0) { s.hp -= 10; e.cd = 0.7; }
    }
    if (s.hp <= 0 && !s.dead) { s.dead = true; firing.current = false; setScreen("dead"); }
  }
  function addXp(s: State, n: number) {
    s.xp += n;
    while (s.xp >= s.level * 200) { s.xp -= s.level * 200; s.level++; s.hp = 100; }
  }

  function draw(s: State, now: number) {
    const c = canvasRef.current; if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = c.clientWidth, H = c.clientHeight;
    if (c.width !== W * dpr) { c.width = W * dpr; c.height = H * dpr; }
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#0b0b10"; g.fillRect(0, 0, W, H);
    g.save();
    g.translate(Math.round(W / 2 - s.px), Math.round(H / 2 - s.py));
    // streets
    g.fillStyle = "#1a1a22"; g.fillRect(0, 0, WORLD, WORLD);
    g.strokeStyle = "#3a3320"; g.lineWidth = 3; g.setLineDash([18, 18]);
    for (let i = 0; i <= 7; i++) {
      g.beginPath(); g.moveTo(i * 200 + 20, 0); g.lineTo(i * 200 + 20, WORLD); g.stroke();
      g.beginPath(); g.moveTo(0, i * 200 + 20); g.lineTo(WORLD, i * 200 + 20); g.stroke();
    }
    g.setLineDash([]);
    // buildings
    for (const b of BUILDINGS) {
      g.fillStyle = "#000"; g.fillRect(b.x + 8, b.y + 8, b.w, b.h);
      g.fillStyle = "#26262f"; g.fillRect(b.x, b.y, b.w, b.h);
      g.strokeStyle = "#000"; g.lineWidth = 4; g.strokeRect(b.x, b.y, b.w, b.h);
      for (let wx = 0; wx < 3; wx++) for (let wy = 0; wy < 3; wy++) {
        const lit = ((b.x + wx * 7 + wy * 13) % 5) < 2;
        g.fillStyle = lit ? "#e8b94a" : "#111"; g.fillRect(b.x + 15 + wx * 32, b.y + 15 + wy * 32, 16, 16);
      }
    }
    // shop
    g.fillStyle = "#3b0d0d"; g.beginPath(); g.arc(SHOP.x, SHOP.y, SHOP.r, 0, 7); g.fill();
    g.strokeStyle = `rgba(255,60,60,${0.6 + Math.sin(now / 200) * 0.4})`; g.lineWidth = 4; g.stroke();
    g.fillStyle = "#ff4d4d"; g.font = "bold 18px Impact, sans-serif"; g.textAlign = "center"; g.fillText("GUN SHOP", SHOP.x, SHOP.y + 6);
    // bullets
    for (const b of s.bullets) { g.strokeStyle = b.color; g.lineWidth = 3; g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02); g.stroke(); }
    // enemies
    for (const e of s.enemies) {
      drawGuy(g, e.x, e.y, Math.atan2(s.py - e.y, s.px - e.x), e.hit > 0 ? "#fff" : "#8a1a1a", "#2a0a0a");
      g.fillStyle = "#000"; g.fillRect(e.x - 16, e.y - 28, 32, 5);
      g.fillStyle = "#e33"; g.fillRect(e.x - 16, e.y - 28, 32 * (e.hp / 100), 5);
    }
    // player
    let aim = 0, bd = 1e9;
    for (const e of s.enemies) { const d = Math.hypot(e.x - s.px, e.y - s.py); if (d < bd) { bd = d; aim = Math.atan2(e.y - s.py, e.x - s.px); } }
    drawGuy(g, s.px, s.py, aim, "#d9c9a3", "#111");
    if (s.flash > 0) { g.fillStyle = "#ffe066"; g.beginPath(); g.arc(s.px + Math.cos(aim) * 24, s.py + Math.sin(aim) * 24, 7, 0, 7); g.fill(); }
    g.restore();
    // vignette
    const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.8)");
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
  }
  function drawGuy(g: CanvasRenderingContext2D, x: number, y: number, a: number, coat: string, hat: string) {
    g.save(); g.translate(x, y); g.rotate(a);
    g.fillStyle = "#000"; g.fillRect(8, -3, 18, 6);
    g.fillStyle = coat; g.strokeStyle = "#000"; g.lineWidth = 3;
    g.beginPath(); g.ellipse(0, 0, 12, 15, 0, 0, 7); g.fill(); g.stroke();
    g.fillStyle = hat; g.beginPath(); g.arc(0, 0, 9, 0, 7); g.fill(); g.stroke();
    g.restore();
  }

  // joystick handlers
  const onJoyStart = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    joy.current = { active: true, id: e.pointerId, cx: r.left + r.width / 2, cy: r.top + r.height / 2, dx: 0, dy: 0 };
    e.currentTarget.setPointerCapture(e.pointerId); onJoyMove(e);
  };
  const onJoyMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const j = joy.current; if (!j.active || e.pointerId !== j.id) return;
    let dx = e.clientX - j.cx, dy = e.clientY - j.cy; const max = 55; const d = Math.hypot(dx, dy);
    if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
    j.dx = dx / max; j.dy = dy / max; setKnob({ x: dx, y: dy });
  };
  const onJoyEnd = () => { joy.current.active = false; joy.current.dx = 0; joy.current.dy = 0; setKnob({ x: 0, y: 0 }); };

  const start = () => { st.current = newState(); setScreen("play"); };
  const restart = () => { st.current = newState(st.current ?? undefined); setScreen("play"); };
  const buy = (w: Weapon) => {
    const s = st.current!; if (s.owned.includes(w.id)) { s.weapon = w.id; flashToast(`${w.name} equipped`); }
    else if (s.money >= w.price) { s.money -= w.price; s.owned.push(w.id); s.weapon = w.id; flashToast(`Bought ${w.name}`); }
    else flashToast("Not enough cash");
    setHud((h) => ({ ...h, money: s.money, weapon: WEAPONS.find((x) => x.id === s.weapon)!.name }));
  };

  return (
    <div className="game-root">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {screen !== "start" && (
        <div className="hud">
          <div className="hud-row">
            <span className="hud-chip text-money">${hud.money}</span>
            <span className="hud-chip">LV {hud.level}</span>
            <span className="hud-chip">{hud.weapon}</span>
          </div>
          <div className="hud-bar"><div className="hud-bar-fill bg-destructive" style={{ width: `${hud.hp}%` }} /><span>HP {hud.hp}</span></div>
          <div className="hud-bar"><div className="hud-bar-fill bg-xp" style={{ width: `${(hud.xp / (hud.level * 200)) * 100}%` }} /><span>XP {hud.xp}/{hud.level * 200}</span></div>
          <div className="hud-chip w-fit">{hud.done ? "MISSION COMPLETE" : `Eliminate gangsters: ${hud.kills}/5`}</div>
        </div>
      )}
      {toast && <div className="toast-banner">{toast}</div>}
      {screen === "play" && (
        <>
          <div className="joy" onPointerDown={onJoyStart} onPointerMove={onJoyMove} onPointerUp={onJoyEnd} onPointerCancel={onJoyEnd}>
            <div className="joy-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
          </div>
          <button className="fire-btn" aria-label="Fire"
            onPointerDown={(e) => { e.preventDefault(); firing.current = true; }}
            onPointerUp={() => (firing.current = false)} onPointerLeave={() => (firing.current = false)} onPointerCancel={() => (firing.current = false)}>
            FIRE
          </button>
          {hud.nearShop && <button className="shop-btn" onClick={() => { firing.current = false; onJoyEnd(); setScreen("shop"); }}>ENTER SHOP</button>}
        </>
      )}
      {screen === "start" && (
        <div className="overlay">
          <h1 className="title">UNDERWORLD</h1>
          <p className="subtitle">CITY OF SHADOWS</p>
          <button className="big-btn" onClick={start}>PLAY</button>
          <p className="hint">Left: move · FIRE: shoot nearest · Visit the red GUN SHOP</p>
        </div>
      )}
      {screen === "dead" && (
        <div className="overlay">
          <h1 className="title text-destructive">WASTED</h1>
          <p className="subtitle">Cash, XP & weapons kept</p>
          <button className="big-btn" onClick={restart}>RESTART</button>
        </div>
      )}
      {screen === "shop" && (
        <div className="overlay">
          <h2 className="title text-4xl">GUN SHOP</h2>
          <p className="subtitle">Cash: ${hud.money}</p>
          <div className="flex w-full max-w-sm flex-col gap-3">
            {WEAPONS.map((w) => {
              const owned = st.current?.owned.includes(w.id); const eq = st.current?.weapon === w.id;
              return (
                <button key={w.id} className="shop-item" onClick={() => buy(w)}>
                  <span className="text-left"><b className="block text-lg">{w.name}</b><small>DMG {w.dmg} · {Math.round(60000 / w.rate)} RPM</small></span>
                  <span className="text-money">{eq ? "EQUIPPED" : owned ? "EQUIP" : w.price ? `$${w.price}` : "FREE"}</span>
                </button>
              );
            })}
          </div>
          <button className="big-btn mt-4" onClick={() => setScreen("play")}>BACK</button>
        </div>
      )}
    </div>
  );
}
