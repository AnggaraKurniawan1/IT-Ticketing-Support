// IT Support Helpdesk & Ticketing System - Frontend Application Logic

let currentRole = 'user'; // 'user' or 'admin'
let userFilterStatus = 'All';
let adminFilters = {
  status: 'All',
  priority: 'All',
  category: 'All',
  department: 'All',
  search: ''
};

let userSearchTimeout = null;
let adminSearchTimeout = null;
let currentDetailTicket = null;
let chartStatusInstance = null;
let chartCategoryInstance = null;
let metaData = null;

// Initialize app on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
  lucide.createIcons();
  await loadMetadata();
  await loadApp();
  
  // Auto refresh every 30 seconds for live monitoring
  setInterval(() => {
    silentRefresh();
  }, 30000);
});

// Load Metadata (departments, categories, etc.)
async function loadMetadata() {
  try {
    const res = await fetch('/api/meta');
    const json = await res.json();
    if (json.success) {
      metaData = json.data;
      populateMetadataSelects();
    }
  } catch (err) {
    console.error('Error loading metadata:', err);
  }
}

function populateMetadataSelects() {
  if (!metaData) return;
  
  // Populate Technicians in update select
  const assigneeSelect = document.getElementById('updateAssigneeSelect');
  const inputAssignedTo = document.getElementById('inputAssignedTo');
  
  if (assigneeSelect && metaData.technicians) {
    const currentVal = assigneeSelect.value;
    assigneeSelect.innerHTML = '<option value="Belum Ditugaskan">-- Belum Ditugaskan --</option>';
    metaData.technicians.forEach(tech => {
      assigneeSelect.innerHTML += `<option value="${tech}">${tech}</option>`;
    });
    assigneeSelect.value = currentVal || 'Belum Ditugaskan';
  }

  if (inputAssignedTo && metaData.technicians) {
    inputAssignedTo.innerHTML = '<option value="Belum Ditugaskan">-- Belum Ditugaskan --</option>';
    metaData.technicians.forEach(tech => {
      inputAssignedTo.innerHTML += `<option value="${tech}">${tech}</option>`;
    });
  }
}

// Main initial loader
async function loadApp() {
  if (currentRole === 'user') {
    await loadUserDashboard();
  } else {
    await loadAdminDashboard();
  }
}

// Switch between User Portal and Admin Dashboard
function switchRole(role) {
  currentRole = role;
  
  const btnUser = document.getElementById('btnRoleUser');
  const btnAdmin = document.getElementById('btnRoleAdmin');
  const viewUser = document.getElementById('viewUser');
  const viewAdmin = document.getElementById('viewAdmin');

  if (role === 'user') {
    btnUser.className = 'flex items-center space-x-1.5 px-3 py-1 rounded-md transition-all bg-white text-slate-900 font-medium shadow-2xs';
    btnAdmin.className = 'flex items-center space-x-1.5 px-3 py-1 rounded-md transition-all text-slate-600 hover:text-slate-900 font-medium';
    viewUser.classList.remove('hidden');
    viewAdmin.classList.add('hidden');
    loadUserDashboard();
  } else {
    btnAdmin.className = 'flex items-center space-x-1.5 px-3 py-1 rounded-md transition-all bg-white text-slate-900 font-medium shadow-2xs';
    btnUser.className = 'flex items-center space-x-1.5 px-3 py-1 rounded-md transition-all text-slate-600 hover:text-slate-900 font-medium';
    viewAdmin.classList.remove('hidden');
    viewUser.classList.add('hidden');
    loadAdminDashboard();
  }
  lucide.createIcons();
}

// Refresh button trigger
async function refreshCurrentView() {
  const icon = document.getElementById('refreshIcon');
  if (icon) icon.classList.add('animate-spin');
  
  if (currentRole === 'user') {
    await loadUserDashboard();
  } else {
    await loadAdminDashboard();
  }
  
  setTimeout(() => {
    if (icon) icon.classList.remove('animate-spin');
  }, 600);
}

// Silent background refresh
async function silentRefresh() {
  if (currentRole === 'user') {
    await fetchUserTickets(false);
  } else {
    await fetchAdminTickets(false);
    await loadAdminStats();
  }
}

// ==============================================================
// USER PORTAL LOGIC
// ==============================================================

