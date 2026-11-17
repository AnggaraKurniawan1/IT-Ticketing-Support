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
  startLiveClock();

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

  // Keyboard shortcut: '/' focuses search input
  window.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      document.getElementById('adminSearchInput')?.focus();
    }
  });

  // Auto refresh every 30 seconds
  setInterval(() => {
    silentRefresh();
  }, 30000);
});

function startLiveClock() {
  const clockEl = document.getElementById('liveClock');
  const update = () => {
    if (!clockEl) return;
    const now = new Date();
    clockEl.textContent = `${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} WIB`;
  };
  update();
  setInterval(update, 1000);
}

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
  // 1. Status Chart (Doughnut with Tasteful Semantic Palette)
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
        labels: ['Open (Antrian)', 'In Progress (Diproses)', 'Resolved (Selesai)', 'Closed (Ditutup)'],
        datasets: [{
          data: data,
          backgroundColor: [
            '#f59e0b', // Amber-500
            '#0ea5e9', // Sky-500
            '#10b981', // Emerald-500
            '#64748b'  // Slate-500
          ],
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 4
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
              boxHeight: 8,
              usePointStyle: true,
              font: { size: 10, family: "'Plus Jakarta Sans', sans-serif", weight: '500' },
              padding: 12
            }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            titleFont: { size: 11, family: "'Plus Jakarta Sans', sans-serif" },
            bodyFont: { size: 11, family: "'Plus Jakarta Sans', sans-serif" },
            padding: 10,
            cornerRadius: 8
          }
        },
        cutout: '70%'
      }
    });
  }

  // 2. Category Chart (Bar Chart with Rounded Corners)
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
          backgroundColor: '#0f172a',
          hoverBackgroundColor: '#334155',
          borderRadius: 6,
          barThickness: 24
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            padding: 8,
            cornerRadius: 8
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1, font: { size: 10, family: "'Plus Jakarta Sans', sans-serif" } },
            grid: { color: '#f1f5f9' },
            border: { dash: [4, 4] }
          },
          x: {
            ticks: {
              font: { size: 10, family: "'Plus Jakarta Sans', sans-serif" },
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
        <td colspan="8" class="text-center py-12 text-brand-400">
          <i data-lucide="loader-2" class="w-6 h-6 animate-spin mx-auto text-brand-400 mb-2"></i>
          <p class="text-xs font-medium">Memuat data tiket admin...</p>
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
          <td colspan="8" class="text-center py-8 text-rose-500 font-medium">
            Gagal mengambil data tiket admin. Pastikan server aktif.
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
        <td colspan="8" class="text-center py-12 text-brand-400">
          <i data-lucide="inbox" class="w-8 h-8 mx-auto text-brand-300 mb-2"></i>
          <p class="text-xs font-semibold text-brand-700">Tidak ada tiket yang sesuai dengan filter.</p>
          <p class="text-[11px] text-brand-400 mt-0.5">Ubah kata kunci pencarian atau sesuaikan filter di atas.</p>
        </td>
      </tr>
    `;
    lucide.createIcons();
    return;
  }

  let html = '';
  tickets.forEach(ticket => {
    const priorityBadge = getPriorityBadge(ticket.priority);
    const hasAssignee = ticket.assigned_to && ticket.assigned_to !== 'Belum Ditugaskan';

    html += `
      <tr class="hover:bg-brand-50/70 transition-colors border-b border-brand-100 group">
        
        <!-- No. Tiket -->
        <td class="py-3 px-3.5 whitespace-nowrap">
          <button onclick="openDetailTicket(${ticket.id})" class="font-mono text-xs font-bold text-brand-950 hover:text-brand-700 bg-brand-100 hover:bg-brand-200 px-2 py-0.5 rounded-md border border-brand-200 transition">
            #${ticket.ticket_number}
          </button>
        </td>

        <!-- Pelapor & Dept -->
        <td class="py-3 px-3.5">
          <div class="flex items-center gap-2">
            <div class="w-6 h-6 rounded-full bg-brand-200 text-brand-800 font-bold text-[10px] flex items-center justify-center shrink-0">
              ${getInitials(ticket.requester_name)}
            </div>
            <div class="min-w-0">
              <div class="font-bold text-brand-950 truncate">${escapeHtml(ticket.requester_name)}</div>
              <div class="text-[10px] text-brand-400 truncate">${escapeHtml(ticket.department)}</div>
            </div>
          </div>
        </td>

        <!-- Subjek & Kategori -->
        <td class="py-3 px-3.5 max-w-xs">
          <div class="font-semibold text-brand-950 truncate hover:text-brand-800 cursor-pointer" onclick="openDetailTicket(${ticket.id})" title="${escapeHtml(ticket.subject)}">
            ${escapeHtml(ticket.subject)}
          </div>
          <div class="text-[10px] text-brand-500 font-medium flex items-center gap-1 mt-0.5">
            <span class="w-1.5 h-1.5 rounded-full bg-brand-400"></span>
            <span>${ticket.category}</span>
          </div>
        </td>

        <!-- Prioritas -->
        <td class="py-3 px-3.5 whitespace-nowrap">
          ${priorityBadge}
        </td>

        <!-- Quick Status Selector -->
        <td class="py-3 px-3.5 whitespace-nowrap">
          <select 
            onchange="handleQuickStatusChange(${ticket.id}, this.value)" 
            class="text-[11px] font-semibold py-1 px-2 rounded-lg border border-brand-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-900/10 focus:border-brand-900 transition shadow-2xs ${getStatusSelectColor(ticket.status)}"
          >
            <option value="Open" ${ticket.status === 'Open' ? 'selected' : ''}>● Open</option>
            <option value="In Progress" ${ticket.status === 'In Progress' ? 'selected' : ''}>● In Progress</option>
            <option value="Pending User" ${ticket.status === 'Pending User' ? 'selected' : ''}>● Pending User</option>
            <option value="Resolved" ${ticket.status === 'Resolved' ? 'selected' : ''}>✓ Resolved</option>
            <option value="Closed" ${ticket.status === 'Closed' ? 'selected' : ''}>Closed</option>
          </select>
        </td>

        <!-- Teknisi -->
        <td class="py-3 px-3.5 whitespace-nowrap">
          <span class="text-xs ${hasAssignee ? 'font-semibold text-brand-800' : 'text-brand-400 italic'}">
            ${escapeHtml(ticket.assigned_to)}
          </span>
        </td>

        <!-- Waktu Masuk -->
        <td class="py-3 px-3.5 whitespace-nowrap text-[11px] text-brand-400 font-mono">
          ${formatDateTime(ticket.created_at)}
        </td>

        <!-- Action Buttons (CRUD) -->
        <td class="py-3 px-3.5 whitespace-nowrap text-center">
          <div class="flex items-center justify-center space-x-1">
            <button 
              onclick="openDetailTicket(${ticket.id})" 
              title="Kelola & Edit Tiket" 
              class="p-1.5 text-brand-600 hover:text-brand-950 hover:bg-brand-100 rounded-lg transition"
            >
              <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
            </button>
            <button 
              onclick="quickDeleteTicket(${ticket.id}, '${ticket.ticket_number}')" 
              title="Hapus Tiket" 
              class="p-1.5 text-brand-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
            >
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

function getStatusSelectColor(status) {
  switch (status) {
    case 'Open': return 'text-amber-800 bg-amber-50/50 border-amber-200';
    case 'In Progress': return 'text-sky-800 bg-sky-50/50 border-sky-200';
    case 'Pending User': return 'text-purple-800 bg-purple-50/50 border-purple-200';
    case 'Resolved': return 'text-emerald-800 bg-emerald-50/50 border-emerald-200';
    default: return 'text-brand-700 bg-white';
  }
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
  }, 300);
}

