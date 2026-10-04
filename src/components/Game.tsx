import { useEffect, useRef, useState } from "react";
import hero from "@/assets/hero.jpg";
import boss from "@/assets/boss.jpg";
import dealer from "@/assets/dealer.jpg";
import enforcer from "@/assets/enforcer.jpg";
import cityImg from "@/assets/city.jpg";

/* ---------- Types & data ---------- */
type Rarity = "common" | "rare" | "epic" | "legend";
const RARITY_LABEL: Record<Rarity, string> = { common: "SIRADAN", rare: "NADİR", epic: "EPİK", legend: "EFSANE" };
type Weapon = { uid: string; name: string; rarity: Rarity; dmg: number; dur: number };
type Seller = { name: string; img: string; rep: number; mood: "tough" | "soft" };
type Listing = { id: string; weapon: Weapon; seller: Seller; price: number; city: string };
type Msg = { from: "me" | "them" | "sys"; text: string; offer?: number };
type Trade = { listingId: string; msgs: Msg[]; status: "open" | "pending" | "counter" | "deal" | "rejected"; myOffer?: number; counter?: number; final?: number; rounds: number };
type Shipment = { id: string; weapon: Weapon; ship: string; from: string; to: string; start: number; duration: number; price: number; claimed: boolean };
type Member = { id: string; name: string; role: string; img: string; weaponUid: string | null; power: number };
type Screen = "intro" | "city" | "hq" | "market" | "listing" | "escrow" | "port" | "war" | "crew" | "rank" | "story" | "gang";

const SELLERS: [Seller, Seller, Seller] = [
  { name: "Kel Vito", img: dealer, rep: 340, mood: "tough" },
  { name: "Lady Kızıl", img: enforcer, rep: 512, mood: "soft" },
  { name: "Don Rıza", img: boss, rep: 870, mood: "tough" },
];
const mkW = (uid: string, name: string, rarity: Rarity, dmg: number, dur: number): Weapon => ({ uid, name, rarity, dmg, dur });
const LISTINGS: Listing[] = [
  { id: "l1", weapon: mkW("w-l1", "Tommy Gun '28", "rare", 62, 80), seller: SELLERS[0], price: 4200, city: "Atina" },
  { id: "l2", weapon: mkW("w-l2", "Altın Kartal .50", "legend", 95, 95), seller: SELLERS[2], price: 14500, city: "Napoli" },
  { id: "l3", weapon: mkW("w-l3", "Kızıl Dul SMG", "epic", 78, 70), seller: SELLERS[1], price: 8800, city: "Marsilya" },
  { id: "l4", weapon: mkW("w-l4", "Sokak Tabancası", "common", 30, 60), seller: SELLERS[0], price: 900, city: "İzmir" },
  { id: "l5", weapon: mkW("w-l5", "Gece Tüfeği", "rare", 70, 85), seller: SELLERS[1], price: 5600, city: "Selanik" },
];
const SHIPS = ["MV Kara Martı", "SS Gölge", "La Notte", "Deniz Kurdu"];
const DEMO_SECONDS = 40; // gerçek sistemde en fazla 24 saat
const STEPS = ["Ödeme emanette", "Konteynere yüklendi", "Denizde", "Gümrükten geçti", "Limana ulaştı"];

const fmt = (n: number) => "$" + n.toLocaleString("tr-TR");
const uid = () => Math.random().toString(36).slice(2, 9);

/* ---------- Bot chat (free-text, keyword-based) ---------- */
function botReply(text: string, l: Listing): string {
  const t = text.toLocaleLowerCase("tr-TR");
  const s = l.seller;
  if (/merhaba|selam|hey|iyi akşam/.test(t)) return s.mood === "tough" ? `Selam. ${l.weapon.name} için mi geldin? Vaktim az.` : `Hoş geldin tatlım. ${l.weapon.name} göz kamaştırıcı, değil mi?`;
  if (/hasar|güç|vur/.test(t)) return `Hasar ${l.weapon.dmg}. Bu şehirde bundan iyisini kolay bulamazsın.`;
  if (/dayan|sağlam|durum|eski/.test(t)) return `Dayanıklılık %${l.weapon.dur}. Temiz iş, seri numarası kazınmış.`;
  if (/indirim|ucuz|pahalı|fazla|düş/.test(t)) return s.mood === "tough" ? "Pazarlık yapacaksan bir teklif gönder. Laf değil, rakam konuşur." : "Belki biraz esnerim… Bir teklif yaz, bakalım.";
  if (/kargo|teslim|gemi|liman/.test(t)) return `Mal ${l.city} limanında. Anlaşırsak ilk gemiyle yola çıkar.`;
  if (/güven|polis|tuzak|emin/.test(t)) return "Ödeme Güvenli İşlem'de tutulur. İkimiz de dolandırılmayız.";
  if (/\?$/.test(t)) return "Soruların çok. Kararını verince teklif gönder.";
  const pool = s.mood === "tough"
    ? ["Hı hı. Devam et.", "Bu silahı isteyen çok, acele et.", "Lafı dolandırma dostum."]
    : ["İlginç…", "Seni sevdim, ama iş iştir.", "Anlat bakalım, ne düşünüyorsun?"];
  return pool[Math.floor(Math.random() * pool.length)] ?? "Hı hı.";
}