async function loadUserDashboard() {
  await fetchUserTickets(true);
}

async function fetchUserTickets(showLoading = true) {
  const container = document.getElementById('userTicketsList');
  if (showLoading && container) {
    container.innerHTML = `
      <div class="p-12 text-center text-slate-400">
        <i data-lucide="loader-2" class="w-6 h-6 animate-spin mx-auto text-slate-400 mb-2"></i>
        <p class="text-sm">Memuat data tiket...</p>
      </div>
    `;
    lucide.createIcons();
  }

  const queryParams = new URLSearchParams();
  if (userFilterStatus !== 'All') {
    queryParams.append('status', userFilterStatus);
  }
  const search = document.getElementById('userSearchInput')?.value.trim();
  if (search) {
    queryParams.append('search', search);
  }

  try {
    const res = await fetch(`/api/tickets?${queryParams.toString()}`);
    const json = await res.json();
    if (json.success) {
      renderUserTickets(json.data);
      updateUserCounters(json.data);
    }
  } catch (err) {
    console.error('Error fetching user tickets:', err);
    if (container) {
      container.innerHTML = `
        <div class="p-8 text-center text-red-500 text-sm">
          Gagal mengambil data tiket. Pastikan server aktif.
        </div>
      `;
    }
  }
}

function renderUserTickets(tickets) {
  const container = document.getElementById('userTicketsList');
  if (!container) return;

  if (tickets.length === 0) {
    container.innerHTML = `
      <div class="p-12 text-center space-y-3">
        <div class="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
          <i data-lucide="inbox" class="w-6 h-6"></i>
        </div>
        <p class="text-sm font-semibold text-slate-700">Belum ada tiket yang cocok</p>
        <p class="text-xs text-slate-400">Silakan ajukan tiket baru bila Anda mengalami kendala perangkat atau sistem.</p>
        <button onclick="openCreateTicketModal('user')" class="inline-flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs px-3.5 py-1.5 rounded-lg transition">
          <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i>
          <span>Buat Tiket Sekarang</span>
        </button>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  let html = '';
  tickets.forEach(ticket => {
    const statusBadge = getStatusBadge(ticket.status);
    const priorityBadge = getPriorityBadge(ticket.priority);

    html += `
      <div class="p-4 hover:bg-slate-50/80 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer" onclick="openDetailTicket(${ticket.id})">
        <div class="space-y-1 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              #${ticket.ticket_number}
            </span>
            ${priorityBadge}
            ${statusBadge}
            <span class="text-slate-500 text-xs font-medium">
              ${ticket.category}
            </span>
          </div>

          <h3 class="text-sm font-semibold text-slate-900 hover:text-slate-700 transition">
            ${escapeHtml(ticket.subject)}
          </h3>

          <p class="text-xs text-slate-500 line-clamp-1">
            ${escapeHtml(ticket.description)}
          </p>

          <div class="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-0.5">
            <span>Pelapor: <strong class="text-slate-600 font-medium">${escapeHtml(ticket.requester_name)}</strong> (${escapeHtml(ticket.department)})</span>
            <span>•</span>
            <span>${formatDateTime(ticket.created_at)}</span>
            <span>•</span>
            <span class="${ticket.assigned_to !== 'Belum Ditugaskan' ? 'text-slate-700 font-medium' : 'text-slate-400'}">
              Teknisi: ${escapeHtml(ticket.assigned_to)}
            </span>
          </div>
        </div>

        <div class="flex items-center space-x-2 self-end sm:self-center">
          <button onclick="event.stopPropagation(); openDetailTicket(${ticket.id})" class="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition">
            <span>Detail</span>
            <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-slate-400"></i>
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  lucide.createIcons();
}

function updateUserCounters(tickets) {
  // Count by status from all tickets
  fetch('/api/tickets')
    .then(r => r.json())
    .then(res => {
      if (res.success) {
        const all = res.data;
        const total = all.length;
        const open = all.filter(t => t.status === 'Open').length;
        const inProgress = all.filter(t => t.status === 'In Progress').length;
        const resolved = all.filter(t => t.status === 'Resolved' || t.status === 'Closed').length;

        document.getElementById('userTotalTickets').textContent = total;
        document.getElementById('userOpenTickets').textContent = open;
        document.getElementById('userInProgressTickets').textContent = inProgress;
        document.getElementById('userResolvedTickets').textContent = resolved;

        const navOpenBadge = document.getElementById('navOpenBadge');
        if (open > 0) {
          navOpenBadge.textContent = open;
          navOpenBadge.classList.remove('hidden');
        } else {
          navOpenBadge.classList.add('hidden');
        }
      }
    })
    .catch(() => {});
}

function filterUserStatus(status) {
  userFilterStatus = status;
  
  const buttons = ['All', 'Open', 'InProgress', 'Resolved'];
  buttons.forEach(b => {
    const btn = document.getElementById(`btnUserStatus${b}`);
    if (btn) {
      if ((b === 'InProgress' && status === 'In Progress') || b === status) {
        btn.className = 'px-2.5 py-1 rounded-md bg-white shadow-2xs text-slate-900 font-medium';
      } else {
        btn.className = 'px-2.5 py-1 rounded-md text-slate-600 hover:text-slate-900';
      }
    }
  });

  fetchUserTickets(true);
}

function debounceUserSearch() {
  clearTimeout(userSearchTimeout);
  userSearchTimeout = setTimeout(() => {
    fetchUserTickets(true);
  }, 350);
}

function focusUserSearch() {
  const el = document.getElementById('userSearchInput');
  if (el) {
    el.focus();
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// ==============================================================
// ADMIN DASHBOARD & CRUD LOGIC
// ==============================================================

async function loadAdminDashboard() {
  await loadAdminStats();
  await fetchAdminTickets(true);
}

async function loadAdminStats() {
  try {
    const res = await fetch('/api/stats');
    const json = await res.json();
    if (json.success) {
      const stats = json.data;
      document.getElementById('statTotal').textContent = stats.total;
      document.getElementById('statOpen').textContent = stats.open;
      document.getElementById('statInProgress').textContent = stats.in_progress;
      document.getElementById('statCritical').textContent = stats.critical_active;
      document.getElementById('statResolved').textContent = stats.resolved + stats.closed;
      document.getElementById('statRate').textContent = `${stats.resolution_rate}%`;

      renderAdminCharts(stats);
    }
  } catch (err) {
    console.error('Error loading admin stats:', err);
  }
}

function renderAdminCharts(stats) {
  // 1. Status Chart (Doughnut - Clean Monochrome Slate)
  const ctxStatus = document.getElementById('chartStatus')?.getContext('2d');
  if (ctxStatus) {
    if (chartStatusInstance) chartStatusInstance.destroy();

    const data = [
      stats.open,
      stats.in_progress,
      stats.resolved,
      stats.closed
    ];

    chartStatusInstance = new Chart(ctxStatus, {
      type: 'doughnut',
      data: {
        labels: ['Open', 'In Progress', 'Resolved', 'Closed'],
        datasets: [{
          data: data,
          backgroundColor: [
            '#94a3b8', // slate-400
            '#475569', // slate-600
            '#0f172a', // slate-900
            '#cbd5e1'  // slate-300
          ],
          borderWidth: 1.5,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 8,
              font: { size: 10, family: "'Inter', sans-serif" }
            }
          }
        },
        cutout: '72%'
      }
    });
  }

  // 2. Category Chart (Bar - Slate Theme)
  const ctxCategory = document.getElementById('chartCategory')?.getContext('2d');
  if (ctxCategory) {
    if (chartCategoryInstance) chartCategoryInstance.destroy();

    const labels = stats.category_breakdown.map(c => c.category);
    const counts = stats.category_breakdown.map(c => c.count);

    chartCategoryInstance = new Chart(ctxCategory, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Jumlah Tiket',
          data: counts,
          backgroundColor: '#334155',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1, font: { size: 10 } },
            grid: { color: '#f1f5f9' }
          },
          x: {
            ticks: {
              font: { size: 10 },
              maxRotation: 20,
              minRotation: 0
            },
            grid: { display: false }
          }
        }
      }
    });
  }
}