async function handleQuickStatusChange(ticketId, newStatus) {
  try {
    const res = await fetch(`/api/tickets/${ticketId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: newStatus,
        updated_by: currentAdmin?.full_name || 'IT Support Admin'
      })
    });
    const json = await res.json();
    if (json.success) {
      showToast(`Status berhasil diubah ke ${newStatus}`, 'success');
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
    btn.innerHTML = `<i data-lucide="plus" class="w-3.5 h-3.5"></i><span>Simpan Tiket Manual</span>`;
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
    priorityBadge.className = `text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider ${getPriorityColorClasses(ticket.priority)}`;
    priorityBadge.textContent = ticket.priority;

    const statusBadge = document.getElementById('detailStatusBadge');
    statusBadge.className = `text-[10px] px-2 py-0.5 rounded font-semibold ${getStatusColorClasses(ticket.status)}`;
    statusBadge.textContent = ticket.status;

    document.getElementById('detailRequester').textContent = ticket.requester_name;
    document.getElementById('detailDepartment').textContent = ticket.department;
    document.getElementById('detailContact').textContent = ticket.requester_phone || ticket.requester_email || '-';
    document.getElementById('detailLocation').textContent = ticket.location || 'Tidak dicantumkan';
    document.getElementById('detailCategory').textContent = ticket.category;
    document.getElementById('detailCreatedAt').textContent = `${formatDateTime(ticket.created_at)}`;
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
          <a href="${ticket.attachment}" target="_blank" class="block group relative rounded-xl overflow-hidden border border-brand-200">
            <img src="${ticket.attachment}" alt="Bukti Masalah" class="max-h-48 rounded object-cover">
          </a>
        `;
      } else {
        attContent.innerHTML = `
          <a href="${ticket.attachment}" target="_blank" class="inline-flex items-center space-x-1.5 text-brand-800 hover:text-brand-950 font-semibold text-xs bg-white px-3 py-2 rounded-lg border border-brand-200 shadow-2xs">
            <i data-lucide="file-text" class="w-4 h-4 text-brand-500"></i>
            <span>Buka Berkas Lampiran</span>
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
      <div class="text-center py-4 text-brand-400 text-xs">
        Belum ada catatan aktivitas pada tiket ini.
      </div>
    `;
    return;
  }

  let html = '';
  activities.forEach(act => {
    let icon = 'message-square';
    const isAdmin = act.author_role === 'admin' || act.author_role === 'system';

    if (act.action_type === 'created') icon = 'plus-circle';
    else if (act.action_type === 'status_change') icon = 'refresh-cw';
    else if (act.action_type === 'assignment') icon = 'user-check';
    else if (act.action_type === 'resolved') icon = 'check-circle-2';

    html += `
      <div class="flex space-x-2.5 text-xs">
        <div class="w-7 h-7 rounded-lg ${isAdmin ? 'bg-brand-900 text-white' : 'bg-brand-200 text-brand-800'} flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold shadow-2xs">
          <i data-lucide="${icon}" class="w-3.5 h-3.5"></i>
        </div>
        <div class="flex-1 bg-white p-3 rounded-xl border border-brand-200 shadow-2xs">
          <div class="flex items-center justify-between mb-1">
            <span class="font-bold text-brand-950 flex items-center space-x-1.5">
              <span>${escapeHtml(act.author_name)}</span>
              <span class="text-[9px] uppercase px-1.5 py-0.2 rounded font-semibold ${isAdmin ? 'bg-brand-900 text-white' : 'bg-brand-100 text-brand-700'}">
                ${isAdmin ? 'IT Support' : 'Pelapor'}
              </span>
            </span>
            <span class="text-[10px] text-brand-400 font-mono">${formatDateTime(act.created_at)}</span>
          </div>
          <p class="text-brand-700 leading-relaxed whitespace-pre-line text-xs">${escapeHtml(act.message)}</p>
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
        updated_by: currentAdmin?.full_name || 'IT Support Admin'
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
    confirmButtonColor: '#e11d48',
    cancelButtonColor: '#94a3b8',
    confirmButtonText: 'Ya, Hapus Permanen',
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
        author_name: currentAdmin?.full_name || 'IT Support Lead',
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
    title: 'Reset ke Data Simulasi Awal?',
    text: 'Seluruh riwayat tiket akan dikembalikan ke data simulasi default.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#0f172a',
    cancelButtonColor: '#94a3b8',
    confirmButtonText: 'Ya, Reset Data',
    cancelButtonText: 'Batal'
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        const res = await fetch('/api/reset-demo', { method: 'POST' });
        const json = await res.json();
        if (json.success) {
          showToast('Data simulasi berhasil direset!', 'success');
          refreshAdminData();
        }
      } catch (err) {
        showToast('Gagal mereset data', 'error');
      }
    }
  });
}

// ── SEMANTIC COLOR & BADGE HELPERS (ANTI-SLOP) ────────────────
function getStatusBadge(status) {
  switch (status) {
    case 'Open':
      return `<span class="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
        <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
        <span>Open</span>
      </span>`;
    case 'In Progress':
      return `<span class="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200">
        <span class="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"></span>
        <span>In Progress</span>
      </span>`;
    case 'Pending User':
      return `<span class="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200">
        <span class="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
        <span>Pending User</span>
      </span>`;
    case 'Resolved':
      return `<span class="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        <span>Resolved</span>
      </span>`;
    case 'Closed':
      return `<span class="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-brand-100 text-brand-600 border border-brand-200">
        <span>Closed</span>
      </span>`;
    default:
      return `<span class="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded bg-brand-100 text-brand-700">${status}</span>`;
  }
}

function getStatusColorClasses(status) {
  switch (status) {
    case 'Open': return 'bg-amber-50 text-amber-800 border border-amber-200';
    case 'In Progress': return 'bg-sky-50 text-sky-800 border border-sky-200';
    case 'Pending User': return 'bg-purple-50 text-purple-800 border border-purple-200';
    case 'Resolved': return 'bg-emerald-50 text-emerald-800 border border-emerald-200';
    case 'Closed': return 'bg-brand-100 text-brand-600 border border-brand-200';
    default: return 'bg-brand-100 text-brand-700 border border-brand-200';
  }
}

function getPriorityBadge(priority) {
  switch (priority) {
    case 'Critical':
      return `<span class="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wider">
        <i data-lucide="alert-octagon" class="w-3 h-3"></i>
        <span>Critical</span>
      </span>`;
    case 'High':
      return `<span class="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wider">
        <span>High</span>
      </span>`;
    case 'Medium':
      return `<span class="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-md bg-brand-100 text-brand-700 border border-brand-200">
        <span>Medium</span>
      </span>`;
    case 'Low':
      return `<span class="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-md bg-brand-50 text-brand-500 border border-brand-200">
        <span>Low</span>
      </span>`;
    default:
      return `<span class="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-md bg-brand-50 text-brand-600">${priority}</span>`;
  }
}

function getPriorityColorClasses(priority) {
  switch (priority) {
    case 'Critical': return 'text-rose-700 bg-rose-50 border border-rose-200';
    case 'High': return 'text-amber-700 bg-amber-50 border border-amber-200';
    case 'Medium': return 'text-brand-700 bg-brand-100 border border-brand-200';
    case 'Low': return 'text-brand-500 bg-brand-50 border border-brand-200';
    default: return 'text-brand-600 bg-brand-50 border border-brand-200';
  }
}

function getInitials(name) {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
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