/* ---------- Main ---------- */
export default function Game() {
  const [screen, setScreen] = useState<Screen>("intro");
  const [money, setMoney] = useState(12000);
  const [rep, setRep] = useState(150);
  const [inventory, setInventory] = useState<Weapon[]>([mkW("w-start", "Eski Revolver", "common", 22, 50)]);
  const [crew, setCrew] = useState<Member[]>([
    { id: "m0", name: "Sen — 'Gölge'", role: "Patron", img: boss, weaponUid: "w-start", power: 40 },
    { id: "m1", name: "Kızıl Leyla", role: "Tetikçi", img: enforcer, weaponUid: null, power: 35 },
    { id: "m2", name: "Kurnaz Sami", role: "Kaçakçı", img: dealer, weaponUid: null, power: 28 },
  ]);
  const [soldIds, setSoldIds] = useState<string[]>([]);
  const [trades, setTrades] = useState<Record<string, Trade>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState("");
  const [storyNode, setStoryNode] = useState("s0");
  const [gangVault, setGangVault] = useState(4200);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  const flash = (t: string) => { setToast(t); window.setTimeout(() => setToast(""), 2200); };
  const go = (s: Screen) => setScreen(s);

  const listing = LISTINGS.find((l) => l.id === activeId) ?? null;
  const trade = activeId ? trades[activeId] : undefined;
  const heldMoney = shipments.filter((s) => !s.claimed).reduce((a, s) => a + s.price, 0);

  const patchTrade = (id: string, fn: (t: Trade) => Trade) =>
    setTrades((all) => ({ ...all, [id]: fn(all[id] ?? { listingId: id, msgs: [], status: "open", rounds: 0 }) }));

  const openListing = (l: Listing) => {
    setActiveId(l.id);
    if (!trades[l.id]) patchTrade(l.id, (t) => ({ ...t, msgs: [{ from: "them", text: l.seller.mood === "tough" ? `${l.weapon.name}. Fiyat ${fmt(l.price)}. Ciddi alıcıysan konuşalım.` : `Gözün ${l.weapon.name}'de mi? ${fmt(l.price)}, ama seninle konuşurum.` }] }));
    go("listing");
  };

  const sendText = (text: string) => {
    if (!listing) return;
    const l = listing;
    patchTrade(l.id, (t) => ({ ...t, msgs: [...t.msgs, { from: "me", text }] }));
    window.setTimeout(() => patchTrade(l.id, (t) => ({ ...t, msgs: [...t.msgs, { from: "them", text: botReply(text, l) }] })), 800 + Math.random() * 600);
  };

  const sendOffer = (amount: number) => {
    if (!listing || !trade) return;
    const l = listing;
    if (amount > money) return flash("Yeterli paran yok");
    patchTrade(l.id, (t) => ({ ...t, status: "pending", myOffer: amount, msgs: [...t.msgs, { from: "me", text: `TEKLİF: ${fmt(amount)}`, offer: amount }] }));
    window.setTimeout(() => {
      const ratio = amount / l.price;
      const floor = l.seller.mood === "tough" ? 0.88 : 0.8;
      patchTrade(l.id, (t) => {
        const rounds = t.rounds + 1;
        if (ratio >= floor || (rounds >= 3 && ratio >= floor - 0.08))
          return { ...t, rounds, status: "deal", final: amount, msgs: [...t.msgs, { from: "them", text: "Tamam. Anlaştık. El sıkışalım." }, { from: "sys", text: `ANLAŞMA: ${fmt(amount)}` }] };
        if (ratio < 0.5)
          return { ...t, rounds, status: "rejected", msgs: [...t.msgs, { from: "them", text: "Bu bir hakaret. REDDEDİLDİ. Yeni bir teklifle gel." }] };
        const counter = Math.round(((amount + l.price) / 2) / 50) * 50;
        return { ...t, rounds, status: "counter", counter, msgs: [...t.msgs, { from: "them", text: `Olmaz. Ama sana ${fmt(counter)} derim. KARŞI TEKLİF.`, offer: counter }] };
      });
    }, 1300);
  };

  const respondCounter = (accept: boolean) => {
    if (!listing || !trade?.counter) return;
    if (accept) {
      if (trade.counter > money) return flash("Yeterli paran yok");
      patchTrade(listing.id, (t) => ({ ...t, status: "deal", final: t.counter ?? 0, msgs: [...t.msgs, { from: "me", text: "Kabul ediyorum." }, { from: "sys", text: `ANLAŞMA: ${fmt(t.counter!)}` }] }));
    } else {
      patchTrade(listing.id, (t) => ({ ...t, status: "open", msgs: [...t.msgs, { from: "me", text: "Reddediyorum." }, { from: "them", text: "Sen bilirsin. Başka teklifin varsa bekliyorum." }] }));
    }
  };

  const confirmEscrow = () => {
    if (!listing || !trade?.final) return;
    const price = trade.final;
    setMoney((m) => m - price);
    setSoldIds((s) => [...s, listing.id]);
    setShipments((s) => [{ id: uid(), weapon: listing.weapon, ship: SHIPS[Math.floor(Math.random() * SHIPS.length)] ?? "La Notte", from: listing.city, to: "İstanbul", start: Date.now(), duration: DEMO_SECONDS * 1000, price, claimed: false }, ...s]);
    flash("Silah kargoya verildi");
    go("port");
  };

  const claim = (sh: Shipment) => {
    setShipments((all) => all.map((s) => (s.id === sh.id ? { ...s, claimed: true } : s)));
    setInventory((inv) => [...inv, sh.weapon]);
    setRep((r) => r + 25);
    flash(`${sh.weapon.name} envantere eklendi (+25 itibar)`);
  };

  const equip = (memberId: string, weaponUid: string | null) =>
    setCrew((c) => c.map((m) => (m.id === memberId ? { ...m, weaponUid } : m.weaponUid === weaponUid && weaponUid ? { ...m, weaponUid: null } : m)));

  const crewPower = crew.reduce((a, m) => a + m.power + (inventory.find((w) => w.uid === m.weaponUid)?.dmg ?? 0), 0);
  const readyShip = shipments.some((s) => !s.claimed && now - s.start >= s.duration);

  return (
    <div className="app-shell">
      <div className="app-frame">
        {screen !== "intro" && (
          <header className="topbar">
            {screen === "listing" || screen === "escrow" ? (
              <button className="btn-comic btn-dark !px-3 !py-1 !text-sm" onClick={() => go(screen === "listing" ? "market" : "listing")}>◀ GERİ</button>
            ) : (
              <span className="font-display truncate text-lg text-gold">{TITLES[screen]}</span>
            )}
            <div className="ml-auto flex shrink-0 gap-2">
              <span className="chip">{fmt(money)}</span>
              <span className="chip">★ {rep}</span>
            </div>
          </header>
        )}

        {screen === "intro" && <Intro onPlay={() => go("city")} />}
        {screen === "city" && <City go={go} readyShip={readyShip} activeShips={shipments.filter((s) => !s.claimed).length} />}
        {screen === "story" && <Story node={storyNode} setNode={setStoryNode} onEffect={(dm, dr) => { setMoney((m) => m + dm); setRep((r) => r + dr); }} go={go} />}
        {screen === "gang" && <Gang money={money} rep={rep} crew={crew} onDonate={(n) => { if (n > money) return flash("Yeterli paran yok"); setMoney((m) => m - n); setGangVault((v) => v + n); setRep((r) => r + Math.round(n / 100)); flash(`Çete kasasına ${fmt(n)} (+${Math.round(n / 100)} itibar)`); }} vault={gangVault} />}
        {screen === "hq" && <HQ money={money} rep={rep} held={heldMoney} crew={crew} inventory={inventory} power={crewPower} go={go} />}
        {screen === "market" && <Market sold={soldIds} trades={trades} onOpen={openListing} />}
        {screen === "listing" && listing && trade && (
          <ListingChat listing={listing} trade={trade} money={money} sold={soldIds.includes(listing.id)}
            onText={sendText} onOffer={sendOffer} onCounter={respondCounter} onDeal={() => go("escrow")} />
        )}
        {screen === "escrow" && listing && trade?.final && <Escrow listing={listing} price={trade.final} onConfirm={confirmEscrow} />}
        {screen === "port" && <Port shipments={shipments} now={now} onClaim={claim} go={go} />}
        {screen === "crew" && <Crew crew={crew} inventory={inventory} onEquip={equip} />}
        {screen === "war" && <War crew={crew} inventory={inventory} power={crewPower} />}
        {screen === "rank" && <Rank rep={rep} power={crewPower} />}

        {screen !== "intro" && <BottomNav screen={screen} go={go} alert={readyShip} />}
        {toast && <div className="caption burst absolute left-1/2 top-24 z-50 -translate-x-1/2 whitespace-nowrap !text-base">{toast}</div>}
      </div>
    </div>
  );
}