async function fetchAdminTickets(showLoading = true) {
  const tbody = document.getElementById('adminTableBody');
  if (showLoading && tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-10 text-slate-400">
          <i data-lucide="loader-2" class="w-5 h-5 animate-spin mx-auto text-slate-400 mb-1"></i>
          Memuat data tiket...
        </td>
      </tr>
    `;
    lucide.createIcons();
  }

  const queryParams = new URLSearchParams();
  if (adminFilters.status !== 'All') queryParams.append('status', adminFilters.status);
  if (adminFilters.priority !== 'All') queryParams.append('priority', adminFilters.priority);
  if (adminFilters.category !== 'All') queryParams.append('category', adminFilters.category);
  if (adminFilters.department !== 'All') queryParams.append('department', adminFilters.department);
  if (adminFilters.search) queryParams.append('search', adminFilters.search);

  try {
    const res = await fetch(`/api/tickets?${queryParams.toString()}`);
    const json = await res.json();
    if (json.success) {
      renderAdminTable(json.data);
      document.getElementById('adminTicketCount').textContent = json.data.length;
    }
  } catch (err) {
    console.error('Error fetching admin tickets:', err);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-6 text-red-500">
            Gagal mengambil data tiket admin.
          </td>
        </tr>
      `;
    }
  }
}

