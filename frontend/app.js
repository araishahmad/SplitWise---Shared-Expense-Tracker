// ============================================
// API Configuration
// ============================================

const API_BASE_URL = 'http://localhost:5000/api';

// API Helper Functions
const API = {
    // Get token from localStorage
    getToken() {
        return localStorage.getItem('token');
    },

    // Set token to localStorage
    setToken(token) {
        localStorage.setItem('token', token);
    },

    // Remove token from localStorage
    removeToken() {
        localStorage.removeItem('token');
    },

    // Make authenticated API request
    async request(endpoint, options = {}) {
        const token = this.getToken();
        const headers = {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        };

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                ...options,
                headers: {
                    ...headers,
                    ...options.headers
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Something went wrong');
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    // Auth endpoints
    async signup(userData) {
        return this.request('/auth/signup', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    },

    async login(credentials) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify(credentials)
        });
    },

    async getCurrentUser() {
        return this.request('/auth/me');
    },

    // Group endpoints
    async createGroup(groupData) {
        return this.request('/groups', {
            method: 'POST',
            body: JSON.stringify(groupData)
        });
    },

    async getGroups() {
        return this.request('/groups');
    },

    async getGroup(groupId) {
        return this.request(`/groups/${groupId}`);
    },

    async deleteGroup(groupId) {
        return this.request(`/groups/${groupId}`, {
            method: 'DELETE'
        });
    },

    // Expense endpoints
    async createExpense(expenseData) {
        return this.request('/expenses', {
            method: 'POST',
            body: JSON.stringify(expenseData)
        });
    },

    async getGroupExpenses(groupId) {
        return this.request(`/expenses/group/${groupId}`);
    },

    async getAllExpenses() {
        return this.request('/expenses');
    },

    async deleteExpense(expenseId) {
        return this.request(`/expenses/${expenseId}`, {
            method: 'DELETE'
        });
    },

    // Analytics endpoints
    async getGroupAnalytics(groupId) {
        return this.request(`/analytics/group/${groupId}`);
    },

    async getUserAnalytics() {
        return this.request(`/analytics/user`);
    }
};

// ============================================
// Application State
// ============================================

let currentUser = null;
let currentView = 'auth';
let isSignup = false;
let selectedGroupId = null;
let members = [];
let currentSplitMethod = 'equal';
let groups = [];
let expenses = [];

// ============================================
// Page Navigation
// ============================================

function showPage(pageName) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageName + 'Page').classList.add('active');
    currentView = pageName;

    if (currentUser && pageName !== 'auth') {
        updateProfileMenus();
    }
}

// ============================================
// Auth Functions
// ============================================

document.getElementById('authForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const name = document.getElementById('name').value;
    const phone = document.getElementById('phone').value;

    try {
        let response;

        if (isSignup) {
            // Signup
            response = await API.signup({ name, email, password, phone });
        } else {
            // Login
            response = await API.login({ email, password });
        }

        if (response.success) {
            // Store token
            API.setToken(response.token);

            // Set current user
            currentUser = response.user;

            // Load initial data
            await loadDashboardData();

            // Show dashboard
            showPage('dashboard');
            renderDashboard();
        }
    } catch (error) {
        alert(error.message || 'Authentication failed');
    }
});

document.getElementById('toggleAuth').addEventListener('click', () => {
    isSignup = !isSignup;
    const nameField = document.getElementById('nameField');
    const phoneField = document.getElementById('phoneField');
    const authTitle = document.getElementById('authTitle');
    const authSubtitle = document.getElementById('authSubtitle');
    const authButton = document.getElementById('authButton');
    const toggleAuth = document.getElementById('toggleAuth');

    if (isSignup) {
        nameField.classList.remove('hidden');
        phoneField.classList.remove('hidden');
        authTitle.textContent = 'Join SplitWise';
        authSubtitle.textContent = 'Create your account to start';
        authButton.textContent = 'Create Account';
        toggleAuth.textContent = 'Already have an account? Login';
    } else {
        nameField.classList.add('hidden');
        phoneField.classList.add('hidden');
        authTitle.textContent = 'Welcome Back';
        authSubtitle.textContent = 'Login to manage your expenses';
        authButton.textContent = 'Login';
        toggleAuth.textContent = "Don't have an account? Sign up";
    }
});