/* ---------- Screens ---------- */
function Intro({ onPlay }: { onPlay: () => void }) {
  return (
    <div className="relative flex flex-1 flex-col">
      <img src={hero} alt="Yağmurlu şehirde fötr şapkalı gangster" width={768} height={1344} className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
      <div className="relative mt-auto flex flex-col items-center gap-3 p-6 pb-[calc(env(safe-area-inset-bottom)+40px)] text-center">
        <span className="caption burst">Bölüm I — Gölgelerin Şehri</span>
        <h1 className="font-display text-6xl leading-none text-paper drop-shadow-[4px_4px_0_var(--crimson)]">UNDERWORLD</h1>
        <p className="font-display tracking-[0.35em] text-gold">CITY OF SHADOWS</p>
        <button className="btn-comic btn-red mt-4 w-56 !text-3xl" onClick={onPlay}>PLAY</button>
      </div>
    </div>
  );
}

const TITLES: Record<Screen, string> = {
  intro: "", city: "ŞEHİR", hq: "KARARGÂH", market: "KARA BORSA", listing: "İLAN", escrow: "SÖZLEŞME",
  port: "KARGO", war: "REKABET", crew: "EKİP", rank: "SIRALAMA", story: "HİKÂYE", gang: "ÇETE",
};
const NAV: { id: Screen; icon: string; label: string }[] = [
  { id: "city", icon: "🏙️", label: "Şehir" }, { id: "story", icon: "📖", label: "Hikâye" },
  { id: "market", icon: "💼", label: "Borsa" }, { id: "port", icon: "⚓", label: "Kargo" },
  { id: "crew", icon: "🕴️", label: "Ekip" }, { id: "gang", icon: "🃏", label: "Çete" },
  { id: "war", icon: "⚔️", label: "Rekabet" }, { id: "rank", icon: "👑", label: "Sıra" },
];
function BottomNav({ screen, go, alert }: { screen: Screen; go: (s: Screen) => void; alert: boolean }) {
  const active = screen === "listing" || screen === "escrow" ? "market" : screen === "hq" ? "city" : screen;
  return (
    <nav className="bottom-nav" aria-label="Ana menü">
      {NAV.map((n) => (
        <button key={n.id} className={`nav-item ${active === n.id ? "nav-active" : ""}`} onClick={() => go(n.id)} aria-label={n.label}>
          <span className="relative text-xl leading-none">{n.icon}{n.id === "port" && alert && <span className="nav-dot" />}</span>
          <span>{n.label}</span>
        </button>
      ))}
    </nav>
  );
}

