const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = (v) => (Number.isFinite(v) ? v : 0);

// 10 格分段條：每格填充比例 0–1
export const segCells = (prog) => Array.from({ length: 10 }, (_, i) => clamp((num(prog) - i * 10) / 10, 0, 1));

// 「今天應有進度」刻度位置 0–100
export const tickPos = (el) => clamp(num(el), 0, 100);
