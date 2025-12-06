const SUPABASE_URL = 'https://zayqemanhzjgjyxwmbnt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpheXFlbWFuaHpqZ2p5eHdtYm50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5MDAxMDMsImV4cCI6MjA4MDQ3NjEwM30.xjV-PCNhj3_GCs4q8GoojI3b3yhjgEd1CyGgWpJQP7o';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let userProfile = null;
let isLoginMode = false;
let currentTab = 'all';

const educationFieldsMap = {
    'Diploma': ['Civil Engineering', 'Mechanical Engineering', 'Electrical Engineering', 'Electronics Engineering', 'Computer Engineering', 'Automobile Engineering'],
    'Degree': ['Civil Engineering', 'Mechanical Engineering', 'Electrical Engineering', 'Electronics Engineering', 'Computer Science', 'Information Technology', 'Naval Architecture', 'Marine Engineering', 'Automotive Engineering', 'Mechatronics', 'Aerospace Engineering', 'Aeronautical Engineering', 'Metallurgy', 'Industrial Engineering', 'Power Engineering'],
    'Post Graduate': ['Civil Engineering', 'Mechanical Engineering', 'Electrical Engineering', 'Electronics Engineering', 'Computer Science', 'Management']
};

// Initialize
checkAuth();
loadAllJobs();

async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        currentUser = user;
        await loadUserProfile();
    }
    updateAuthButton();
    updateGetStartedButton();
}

async function loadUserProfile() {
    try {
        const { data, error } = await supabase
            .from('users_profiles')
            .select('*')
            .eq('user_id', currentUser.id)
            .limit(1)
            .single();

        if (data) {
            userProfile = data;
        }
    } catch (error) {
        console.log('No profile found');
    }
}

function updateAuthButton() {
    const btn = document.getElementById('authButton');
    if (currentUser && userProfile) {
        btn.innerHTML = `
            <div class="profile-icon" onclick="openProfileMenu()">👤</div>
        `;
    } else {
        btn.innerHTML = '<button class="btn btn-primary" onclick="openAuthModal()">Login / Sign Up</button>';
    }
}

