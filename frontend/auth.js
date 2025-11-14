//check if the user is logged in or not
async function checkSession() {
    const token = localStorage.getItem('token');
    const loginLink = document.getElementById('login-link');
    const signupLink = document.getElementById('signup-link');
    const profileMenu = document.getElementById('profile-menu');
    const signupButton = document.getElementById('signup-button');
    const adminLink = document.getElementById('admin-link');
    const plansLink = document.querySelector('.nav-link[href="mealplanner.html"]');
    const dashboardLink = document.querySelector('.nav-link[href="dashboard.html"]');

    if (!token) {
        if (loginLink) loginLink.style.display = 'inline-block';
        if (signupLink) signupLink.style.display = 'inline-block';
        if (profileMenu) profileMenu.style.display = 'none';
        if (signupButton) signupButton.style.display = 'inline-block';
        if (adminLink) adminLink.style.display = 'none';
        if (plansLink) plansLink.style.display = 'inline-block';
        if (dashboardLink) dashboardLink.style.display = 'none';
        return;
    }

    try {
        const response = await fetch('http://localhost:3001/api/auth/check-session', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();

        if (result.logged_in) {
            if (loginLink) loginLink.style.display = 'none';
            if (signupLink) signupLink.style.display = 'none';
            if (profileMenu) profileMenu.style.display = 'inline-block';
            if (signupButton) signupButton.style.display = 'none';
            if (adminLink) adminLink.style.display = result.is_admin ? 'block' : 'none';

            // Hide Meal Requests link for non-admin users in dropdown
            const mealRequestsLinks = document.querySelectorAll('.adminLink');
            mealRequestsLinks.forEach(link => {
                link.style.display = result.is_admin ? 'block' : 'none';
            });

            // Check subscription status to show/hide Plans vs Dashboard
            const statusResponse = await fetch('http://localhost:3001/api/mealPlanner/user-status', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (statusResponse.ok) {
                const statusData = await statusResponse.json();
                if (statusData.success && statusData.hasActiveSubscription) {
                    // User has active subscription - show Dashboard, hide Plans
                    if (plansLink) plansLink.style.display = 'none';
                    if (dashboardLink) dashboardLink.style.display = 'inline-block';
                } else {
                    // No subscription - show Plans, hide Dashboard
                    if (plansLink) plansLink.style.display = 'inline-block';
                    if (dashboardLink) dashboardLink.style.display = 'none';
                }
            }

            if (adminLink && window.location.pathname.includes('admin.html')) {
                adminLink.classList.add('active');
            }
        } else {
            localStorage.removeItem('token');
            localStorage.removeItem('is_admin');
            if (loginLink) loginLink.style.display = 'inline-block';
            if (signupLink) signupLink.style.display = 'inline-block';
            if (profileMenu) profileMenu.style.display = 'none';
            if (signupButton) signupButton.style.display = 'inline-block';
            if (adminLink) adminLink.style.display = 'none';
            if (plansLink) plansLink.style.display = 'inline-block';
            if (dashboardLink) dashboardLink.style.display = 'none';
        }
    } catch (error) {
        console.error('Session check error:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('is_admin');
        if (loginLink) loginLink.style.display = 'inline-block';
        if (signupLink) signupLink.style.display = 'inline-block';
        if (profileMenu) profileMenu.style.display = 'none';
        if (signupButton) signupButton.style.display = 'inline-block';
        if (adminLink) adminLink.style.display = 'none';
        if (plansLink) plansLink.style.display = 'inline-block';
        if (dashboardLink) dashboardLink.style.display = 'none';
    }
}

//logout
async function logout() {
    try {
        const response = await fetch('http://localhost:3001/api/auth/logout', {
            method: 'POST',
            // credentials: 'include'
        });
        const result = await response.json();
        showNotification(result.message, 'info');
        if (result.success) {
            localStorage.removeItem('token');
            localStorage.removeItem('is_admin');
            window.location.href = '../../index.html';
        }
    } catch (error) {
        console.error('Logout error:', error);
        showNotification('Failed to log out. Please try again later.', 'error');
    }
}

//run the check on the page
document.addEventListener('DOMContentLoaded', checkSession);