(() => {
  "use strict";
  const CONFIG = window.FOOD_FINDER_CONFIG || {};
  const $ = id => document.getElementById(id);
  const els = {
    count: $("adminCount"), form: $("restaurantForm"), editId: $("editId"), formTitle: $("formTitle"),
    brandId: $("fBrandId"), name: $("fName"), branch: $("fBranch"), district: $("fDistrict"), address: $("fAddress"), mainGroup: $("fMainGroup"),
    cuisine: $("fCuisine"), foodTypes: $("fFoodTypes"), desserts: $("fDesserts"), drinks: $("fDrinks"), note: $("fNote"), source: $("fSource"),
    reset: $("resetFormBtn"), cancelEdit: $("cancelEditBtn"), table: $("adminTableBody"), search: $("adminSearch"), districtList: $("districtList"),
    exportBtn: $("exportJsonBtn"), importInput: $("importJsonInput"), toast: $("adminToast"),
    token: $("adminToken"), saveTokenBtn: $("saveTokenBtn"), reloadCloudBtn: $("reloadCloudBtn"), syncAllBtn: $("syncAllBtn"),
    cloudStatus: $("cloudStatus"), cloudDescription: $("cloudDescription")
  };

  let data = [];
  const cloudMode = CONFIG.dataSource === "api" && !!CONFIG.apiUrl;

  const esc = (v = "") => String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const norm = (v = "") => String(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
  const slugify = (v = "") => norm(v).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "restaurant";
  const split = v => Array.isArray(v) ? v : (v ? String(v).split(/[;,]/).map(x => x.trim()).filter(Boolean) : []);
  const join = v => Array.isArray(v) ? v.join("; ") : (v || "");

  function normalizeRow(r, index) {
    const name = r.name || "";
    return {
      id: r.id ?? index + 1,
      brandId: r.brandId || slugify(name),
      name,
      branch: r.branch || "",
      address: r.address || "",
      district: r.district || "",
      mainGroup: r.mainGroup || "",
      foodTypes: split(r.foodTypes),
      cuisines: split(r.cuisines),
      desserts: split(r.desserts),
      drinks: split(r.drinks),
      status: r.status || "",
      note: r.note || "",
      source: r.source || ""
    };
  }

  function getToken() { return sessionStorage.getItem("foodFinderAdminToken") || ""; }
  function setCloudStatus() {
    if (cloudMode) {
      els.cloudStatus.textContent = "● CLOUD MODE đang bật";
      els.cloudDescription.textContent = "Lưu/Sửa/Xóa sẽ ghi vào database chung. Người khác mở web sẽ thấy dữ liệu mới.";
    } else {
      els.cloudStatus.textContent = "○ LOCAL MODE — chưa bật database chung";
      els.cloudDescription.textContent = "Bạn vẫn có thể thử giao diện, nhưng thay đổi chưa được chia sẻ cho người khác. Hãy cấu hình apiUrl trong config.js.";
    }
  }

  function loadJsonp(url) {
    return new Promise((resolve, reject) => {
      const callback = `__foodFinderAdminJsonp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement("script");
      const timer = setTimeout(() => cleanup(new Error("Cloud API phản hồi quá lâu")), 12000);
      const cleanup = (error, value) => {
        clearTimeout(timer);
        try { delete window[callback]; } catch (_) { window[callback] = undefined; }
        script.remove();
        error ? reject(error) : resolve(value);
      };
      window[callback] = payload => cleanup(null, payload);
      script.onerror = () => cleanup(new Error("Không tải được cloud database"));
      const sep = url.includes("?") ? "&" : "?";
      script.src = `${url}${sep}prefix=${encodeURIComponent(callback)}&t=${Date.now()}`;
      document.head.appendChild(script);
    });
  }

  async function load() {
    setCloudStatus();
    els.token.value = getToken();
    if (cloudMode) {
      const payload = await loadJsonp(CONFIG.apiUrl);
      const rows = Array.isArray(payload) ? payload : payload.data;
      data = (rows || []).map(normalizeRow).filter(x => x.name);
    } else {
      const res = await fetch(CONFIG.localDataUrl || "./data/restaurants.json", { cache: "no-store" });
      data = (await res.json()).map(normalizeRow).filter(x => x.name);
    }
    refresh();
  }

  async function apiWrite(action, payload = {}) {
    if (!cloudMode) throw new Error("Chưa bật Cloud API trong config.js");
    const token = getToken();
    if (!token) throw new Error("Bạn chưa nhập ADMIN_TOKEN");
    const body = JSON.stringify({ action, token, ...payload });
    try {
      const res = await fetch(CONFIG.apiUrl, {
        method: "POST",
        redirect: "follow",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body
      });
      if (!res.ok) throw new Error(`Cloud API lỗi HTTP ${res.status}`);
      const out = await res.json();
      if (!out.ok) throw new Error(out.error || "Cloud API từ chối cập nhật");
      return out;
    } catch (error) {
      // Một số mobile browser chặn việc đọc response của Apps Script vì CORS.
      // Gửi lại dạng no-cors; sau đó admin sẽ tải lại cloud để xác minh.
      if (/token|từ chối|HTTP/i.test(String(error.message || error))) throw error;
      await fetch(CONFIG.apiUrl, { method: "POST", mode: "no-cors", body });
      return { ok: true, opaque: true };
    }
  }

  function nextId() {
    return data.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1;
  }

  function tags(r) { return [...(r.foodTypes || []), ...(r.cuisines || []), ...(r.desserts || []), ...(r.drinks || [])]; }

  function refresh() {
    els.count.textContent = data.length;
    const districts = [...new Set(data.map(x => x.district).filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi"));
    els.districtList.innerHTML = districts.map(x => `<option value="${esc(x)}"></option>`).join("");
    renderTable();
  }

  function renderTable() {
    const q = norm(els.search.value);
    const rows = data.filter(r => !q || norm([r.name, r.branch, r.address, r.district, ...tags(r)].join(" ")).includes(q));
    els.table.innerHTML = rows.map(r => `
      <tr>
        <td><strong>${esc(r.name)}</strong><small>${esc(r.branch || "")} · ${esc(r.brandId || "")}</small></td>
        <td>${esc(r.district || "")}</td>
        <td>${esc(r.address || "")}</td>
        <td><div class="row-tags">${tags(r).slice(0, 5).map(t => `<span>${esc(t)}</span>`).join("")}</div></td>
        <td><div class="row-actions"><button data-edit="${esc(r.id)}">Sửa</button><button class="delete" data-delete="${esc(r.id)}">Xóa</button></div></td>
      </tr>`).join("");
  }

  function formData() {
    const id = els.editId.value ? Number(els.editId.value) : nextId();
    const name = els.name.value.trim();
    return {
      id,
      brandId: els.brandId.value.trim() || slugify(name),
      name,
      branch: els.branch.value.trim(),
      address: els.address.value.trim(),
      district: els.district.value.trim(),
      mainGroup: els.mainGroup.value,
      foodTypes: split(els.foodTypes.value),
      cuisines: split(els.cuisine.value),
      desserts: split(els.desserts.value),
      drinks: split(els.drinks.value),
      status: "Đã cập nhật",
      note: els.note.value.trim(),
      source: els.source.value.trim()
    };
  }

  function resetForm() {
    els.form.reset();
    els.editId.value = "";
    els.formTitle.textContent = "Thêm quán mới";
    els.cancelEdit.classList.add("hidden");
    els.mainGroup.value = "Đồ ăn";
  }

  function startEdit(id) {
    const r = data.find(x => String(x.id) === String(id)); if (!r) return;
    els.editId.value = r.id;
    els.brandId.value = r.brandId || slugify(r.name);
    els.name.value = r.name || "";
    els.branch.value = r.branch || "";
    els.address.value = r.address || "";
    els.district.value = r.district || "";
    els.mainGroup.value = r.mainGroup || "Đồ ăn";
    els.foodTypes.value = join(r.foodTypes);
    els.cuisine.value = join(r.cuisines);
    els.desserts.value = join(r.desserts);
    els.drinks.value = join(r.drinks);
    els.note.value = r.note || "";
    els.source.value = r.source || "";
    els.formTitle.textContent = "Sửa quán";
    els.cancelEdit.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remove(id) {
    const r = data.find(x => String(x.id) === String(id)); if (!r) return;
    if (!confirm(`Xóa “${r.name} — ${r.branch || r.address}”?`)) return;
    try {
      if (cloudMode) {
        await apiWrite("delete", { id: r.id });
        await new Promise(resolve => setTimeout(resolve, 350));
        await load();
        if (data.some(x => String(x.id) === String(id))) throw new Error("Chưa xác minh được thao tác xóa trên cloud.");
      } else {
        data = data.filter(x => String(x.id) !== String(id));
        refresh();
      }
      toast(cloudMode ? "Đã xóa trên cloud" : "Đã xóa trong phiên local");
    } catch (error) { alert(error.message); }
  }

  function toast(text) {
    els.toast.textContent = text;
    els.toast.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => els.toast.classList.remove("show"), 1800);
  }

  els.table.addEventListener("click", e => {
    const edit = e.target.closest("[data-edit]");
    if (edit) { startEdit(edit.dataset.edit); return; }
    const del = e.target.closest("[data-delete]");
    if (del) remove(del.dataset.delete);
  });

  els.form.addEventListener("submit", async e => {
    e.preventDefault();
    const r = formData();
    const idx = data.findIndex(x => String(x.id) === String(r.id));
    try {
      if (cloudMode) {
        await apiWrite("upsert", { item: r });
        await new Promise(resolve => setTimeout(resolve, 450));
        await load();
        const saved = data.find(x => String(x.id) === String(r.id));
        if (!saved || saved.address !== r.address || saved.name !== r.name) {
          throw new Error("Đã gửi cập nhật nhưng chưa xác minh được trên cloud. Kiểm tra ADMIN_TOKEN và deployment Apps Script.");
        }
      } else {
        if (idx >= 0) data[idx] = r; else data.push(r);
        refresh();
      }
      resetForm();
      toast(cloudMode ? "Đã cập nhật database chung ✓" : "Đã cập nhật local — chưa chia sẻ cho người khác");
    } catch (error) { alert(error.message); }
  });

  els.reset.addEventListener("click", resetForm);
  els.cancelEdit.addEventListener("click", resetForm);
  els.search.addEventListener("input", renderTable);

  els.saveTokenBtn.addEventListener("click", () => {
    const token = els.token.value.trim();
    if (!token) sessionStorage.removeItem("foodFinderAdminToken");
    else sessionStorage.setItem("foodFinderAdminToken", token);
    toast(token ? "Đã lưu token cho tab này" : "Đã xóa token");
  });

  els.reloadCloudBtn.addEventListener("click", async () => {
    try { await load(); toast("Đã tải lại dữ liệu"); } catch (error) { alert(error.message); }
  });

  els.syncAllBtn.addEventListener("click", async () => {
    if (!cloudMode) { alert("Chưa bật Cloud API trong config.js"); return; }
    if (!confirm(`Ghi đè database cloud bằng ${data.length} dòng hiện tại?`)) return;
    try { await apiWrite("replaceAll", { items: data }); toast("Đã đồng bộ toàn bộ lên cloud ✓"); }
    catch (error) { alert(error.message); }
  });

  els.exportBtn.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "restaurants.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast("Đã export restaurants.json");
  });

  els.importInput.addEventListener("change", async e => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed)) throw new Error();
      data = parsed.map(normalizeRow).filter(x => x.name);
      refresh();
      toast("Đã import vào bộ nhớ. Bấm ‘Ghi toàn bộ lên cloud’ để xuất bản.");
    } catch (_) { alert("File JSON không đúng định dạng."); }
    e.target.value = "";
  });

  load().catch(err => {
    console.error(err);
    alert("Không tải được dữ liệu: " + err.message);
  });
})();