type Hot = { x: number; y: number; label: string; to: Screen; npc?: { img: string; line: string } };
const HOTSPOTS: Hot[] = [
  { x: 14, y: 22, label: "KARA BORSA", to: "market" },
  { x: 50, y: 40, label: "KARARGÂH", to: "hq" },
  { x: 84, y: 50, label: "LİMAN", to: "port" },
  { x: 8, y: 66, label: "Kapıcı Bruno", to: "story", npc: { img: dealer, line: "Patron seni soruyordu. Limanda bir iş var…" } },
  { x: 34, y: 58, label: "Çete Toplantısı", to: "gang", npc: { img: enforcer, line: "Aile kasası boşalıyor. Katkı lazım." } },
  { x: 92, y: 66, label: "Vera'nın Adamı", to: "war", npc: { img: boss, line: "Liman bölgesi bizim. Gücün yeter mi?" } },
];
function City({ go, readyShip, activeShips }: { go: (s: Screen) => void; readyShip: boolean; activeShips: number }) {
  const [npc, setNpc] = useState<Hot | null>(null);
  return (
    <main className="screen !p-0">
      <div className="relative w-full overflow-hidden border-b-4 border-ink" style={{ aspectRatio: "768 / 1152", maxHeight: "calc(100% - 4px)" }}>
        <img src={cityImg} alt="Gece noir şehir sokağı, bar, konak ve liman" width={768} height={1152} className="absolute inset-0 h-full w-full object-cover" />
        <span className="caption absolute left-3 top-3 z-[2]">Gece yarısı · Gölge Sokağı</span>
        {HOTSPOTS.map((h) => (
          <button key={h.label} className={`hotspot ${h.npc ? "hotspot-npc" : ""}`} style={{ left: `${h.x}%`, top: `${h.y}%` }}
            onClick={() => (h.npc ? setNpc(h) : go(h.to))} aria-label={h.label}>
            <span className="hotspot-ring" />
            <span className="hotspot-label">{h.label}{h.to === "port" && activeShips > 0 ? (readyShip ? " · HAZIR!" : ` · ${activeShips}`) : ""}</span>
          </button>
        ))}
        <div className="absolute inset-x-3 bottom-3 z-[3] flex items-end gap-2">
          <img src={boss} alt="Senin karakterin Gölge" className="portrait h-20 w-20 shrink-0" />
          <div className="bubble bubble-them burst !max-w-none flex-1 !text-base">
            {npc ? <><b>{npc.label}:</b> {npc.npc!.line}</> : "Bu şehir bir gün benim olacak. Önce Kara Borsa'dan sağlam bir silah lazım."}
          </div>
        </div>
      </div>
      {npc && (
        <div className="flex gap-2 p-3">
          <img src={npc.npc!.img} alt={npc.label} className="portrait h-14 w-14 shrink-0" />
          <button className="btn-comic btn-red flex-1" onClick={() => go(npc.to)}>{npc.to === "story" ? "HİKÂYEYE GİR" : npc.to === "gang" ? "ÇETEYE GİT" : "REKABETE BAK"} ▶</button>
          <button className="btn-comic btn-dark" onClick={() => setNpc(null)}>✕</button>
        </div>
      )}
    </main>
  );
}

type StoryNode = { speaker: string; img: string; text: string; choices: { label: string; next: string; dm?: number; dr?: number; go?: Screen }[] };
const STORY: Record<string, StoryNode> = {
  s0: { speaker: "Kel Vito", img: dealer, text: "Gölge… Limandan bir sevkiyat kayboldu. Don Rıza parmağını sana uzatıyor.", choices: [
    { label: "Ben hallederim.", next: "s1", dr: 10 }, { label: "Bu benim sorunum değil.", next: "s2", dr: -5 }] },
  s2: { speaker: "Don Rıza", img: boss, text: "Bu şehirde herkesin sorunu benim sorunumdur evlat. Ve artık seninki de.", choices: [
    { label: "Peki Don. Bakarım.", next: "s1" }] },
  s1: { speaker: "Kızıl Leyla", img: enforcer, text: "Malları Vera Mortis'in adamları çaldı. Rüşvet mi verelim, yoksa kapılarını mı kıralım?", choices: [
    { label: "Rüşvet ver ($1.000)", next: "s3", dm: -1000, dr: 5 }, { label: "Tehdit et", next: "s4", dr: 20 }] },
  s3: { speaker: "Vera'nın Muhasebecisi", img: dealer, text: "Para her dili konuşur. Mallar Kara Borsa'ya düştü bile — git kendi silahını al.", choices: [
    { label: "Kara Borsa'ya git", next: "s5", go: "market" }] },
  s4: { speaker: "Vera Mortis", img: enforcer, text: "Cesursun. Ama cesaret mermi geçirmez. Liman için rekabette görüşeceğiz.", choices: [
    { label: "Ekibimi hazırlayacağım", next: "s5", go: "war" }] },
  s5: { speaker: "Anlatıcı", img: boss, text: "BÖLÜM I SONU. Şehir uyumaz… yeni bölüm yakında.", choices: [
    { label: "Bölümü baştan oyna", next: "s0" }] },
};
function Story({ node, setNode, onEffect, go }: { node: string; setNode: (n: string) => void; onEffect: (dm: number, dr: number) => void; go: (s: Screen) => void }) {
  const n = STORY[node] ?? STORY.s0!;
  return (
    <main className="screen space-y-4">
      <span className="caption">Bölüm I — Kayıp Sevkiyat</span>
      <div key={node} className="panel burst overflow-hidden">
        <div className="relative">
          <img src={n.img} alt={n.speaker} className="aspect-[4/3] w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink to-transparent" />
          <span className="caption absolute bottom-3 left-3">{n.speaker}</span>
        </div>
        <div className="p-3"><div className="bubble bubble-them !max-w-none !text-lg">{n.text}</div></div>
      </div>
      <div className="space-y-3">
        {n.choices.map((c) => (
          <button key={c.label} className="btn-comic w-full text-left" onClick={() => {
            if ((c.dm ?? 0) || (c.dr ?? 0)) onEffect(c.dm ?? 0, c.dr ?? 0);
            setNode(c.next); if (c.go) go(c.go);
          }}>
            ▶ {c.label}
            {(c.dm || c.dr) ? <span className="ml-2 text-sm opacity-70">{c.dm ? fmt(c.dm) : ""} {c.dr ? `${c.dr > 0 ? "+" : ""}${c.dr}★` : ""}</span> : null}
          </button>
        ))}
      </div>
    </main>
  );
}