// ============================================
// Profile Menu Functions
// ============================================

function updateProfileMenus() {
    const profileName = document.getElementById('profileName');
    if (profileName) profileName.textContent = currentUser.name;

    const dropdownName = document.getElementById('dropdownName');
    if (dropdownName) dropdownName.textContent = currentUser.name;

    const dropdownEmail = document.getElementById('dropdownEmail');
    if (dropdownEmail) dropdownEmail.textContent = currentUser.email;

    const dropdownPhone = document.getElementById('dropdownPhone');
    if (dropdownPhone) {
        if (currentUser.phone) {
            dropdownPhone.textContent = currentUser.phone;
            dropdownPhone.style.display = 'block';
        } else {
            dropdownPhone.style.display = 'none';
        }
    }
}

document.addEventListener('click', (e) => {
    const profileButton = e.target.closest('#profileButton');
    const profileDropdown = document.getElementById('profileDropdown');

    if (profileButton) {
        profileButton.classList.toggle('active');
        profileDropdown.classList.toggle('hidden');
    } else if (!e.target.closest('.profile-dropdown')) {
        const button = document.getElementById('profileButton');
        if (button) button.classList.remove('active');
        if (profileDropdown) profileDropdown.classList.add('hidden');
    }
});

const logoutButton = document.getElementById('logoutButton');
if (logoutButton) {
    logoutButton.addEventListener('click', () => {
        API.removeToken();
        currentUser = null;
        selectedGroupId = null;
        groups = [];
        expenses = [];
        showPage('auth');
        document.getElementById('authForm').reset();
    });
}

// ============================================
// Dashboard Functions
// ============================================

async function loadDashboardData() {
    try {
        const groupsResponse = await API.getGroups();
        groups = groupsResponse.groups.map(g => ({
            id: g.id,
            name: g.name,
            members: g.members
        }));
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        alert('Error loading data');
    }
}

