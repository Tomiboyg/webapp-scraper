const SUPABASE_URL = 'https://rlfwftraifjqxvxlexxi.supabase.co/';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsZndmdHJhaWZqcXh2eGxleHhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwNTQ0NTUsImV4cCI6MjA5NzYzMDQ1NX0.jk5Z8Sh5aklZd4KLBq5oHXaFEyE71P4ZUklXBQScdZ8';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const authSection = $('#authSection');
const dashboardSection = $('#dashboardSection');
const adminSection = $('#adminSection');
const loginForm = $('#loginForm');
const registerForm = $('#registerForm');
const authTabs = $$('.auth-tab');
const loginBtn = $('#loginBtn');
const logoutBtn = $('#logoutBtn');
const adminToggle = $('#adminToggle');
const navUserEmail = $('#navUserEmail');
const loginError = $('#loginError');
const regError = $('#regError');
const loginEmail = $('#loginEmail');
const loginPassword = $('#loginPassword');
const regEmail = $('#regEmail');
const regPassword = $('#regPassword');
const regInvite = $('#regInvite');
const urlInput = $('#urlInput');
const extractBtn = $('#extractBtn');
const scraperStatus = $('#scraperStatus');
const scraperStatusText = $('#scraperStatusText');
const skillsGrid = $('#skillsGrid');
const skillsEmpty = $('#skillsEmpty');
const searchInput = $('#searchInput');
const categoryFilter = $('#categoryFilter');
const generateCodeBtn = $('#generateCodeBtn');
const codesBody = $('#codesBody');
const codesEmpty = $('#codesEmpty');
const codesTableWrapper = $('#codesTableWrapper');
const toast = $('#toast');

let currentUser = null;
let userProfile = null;
let skills = [];
let toastTimeout = null;

supabase.auth.onAuthStateChange((event, session) => {
  if (session) {
    currentUser = session.user;
    loadProfile();
  } else {
    currentUser = null;
    userProfile = null;
    showAuth();
  }
});

async function loadProfile() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', currentUser.id)
    .single();

  if (error) {
    console.error('Profile load error:', error);
    return;
  }

  userProfile = data;
  showDashboard();
}

function showAuth() {
  authSection.hidden = false;
  dashboardSection.hidden = true;
  adminSection.hidden = true;
  adminToggle.hidden = true;
  logoutBtn.hidden = true;
  navUserEmail.textContent = '';
}

function showDashboard() {
  authSection.hidden = true;
  dashboardSection.hidden = false;
  logoutBtn.hidden = false;
  navUserEmail.textContent = currentUser.email;

  if (userProfile && userProfile.role === 'admin') {
    adminToggle.hidden = false;
  } else {
    adminToggle.hidden = true;
    adminSection.hidden = true;
  }

  loadSkills();
}

function showToast(message, type) {
  if (toastTimeout) clearTimeout(toastTimeout);
  toast.textContent = message;
  toast.className = 'toast ' + (type || '');
  toast.hidden = false;
  toastTimeout = setTimeout(() => {
    toast.hidden = true;
  }, 4000);
}

// Auth Tabs
authTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    authTabs.forEach(t => t.classList.remove('active'));
    $$('.auth-form').forEach(f => f.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab + 'Form').classList.add('active');
  });
});

// Login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    loginError.textContent = error.message;
  } else {
    loginEmail.value = '';
    loginPassword.value = '';
  }
});

// Register
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  regError.textContent = '';

  const email = regEmail.value.trim();
  const password = regPassword.value;
  const inviteCode = regInvite.value.trim();

  if (!inviteCode) {
    regError.textContent = 'An invite code is required.';
    return;
  }

  try {
    const { data, error } = await supabase.functions.invoke('register-with-invite', {
      body: { email, password, invite_code: inviteCode }
    });

    if (error) {
      // Extract actual error message from the response body
      const msg = error.context?.error || error.message || 'Registration failed.';
      throw new Error(msg);
    }
    if (data.error) {
      regError.textContent = data.error;
      return;
    }

    showToast('Registration successful! You can now sign in.', 'success');
    regEmail.value = '';
    regPassword.value = '';
    regInvite.value = '';
    authTabs[0].click();
  } catch (err) {
    regError.textContent = err.message || 'Registration failed.';
    console.error('Registration error:', err);
  }
});

// Logout
logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  skills = [];
  skillsGrid.innerHTML = '';
  codesBody.innerHTML = '';
});

// Admin Toggle
adminToggle.addEventListener('click', () => {
  adminSection.hidden = !adminSection.hidden;
  if (!adminSection.hidden) {
    loadInviteCodes();
  }
});

// Extract Skills
extractBtn.addEventListener('click', extractSkills);

urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') extractSkills();
});

async function extractSkills() {
  const url = urlInput.value.trim();
  if (!url) {
    showToast('Please enter a URL.', 'error');
    return;
  }

  extractBtn.disabled = true;
  scraperStatus.hidden = false;
  scraperStatusText.textContent = 'Fetching and analyzing page...';

  try {
    const { data, error } = await supabase.functions.invoke('scrape-and-extract', {
      body: { url }
    });

    if (error) throw error;
    if (!data.success) throw new Error(data.error || 'Extraction failed');

    showToast(`Extracted ${data.skills.length} skills successfully!`, 'success');
    urlInput.value = '';
    await loadSkills();
  } catch (err) {
    showToast(err.message || 'An error occurred during extraction.', 'error');
  } finally {
    extractBtn.disabled = false;
    scraperStatus.hidden = true;
  }
}