function renderAdminTable(tickets) {
  const tbody = document.getElementById('adminTableBody');
  if (!tbody) return;

  if (tickets.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-12 text-slate-400">
          <i data-lucide="inbox" class="w-8 h-8 mx-auto text-slate-300 mb-2"></i>
          Tidak ada tiket yang sesuai dengan filter.
        </td>
      </tr>
    `;
    lucide.createIcons();
    return;
  }

  let html = '';
  tickets.forEach(ticket => {
    const priorityBadge = getPriorityBadge(ticket.priority);
    const statusBadge = getStatusBadge(ticket.status);

    html += `
      <tr class="hover:bg-slate-50 transition border-b border-slate-100">
        
        <!-- No. Tiket -->
        <td class="py-3 px-4 font-mono font-bold text-slate-800">
          <button onclick="openDetailTicket(${ticket.id})" class="hover:text-slate-600 underline decoration-slate-300 transition">
            #${ticket.ticket_number}
          </button>
        </td>

        <!-- Pelapor & Dept -->
        <td class="py-3 px-4">
          <div class="font-bold text-slate-800">${escapeHtml(ticket.requester_name)}</div>
          <div class="text-[11px] text-slate-400">${escapeHtml(ticket.department)}</div>
        </td>

        <!-- Subjek & Kategori -->
        <td class="py-2.5 px-3 max-w-xs">
          <div class="font-medium text-slate-900 truncate" title="${escapeHtml(ticket.subject)}">
            ${escapeHtml(ticket.subject)}
          </div>
          <div class="text-[11px] text-slate-500">
            ${ticket.category}
          </div>
        </td>

        <!-- Prioritas -->
        <td class="py-2.5 px-3 whitespace-nowrap">
          ${priorityBadge}
        </td>

        <!-- Quick Status Selector -->
        <td class="py-2.5 px-3 whitespace-nowrap">
          <select onchange="handleQuickStatusChange(${ticket.id}, this.value)" class="text-[11px] font-medium py-1 px-2 rounded border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400">
            <option value="Open" ${ticket.status === 'Open' ? 'selected' : ''}>Open</option>
            <option value="In Progress" ${ticket.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
            <option value="Pending User" ${ticket.status === 'Pending User' ? 'selected' : ''}>Pending User</option>
            <option value="Resolved" ${ticket.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
            <option value="Closed" ${ticket.status === 'Closed' ? 'selected' : ''}>Closed</option>
          </select>
        </td>

        <!-- Teknisi -->
        <td class="py-2.5 px-3 whitespace-nowrap text-slate-600 font-medium">
          <span class="${ticket.assigned_to !== 'Belum Ditugaskan' ? 'text-slate-800' : 'text-slate-400 italic'}">
            ${escapeHtml(ticket.assigned_to)}
          </span>
        </td>

        <!-- Waktu -->
        <td class="py-2.5 px-3 whitespace-nowrap text-[11px] text-slate-400">
          ${formatDateTime(ticket.created_at)}
        </td>

        <!-- Action Buttons (CRUD) -->
        <td class="py-2.5 px-3 whitespace-nowrap text-center">
          <div class="flex items-center justify-center space-x-1">
            <button onclick="openDetailTicket(${ticket.id})" title="Kelola Tiket" class="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition">
              <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
            </button>
            <button onclick="quickDeleteTicket(${ticket.id}, '${ticket.ticket_number}')" title="Hapus Tiket" class="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </td>

      </tr>
    `;
  });

  tbody.innerHTML = html;
  lucide.createIcons();
}

function applyAdminFilters() {
  adminFilters.status = document.getElementById('adminFilterStatus').value;
  adminFilters.priority = document.getElementById('adminFilterPriority').value;
  adminFilters.category = document.getElementById('adminFilterCategory').value;
  adminFilters.department = document.getElementById('adminFilterDept').value;
  fetchAdminTickets(true);
}

function debounceAdminSearch() {
  clearTimeout(adminSearchTimeout);
  adminSearchTimeout = setTimeout(() => {
    adminFilters.search = document.getElementById('adminSearchInput').value.trim();
    fetchAdminTickets(true);
  }, 350);
}

// Quick status change from table dropdown
async function handleQuickStatusChange(ticketId, newStatus) {
  try {
    const res = await fetch(`/api/tickets/${ticketId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: newStatus,
        updated_by: 'IT Support Admin'
      })
    });
    const json = await res.json();
    if (json.success) {
      showToast('Status tiket berhasil diperbarui!', 'success');
      loadAdminStats();
    } else {
      showToast(json.message || 'Gagal mengubah status', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan jaringan', 'error');
  }
}

// ==============================================================
// MODAL: CREATE TICKET (USER & ADMIN)
// ==============================================================

function openCreateTicketModal(mode = 'user') {
  const modal = document.getElementById('modalCreateTicket');
  const title = document.getElementById('modalCreateTitle');
  const fieldAdminAssign = document.getElementById('fieldAdminAssign');
  const formAuthorRole = document.getElementById('formAuthorRole');

  document.getElementById('formCreateTicket').reset();

  if (mode === 'admin') {
    title.textContent = 'Buat Tiket Manual (Walk-in / Telepon)';
    fieldAdminAssign.classList.remove('hidden');
    formAuthorRole.value = 'admin';
  } else {
    title.textContent = 'Ajukan Tiket Bantuan IT';
    fieldAdminAssign.classList.add('hidden');
    formAuthorRole.value = 'user';
  }

  modal.classList.remove('hidden');
  lucide.createIcons();
}

async function handleCreateTicketSubmit(event) {
  event.preventDefault();
  const btn = document.getElementById('btnSubmitTicket');
  btn.disabled = true;
  btn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i><span>Mengirim...</span>`;
  lucide.createIcons();

  const formData = new FormData();
  formData.append('requester_name', document.getElementById('inputRequesterName').value.trim());
  formData.append('department', document.getElementById('inputDepartment').value);
  formData.append('requester_phone', document.getElementById('inputRequesterPhone').value.trim());
  formData.append('requester_email', document.getElementById('inputRequesterEmail').value.trim());
  formData.append('location', document.getElementById('inputLocation').value.trim());
  formData.append('category', document.getElementById('inputCategory').value);
  formData.append('priority', document.getElementById('inputPriority').value);
  formData.append('subject', document.getElementById('inputSubject').value.trim());
  formData.append('description', document.getElementById('inputDescription').value.trim());
  formData.append('author_role', document.getElementById('formAuthorRole').value);

  const fileInput = document.getElementById('inputAttachment');
  if (fileInput.files.length > 0) {
    formData.append('attachment', fileInput.files[0]);
  }

  const assignedTo = document.getElementById('inputAssignedTo')?.value;
  if (assignedTo && assignedTo !== 'Belum Ditugaskan') {
    formData.append('assigned_to', assignedTo);
  }

  try {
    const res = await fetch('/api/tickets', {
      method: 'POST',
      body: formData
    });
    const json = await res.json();

    if (json.success) {
      closeModal('modalCreateTicket');
      Swal.fire({
        icon: 'success',
        title: 'Tiket Berhasil Diajukan!',
        html: `Nomor Tiket Anda: <b class="text-slate-900 font-mono text-base">${json.data.ticket_number}</b><br><span class="text-xs text-slate-500">Tim IT Support telah diberitahu dan akan segera merespons.</span>`,
        confirmButtonColor: '#0f172a'
      });

      if (currentRole === 'user') {
        loadUserDashboard();
      } else {
        loadAdminDashboard();
      }
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Gagal Membuat Tiket',
        text: json.message || 'Mohon cek kembali isian formulir.',
        confirmButtonColor: '#0f172a'
      });
    }
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'Kesalahan Server',
      text: err.message,
      confirmButtonColor: '#0f172a'
    });
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="send" class="w-3.5 h-3.5"></i><span>Kirim Tiket Bantuan</span>`;
    lucide.createIcons();
  }
}

