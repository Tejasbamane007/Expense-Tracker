// ==== DOM ELEMENTS ====
const form = document.getElementById("transactionForm");
const transactionList = document.getElementById("transactionList");
const totalIncomeEl = document.getElementById("totalIncome");
const totalExpenseEl = document.getElementById("totalExpense");
const netIncomeEl = document.getElementById("netIncome");
const formError = document.getElementById("formError");
const clearFormBtn = document.getElementById("clearForm");

const filterCategory = document.getElementById("filterCategory");
const searchInput = document.getElementById("search");
const sortBy = document.getElementById("sortBy");
const resetFilterBtn = document.getElementById("resetFilter");

const toggleThemeBtn = document.getElementById("toggleTheme");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const exportJsonBtn = document.getElementById("exportJsonBtn");
const importFile = document.getElementById("importFile");
const monthlyReportBtn = document.getElementById("monthlyReport");
const monthSelect = document.getElementById("monthSelect");

// Chart elements
const chartCanvas = document.getElementById("expenseChart");
let expenseChart;

// Pagination
let currentPage = 1;
const itemsPerPage = 10;

// ==== STORAGE ====
let transactions = JSON.parse(localStorage.getItem("expense_tracker_v1")) || [];

// ==== HELPERS ====
function saveTransactions() {
  localStorage.setItem("expense_tracker_v1", JSON.stringify(transactions));
}

function formatCurrency(num) {
  return "₹" + num.toFixed(2);
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function getUniqueCategories() {
  const categories = new Set();
  transactions.forEach(t => categories.add(t.category));
  return Array.from(categories).sort();
}

function populateCategories() {
  const categories = getUniqueCategories();
  filterCategory.innerHTML = '<option value="all">All categories</option>';
  categories.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat;
    filterCategory.appendChild(option);
  });
}

function exportToCSV() {
  if (transactions.length === 0) {
    alert('No transactions to export');
    return;
  }

  const headers = ['Date', 'Type', 'Category', 'Description', 'Amount'];
  const csvContent = [
    headers.join(','),
    ...transactions.map(t => [
      t.date,
      t.type,
      t.category,
      `"${t.description}"`,
      t.amount
    ].join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `expenses_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportToJSON() {
  if (transactions.length === 0) {
    alert('No transactions to export');
    return;
  }

  const data = {
    exportDate: new Date().toISOString(),
    transactions: transactions
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `expenses_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importTransactions() {
  const file = importFile.files[0];
  if (!file) {
    alert('Please select a file to import');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      let data;
      if (file.name.endsWith('.json')) {
        data = JSON.parse(e.target.result);
        if (data.transactions) {
          transactions = [...transactions, ...data.transactions];
        } else {
          transactions = [...transactions, ...data];
        }
      } else if (file.name.endsWith('.csv')) {
        const csvText = e.target.result;
        const lines = csvText.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim());

        transactions = [...transactions, ...lines.slice(1).map(line => {
          const values = line.split(',');
          return {
            id: generateId(),
            date: values[0].trim(),
            type: values[1].trim(),
            category: values[2].trim(),
            description: values[3].trim().replace(/"/g, ''),
            amount: parseFloat(values[4].trim())
          };
        })];
      }

      saveTransactions();
      populateCategories();
      renderTransactions();
      renderSummary();
      renderChart();
      alert('Import successful!');
    } catch (error) {
      alert('Error importing file: ' + error.message);
    }
  };
  reader.readAsText(file);
}

// ==== RENDER FUNCTIONS ====
function renderTransactions() {
  transactionList.innerHTML = "";

  let data = [...transactions];

  // Filtering
  if (filterCategory.value !== "all") {
    data = data.filter(t => t.category === filterCategory.value);
  }
  // Searching
  const q = searchInput.value.trim().toLowerCase();
  if (q) {
    data = data.filter(t =>
      t.description.toLowerCase().includes(q) ||
      String(t.amount).includes(q)
    );
  }
  // Sorting
  switch (sortBy.value) {
    case "date_asc":
      data.sort((a, b) => new Date(a.date) - new Date(b.date));
      break;
    case "date_desc":
      data.sort((a, b) => new Date(b.date) - new Date(a.date));
      break;
    case "amount_asc":
      data.sort((a, b) => a.amount - b.amount);
      break;
    case "amount_desc":
      data.sort((a, b) => b.amount - a.amount);
      break;
  }

  // Pagination
  const totalItems = data.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = data.slice(startIndex, endIndex);

  // Render
  if (paginatedData.length === 0) {
    transactionList.innerHTML = "<li>No transactions found</li>";
    document.getElementById("pagination").innerHTML = "";
    return;
  }

  paginatedData.forEach(t => {
    const li = document.createElement("li");
    li.className = t.type;
    li.innerHTML = `
      <div>
        <strong>${t.description}</strong> (${t.category}) <br/>
        <small>${t.date}</small>
      </div>
      <div>
        <span>${t.type === "income" ? "+" : "-"}${formatCurrency(t.amount)}</span>
        <span class="actions">
          <button onclick="deleteTransaction('${t.id}')" class="btn">🗑</button>
        </span>
      </div>
    `;
    transactionList.appendChild(li);
  });

  // Render pagination
  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const paginationEl = document.getElementById("pagination");
  paginationEl.innerHTML = "";

  if (totalPages <= 1) return;

  // Previous button
  if (currentPage > 1) {
    const prevBtn = document.createElement("button");
    prevBtn.textContent = "«";
    prevBtn.className = "btn";
    prevBtn.onclick = () => {
      currentPage--;
      renderTransactions();
    };
    paginationEl.appendChild(prevBtn);
  }

  // Page numbers
  for (let i = 1; i <= totalPages; i++) {
    const pageBtn = document.createElement("button");
    pageBtn.textContent = i;
    pageBtn.className = `btn ${i === currentPage ? 'primary' : ''}`;
    pageBtn.onclick = () => {
      currentPage = i;
      renderTransactions();
    };
    paginationEl.appendChild(pageBtn);
  }

  // Next button
  if (currentPage < totalPages) {
    const nextBtn = document.createElement("button");
    nextBtn.textContent = "»";
    nextBtn.className = "btn";
    nextBtn.onclick = () => {
      currentPage++;
      renderTransactions();
    };
    paginationEl.appendChild(nextBtn);
  }
}

function renderSummary() {
  let income = 0, expense = 0;
  transactions.forEach(t => {
    if (t.type === "income") income += t.amount;
    else expense += t.amount;
  });
  totalIncomeEl.textContent = formatCurrency(income);
  totalExpenseEl.textContent = formatCurrency(expense);
  netIncomeEl.textContent = formatCurrency(income - expense);
}

function renderChart() {
  if (expenseChart) {
    expenseChart.destroy();
  }

  // Group expenses by category
  const categoryTotals = {};
  transactions.forEach(t => {
    if (t.type === 'expense') {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
    }
  });

  const categories = Object.keys(categoryTotals);
  const amounts = Object.values(categoryTotals);

  if (categories.length === 0) {
    chartCanvas.style.display = 'none';
    return;
  }

  chartCanvas.style.display = 'block';

  expenseChart = new Chart(chartCanvas, {
    type: 'doughnut',
    data: {
      labels: categories,
      datasets: [{
        data: amounts,
        backgroundColor: [
          '#FF6384',
          '#36A2EB',
          '#FFCE56',
          '#4BC0C0',
          '#9966FF',
          '#FF9F40',
          '#FF6384',
          '#C9CBCF'
        ],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return formatCurrency(context.raw);
            }
          }
        }
      }
    }
  });
}

