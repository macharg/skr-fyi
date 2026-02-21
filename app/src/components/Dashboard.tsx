import { useState, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

// ── PALETTE — evolved from original, warmer + more character ─────────────────
const C = {
  bg: "#06090F",
  surface: "rgba(255,255,255,0.025)",
  surfaceHover: "rgba(255,255,255,0.045)",
  card: "rgba(255,255,255,0.03)",
  border: "rgba(255,255,255,0.07)",
  borderAccent: "rgba(20,241,149,0.2)",
  green: "#14F195",
  purple: "#9945FF",
  cyan: "#00D4FF",
  orange: "#FF8C42",
  pink: "#FF5CAA",
  yellow: "#FFD93D",
  text: "#E8ECF1",
  textSoft: "#B0BAC9",
  textMuted: "#6B7A8D",
  textDim: "#3D4A5C",
  positive: "#14F195",
  negative: "#FF5C5C",
};

const TOKEN_COLORS = [C.purple, C.green, C.cyan, C.orange, C.yellow, "#68D5F7", "#4A5568"];

// ── SAMPLE DATA ──────────────────────────────────────────────────────────────
const dailyActivity = Array.from({ length: 90 }, (_, i) => {
  const d = new Date(2025, 10, 23);
  d.setDate(d.getDate() + i);
  const base = 12000 + Math.sin(i / 7) * 3000 + i * 80;
  const spike = i > 58 && i < 65 ? 15000 : 0;
  return {
    date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    transactions: Math.round(base + spike + Math.random() * 2000),
    activeWallets: Math.round((base + spike) * 0.35 + Math.random() * 800),
    swapVolume: Math.round((base + spike) * 42 + Math.random() * 500000),
    swapCount: Math.round((base + spike) * 0.15),
  };
});

const holdings = [
  { name: "SOL", pct: 42.3, val: "$601M", holders: "98K", color: C.purple },
  { name: "SKR", pct: 18.7, val: "$265M", holders: "85K", color: C.green },
  { name: "USDC", pct: 15.2, val: "$216M", holders: "62K", color: C.cyan },
  { name: "JUP", pct: 6.8, val: "$96.6M", holders: "41K", color: C.orange },
  { name: "BONK", pct: 4.1, val: "$58.2M", holders: "35K", color: C.yellow },
  { name: "RAY", pct: 3.4, val: "$48.3M", holders: "22K", color: "#68D5F7" },
  { name: "Other", pct: 9.5, val: "$135M", holders: "—", color: "#4A5568" },
];

const dapps = [
  { name: "Jupiter", cat: "DEX", users: "67.4K", vol: "$892M", chg: "+12.4%" },
  { name: "Raydium", cat: "DEX", users: "48.2K", vol: "$456M", chg: "+8.2%" },
  { name: "Kamino", cat: "DeFi", users: "34.6K", vol: "$234M", chg: "+22.1%" },
  { name: "Tensor", cat: "NFT", users: "28.3K", vol: "$156M", chg: "+5.7%" },
  { name: "Marinade", cat: "Staking", users: "22.1K", vol: "$198M", chg: "+3.1%" },
  { name: "Drift", cat: "Perps", users: "19.9K", vol: "$312M", chg: "+18.9%" },
  { name: "Orca", cat: "DEX", users: "17.7K", vol: "$178M", chg: "+6.3%" },
];

const cats = [
  { name: "DeFi", pct: 38, color: C.green },
  { name: "DEX", pct: 28, color: C.purple },
  { name: "NFT/Gaming", pct: 14, color: C.orange },
  { name: "Staking", pct: 11, color: C.cyan },
  { name: "DePIN", pct: 5, color: C.yellow },
  { name: "Other", pct: 4, color: C.textDim },
];

const last30 = dailyActivity.slice(-30);

// ── COMPONENTS ───────────────────────────────────────────────────────────────

const StatCard = ({ label, value, sub, accent }) => (
  <div style={{
    position: "relative", overflow: "hidden",
    borderRadius: 14, padding: "20px 22px",
    border: `1px solid ${accent ? C.borderAccent : C.border}`,
    background: accent
      ? `linear-gradient(135deg, ${C.green}08, ${C.purple}05)`
      : C.card,
  }}>
    {accent && (
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${C.green}, ${C.purple})`,
      }} />
    )}
    <div style={{
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 10, fontWeight: 500,
      textTransform: "uppercase", letterSpacing: "0.14em",
      color: C.textMuted, marginBottom: 8,
    }}>{label}</div>
    <div style={{
      fontFamily: "'Sora', sans-serif",
      fontSize: 28, fontWeight: 700,
      color: C.text, lineHeight: 1,
      letterSpacing: "-0.02em",
    }}>{value}</div>
    {sub && (
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11, fontWeight: 500, marginTop: 6,
        color: sub.startsWith("+") ? C.positive : sub.startsWith("-") ? C.negative : C.textMuted,
      }}>{sub}</div>
    )}
  </div>
);

const SectionHead = ({ title, sub }) => (
  <div style={{ marginBottom: 16 }}>
    <h2 style={{
      fontFamily: "'Sora', sans-serif",
      fontSize: 16, fontWeight: 600,
      color: C.text, margin: 0,
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <span style={{
        display: "inline-block", width: 4, height: 18, borderRadius: 2,
        background: `linear-gradient(180deg, ${C.green}, ${C.purple})`,
      }} />
      {title}
    </h2>
    {sub && (
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11, color: C.textMuted, marginTop: 3, marginLeft: 14,
      }}>{sub}</div>
    )}
  </div>
);

const Card = ({ children, style: s = {} }) => (
  <div style={{
    borderRadius: 14,
    border: `1px solid ${C.border}`,
    background: C.card,
    padding: 24,
    ...s,
  }}>{children}</div>
);

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: `${C.bg}F0`, border: `1px solid ${C.borderAccent}`,
      borderRadius: 8, padding: "8px 12px",
      backdropFilter: "blur(8px)",
    }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.textMuted, marginBottom: 3 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: p.color || C.text }}>
          {p.name}: {typeof p.value === "number" && p.value > 9999
            ? p.value > 1e6 ? `$${(p.value / 1e6).toFixed(1)}M` : `${(p.value / 1000).toFixed(1)}K`
            : p.value?.toLocaleString()}
        </div>
      ))}
    </div>
  );
};

// ── TABS ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "activity", label: "On-Chain Activity" },
  { id: "holdings", label: "Holdings" },
  { id: "dapps", label: "dApp Ecosystem" },
  { id: "skr", label: "SKR Economy" },
];

// ── MAIN ─────────────────────────────────────────────────────────────────────

export default function SkrFyiDashboard() {
  const [tab, setTab] = useState("overview");
  const [tick, setTick] = useState(false);

  useEffect(() => {
    const i = setInterval(() => setTick((t) => !t), 12000);
    return () => clearInterval(i);
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: C.bg,
      color: C.text,
      fontFamily: "'Sora', sans-serif",
      position: "relative",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Sora:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; }
        ::selection { background: ${C.green}30; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        @keyframes tickerScroll { 0% { transform: translateX(0) } 100% { transform: translateX(-50%) } }
        @keyframes glitchFlash { 0%,100%{ opacity:1 } 92%{ opacity:1 } 93%{ opacity:0.4; transform:translateX(2px) } 94%{ opacity:1; transform:translateX(-1px) } 95%{ opacity:0.6 } 96%{ opacity:1; transform:translateX(0) } }
        @keyframes pulseGlow { 0%,100%{ opacity:0.5 } 50%{ opacity:1 } }
        .fade-up { animation: fadeUp 0.5s ease both }
        ::-webkit-scrollbar { width: 5px }
        ::-webkit-scrollbar-track { background: transparent }
        ::-webkit-scrollbar-thumb { background: ${C.purple}40; border-radius: 3px }
      `}</style>

      {/* Background effects */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: -200, right: -200, width: 500, height: 500, borderRadius: "50%", background: `${C.purple}08`, filter: "blur(100px)" }} />
        <div style={{ position: "absolute", bottom: -100, left: -100, width: 400, height: 400, borderRadius: "50%", background: `${C.green}05`, filter: "blur(100px)" }} />
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "radial-gradient(rgba(255,255,255,0.015) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />
      </div>

      {/* ── TICKER ──────────────────────────────────────────── */}
      <div style={{
        position: "relative", zIndex: 10,
        borderBottom: `1px solid ${C.border}`,
        overflow: "hidden", height: 32,
        display: "flex", alignItems: "center",
        background: "rgba(255,255,255,0.015)",
      }}>
        <div style={{
          display: "flex", whiteSpace: "nowrap",
          animation: "tickerScroll 40s linear infinite",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11, color: C.textMuted,
        }}>
          {[...Array(2)].map((_, r) => (
            <span key={r} style={{ display: "flex", gap: 28, paddingRight: 28 }}>
              <span><span style={{ color: C.green }}>●</span> SKR $0.0209</span>
              <span><span style={{ color: C.purple }}>●</span> SOL $178.50</span>
              <span>200K+ devices shipped</span>
              <span>142.8K txns today</span>
              <span>$1.42B total holdings</span>
              <span>68.2% SKR staked</span>
              <span>400+ dApps</span>
              <span>34.2K active wallets</span>
              <span style={{ color: C.textDim }}>—</span>
              <span>data refreshes every 2h</span>
              <span style={{ color: C.textDim }}>—</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── HEADER ──────────────────────────────────────────── */}
      <header style={{
        position: "relative", zIndex: 10,
        maxWidth: 1280, margin: "0 auto", padding: "24px 28px 0",
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "flex-end",
          flexWrap: "wrap", gap: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: `linear-gradient(135deg, ${C.green}, ${C.purple})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, fontWeight: 800, color: C.bg,
              boxShadow: `0 0 24px ${C.green}25`,
            }}>
              <svg width="26" height="22" viewBox="0 0 26 22" fill="none">
                <polyline
                  points="2,18 6,14 10,16 14,6 18,10 22,3 24,4"
                  stroke="#06090F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  fill="none"
                />
                <circle cx="24" cy="4" r="2" fill="#06090F" />
              </svg>
            </div>
            <div>
              <h1 style={{
                fontSize: 26, fontWeight: 800, lineHeight: 1,
                letterSpacing: "-0.03em",
                animation: tick ? "glitchFlash 0.3s linear" : "none",
              }}>
                <span style={{ color: C.text }}>skr</span>
                <span style={{ color: C.green }}>.</span>
                <span style={{ color: C.text }}>fyi</span>
              </h1>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10, color: C.textMuted,
                letterSpacing: "0.08em", marginTop: 2,
              }}>Solana Seeker Ecosystem Analytics</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "5px 12px", borderRadius: 20,
              border: `1px solid ${C.green}20`,
              background: `${C.green}08`,
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%",
                background: C.green,
                boxShadow: `0 0 6px ${C.green}80`,
                animation: "pulseGlow 2s ease infinite",
              }} />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.green }}>Live</span>
            </div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10, color: C.textDim,
              padding: "5px 12px", borderRadius: 20,
              border: `1px solid ${C.border}`,
            }}>Feb 20, 2026</div>
          </div>
        </div>

        {/* Tabs */}
        <nav style={{
          display: "flex", gap: 2, marginTop: 22,
          padding: 3, borderRadius: 12,
          background: "rgba(255,255,255,0.02)",
          border: `1px solid ${C.border}`,
        }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, padding: "11px 8px",
                border: "none", borderRadius: 9,
                cursor: "pointer",
                fontFamily: "'Sora', sans-serif",
                fontSize: 12, fontWeight: tab === t.id ? 600 : 400,
                transition: "all 0.2s ease",
                background: tab === t.id
                  ? `linear-gradient(135deg, ${C.green}10, ${C.purple}08)`
                  : "transparent",
                color: tab === t.id ? C.text : C.textMuted,
                boxShadow: tab === t.id ? `0 0 16px ${C.green}06` : "none",
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      {/* ── CONTENT ─────────────────────────────────────────── */}
      <main style={{
        position: "relative", zIndex: 10,
        maxWidth: 1280, margin: "0 auto", padding: "24px 28px 80px",
      }}>

        {/* ═══ OVERVIEW ═══════════════════════════════════════ */}
        {tab === "overview" && (
          <div className="fade-up">
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 12, marginBottom: 24,
            }}>
              <StatCard label="Seeker Devices" value="200K+" sub="+3.2% this month" accent />
              <StatCard label="Active Wallets (24h)" value="34,280" sub="+8.4% vs yesterday" />
              <StatCard label="Total Holdings" value="$1.42B" sub="+2.1% (7d)" accent />
              <StatCard label="Daily Transactions" value="142.8K" sub="+11.2% vs avg" />
              <StatCard label="SKR Market Cap" value="$111M" sub="$0.0209 per token" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <Card>
                <SectionHead title="Daily Active Wallets" sub="SGT holders with ≥1 tx · 30 days" />
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={last30}>
                    <defs>
                      <linearGradient id="gFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.green} stopOpacity={0.2} />
                        <stop offset="100%" stopColor={C.green} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: C.textDim, fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: C.textDim, fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="activeWallets" stroke={C.green} strokeWidth={2} fill="url(#gFill)" name="Active Wallets" />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>

              <Card>
                <SectionHead title="Swap Volume" sub="DEX volume from Seeker wallets" />
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={last30}>
                    <defs>
                      <linearGradient id="pFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.purple} stopOpacity={0.2} />
                        <stop offset="100%" stopColor={C.purple} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: C.textDim, fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: C.textDim, fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1e6).toFixed(0)}M`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="swapVolume" stroke={C.purple} strokeWidth={2} fill="url(#pFill)" name="Volume" />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.8fr", gap: 14 }}>
              <Card>
                <SectionHead title="Token Holdings" sub="By portfolio value" />
                <ResponsiveContainer width="100%" height={230}>
                  <PieChart>
                    <Pie data={holdings} cx="50%" cy="50%" innerRadius={60} outerRadius={92} paddingAngle={2.5} dataKey="pct" stroke="none">
                      {holdings.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload;
                      return (
                        <div style={{ background: `${C.bg}F0`, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", fontFamily: "JetBrains Mono", fontSize: 11 }}>
                          <span style={{ color: p.color, fontWeight: 600 }}>{p.name}</span>: {p.pct}% — {p.val}
                        </div>
                      );
                    }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", justifyContent: "center", marginTop: 4 }}>
                  {holdings.map((h) => (
                    <span key={h.name} style={{
                      display: "flex", alignItems: "center", gap: 5,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 10, color: C.textMuted,
                    }}>
                      <span style={{ width: 7, height: 7, borderRadius: 2, background: h.color }} />
                      {h.name} {h.pct}%
                    </span>
                  ))}
                </div>
              </Card>

              <Card style={{ padding: 0 }}>
                <div style={{ padding: "20px 24px 0" }}>
                  <SectionHead title="Top Protocols" sub="By Seeker user count (7d)" />
                </div>
                <div style={{
                  display: "grid", gridTemplateColumns: "2fr 0.8fr 1fr 1fr 0.8fr",
                  padding: "0 24px 8px",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9, fontWeight: 500,
                  textTransform: "uppercase", letterSpacing: "0.1em",
                  color: C.textDim,
                }}>
                  <span>Protocol</span><span>Category</span>
                  <span style={{ textAlign: "right" }}>Users</span>
                  <span style={{ textAlign: "right" }}>Volume</span>
                  <span style={{ textAlign: "right" }}>7d</span>
                </div>
                {dapps.map((d, i) => (
                  <div key={d.name} style={{
                    display: "grid", gridTemplateColumns: "2fr 0.8fr 1fr 1fr 0.8fr",
                    alignItems: "center", padding: "11px 24px",
                    borderTop: `1px solid ${C.border}`,
                    fontSize: 13,
                  }}>
                    <span style={{ fontWeight: 600 }}>{d.name}</span>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 10, color: C.textMuted,
                      background: C.surfaceHover,
                      padding: "2px 8px", borderRadius: 4, width: "fit-content",
                    }}>{d.cat}</span>
                    <span style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: C.textSoft }}>{d.users}</span>
                    <span style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: C.textSoft }}>{d.vol}</span>
                    <span style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.positive, fontWeight: 600 }}>{d.chg}</span>
                  </div>
                ))}
              </Card>
            </div>
          </div>
        )}

        {/* ═══ ACTIVITY ═══════════════════════════════════════ */}
        {tab === "activity" && (
          <div className="fade-up">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
              <StatCard label="Txns Today" value="142,847" sub="+11.2%" accent />
              <StatCard label="Avg / Wallet" value="4.17" sub="+0.3 this week" />
              <StatCard label="Unique Signers" value="34,280" sub="+8.4%" />
              <StatCard label="Failed Rate" value="2.1%" sub="-0.3% ↓" accent />
            </div>
            <Card style={{ marginBottom: 14 }}>
              <SectionHead title="Daily Transactions" sub="All txns from SGT wallets · 90 days" />
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={dailyActivity}>
                  <defs>
                    <linearGradient id="txFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.green} stopOpacity={0.18} />
                      <stop offset="100%" stopColor={C.green} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: C.textDim, fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} interval={6} />
                  <YAxis tick={{ fontSize: 10, fill: C.textDim, fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="transactions" stroke={C.green} strokeWidth={2} fill="url(#txFill)" name="Transactions" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Card>
                <SectionHead title="Active Wallets" sub="Unique signers per day" />
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={last30}>
                    <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: C.textDim, fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: C.textDim, fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Line type="monotone" dataKey="activeWallets" stroke={C.orange} strokeWidth={2} dot={false} name="Wallets" />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
              <Card>
                <SectionHead title="Swap Count" />
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={last30}>
                    <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: C.textDim, fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: C.textDim, fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="swapCount" fill={C.purple} radius={[4, 4, 0, 0]} name="Swaps" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </div>
        )}

        {/* ═══ HOLDINGS ═══════════════════════════════════════ */}
        {tab === "holdings" && (
          <div className="fade-up">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
              <StatCard label="Total Value" value="$1.42B" sub="+2.1% (7d)" accent />
              <StatCard label="Avg / Wallet" value="$7,080" sub="+$340" />
              <StatCard label="SOL Held" value="4.82M SOL" sub="42.3% of portfolio" />
              <StatCard label="SKR Staked" value="68.2%" sub="of circulating" accent />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Card>
                <SectionHead title="Portfolio Distribution" />
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={holdings} cx="50%" cy="50%" innerRadius={75} outerRadius={115} paddingAngle={2.5} dataKey="pct" stroke="none">
                      {holdings.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload;
                      return (
                        <div style={{ background: `${C.bg}F0`, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", fontFamily: "JetBrains Mono", fontSize: 11 }}>
                          <span style={{ color: p.color, fontWeight: 600 }}>{p.name}</span>: {p.pct}% — {p.val}
                        </div>
                      );
                    }} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
              <Card>
                <SectionHead title="Breakdown" />
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {holdings.map((h) => (
                    <div key={h.name}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{h.name}</span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: C.textMuted }}>{h.val}</span>
                      </div>
                      <div style={{ height: 8, borderRadius: 4, background: C.surfaceHover, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", width: `${h.pct}%`, borderRadius: 4,
                          background: `linear-gradient(90deg, ${h.color}, ${h.color}80)`,
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ═══ DAPPS ══════════════════════════════════════════ */}
        {tab === "dapps" && (
          <div className="fade-up">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
              <StatCard label="Total dApps" value="400+" accent />
              <StatCard label="Active (7d)" value="187" sub="+14 new" />
              <StatCard label="Avg / User" value="3.8" sub="+0.4" />
              <StatCard label="Dev Teams" value="188" sub="SKR allocated" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Card>
                <SectionHead title="Category Engagement" />
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {cats.map((c) => (
                    <div key={c.name}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.textMuted }}>{c.pct}%</span>
                      </div>
                      <div style={{ height: 8, borderRadius: 4, background: C.surfaceHover, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", width: `${c.pct * 2.5}%`, borderRadius: 4,
                          background: `linear-gradient(90deg, ${c.color}, ${c.color}60)`,
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
              <Card>
                <SectionHead title="Protocol Leaderboard" />
                {dapps.map((d, i) => (
                  <div key={d.name} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "11px 0", borderBottom: `1px solid ${C.border}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 11, color: C.textDim, width: 20 }}>{i + 1}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{d.name}</div>
                        <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 10, color: C.textDim }}>{d.cat} · {d.users} users</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 12, color: C.textSoft }}>{d.vol}</div>
                      <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 11, color: C.positive, fontWeight: 600 }}>{d.chg}</div>
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          </div>
        )}

        {/* ═══ SKR ════════════════════════════════════════════ */}
        {tab === "skr" && (
          <div className="fade-up">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
              <StatCard label="SKR Price" value="$0.0209" accent />
              <StatCard label="Market Cap" value="$111.3M" />
              <StatCard label="Circulating" value="5.33B" sub="of 10B total" />
              <StatCard label="24h Volume" value="$17.6M" accent />
              <StatCard label="Staked" value="68.2%" sub="3.64B SKR" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <Card style={{ textAlign: "center" }}>
                <SectionHead title="Staking Rate" sub="% of circulating supply staked" />
                <div style={{ position: "relative", width: 190, height: 190, margin: "16px auto" }}>
                  <svg width={190} height={190} viewBox="0 0 200 200">
                    <circle cx={100} cy={100} r={82} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={12} />
                    <circle cx={100} cy={100} r={82} fill="none"
                      stroke="url(#stakeFill)" strokeWidth={12} strokeLinecap="round"
                      strokeDasharray={`${68.2 * 5.152} ${(100 - 68.2) * 5.152}`}
                      transform="rotate(-90 100 100)"
                      style={{ filter: `drop-shadow(0 0 8px ${C.green}30)` }}
                    />
                    <defs>
                      <linearGradient id="stakeFill" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={C.green} />
                        <stop offset="100%" stopColor={C.purple} />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div style={{
                    position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                  }}>
                    <span style={{ fontSize: 32, fontWeight: 700, color: C.text }}>68.2%</span>
                    <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 10, color: C.textMuted }}>staked</span>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
                  <div>
                    <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 9, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.12em" }}>Staked</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: C.green, marginTop: 2 }}>3.64B</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 9, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.12em" }}>Liquid</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: C.purple, marginTop: 2 }}>1.69B</div>
                  </div>
                </div>
              </Card>
              <Card>
                <SectionHead title="Tokenomics" sub="10B total supply" />
                <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                  {[
                    { l: "Community Airdrop", v: "3.0B", p: 30, c: C.green },
                    { l: "Ecosystem & Growth", v: "2.5B", p: 25, c: C.purple },
                    { l: "Team & Contributors", v: "2.0B", p: 20, c: C.orange },
                    { l: "Liquidity", v: "1.0B", p: 10, c: C.cyan },
                    { l: "Treasury", v: "1.0B", p: 10, c: C.yellow },
                    { l: "Guardians", v: "0.5B", p: 5, c: C.textMuted },
                  ].map((t) => (
                    <div key={t.l}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 500 }}>
                          <span style={{ width: 7, height: 7, borderRadius: 2, background: t.c }} />
                          {t.l}
                        </span>
                        <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 11, color: C.textMuted }}>{t.v} · {t.p}%</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: C.surfaceHover, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", width: `${t.p * 3.33}%`, borderRadius: 3,
                          background: `linear-gradient(90deg, ${t.c}, ${t.c}60)`,
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
            <Card>
              <SectionHead title="Season 1 Airdrop" sub="Completed January 21, 2026" />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
                {[
                  { l: "Distributed", v: "~1.96B", s: "20% of supply" },
                  { l: "Recipients", v: "100,908", s: "1.82B SKR" },
                  { l: "Dev Teams", v: "188", s: "750K each" },
                  { l: "Avg Alloc", v: "~18K SKR", s: "~$376" },
                  { l: "Claim Window", v: "90 days", s: "→ Apr 20" },
                  { l: "Yr1 Inflation", v: "10%", s: "→ ~2%" },
                ].map((s) => (
                  <div key={s.l} style={{
                    borderRadius: 10, border: `1px solid ${C.border}`,
                    background: C.surfaceHover, padding: "16px 14px", textAlign: "center",
                  }}>
                    <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 9, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{s.l}</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{s.v}</div>
                    <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 10, color: C.textDim, marginTop: 4 }}>{s.s}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </main>

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <footer style={{
        position: "relative", zIndex: 10,
        maxWidth: 1280, margin: "0 auto", padding: "0 28px 40px",
      }}>
        <div style={{ height: 1, background: C.border, marginBottom: 16 }} />
        <div style={{
          display: "flex", justifyContent: "space-between",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10, color: C.textDim,
        }}>
          <span>skr.fyi · Powered by Helius RPC · 100% on-chain data</span>
          <span>Updated every 2 hours · Open source</span>
        </div>
      </footer>
    </div>
  );
}