function Gang({ money, rep, crew, vault, onDonate }: { money: number; rep: number; crew: Member[]; vault: number; onDonate: (n: number) => void }) {
  const level = 1 + Math.floor(vault / 5000);
  const territories = [
    { name: "Gölge Sokağı", owner: "Gölge Ailesi", mine: true },
    { name: "Liman Bölgesi", owner: "Vera Mortis", mine: false },
    { name: "Eski Çarşı", owner: level >= 2 ? "Gölge Ailesi" : "Sahipsiz", mine: level >= 2 },
  ];
  return (
    <main className="screen space-y-4">
      <div className="panel panel-red p-4 text-center">
        <div className="text-4xl">🃏</div>
        <div className="font-display text-3xl text-paper">GÖLGE AİLESİ</div>
        <div className="text-sm">Seviye {level} · Kasa {fmt(vault)} · Sonraki seviye {fmt(level * 5000)}</div>
        <div className="bar mt-2"><div style={{ width: `${((vault % 5000) / 5000) * 100}%` }} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button className="btn-comic" disabled={money < 500} onClick={() => onDonate(500)}>BAĞIŞ $500</button>
        <button className="btn-comic btn-red" disabled={money < 2000} onClick={() => onDonate(2000)}>BAĞIŞ $2.000</button>
      </div>
      <div className="font-display text-lg text-gold">BÖLGELER</div>
      {territories.map((t) => (
        <div key={t.name} className="panel flex items-center justify-between p-3">
          <span className="font-semibold">{t.name}</span>
          <span className={`chip ${t.mine ? "" : "!border-crimson !text-paper"}`}>{t.owner}</span>
        </div>
      ))}
      <div className="font-display text-lg text-gold">ÜYELER · Senin itibarın ★ {rep}</div>
      <div className="flex gap-3">{crew.map((m) => <img key={m.id} src={m.img} alt={m.name} loading="lazy" className="portrait h-16 w-16" />)}</div>
    </main>
  );
}

function WeaponCard({ w, extra }: { w: Weapon; extra?: React.ReactNode }) {
  return (
    <div className="panel p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-display truncate text-lg text-paper">{w.name}</div>
          <span className={`chip rarity-${w.rarity} !bg-ink`}>{RARITY_LABEL[w.rarity]}</span>
        </div>
        <div className="text-right text-sm">
          <div>HASAR <b className="text-gold">{w.dmg}</b></div>
          <div>DAYANIKLILIK <b className="text-gold">%{w.dur}</b></div>
        </div>
      </div>
      {extra}
    </div>
  );
}

function HQ({ money, rep, held, crew, inventory, power, go }: { money: number; rep: number; held: number; crew: Member[]; inventory: Weapon[]; power: number; go: (s: Screen) => void }) {
  return (
    <main className="screen space-y-4">
      <span className="caption">Karargâh</span>
      <div className="panel flex gap-3 p-3">
        <img src={boss} alt="Senin karakterin" className="portrait h-24 w-24 shrink-0" />
        <div className="min-w-0 space-y-1">
          <div className="font-display text-2xl text-paper">"GÖLGE"</div>
          <div>Kasa: <b className="text-gold">{fmt(money)}</b></div>
          {held > 0 && <div className="text-sm text-muted-foreground">Emanette: {fmt(held)}</div>}
          <div>İtibar: <b className="text-gold">★ {rep}</b> · Güç: <b className="text-gold">{power}</b></div>
        </div>
      </div>
      <div className="font-display text-lg text-gold">EKİP</div>
      <div className="grid grid-cols-3 gap-3">
        {crew.map((m) => (
          <button key={m.id} className="panel p-2 text-center" onClick={() => go("crew")}>
            <img src={m.img} alt={m.name} loading="lazy" className="portrait aspect-square w-full" />
            <div className="font-display mt-1 truncate text-sm">{m.name.split(" —")[0]}</div>
            <div className="truncate text-xs text-muted-foreground">{inventory.find((w) => w.uid === m.weaponUid)?.name ?? "Silahsız"}</div>
          </button>
        ))}
      </div>
      <div className="font-display text-lg text-gold">CEPHANELİK ({inventory.length})</div>
      <div className="space-y-3">{inventory.map((w) => <WeaponCard key={w.uid} w={w} />)}</div>
    </main>
  );
}