// Load Skills
async function loadSkills() {
  if (!currentUser) return;

  const { data, error } = await supabase
    .from('learned_skills')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Skills load error:', error);
    return;
  }

  skills = data || [];
  renderSkills();
  populateCategoryFilter();
}

function renderSkills() {
  const search = searchInput.value.toLowerCase();
  const category = categoryFilter.value;

  const filtered = skills.filter(s => {
    const matchSearch = !search || s.skill_name.toLowerCase().includes(search) || (s.description && s.description.toLowerCase().includes(search));
    const matchCategory = category === 'all' || s.category === category;
    return matchSearch && matchCategory;
  });

  if (filtered.length === 0) {
    skillsGrid.innerHTML = '';
    skillsEmpty.hidden = false;
    return;
  }

  skillsEmpty.hidden = true;
  skillsGrid.innerHTML = filtered.map(s => {
    const scoreWidth = Math.min(s.relevance_score, 100);
    const categoryColors = {
      'Programming': 'rgba(59, 130, 246, 0.15)',
      'Marketing': 'rgba(236, 72, 153, 0.15)',
      'Design': 'rgba(168, 85, 247, 0.15)',
      'Business': 'rgba(245, 158, 11, 0.15)',
      'Communication': 'rgba(16, 185, 129, 0.15)',
      'Technical': 'rgba(59, 130, 246, 0.15)',
    };
    const catColor = categoryColors[s.category] || 'rgba(113, 113, 122, 0.15)';

    return `<div class="skill-card" data-id="${s.id}">
      <div class="skill-card-header">
        <h3>${escapeHtml(s.skill_name)}</h3>
        <span class="skill-category" style="background:${catColor}">${escapeHtml(s.category)}</span>
      </div>
      ${s.description ? `<p class="skill-description">${escapeHtml(s.description)}</p>` : ''}
      <div class="skill-score">
        <div class="score-bar-track">
          <div class="score-bar-fill" style="width:${scoreWidth}%"></div>
        </div>
        <span class="score-label">${scoreWidth}%</span>
      </div>
      <div class="skill-source">${escapeHtml(s.source_url)}</div>
      <div class="skill-card-actions">
        <button class="btn-delete-skill" data-id="${s.id}">Delete</button>
      </div>
    </div>`;
  }).join('');

  // Attach delete handlers
  document.querySelectorAll('.btn-delete-skill').forEach(btn => {
    btn.addEventListener('click', () => deleteSkill(btn.dataset.id));
  });
}

function populateCategoryFilter() {
  const cats = [...new Set(skills.map(s => s.category))];
  const current = categoryFilter.value;
  categoryFilter.innerHTML = '<option value="all">All Categories</option>' +
    cats.map(c => `<option value="${c}">${c}</option>`).join('');
  categoryFilter.value = current;
}

searchInput.addEventListener('input', renderSkills);
categoryFilter.addEventListener('change', renderSkills);

async function deleteSkill(id) {
  const { error } = await supabase
    .from('learned_skills')
    .delete()
    .eq('id', id)
    .eq('user_id', currentUser.id);

  if (error) {
    showToast('Failed to delete skill.', 'error');
    return;
  }

  skills = skills.filter(s => s.id !== id);
  renderSkills();
  showToast('Skill deleted.', 'success');
}

// Admin: Generate Invite Code
generateCodeBtn.addEventListener('click', async () => {
  const code = 'INV-' + Math.random().toString(36).substring(2, 8).toUpperCase();

  const { error } = await supabase
    .from('invite_codes')
    .insert({ code, created_by: currentUser.id });

  if (error) {
    showToast('Failed to generate code: ' + error.message, 'error');
    return;
  }

  showToast(`Code ${code} generated!`, 'success');
  loadInviteCodes();
});

// Admin: Load Invite Codes
async function loadInviteCodes() {
  const { data, error } = await supabase
    .from('invite_codes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Codes load error:', error);
    return;
  }

  if (!data || data.length === 0) {
    codesEmpty.hidden = false;
    codesTableWrapper.hidden = true;
    return;
  }

  codesEmpty.hidden = true;
  codesTableWrapper.hidden = false;
  codesBody.innerHTML = data.map(c => `
    <tr>
      <td><code>${escapeHtml(c.code)}</code></td>
      <td><span class="badge ${c.status === 'active' ? 'badge-active' : 'badge-used'}">${c.status}</span></td>
      <td>${c.used_by ? c.used_by : '-'}</td>
      <td>${new Date(c.created_at).toLocaleDateString()}</td>
      <td>${c.status === 'active' ? `<button class="btn-icon" data-id="${c.id}">Revoke</button>` : '-'}</td>
    </tr>
  `).join('');

  document.querySelectorAll('.btn-icon').forEach(btn => {
    btn.addEventListener('click', () => revokeCode(btn.dataset.id));
  });
}

async function revokeCode(id) {
  const { error } = await supabase
    .from('invite_codes')
    .update({ status: 'used' })
    .eq('id', id);

  if (error) {
    showToast('Failed to revoke code.', 'error');
    return;
  }

  showToast('Code revoked.', 'success');
  loadInviteCodes();
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Check existing session on load
(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser = session.user;
    await loadProfile();
  }
})();
