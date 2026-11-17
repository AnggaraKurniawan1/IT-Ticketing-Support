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

    // Populate navbar & user identity
    const navName = document.getElementById('navUserName');
    const navDept = document.getElementById('navUserDept');
    const userInitials = document.getElementById('userAvatarInitials');
    
    if (navName) navName.textContent = currentUser.full_name;
    if (navDept) navDept.textContent = currentUser.department || 'Karyawan';
    if (userInitials) {
      userInitials.textContent = getInitials(currentUser.full_name);
    }
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
      <div class="p-12 text-center text-slate-400">
        <i data-lucide="loader-2" class="w-6 h-6 animate-spin mx-auto text-slate-400 mb-2"></i>
        <p class="text-xs font-medium">Memuat data tiket...</p>
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
      <div class="p-12 text-center space-y-3">
        <div class="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
          <i data-lucide="inbox" class="w-6 h-6"></i>
        </div>
        <div>
          <h4 class="text-sm font-bold text-slate-900">Belum Ada Tiket pada Kategori Ini</h4>
          <p class="text-[11px] text-slate-500 mt-0.5">Semua kendala yang Anda laporkan akan tercatat rapi di sini.</p>
        </div>
        <button onclick="openCreateTicketModal()" class="inline-flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-4 py-2 rounded-xl transition shadow-sm">
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
    const hasAssignee = ticket.assigned_to && ticket.assigned_to !== 'Belum Ditugaskan';

    html += `
      <div class="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 cursor-pointer group" onclick="openDetailTicket(${ticket.id})">
        
        <div class="space-y-1.5 flex-1 min-w-0">
          
          <!-- Badges Bar -->
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-mono text-[11px] font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
              #${ticket.ticket_number}
            </span>
            ${statusBadge}
            ${priorityBadge}
            <span class="text-slate-500 text-[11px] font-medium flex items-center gap-1">
              <i data-lucide="tag" class="w-3 h-3 text-slate-400"></i>
              ${ticket.category}
            </span>
          </div>

          <!-- Subject -->
          <h3 class="text-xs sm:text-sm font-bold text-slate-950 group-hover:text-slate-800 transition line-clamp-1">
            ${escapeHtml(ticket.subject)}
          </h3>

          <!-- Description snippet -->
          <p class="text-xs text-slate-500 line-clamp-1 leading-relaxed">
            ${escapeHtml(ticket.description)}
          </p>

          <!-- Footer Metadata -->
          <div class="flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] text-slate-400 pt-0.5">
            <span class="flex items-center gap-1">
              <i data-lucide="calendar" class="w-3 h-3"></i>
              <span>${formatDateTime(ticket.created_at)}</span>
            </span>
            <span>•</span>
            <span class="flex items-center gap-1">
              <i data-lucide="map-pin" class="w-3 h-3"></i>
              <span>${escapeHtml(ticket.location || 'Ruang Kerja')}</span>
            </span>
            <span>•</span>
            <span class="flex items-center gap-1.5 ${hasAssignee ? 'text-slate-700 font-semibold' : 'text-slate-400'}">
              <i data-lucide="user-check" class="w-3 h-3"></i>
              <span>Teknisi: ${escapeHtml(ticket.assigned_to)}</span>
            </span>
          </div>

        </div>

        <!-- Action / Arrow -->
        <div class="flex items-center space-x-2 shrink-0 self-end sm:self-center">
          <span class="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white group-hover:bg-slate-900 group-hover:text-white group-hover:border-slate-900 text-slate-700 text-xs font-semibold transition">
            <span>Detail</span>
            <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition"></i>
          </span>
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
        btn.className = 'px-2.5 py-1 rounded-md bg-white shadow-2xs text-slate-950 font-bold transition';
      } else {
        btn.className = 'px-2.5 py-1 rounded-md text-slate-600 hover:text-slate-950 transition';
      }
    }
  });

  fetchUserTickets(true);
}

function debounceUserSearch() {
  clearTimeout(userSearchTimeout);
  userSearchTimeout = setTimeout(() => {
    fetchUserTickets(true);
  }, 300);
}

// Modal Create Ticket
function openCreateTicketModal() {
  document.getElementById('formCreateTicket').reset();

  // Tampilkan info pelapor dari session (read-only di form)
  if (currentUser) {
    const nameEl = document.getElementById('formUserName');
    const metaEl = document.getElementById('formUserMeta');
    const avatarEl = document.getElementById('formUserAvatar');
    
    if (nameEl) nameEl.textContent = currentUser.full_name;
    if (metaEl) metaEl.textContent = `${currentUser.department || 'Karyawan'}  •  ${currentUser.email}`;
    if (avatarEl) avatarEl.textContent = getInitials(currentUser.full_name);
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
        html: `Nomor Tiket Anda: <b class="text-slate-950 font-mono text-base">${json.data.ticket_number}</b><br><span class="text-xs text-slate-500">Tim IT Support telah diberitahu dan akan segera menangani kendala Anda.</span>`,
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
    btn.innerHTML = `<i data-lucide="send" class="w-3.5 h-3.5"></i><span>Kirim Tiket ke IT</span>`;
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

    const elNum = document.getElementById('detailTicketNumber');
    if (elNum) elNum.textContent = `#${ticket.ticket_number}`;

    const elSub = document.getElementById('detailSubject');
    if (elSub) elSub.textContent = ticket.subject;

    const elCat = document.getElementById('detailCategory');
    if (elCat) elCat.textContent = ticket.category;

    const elDate = document.getElementById('detailCreatedAt');
    if (elDate) elDate.textContent = formatDateTime(ticket.created_at);

    const elLoc = document.getElementById('detailLocation');
    if (elLoc) elLoc.textContent = ticket.location || 'Tidak dicantumkan';

    const elDesc = document.getElementById('detailDescription');
    if (elDesc) elDesc.textContent = ticket.description;

    const elAssignee = document.getElementById('detailAssignedTo');
    if (elAssignee) elAssignee.textContent = ticket.assigned_to || 'Belum Ditugaskan';

    const priorityBadge = document.getElementById('detailPriorityBadge');
    if (priorityBadge) {
      priorityBadge.className = `text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider ${getPriorityColorClasses(ticket.priority)}`;
      priorityBadge.textContent = ticket.priority;
    }

    const statusBadge = document.getElementById('detailStatusBadge');
    if (statusBadge) {
      statusBadge.className = `text-[10px] px-2 py-0.5 rounded font-semibold ${getStatusColorClasses(ticket.status)}`;
      statusBadge.textContent = ticket.status;
    }

    // Attachment
    const attWrap = document.getElementById('detailAttachmentWrap');
    const attLink = document.getElementById('detailAttachmentLink');
    if (attWrap && attLink) {
      if (ticket.attachment) {
        attWrap.classList.remove('hidden');
        attLink.href = ticket.attachment;
        attLink.textContent = ticket.attachment.split('/').pop() || 'Buka Berkas Lampiran';
      } else {
        attWrap.classList.add('hidden');
      }
    }

    // Official Resolution Solution
    const solSection = document.getElementById('detailSolutionSection');
    const solNotes = document.getElementById('detailResolutionNotes');
    if (solSection && solNotes) {
      if (ticket.resolution_notes && (ticket.status === 'Resolved' || ticket.status === 'Closed')) {
        solSection.classList.remove('hidden');
        solNotes.textContent = ticket.resolution_notes;
      } else {
        solSection.classList.add('hidden');
      }
    }

    // Render Timeline / Activities
    renderActivitiesTimeline(ticket.activities || []);

    const modal = document.getElementById('modalDetailTicket');
    if (modal) modal.classList.remove('hidden');
    lucide.createIcons();
  } catch (err) {
    console.error('Error opening detail ticket:', err);
    showToast('Gagal memuat detail tiket', 'error');
  }
}