// ==============================================================
// MODAL: DETAIL TIKET, CRUD UPDATE & ACTIVITIES
// ==============================================================

async function openDetailTicket(ticketId) {
  try {
    const res = await fetch(`/api/tickets/${ticketId}`);
    const json = await res.json();
    if (!json.success) {
      showToast('Tiket tidak ditemukan', 'error');
      return;
    }

    const ticket = json.data;
    currentDetailTicket = ticket;

    // Set Header
    document.getElementById('detailTicketNumber').textContent = `#${ticket.ticket_number}`;
    document.getElementById('detailSubject').textContent = ticket.subject;

    const priorityBadge = document.getElementById('detailPriorityBadge');
    priorityBadge.className = `text-xs font-bold px-2 py-0.5 rounded-full ${getPriorityColorClasses(ticket.priority)}`;
    priorityBadge.textContent = ticket.priority;

    const statusBadge = document.getElementById('detailStatusBadge');
    statusBadge.className = `text-xs font-bold px-2.5 py-0.5 rounded-full ${getStatusColorClasses(ticket.status)}`;
    statusBadge.textContent = ticket.status;

    // Set Info Grid
    document.getElementById('detailRequester').textContent = ticket.requester_name;
    document.getElementById('detailDepartment').textContent = ticket.department;
    document.getElementById('detailContact').textContent = ticket.requester_phone || ticket.requester_email || '-';
    document.getElementById('detailLocation').textContent = ticket.location || 'Tidak dicantumkan';
    document.getElementById('detailCategory').textContent = ticket.category;
    document.getElementById('detailCreatedAt').textContent = `Dibuat: ${formatDateTime(ticket.created_at)}`;
    document.getElementById('detailAssignee').textContent = ticket.assigned_to;
    document.getElementById('detailResolvedAt').textContent = ticket.resolved_at ? `Selesai: ${formatDateTime(ticket.resolved_at)}` : '';

    // Description
    document.getElementById('detailDescription').textContent = ticket.description;

    // Attachment
    const attContainer = document.getElementById('detailAttachmentContainer');
    const attContent = document.getElementById('detailAttachmentContent');
    if (ticket.attachment) {
      attContainer.classList.remove('hidden');
      const isImg = /\.(jpg|jpeg|png|gif)$/i.test(ticket.attachment);
      if (isImg) {
        attContent.innerHTML = `
          <a href="${ticket.attachment}" target="_blank" class="block group relative rounded-lg overflow-hidden border border-slate-200">
            <img src="${ticket.attachment}" alt="Bukti Masalah" class="max-h-48 rounded object-cover group-hover:scale-105 transition">
            <div class="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-semibold transition">
              <i data-lucide="external-link" class="w-4 h-4 mr-1"></i> Buka Gambar
            </div>
          </a>
        `;
      } else {
        attContent.innerHTML = `
          <a href="${ticket.attachment}" target="_blank" class="inline-flex items-center space-x-2 text-slate-700 hover:text-slate-900 font-medium text-xs bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <i data-lucide="file" class="w-4 h-4 text-slate-500"></i>
            <span>Unduh Dokumen Lampiran</span>
          </a>
        `;
      }
    } else {
      attContainer.classList.add('hidden');
    }

    // Admin CRUD section vs User Resolution view
    const adminSection = document.getElementById('adminUpdateSection');
    const userResView = document.getElementById('userResolutionView');

    if (currentRole === 'admin') {
      adminSection.classList.remove('hidden');
      userResView.classList.add('hidden');

      document.getElementById('updateStatusSelect').value = ticket.status;
      document.getElementById('updatePrioritySelect').value = ticket.priority;
      document.getElementById('updateAssigneeSelect').value = ticket.assigned_to;
      document.getElementById('updateResolutionNotes').value = ticket.resolution_notes || '';
      document.getElementById('updateInternalNotes').value = ticket.internal_notes || '';
    } else {
      adminSection.classList.add('hidden');
      if (ticket.resolution_notes && (ticket.status === 'Resolved' || ticket.status === 'Closed')) {
        userResView.classList.remove('hidden');
        document.getElementById('userResolutionText').textContent = ticket.resolution_notes;
      } else {
        userResView.classList.add('hidden');
      }
    }

    // Activities & Timeline
    renderActivitiesTimeline(ticket.activities || []);

    document.getElementById('modalDetailTicket').classList.remove('hidden');
    lucide.createIcons();
  } catch (err) {
    console.error('Error opening detail ticket:', err);
  }
}

