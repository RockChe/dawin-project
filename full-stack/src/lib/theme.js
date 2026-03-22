// Theme system — constants and pure functions (reactive state in ThemeProvider)
export const THEMES = {
  warm: { key:"warm", label:"Daylight", icon:"☀️", isDark:false,
    bg:"#F5F3EF", surface:"#FFFFFF", surfaceHover:"#EEEBE5", surfaceLight:"#EEEBE5",
    accent:"#2B8FBF", accentDark:"#1F7AA6",
    text:"#2C2A25", textSec:"#6B6560", textDim:"#A09B93",
    border:"#E2DED6", borderLight:"#EEEBE4",
    red:"#E54D4D", amber:"#E5A118", green:"#27AE7A", purple:"#8B5CC6", pink:"#D94B86", cyan:"#0891B2",
    shadow:"rgba(0,0,0,0.07)", shadowHeavy:"rgba(0,0,0,0.12)",
    surfaceShadow:"0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)",
    surfaceShadowHover:"0 4px 12px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)",
    modalShadow:"0 24px 64px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.08)",
    scrollThumb:"#C5C2BC", selectionBg:"#2B8FBF30" },
  dimmed: { key:"dimmed", label:"Nightshift", icon:"\uD83C\uDF19", isDark:true,
    bg:"#1A1E26", surface:"#242A34", surfaceHover:"#303842", surfaceLight:"#1E242E",
    accent:"#50B5D6", accentDark:"#3DA0C0",
    text:"#C2CDD8", textSec:"#8A95A4", textDim:"#5A6474",
    border:"#323A45", borderLight:"#242A34",
    red:"#F06860", amber:"#F0BC3A", green:"#3DC07A", purple:"#BD8DF0", pink:"#E86CA8", cyan:"#22D3EE",
    shadow:"rgba(0,0,0,0.35)", shadowHeavy:"rgba(0,0,0,0.50)",
    surfaceShadow:"0 1px 3px rgba(0,0,0,0.2), 0 1px 2px rgba(0,0,0,0.15)",
    surfaceShadowHover:"0 4px 12px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.2)",
    modalShadow:"0 24px 64px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.3)",
    scrollThumb:"#5A6474", selectionBg:"#50B5D630" },
};

export const THEME_ORDER = ["dimmed","warm"];

export function mkSC(t){ const a=t.isDark?"25":"15"; return {"已完成":{color:t.green,bg:t.green+a,icon:"✓"},"進行中":{color:t.amber,bg:t.amber+a,icon:"▸"},"待辦":{color:t.accent,bg:t.accent+a,icon:"○"},"提案中":{color:t.pink,bg:t.pink+a,icon:"◇"},"待確認":{color:t.purple,bg:t.purple+a,icon:"?"}}; }
export function mkPC(t){ return {"高":{color:t.red},"中":{color:t.amber},"低":{color:t.textDim}}; }
export function mkCC(t){ return {"商務合作":t.accent,"活動":t.purple,"播出/開始":t.amber,"行銷":t.cyan,"發行":t.green,"市場展":t.red}; }
export function mkPJC(t){ return [t.accent,t.purple,t.amber,t.red,t.green,t.cyan,t.pink]; }

export const F = "var(--font-noto-sans-tc),-apple-system,BlinkMacSystemFont,sans-serif";
export const FM = "var(--font-jetbrains-mono),'SF Mono',monospace";
export const FD_STYLE = { fontWeight: 800, letterSpacing: "-0.02em" };
