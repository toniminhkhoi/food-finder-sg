(() => {
  "use strict";

  const CONFIG = window.FOOD_FINDER_CONFIG || {};
  const state = {
    restaurants: [],
    filtered: [],
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
    favorites: new Set(JSON.parse(localStorage.getItem("foodFinderFavorites") || "[]"))
  };

  const $ = (id) => document.getElementById(id);
  const els = {
    heroCount: $("heroCount"), districtStat: $("districtStat"), cuisineStat: $("cuisineStat"), favoriteStat: $("favoriteStat"),
    heroSearchInput: $("heroSearchInput"), heroSearchBtn: $("heroSearchBtn"), searchInput: $("searchInput"),
    districtFilters: $("districtFilters"), foodTypeFilters: $("foodTypeFilters"), cuisineFilters: $("cuisineFilters"), dessertFilters: $("dessertFilters"), drinkFilters: $("drinkFilters"),
    clearFilters: $("clearFilters"), emptyClearBtn: $("emptyClearBtn"), activeFilters: $("activeFilters"), restaurantGrid: $("restaurantGrid"), resultCount: $("resultCount"), emptyState: $("emptyState"), loadMoreBtn: $("loadMoreBtn"),
    sortSelect: $("sortSelect"), randomBtn: $("randomBtn"), showFavoritesBtn: $("showFavoritesBtn"), mobileFilterBtn: $("mobileFilterBtn"), filterPanel: $("filterPanel"), filterBackdrop: $("filterBackdrop"),
    chatFab: $("chatFab"), chatWidget: $("chatWidget"), navChatBtn: $("navChatBtn"), heroChatBtn: $("heroChatBtn"), closeChatBtn: $("closeChatBtn"), chatMessages: $("chatMessages"), chatForm: $("chatForm"), chatInput: $("chatInput"), chatSuggestions: $("chatSuggestions"), toast: $("toast")
  };

  const escapeHtml = (value = "") => String(value)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

  const normalize = (value = "") => String(value).toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

  const splitTags = (value) => {
    if (Array.isArray(value)) return value.filter(Boolean).map(v => String(v).trim());
    if (!value) return [];
    return String(value).split(/[;,]/).map(v => v.trim()).filter(Boolean);
  };

  function normalizeRestaurant(raw, index) {
    return {
      id: raw.id || index + 1,
      name: raw.name || raw["Tên quán"] || "",
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

  function parseCSV(text) {
    const rows = [];
    let row = [], cell = "", quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i], next = text[i + 1];
      if (ch === '"' && quoted && next === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = !quoted;
      else if (ch === ',' && !quoted) { row.push(cell); cell = ""; }
      else if ((ch === '\n' || ch === '\r') && !quoted) {
        if (ch === '\r' && next === '\n') i++;
        row.push(cell); cell = "";
        if (row.some(v => v.trim() !== "")) rows.push(row);
        row = [];
      } else cell += ch;
    }
    if (cell || row.length) { row.push(cell); if (row.some(v => v.trim() !== "")) rows.push(row); }
    if (!rows.length) return [];
    const headers = rows.shift().map(h => h.trim());
    return rows.map(r => Object.fromEntries(headers.map((h, i) => [h, (r[i] || "").trim()])));
  }

  async function loadData() {
    const localOverride = localStorage.getItem("foodFinderCustomData");
    if (localOverride) {
      try { return JSON.parse(localOverride).map(normalizeRestaurant); } catch (_) {}
    }

    if (CONFIG.dataSource === "google-sheet" && CONFIG.googleSheetCsvUrl) {
      try {
        const response = await fetch(CONFIG.googleSheetCsvUrl, { cache: "no-store" });
        if (!response.ok) throw new Error("Không tải được Google Sheet");
        return parseCSV(await response.text()).map(normalizeRestaurant).filter(x => x.name);
      } catch (error) {
        console.warn("Google Sheet lỗi, dùng data local:", error);
      }
    }

    const response = await fetch(CONFIG.localDataUrl || "./data/restaurants.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Không tải được data quán.");
    return (await response.json()).map(normalizeRestaurant).filter(x => x.name);
  }

  function uniqueSorted(values) {
    return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi"));
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

  function searchableText(r) {
    return normalize([r.name, r.branch, r.address, r.district, r.mainGroup, ...r.foodTypes, ...r.cuisines, ...r.desserts, ...r.drinks, r.note].join(" "));
  }

  function matchesAny(values, selectedSet) {
    if (!selectedSet.size) return true;
    return [...selectedSet].some(selected => values.includes(selected));
  }

  function applyFilters() {
    const keyword = normalize(state.keyword);
    let result = state.restaurants.filter(r => {
      if (state.favoritesOnly && !state.favorites.has(String(r.id))) return false;
      if (state.selected.district.size && !state.selected.district.has(r.district)) return false;
      if (!matchesAny(r.foodTypes, state.selected.foodType)) return false;
      if (!matchesAny(r.cuisines, state.selected.cuisine)) return false;
      if (!matchesAny(r.desserts, state.selected.dessert)) return false;
      if (!matchesAny(r.drinks, state.selected.drink)) return false;
      if (keyword && !searchableText(r).includes(keyword)) return false;
      return true;
    });

    if (state.sort === "district") result.sort((a,b) => (a.district + a.name).localeCompare(b.district + b.name, "vi"));
    else if (state.sort === "favorites") result.sort((a,b) => Number(state.favorites.has(String(b.id))) - Number(state.favorites.has(String(a.id))) || a.name.localeCompare(b.name,"vi"));
    else result.sort((a,b) => a.name.localeCompare(b.name, "vi"));

    state.filtered = result;
    renderActiveFilters();
    renderRestaurants();
    updateStats();
  }

  function getAllTags(r) {
    return uniqueSorted([...r.foodTypes, ...r.cuisines, ...r.desserts, ...r.drinks]).slice(0, 6);
  }

  function mapsLink(r) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([r.name,r.branch,r.address,"TP.HCM"].filter(Boolean).join(" "))}`;
  }

  function cardHtml(r) {
    const fav = state.favorites.has(String(r.id));
    const safeSource = /^https?:\/\//i.test(r.source) ? r.source : "";
    return `
      <article class="restaurant-card" data-id="${escapeHtml(r.id)}">
        <div class="card-top">
          <div class="card-title-wrap">
            <div class="card-eyebrow">
              ${r.district ? `<span class="district-tag">${escapeHtml(r.district)}</span>` : ""}
              ${r.mainGroup ? `<span class="main-tag">${escapeHtml(r.mainGroup)}</span>` : ""}
            </div>
            <h4>${escapeHtml(r.name)}</h4>
            ${r.branch ? `<p class="branch-name">Chi nhánh ${escapeHtml(r.branch)}</p>` : ""}
          </div>
          <button class="favorite-btn ${fav ? "active" : ""}" type="button" data-favorite="${escapeHtml(r.id)}" aria-label="Yêu thích">${fav ? "♥" : "♡"}</button>
        </div>
        <p class="card-address"><span>●</span>${escapeHtml(r.address || "Đang cập nhật địa chỉ")}</p>
        <div class="card-tags">${getAllTags(r).map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
        ${r.note ? `<p class="card-note">${escapeHtml(r.note)}</p>` : ""}
        <div class="card-footer">
          <a class="map-link" href="${mapsLink(r)}" target="_blank" rel="noopener">↗ Google Maps</a>
          <span class="status-dot"><i></i>${safeSource ? `<a href="${escapeHtml(safeSource)}" target="_blank" rel="noopener">Nguồn</a>` : "Đã lưu"}</span>
        </div>
      </article>`;
  }

  function renderRestaurants() {
    els.resultCount.textContent = state.filtered.length;
    const visible = state.filtered.slice(0, state.visibleCount);
    els.restaurantGrid.innerHTML = visible.map(cardHtml).join("");
    els.emptyState.classList.toggle("hidden", state.filtered.length > 0);
    els.loadMoreBtn.classList.toggle("hidden", state.visibleCount >= state.filtered.length || !state.filtered.length);

    document.querySelectorAll("[data-favorite]").forEach(btn => btn.addEventListener("click", () => toggleFavorite(btn.dataset.favorite)));
  }

  function renderActiveFilters() {
    const chips = [];
    Object.entries(state.selected).forEach(([group,set]) => set.forEach(value => chips.push({group,value})));
    if (state.keyword) chips.push({group:"keyword",value:`“${state.keyword}”`});
    if (state.favoritesOnly) chips.push({group:"favorites", value:"Chỉ yêu thích"});
    els.activeFilters.innerHTML = chips.map((chip,i) => `<button type="button" class="filter-chip" data-chip="${i}">${escapeHtml(chip.value)} ×</button>`).join("");
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
    els.heroCount.textContent = state.restaurants.length;
    els.districtStat.textContent = uniqueSorted(state.restaurants.map(r => r.district)).length;
    els.cuisineStat.textContent = uniqueSorted(state.restaurants.flatMap(r => r.cuisines)).length;
    els.favoriteStat.textContent = state.favorites.size;
  }

  function toggleFavorite(id) {
    const key = String(id);
    if (state.favorites.has(key)) { state.favorites.delete(key); showToast("Đã bỏ khỏi yêu thích"); }
    else { state.favorites.add(key); showToast("Đã lưu vào yêu thích ♡"); }
    localStorage.setItem("foodFinderFavorites", JSON.stringify([...state.favorites]));
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
    document.querySelector("#discover")?.scrollIntoView({behavior:"smooth",block:"start"});
  }

  function showToast(text) {
    els.toast.textContent = text;
    els.toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 1800);
  }

  function randomRestaurant(pool = state.filtered.length ? state.filtered : state.restaurants) {
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function randomAction() {
    const r = randomRestaurant();
    if (!r) return;
    showToast(`🎲 ${r.name} — ${r.district}`);
    setSearch(r.name);
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
    "banh":"Bánh ngọt"
  };

  function containsPhrase(text, phrase) {
    return (` ${text} `).includes(` ${phrase} `);
  }

  function parseBotQuery(query) {
    const q = normalize(query);
    let district = "", intent = "";
    const districtEntries = Object.entries(districtAliases).sort((a,b) => b[0].length-a[0].length);
    const intentEntries = Object.entries(intentAliases).sort((a,b) => b[0].length-a[0].length);
    for (const [alias,val] of districtEntries) if (containsPhrase(q,alias)) { district = val; break; }
    for (const [alias,val] of intentEntries) if (containsPhrase(q,alias)) { intent = val; break; }
    return { q, district, intent, random: /\b(random|ngau nhien|chon giup|chon dum|an gi|goi y)\b/.test(q) };
  }

  function botFilter(parsed) {
    let pool = state.restaurants.filter(r => {
      if (parsed.district && r.district !== parsed.district) return false;
      if (parsed.intent) {
        const tags = [r.mainGroup,...r.foodTypes,...r.cuisines,...r.desserts,...r.drinks];
        if (!tags.some(t => normalize(t).includes(normalize(parsed.intent)) || normalize(parsed.intent).includes(normalize(t)))) return false;
      }
      return true;
    });
    if (!parsed.district && !parsed.intent && parsed.q) {
      const stop = ["cho toi","tim","quan","giup","minh","o","gan","muon","an","uong","co","nao"];
      const terms = parsed.q.split(" ").filter(t => t.length > 1 && !stop.includes(t));
      if (terms.length) pool = state.restaurants.filter(r => terms.some(t => searchableText(r).includes(t)));
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

  function botResultsHtml(items, intro) {
    return `<div>${escapeHtml(intro)}</div><div class="bot-results">${items.map(r => `
      <div class="bot-result"><b>${escapeHtml(r.name)}</b><span>${escapeHtml([r.branch,r.district].filter(Boolean).join(" · "))}</span><span>${escapeHtml(r.address)}</span><a href="${mapsLink(r)}" target="_blank" rel="noopener">Mở Google Maps ↗</a></div>`).join("")}</div>`;
  }

  function botReply(query) {
    const parsed = parseBotQuery(query);
    if (/^(xin chao|hello|hi|chao)\b/.test(parsed.q)) {
      addMessage("Chào bạn 👋 Mình có thể tìm quán theo quận, loại món hoặc quốc gia. Thử: “đồ Hàn ở Bình Thạnh” nhé.");
      return;
    }
    if (/\b(bao nhieu|tong cong|co may)\b/.test(parsed.q)) {
      addMessage(`Hiện mình đang có ${state.restaurants.length} địa điểm trong danh sách, trải ở ${uniqueSorted(state.restaurants.map(r=>r.district)).length} khu vực TP.HCM.`);
      return;
    }

    let pool = botFilter(parsed);
    if (!pool.length) {
      addMessage("Mình chưa tìm thấy quán khớp câu đó. Bạn thử nói ngắn hơn, ví dụ “ramen Tân Bình”, “lẩu Quận 7” hoặc “trà sữa Quận 10”.");
      return;
    }

    if (parsed.random) {
      const pick = randomRestaurant(pool);
      addMessage(botResultsHtml([pick], `Chốt cho bạn một chỗ trong ${pool.length} lựa chọn:`), "bot", true);
      return;
    }

    const picks = pool.slice(0, 4);
    let intro = `Mình tìm thấy ${pool.length} địa điểm phù hợp.`;
    if (pool.length > 4) intro += " Đây là 4 gợi ý đầu tiên:";
    addMessage(botResultsHtml(picks, intro), "bot", true);
  }

  function openChat() {
    els.chatWidget.classList.add("open");
    els.chatWidget.setAttribute("aria-hidden", "false");
    els.chatFab.style.opacity = "0";
    els.chatFab.style.pointerEvents = "none";
    if (!els.chatMessages.children.length) {
      addMessage(`Chào bạn! Mình là Măm Măm Bot ✦ Mình đang đọc ${state.restaurants.length} địa điểm trong danh sách. Bạn muốn ăn/uống gì hôm nay?`);
    }
    setTimeout(() => els.chatInput.focus(), 120);
  }

  function closeChat() {
    els.chatWidget.classList.remove("open");
    els.chatWidget.setAttribute("aria-hidden", "true");
    els.chatFab.style.opacity = "1";
    els.chatFab.style.pointerEvents = "auto";
  }

  // EVENTS ----------------------------------------------------------
  function bindEvents() {
    els.searchInput.addEventListener("input", e => { state.keyword = e.target.value; state.visibleCount=12; applyFilters(); });
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
      document.querySelector("#discover")?.scrollIntoView({behavior:"smooth"});
      showToast(state.favoritesOnly ? "Đang hiện quán yêu thích" : "Đã hiện lại tất cả quán");
    });

    document.querySelectorAll("[data-collapse]").forEach(btn => btn.addEventListener("click", () => {
      const target = $(btn.dataset.collapse);
      const collapsed = target.classList.toggle("hidden");
      btn.querySelector("b").textContent = collapsed ? "+" : "−";
    }));

    els.mobileFilterBtn.addEventListener("click", () => { els.filterPanel.classList.add("open"); els.filterBackdrop.classList.add("show"); document.body.classList.add("modal-open"); });
    els.filterBackdrop.addEventListener("click", () => { els.filterPanel.classList.remove("open"); els.filterBackdrop.classList.remove("show"); document.body.classList.remove("modal-open"); });

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
      renderFilterOptions();
      bindEvents();
      applyFilters();
    } catch (error) {
      console.error(error);
      els.restaurantGrid.innerHTML = `<div class="empty-state"><div class="empty-emoji">⚠️</div><h3>Không tải được dữ liệu</h3><p>${escapeHtml(error.message)}</p></div>`;
    }
  }

  init();
})();