function Market({ sold, trades, onOpen }: { sold: string[]; trades: Record<string, Trade>; onOpen: (l: Listing) => void }) {
  return (
    <main className="screen space-y-4">
      <div className="flex items-center justify-between"><span className="caption">Kara Borsa</span><span className="text-sm text-muted-foreground">{LISTINGS.length - sold.length} aktif ilan</span></div>
      {LISTINGS.map((l) => {
        const isSold = sold.includes(l.id);
        const t = trades[l.id];
        return (
          <button key={l.id} disabled={isSold} className="block w-full text-left disabled:opacity-50" onClick={() => onOpen(l)}>
            <WeaponCard w={l.weapon} extra={
              <div className="mt-3 flex items-center gap-2 border-t-2 border-dashed border-border pt-2">
                <img src={l.seller.img} alt={l.seller.name} loading="lazy" className="portrait h-9 w-9 shrink-0 !border-2" />
                <div className="min-w-0 flex-1 text-sm"><div className="truncate font-semibold">{l.seller.name}</div><div className="text-muted-foreground">★ {l.seller.rep} · {l.city}</div></div>
                <div className="text-right">
                  <div className="font-display text-xl text-gold">{fmt(l.price)}</div>
                  <div className="text-xs">{isSold ? "SATILDI" : t?.status === "deal" ? "ANLAŞILDI" : t ? "SOHBET AÇIK" : "İLANA GİR ▶"}</div>
                </div>
              </div>
            } />
          </button>
        );
      })}
    </main>
  );
}

function ListingChat({ listing, trade, money, sold, onText, onOffer, onCounter, onDeal }: {
  listing: Listing; trade: Trade; money: number; sold: boolean;
  onText: (t: string) => void; onOffer: (n: number) => void; onCounter: (a: boolean) => void; onDeal: () => void;
}) {
  const [text, setText] = useState("");
  const [offer, setOffer] = useState(String(Math.round(listing.price * 0.8)));
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [trade.msgs.length]);
  const send = () => { const t = text.trim(); if (!t) return; onText(t); setText(""); };
  const offerNum = parseInt(offer.replace(/\D/g, ""), 10) || 0;

  return (
    <main className="relative z-[1] flex min-h-0 flex-1 flex-col">
      <div className="p-3 pb-0"><WeaponCard w={listing.weapon} extra={
        <div className="mt-2 flex items-center gap-2 text-sm">
          <img src={listing.seller.img} alt={listing.seller.name} className="portrait h-10 w-10 shrink-0 !border-2" />
          <span className="flex-1 font-semibold">{listing.seller.name} <span className="text-muted-foreground">· çevrimiçi ●</span></span>
          <span className="font-display text-xl text-gold">{fmt(listing.price)}</span>
        </div>} /></div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {trade.msgs.map((m, i) => (
          <div key={i} className={`bubble burst bubble-${m.from}`}>{m.text}</div>
        ))}
        {trade.status === "pending" && <div className="bubble bubble-them w-fit opacity-70">yazıyor…</div>}
        <div ref={endRef} />
      </div>

      <div className="space-y-2 border-t-3 border-gold bg-ink p-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
        {sold ? (
          <div className="text-center font-display text-gold">BU SİLAH SENİN. LİMAN'DA TAKİP ET.</div>
        ) : trade.status === "deal" ? (
          <button className="btn-comic btn-green w-full burst" onClick={onDeal}>GÜVENLİ İŞLEME GEÇ ▶</button>
        ) : trade.status === "counter" ? (
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-comic btn-green" onClick={() => onCounter(true)}>KABUL {fmt(trade.counter!)}</button>
            <button className="btn-comic btn-red" onClick={() => onCounter(false)}>REDDET</button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input className="field min-w-0 flex-1" inputMode="numeric" value={offer} onChange={(e) => setOffer(e.target.value)} aria-label="Teklif tutarı" />
            <button className="btn-comic btn-red shrink-0 !px-3 !text-base" disabled={trade.status === "pending" || offerNum <= 0} onClick={() => onOffer(offerNum)}>TEKLİF GÖNDER</button>
          </div>
        )}
        {!sold && trade.status !== "deal" && trade.status !== "counter" && (
          <div className="text-xs text-muted-foreground">Kasan: {fmt(money)} · Satıcı kabul, red veya karşı teklif yapabilir.</div>
        )}
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <input className="field min-w-0 flex-1" placeholder="Mesaj yaz…" value={text} onChange={(e) => setText(e.target.value)} aria-label="Mesaj" />
          <button type="submit" className="btn-comic shrink-0 !px-4 !text-base">GÖNDER</button>
        </form>
      </div>
    </main>
  );
}

