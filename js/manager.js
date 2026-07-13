let currentUser = null;
let currentProfile = null;
let allRequests = [];
let sortState = { pending: null, approved: null, declined: null };
let currentReviewId = null;
let currentClearTarget = null;

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function isSameDay(iso, ref) {
  const d = new Date(iso);
  return d.toDateString() === ref.toDateString();
}

async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = "index.html"; return; }
  currentUser = session.user;

  const { data: profile, error } = await supabase
    .from("profiles").select("full_name, role").eq("id", currentUser.id).single();

  if (error || !profile) { window.location.href = "index.html"; return; }
  if (profile.role !== "manager") { window.location.href = "teacher.html"; return; }
  currentProfile = profile;

  document.getElementById("welcomeHeading").textContent = `Welcome, ${getFirstName(profile.full_name)}!`;

  await loadRequests();
}

async function loadRequests() {
  const { data, error } = await supabase
    .from("requests")
    .select("*")
    .order("date_logged", { ascending: false });

  if (error) {
    ["pendingBody", "approvedBody", "declinedBody"].forEach(id => {
      document.getElementById(id).innerHTML = `<tr class="empty-row"><td colspan="6">Couldn't load: ${escapeHtml(error.message)}</td></tr>`;
    });
    return;
  }

  allRequests = data || [];
  renderStats();
  renderPending();
  renderApproved();
  renderDeclined();
}

function renderStats() {
  const today = new Date();
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const visible = allRequests.filter(r => !r.is_cleared);

  document.getElementById("statPending").textContent = visible.filter(r => r.status === "pending").length;
  document.getElementById("statApprovedToday").textContent = visible.filter(r => r.status === "approved" && r.reviewed_at && isSameDay(r.reviewed_at, today)).length;
  document.getElementById("statDeclinedToday").textContent = visible.filter(r => r.status === "declined" && r.reviewed_at && isSameDay(r.reviewed_at, today)).length;
  document.getElementById("statApprovedBiweekly").textContent = visible.filter(r => r.status === "approved" && r.reviewed_at && new Date(r.reviewed_at) >= twoWeeksAgo).length;
}

function applySort(list, key) {
  const copy = [...list];
  if (key === "teacher") copy.sort((a, b) => a.teacher_name.localeCompare(b.teacher_name));
  else if (key === "hours") copy.sort((a, b) => Number(b.hours) - Number(a.hours));
  else if (key === "school") copy.sort((a, b) => a.school.localeCompare(b.school));
  else copy.sort((a, b) => new Date(b.date_logged) - new Date(a.date_logged));
  return copy;
}

