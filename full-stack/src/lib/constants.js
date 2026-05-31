// 任務狀態顯示順序（唯一真相來源；新增/調序只改這裡）
export const STATUSES = ['已完成', '進行中', '待辦', '暫緩', '提案中', '待確認'];
// DataTab/Dashboard 篩選列用（含「全部」）
// 篩選列顯示順序（active-first UX 排序；與 STATUSES 刻意不同，新增狀態時兩處都要顧）
export const STATUS_FILTERS = ['全部', '進行中', '待辦', '已完成', '暫緩', '提案中', '待確認'];
