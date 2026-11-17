// IT Support Console - Admin Dashboard Frontend Logic

let adminFilters = {
  status: 'All',
  priority: 'All',
  category: 'All',
  department: 'All',
  search: ''
};

let adminSearchTimeout = null;
let currentDetailTicket = null;
let chartStatusInstance = null;
let chartCategoryInstance = null;
let metaData = null;
let currentAdmin = null;

document.addEventListener('DOMContentLoaded', async () => {
  lucide.createIcons();

  // ── Auth guard ──────────────────────────────────────────────
  try {
    const meRes = await fetch('/api/auth/me');
    const meJson = await meRes.json();

    if (!meJson.success) {
      window.location.href = '/login';
      return;
    }

    if (meJson.data.role !== 'admin') {
      window.location.href = '/user';
      return;
    }

    currentAdmin = meJson.data;

    // Populate navbar
    const navName = document.getElementById('navAdminName');
    if (navName) navName.textContent = currentAdmin.full_name;
  } catch (e) {
    window.location.href = '/login';
    return;
  }

  await loadMetadata();
  await refreshAdminData();

  // Auto refresh every 30 seconds
  setInterval(() => {
    silentRefresh();
  }, 30000);
});

async function handleLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } finally {
    window.location.href = '/login';
  }
}

async function refreshAdminData() {
  const icon = document.getElementById('refreshIcon');
  if (icon) icon.classList.add('animate-spin');

  await loadAdminStats();
  await fetchAdminTickets(true);

  if (icon) {
    setTimeout(() => icon.classList.remove('animate-spin'), 500);
  }
}

async function silentRefresh() {
  await loadAdminStats();
  await fetchAdminTickets(false);
}

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
  const updateAssigneeSelect = document.getElementById('updateAssigneeSelect');
  const inputAssignedTo = document.getElementById('inputAssignedTo');

  if (updateAssigneeSelect && metaData.technicians) {
    const curr = updateAssigneeSelect.value;
    updateAssigneeSelect.innerHTML = '<option value="Belum Ditugaskan">-- Belum Ditugaskan --</option>';
    metaData.technicians.forEach(t => {
      updateAssigneeSelect.innerHTML += `<option value="${t}">${t}</option>`;
    });
    updateAssigneeSelect.value = curr || 'Belum Ditugaskan';
  }

  if (inputAssignedTo && metaData.technicians) {
    inputAssignedTo.innerHTML = '<option value="Belum Ditugaskan">-- Belum Ditugaskan --</option>';
    metaData.technicians.forEach(t => {
      inputAssignedTo.innerHTML += `<option value="${t}">${t}</option>`;
    });
  }
}