function renderActivitiesTimeline(activities) {
  const container = document.getElementById('timelineContainer');
  if (!container) return;

  if (activities.length === 0) {
    container.innerHTML = `
      <div class="text-center py-4 text-slate-400 text-xs">
        Belum ada catatan aktivitas pada tiket ini.
      </div>
    `;
    return;
  }

  let html = '';
  activities.forEach(act => {
    let icon = 'message-circle';
    let badgeColor = 'bg-slate-100 text-slate-600 border border-slate-200';

    if (act.action_type === 'created') {
      icon = 'plus';
    } else if (act.action_type === 'status_change') {
      icon = 'refresh-cw';
    } else if (act.action_type === 'assignment') {
      icon = 'user-check';
    } else if (act.action_type === 'resolved') {
      icon = 'check';
      badgeColor = 'bg-slate-900 text-white';
    }

    const isAdmin = act.author_role === 'admin' || act.author_role === 'system';

    html += `
      <div class="flex space-x-2.5 text-xs">
        <div class="w-6 h-6 rounded-full ${isAdmin ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-700'} flex items-center justify-center shrink-0 mt-0.5 text-xs">
          <i data-lucide="${icon}" class="w-3.5 h-3.5"></i>
        </div>
        <div class="flex-1 bg-white p-2.5 rounded-lg border border-slate-200">
          <div class="flex items-center justify-between mb-1">
            <span class="font-bold text-slate-800 flex items-center space-x-1.5">
              <span>${escapeHtml(act.author_name)}</span>
              <span class="text-[9px] font-semibold uppercase px-1.5 py-0.2 rounded ${badgeColor}">
                ${act.author_role}
              </span>
            </span>
            <span class="text-[10px] text-slate-400">${formatDateTime(act.created_at)}</span>
          </div>
          <p class="text-slate-600 leading-relaxed whitespace-pre-line">${escapeHtml(act.message)}</p>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  lucide.createIcons();

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

// Admin: Save CRUD update
async function handleSaveAdminUpdate() {
  if (!currentDetailTicket) return;

  const status = document.getElementById('updateStatusSelect').value;
  const priority = document.getElementById('updatePrioritySelect').value;
  const assigned_to = document.getElementById('updateAssigneeSelect').value;
  const resolution_notes = document.getElementById('updateResolutionNotes').value.trim();
  const internal_notes = document.getElementById('updateInternalNotes').value.trim();

  try {
    const res = await fetch(`/api/tickets/${currentDetailTicket.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        priority,
        assigned_to,
        resolution_notes,
        internal_notes,
        updated_by: 'IT Support Admin'
      })
    });
    const json = await res.json();
    if (json.success) {
      showToast('Perubahan berhasil disimpan!', 'success');
      await openDetailTicket(currentDetailTicket.id);
      loadAdminStats();
      fetchAdminTickets(false);
    } else {
      showToast(json.message || 'Gagal menyimpan perubahan', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan sistem', 'error');
  }
}

