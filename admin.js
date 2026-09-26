(() => {
  "use strict";
  const CONFIG = window.FOOD_FINDER_CONFIG || {};
  const $ = id => document.getElementById(id);
  const els = {
    count: $("adminCount"), form: $("restaurantForm"), editId: $("editId"), formTitle: $("formTitle"),
    name: $("fName"), branch: $("fBranch"), district: $("fDistrict"), address: $("fAddress"), mainGroup: $("fMainGroup"),
    cuisine: $("fCuisine"), foodTypes: $("fFoodTypes"), desserts: $("fDesserts"), drinks: $("fDrinks"), note: $("fNote"), source: $("fSource"),
    reset: $("resetFormBtn"), cancelEdit: $("cancelEditBtn"), table: $("adminTableBody"), search: $("adminSearch"), districtList: $("districtList"),
    exportBtn: $("exportJsonBtn"), importInput: $("importJsonInput"), clearLocal: $("clearLocalBtn"), toast: $("adminToast")
  };
  let data = [];

  const esc = (v="") => String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
  const norm = (v="") => String(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d");
  const split = v => v ? String(v).split(/[;,]/).map(x=>x.trim()).filter(Boolean) : [];
  const join = v => Array.isArray(v) ? v.join("; ") : (v || "");

  async function load() {
    const local = localStorage.getItem("foodFinderCustomData");
    if (local) { try { data = JSON.parse(local); } catch (_) {} }
    if (!data.length) {
      const res = await fetch(CONFIG.localDataUrl || "./data/restaurants.json", {cache:"no-store"});
      data = await res.json();
    }
    data = data.filter(x=>x.name);
    refresh();
  }

  function persist() { localStorage.setItem("foodFinderCustomData", JSON.stringify(data)); }
  function nextId() { return data.reduce((m,x)=>Math.max(m,Number(x.id)||0),0)+1; }
  function tags(r) { return [...(r.foodTypes||[]),...(r.cuisines||[]),...(r.desserts||[]),...(r.drinks||[])]; }

  function refresh() {
    els.count.textContent = data.length;
    const districts = [...new Set(data.map(x=>x.district).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"vi"));
    els.districtList.innerHTML = districts.map(x=>`<option value="${esc(x)}"></option>`).join("");
    renderTable();
  }

  function renderTable() {
    const q = norm(els.search.value);
    const rows = data.filter(r => !q || norm([r.name,r.branch,r.address,r.district,...tags(r)].join(" ")).includes(q));
    els.table.innerHTML = rows.map(r => `
      <tr>
        <td><strong>${esc(r.name)}</strong><small>${esc(r.branch||"")}</small></td>
        <td>${esc(r.district||"")}</td>
        <td>${esc(r.address||"")}</td>
        <td><div class="row-tags">${tags(r).slice(0,5).map(t=>`<span>${esc(t)}</span>`).join("")}</div></td>
        <td><div class="row-actions"><button data-edit="${esc(r.id)}">Sửa</button><button class="delete" data-delete="${esc(r.id)}">Xóa</button></div></td>
      </tr>`).join("");
    els.table.querySelectorAll("[data-edit]").forEach(btn=>btn.addEventListener("click",()=>startEdit(btn.dataset.edit)));
    els.table.querySelectorAll("[data-delete]").forEach(btn=>btn.addEventListener("click",()=>remove(btn.dataset.delete)));
  }

  function formData() {
    const id = els.editId.value ? Number(els.editId.value) : nextId();
    return {
      id, name: els.name.value.trim(), branch: els.branch.value.trim(), address: els.address.value.trim(), district: els.district.value.trim(),
      mainGroup: els.mainGroup.value, foodTypes: split(els.foodTypes.value), cuisines: split(els.cuisine.value), desserts: split(els.desserts.value), drinks: split(els.drinks.value),
      status: "Đã cập nhật", note: els.note.value.trim(), source: els.source.value.trim()
    };
  }

  function resetForm() {
    els.form.reset(); els.editId.value=""; els.formTitle.textContent="Thêm quán mới"; els.cancelEdit.classList.add("hidden"); els.mainGroup.value="Đồ ăn";
  }

  function startEdit(id) {
    const r = data.find(x=>String(x.id)===String(id)); if(!r) return;
    els.editId.value=r.id; els.name.value=r.name||""; els.branch.value=r.branch||""; els.address.value=r.address||""; els.district.value=r.district||"";
    els.mainGroup.value=r.mainGroup||"Đồ ăn"; els.foodTypes.value=join(r.foodTypes); els.cuisine.value=join(r.cuisines); els.desserts.value=join(r.desserts); els.drinks.value=join(r.drinks); els.note.value=r.note||""; els.source.value=r.source||"";
    els.formTitle.textContent="Sửa quán"; els.cancelEdit.classList.remove("hidden"); window.scrollTo({top:0,behavior:"smooth"});
  }

  function remove(id) {
    const r=data.find(x=>String(x.id)===String(id)); if(!r) return;
    if(!confirm(`Xóa “${r.name}” khỏi bản chỉnh local?`)) return;
    data=data.filter(x=>String(x.id)!==String(id)); persist(); refresh(); toast("Đã xóa quán");
  }

  function toast(text) { els.toast.textContent=text; els.toast.classList.add("show"); clearTimeout(toast.t); toast.t=setTimeout(()=>els.toast.classList.remove("show"),1600); }

  els.form.addEventListener("submit", e=>{
    e.preventDefault(); const r=formData();
    const idx=data.findIndex(x=>String(x.id)===String(r.id));
    if(idx>=0) data[idx]=r; else data.push(r);
    persist(); refresh(); resetForm(); toast(idx>=0?"Đã cập nhật quán":"Đã thêm quán mới");
  });
  els.reset.addEventListener("click",resetForm); els.cancelEdit.addEventListener("click",resetForm); els.search.addEventListener("input",renderTable);
  els.exportBtn.addEventListener("click",()=>{
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json;charset=utf-8"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="restaurants.json"; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); toast("Đã xuất restaurants.json");
  });
  els.importInput.addEventListener("change",async e=>{
    const file=e.target.files?.[0]; if(!file) return;
    try { const parsed=JSON.parse(await file.text()); if(!Array.isArray(parsed)) throw new Error(); data=parsed; persist(); refresh(); toast("Đã import JSON"); }
    catch(_){ alert("File JSON không đúng định dạng."); }
    e.target.value="";
  });
  els.clearLocal.addEventListener("click",()=>{
    if(!confirm("Xóa toàn bộ bản chỉnh local và quay về data gốc?")) return;
    localStorage.removeItem("foodFinderCustomData"); location.reload();
  });
  load().catch(err=>{ console.error(err); alert("Không tải được dữ liệu. Hãy chạy website qua hosting hoặc local server."); });
})();
