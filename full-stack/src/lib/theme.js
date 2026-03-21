// Theme system — mutable live-binding exports
export const THEMES = {
  warm: { key:"warm", label:"Warm Neutral", icon:"\uD83D\uDCC4", isDark:false,
    bg:"#F5F3EF", surface:"#FFFFFF", surfaceHover:"#EEECE8", surfaceLight:"#EEECE8",
    accent:"#2383E2", accentDark:"#1B6EC2",
    text:"#37352F", textSec:"#6B6B6B", textDim:"#9B9A97",
    border:"#E3E2DE", borderLight:"#EEECE8",
    red:"#EB5757", amber:"#CB912F", green:"#4DAB9A", purple:"#9065B0", pink:"#D44C8E",
    shadow:"rgba(0,0,0,0.06)", shadowHeavy:"rgba(0,0,0,0.10)",
    scrollThumb:"#C8C7C3", selectionBg:"#2383E230" },
  dimmed: { key:"dimmed", label:"Soft Dark", icon:"\uD83C\uDF19", isDark:true,
    bg:"#1C2128", surface:"#2D333B", surfaceHover:"#373E47", surfaceLight:"#262C36",
    accent:"#539BF5", accentDark:"#4184E4",
    text:"#ADBAC7", textSec:"#768390", textDim:"#545D68",
    border:"#373E47", borderLight:"#2D333B",
    red:"#F47067", amber:"#DAAA3F", green:"#57AB5A", purple:"#B083F0", pink:"#F47067",
    shadow:"rgba(0,0,0,0.3)", shadowHeavy:"rgba(0,0,0,0.4)",
    scrollThumb:"#545D68", selectionBg:"#539BF530" },
};

export const THEME_ORDER = ["dimmed","warm"];

export function mkSC(t){ const a=t.isDark?"25":"15"; return {"已完成":{color:t.green,bg:t.green+a,icon:"✓"},"進行中":{color:t.amber,bg:t.amber+a,icon:"▸"},"待辦":{color:t.accent,bg:t.accent+a,icon:"○"},"提案中":{color:t.pink,bg:t.pink+a,icon:"◇"},"待確認":{color:t.purple,bg:t.purple+a,icon:"?"}}; }
export function mkPC(t){ return {"高":{color:t.red},"中":{color:t.amber},"低":{color:t.textDim}}; }
export function mkCC(t){ return {"商務合作":t.accent,"活動":t.purple,"播出/開始":t.amber,"行銷":"#06B6D4","發行":t.green,"市場展":t.red}; }
export function mkPJC(t){ return [t.accent,t.purple,t.amber,t.red,t.green,"#06B6D4",t.pink]; }

export let X = THEMES.warm;
export let SC = mkSC(X);
export let PC = mkPC(X);
export let CC = mkCC(X);
export let PJC = mkPJC(X);

export const F = "'Noto Sans TC',-apple-system,BlinkMacSystemFont,sans-serif";
export const FM = "'JetBrains Mono','SF Mono',monospace";

export function applyTheme(key) {
  X = THEMES[key] || THEMES.warm;
  SC = mkSC(X);
  PC = mkPC(X);
  CC = mkCC(X);
  PJC = mkPJC(X);
}

export function getIS2() {
  return { fontFamily:F, fontSize:14, padding:"6px 10px", borderRadius:8, border:`1px solid ${X.border}`, outline:"none", color:X.text, background:X.surface, width:"100%" };
}