// Delete ticket (Admin CRUD)
function handleDeleteTicket() {
  if (!currentDetailTicket) return;
  quickDeleteTicket(currentDetailTicket.id, currentDetailTicket.ticket_number, true);
}

function quickDeleteTicket(ticketId, ticketNumber, fromModal = false) {
  Swal.fire({
    title: 'Hapus Tiket Ini?',
    text: `Tiket #${ticketNumber} akan dihapus secara permanen dari basis data.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#94a3b8',
    confirmButtonText: 'Ya, Hapus!',
    cancelButtonText: 'Batal'
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/tickets/${ticketId}`, { method: 'DELETE' });
        const json = await res.json();
        if (json.success) {
          showToast('Tiket berhasil dihapus', 'success');
          if (fromModal) closeModal('modalDetailTicket');
          loadAdminDashboard();
        } else {
          showToast(json.message || 'Gagal menghapus tiket', 'error');
        }
      } catch (err) {
        showToast('Gagal menghapus tiket', 'error');
      }
    }
  });
}

// Add comment / chat
async function submitTicketComment() {
  if (!currentDetailTicket) return;

  const input = document.getElementById('inputCommentMessage');
  const message = input.value.trim();
  if (!message) return;

  const authorName = currentRole === 'admin' ? 'IT Support Officer' : (currentDetailTicket.requester_name || 'User');
  const authorRole = currentRole === 'admin' ? 'admin' : 'user';

  try {
    const res = await fetch(`/api/tickets/${currentDetailTicket.id}/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        author_name: authorName,
        author_role: authorRole,
        message: message,
        action_type: 'public_comment'
      })
    });
    const json = await res.json();
    if (json.success) {
      input.value = '';
      renderActivitiesTimeline(json.data);
    } else {
      showToast(json.message || 'Gagal mengirim komentar', 'error');
    }
  } catch (err) {
    showToast('Gagal mengirim pesan', 'error');
  }
}

function handleCommentKeyPress(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    submitTicketComment();
  }
}

// ==============================================================
// UTILITIES & HELPERS
// ==============================================================

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('hidden');
}

function exportCsv() {
  window.location.href = '/api/export-csv';
}

function resetSampleData() {
  Swal.fire({
    title: 'Reset ke Data Simulasi Awal?',
    text: 'Seluruh tiket saat ini akan dikembalikan ke data sampel contoh IT Support.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#0f172a',
    cancelButtonColor: '#94a3b8',
    confirmButtonText: 'Reset Data',
    cancelButtonText: 'Batal'
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        const res = await fetch('/api/reset-demo', { method: 'POST' });
        const json = await res.json();
        if (json.success) {
          showToast('Data demo berhasil direset!', 'success');
          loadAdminDashboard();
        }
      } catch (err) {
        showToast('Gagal mereset data', 'error');
      }
    }
  });
}

function getStatusBadge(status) {
  const color = getStatusColorClasses(status);
  return `<span class="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded ${color}">${status}</span>`;
}

function getStatusColorClasses(status) {
  switch (status) {
    case 'Open':
      return 'bg-slate-100 text-slate-700 border border-slate-200';
    case 'In Progress':
      return 'bg-slate-800 text-white';
    case 'Pending User':
      return 'bg-slate-50 text-slate-600 border border-slate-200';
    case 'Resolved':
      return 'bg-slate-900 text-white';
    case 'Closed':
      return 'bg-slate-100 text-slate-500 border border-slate-200';
    default:
      return 'bg-slate-100 text-slate-700 border border-slate-200';
  }
}

function getPriorityBadge(priority) {
  const color = getPriorityColorClasses(priority);
  return `<span class="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded ${color}">${priority}</span>`;
}

function getPriorityColorClasses(priority) {
  switch (priority) {
    case 'Critical':
      return 'text-red-700 bg-red-50 border border-red-200';
    case 'High':
      return 'text-amber-800 bg-amber-50 border border-amber-200';
    case 'Medium':
      return 'text-slate-700 bg-slate-100 border border-slate-200';
    case 'Low':
      return 'text-slate-500 bg-slate-50 border border-slate-200';
    default:
      return 'text-slate-600 bg-slate-50 border border-slate-200';
  }
}

function getCategoryIcon(cat) {
  switch (cat) {
    case 'Hardware': return 'laptop';
    case 'Software': return 'app-window';
    case 'Jaringan & Internet': return 'wifi';
    case 'Akun & Hak Akses': return 'key-round';
    case 'Printer & Scanner': return 'printer';
    case 'Email & Komunikasi': return 'mail';
    default: return 'help-circle';
  }
}

function formatDateTime(str) {
  if (!str) return '-';
  try {
    const d = new Date(str);
    if (isNaN(d.getTime())) return str;
    return d.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return str;
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showToast(message, icon = 'info') {
  Swal.fire({
    toast: true,
    position: 'top-end',
    icon: icon,
    title: message,
    showConfirmButton: false,
    timer: 2500,
    timerProgressBar: true
  });
}