function renderPending() {
  const list = applySort(allRequests.filter(r => r.status === "pending" && !r.is_cleared), sortState.pending);
  const tbody = document.getElementById("pendingBody");
  document.getElementById("pendingCount").textContent = `${list.length} request${list.length === 1 ? "" : "s"}`;

  if (list.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">No pending requests right now.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(r => `
    <tr>
      <td>${escapeHtml(r.teacher_name)}</td>
      <td>${formatDate(r.date_logged)}</td>
      <td>${escapeHtml(r.school)}</td>
      <td>${Number(r.hours).toFixed(2)}</td>
      <td><span class="badge pending">Pending</span></td>
      <td class="row-actions"><button class="btn btn-ghost btn-sm review-btn" data-id="${r.id}">Review</button></td>
    </tr>
  `).join("");
}

function renderApproved() {
  const list = applySort(allRequests.filter(r => r.status === "approved" && !r.is_cleared), sortState.approved);
  const tbody = document.getElementById("approvedBody");
  document.getElementById("approvedCount").textContent = `${list.length} request${list.length === 1 ? "" : "s"}`;

  if (list.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">No approved requests yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(r => `
    <tr>
      <td>${escapeHtml(r.teacher_name)}</td>
      <td>${formatDate(r.date_logged)}</td>
      <td>${escapeHtml(r.school)}</td>
      <td>${Number(r.hours).toFixed(2)}</td>
      <td style="max-width:200px; white-space:normal; color:var(--ink-soft);">${escapeHtml(r.manager_note || "—")}</td>
      <td><span class="badge approved">Approved</span></td>
    </tr>
  `).join("");
}

function renderDeclined() {
  const list = applySort(allRequests.filter(r => r.status === "declined" && !r.is_cleared), sortState.declined);
  const tbody = document.getElementById("declinedBody");
  document.getElementById("declinedCount").textContent = `${list.length} request${list.length === 1 ? "" : "s"}`;

  if (list.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">No declined requests yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(r => `
    <tr>
      <td>${escapeHtml(r.teacher_name)}</td>
      <td>${formatDate(r.date_logged)}</td>
      <td>${escapeHtml(r.school)}</td>
      <td>${Number(r.hours).toFixed(2)}</td>
      <td style="max-width:200px; white-space:normal; color:var(--ink-soft);">${escapeHtml(r.decline_reason || "—")}</td>
      <td><span class="badge declined">Declined</span></td>
    </tr>
  `).join("");
}

// ---------------- Sort dropdowns ----------------
function wireSortDropdown(tableKey, wrapId, triggerId, menuId) {
  const wrap = document.getElementById(wrapId);
  const trigger = document.getElementById(triggerId);
  const menu = document.getElementById(menuId);

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    document.querySelectorAll(".sort-dd-menu").forEach(m => { if (m !== menu) m.classList.remove("open"); });
    menu.classList.toggle("open");
  });

  menu.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const key = btn.dataset.sort;
    sortState[tableKey] = key === "cancel" ? null : key;
    menu.classList.remove("open");
    if (tableKey === "pending") renderPending();
    if (tableKey === "approved") renderApproved();
    if (tableKey === "declined") renderDeclined();
  });
}
wireSortDropdown("pending", "sortDdWrapPending", "sortTriggerPending", "sortMenuPending");
wireSortDropdown("approved", "sortDdWrapApproved", "sortTriggerApproved", "sortMenuApproved");
wireSortDropdown("declined", "sortDdWrapDeclined", "sortTriggerDeclined", "sortMenuDeclined");

document.addEventListener("click", () => {
  document.querySelectorAll(".sort-dd-menu").forEach(m => m.classList.remove("open"));
});

// ---------------- Review modal ----------------
const reviewModalOverlay = document.getElementById("reviewModalOverlay");
const approveModalOverlay = document.getElementById("approveModalOverlay");
const rejectModalOverlay = document.getElementById("rejectModalOverlay");
const clearModalOverlay = document.getElementById("clearModalOverlay");

document.getElementById("pendingBody").addEventListener("click", (e) => {
  const btn = e.target.closest(".review-btn");
  if (!btn) return;
  currentReviewId = btn.dataset.id;
  const r = allRequests.find(x => x.id === currentReviewId);
  if (!r) return;

  document.getElementById("reviewDetails").innerHTML = `
    <div class="detail-row"><span class="k">Teacher</span><span class="v">${escapeHtml(r.teacher_name)}</span></div>
    <div class="detail-row"><span class="k">Date Logged</span><span class="v">${formatDate(r.date_logged)}</span></div>
    <div class="detail-row"><span class="k">School</span><span class="v">${escapeHtml(r.school)}</span></div>
    <div class="detail-row"><span class="k">Category</span><span class="v">${escapeHtml(r.category)}</span></div>
    <div class="detail-row"><span class="k">Hours</span><span class="v">${Number(r.hours).toFixed(2)}</span></div>
    <div class="detail-row" style="border-bottom:none;"><span class="k">Description</span></div>
    <p style="font-weight:600; color:var(--ink-soft); margin-top:-4px;">${escapeHtml(r.description)}</p>
  `;
  reviewModalOverlay.classList.add("open");
});

document.getElementById("closeReviewModal").addEventListener("click", () => reviewModalOverlay.classList.remove("open"));
reviewModalOverlay.addEventListener("click", (e) => { if (e.target === reviewModalOverlay) reviewModalOverlay.classList.remove("open"); });

document.getElementById("reviewApproveBtn").addEventListener("click", () => {
  reviewModalOverlay.classList.remove("open");
  document.getElementById("approveNote").value = "";
  approveModalOverlay.classList.add("open");
});
document.getElementById("reviewRejectBtn").addEventListener("click", () => {
  reviewModalOverlay.classList.remove("open");
  document.getElementById("rejectReason").value = "";
  document.getElementById("rejectError").classList.remove("show");
  rejectModalOverlay.classList.add("open");
});

// ---------------- Approve ----------------
document.getElementById("closeApproveModal").addEventListener("click", () => approveModalOverlay.classList.remove("open"));
async function doApprove(note) {
  const { error } = await supabase.from("requests").update({
    status: "approved",
    manager_note: note || null,
    reviewed_at: new Date().toISOString(),
    notified: false,
  }).eq("id", currentReviewId);

  approveModalOverlay.classList.remove("open");
  if (error) { alert("Couldn't approve this request: " + error.message); return; }
  await loadRequests();
}
document.getElementById("skipApproveNote").addEventListener("click", () => doApprove(null));
document.getElementById("confirmApprove").addEventListener("click", () => doApprove(document.getElementById("approveNote").value.trim()));

// ---------------- Reject ----------------
document.getElementById("closeRejectModal").addEventListener("click", () => rejectModalOverlay.classList.remove("open"));
document.getElementById("cancelReject").addEventListener("click", () => rejectModalOverlay.classList.remove("open"));
document.getElementById("confirmReject").addEventListener("click", async () => {
  const reason = document.getElementById("rejectReason").value.trim();
  if (!reason) {
    const el = document.getElementById("rejectError");
    el.textContent = "Please give a reason for declining.";
    el.classList.add("show");
    return;
  }
  const { error } = await supabase.from("requests").update({
    status: "declined",
    decline_reason: reason,
    reviewed_at: new Date().toISOString(),
    notified: false,
  }).eq("id", currentReviewId);

  rejectModalOverlay.classList.remove("open");
  if (error) { alert("Couldn't decline this request: " + error.message); return; }
  await loadRequests();
});

// ---------------- Clear tables ----------------
document.getElementById("clearApprovedBtn").addEventListener("click", () => { currentClearTarget = "approved"; clearModalOverlay.classList.add("open"); });
document.getElementById("clearDeclinedBtn").addEventListener("click", () => { currentClearTarget = "declined"; clearModalOverlay.classList.add("open"); });
document.getElementById("closeClearModal").addEventListener("click", () => clearModalOverlay.classList.remove("open"));
document.getElementById("cancelClear").addEventListener("click", () => clearModalOverlay.classList.remove("open"));
document.getElementById("confirmClear").addEventListener("click", async () => {
  const { error } = await supabase.from("requests")
    .update({ is_cleared: true })
    .eq("status", currentClearTarget)
    .eq("is_cleared", false);

  clearModalOverlay.classList.remove("open");
  if (error) { alert("Couldn't clear this table: " + error.message); return; }
  await loadRequests();
});

// ---------------- CSV Export ----------------
function csvEscape(val) {
  const s = String(val ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

document.getElementById("exportCsvBtn").addEventListener("click", () => {
  const headers = ["Teacher", "School", "Category", "Hours", "Description", "Status", "Date Logged", "Reviewed At", "Manager Note", "Decline Reason", "Cleared"];
  const rows = allRequests.map(r => [
    r.teacher_name, r.school, r.category, r.hours, r.description, r.status,
    r.date_logged, r.reviewed_at || "", r.manager_note || "", r.decline_reason || "",
    r.is_cleared ? "Yes" : "No",
  ]);
  const csv = [headers, ...rows].map(row => row.map(csvEscape).join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `extra-hours-export-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "index.html";
});

init();
