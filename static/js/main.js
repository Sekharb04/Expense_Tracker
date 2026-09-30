/**
 * PERSONAL EXPENSE TRACKER - MAIN JAVASCRIPT APP
 */

document.addEventListener("DOMContentLoaded", () => {
  // --- State Management ---
  const state = {
    activeTab: "analysis",
    preset: "all",
    startDate: "",
    endDate: "",
    category: "all",
    search: "",
    expenses: [],
    categories: [],
    budgets: {},
    analytics: null,
  };
  const currencyFormatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  });

  function formatCurrency(amount) {
    return currencyFormatter.format(Number(amount) || 0);
  }

  // --- Chart Instances ---
  let lineTrendChart = null;
  let donutCategoryChart = null;
  let barBudgetChart = null;

  // --- Category Metadata Map ---
  const categoryMeta = {
    housing: { name: "Housing", icon: "🏠", color: "#d4d4d4" },
    food: { name: "Food", icon: "🍔", color: "#e3b341" },
    transport: { name: "Transport", icon: "🚗", color: "#70a5cf" },
    shopping: { name: "Shopping", icon: "🛍️", color: "#d77b8b" },
    health: { name: "Health", icon: "❤️", color: "#ef8a62" },
    entertainment: { name: "Entertainment", icon: "🎬", color: "#ad96cf" },
    travel: { name: "Travel", icon: "✈️", color: "#56b4a3" },
    other: { name: "Other", icon: "💳", color: "#8494a3" },
  };

  // --- DOM Elements ---
  const navTabs = document.querySelectorAll(".nav-tab");
  const tabPanels = document.querySelectorAll(".tab-panel");
  const presetBtns = document.querySelectorAll(".btn-preset");
  const customDateContainer = document.getElementById("custom-date-container");
  const startDateInput = document.getElementById("start-date");
  const endDateInput = document.getElementById("end-date");
  const filterCategorySelect = document.getElementById("filter-category");
  const filterSearchInput = document.getElementById("filter-search");
  const clearSearchBtn = document.getElementById("clear-search");

  // Modals
  const expenseModal = document.getElementById("expense-modal");
  const expenseForm = document.getElementById("expense-form");
  const modalTitle = document.getElementById("modal-title");
  const expenseIdInput = document.getElementById("expense-id");
  const formTitle = document.getElementById("form-title");
  const formAmount = document.getElementById("form-amount");
  const formDate = document.getElementById("form-date");
  const formCategory = document.getElementById("form-category");
  const formSubcategory = document.getElementById("form-subcategory");
  const formNotes = document.getElementById("form-notes");
  const subcategoryDatalist = document.getElementById(
    "subcategory-suggestions",
  );

  const budgetModal = document.getElementById("budget-modal");
  const budgetForm = document.getElementById("budget-form");
  const budgetCategoryIdInput = document.getElementById("budget-category-id");
  const budgetCategoryNameLabel = document.getElementById(
    "budget-category-name",
  );
  const budgetLimitInput = document.getElementById("budget-limit-input");

  const btnAddExpense = document.getElementById("btn-add-expense");
  const btnAddRecordTab = document.getElementById("btn-add-record-tab");
  const btnExportCsv = document.getElementById("btn-export-csv");

  // KPI Elements
  const kpiTotalSpent = document.getElementById("kpi-total-spent");
  const kpiCount = document.getElementById("kpi-count");
  const kpiAvgAmount = document.getElementById("kpi-avg-amount");
  const kpiTopCategory = document.getElementById("kpi-top-category");
  const kpiTopCatAmount = document.getElementById("kpi-top-cat-amount");
  const kpiBudgetPercent = document.getElementById("kpi-budget-percent");
  const kpiBudgetRemaining = document.getElementById("kpi-budget-remaining");
  const kpiPeriodLabel = document.getElementById("kpi-period-label");

  // Records Table Elements
  const recordsTableBody = document.getElementById("records-table-body");
  const recordsSummaryCount = document.getElementById("records-summary-count");
  const recordsEmptyState = document.getElementById("records-empty-state");

  // Containers
  const budgetCardsContainer = document.getElementById(
    "budget-cards-container",
  );
  const categoriesCardsContainer = document.getElementById(
    "categories-cards-container",
  );

  // Toast
  const toast = document.getElementById("toast");
  const toastMessage = document.getElementById("toast-message");

  // --- Initialization ---
  async function init() {
    setupEventListeners();
    await fetchCategoryMetadata();
    await refreshAllData();
  }

  // --- Fetch Category Metadata ---
  async function fetchCategoryMetadata() {
    try {
      const res = await fetch("/api/categories");
      state.categories = await res.json();
    } catch (err) {
      console.error("Error loading categories:", err);
    }
  }

  // --- Event Listeners Setup ---
  function setupEventListeners() {
    // Navigation Tab Switching
    navTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const targetTab = tab.dataset.tab;
        navTabs.forEach((t) => t.classList.remove("active"));
        tabPanels.forEach((p) => p.classList.remove("active"));

        tab.classList.add("active");
        document.getElementById(`tab-${targetTab}`).classList.add("active");
        state.activeTab = targetTab;
      });
    });

    // Date Preset Selection
    presetBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        presetBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.preset = btn.dataset.preset;

        applyDatePreset(state.preset);
        refreshAllData();
      });
    });

    // Custom Date Inputs
    startDateInput.addEventListener("change", () => {
      state.startDate = startDateInput.value;
      refreshAllData();
    });
    endDateInput.addEventListener("change", () => {
      state.endDate = endDateInput.value;
      refreshAllData();
    });

    // Category Filter Dropdown
    filterCategorySelect.addEventListener("change", () => {
      state.category = filterCategorySelect.value;
      refreshAllData();
    });

    // Search Filter Input
    filterSearchInput.addEventListener("input", () => {
      state.search = filterSearchInput.value.trim();
      if (state.search) {
        clearSearchBtn.classList.remove("hidden");
      } else {
        clearSearchBtn.classList.add("hidden");
      }
      debounceRefreshData();
    });

    clearSearchBtn.addEventListener("click", () => {
      filterSearchInput.value = "";
      state.search = "";
      clearSearchBtn.classList.add("hidden");
      refreshAllData();
    });

    // Modal Open / Close Buttons
    btnAddExpense.addEventListener("click", () => openExpenseModal());
    if (btnAddRecordTab)
      btnAddRecordTab.addEventListener("click", () => openExpenseModal());

    document
      .getElementById("btn-close-modal")
      .addEventListener("click", closeExpenseModal);
    document
      .getElementById("btn-cancel-modal")
      .addEventListener("click", closeExpenseModal);

    document
      .getElementById("btn-close-budget-modal")
      .addEventListener("click", closeBudgetModal);
    document
      .getElementById("btn-cancel-budget-modal")
      .addEventListener("click", closeBudgetModal);

    // Form Submit Handlers
    expenseForm.addEventListener("submit", handleExpenseSubmit);
    budgetForm.addEventListener("submit", handleBudgetSubmit);

    // Category Change in Modal -> Updates subcategory options
    formCategory.addEventListener("change", updateSubcategorySuggestions);
  }

  // --- Date Preset Logic ---
  function applyDatePreset(preset) {
    const today = new Date();
    const formatDateStr = (d) => d.toISOString().split("T")[0];

    if (preset === "all") {
      state.startDate = "";
      state.endDate = "";
      customDateContainer.classList.add("hidden");
      kpiPeriodLabel.textContent = "All Time";
    } else if (preset === "this_month") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      state.startDate = formatDateStr(firstDay);
      state.endDate = formatDateStr(today);
      customDateContainer.classList.add("hidden");
      kpiPeriodLabel.textContent = "This Month";
    } else if (preset === "last_month") {
      const firstDayPrev = new Date(
        today.getFullYear(),
        today.getMonth() - 1,
        1,
      );
      const lastDayPrev = new Date(today.getFullYear(), today.getMonth(), 0);
      state.startDate = formatDateStr(firstDayPrev);
      state.endDate = formatDateStr(lastDayPrev);
      customDateContainer.classList.add("hidden");
      kpiPeriodLabel.textContent = "Last Month";
    } else if (preset === "this_week") {
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 7);
      state.startDate = formatDateStr(weekAgo);
      state.endDate = formatDateStr(today);
      customDateContainer.classList.add("hidden");
      kpiPeriodLabel.textContent = "Past 7 Days";
    } else if (preset === "custom") {
      customDateContainer.classList.remove("hidden");
      kpiPeriodLabel.textContent = "Custom Range";
      if (!state.startDate) {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        startDateInput.value = formatDateStr(firstDay);
        state.startDate = startDateInput.value;
      } else {
        startDateInput.value = state.startDate;
      }
      if (!state.endDate) {
        endDateInput.value = formatDateStr(today);
        state.endDate = endDateInput.value;
      } else {
        endDateInput.value = state.endDate;
      }
    }
  }

  // Debounce timer for smooth search experience
  let searchDebounceTimer = null;
  function debounceRefreshData() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      refreshAllData();
    }, 300);
  }

  // --- Main Refresh Controller ---
  async function refreshAllData() {
    updateExportCsvLink();
    await Promise.all([loadExpensesList(), loadAnalyticsData()]);
    renderRecordsTable();
    renderBudgetCards();
    renderCategoriesCards();
  }

  function updateExportCsvLink() {
    const params = new URLSearchParams();
    if (state.startDate) params.append("start_date", state.startDate);
    if (state.endDate) params.append("end_date", state.endDate);
    if (state.category && state.category !== "all")
      params.append("category", state.category);
    if (state.search) params.append("search", state.search);
    btnExportCsv.href = `/api/export?${params.toString()}`;
  }

  // --- API Data Fetching ---
  async function loadExpensesList() {
    try {
      const params = new URLSearchParams();
      if (state.startDate) params.append("start_date", state.startDate);
      if (state.endDate) params.append("end_date", state.endDate);
      if (state.category && state.category !== "all")
        params.append("category", state.category);
      if (state.search) params.append("search", state.search);

      const res = await fetch(`/api/expenses?${params.toString()}`);
      const data = await res.json();
      state.expenses = data.expenses || [];
    } catch (err) {
      console.error("Error fetching expenses:", err);
    }
  }

  async function loadAnalyticsData() {
    try {
      const params = new URLSearchParams();
      if (state.startDate) params.append("start_date", state.startDate);
      if (state.endDate) params.append("end_date", state.endDate);
      if (state.category && state.category !== "all")
        params.append("category", state.category);
      if (state.search) params.append("search", state.search);

      const res = await fetch(`/api/analytics?${params.toString()}`);
      const data = await res.json();
      state.analytics = data;
      state.budgets = data.budgets || {};

      renderKPIs(data);
      renderCharts(data);
    } catch (err) {
      console.error("Error fetching analytics:", err);
    }
  }

  // --- Render KPI Cards ---
  function renderKPIs(data) {
    kpiTotalSpent.textContent = formatCurrency(data.total_spent);
    kpiCount.textContent = data.expense_count;
    kpiAvgAmount.textContent = `Avg: ${formatCurrency(data.average_expense)} / item`;

    if (data.top_category) {
      kpiTopCategory.textContent = `${data.top_category.icon} ${data.top_category.name}`;
      kpiTopCatAmount.textContent = `${formatCurrency(data.top_category.amount)} spent`;
    } else {
      kpiTopCategory.textContent = "None";
      kpiTopCatAmount.textContent = `${formatCurrency(0)} spent`;
    }

    // Calculate overall budget percentage
    const totalMonthlyBudget = Object.values(state.budgets).reduce(
      (a, b) => a + b,
      0,
    );
    const overallPercent =
      totalMonthlyBudget > 0
        ? (data.total_spent / totalMonthlyBudget) * 100
        : 0;
    const remaining = totalMonthlyBudget - data.total_spent;

    kpiBudgetPercent.textContent = `${overallPercent.toFixed(0)}%`;
    if (remaining >= 0) {
      kpiBudgetRemaining.textContent = `${formatCurrency(remaining)} remaining`;
      kpiBudgetRemaining.style.color = "#34d399";
    } else {
      kpiBudgetRemaining.textContent = `${formatCurrency(Math.abs(remaining))} over budget!`;
      kpiBudgetRemaining.style.color = "#fb7185";
    }
  }

  // --- Render Chart Visualizations ---
  function renderCharts(data) {
    renderLineChart(data.daily_trend);
    renderDonutChart(data.category_summary);
    renderBarChart(data.category_summary);
  }

  // 1. Line Graph: Daily Spending Trend
  function renderLineChart(dailyTrend) {
    const ctx = document.getElementById("line-trend-chart").getContext("2d");
    if (lineTrendChart) lineTrendChart.destroy();

    const labels = dailyTrend.map((item) => item.date);
    const amounts = dailyTrend.map((item) => item.amount);

    // Use a low-contrast fill so the line remains legible on black.
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, "rgba(229, 229, 229, 0.2)");
    gradient.addColorStop(1, "rgba(229, 229, 229, 0.0)");

    lineTrendChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Daily Expenses (INR)",
            data: amounts,
            borderColor: "#e5e5e5",
            backgroundColor: gradient,
            borderWidth: 3,
            fill: true,
            tension: 0.35,
            pointBackgroundColor: "#f5f5f5",
            pointBorderColor: "#050505",
            pointHoverRadius: 6,
            pointRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#111111",
            titleColor: "#f5f5f5",
            bodyColor: "#e5e5e5",
            padding: 10,
            borderColor: "#414141",
            borderWidth: 1,
            callbacks: {
              label: (context) => ` Spent: ${formatCurrency(context.raw)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: "rgba(255, 255, 255, 0.08)" },
            ticks: { color: "#a3a3a3", font: { family: "Inter" } },
          },
          y: {
            beginAtZero: true,
            grid: { color: "rgba(255, 255, 255, 0.08)" },
            ticks: {
              color: "#a3a3a3",
              font: { family: "Inter" },
              callback: (val) => formatCurrency(val),
            },
          },
        },
      },
    });
  }

  // 2. Donut Chart: Category Breakdown
  function renderDonutChart(categorySummary) {
    const ctx = document
      .getElementById("donut-category-chart")
      .getContext("2d");
    if (donutCategoryChart) donutCategoryChart.destroy();

    // Filter out categories with 0 spent for clean display
    const activeCategories = categorySummary.filter((c) => c.spent > 0);

    const labels = activeCategories.map((c) => `${c.icon} ${c.name}`);
    const data = activeCategories.map((c) => c.spent);
    const colors = activeCategories.map((c) => c.color);

    if (activeCategories.length === 0) {
      labels.push("No Expenses");
      data.push(1);
      colors.push("#262626");
    }

    donutCategoryChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [
          {
            data: data,
            backgroundColor: colors,
            borderWidth: 2,
            borderColor: "#050505",
            hoverOffset: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "right",
            labels: {
              color: "#e5e5e5",
              font: { family: "Inter", size: 12 },
              padding: 12,
              usePointStyle: true,
            },
          },
          tooltip: {
            callbacks: {
              label: (context) => ` ${formatCurrency(context.raw)}`,
            },
          },
        },
        cutout: "68%",
      },
    });
  }

  // 3. Bar Plot: Category Spending vs Budget
  function renderBarChart(categorySummary) {
    const ctx = document.getElementById("bar-budget-chart").getContext("2d");
    if (barBudgetChart) barBudgetChart.destroy();

    const labels = categorySummary.map((c) => `${c.icon} ${c.name}`);
    const spentData = categorySummary.map((c) => c.spent);
    const budgetData = categorySummary.map((c) => c.budget);

    barBudgetChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Actual Spent (INR)",
            data: spentData,
            backgroundColor: "#e5e5e5",
            borderRadius: 6,
          },
          {
            label: "Monthly Budget (INR)",
            data: budgetData,
            backgroundColor: "rgba(115, 115, 115, 0.38)",
            borderColor: "#737373",
            borderWidth: 1,
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
            labels: { color: "#e5e5e5", font: { family: "Inter" } },
          },
          tooltip: {
            callbacks: {
              label: (context) =>
                ` ${context.dataset.label}: ${formatCurrency(context.raw)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: "rgba(255, 255, 255, 0.08)" },
            ticks: { color: "#a3a3a3", font: { family: "Inter" } },
          },
          y: {
            beginAtZero: true,
            grid: { color: "rgba(255, 255, 255, 0.08)" },
            ticks: {
              color: "#a3a3a3",
              font: { family: "Inter" },
              callback: (val) => formatCurrency(val),
            },
          },
        },
      },
    });
  }

  // --- Render Records Data Table ---
  function renderRecordsTable() {
    recordsTableBody.innerHTML = "";
    const count = state.expenses.length;
    recordsSummaryCount.textContent = `${count} record${count === 1 ? "" : "s"} found`;

    if (count === 0) {
      recordsEmptyState.classList.remove("hidden");
      return;
    }
    recordsEmptyState.classList.add("hidden");

    state.expenses.forEach((item) => {
      const tr = document.createElement("tr");

      const meta = categoryMeta[item.category] || {
        name: item.category,
        icon: "💳",
        color: "#64748b",
      };

      tr.innerHTML = `
                <td><strong>${item.date}</strong></td>
                <td>
                    <div style="font-weight: 600; color: #f9fafb;">${escapeHtml(item.title)}</div>
                    ${item.notes ? `<div style="font-size: 0.78rem; color: #9ca3af;">${escapeHtml(item.notes)}</div>` : ""}
                </td>
                <td>
                    <span class="cat-badge" style="border-color: ${meta.color}50; color: ${meta.color};">
                        ${meta.icon} ${meta.name}
                    </span>
                </td>
                <td>${item.subcategory ? `<span class="subcat-pill">${escapeHtml(formatSubcategory(item.category, item.subcategory))}</span>` : '<span style="color:#6b7280;">-</span>'}</td>
                <td class="text-right"><span class="amount-text">${formatCurrency(item.amount)}</span></td>
                <td class="text-center">
                    <button class="btn-edit-icon" onclick="editExpense(${item.id})" title="Edit Expense">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn-danger-icon" onclick="deleteExpense(${item.id})" title="Delete Expense">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;

      recordsTableBody.appendChild(tr);
    });
  }

  // --- Render Budgets Tab ---
  function renderBudgetCards() {
    if (!state.analytics || !state.analytics.category_summary) return;

    budgetCardsContainer.innerHTML = "";

    state.analytics.category_summary.forEach((c) => {
      const spent = c.spent;
      const limit = c.budget;
      const percentage = limit > 0 ? (spent / limit) * 100 : 0;

      let statusClass = "status-safe";
      if (percentage >= 100) statusClass = "status-danger";
      else if (percentage >= 75) statusClass = "status-warning";

      const card = document.createElement("div");
      card.className = "budget-card";
      card.innerHTML = `
                <div class="budget-card-header">
                    <div class="cat-title-wrap">
                        <div class="cat-icon-lg" style="background: ${c.color}20; color: ${c.color};">${c.icon}</div>
                        <div>
                            <div class="cat-name">${c.name}</div>
                            <div style="font-size: 0.78rem; color: #9ca3af;">Limit: ${formatCurrency(limit)}/mo</div>
                        </div>
                    </div>
                    <button class="btn btn-secondary btn-sm" onclick="openBudgetModal('${c.id}', '${c.name}', ${limit})">
                        <i class="fa-solid fa-gear"></i> Set Limit
                    </button>
                </div>
                <div>
                    <div class="budget-nums">
                        <span>Spent: <strong class="budget-spent">${formatCurrency(spent)}</strong></span>
                        <span>${percentage.toFixed(0)}%</span>
                    </div>
                    <div class="progress-track mt-2">
                        <div class="progress-bar ${statusClass}" style="width: ${Math.min(percentage, 100)}%;"></div>
                    </div>
                </div>
            `;
      budgetCardsContainer.appendChild(card);
    });
  }

  // --- Render Categories Tab ---
  function renderCategoriesCards() {
    categoriesCardsContainer.innerHTML = "";

    const summaryMap = {};
    if (state.analytics && state.analytics.category_summary) {
      state.analytics.category_summary.forEach((s) => {
        summaryMap[s.id] = s;
      });
    }

    state.categories.forEach((cat) => {
      const summary = summaryMap[cat.id] || { spent: 0, percentage: 0 };

      const card = document.createElement("div");
      card.className = "category-overview-card";
      card.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 1.8rem;">${cat.icon}</span>
                        <div>
                            <h4 style="font-size: 1.1rem; font-weight: 700;">${cat.name}</h4>
                            <span style="font-size: 0.8rem; color: #9ca3af;">Total Spent: <strong style="color:#e5e5e5;">${formatCurrency(summary.spent)}</strong></span>
                        </div>
                    </div>
                </div>
                <div>
                    <div style="font-size: 0.78rem; font-weight: 600; color: #9ca3af; margin-bottom: 6px;">Example Subcategories:</div>
                    <div class="examples-wrap">
                        ${cat.examples.map((ex) => `<span class="example-tag">${ex.icon} ${escapeHtml(ex.name)}</span>`).join("")}
                    </div>
                </div>
            `;
      categoriesCardsContainer.appendChild(card);
    });
  }

  // --- Modal Handlers ---
  window.openExpenseModal = function (id = null) {
    expenseForm.reset();
    expenseIdInput.value = "";
    formDate.value = new Date().toISOString().split("T")[0];

    if (id) {
      const item = state.expenses.find((e) => e.id === id);
      if (item) {
        modalTitle.innerHTML =
          '<i class="fa-solid fa-pen-to-square"></i> Edit Expense';
        expenseIdInput.value = item.id;
        formTitle.value = item.title;
        formAmount.value = item.amount;
        formDate.value = item.date;
        formCategory.value = item.category;
        updateSubcategorySuggestions();
        formSubcategory.value = item.subcategory || "";
        formNotes.value = item.notes || "";
      }
    } else {
      modalTitle.innerHTML =
        '<i class="fa-solid fa-circle-plus"></i> Add New Expense';
      formCategory.value = "housing";
      updateSubcategorySuggestions();
    }

    expenseModal.classList.remove("hidden");
  };

  function closeExpenseModal() {
    expenseModal.classList.add("hidden");
  }

  window.openBudgetModal = function (catId, catName, currentLimit) {
    budgetCategoryIdInput.value = catId;
    budgetCategoryNameLabel.textContent = `${catName} Monthly Limit (₹)`;
    budgetLimitInput.value = currentLimit;
    budgetModal.classList.remove("hidden");
  };

  function closeBudgetModal() {
    budgetModal.classList.add("hidden");
  }

  function updateSubcategorySuggestions() {
    const catId = formCategory.value;
    const matchedCat = state.categories.find((c) => c.id === catId);
    const selectedSubcategory = formSubcategory.value;
    formSubcategory.replaceChildren();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = matchedCat
      ? "Select a subcategory"
      : "Select a category first";
    formSubcategory.appendChild(placeholder);

    if (matchedCat && matchedCat.examples) {
      matchedCat.examples.forEach((ex) => {
        const opt = document.createElement("option");
        opt.value = ex.name;
        opt.textContent = `${ex.icon} ${ex.name}`;
        formSubcategory.appendChild(opt);
      });
    }
    formSubcategory.value = selectedSubcategory;
  }

  // --- Form Submissions ---
  async function handleExpenseSubmit(e) {
    e.preventDefault();

    const id = expenseIdInput.value;
    const payload = {
      title: formTitle.value.trim(),
      amount: parseFloat(formAmount.value),
      date: formDate.value,
      category: formCategory.value,
      subcategory: formSubcategory.value.trim(),
      notes: formNotes.value.trim(),
    };

    const method = id ? "PUT" : "POST";
    const url = id ? `/api/expenses/${id}` : "/api/expenses";

    try {
      const res = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        closeExpenseModal();
        showToast(id ? "Expense updated successfully!" : "New expense added!");
        await refreshAllData();
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to save expense", "error");
      }
    } catch (err) {
      showToast("Network error while saving expense", "error");
    }
  }

  async function handleBudgetSubmit(e) {
    e.preventDefault();
    const catId = budgetCategoryIdInput.value;
    const limit = parseFloat(budgetLimitInput.value);

    try {
      const res = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: catId, monthly_limit: limit }),
      });

      if (res.ok) {
        closeBudgetModal();
        showToast("Budget target updated!");
        await refreshAllData();
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to update budget", "error");
      }
    } catch (err) {
      showToast("Error updating budget target", "error");
    }
  }

  // Global CRUD actions accessible from inline buttons
  window.editExpense = function (id) {
    openExpenseModal(id);
  };

  window.deleteExpense = async function (id) {
    if (confirm("Are you sure you want to delete this expense record?")) {
      try {
        const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
        if (res.ok) {
          showToast("Expense record deleted");
          await refreshAllData();
        }
      } catch (err) {
        showToast("Failed to delete expense record", "error");
      }
    }
  };

  // --- Toast Notification Helper ---
  function showToast(msg, type = "info") {
    toastMessage.textContent = msg;
    if (type === "error") {
      toast.style.background = "#ef4444";
    } else {
      toast.style.background = "#e5e5e5";
    }
    toast.classList.remove("hidden");
    setTimeout(() => {
      toast.classList.add("hidden");
    }, 3000);
  }

  // --- Utility Functions ---
  function escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatSubcategory(categoryId, subcategory) {
    const category = state.categories.find((item) => item.id === categoryId);
    const match = category?.examples.find((item) => item.name === subcategory);
    return match ? `${match.icon} ${match.name}` : subcategory;
  }

  // Launch Application
  init();
});