function openProfileMenu() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 300px;">
            <span class="close-modal" onclick="this.parentElement.parentElement.remove()">&times;</span>
            <h2 style="margin-bottom: 20px;">Profile Menu</h2>
            <button class="btn btn-primary" onclick="showProfilePage(); this.closest('.modal').remove();" style="width: 100%; margin-bottom: 10px;">
                👤 My Profile
            </button>
            <button class="btn btn-apply" onclick="logout(); this.closest('.modal').remove();" style="width: 100%; background: #dc3545;">
                🚪 Logout
            </button>
        </div>
    `;
    document.body.appendChild(modal);
}

function updateGetStartedButton() {
    const btn = document.getElementById('getStartedBtn');
    if (currentUser && userProfile) {
        btn.onclick = () => {
            showTab('recommended');
            document.getElementById('jobs').scrollIntoView({ behavior: 'smooth' });
        };
    } else {
        btn.onclick = openAuthModal;
    }
}

function toggleProfileDropdown() {
    const dropdown = document.getElementById('profileDropdown');
    if (dropdown) {
        dropdown.classList.toggle('active');
    }
}

// Also handle touch events for mobile
document.addEventListener('touchstart', (e) => {
    const dropdown = document.getElementById('profileDropdown');
    const profileIcon = document.querySelector('.profile-icon');
    if (dropdown && profileIcon && !profileIcon.contains(e.target)) {
        dropdown.classList.remove('active');
    }
});

function showProfilePage() {
    document.getElementById('profileSection').classList.remove('hidden');
    document.getElementById('jobs').classList.add('hidden');
    displayProfile();
    document.getElementById('profileSection').scrollIntoView({ behavior: 'smooth' });
}

function showTab(tab) {
    currentTab = tab;
    const tabRecommended = document.getElementById('tabRecommended');
    const tabAll = document.getElementById('tabAll');
    const recommendedSection = document.getElementById('recommendedJobsSection');
    const allSection = document.getElementById('allJobsSection');

    // Show jobs section if hidden
    document.getElementById('jobs').classList.remove('hidden');
    document.getElementById('profileSection').classList.add('hidden');

    if (tab === 'recommended') {
        tabRecommended.classList.add('active');
        tabAll.classList.remove('active');
        recommendedSection.classList.remove('hidden');
        allSection.classList.add('hidden');

        if (currentUser && userProfile) {
            loadRecommendedJobs();
        } else {
            document.getElementById('recommendedJobs').innerHTML = `
                <div class="loading">
                    <p style="margin-bottom: 20px;">Please login and complete your profile to see personalized job recommendations</p>
                    <button class="btn btn-primary" onclick="openAuthModal()">Login / Sign Up</button>
                </div>
            `;
        }
    } else {
        tabRecommended.classList.remove('active');
        tabAll.classList.add('active');
        recommendedSection.classList.add('hidden');
        allSection.classList.remove('hidden');
    }
}

async function loadAllJobs() {
    try {
        const { data, error } = await supabase
            .from('jobs')
            .select('*')
            .gte('application_deadline', new Date().toISOString())
            .order('posted_date', { ascending: false });

        if (error) throw error;

        document.getElementById('totalJobsHero').textContent = data.length;
        renderJobs(data, 'allJobs');
    } catch (error) {
        console.error(error);
        document.getElementById('allJobs').innerHTML = '<div class="loading">Error loading jobs. Please refresh the page.</div>';
    }
}

async function loadRecommendedJobs() {
    if (!userProfile) return;

    document.getElementById('recommendedJobs').innerHTML = '<div class="loading">Loading your recommended jobs...</div>';

    try {
        const { data: allJobs, error } = await supabase
            .from('jobs')
            .select('*')
            .gte('application_deadline', new Date().toISOString())
            .order('posted_date', { ascending: false });

        if (error) throw error;

        // Same matching logic as Flutter app
        const matched = allJobs.filter(job => {
            // 1. Age check
            if (job.min_age && userProfile.age < job.min_age) return false;
            if (job.max_age && userProfile.age > job.max_age) return false;

            // 2. Education level check
            const levels = { '10th': 1, '12th': 2, 'Diploma': 3, 'Degree': 4, 'Post Graduate': 5 };
            if (levels[userProfile.education_level] < levels[job.education_required]) return false;

            // 3. Education field check
            if (job.education_fields?.length && userProfile.education_field) {
                if (!job.education_fields.includes(userProfile.education_field)) return false;
            }

            // 4. Percentage check
            if (userProfile.percentage < job.min_percentage) return false;

            // 5. Category check
            if (job.categories?.length && !job.categories.includes(userProfile.category)) return false;

            // 6. State check
            if (job.state !== 'All India' && job.state !== userProfile.state) return false;

            return true;
        });

        renderJobs(matched, 'recommendedJobs');
    } catch (error) {
        console.error(error);
        document.getElementById('recommendedJobs').innerHTML = '<div class="loading">Error loading jobs</div>';
    }
}

function renderJobs(jobs, containerId) {
    const container = document.getElementById(containerId);

    if (jobs.length === 0) {
        container.innerHTML = `
            <div class="loading">
                <p>No ${containerId === 'recommendedJobs' ? 'matching' : 'active'} jobs found${containerId === 'recommendedJobs' ? '. Try updating your profile or check back later!' : '. Check back soon!'}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = jobs.map(job => `
        <div class="job-card">
            <div class="job-title">${job.title}</div>
            <div class="job-org">${job.organization} • ${job.post_name}</div>
            
            <div class="job-meta">
                <span>📅 Deadline: ${formatDate(job.application_deadline)}</span>
                <span>🎓 ${job.education_required}</span>
                <span>📍 ${job.state}</span>
                ${job.min_age || job.max_age ? `<span>👤 Age: ${job.min_age || 0}-${job.max_age || '∞'}</span>` : ''}
                <span>📊 Min ${job.min_percentage}%</span>
            </div>
            
            ${job.education_fields?.length ? `
                <div style="margin: 10px 0;">
                    ${job.education_fields.map(f => `<span class="badge">${f}</span>`).join('')}
                </div>
            ` : ''}
            
            <a href="${job.apply_link}" target="_blank" class="btn-apply">
                Apply Now →
            </a>
        </div>
    `).join('');
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Auth Modal Functions
function openAuthModal() {
    document.getElementById('authModal').classList.add('active');
}

function closeAuthModal() {
    document.getElementById('authModal').classList.remove('active');
}

function toggleAuthMode(e) {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    if (isLoginMode) {
        document.getElementById('authTitle').textContent = 'Login';
        document.getElementById('authBtn').textContent = 'Login';
        document.getElementById('authToggleText').textContent = "Don't have an account?";
        e.target.textContent = 'Sign Up';
    } else {
        document.getElementById('authTitle').textContent = 'Create Account';
        document.getElementById('authBtn').textContent = 'Sign Up';
        document.getElementById('authToggleText').textContent = 'Already have an account?';
        e.target.textContent = 'Login';
    }
}

