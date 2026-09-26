(() => {
  "use strict";

  const CONFIG = window.FOOD_FINDER_CONFIG || {};
  const state = {
    restaurants: [],
    brands: [],
    filteredBrands: [],
    visibleCount: 12,
    keyword: "",
    sort: "name",
    selected: {
      district: new Set(),
      foodType: new Set(),
      cuisine: new Set(),
      dessert: new Set(),
      drink: new Set()
    },
    favoritesOnly: false,
    favorites: new Set(JSON.parse(localStorage.getItem("foodFinderFavoriteBrands") || "[]")),
    loadedAt: 0
  };

  const $ = id => document.getElementById(id);
  const els = {
    heroCount: $("heroCount"), plateCount: $("plateCount"), districtStat: $("districtStat"), cuisineStat: $("cuisineStat"), favoriteStat: $("favoriteStat"),
    heroSearchInput: $("heroSearchInput"), heroSearchBtn: $("heroSearchBtn"), searchInput: $("searchInput"),
    districtFilters: $("districtFilters"), foodTypeFilters: $("foodTypeFilters"), cuisineFilters: $("cuisineFilters"), dessertFilters: $("dessertFilters"), drinkFilters: $("drinkFilters"),
    clearFilters: $("clearFilters"), emptyClearBtn: $("emptyClearBtn"), activeFilters: $("activeFilters"), restaurantGrid: $("restaurantGrid"), resultCount: $("resultCount"), emptyState: $("emptyState"), loadMoreBtn: $("loadMoreBtn"),
    sortSelect: $("sortSelect"), randomBtn: $("randomBtn"), showFavoritesBtn: $("showFavoritesBtn"), mobileFilterBtn: $("mobileFilterBtn"), filterPanel: $("filterPanel"), filterBackdrop: $("filterBackdrop"),
    chatFab: $("chatFab"), chatWidget: $("chatWidget"), navChatBtn: $("navChatBtn"), heroChatBtn: $("heroChatBtn"), closeChatBtn: $("closeChatBtn"), chatMessages: $("chatMessages"), chatForm: $("chatForm"), chatInput: $("chatInput"), chatSuggestions: $("chatSuggestions"),
    branchModal: $("branchModal"), branchModalTitle: $("branchModalTitle"), branchModalMeta: $("branchModalMeta"), branchModalList: $("branchModalList"), closeBranchModal: $("closeBranchModal"),
    toast: $("toast")
  };

  const escapeHtml = (value = "") => String(value)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

  const normalize = (value = "") => String(value).toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

  const slugify = (value = "") => normalize(value).replace(/\s+/g, "-") || "restaurant";

  const splitTags = value => {
    if (Array.isArray(value)) return value.filter(Boolean).map(v => String(v).trim());
    if (!value) return [];
    return String(value).split(/[;,]/).map(v => v.trim()).filter(Boolean);
  };

  function normalizeRestaurant(raw, index) {
    const name = raw.name || raw["Tên quán"] || "";
    return {
      id: raw.id ?? index + 1,
      brandId: raw.brandId || raw["brandId"] || slugify(name),
      name,
      branch: raw.branch || raw["Chi nhánh"] || "",
      address: raw.address || raw["Địa chỉ"] || "",
      district: raw.district || raw["Quận/Khu vực"] || "",
      mainGroup: raw.mainGroup || raw["Nhóm chính"] || "",
      foodTypes: splitTags(raw.foodTypes || raw["Loại món"]),
      cuisines: splitTags(raw.cuisines || raw["Ẩm thực"]),
      desserts: splitTags(raw.desserts || raw["Bánh/Tráng miệng"]),
      drinks: splitTags(raw.drinks || raw["Đồ uống"]),
      status: raw.status || raw["Mức độ xác minh"] || "",
      note: raw.note || raw["Ghi chú"] || "",
      source: raw.source || raw["Nguồn / Maps"] || ""
    };
  }

  function uniqueSorted(values) {
    return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi"));
  }

  function mapsLink(r) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([r.name, r.branch, r.address, "TP.HCM"].filter(Boolean).join(" "))}`;
  }

  function searchableText(r) {
    return normalize([r.name, r.branch, r.address, r.district, r.mainGroup, ...r.foodTypes, ...r.cuisines, ...r.desserts, ...r.drinks, r.note].join(" "));
  }

  function matchesSearch(r, query) {
    const phrase = normalize(query);
    return !phrase || (" " + searchableText(r) + " ").includes(" " + phrase + " ");
  }

  function loadJsonp(url) {
    return new Promise((resolve, reject) => {
      const callback = `__foodFinderJsonp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement("script");
      const timer = setTimeout(() => cleanup(new Error("Cloud API phản hồi quá lâu.")), 12000);
      const cleanup = (error, value) => {
        clearTimeout(timer);
        try { delete window[callback]; } catch (_) { window[callback] = undefined; }
        script.remove();
        error ? reject(error) : resolve(value);
      };
      window[callback] = payload => cleanup(null, payload);
      script.onerror = () => cleanup(new Error("Không tải được database cloud."));
      const sep = url.includes("?") ? "&" : "?";
      script.src = `${url}${sep}prefix=${encodeURIComponent(callback)}&t=${Date.now()}`;
      document.head.appendChild(script);
    });
  }

  function setDataStatus(message = "") {
    const status = $("dataStatus");
    if (status) {
      status.textContent = message;
      status.hidden = !message;
    }
  }

  function parseRows(payload) {
    if (payload?.ok === false) throw new Error(payload.error || "Cloud API báo lỗi.");
    const rows = Array.isArray(payload) ? payload : payload?.data;
    if (!Array.isArray(rows)) throw new Error("Dữ liệu quán không hợp lệ.");
    return rows.filter(row => row && typeof row === "object").map(normalizeRestaurant).filter(x => x.name);
  }

  async function loadData(allowFallback = true) {
    let cloudFailed = false;
    if (CONFIG.dataSource === "api" && CONFIG.apiUrl) {
      try {
        const rows = parseRows(await loadJsonp(CONFIG.apiUrl));
        setDataStatus();
        return rows;
      } catch (error) {
        if (!allowFallback) throw error;
        cloudFailed = true;
        console.warn("Không tải được cloud, dùng dữ liệu dự phòng:", error);
      }
    }

    const response = await fetch(CONFIG.localDataUrl || "./data/restaurants.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Không tải được dữ liệu quán dự phòng.");
    const rows = parseRows(await response.json());
    setDataStatus(cloudFailed ? "Đang hiển thị dữ liệu dự phòng. Quán mới thêm có thể chưa xuất hiện; web sẽ tự thử kết nối lại." : "");
    return rows;
  }

  function groupRows(rows) {
    const groups = new Map();
    for (const r of rows) {
      const key = r.brandId || slugify(r.name);
      if (!groups.has(key)) {
        groups.set(key, {
          brandId: key,
          name: r.name,
          branches: [],
          foodTypes: [], cuisines: [], desserts: [], drinks: [], mainGroups: []
        });
      }
      const g = groups.get(key);
      g.branches.push(r);
      g.foodTypes.push(...r.foodTypes);
      g.cuisines.push(...r.cuisines);
      g.desserts.push(...r.desserts);
      g.drinks.push(...r.drinks);
      if (r.mainGroup) g.mainGroups.push(r.mainGroup);
    }
    for (const g of groups.values()) {
      g.foodTypes = uniqueSorted(g.foodTypes);
      g.cuisines = uniqueSorted(g.cuisines);
      g.desserts = uniqueSorted(g.desserts);
      g.drinks = uniqueSorted(g.drinks);
      g.mainGroups = uniqueSorted(g.mainGroups);
    }
    return [...groups.values()];
  }

  function allBranchesForBrand(brandId) {
    return state.restaurants.filter(r => r.brandId === brandId);
  }

  function getFilterConfig() {
    const foodTypes = uniqueSorted(state.restaurants.flatMap(r => r.foodTypes));
    const priorityFood = ["Đồ nước", "Đồ khô", "Ăn vặt", "Đồ nướng", "Lẩu", "Gà rán", "Pizza", "Sushi", "Ramen", "Udon", "Dimsum", "Fast food", "Hải sản"];
    const selectedFood = [...priorityFood.filter(x => foodTypes.includes(x)), ...foodTypes.filter(x => !priorityFood.includes(x)).slice(0, 10)];
    return {
      district: { el: els.districtFilters, values: uniqueSorted(state.restaurants.map(r => r.district)) },
      foodType: { el: els.foodTypeFilters, values: selectedFood },
      cuisine: { el: els.cuisineFilters, values: uniqueSorted(state.restaurants.flatMap(r => r.cuisines)) },
      dessert: { el: els.dessertFilters, values: uniqueSorted(state.restaurants.flatMap(r => r.desserts)) },
      drink: { el: els.drinkFilters, values: uniqueSorted(state.restaurants.flatMap(r => r.drinks)) }
    };
  }

  function renderFilterOptions() {
    const config = getFilterConfig();
    Object.entries(config).forEach(([group, cfg]) => {
      cfg.el.innerHTML = cfg.values.map(value => `
        <label class="check-item" title="${escapeHtml(value)}">
          <input type="checkbox" data-group="${group}" value="${escapeHtml(value)}">
          <span class="fake-check"></span>
          <span>${escapeHtml(value)}</span>
        </label>`).join("");
    });

    document.querySelectorAll(".check-item input").forEach(input => {
      input.addEventListener("change", () => {
        const set = state.selected[input.dataset.group];
        input.checked ? set.add(input.value) : set.delete(input.value);
        state.visibleCount = 12;
        applyFilters();
      });
    });
  }

  function matchesAny(values, selectedSet) {
    if (!selectedSet.size) return true;
    return [...selectedSet].some(selected => values.includes(selected));
  }

  function rowMatchesFilters(r) {
    const keyword = normalize(state.keyword);
    if (state.selected.district.size && !state.selected.district.has(r.district)) return false;
    if (!matchesAny(r.foodTypes, state.selected.foodType)) return false;
    if (!matchesAny(r.cuisines, state.selected.cuisine)) return false;
    if (!matchesAny(r.desserts, state.selected.dessert)) return false;
    if (!matchesAny(r.drinks, state.selected.drink)) return false;
    if (keyword && !matchesSearch(r, keyword)) return false;
    return true;
  }

  function applyFilters() {
    let rows = state.restaurants.filter(rowMatchesFilters);
    let brands = groupRows(rows);

    if (state.favoritesOnly) brands = brands.filter(b => state.favorites.has(b.brandId));

    if (state.sort === "district") {
      brands.sort((a, b) => {
        const ad = a.branches[0]?.district || "";
        const bd = b.branches[0]?.district || "";
        return (ad + a.name).localeCompare(bd + b.name, "vi");
      });
    } else if (state.sort === "favorites") {
      brands.sort((a, b) => Number(state.favorites.has(b.brandId)) - Number(state.favorites.has(a.brandId)) || a.name.localeCompare(b.name, "vi"));
    } else {
      brands.sort((a, b) => a.name.localeCompare(b.name, "vi"));
    }

    state.filteredBrands = brands;
    renderActiveFilters();
    renderRestaurants();
    updateStats();
  }

  function brandTags(brand) {
    return uniqueSorted([...brand.foodTypes, ...brand.cuisines, ...brand.desserts, ...brand.drinks]).slice(0, 6);
  }

  function mainGroupForBrand(brand) {
    return brand.mainGroups[0] || "";
  }

  function brandVisual(brand) {
    const tags = normalize([mainGroupForBrand(brand), ...brand.foodTypes, ...brand.cuisines, ...brand.desserts, ...brand.drinks].join(" "));
    if (/(tra sua|cafe|ca phe|matcha|tra|nuoc ep|sinh to)/.test(tags)) return { icon: "🧋", tone: "blue", label: "đồ uống" };
    if (/(ramen|udon|pho|bun|mi cay|do nuoc|banh canh)/.test(tags)) return { icon: "🍜", tone: "coral", label: "món nước" };
    if (/(sushi|nhat ban)/.test(tags)) return { icon: "🍣", tone: "lilac", label: "món Nhật" };
    if (/(ga ran|ga |an vat|fast food)/.test(tags)) return { icon: "🍗", tone: "yellow", label: "ăn vui" };
    if (/(lau|nuong|hai san|oc)/.test(tags)) return { icon: "🍲", tone: "green", label: "đi nhóm" };
    if (/(banh|kem|trang mieng)/.test(tags)) return { icon: "🍰", tone: "lilac", label: "ngọt ngào" };
    if (/(pizza|au my|burger)/.test(tags)) return { icon: "🍕", tone: "yellow", label: "đồ Tây" };
    return { icon: "🍽️", tone: "coral", label: mainGroupForBrand(brand) || "food pick" };
  }

  function brandCardHtml(brand) {
    const allBranches = allBranchesForBrand(brand.brandId);
    const isMulti = allBranches.length > 1;
    const fav = state.favorites.has(brand.brandId);
    const single = brand.branches[0] || allBranches[0];
    const districtLabel = isMulti ? `${brand.branches.length} chi nhánh phù hợp` : (single?.district || "");
    const visual = brandVisual(brand);
    const visualDistrict = isMulti ? `${allBranches.length} địa điểm` : (single?.district || "TP.HCM");

    return `
      <article class="restaurant-card brand-card" data-brand="${escapeHtml(brand.brandId)}">
        <div class="card-visual ${visual.tone}">
          <span class="card-food-icon">${visual.icon}</span>
          <div class="card-visual-meta">
            <span>${escapeHtml(visual.label)}</span>
            <span>${escapeHtml(visualDistrict)}</span>
          </div>
        </div>
        <div class="card-body">
          <div class="card-top">
            <div class="card-title-wrap">
              <div class="card-eyebrow">
                ${districtLabel ? `<span class="district-tag">${escapeHtml(districtLabel)}</span>` : ""}
                ${mainGroupForBrand(brand) ? `<span class="main-tag">${escapeHtml(mainGroupForBrand(brand))}</span>` : ""}
              </div>
              <h4>${escapeHtml(brand.name)}</h4>
              ${isMulti ? `<p class="branch-name">${allBranches.length} chi nhánh tại TP.HCM</p>` : (single?.branch ? `<p class="branch-name">Chi nhánh ${escapeHtml(single.branch)}</p>` : "")}
            </div>
            <button class="favorite-btn ${fav ? "active" : ""}" type="button" data-favorite-brand="${escapeHtml(brand.brandId)}" aria-label="Yêu thích">${fav ? "♥" : "♡"}</button>
          </div>

          ${isMulti
            ? `<p class="branch-summary">Có nhiều địa điểm để chọn. Mở danh sách chi nhánh gần bạn nhất.</p>`
            : `<p class="card-address"><span>●</span>${escapeHtml(single?.address || "Đang cập nhật địa chỉ")}</p>`}

          <div class="card-tags">${brandTags(brand).map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
          ${!isMulti && single?.note ? `<p class="card-note">${escapeHtml(single.note)}</p>` : ""}
          <div class="card-footer">
            ${isMulti
              ? `<button class="branch-open-btn" type="button" data-open-branches="${escapeHtml(brand.brandId)}">Xem ${allBranches.length} chi nhánh →</button>`
              : `<a class="map-link" href="${mapsLink(single)}" target="_blank" rel="noopener">↗ Google Maps</a>`}
            <span class="status-dot"><i></i>${isMulti ? "Nhiều chi nhánh" : "Có địa chỉ"}</span>
          </div>
        </div>
      </article>`;
  }

  function renderRestaurants() {
    els.resultCount.textContent = state.filteredBrands.length;
    const visible = state.filteredBrands.slice(0, state.visibleCount);
    els.restaurantGrid.innerHTML = visible.map(brandCardHtml).join("");
    els.emptyState.classList.toggle("hidden", state.filteredBrands.length > 0);
    els.loadMoreBtn.classList.toggle("hidden", state.visibleCount >= state.filteredBrands.length || !state.filteredBrands.length);
  }

  function openBranchModal(brandId) {
    const branches = allBranchesForBrand(brandId);
    if (!branches.length) return;
    const name = branches[0].name;
    els.branchModalTitle.textContent = name;
    els.branchModalMeta.textContent = `${branches.length} chi nhánh tại TP.HCM`;
    els.branchModalList.innerHTML = branches
      .slice()
      .sort((a, b) => (a.district + a.branch).localeCompare(b.district + b.branch, "vi"))
      .map(r => `
        <article class="branch-item">
          <div>
            <div class="branch-item-head">
              <strong>${escapeHtml(r.branch || r.district || "Chi nhánh")}</strong>
              ${r.district ? `<span>${escapeHtml(r.district)}</span>` : ""}
            </div>
            <p>${escapeHtml(r.address || "Đang cập nhật địa chỉ")}</p>
            <div class="branch-item-tags">${uniqueSorted([...r.foodTypes, ...r.cuisines, ...r.desserts, ...r.drinks]).slice(0, 4).map(t => `<em>${escapeHtml(t)}</em>`).join("")}</div>
          </div>
          <a href="${mapsLink(r)}" target="_blank" rel="noopener">Mở Maps ↗</a>
        </article>`).join("");
    els.branchModal.classList.add("open");
    els.branchModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }

  function closeBranchModal() {
    els.branchModal.classList.remove("open");
    els.branchModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }

  function renderActiveFilters() {
    const chips = [];
    Object.entries(state.selected).forEach(([group, set]) => set.forEach(value => chips.push({ group, value })));
    if (state.keyword) chips.push({ group: "keyword", value: `“${state.keyword}”` });
    if (state.favoritesOnly) chips.push({ group: "favorites", value: "Chỉ yêu thích" });
    els.activeFilters.innerHTML = chips.map((chip, i) => `<button type="button" class="filter-chip" data-chip="${i}">${escapeHtml(chip.value)} ×</button>`).join("");
    els.activeFilters.querySelectorAll("[data-chip]").forEach((btn, i) => btn.addEventListener("click", () => {
      const chip = chips[i];
      if (chip.group === "keyword") { state.keyword = ""; els.searchInput.value = ""; els.heroSearchInput.value = ""; }
      else if (chip.group === "favorites") state.favoritesOnly = false;
      else {
        state.selected[chip.group].delete(chip.value);
        const input = [...document.querySelectorAll(`input[data-group="${chip.group}"]`)].find(x => x.value === chip.value);
        if (input) input.checked = false;
      }
      applyFilters();
    }));
  }

  function updateStats() {
    const totalBrands = groupRows(state.restaurants).length;
    els.heroCount.textContent = totalBrands;
    if (els.plateCount) els.plateCount.textContent = `${totalBrands}+`;
    els.districtStat.textContent = uniqueSorted(state.restaurants.map(r => r.district)).length;
    els.cuisineStat.textContent = uniqueSorted(state.restaurants.flatMap(r => r.cuisines)).length;
    els.favoriteStat.textContent = state.favorites.size;
  }

  function toggleFavorite(brandId) {
    if (state.favorites.has(brandId)) { state.favorites.delete(brandId); showToast("Đã bỏ khỏi yêu thích"); }
    else { state.favorites.add(brandId); showToast("Đã lưu vào yêu thích ♡"); }
    localStorage.setItem("foodFinderFavoriteBrands", JSON.stringify([...state.favorites]));
    applyFilters();
  }

  function clearAll() {
    Object.values(state.selected).forEach(set => set.clear());
    state.keyword = "";
    state.favoritesOnly = false;
    state.visibleCount = 12;
    els.searchInput.value = "";
    els.heroSearchInput.value = "";
    document.querySelectorAll(".check-item input").forEach(input => input.checked = false);
    applyFilters();
  }

  function setSearch(value) {
    state.keyword = value.trim();
    els.searchInput.value = value;
    els.heroSearchInput.value = value;
    state.visibleCount = 12;
    applyFilters();
    document.querySelector("#discover")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showToast(text) {
    els.toast.textContent = text;
    els.toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 1900);
  }

  function randomBrand(pool = state.filteredBrands.length ? state.filteredBrands : groupRows(state.restaurants)) {
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function randomAction() {
    const brand = randomBrand();
    if (!brand) return;
    showToast(`🎲 Hôm nay thử ${brand.name} nhé!`);
    setSearch(brand.name);
  }

  // CHATBOT ---------------------------------------------------------
  const districtAliases = {
    "q1":"Quận 1", "quan 1":"Quận 1", "q3":"Quận 3", "quan 3":"Quận 3", "q5":"Quận 5", "quan 5":"Quận 5",
    "q6":"Quận 6", "quan 6":"Quận 6", "q7":"Quận 7", "quan 7":"Quận 7", "q8":"Quận 8", "quan 8":"Quận 8",
    "q10":"Quận 10", "quan 10":"Quận 10", "q11":"Quận 11", "quan 11":"Quận 11", "q12":"Quận 12", "quan 12":"Quận 12",
    "binh thanh":"Bình Thạnh", "phu nhuan":"Phú Nhuận", "tan binh":"Tân Bình", "tan phu":"Tân Phú", "go vap":"Gò Vấp",
    "binh tan":"Bình Tân", "thu duc":"Thủ Đức", "hoc mon":"Hóc Môn", "binh chanh":"Bình Chánh"
  };
  const intentAliases = {
    "do han":"Hàn Quốc", "han quoc":"Hàn Quốc", "mon han":"Hàn Quốc",
    "do nhat":"Nhật Bản", "nhat ban":"Nhật Bản", "mon nhat":"Nhật Bản",
    "do trung":"Trung Quốc/Đài Loan", "mon trung":"Trung Quốc/Đài Loan", "dai loan":"Trung Quốc/Đài Loan",
    "do thai":"Thái Lan", "mon thai":"Thái Lan", "tra sua":"Trà sữa", "cafe":"Cafe", "ca phe":"Cafe",
    "ramen":"Ramen", "udon":"Udon", "sushi":"Sushi", "pizza":"Pizza", "lau":"Lẩu", "nuong":"Đồ nướng",
    "an vat":"Ăn vặt", "ga ran":"Gà rán", "hai san":"Hải sản", "bun bo":"Bún bò", "com tam":"Cơm tấm", "mi cay":"Mì cay",
    "banh":"Bánh ngọt", "kem":"Kem"
  };

  function containsPhrase(text, phrase) { return (` ${text} `).includes(` ${phrase} `); }

  function parseBotQuery(query) {
    const q = normalize(query);
    let district = "", intent = "";
    for (const [alias, val] of Object.entries(districtAliases).sort((a, b) => b[0].length - a[0].length)) if (containsPhrase(q, alias)) { district = val; break; }
    for (const [alias, val] of Object.entries(intentAliases).sort((a, b) => b[0].length - a[0].length)) if (containsPhrase(q, alias)) { intent = val; break; }
    return { q, district, intent, random: /\b(random|ngau nhien|chon giup|chon dum|an gi|goi y)\b/.test(q) };
  }

  function botFilter(parsed) {
    let pool = state.restaurants.filter(r => {
      if (parsed.district && r.district !== parsed.district) return false;
      if (parsed.intent) {
        const tags = [r.mainGroup, ...r.foodTypes, ...r.cuisines, ...r.desserts, ...r.drinks];
        if (!tags.some(t => normalize(t).includes(normalize(parsed.intent)) || normalize(parsed.intent).includes(normalize(t)))) return false;
      }
      return true;
    });
    if (!parsed.district && !parsed.intent && parsed.q) {
      const stop = ["cho toi", "tim", "quan", "giup", "minh", "o", "gan", "muon", "an", "uong", "co", "nao"];
      const terms = parsed.q.split(" ").filter(t => t.length > 1 && !stop.includes(t));
      if (terms.length) pool = state.restaurants.filter(r => terms.some(t => matchesSearch(r, t)));
    }
    return pool;
  }

  function addMessage(content, type = "bot", isHtml = false) {
    const div = document.createElement("div");
    div.className = `message ${type}`;
    if (isHtml) div.innerHTML = content; else div.textContent = content;
    els.chatMessages.appendChild(div);
    els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
  }

  function botResultsHtml(brands, intro) {
    return `<div>${escapeHtml(intro)}</div><div class="bot-results">${brands.map(brand => {
      const branches = allBranchesForBrand(brand.brandId);
      const one = branches[0];
      return `<div class="bot-result">
        <b>${escapeHtml(brand.name)}</b>
        ${branches.length > 1
          ? `<span>${branches.length} chi nhánh tại TP.HCM</span><button type="button" data-open-branches="${escapeHtml(brand.brandId)}">Xem chi nhánh →</button>`
          : `<span>${escapeHtml([one?.branch, one?.district].filter(Boolean).join(" · "))}</span><span>${escapeHtml(one?.address || "")}</span><a href="${mapsLink(one)}" target="_blank" rel="noopener">Mở Google Maps ↗</a>`}
      </div>`;
    }).join("")}</div>`;
  }

  function botReply(query) {
    const parsed = parseBotQuery(query);
    if (/^(xin chao|hello|hi|chao)\b/.test(parsed.q)) {
      addMessage("Chào bạn 👋 Mình có thể tìm quán theo quận, loại món hoặc quốc gia. Thử: “đồ Hàn ở Bình Thạnh” nhé.");
      return;
    }
    if (/\b(bao nhieu|tong cong|co may)\b/.test(parsed.q)) {
      const brands = groupRows(state.restaurants);
      addMessage(`Hiện mình có ${brands.length} quán/thương hiệu với ${state.restaurants.length} địa điểm, trải ở ${uniqueSorted(state.restaurants.map(r => r.district)).length} khu vực TP.HCM.`);
      return;
    }

    const rows = botFilter(parsed);
    const brands = groupRows(rows);
    if (!brands.length) {
      addMessage("Mình chưa tìm thấy quán khớp câu đó. Bạn thử nói ngắn hơn, ví dụ “ramen Tân Bình”, “lẩu Quận 7” hoặc “trà sữa Quận 10”.");
      return;
    }

    if (parsed.random) {
      const pick = randomBrand(brands);
      addMessage(botResultsHtml([pick], `Chốt cho bạn một quán trong ${brands.length} lựa chọn:`), "bot", true);
      return;
    }

    const picks = brands.slice(0, 4);
    let intro = `Mình tìm thấy ${brands.length} quán/thương hiệu phù hợp.`;
    if (brands.length > 4) intro += " Đây là 4 gợi ý đầu tiên:";
    addMessage(botResultsHtml(picks, intro), "bot", true);
  }

  function openChat() {
    els.chatWidget.classList.add("open");
    els.chatWidget.setAttribute("aria-hidden", "false");
    els.chatFab.style.opacity = "0";
    els.chatFab.style.pointerEvents = "none";
    if (!els.chatMessages.children.length) {
      addMessage(`Chào bạn! Mình là Măm Măm Bot ✦ Mình đang đọc ${groupRows(state.restaurants).length} quán/thương hiệu (${state.restaurants.length} địa điểm). Bạn muốn ăn/uống gì hôm nay?`);
    }
    setTimeout(() => els.chatInput.focus(), 120);
  }

  function closeChat() {
    els.chatWidget.classList.remove("open");
    els.chatWidget.setAttribute("aria-hidden", "true");
    els.chatFab.style.opacity = "1";
    els.chatFab.style.pointerEvents = "auto";
  }

  async function refreshCloudData(silent = true) {
    if (CONFIG.dataSource !== "api" || !CONFIG.apiUrl) return;
    try {
      const fresh = await loadData(false);
      const oldFingerprint = JSON.stringify(state.restaurants);
      const newFingerprint = JSON.stringify(fresh);
      if (oldFingerprint !== newFingerprint) {
        state.restaurants = fresh;
        state.brands = groupRows(fresh);
        renderFilterOptions();
        applyFilters();
        if (!silent) showToast("Dữ liệu đã được cập nhật từ cloud");
      }
      state.loadedAt = Date.now();
    } catch (error) {
      console.warn("Không refresh được cloud data:", error);
    }
  }

  function bindEvents() {
    els.searchInput.addEventListener("input", e => { state.keyword = e.target.value; state.visibleCount = 12; applyFilters(); });
    els.heroSearchInput.addEventListener("keydown", e => { if (e.key === "Enter") setSearch(e.target.value); });
    els.heroSearchBtn.addEventListener("click", () => setSearch(els.heroSearchInput.value));
    els.clearFilters.addEventListener("click", clearAll);
    els.emptyClearBtn.addEventListener("click", clearAll);
    els.sortSelect.addEventListener("change", e => { state.sort = e.target.value; applyFilters(); });
    els.loadMoreBtn.addEventListener("click", () => { state.visibleCount += 12; renderRestaurants(); });
    els.randomBtn.addEventListener("click", randomAction);
    els.showFavoritesBtn.addEventListener("click", () => {
      state.favoritesOnly = !state.favoritesOnly;
      state.visibleCount = 12;
      applyFilters();
      document.querySelector("#discover")?.scrollIntoView({ behavior: "smooth" });
      showToast(state.favoritesOnly ? "Đang hiện quán yêu thích" : "Đã hiện lại tất cả quán");
    });

    document.querySelectorAll("[data-collapse]").forEach(btn => btn.addEventListener("click", () => {
      const target = $(btn.dataset.collapse);
      const collapsed = target.classList.toggle("hidden");
      btn.querySelector("b").textContent = collapsed ? "+" : "−";
    }));

    els.restaurantGrid.addEventListener("click", e => {
      const favorite = e.target.closest("[data-favorite-brand]");
      if (favorite) { toggleFavorite(favorite.dataset.favoriteBrand); return; }
      const branchBtn = e.target.closest("[data-open-branches]");
      if (branchBtn) openBranchModal(branchBtn.dataset.openBranches);
    });

    els.chatMessages.addEventListener("click", e => {
      const branchBtn = e.target.closest("[data-open-branches]");
      if (branchBtn) openBranchModal(branchBtn.dataset.openBranches);
    });

    els.closeBranchModal.addEventListener("click", closeBranchModal);
    els.branchModal.addEventListener("click", e => { if (e.target === els.branchModal) closeBranchModal(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && els.branchModal.classList.contains("open")) closeBranchModal(); });

    els.mobileFilterBtn.addEventListener("click", () => { els.filterPanel.classList.add("open"); els.filterBackdrop.classList.add("show"); document.body.classList.add("modal-open"); });
    els.filterBackdrop.addEventListener("click", () => { els.filterPanel.classList.remove("open"); els.filterBackdrop.classList.remove("show"); document.body.classList.remove("modal-open"); });

    document.querySelectorAll("[data-quick-search]").forEach(btn => btn.addEventListener("click", () => {
      const value = btn.dataset.quickSearch || "";
      if (value) setSearch(value);
    }));

    [els.chatFab, els.navChatBtn, els.heroChatBtn].forEach(btn => btn.addEventListener("click", openChat));
    els.closeChatBtn.addEventListener("click", closeChat);
    els.chatForm.addEventListener("submit", e => {
      e.preventDefault();
      const text = els.chatInput.value.trim(); if (!text) return;
      addMessage(text, "user"); els.chatInput.value = "";
      setTimeout(() => botReply(text), 170);
    });
    els.chatSuggestions.querySelectorAll("button").forEach(btn => btn.addEventListener("click", () => {
      addMessage(btn.textContent, "user"); setTimeout(() => botReply(btn.textContent), 130);
    }));
  }

  async function init() {
    try {
      state.restaurants = await loadData();
      state.brands = groupRows(state.restaurants);
      renderFilterOptions();
      bindEvents();
      applyFilters();

      if (CONFIG.dataSource === "api" && CONFIG.apiUrl && Number(CONFIG.cloudRefreshMs) > 0) {
        setInterval(() => refreshCloudData(true), Number(CONFIG.cloudRefreshMs));
      }
    } catch (error) {
      console.error(error);
      els.restaurantGrid.innerHTML = `<div class="empty-state"><div class="empty-emoji">⚠️</div><h3>Không tải được dữ liệu</h3><p>${escapeHtml(error.message)}</p></div>`;
    }
  }

  init();
})();