function Escrow({ listing, price, onConfirm }: { listing: Listing; price: number; onConfirm: () => void }) {
  return (
    <main className="screen space-y-4">
      <span className="caption">Güvenli İşlem</span>
      <div className="panel burst p-4 text-center">
        <div className="text-5xl">🔒</div>
        <div className="font-display mt-2 text-2xl text-paper">ÖDEME EMANETTE TUTULACAK</div>
        <p className="mt-2 text-muted-foreground">{fmt(price)} kasandan çekilir ve silah limana ulaşıp sen teslim alana kadar Underworld emanetinde bekler. Satıcı parayı ancak teslimattan sonra alır.</p>
      </div>
      <WeaponCard w={listing.weapon} />
      <div className="panel space-y-2 p-3">
        <div className="flex justify-between"><span>Satıcı</span><b>{listing.seller.name}</b></div>
        <div className="flex justify-between"><span>Rota</span><b>{listing.city} → İstanbul</b></div>
        <div className="flex justify-between"><span>Anlaşılan fiyat</span><b className="text-gold">{fmt(price)}</b></div>
        <div className="flex justify-between text-sm text-muted-foreground"><span>Tahmini süre</span><span>en fazla 24 saat (demo: {DEMO_SECONDS} sn)</span></div>
      </div>
      <button className="btn-comic btn-green w-full" onClick={onConfirm}>ÖDEMEYİ ONAYLA & KARGOYA VER</button>
    </main>
  );
}

function Port({ shipments, now, onClaim, go }: { shipments: Shipment[]; now: number; onClaim: (s: Shipment) => void; go: (s: Screen) => void }) {
  return (
    <main className="screen space-y-4">
      <span className="caption">Liman — Kargo Takibi</span>
      <p className="text-sm text-muted-foreground">Gerçek sistemde teslimat süresi en fazla 24 saattir. Demo için süre {DEMO_SECONDS} saniyeye hızlandırıldı.</p>
      {shipments.length === 0 && (
        <div className="panel p-4 text-center">
          <div className="text-4xl">⚓</div>
          <p className="mt-2">Limanda bekleyen kargon yok.</p>
          <button className="btn-comic btn-red mt-3" onClick={() => go("market")}>KARA BORSA'YA GİT</button>
        </div>
      )}
      {shipments.map((s) => {
        const p = Math.min(1, (now - s.start) / s.duration);
        const step = Math.min(STEPS.length - 1, Math.floor(p * STEPS.length));
        const left = Math.max(0, Math.ceil((s.duration - (now - s.start)) / 1000));
        const done = p >= 1;
        return (
          <div key={s.id} className="panel space-y-3 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0"><div className="font-display truncate text-xl text-paper">🚢 {s.ship}</div><div className="text-sm">{s.from} → {s.to}</div></div>
              <span className="chip">{s.claimed ? "TESLİM ALINDI" : done ? "HAZIR" : `00:${String(left).padStart(2, "0")}`}</span>
            </div>
            <div className="relative h-8 overflow-hidden border-2 border-ink bg-muted">
              <div className="absolute inset-y-0 left-0 bg-crimson/60 transition-all duration-500" style={{ width: `${p * 100}%` }} />
              <span className="absolute top-0.5 text-xl transition-all duration-500" style={{ left: `calc(${p * 100}% - ${p * 28}px)` }}>🚢</span>
            </div>
            <ol className="space-y-1 text-sm">
              {STEPS.map((st, i) => (
                <li key={st} className={i <= step || done ? "text-gold" : "text-muted-foreground"}>{i < step || done ? "✔" : i === step ? "●" : "○"} {st}</li>
              ))}
            </ol>
            <div className="text-sm">Kargo: <b>{s.weapon.name}</b> · {fmt(s.price)}</div>
            {done && !s.claimed && <button className="btn-comic btn-green w-full burst" onClick={() => onClaim(s)}>TESLİM AL</button>}
            {s.claimed && <button className="btn-comic btn-dark w-full" onClick={() => go("crew")}>EKİBE KUŞANDIR ▶</button>}
          </div>
        );
      })}
    </main>
  );
}

function Crew({ crew, inventory, onEquip }: { crew: Member[]; inventory: Weapon[]; onEquip: (m: string, w: string | null) => void }) {
  return (
    <main className="screen space-y-4">
      <span className="caption">Ekip — Silah Kuşan</span>
      {crew.map((m) => {
        const w = inventory.find((x) => x.uid === m.weaponUid);
        return (
          <div key={m.id} className="panel flex gap-3 p-3">
            <img src={m.img} alt={m.name} loading="lazy" className="portrait h-20 w-20 shrink-0" />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="font-display truncate text-lg text-paper">{m.name}</div>
              <div className="text-sm text-muted-foreground">{m.role} · Güç {m.power + (w?.dmg ?? 0)}</div>
              <select className="field !py-2 !text-base" value={m.weaponUid ?? ""} onChange={(e) => onEquip(m.id, e.target.value || null)} aria-label={`${m.name} silahı`}>
                <option value="">— Silahsız —</option>
                {inventory.map((x) => <option key={x.uid} value={x.uid}>{x.name} (HSR {x.dmg})</option>)}
              </select>
            </div>
          </div>
        );
      })}
    </main>
  );
}

