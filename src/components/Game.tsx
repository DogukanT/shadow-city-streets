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
type Seller = { name: string; img: string; rep: number; mood: "tough" | "soft"; trades: number; rating: number; since: string; gang: string };
type Listing = { id: string; weapon: Weapon; seller: Seller; price: number; city: string };
type Msg = { from: "me" | "them" | "sys"; text: string; offer?: number };
type Trade = { listingId: string; msgs: Msg[]; status: "open" | "pending" | "counter" | "deal" | "rejected"; myOffer?: number; counter?: number; final?: number; rounds: number };
type Shipment = { id: string; weapon: Weapon; ship: string; from: string; to: string; start: number; duration: number; price: number; claimed: boolean };
type Member = { id: string; name: string; role: string; img: string; weaponUid: string | null; power: number };
type Screen = "intro" | "city" | "hq" | "market" | "listing" | "escrow" | "port" | "war" | "crew" | "rank" | "story" | "gang" | "zones";

const SELLERS: [Seller, Seller, Seller] = [
  { name: "Kel Vito", img: dealer, rep: 340, mood: "tough", trades: 87, rating: 4.6, since: "Mart 2026", gang: "Liman Fareleri" },
  { name: "Lady Kızıl", img: enforcer, rep: 512, mood: "soft", trades: 143, rating: 4.9, since: "Ocak 2026", gang: "Kızıl Gül" },
  { name: "Don Rıza", img: boss, rep: 870, mood: "tough", trades: 311, rating: 4.8, since: "Kasım 2025", gang: "Altın Aile" },
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
// Üretim: değere göre 5 dk – 24 saat. Prototip: hızlandırılmış (15–60 sn).
const realDeliveryMin = (price: number) => Math.round(Math.min(1440, Math.max(5, 5 + (price / 15000) * 1435)));
const demoDeliverySec = (price: number) => Math.round(Math.min(60, Math.max(15, 15 + price / 350)));
const fmtDur = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} sa ${min % 60} dk` : `${min} dk`);
const fmtClock = (t: number) => new Date(t).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
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
    setShipments((s) => [{ id: uid(), weapon: listing.weapon, ship: SHIPS[Math.floor(Math.random() * SHIPS.length)] ?? "La Notte", from: listing.city, to: "İstanbul", start: Date.now(), duration: demoDeliverySec(price) * 1000, price, claimed: false }, ...s]);
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

        {screen === "intro" && <Intro onPlay={() => go("story")} />}
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
        {screen === "war" && <War key={crew.map((m) => m.weaponUid).join()} crew={crew} inventory={inventory} power={crewPower} />}
        {screen === "zones" && <Zones go={go} />}
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
        <button className="btn-comic btn-red mt-4 w-56 !text-3xl" onClick={onPlay}>OYUNA BAŞLA</button>
      </div>
    </div>
  );
}

const TITLES: Record<Screen, string> = {
  intro: "", city: "SAFEHOUSE", zones: "BÖLGELER", hq: "KARARGÂH", market: "KARA BORSA", listing: "İLAN", escrow: "SÖZLEŞME",
  port: "KARGO", war: "REKABET", crew: "EKİP", rank: "SIRALAMA", story: "HİKÂYE", gang: "GANG",
};
const NAV: { id: Screen; icon: string; label: string }[] = [
  { id: "city", icon: "🏚️", label: "Safehouse" }, { id: "story", icon: "📖", label: "Hikâye" },
  { id: "market", icon: "💼", label: "Borsa" }, { id: "port", icon: "⚓", label: "Kargo" },
  { id: "crew", icon: "🕴️", label: "Ekip" }, { id: "gang", icon: "🃏", label: "Gang" },
  { id: "zones", icon: "🗺️", label: "Bölge" }, { id: "war", icon: "⚔️", label: "Rekabet" },
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
  { x: 50, y: 40, label: "SAFEHOUSE", to: "hq" },
  { x: 62, y: 14, label: "SIRALAMA", to: "rank" },
  { x: 84, y: 50, label: "LİMAN", to: "port" },
  { x: 16, y: 70, label: "Kapıcı Bruno", to: "story", npc: { img: dealer, line: "Patron seni soruyordu. Limanda bir iş var…" } },
  { x: 34, y: 58, label: "Çete Toplantısı", to: "gang", npc: { img: enforcer, line: "Aile kasası boşalıyor. Katkı lazım." } },
  { x: 84, y: 68, label: "Vera'nın Adamı", to: "war", npc: { img: boss, line: "Liman bölgesi bizim. Gücün yeter mi?" } },
];
function City({ go, readyShip, activeShips }: { go: (s: Screen) => void; readyShip: boolean; activeShips: number }) {
  const [npc, setNpc] = useState<Hot | null>(null);
  return (
    <main className="screen !p-0">
      <div className="relative w-full overflow-hidden border-b-4 border-ink" style={{ aspectRatio: "768 / 1152", maxHeight: "calc(100% - 4px)" }}>
        <img src={cityImg} alt="Gece noir şehir sokağı, bar, konak ve liman" width={768} height={1152} className="absolute inset-0 h-full w-full object-cover" />
        <span className="caption absolute left-3 top-3 z-[2]">Safehouse · Gölge Sokağı</span>
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
  const n = STORY[node] ?? STORY["s0"]!;
  return (
    <main className="screen space-y-4">
      <div className="flex items-center justify-between gap-2"><span className="caption">Bölüm I — Kayıp Sevkiyat</span><button className="btn-comic btn-dark !px-3 !py-1 !text-sm" onClick={() => go("city")}>SAFEHOUSE ▶</button></div>
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
      <div className="space-y-2 p-3 pb-0">
        <div className="panel flex items-center gap-3 p-2">
          <img src={listing.seller.img} alt={listing.seller.name} className="portrait h-14 w-14 shrink-0" />
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-display truncate text-lg text-paper">{listing.seller.name} <span className="text-success text-xs">● çevrimiçi</span></div>
            <div className="truncate text-muted-foreground">{listing.seller.gang} · üye: {listing.seller.since}</div>
            <div className="truncate">★ {listing.seller.rep} itibar · {listing.seller.trades} ticaret · ⭐ {listing.seller.rating}</div>
          </div>
        </div>
        <WeaponCard w={listing.weapon} extra={<div className="mt-1 flex justify-between text-sm"><span>Konum: {listing.city}</span><span className="font-display text-xl text-gold">{fmt(listing.price)}</span></div>} />
      </div>

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
        <div className="flex justify-between text-sm text-muted-foreground"><span>Tahmini süre</span><span>{fmtDur(realDeliveryMin(price))} (demo: {demoDeliverySec(price)} sn)</span></div>
      </div>
      <button className="btn-comic btn-green w-full" onClick={onConfirm}>ÖDEMEYİ ONAYLA & KARGOYA VER</button>
    </main>
  );
}

function Port({ shipments, now, onClaim, go }: { shipments: Shipment[]; now: number; onClaim: (s: Shipment) => void; go: (s: Screen) => void }) {
  return (
    <main className="screen space-y-4">
      <span className="caption">Liman — Kargo Takibi</span>
      <p className="text-sm text-muted-foreground">Gerçek sistemde teslimat eşya değerine göre 5 dk – 24 saat sürer. Prototipte süre hızlandırıldı.</p>
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
              <span className="chip">{s.claimed ? "TESLİM ALINDI" : done ? "HAZIR" : `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="border-2 border-border p-1.5"><div className="text-muted-foreground">KALKIŞ · {s.from}</div><b>{fmtClock(s.start)}</b></div>
              <div className="border-2 border-border p-1.5 text-right"><div className="text-muted-foreground">VARIŞ · {s.to}</div><b>{fmtClock(s.start + s.duration)}</b></div>
              <div className="col-span-2 text-muted-foreground">Gerçek teslimat süresi: {fmtDur(realDeliveryMin(s.price))}</div>
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

