// IT Helpdesk - User Portal Frontend Logic

let userFilterStatus = 'All';
let userSearchTimeout = null;
let currentDetailTicket = null;
let currentUser = null;

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

    if (meJson.data.role === 'admin') {
      window.location.href = '/admin';
      return;
    }

    currentUser = meJson.data;

    // Populate navbar
    const navName = document.getElementById('navUserName');
    const navDept = document.getElementById('navUserDept');
    if (navName) navName.textContent = currentUser.full_name;
    if (navDept) navDept.textContent = currentUser.department || 'Karyawan';
  } catch (e) {
    window.location.href = '/login';
    return;
  }

  await fetchUserTickets(true);

  // Auto refresh every 30 seconds
  setInterval(() => {
    fetchUserTickets(false);
  }, 30000);
});

async function handleLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } finally {
    window.location.href = '/login';
  }
}

async function fetchUserTickets(showLoading = true) {
  const container = document.getElementById('userTicketsList');
  const refreshIcon = document.getElementById('refreshIcon');
  if (refreshIcon) refreshIcon.classList.add('animate-spin');

  if (showLoading && container) {
    container.innerHTML = `
      <div class="p-10 text-center text-slate-400">
        <i data-lucide="loader-2" class="w-5 h-5 animate-spin mx-auto text-slate-400 mb-2"></i>
        <p class="text-xs">Memuat data tiket...</p>
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
    if (res.status === 401) { window.location.href = '/login'; return; }
    const json = await res.json();
    if (json.success) {
      renderUserTickets(json.data);
      updateUserCounters();
    }
  } catch (err) {
    console.error('Error fetching user tickets:', err);
    if (container) {
      container.innerHTML = `
        <div class="p-8 text-center text-red-500 text-xs">
          Gagal mengambil data tiket. Pastikan server aktif.
        </div>
      `;
    }
  } finally {
    if (refreshIcon) {
      setTimeout(() => refreshIcon.classList.remove('animate-spin'), 500);
    }
  }
}

function renderUserTickets(tickets) {
  const container = document.getElementById('userTicketsList');
  if (!container) return;

  if (tickets.length === 0) {
    container.innerHTML = `
      <div class="p-10 text-center space-y-2.5">
        <div class="w-10 h-10 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
          <i data-lucide="inbox" class="w-5 h-5"></i>
        </div>
        <p class="text-xs font-semibold text-slate-700">Belum ada tiket pada kategori ini</p>
        <p class="text-[11px] text-slate-400">Silakan ajukan tiket baru bila Anda mengalami kendala komputer atau jaringan.</p>
        <button onclick="openCreateTicketModal()" class="inline-flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs px-3.5 py-1.5 rounded-lg transition">
          <i data-lucide="plus" class="w-3.5 h-3.5"></i>
          <span>Ajukan Tiket Sekarang</span>
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
          <button onclick="event.stopPropagation(); openDetailTicket(${ticket.id})" class="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition shadow-2xs">
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

async function updateUserCounters() {
  try {
    const res = await fetch('/api/tickets');
    if (res.status === 401) { window.location.href = '/login'; return; }
    const json = await res.json();
    if (json.success) {
      const all = json.data;
      const total = all.length;
      const open = all.filter(t => t.status === 'Open').length;
      const inProgress = all.filter(t => t.status === 'In Progress').length;
      const resolved = all.filter(t => t.status === 'Resolved' || t.status === 'Closed').length;

      document.getElementById('userTotalTickets').textContent = total;
      document.getElementById('userOpenTickets').textContent = open;
      document.getElementById('userInProgressTickets').textContent = inProgress;
      document.getElementById('userResolvedTickets').textContent = resolved;
    }
  } catch (err) {
    console.error('Error updating user counters:', err);
  }
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

// Modal Create Ticket
function openCreateTicketModal() {
  document.getElementById('formCreateTicket').reset();

  // Tampilkan info pelapor dari session (read-only di form)
  if (currentUser) {
    const nameEl = document.getElementById('formUserName');
    const metaEl = document.getElementById('formUserMeta');
    if (nameEl) nameEl.textContent = currentUser.full_name;
    if (metaEl) metaEl.textContent = `${currentUser.department || '—'}  ·  ${currentUser.email}`;
  }

  document.getElementById('modalCreateTicket').classList.remove('hidden');
  lucide.createIcons();
}

async function handleCreateTicketSubmit(event) {
  event.preventDefault();
  const btn = document.getElementById('btnSubmitTicket');
  btn.disabled = true;
  btn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i><span>Mengirim...</span>`;
  lucide.createIcons();

  const formData = new FormData();
  // Nama, email, dept dari session — server akan pakai data session
  // User hanya perlu isi: lokasi, kategori, prioritas, subjek, deskripsi
  formData.append('requester_name', currentUser?.full_name || '');
  formData.append('department', currentUser?.department || '');
  formData.append('requester_email', currentUser?.email || '');
  formData.append('requester_phone', currentUser?.phone || '');
  formData.append('location', document.getElementById('inputLocation').value.trim());
  formData.append('category', document.getElementById('inputCategory').value);
  formData.append('priority', document.getElementById('inputPriority').value);
  formData.append('subject', document.getElementById('inputSubject').value.trim());
  formData.append('description', document.getElementById('inputDescription').value.trim());

  const fileInput = document.getElementById('inputAttachment');
  if (fileInput.files.length > 0) {
    formData.append('attachment', fileInput.files[0]);
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
        title: 'Tiket Berhasil Diajukan',
        html: `Nomor Tiket Anda: <b class="text-slate-900 font-mono text-base">${json.data.ticket_number}</b><br><span class="text-xs text-slate-500">Tim IT Support telah diberitahu dan akan segera menangani kendala Anda.</span>`,
        confirmButtonColor: '#0f172a'
      });
      fetchUserTickets(true);
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Gagal Membuat Tiket',
        text: json.message || 'Mohon lengkapi isian formulir.',
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
    btn.innerHTML = `<i data-lucide="send" class="w-3.5 h-3.5"></i><span>Kirim Tiket</span>`;
    lucide.createIcons();
  }
}

// Modal Detail Ticket
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

    // Solusi IT
    const userResView = document.getElementById('userResolutionView');
    if (ticket.resolution_notes && (ticket.status === 'Resolved' || ticket.status === 'Closed')) {
      userResView.classList.remove('hidden');
      document.getElementById('userResolutionText').textContent = ticket.resolution_notes;
    } else {
      userResView.classList.add('hidden');
    }

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
        author_name: currentDetailTicket.requester_name || 'Pelapor',
        author_role: 'user',
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

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('hidden');
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