const RIVALS = [{ name: "Kör Nazım", img: dealer }, { name: "Vera Mortis", img: enforcer }, { name: "Baron Kemal", img: boss }];
const SFX = ["BAM!", "POW!", "KRAK!", "BANG!", "ZAP!"];
function War({ crew, inventory, power }: { crew: Member[]; inventory: Weapon[]; power: number }) {
  const [hp, setHp] = useState<number[]>([100, 100, 100, 100, 100, 100]);
  const [hit, setHit] = useState<{ idx: number; sfx: string } | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearInterval(timer.current); }, []);
  const RIVAL_POWER = 210;
  const start = () => {
    setHp([100, 100, 100, 100, 100, 100]); setResult(null); setRunning(true);
    let beat = 0;
    const myBias = power / (power + RIVAL_POWER);
    timer.current = window.setInterval(() => {
      beat++;
      setHp((cur) => {
        const next = [...cur];
        const iAttack = Math.random() < myBias;
        const pool = (iAttack ? [3, 4, 5] : [0, 1, 2]).filter((i) => (next[i] ?? 0) > 0);
        const target = pool[Math.floor(Math.random() * pool.length)];
        if (target !== undefined) {
          next[target] = Math.max(0, (next[target] ?? 0) - (25 + Math.floor(Math.random() * 25)));
          setHit({ idx: target, sfx: SFX[Math.floor(Math.random() * SFX.length)] ?? "BAM!" });
        }
        const mine = next.slice(0, 3).reduce((a, b) => a + b, 0), theirs = next.slice(3).reduce((a, b) => a + b, 0);
        if (beat >= 10 || mine === 0 || theirs === 0) {
          if (timer.current) window.clearInterval(timer.current);
          setRunning(false);
          setResult(mine >= theirs ? "ZAFER! Liman bölgesi bu gecelik senin." : "YENİLGİ. Daha güçlü silahlar lazım.");
        }
        return next;
      });
    }, 650);
  };
  const Fighter = ({ img, name, sub, i, gray }: { img: string; name: string; sub: string; i: number; gray?: boolean }) => (
    <div className={`panel relative flex items-center gap-2 p-1.5 ${hit?.idx === i ? "shake" : ""} ${(hp[i] ?? 0) === 0 ? "opacity-40 grayscale" : ""}`} key={`${i}-${hit?.idx === i ? hit.sfx : ""}`}>
      <img src={img} alt={name} loading="lazy" className={`portrait h-12 w-12 shrink-0 !border-2 ${gray ? "grayscale" : ""}`} />
      <div className="min-w-0 flex-1 text-xs">
        <div className="truncate font-bold">{name}</div><div className="truncate text-gold">{sub}</div>
        <div className="bar mt-1 !h-2 !border"><div className="!bg-crimson" style={{ width: `${hp[i]}%` }} /></div>
      </div>
      {hit?.idx === i && <span className="pow">{hit.sfx}</span>}
    </div>
  );
  return (
    <main className="screen space-y-4">
      <div className="panel panel-red p-3 text-center">
        <div className="font-display text-2xl text-paper">LİMAN BÖLGESİ · 3v3</div>
        <div className="text-sm">Kazanan ekip limanın kontrolünü ve haraç gelirini alır.</div>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="space-y-2">{crew.map((m, i) => <Fighter key={m.id} img={m.img} name={m.name.split(" —")[0] ?? m.name} sub={inventory.find((w) => w.uid === m.weaponUid)?.name ?? "Silahsız"} i={i} />)}</div>
        <div className="font-display burst text-4xl text-gold drop-shadow-[3px_3px_0_var(--crimson)]">VS</div>
        <div className="space-y-2">{RIVALS.map((r, i) => <Fighter key={r.name} img={r.img} name={r.name} sub="Vera'nın Çetesi" i={i + 3} gray />)}</div>
      </div>
      <div className="panel p-3 text-center">Ekip gücün: <b className="font-display text-2xl text-gold">{power}</b> · Rakip: <b className="font-display text-2xl">{RIVAL_POWER}</b></div>
      {result && <div className="bubble bubble-sys burst !text-lg">{result}</div>}
      <button className="btn-comic btn-red w-full" disabled={running} onClick={start}>{running ? "ÇATIŞMA SÜRÜYOR…" : result ? "TEKRAR İZLE" : "SAVAŞ ÖNİZLEMESİ ▶"}</button>
      <p className="text-center text-xs text-muted-foreground">Bu bir önizleme. Tam animasyonlu çizgi roman savaşı sonraki sürümde.</p>
    </main>
  );
}

function Rank({ rep, power }: { rep: number; power: number }) {
  const rows = [
    { name: "Don Rıza", rep: 870, img: boss }, { name: "Lady Kızıl", rep: 512, img: enforcer },
    { name: "Kel Vito", rep: 340, img: dealer }, { name: "Gölge (Sen)", rep, img: boss, me: true },
    { name: "Kör Nazım", rep: 120, img: dealer },
  ].sort((a, b) => b.rep - a.rep);
  return (
    <main className="screen space-y-3">
      <span className="caption">Şehir Sıralaması</span>
      {rows.map((r, i) => (
        <div key={r.name} className={`panel flex items-center gap-3 p-2 ${"me" in r ? "panel-red" : ""}`}>
          <span className="font-display w-8 text-center text-2xl text-gold">{i + 1}</span>
          <img src={r.img} alt={r.name} loading="lazy" className="portrait h-11 w-11 shrink-0 !border-2" />
          <span className="flex-1 truncate font-semibold">{r.name}</span>
          <span className="chip">★ {r.rep}</span>
        </div>
      ))}
      <p className="text-center text-sm text-muted-foreground">Ekip gücün: {power}. Teslimatlar itibarını artırır.</p>
    </main>
  );
}