function renderDashboard() {
    document.getElementById('userName').textContent = currentUser.name;
    const groupsList = document.getElementById('groupsList');

    if (groups.length === 0) {
        groupsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                </div>
                <h3>No groups yet</h3>
                <p>Create your first group to start tracking expenses!</p>
                <button class="btn btn-primary" onclick="showPage('createGroup')">
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Get Started
                </button>
            </div>
        `;
    } else {
        groupsList.innerHTML = groups.map(group => `
            <div class="group-card" onclick="viewGroup('${group.id}')">
                <div class="group-card-header">
                    <div class="group-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                    </div>
                    <svg class="group-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                </div>
                <h3>${group.name}</h3>
                <div class="group-members">
                    <div class="member-avatars">
                        ${group.members.slice(0, 3).map(() => '<div class="member-avatar"></div>').join('')}
                    </div>
                    <p>${group.members.length} member${group.members.length !== 1 ? 's' : ''}</p>
                </div>
            </div>
        `).join('');
    }
}

document.getElementById('createGroupBtn').addEventListener('click', () => {
    showPage('createGroup');
    members = [];
    renderMembersList();
});

document.getElementById('viewAnalyticsBtn').addEventListener('click', async () => {
    selectedGroupId = null;
    showPage('analytics');
    await renderAnalytics();
});

async function viewGroup(groupId) {
    selectedGroupId = groupId;
    showPage('groupDetails');
    await renderGroupDetails();
}

// ============================================
// Create Group Functions
// ============================================

document.getElementById('addMemberBtn').addEventListener('click', () => {
    const input = document.getElementById('memberInput');
    const memberName = input.value.trim();

    if (memberName && !members.includes(memberName)) {
        members.push(memberName);
        renderMembersList();
        input.value = '';
    }
});

document.getElementById('memberInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('addMemberBtn').click();
    }
});

function renderMembersList() {
    const membersList = document.getElementById('membersList');

    if (members.length === 0) {
        membersList.innerHTML = `
            <div style="background: #f3e8ff; border: 1px solid #e9d5ff; border-radius: 0.75rem; padding: 1.25rem; text-align: center; margin-top: 1rem;">
                <svg style="width: 2rem; height: 2rem; color: #a855f7; margin: 0 auto 0.5rem;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                <p style="color: #9333ea;">Add at least one member to continue</p>
            </div>
        `;
    } else {
        membersList.innerHTML = `
            <p style="color: #374151; font-weight: 500; margin-bottom: 0.75rem;">Members (${members.length}):</p>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.75rem;">
                ${members.map(member => `
                    <div class="member-tag">
                        <div class="member-tag-content">
                            <div class="member-tag-avatar">${member.charAt(0)}</div>
                            <span style="color: #374151;">${member}</span>
                        </div>
                        <button type="button" class="remove-member" onclick="removeMember('${member}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
    }
}

function removeMember(memberName) {
    members = members.filter(m => m !== memberName);
    renderMembersList();
}

document.getElementById('createGroupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const groupName = document.getElementById('groupName').value.trim();

    if (groupName && members.length > 0) {
        try {
            const response = await API.createGroup({
                name: groupName,
                members: members
            });

            if (response.success) {
                document.getElementById('createGroupForm').reset();
                members = [];
                await loadDashboardData();
                showPage('dashboard');
                renderDashboard();
            }
        } catch (error) {
            alert(error.message || 'Error creating group');
        }
    }
});

document.getElementById('backFromCreateGroup').addEventListener('click', () => {
    showPage('dashboard');
});

// ============================================
// Group Details Functions
// ============================================

async function renderGroupDetails() {
    try {
        // Get group and analytics data
        const [groupResponse, analyticsResponse, expensesResponse] = await Promise.all([
            API.getGroup(selectedGroupId),
            API.getGroupAnalytics(selectedGroupId),
            API.getGroupExpenses(selectedGroupId)
        ]);

        const group = groupResponse.group;
        const analytics = analyticsResponse.analytics;
        const groupExpenses = expensesResponse.expenses;

        // Update page header
        document.getElementById('groupDetailsName').textContent = group.name;
        document.getElementById('groupDetailsMembersCount').innerHTML = `
            <svg class="icon" style="display: inline; vertical-align: middle; margin-right: 0.25rem;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            ${group.members.length} members
        `;

        // Render stats
        document.getElementById('groupStats').innerHTML = `
            <div class="stat-card">
                <div class="stat-header">
                    <div class="stat-icon green">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                            <polyline points="17 6 23 6 23 12"></polyline>
                        </svg>
                    </div>
                    <h3>Total Spent</h3>
                </div>
                <p class="stat-value">Rs ${analytics.totalSpending.toFixed(2)}</p>
            </div>
            <div class="stat-card">
                <div class="stat-header">
                    <div class="stat-icon blue">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="1" x2="12" y2="23"></line>
                            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                        </svg>
                    </div>
                    <h3>Per Person</h3>
                </div>
                <p class="stat-value">Rs ${analytics.splitPerPerson.toFixed(2)}</p>
            </div>
            <div class="stat-card">
                <div class="stat-header">
                    <div class="stat-icon purple">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                    </div>
                    <h3>Expenses</h3>
                </div>
                <p class="stat-value">${analytics.totalExpenses}</p>
            </div>
        `;

        // Render members, balances, and settlements
        document.getElementById('groupDetailsContent').innerHTML = `
            <div class="details-card">
                <h3>
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    Members
                </h3>
                <div class="member-list">
                    ${group.members.map(member => `
                        <div class="member-item">
                            <div class="member-item-avatar">${member.charAt(0)}</div>
                            <span>${member}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="details-card">
                <h3>
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="1" x2="12" y2="23"></line>
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                    </svg>
                    Balances
                </h3>
                <div class="balance-list">
                    ${Object.entries(analytics.balances).map(([member, balance]) => {
            const className = balance > 0.01 ? 'positive' : balance < -0.01 ? 'negative' : 'settled';
            const text = balance > 0.01 ? `+Rs ${balance.toFixed(2)}` : balance < -0.01 ? `-Rs ${Math.abs(balance).toFixed(2)}` : 'Settled';
            return `
                            <div class="balance-item">
                                <span>${member}</span>
                                <span class="balance-amount ${className}">${text}</span>
                            </div>
                        `;
        }).join('')}
                </div>
            </div>
            <div class="details-card">
                <h3>
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="1" x2="12" y2="23"></line>
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                    </svg>
                    Settlements
                </h3>
                <div class="settlement-list">
                    ${analytics.settlements.map(settlement => `
                        <div class="settlement-item">
                            <span>${settlement.from} owes ${settlement.to}</span>
                            <span class="settlement-amount">Rs ${settlement.amount.toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        // Render expenses
        const expensesList = document.getElementById('expensesList');
        if (groupExpenses.length === 0) {
            expensesList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="1" x2="12" y2="23"></line>
                            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                        </svg>
                    </div>
                    <p>No expenses yet</p>
                    <button class="btn btn-primary" onclick="showAddExpense()">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Add First Expense
                    </button>
                </div>
            `;
        } else {
            expensesList.innerHTML = groupExpenses.map(expense => `
                <div class="expense-item">
                    <div class="expense-left">
                        <div class="expense-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="1" x2="12" y2="23"></line>
                                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                            </svg>
                        </div>
                        <div class="expense-details">
                            <h3>${expense.title}</h3>
                            <div class="expense-meta">
                                <span>Paid by ${expense.paidBy}</span>
                                <span>•</span>
                                <span>
                                    <svg class="icon" style="display: inline; vertical-align: middle;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                        <line x1="16" y1="2" x2="16" y2="6"></line>
                                        <line x1="8" y1="2" x2="8" y2="6"></line>
                                        <line x1="3" y1="10" x2="21" y2="10"></line>
                                    </svg>
                                    ${new Date(expense.date).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="expense-right">
                        <span class="expense-amount">Rs ${expense.amount.toFixed(2)}</span>
                        <button class="delete-btn" onclick="deleteExpense('${expense.id}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error rendering group details:', error);
        alert('Error loading group details');
    }
}

async function showAddExpense() {
    showPage('addExpense');

    try {
        const groupResponse = await API.getGroup(selectedGroupId);
        const group = groupResponse.group;

        document.getElementById('addExpenseGroupName').textContent = `Record a new expense for ${group.name}`;

        // Populate members dropdown
        const select = document.getElementById('expensePaidBy');
        select.innerHTML = group.members.map(member =>
            `<option value="${member}">${member}</option>`
        ).join('');

        // Populate member checkboxes
        const checkboxesContainer = document.getElementById('splitMembersCheckboxes');
        checkboxesContainer.innerHTML = group.members.map(member => `
            <label class="checkbox-item checked" data-member="${member}">
                <input type="checkbox" name="splitMember" value="${member}" checked onchange="toggleCheckboxItem(this)">
                <div class="checkbox-label">
                    <div class="checkbox-avatar">${member.charAt(0)}</div>
                    <span>${member}</span>
                </div>
            </label>
        `).join('');

        // Set today's date
        document.getElementById('expenseDate').valueAsDate = new Date();
    } catch (error) {
        console.error('Error loading expense form:', error);
        alert('Error loading expense form');
    }
}

function toggleCheckboxItem(checkbox) {
    const item = checkbox.closest('.checkbox-item');
    if (checkbox.checked) {
        item.classList.add('checked');
    } else {
        item.classList.remove('checked');
    }

    if (currentSplitMethod === 'custom') {
        renderCustomAmounts();
    }
}

async function deleteExpense(expenseId) {
    if (confirm('Are you sure you want to delete this expense?')) {
        try {
            await API.deleteExpense(expenseId);
            await renderGroupDetails();
        } catch (error) {
            console.error('Error deleting expense:', error);
            alert('Error deleting expense');
        }
    }
}

async function deleteGroup(groupId) {
    if (confirm('Are you sure you want to delete this group? This will also delete all expenses in this group.')) {
        try {
            await API.deleteGroup(groupId);
            await loadDashboardData();
            showPage('dashboard');
            renderDashboard();
        } catch (error) {
            console.error('Error deleting group:', error);
            alert('Error deleting group');
        }
    }
}

document.getElementById('backFromGroupDetails').addEventListener('click', () => {
    showPage('dashboard');
    renderDashboard();
});

document.getElementById('addExpenseBtn').addEventListener('click', showAddExpense);

document.getElementById('deleteGroupBtn').addEventListener('click', () => {
    if (selectedGroupId) {
        deleteGroup(selectedGroupId);
    }
}); 

document.getElementById('groupAnalyticsBtn').addEventListener('click', async () => {
    showPage('analytics');
    await renderAnalytics();
});

// ============================================
// Add Expense Functions
// ============================================

document.getElementById('addExpenseForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const selectedMembers = Array.from(document.querySelectorAll('input[name="splitMember"]:checked'))
        .map(checkbox => checkbox.value);

    if (selectedMembers.length === 0) {
        alert('Please select at least one member to split the expense among');
        return;
    }

    const totalAmount = parseFloat(document.getElementById('expenseAmount').value);
    let customAmounts = null;

    // Validate custom amounts if in custom mode
    if (currentSplitMethod === 'custom') {
        const customInputs = document.querySelectorAll('.custom-amount-input');
        let sum = 0;
        customAmounts = {};

        customInputs.forEach(input => {
            const member = input.dataset.member;
            const value = parseFloat(input.value) || 0;
            customAmounts[member] = value;
            sum += value;
        });

        const difference = Math.abs(sum - totalAmount);
        if (difference >= 0.01) {
            alert(`Custom amounts (Rs ${sum.toFixed(2)}) don't match the total expense amount (Rs ${totalAmount.toFixed(2)})`);
            return;
        }
    }

    try {
        const expenseData = {
            groupId: selectedGroupId,
            title: document.getElementById('expenseTitle').value,
            amount: totalAmount,
            paidBy: document.getElementById('expensePaidBy').value,
            date: document.getElementById('expenseDate').value,
            splitAmong: selectedMembers,
            splitMethod: currentSplitMethod,
            customAmounts: currentSplitMethod === 'custom' ? customAmounts : null
        };

        const response = await API.createExpense(expenseData);

        if (response.success) {
            document.getElementById('addExpenseForm').reset();
            currentSplitMethod = 'equal';
            showPage('groupDetails');
            await renderGroupDetails();
        }
    } catch (error) {
        console.error('Error creating expense:', error);
        alert(error.message || 'Error creating expense');
    }
});
document.getElementById('backFromAddExpense').addEventListener('click', () => {
    showPage('groupDetails');
});

// ============================================
// Analytics Functions
// ============================================

// Global chart instances
let lineChartInstance = null;
let pieChartInstance = null;

async function renderAnalytics() {
    try {
        let analyticsData;
        if (selectedGroupId) {
            // Group analytics
            const response = await API.getGroupAnalytics(selectedGroupId);
            analyticsData = response.analytics;

            const groupResponse = await API.getGroup(selectedGroupId);
            document.getElementById('analyticsSubtitle').textContent = `Viewing analytics for ${groupResponse.group.name}`;
        } else {
            // User analytics
            const response = await API.getUserAnalytics();
            analyticsData = response.analytics;
            document.getElementById('analyticsSubtitle').textContent = 'Overview of all your expenses';
        }

        // Render stats
        document.getElementById('analyticsStats').innerHTML = `
        <div class="stat-card">
            <div class="stat-header">
                <div class="stat-icon purple">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="1" x2="12" y2="23"></line>
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                    </svg>
                </div>
                <h3>Total Spent</h3>
            </div>
            <p class="stat-value">Rs ${analyticsData.totalSpending.toFixed(2)}</p>
        </div>
        <div class="stat-card">
            <div class="stat-header">
                <div class="stat-icon blue">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                        <polyline points="17 6 23 6 23 12"></polyline>
                    </svg>
                </div>
                <h3>Avg Expense</h3>
            </div>
            <p class="stat-value">Rs ${analyticsData.averageExpense.toFixed(2)}</p>
        </div>
        <div class="stat-card">
            <div class="stat-header">
                <div class="stat-icon cyan">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                </div>
                <h3>Total Expenses</h3>
            </div>
            <p class="stat-value">${analyticsData.totalExpenses}</p>
        </div>
        <div class="stat-card">
            <div class="stat-header">
                <div class="stat-icon yellow">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="20" x2="18" y2="10"></line>
                        <line x1="12" y1="20" x2="12" y2="4"></line>
                        <line x1="6" y1="20" x2="6" y2="14"></line>
                    </svg>
                </div>
                <h3>Categories</h3>
            </div>
            <p class="stat-value">${Object.keys(analyticsData.categoryData).length}</p>
        </div>
    `;

        // Render Charts
        renderCharts(analyticsData);

        // Recent expenses
        document.getElementById('recentExpensesList').innerHTML = analyticsData.recentExpenses.length > 0
            ? analyticsData.recentExpenses.map(expense => `
            <div class="recent-expense-item">
                <div>
                    <h3>${expense.title}</h3>
                    <p>${expense.paidBy} • ${new Date(expense.date).toLocaleDateString()}</p>
                </div>
                <span style="color: #1f2937; font-weight: 600;">Rs ${expense.amount.toFixed(2)}</span>
            </div>
        `).join('')
            : '<div class="empty-state"><p>No expenses yet</p></div>';

        // Category table
        const colors = ['#9333ea', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];
        const categoryEntries = Object.entries(analyticsData.categoryData);

        if (categoryEntries.length > 0) {
            document.getElementById('categoryTable').innerHTML = `
            <div class="category-table">
                <table>
                    <thead>
                        <tr>
                            <th>Category</th>
                            <th class="right">Total Amount</th>
                            <th class="right">Percentage</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${categoryEntries.map(([category, amount], index) => {
                const percentage = (amount / analyticsData.totalSpending) * 100;
                return `
                                <tr>
                                    <td>
                                        <div class="category-color">
                                            <div class="color-box" style="background-color: ${colors[index % colors.length]}"></div>
                                            <span>${category}</span>
                                        </div>
                                    </td>
                                    <td class="right">Rs ${amount.toFixed(2)}</td>
                                    <td class="right">${percentage.toFixed(1)}%</td>
                                </tr>
                            `;
            }).join('')}
                    </tbody>
                </table>
            </div>
        `;
        } else {
            document.getElementById('categoryTable').innerHTML = '<div class="empty-state"><p>No category data available</p></div>';
        }
    } catch (error) {
        console.error('Error rendering analytics:', error);
        alert('Error loading analytics');
    }
}

function renderCharts(analyticsData) {
    // Destroy existing charts
    if (lineChartInstance) {
        lineChartInstance.destroy();
    }
    if (pieChartInstance) {
        pieChartInstance.destroy();
    }

    // Prepare data for line chart (expenses over time)
    const expensesByDate = {};
    analyticsData.recentExpenses.forEach(expense => {
        const date = new Date(expense.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        expensesByDate[date] = (expensesByDate[date] || 0) + expense.amount;
    });

    const sortedDates = Object.keys(expensesByDate).sort((a, b) => {
        return new Date(a) - new Date(b);
    });

    const lineChartData = {
        labels: sortedDates.length > 0 ? sortedDates : ['No Data'],
        datasets: [{
            label: 'Daily Spending (Rs)',
            data: sortedDates.length > 0 ? sortedDates.map(date => expensesByDate[date]) : [0],
            borderColor: '#9333ea',
            backgroundColor: 'rgba(147, 51, 234, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: '#9333ea',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointHoverBackgroundColor: '#9333ea',
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 3
        }]
    };

    // Prepare data for pie chart (category distribution)
    const categories = Object.keys(analyticsData.categoryData);
    const categoryAmounts = Object.values(analyticsData.categoryData);
    const colors = ['#9333ea', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'];

    const pieChartData = {
        labels: categories.length > 0 ? categories : ['No Data'],
        datasets: [{
            data: categories.length > 0 ? categoryAmounts : [1],
            backgroundColor: categories.length > 0 ? colors.slice(0, categories.length) : ['#e5e7eb'],
            borderColor: '#fff',
            borderWidth: 2,
            hoverOffset: 10
        }]
    };

    // Create Line Chart
    const lineCtx = document.getElementById('lineChart');
    if (lineCtx) {
        lineChartInstance = new Chart(lineCtx, {
            type: 'line',
            data: lineChartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        cornerRadius: 8,
                        titleFont: {
                            size: 14,
                            weight: 'bold'
                        },
                        bodyFont: {
                            size: 13
                        },
                        callbacks: {
                            label: function(context) {
                                return 'Rs ' + context.parsed.y.toFixed(2);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return 'Rs ' + value;
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    }

    // Create Pie Chart
    const pieCtx = document.getElementById('pieChart');
    if (pieCtx) {
        pieChartInstance = new Chart(pieCtx, {
            type: 'doughnut',
            data: pieChartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            font: {
                                size: 12
                            },
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        cornerRadius: 8,
                        titleFont: {
                            size: 14,
                            weight: 'bold'
                        },
                        bodyFont: {
                            size: 13
                        },
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: Rs ${value.toFixed(2)} (${percentage}%)`;
                            }
                        }
                    }
                },
                cutout: '60%'
            }
        });
    }
}

document.getElementById('backFromAnalytics').addEventListener('click', () => {
    if (selectedGroupId) {
        showPage('groupDetails');
    } else {
        showPage('dashboard');
        renderDashboard();
    }
});

// ============================================
// Split Method Functions
// ============================================

function setSplitMethod(method) {
    currentSplitMethod = method;
    document.querySelectorAll('.split-method-btn').forEach(btn => {
        if (btn.dataset.method === method) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    const customAmountsSection = document.getElementById('customAmountsSection');
    if (method === 'custom') {
        customAmountsSection.classList.remove('hidden');
        renderCustomAmounts();
    } else {
        customAmountsSection.classList.add('hidden');
    }
}
function renderCustomAmounts() {
    const selectedCheckboxes = document.querySelectorAll('input[name="splitMember"]:checked');
    const selectedMembers = Array.from(selectedCheckboxes).map(cb => cb.value);
    const totalAmount = parseFloat(document.getElementById('expenseAmount').value) || 0;
    const customAmountsInputs = document.getElementById('customAmountsInputs');

    if (selectedMembers.length === 0) {
        customAmountsInputs.innerHTML = '<p style="color: #6b7280; text-align: center;">Select members first</p>';
        return;
    }

    customAmountsInputs.innerHTML = selectedMembers.map(member => `
    <div class="custom-amount-item">
        <div class="custom-amount-label">
            <div class="custom-amount-avatar">${member.charAt(0)}</div>
            <span>${member}</span>
        </div>
        <input 
            type="number" 
            class="custom-amount-input" 
            data-member="${member}" 
            placeholder="0.00" 
            step="0.01" 
            min="0"
            onchange="validateCustomAmounts()"
            oninput="validateCustomAmounts()"
        >
    </div>
`).join('');

    validateCustomAmounts();
}
function validateCustomAmounts() {
    const totalAmount = parseFloat(document.getElementById('expenseAmount').value) || 0;
    const customInputs = document.querySelectorAll('.custom-amount-input');
    let sum = 0;
    customInputs.forEach(input => {
        const value = parseFloat(input.value) || 0;
        sum += value;
    });

    const validation = document.getElementById('amountValidation');
    const difference = Math.abs(sum - totalAmount);

    if (difference < 0.01 && sum > 0) {
        validation.className = 'amount-validation success';
        validation.textContent = `✓ Amounts match! Total: Rs ${sum.toFixed(2)}`;
    } else if (sum === 0) {
        validation.className = 'amount-validation';
        validation.textContent = `Enter custom amounts for each person (Total: Rs ${totalAmount.toFixed(2)})`;
    } else {
        validation.className = 'amount-validation error';
        validation.textContent = `⚠ Amounts don't match! Entered: Rs ${sum.toFixed(2)} / Required: Rs ${totalAmount.toFixed(2)}`;
    }
}
document.getElementById('expenseAmount').addEventListener('input', () => {
    if (currentSplitMethod === 'custom') {
        validateCustomAmounts();
    }
});

// ============================================
// Initialize App
// ============================================
// Check if user is already logged in

async function initializeApp() {
    const token = API.getToken();
    if (token) {
        try {
            const response = await API.getCurrentUser();
            if (response.success) {
                currentUser = response.user;
                await loadDashboardData();
                showPage('dashboard');
                renderDashboard();
                return;
            }
        } catch (error) {
            console.error('Error loading user:', error);
            API.removeToken();
        }
    }

    showPage('auth');
}

// Start the app
initializeApp();