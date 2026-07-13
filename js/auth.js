const MANAGER_ACCESS_CODE = "coolwebapp12";

const tabLogin = document.getElementById("tabLogin");
const tabSignup = document.getElementById("tabSignup");
const loginPanel = document.getElementById("loginPanel");
const signupPanel = document.getElementById("signupPanel");

tabLogin.addEventListener("click", () => {
  tabLogin.classList.add("active");
  tabSignup.classList.remove("active");
  loginPanel.style.display = "block";
  signupPanel.style.display = "none";
});
tabSignup.addEventListener("click", () => {
  tabSignup.classList.add("active");
  tabLogin.classList.remove("active");
  signupPanel.style.display = "block";
  loginPanel.style.display = "none";
});

// Role picker
const roleTeacher = document.getElementById("roleTeacher");
const roleManager = document.getElementById("roleManager");
const managerCodeField = document.getElementById("managerCodeField");
let selectedRole = "teacher";

roleTeacher.addEventListener("click", () => {
  selectedRole = "teacher";
  roleTeacher.classList.add("selected");
  roleManager.classList.remove("selected");
  managerCodeField.classList.remove("show");
});
roleManager.addEventListener("click", () => {
  selectedRole = "manager";
  roleManager.classList.add("selected");
  roleTeacher.classList.remove("selected");
  managerCodeField.classList.add("show");
});

function showError(elId, msg) {
  const el = document.getElementById(elId);
  el.textContent = msg;
  el.classList.add("show");
}
function clearError(elId) {
  const el = document.getElementById(elId);
  el.textContent = "";
  el.classList.remove("show");
}
function setBusy(buttonId, busy, busyLabel, restLabel) {
  const btn = document.getElementById(buttonId);
  btn.disabled = busy;
  btn.querySelector(".btn-label").textContent = busy ? busyLabel : restLabel;
}

async function redirectByRole(userId) {
  const { data: profile, error } = await sb
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (error || !profile) {
    window.location.href = "index.html";
    return;
  }
  window.location.href = profile.role === "manager" ? "manager.html" : "teacher.html";
}

// If already logged in, skip straight to the right dashboard
(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    redirectByRole(session.user.id);
  }
})();

// ---------------- SIGN UP ----------------
document.getElementById("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError("signupError");

  const fullName = document.getElementById("signupName").value.trim();
  const password = document.getElementById("signupPassword").value;
  const managerCode = document.getElementById("managerCode").value.trim();

  if (!fullName || password.length < 6) {
    showError("signupError", "Please enter your full name and a password of at least 6 characters.");
    return;
  }
  if (selectedRole === "manager" && managerCode !== MANAGER_ACCESS_CODE) {
    showError("signupError", "That Manager Access Code isn't correct.");
    return;
  }

  setBusy("signupSubmit", true, "Creating account…", "Create Account");

  try {
    if (SUPABASE_URL.includes("YOUR_SUPABASE") || SUPABASE_ANON_KEY.includes("YOUR_SUPABASE")) {
      showError("signupError", "This app isn't connected to Supabase yet — the URL/key in js/supabaseClient.js are still placeholders.");
      return;
    }

    const loginEmail = nameToLoginEmail(fullName);

    const { data: signUpData, error: signUpError } = await sb.auth.signUp({
      email: loginEmail,
      password,
    });

    if (signUpError) {
      if (signUpError.message.toLowerCase().includes("already registered")) {
        showError("signupError", "An account with this name already exists. Try logging in instead.");
      } else {
        showError("signupError", signUpError.message);
      }
      return;
    }

    const userId = signUpData.user?.id;
    if (!userId) {
      showError("signupError", "Something went wrong creating your account. Please try again.");
      return;
    }

    const { error: profileError } = await sb.from("profiles").insert({
      id: userId,
      full_name: fullName,
      login_email: loginEmail,
      role: selectedRole,
    });

    if (profileError) {
      if (profileError.message.toLowerCase().includes("duplicate")) {
        showError("signupError", "That name is already registered. Try logging in, or sign up with your full middle name too.");
      } else if (profileError.message.toLowerCase().includes("row-level security")) {
        showError("signupError", "Account created, but your profile couldn't save. In Supabase, make sure 'Confirm email' is turned OFF under Authentication settings, then try again.");
      } else {
        showError("signupError", profileError.message);
      }
      return;
    }

    window.location.href = selectedRole === "manager" ? "manager.html" : "teacher.html";
  } catch (err) {
    console.error("Signup failed:", err);
    showError("signupError", "Couldn't reach Supabase. Double-check the URL/key in js/supabaseClient.js are correct, then check the browser console (F12) for details.");
  } finally {
    setBusy("signupSubmit", false, "Creating account…", "Create Account");
  }
});

// ---------------- LOG IN ----------------
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError("loginError");

  const fullName = document.getElementById("loginName").value.trim();
  const password = document.getElementById("loginPassword").value;

  if (!fullName || !password) {
    showError("loginError", "Please enter your name and password.");
    return;
  }

  setBusy("loginSubmit", true, "Logging in…", "Log In");

  try {
    if (SUPABASE_URL.includes("YOUR_SUPABASE") || SUPABASE_ANON_KEY.includes("YOUR_SUPABASE")) {
      showError("loginError", "This app isn't connected to Supabase yet — the URL/key in js/supabaseClient.js are still placeholders.");
      return;
    }

    const { data: loginEmail, error: lookupError } = await sb.rpc("get_login_email", {
      p_full_name: fullName,
    });

    if (lookupError) {
      showError("loginError", `Lookup failed: ${lookupError.message}. Did you run the full schema.sql, including the get_login_email function?`);
      return;
    }
    if (!loginEmail) {
      showError("loginError", "We couldn't find an account with that name.");
      return;
    }

    const { data: signInData, error: signInError } = await sb.auth.signInWithPassword({
      email: loginEmail,
      password,
    });

    if (signInError) {
      showError("loginError", "Incorrect password. Please try again.");
      return;
    }

    redirectByRole(signInData.user.id);
  } catch (err) {
    console.error("Login failed:", err);
    showError("loginError", "Couldn't reach Supabase. Double-check the URL/key in js/supabaseClient.js are correct, then check the browser console (F12) for details.");
  } finally {
    setBusy("loginSubmit", false, "Logging in…", "Log In");
  }
});
