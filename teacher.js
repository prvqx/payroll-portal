let currentUser = null;
let currentProfile = null;
let allRequests = [];
let activeStatusTab = "all";

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function statusBadge(req) {
  if (req.status === "pending") {
    return `<span class="badge pending">Pending</span>`;
  }
  if (req.status === "approved") {
    return `<span class="badge approved">Approved</span>`;
  }
  // declined — with a hover-reveal reason
  const reason = escapeHtml(req.decline_reason || "No reason given.");
  return `
    <span class="badge declined">
      Declined
      <span class="help-dot">?
        <span class="tip">${reason}</span>
      </span>
    </span>`;
}

async function init() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    window.location.href = "index.html";
    return;
  }
  currentUser = session.user;

  const { data: profile, error } = await sb
    .from("profiles")
    .select("full_name, role")
    .eq("id", currentUser.id)
    .single();

  if (error || !profile) {
    window.location.href = "index.html";
    return;
  }
  if (profile.role !== "teacher") {
    window.location.href = "manager.html";
    return;
  }
  currentProfile = profile;

  document.getElementById("welcomeHeading").textContent = `Welcome, ${getFirstName(profile.full_name)}!`;

  await loadRequests();
  await checkNotifications();
}

async function loadRequests() {
  const { data, error } = await sb
    .from("requests")
    .select("*")
    .eq("teacher_id", currentUser.id)
    .order("date_logged", { ascending: false });

  if (error) {
    document.getElementById("requestsBody").innerHTML =
      `<tr class="empty-row"><td colspan="6">Couldn't load requests: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  allRequests = data || [];
  populateSchoolDatalist();
  renderTable();
  renderStats();
}

function populateSchoolDatalist() {
  const schools = [...new Set(allRequests.map(r => r.school))];
  document.getElementById("schoolList").innerHTML = schools.map(s => `<option value="${escapeHtml(s)}">`).join("");
}

function renderTable() {
  const tbody = document.getElementById("requestsBody");
  const filtered = activeStatusTab === "all"
    ? allRequests
    : allRequests.filter(r => r.status === activeStatusTab);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">No requests here yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(r => `
    <tr>
      <td>${formatDate(r.date_logged)}</td>
      <td>${escapeHtml(r.school)}</td>
      <td>${escapeHtml(r.category)}</td>
      <td>${Number(r.hours).toFixed(2)}</td>
      <td style="max-width:260px; white-space:normal;">${escapeHtml(r.description)}</td>
      <td>${statusBadge(r)}</td>
    </tr>
  `).join("");
}

function renderStats() {
  document.getElementById("totalRequestsCount").textContent =
    `${allRequests.length} total request${allRequests.length === 1 ? "" : "s"}`;

  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const hours = allRequests
    .filter(r => r.status === "approved" && new Date(r.reviewed_at || r.date_logged) >= twoWeeksAgo)
    .reduce((sum, r) => sum + Number(r.hours), 0);

  document.getElementById("hoursApprovedBiweekly").textContent = `${hours.toFixed(2)} hrs approved (last 14 days)`;
}

async function checkNotifications() {
  const unseen = allRequests.filter(r => r.status !== "pending" && r.notified === false);
  if (unseen.length === 0) return;

  const items = unseen.map(r => {
    if (r.status === "approved") {
      return `<li>Your <strong>${escapeHtml(r.category)}</strong> request at ${escapeHtml(r.school)} was <strong>Approved</strong>${r.manager_note ? ` — "${escapeHtml(r.manager_note)}"` : ""}.</li>`;
    }
    return `<li>Your <strong>${escapeHtml(r.category)}</strong> request at ${escapeHtml(r.school)} was <strong>Declined</strong>: ${escapeHtml(r.decline_reason || "No reason given.")}</li>`;
  }).join("");

  document.getElementById("notifArea").innerHTML = `
    <div class="notif-banner" id="notifBanner">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      <div><strong>Updates on your requests</strong><ul>${items}</ul></div>
      <button class="close-notif" id="dismissNotif">✕</button>
    </div>`;

  document.getElementById("dismissNotif").addEventListener("click", () => {
    document.getElementById("notifBanner").remove();
  });

  // Mark all as seen so this doesn't show again next time
  for (const r of unseen) {
    await sb.rpc("mark_request_notified", { p_request_id: r.id });
  }
}

// Tabs
document.getElementById("statusTabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".tab");
  if (!btn) return;
  document.querySelectorAll("#statusTabs .tab").forEach(t => t.classList.remove("active"));
  btn.classList.add("active");
  activeStatusTab = btn.dataset.status;
  renderTable();
});

// Submit modal
const submitModalOverlay = document.getElementById("submitModalOverlay");
const successModalOverlay = document.getElementById("successModalOverlay");

document.getElementById("openSubmitModal").addEventListener("click", () => {
  document.getElementById("submitForm").reset();
  document.getElementById("customCategoryField").classList.remove("show");
  clearErr();
  submitModalOverlay.classList.add("open");
});
document.getElementById("closeSubmitModal").addEventListener("click", () => submitModalOverlay.classList.remove("open"));
submitModalOverlay.addEventListener("click", (e) => { if (e.target === submitModalOverlay) submitModalOverlay.classList.remove("open"); });

document.getElementById("reqCategory").addEventListener("change", (e) => {
  document.getElementById("customCategoryField").classList.toggle("show", e.target.value === "Custom");
});

function clearErr() {
  const el = document.getElementById("submitError");
  el.textContent = "";
  el.classList.remove("show");
}
function showErr(msg) {
  const el = document.getElementById("submitError");
  el.textContent = msg;
  el.classList.add("show");
}

document.getElementById("submitForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  clearErr();

  const school = document.getElementById("reqSchool").value.trim();
  const categorySelect = document.getElementById("reqCategory").value;
  const customCategory = document.getElementById("reqCustomCategory").value.trim();
  const hours = parseFloat(document.getElementById("reqHours").value);
  const description = document.getElementById("reqDescription").value.trim();

  const category = categorySelect === "Custom" ? customCategory : categorySelect;

  if (!school || !category || !hours || hours <= 0 || !description) {
    showErr("Please fill out every field.");
    return;
  }

  const btn = document.getElementById("submitReqBtn");
  btn.disabled = true;
  btn.querySelector(".btn-label").textContent = "Submitting…";

  const { error } = await sb.from("requests").insert({
    teacher_id: currentUser.id,
    teacher_name: currentProfile.full_name,
    school,
    category,
    hours,
    description,
    status: "pending",
  });

  btn.disabled = false;
  btn.querySelector(".btn-label").textContent = "Submit Request";

  if (error) {
    showErr(error.message);
    return;
  }

  submitModalOverlay.classList.remove("open");
  successModalOverlay.classList.add("open");
  await loadRequests();
});

document.getElementById("closeSuccessModal").addEventListener("click", () => {
  successModalOverlay.classList.remove("open");
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await sb.auth.signOut();
  window.location.href = "index.html";
});

init();
