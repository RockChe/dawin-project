// server-only 的 exports map 在非 react-server 環境會指向會 throw 的檔案。
// 測試只是要驗證業務邏輯，不需要那個保護，所以在 vitest 裡換成空模組。
export {};