function renderActivitiesTimeline(activities) {
  const container = document.getElementById('detailActivitiesList') || document.getElementById('timelineContainer');
  if (!container) return;

  if (activities.length === 0) {
    container.innerHTML = `
      <div class="text-center py-4 text-slate-400 text-xs">
        Belum ada riwayat aktivitas pada tiket ini.
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
      <div class="flex items-start gap-2.5 p-2.5 rounded-lg ${isAdmin ? 'bg-slate-100/80 border border-slate-200' : 'bg-white border border-slate-200'} text-xs">
        <div class="w-6 h-6 rounded-md ${isAdmin ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'} flex items-center justify-center shrink-0 mt-0.5">
          <i data-lucide="${icon}" class="w-3.5 h-3.5"></i>
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-1.5">
              <span class="font-bold text-slate-900">${escapeHtml(act.author_name)}</span>
              <span class="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded ${isAdmin ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'}">
                ${act.author_role}
              </span>
            </div>
            <span class="text-[10px] text-slate-400 font-mono">${formatDateTime(act.created_at)}</span>
          </div>
          <div class="text-slate-700 mt-1 whitespace-pre-wrap leading-relaxed">${escapeHtml(act.message)}</div>
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

  const input = document.getElementById('inputComment') || document.getElementById('inputCommentMessage');
  if (!input) return;
  const message = input.value.trim();
  if (!message) return;

  try {
    const res = await fetch(`/api/tickets/${currentDetailTicket.id}/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        author_name: currentUser?.full_name || 'Pelapor',
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

// Alias for HTML button onclick="submitUserComment()"
function submitUserComment() {
  return submitTicketComment();
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

// ── RESTRAINED MINIMAL BADGES ────────────────────────────────
function getStatusBadge(status) {
  switch (status) {
    case 'Open':
      return `<span class="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300">
        Open
      </span>`;
    case 'In Progress':
      return `<span class="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
        In Progress
      </span>`;
    case 'Pending User':
      return `<span class="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
        Pending User
      </span>`;
    case 'Resolved':
      return `<span class="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
        Resolved
      </span>`;
    case 'Closed':
      return `<span class="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
        Closed
      </span>`;
    default:
      return `<span class="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700">${status}</span>`;
  }
}

function getStatusColorClasses(status) {
  switch (status) {
    case 'Open': return 'bg-slate-100 text-slate-800 border border-slate-300';
    case 'In Progress': return 'bg-blue-50 text-blue-800 border border-blue-200';
    case 'Pending User': return 'bg-slate-100 text-slate-700 border border-slate-200';
    case 'Resolved': return 'bg-emerald-50 text-emerald-800 border border-emerald-200';
    case 'Closed': return 'bg-slate-100 text-slate-600 border border-slate-200';
    default: return 'bg-slate-100 text-slate-700 border border-slate-200';
  }
}

function getPriorityBadge(priority) {
  switch (priority) {
    case 'Critical':
      return `<span class="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 uppercase">
        Critical
      </span>`;
    case 'High':
      return `<span class="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300 uppercase">
        High
      </span>`;
    case 'Medium':
      return `<span class="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
        Medium
      </span>`;
    case 'Low':
      return `<span class="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-200">
        Low
      </span>`;
    default:
      return `<span class="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-50 text-slate-600">${priority}</span>`;
  }
}

function getPriorityColorClasses(priority) {
  switch (priority) {
    case 'Critical': return 'text-red-700 bg-red-50 border border-red-200';
    case 'High': return 'text-slate-800 bg-slate-100 border border-slate-300';
    case 'Medium': return 'text-slate-600 bg-slate-100 border border-slate-200';
    case 'Low': return 'text-slate-500 bg-slate-50 border border-slate-200';
    default: return 'text-slate-600 bg-slate-50 border border-slate-200';
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
