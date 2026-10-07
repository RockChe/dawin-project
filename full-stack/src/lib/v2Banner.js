// 專案頭像上傳／刪除（沿用舊 ProjectsTab 的流程）：
//   上傳＝POST /api/upload-banner（FormData：file＋projectId，route 自己走 withRouteCap('write')）；
//   刪除＝server action deleteProjectBanner（withCap('write')）。
// 這裡只做樂觀更新與失敗回復，不新增 action／route。呼叫端注入 fetch／action／toast，方便測試。
const readDataUrl = (file) => new Promise((resolve) => {
  const r = new FileReader();
  r.onload = (e) => resolve(e.target.result);
  r.onerror = () => resolve(null);
  r.readAsDataURL(file);
});

export function makeBannerActions({ setProjects, getProjects, showToast, onForbidden = () => false, deleteBanner, fetchFn = (...a) => fetch(...a) }) {
  const setUrl = (id, bannerUrl) => setProjects((ps) => ps.map((p) => (p.id === id ? { ...p, bannerUrl } : p)));
  const prevOf = (id) => getProjects().find((p) => p.id === id)?.bannerUrl ?? null;
  const fail = (id, prev, result, fallback) => {
    setUrl(id, prev);
    if (!result || !onForbidden(result)) showToast(result?.error || fallback, 'error');
  };

  return {
    async upload(id, file) {
      if (!file) return;
      const prev = prevOf(id);
      const local = await readDataUrl(file); // 先等預覽讀完再送出，避免晚到的預覽蓋掉伺服器網址
      if (local) setUrl(id, local);
      const fd = new FormData();
      fd.append('file', file);
      fd.append('projectId', id);
      try {
        const res = await fetchFn('/api/upload-banner', { method: 'POST', body: fd });
        const data = await res.json();
        if (data?.bannerUrl) { setUrl(id, data.bannerUrl); showToast('圖示已上傳', 'success'); }
        else fail(id, prev, data?.error ? data : null, '圖示上傳失敗');
      } catch {
        fail(id, prev, null, '圖示上傳失敗');
      }
    },
    async remove(id) {
      const prev = prevOf(id);
      setUrl(id, null);
      const result = await deleteBanner(id);
      if (result?.error) fail(id, prev, result, '刪除圖示失敗');
      else showToast('圖示已刪除', 'success');
    },
  };
}