async function loadAdminStats() {
  try {
    const res = await fetch('/api/stats');
    if (res.status === 401 || res.status === 403) { window.location.href = '/login'; return; }
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
    if (res.status === 401 || res.status === 403) { window.location.href = '/login'; return; }
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
        <td colspan="8" class="text-center py-10 text-slate-400">
          <i data-lucide="inbox" class="w-6 h-6 mx-auto text-slate-300 mb-2"></i>
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

    html += `
      <tr class="hover:bg-slate-50 transition border-b border-slate-100">
        
        <!-- No. Tiket -->
        <td class="py-2.5 px-3 font-mono font-bold text-slate-800">
          <button onclick="openDetailTicket(${ticket.id})" class="hover:text-slate-600 underline decoration-slate-300 transition">
            #${ticket.ticket_number}
          </button>
        </td>

        <!-- Pelapor & Dept -->
        <td class="py-2.5 px-3">
          <div class="font-medium text-slate-800">${escapeHtml(ticket.requester_name)}</div>
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
      showToast('Status berhasil diubah', 'success');
      loadAdminStats();
    } else {
      showToast(json.message || 'Gagal mengubah status', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan jaringan', 'error');
  }
}

// Modal Create Manual Ticket
function openCreateTicketModal() {
  document.getElementById('formCreateTicket').reset();
  document.getElementById('modalCreateTicket').classList.remove('hidden');
  lucide.createIcons();
}

async function handleCreateTicketSubmit(event) {
  event.preventDefault();
  const btn = document.getElementById('btnSubmitTicket');
  btn.disabled = true;
  btn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i><span>Menyimpan...</span>`;
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
  formData.append('author_role', 'admin');

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
      showToast('Tiket manual berhasil dibuat!', 'success');
      refreshAdminData();
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Gagal Membuat Tiket',
        text: json.message || 'Mohon lengkapi formulir.',
        confirmButtonColor: '#0f172a'
      });
    }
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'Kesalahan Sistem',
      text: err.message,
      confirmButtonColor: '#0f172a'
    });
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="plus" class="w-3.5 h-3.5"></i><span>Simpan Tiket</span>`;
    lucide.createIcons();
  }
}

// Modal Manage Ticket (CRUD)
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

    document.getElementById('detailTicketNumber').textContent = `#${ticket.ticket_number}`;
    document.getElementById('detailSubject').textContent = ticket.subject;

    const priorityBadge = document.getElementById('detailPriorityBadge');
    priorityBadge.className = `text-[11px] px-2 py-0.2 rounded font-medium ${getPriorityColorClasses(ticket.priority)}`;
    priorityBadge.textContent = ticket.priority;

    const statusBadge = document.getElementById('detailStatusBadge');
    statusBadge.className = `text-[11px] px-2 py-0.2 rounded font-medium ${getStatusColorClasses(ticket.status)}`;
    statusBadge.textContent = ticket.status;

    document.getElementById('detailRequester').textContent = ticket.requester_name;
    document.getElementById('detailDepartment').textContent = ticket.department;
    document.getElementById('detailContact').textContent = ticket.requester_phone || ticket.requester_email || '-';
    document.getElementById('detailLocation').textContent = ticket.location || 'Tidak dicantumkan';
    document.getElementById('detailCategory').textContent = ticket.category;
    document.getElementById('detailCreatedAt').textContent = `Dibuat: ${formatDateTime(ticket.created_at)}`;
    document.getElementById('detailAssignee').textContent = ticket.assigned_to;
    document.getElementById('detailResolvedAt').textContent = ticket.resolved_at ? `Selesai: ${formatDateTime(ticket.resolved_at)}` : '';

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
            <img src="${ticket.attachment}" alt="Bukti Masalah" class="max-h-48 rounded object-cover">
          </a>
        `;
      } else {
        attContent.innerHTML = `
          <a href="${ticket.attachment}" target="_blank" class="inline-flex items-center space-x-1.5 text-slate-700 hover:text-slate-900 font-medium text-xs bg-slate-50 px-2.5 py-1.5 rounded border border-slate-200">
            <i data-lucide="file" class="w-3.5 h-3.5 text-slate-500"></i>
            <span>Buka Lampiran</span>
          </a>
        `;
      }
    } else {
      attContainer.classList.add('hidden');
    }

    // Populate CRUD Update form
    document.getElementById('updateStatusSelect').value = ticket.status;
    document.getElementById('updatePrioritySelect').value = ticket.priority;
    document.getElementById('updateAssigneeSelect').value = ticket.assigned_to;
    document.getElementById('updateResolutionNotes').value = ticket.resolution_notes || '';
    document.getElementById('updateInternalNotes').value = ticket.internal_notes || '';

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
      <div class="text-center py-3 text-slate-400 text-xs">
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
      <div class="flex space-x-2 text-xs">
        <div class="w-6 h-6 rounded-full ${isAdmin ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-700'} flex items-center justify-center shrink-0 mt-0.5 text-xs">
          <i data-lucide="${icon}" class="w-3 h-3"></i>
        </div>
        <div class="flex-1 bg-white p-2.5 rounded-lg border border-slate-200">
          <div class="flex items-center justify-between mb-1">
            <span class="font-semibold text-slate-800 flex items-center space-x-1">
              <span>${escapeHtml(act.author_name)}</span>
              <span class="text-[9px] uppercase px-1.5 py-0.2 rounded font-medium ${badgeColor}">
                ${isAdmin ? 'IT Support' : 'Pelapor'}
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
  container.scrollTop = container.scrollHeight;
}

// Save Admin CRUD Update
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
    text: `Tiket #${ticketNumber} akan dihapus secara permanen.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#94a3b8',
    confirmButtonText: 'Ya, Hapus',
    cancelButtonText: 'Batal'
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/tickets/${ticketId}`, { method: 'DELETE' });
        const json = await res.json();
        if (json.success) {
          showToast('Tiket berhasil dihapus', 'success');
          if (fromModal) closeModal('modalDetailTicket');
          refreshAdminData();
        } else {
          showToast(json.message || 'Gagal menghapus tiket', 'error');
        }
      } catch (err) {
        showToast('Gagal menghapus tiket', 'error');
      }
    }
  });
}

// Add comment to ticket
async function submitTicketComment() {
  if (!currentDetailTicket) return;

  const input = document.getElementById('inputCommentMessage');
  const message = input.value.trim();
  if (!message) return;

  try {
    const res = await fetch(`/api/tickets/${currentDetailTicket.id}/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        author_name: 'IT Support Officer',
        author_role: 'admin',
        message: message,
        action_type: 'public_comment'
      })
    });
    const json = await res.json();
    if (json.success) {
      input.value = '';
      renderActivitiesTimeline(json.data);
    } else {
      showToast(json.message || 'Gagal mengirim tanggapan', 'error');
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

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('hidden');
}

function exportCsv() {
  window.location.href = '/api/export-csv';
}

function resetSampleData() {
  Swal.fire({
    title: 'Reset ke Data Simulasi?',
    text: 'Seluruh data tiket akan dikembalikan ke kondisi awal contoh.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#0f172a',
    cancelButtonColor: '#94a3b8',
    confirmButtonText: 'Reset Sekarang',
    cancelButtonText: 'Batal'
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        const res = await fetch('/api/reset-demo', { method: 'POST' });
        const json = await res.json();
        if (json.success) {
          showToast('Data berhasil direset!', 'success');
          refreshAdminData();
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
    timer: 2000,
    timerProgressBar: true
  });
}