function generateMonthlyReport() {
  const selectedMonth = monthSelect.value;
  if (!selectedMonth) {
    alert('Please select a month');
    return;
  }

  const [year, month] = selectedMonth.split('-');
  const filteredTransactions = transactions.filter(t => {
    const transactionDate = new Date(t.date);
    return transactionDate.getFullYear() === parseInt(year) &&
           transactionDate.getMonth() === parseInt(month) - 1;
  });

  let income = 0, expense = 0;
  const categoryBreakdown = {};

  filteredTransactions.forEach(t => {
    if (t.type === 'income') {
      income += t.amount;
    } else {
      expense += t.amount;
      categoryBreakdown[t.category] = (categoryBreakdown[t.category] || 0) + t.amount;
    }
  });

  const report = `
Monthly Report for ${new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}

Total Income: ${formatCurrency(income)}
Total Expenses: ${formatCurrency(expense)}
Net: ${formatCurrency(income - expense)}

Category Breakdown:
${Object.entries(categoryBreakdown)
  .sort(([,a], [,b]) => b - a)
  .map(([cat, amt]) => `${cat}: ${formatCurrency(amt)}`)
  .join('\n')}

Total Transactions: ${filteredTransactions.length}
  `.trim();

  alert(report);
}

// ==== CRUD ====
function addTransaction(e) {
  e.preventDefault();
  formError.textContent = "";

  const date = form.date.value;
  const type = form.type.value;
  const category = form.category.value;
  const description = form.description.value.trim();
  const amount = parseFloat(form.amount.value);

  if (!date || !type || !category || !description || isNaN(amount) || amount <= 0) {
    formError.textContent = "Please fill out all fields correctly.";
    return;
  }

  const newT = {
    id: generateId(),
    date,
    type,
    category,
    description,
    amount
  };

  transactions.push(newT);
  saveTransactions();
  populateCategories();
  currentPage = 1; // Reset to first page
  renderTransactions();
  renderSummary();
  renderChart();
  form.reset();
}

function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  saveTransactions();
  populateCategories();
  currentPage = 1; // Reset to first page
  renderTransactions();
  renderSummary();
  renderChart();
}

// ==== THEME TOGGLE ====
function toggleTheme() {
  document.body.classList.toggle("dark-mode");
  const isDark = document.body.classList.contains("dark-mode");
  toggleThemeBtn.textContent = isDark ? "Light" : "Dark";
  localStorage.setItem("theme", isDark ? "dark" : "light");
}
function loadTheme() {
  const saved = localStorage.getItem("theme");
  if (saved === "dark") {
    document.body.classList.add("dark-mode");
    toggleThemeBtn.textContent = "Light";
  } else {
    toggleThemeBtn.textContent = "Dark";
  }
}

// ==== INIT ====
form.addEventListener("submit", addTransaction);
clearFormBtn.addEventListener("click", () => form.reset());
filterCategory.addEventListener("change", () => {
  currentPage = 1;
  renderTransactions();
});
searchInput.addEventListener("input", () => {
  currentPage = 1;
  renderTransactions();
});
sortBy.addEventListener("change", () => {
  currentPage = 1;
  renderTransactions();
});
resetFilterBtn.addEventListener("click", () => {
  filterCategory.value = "all";
  searchInput.value = "";
  sortBy.value = "date_desc";
  currentPage = 1;
  renderTransactions();
});

toggleThemeBtn.addEventListener("click", toggleTheme);

// Export/Import functionality
exportBtn.addEventListener("click", exportToCSV);
exportJsonBtn.addEventListener("click", exportToJSON);
importBtn.addEventListener("click", importTransactions);

// Monthly report
monthlyReportBtn.addEventListener("click", generateMonthlyReport);

// First load
loadTheme();
populateCategories();
renderTransactions();
renderSummary();
renderChart();
