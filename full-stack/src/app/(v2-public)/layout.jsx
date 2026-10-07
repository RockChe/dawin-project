import '@/styles/v2.css';
import V2Root from '@/components/v2/V2Root';

// /v2 公開區（登入頁、開發預覽）：不查 session。與 (v2-app) 同樣固定桌機 1280、不套用 zoom。
export const viewport = { width: 1280 };

export default function V2PublicLayout({ children }) {
  return <V2Root role={null}>{children}</V2Root>;
}