type Fighter = { name: string; img: string; weapon: string; dmg: number; hp: number; max: number; side: "me" | "foe" };
const RIVALS: { name: string; img: string; weapon: string; dmg: number }[] = [
  { name: "Kör Nazım", img: dealer, weapon: "Pompalı", dmg: 34 }, { name: "Vera Mortis", img: enforcer, weapon: "Kızıl SMG", dmg: 40 }, { name: "Baron Kemal", img: boss, weapon: "Tabanca", dmg: 28 },
];
const SFX = ["BAM!", "POW!", "KRAK!", "BANG!", "RATATA!"];
function War({ crew, inventory, power }: { crew: Member[]; inventory: Weapon[]; power: number }) {
  const build = (): Fighter[] => [
    ...crew.map((m) => { const w = inventory.find((x) => x.uid === m.weaponUid); return { name: m.name.split(" —")[0] ?? m.name, img: m.img, weapon: w?.name ?? "Yumruk", dmg: Math.round(m.power / 4) + (w?.dmg ?? 8) / 2, hp: 120, max: 120, side: "me" as const }; }),
    ...RIVALS.map((r) => ({ ...r, hp: 120, max: 120, side: "foe" as const })),
  ];
  const [f, setF] = useState<Fighter[]>(build);
  const [turn, setTurn] = useState(0); // index of my fighter acting (0..2)
  const [round, setRound] = useState(1);
  const [fx, setFx] = useState<{ target: number; attacker: number; dmg: number; sfx: string; k: number } | null>(null);
  const [log, setLog] = useState<string[]>(["Tur 1 — Saldıracak hedefi seç."]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const alive = (i: number, arr = f) => (arr[i]?.hp ?? 0) > 0;
  const reset = () => { setF(build()); setTurn(0); setRound(1); setFx(null); setResult(null); setBusy(false); setLog(["Tur 1 — Saldıracak hedefi seç."]); };

  const hitOnce = (arr: Fighter[], a: number, t: number) => {
    const att = arr[a]!; const crit = Math.random() < 0.2;
    const dmg = Math.round(att.dmg * (0.8 + Math.random() * 0.4) * (crit ? 1.8 : 1));
    const next = arr.map((x, i) => (i === t ? { ...x, hp: Math.max(0, x.hp - dmg) } : x));
    setFx({ target: t, attacker: a, dmg, sfx: crit ? "KRİTİK!" : SFX[Math.floor(Math.random() * SFX.length)] ?? "BAM!", k: Math.random() });
    setLog((l) => [`${att.name} → ${arr[t]!.name}: -${dmg}${crit ? " (kritik)" : ""} · ${att.weapon}`, ...l].slice(0, 5));
    return next;
  };
  const check = (arr: Fighter[]) => {
    if ([0, 1, 2].every((i) => !alive(i, arr))) { setResult("YENİLGİ. Ekibine daha güçlü silahlar kuşandır."); return true; }
    if ([3, 4, 5].every((i) => !alive(i, arr))) { setResult("ZAFER! Liman bölgesi artık senin."); return true; }
    return false;
  };
  const attack = (target: number) => {
    if (busy || result || !alive(target)) return;
    let actor = turn; while (!alive(actor) && actor < 2) actor++;
    setBusy(true);
    let arr = hitOnce(f, actor, target); setF(arr);
    if (check(arr)) { setBusy(false); return; }
    window.setTimeout(() => {
      const foes = [3, 4, 5].filter((i) => alive(i, arr)); const mine = [0, 1, 2].filter((i) => alive(i, arr));
      const a = foes[Math.floor(Math.random() * foes.length)]!; const t = mine[Math.floor(Math.random() * mine.length)]!;
      arr = hitOnce(arr, a, t); setF(arr);
      if (!check(arr)) {
        let n = (actor + 1) % 3; let guard = 0; while (!alive(n, arr) && guard++ < 3) n = (n + 1) % 3;
        if (n <= actor) setRound((r) => r + 1);
        setTurn(n);
      }
      setBusy(false);
    }, 900);
  };

  const Card = ({ x, i }: { x: Fighter; i: number }) => {
    const isHit = fx?.target === i, isAtk = fx?.attacker === i;
    const acting = !result && x.side === "me" && i === turn && !busy;
    return (
      <button key={`${i}-${isHit ? fx!.k : 0}`} disabled={x.side === "me" || busy || !!result || x.hp === 0} onClick={() => attack(i)}
        className={`panel relative block w-full p-1.5 text-left ${isHit ? "shake" : ""} ${isAtk ? (x.side === "me" ? "lunge-r" : "lunge-l") : ""} ${x.hp === 0 ? "opacity-35 grayscale" : ""} ${acting ? "!shadow-[0_0_0_3px_var(--gold),6px_6px_0_2px_var(--ink)]" : ""} ${x.side === "foe" && !busy && !result && x.hp > 0 ? "target-pick" : ""}`}>
        <div className="flex items-center gap-2">
          <img src={x.img} alt={x.name} loading="lazy" className={`portrait h-12 w-12 shrink-0 !border-2 ${x.side === "foe" ? "grayscale-[60%]" : ""}`} />
          <div className="min-w-0 flex-1 text-xs">
            <div className="truncate font-bold">{x.name}</div>
            <div className="truncate text-gold">🔫 {x.weapon} · {Math.round(x.dmg)}</div>
            <div className="bar mt-1 !h-2.5 !border"><div className="!bg-crimson" style={{ width: `${(x.hp / x.max) * 100}%` }} /></div>
            <div className="text-[10px] text-muted-foreground">{x.hp}/{x.max}</div>
          </div>
        </div>
        {isHit && <><span className="pow">{fx!.sfx}</span><span className="dmg-num">-{fx!.dmg}</span></>}
      </button>
    );
  };
  return (
    <main className="screen space-y-3">
      <div className="panel panel-red p-3 text-center">
        <div className="font-display text-2xl text-paper">REKABET · 3v3 · TUR {round}</div>
        <div className="text-sm">{result ? "Savaş bitti" : busy ? "Rakip karşılık veriyor…" : `${f[turn]?.name ?? ""} hamlesi — bir rakibe dokun`}</div>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="contents"><Card x={f[i]!} i={i} /><Card x={f[i + 3]!} i={i + 3} /></div>
        ))}
      </div>
      {result && <div className="bubble bubble-sys burst !text-lg">{result}</div>}
      <div className="panel space-y-1 p-2 text-sm">{log.map((l, i) => <div key={i} className={i === 0 ? "text-gold" : "text-muted-foreground"}>{l}</div>)}</div>
      <div className="flex items-center justify-between text-sm text-muted-foreground"><span>Ekip gücü {power}</span><button className="btn-comic btn-dark !px-3 !py-1 !text-sm" onClick={reset}>YENİDEN BAŞLAT</button></div>
    </main>
  );
}

const ZONES = [
  { name: "Gölge Sokağı", owner: "Gölge Ailesi", income: 300, mine: true },
  { name: "Liman Bölgesi", owner: "Vera Mortis", income: 900, mine: false },
  { name: "Eski Çarşı", owner: "Sahipsiz", income: 450, mine: false },
  { name: "Altın Mahalle", owner: "Don Rıza", income: 1500, mine: false },
];
function Zones({ go }: { go: (s: Screen) => void }) {
  return (
    <main className="screen space-y-3">
      <span className="caption">Şehrin Bölgeleri</span>
      {ZONES.map((z) => (
        <div key={z.name} className={`panel p-3 ${z.mine ? "panel-red" : ""}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0"><div className="font-display truncate text-xl text-paper">{z.name}</div><div className="text-sm">Haraç: {fmt(z.income)}/gün</div></div>
            <span className="chip">{z.owner}</span>
          </div>
          {!z.mine && <button className="btn-comic btn-red mt-2 w-full !py-2 !text-base" onClick={() => go("war")}>BÖLGEYE SALDIR (3v3)</button>}
        </div>
      ))}
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