document.getElementById('authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('authBtn');
    btn.disabled = true;
    btn.textContent = 'Please wait...';

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        if (isLoginMode) {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            currentUser = data.user;
            await loadUserProfile();
            closeAuthModal();
            updateAuthButton();
            updateGetStartedButton();
            if (userProfile) {
                showTab('recommended');
            } else {
                alert('Welcome! Please complete your profile to get personalized job recommendations.');
                openProfileModal();
            }
        } else {
            const { data, error } = await supabase.auth.signUp({ email, password });
            if (error) throw error;
            currentUser = data.user;
            closeAuthModal();
            alert('Account created successfully! Please complete your profile.');
            openProfileModal();
        }
    } catch (error) {
        alert('Error: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = isLoginMode ? 'Login' : 'Sign Up';
    }
});

// Profile Modal Functions
function openProfileModal() {
    document.getElementById('profileModal').classList.add('active');
    if (userProfile) {
        document.getElementById('fullName').value = userProfile.full_name;
        document.getElementById('phone').value = userProfile.phone || '';
        document.getElementById('age').value = userProfile.age;
        document.getElementById('educationLevel').value = userProfile.education_level;
        updateFields();
        document.getElementById('educationField').value = userProfile.education_field || '';
        document.getElementById('percentage').value = userProfile.percentage;
        document.getElementById('category').value = userProfile.category;
        document.getElementById('state').value = userProfile.state;
    }
}

function closeProfileModal() {
    document.getElementById('profileModal').classList.remove('active');
}

function openEditProfile() {
    openProfileModal();
}

function updateFields() {
    const level = document.getElementById('educationLevel').value;
    const fieldGroup = document.getElementById('fieldGroup');
    const fieldSelect = document.getElementById('educationField');

    if (level === '10th' || level === '12th') {
        fieldGroup.classList.add('hidden');
        fieldSelect.removeAttribute('required');
    } else if (educationFieldsMap[level]) {
        fieldGroup.classList.remove('hidden');
        fieldSelect.setAttribute('required', 'required');
        fieldSelect.innerHTML = '<option value="">Select Field</option>' +
            educationFieldsMap[level].map(f => `<option value="${f}">${f}</option>`).join('');
    }
}

document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('profileBtn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    const level = document.getElementById('educationLevel').value;
    const profileData = {
        user_id: currentUser.id,
        full_name: document.getElementById('fullName').value,
        email: currentUser.email,
        phone: document.getElementById('phone').value || null,
        age: parseInt(document.getElementById('age').value),
        education_level: level,
        education_field: (level !== '10th' && level !== '12th') ? document.getElementById('educationField').value : null,
        percentage: parseFloat(document.getElementById('percentage').value),
        category: document.getElementById('category').value,
        state: document.getElementById('state').value
    };

    try {
        const { error } = await supabase
            .from('users_profiles')
            .upsert(profileData, { onConflict: 'user_id' });

        if (error) throw error;

        userProfile = profileData;
        closeProfileModal();
        updateAuthButton();
        updateGetStartedButton();
        alert('Profile saved successfully!');
        showTab('recommended');
    } catch (error) {
        alert('Error: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save Profile';
    }
});

function displayProfile() {
    if (!userProfile) return;

    document.getElementById('profileInfo').innerHTML = `
        <div class="profile-info">
            <div class="info-item">
                <div class="info-label">Name</div>
                <div class="info-value">${userProfile.full_name}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Email</div>
                <div class="info-value">${userProfile.email}</div>
            </div>
            ${userProfile.phone ? `
            <div class="info-item">
                <div class="info-label">Phone</div>
                <div class="info-value">${userProfile.phone}</div>
            </div>
            ` : ''}
            <div class="info-item">
                <div class="info-label">Age</div>
                <div class="info-value">${userProfile.age} years</div>
            </div>
            <div class="info-item">
                <div class="info-label">Education</div>
                <div class="info-value">${userProfile.education_level}${userProfile.education_field ? ' - ' + userProfile.education_field : ''}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Percentage</div>
                <div class="info-value">${userProfile.percentage}%</div>
            </div>
            <div class="info-item">
                <div class="info-label">Category</div>
                <div class="info-value">${userProfile.category}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Preferred State</div>
                <div class="info-value">${userProfile.state}</div>
            </div>
        </div>
    `;
}

async function logout() {
    if (confirm('Are you sure you want to logout?')) {
        await supabase.auth.signOut();
        currentUser = null;
        userProfile = null;
        updateAuthButton();
        updateGetStartedButton();
        showTab('all');
        alert('Logged out successfully!');
        window.location.reload();
    }
}