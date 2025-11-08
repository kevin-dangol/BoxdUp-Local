let meals = {};
let subscriptionData = null;
let currentEditingDay = '';
let currentMeal = { protein: null, side1: null, side2: null };
let selectedPlan = null;

// Load dashboard data on page load
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        showNotification('Please login to access dashboard', 'error');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
        return;
    }

    await loadDashboardData();
});

// Get auth headers
function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

// Load all dashboard data
async function loadDashboardData() {
    await loadUserInfo();
    await loadMeals();
    await loadSubscriptionInfo();
}

// Load user info
async function loadUserInfo() {
    try {
        const response = await fetch('http://localhost:3001/api/auth/user', {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const data = await response.json();
        const preview = document.getElementById("dashboard-header");
        console.log('User data:', data);
        if (response.ok) {
            const user = data.user;
            if (user && preview) {
                preview.innerHTML = `
                    <h1>Welcome back, ${user.username}!</h1>
                    <p class="subtitle">Manage your meal subscriptions and preferences</p>
                `;
            }
        }
    } catch (error) {
        console.error('Error loading user info:', error);
    }
}

// Load meals
async function loadMeals() {
    try {
        const response = await fetch('http://localhost:3001/api/mealPlanner/get', {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success && data.meals) {
                meals = data.meals;
                displayCurrentAndNextMeal();
                displayWeeklyMeals();
            }
        }
    } catch (error) {
        console.error('Error loading meals:', error);
        document.getElementById('currentMealContent').innerHTML = '<div class="no-meal">Error loading meals</div>';
        document.getElementById('nextMealContent').innerHTML = '<div class="no-meal">Error loading meals</div>';
    }
}

// Display current and next meal
function displayCurrentAndNextMeal() {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
    const todayName = days[today];

    // Find next day with a meal
    let nextDayIndex = (today + 1) % 7;
    let nextDayName = days[nextDayIndex];

    // Display today's meal
    displayMealInCard('currentMealContent', todayName, meals[todayName]);
    document.getElementById('currentMealTime').textContent = todayName.charAt(0).toUpperCase() + todayName.slice(1);

    // Display next meal
    displayMealInCard('nextMealContent', nextDayName, meals[nextDayName]);
    document.getElementById('nextMealTime').textContent = nextDayName.charAt(0).toUpperCase() + nextDayName.slice(1);
}

// Display meal in a card
function displayMealInCard(elementId, dayName, meal) {
    const element = document.getElementById(elementId);

    if (!meal) {
        element.innerHTML = '<div class="no-meal">No meal planned for ' + dayName + '</div>';
        return;
    }

    const totalCals = meal.protein.calories + meal.side1.calories + meal.side2.calories;

    element.innerHTML = `
        <div class="meal-display">
            <div class="meal-icons">
                <span>${meal.protein.icon}</span>
                <span>${meal.side1.icon}</span>
                <span>${meal.side2.icon}</span>
            </div>
            <ul class="meal-items-list">
                <li>🍗 ${meal.protein.name}</li>
                <li>🥗 ${meal.side1.name}</li>
                <li>🍙 ${meal.side2.name}</li>
            </ul>
            <div class="meal-calories">${totalCals} calories total</div>
        </div>
    `;
}

// Display weekly meals grid
function displayWeeklyMeals() {
    const weeklyGrid = document.getElementById('weeklyMealsGrid');
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const today = new Date().getDay();

    weeklyGrid.innerHTML = '';

    days.forEach((day, index) => {
        const meal = meals[day];
        const isToday = index === today;
        const card = document.createElement('div');
        card.className = 'day-mini-card' + (isToday ? ' active-day' : '');

        if (meal) {
            const totalCals = meal.protein.calories + meal.side1.calories + meal.side2.calories;
            card.innerHTML = `
                <div class="day-name">${day.charAt(0).toUpperCase() + day.slice(1)}</div>
                <div class="mini-meal-icons">
                    ${meal.protein.icon}${meal.side1.icon}${meal.side2.icon}
                </div>
                <div class="mini-calories">${totalCals} cal</div>
            `;
        } else {
            card.innerHTML = `
                <div class="day-name">${day.charAt(0).toUpperCase() + day.slice(1)}</div>
                <div class="mini-meal-icons">❌</div>
                <div class="mini-calories">Not set</div>
            `;
        }

        card.onclick = () => openCustomizer(day);
        weeklyGrid.appendChild(card);
    });
}

// Load subscription info
async function loadSubscriptionInfo() {
    try {
        const response = await fetch('http://localhost:3001/api/mealPlanner/subscription', {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success && data.subscription) {
                subscriptionData = data.subscription;
                displaySubscriptionInfo(data.subscription);
            } else {
                document.getElementById('subscriptionInfo').innerHTML = '<div class="no-meal">No active subscription</div>';
            }
        }
    } catch (error) {
        console.error('Error loading subscription:', error);
        document.getElementById('subscriptionInfo').innerHTML = '<div class="no-meal">Error loading subscription</div>';
    }
}

// Display subscription info
function displaySubscriptionInfo(sub) {
    const planNames = {
        '1': 'Weekly Plan',
        '2': 'Monthly Plan',
        '3': 'Yearly Plan'
    };

    const timeNames = {
        '1': '6:00 AM - 8:00 AM',
        '2': '12:00 PM - 2:00 PM',
        '3': '7:00 PM - 9:00 PM'
    };

    const planPrices = {
        '1': 'Rs. 999/week',
        '2': 'Rs. 9,999/month',
        '3': 'Rs. 99,999/year'
    };

    const infoHtml = `
        <div class="info-item">
            <div class="info-label">Name</div>
            <div class="info-value">${sub.fname} ${sub.lname}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Email</div>
            <div class="info-value">${sub.email}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Phone</div>
            <div class="info-value">${sub.number}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Address</div>
            <div class="info-value">${sub.address}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Subscription Plan</div>
            <div class="info-value">${planNames[sub.s_type] || 'Weekly Plan'}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Price</div>
            <div class="info-value">${planPrices[sub.s_type] || 'Rs. 999/week'}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Delivery Time</div>
            <div class="info-value">${timeNames[sub.d_time] || '6:00 AM - 8:00 AM'}</div>
        </div>
        <div class="info-item">
            <div class="info-label">Payment Method</div>
            <div class="info-value">Card ending in ${sub.card_numb ? sub.card_numb.slice(-4) : '****'}</div>
        </div>
    `;

    document.getElementById('subscriptionInfo').innerHTML = infoHtml;
}

// Open Edit Meals Modal
function openEditMeals() {
    const modal = document.getElementById('editMealsModal');
    const grid = document.getElementById('editMealsGrid');
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

    grid.innerHTML = '';

    days.forEach(day => {
        const meal = meals[day];
        const card = document.createElement('div');
        card.className = 'edit-day-card';

        if (meal) {
            card.innerHTML = `
                <div class="day-name">${day.charAt(0).toUpperCase() + day.slice(1)}</div>
                <div class="mini-meal-icons">${meal.protein.icon}${meal.side1.icon}${meal.side2.icon}</div>
                <div style="margin-top: 10px; font-size: 0.9rem; color: #a8a095;">Click to edit</div>
            `;
        } else {
            card.innerHTML = `
                <div class="day-name">${day.charAt(0).toUpperCase() + day.slice(1)}</div>
                <div class="mini-meal-icons">❌</div>
                <div style="margin-top: 10px; font-size: 0.9rem; color: #a8a095;">Click to set</div>
            `;
        }

        card.onclick = () => {
            closeEditMeals();
            openCustomizer(day);
        };

        grid.appendChild(card);
    });

    modal.classList.add('active');
}

function closeEditMeals() {
    document.getElementById('editMealsModal').classList.remove('active');
}

// Meal Customizer Functions
function openCustomizer(day) {
    currentEditingDay = day;
    document.getElementById('currentDay').textContent = day.charAt(0).toUpperCase() + day.slice(1);
    document.getElementById('customizerModal').classList.add('active');

    if (meals[day]) {
        currentMeal = { ...meals[day] };
        highlightSelectedItems();
    } else {
        currentMeal = { protein: null, side1: null, side2: null };
    }
}

function closeCustomizer() {
    document.getElementById('customizerModal').classList.remove('active');
    document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('selected'));
}

function selectItem(element, category, name, calories, icon) {
    const section = element.closest('.menu-section');
    section.querySelectorAll('.menu-item').forEach(item => item.classList.remove('selected'));
    element.classList.add('selected');

    currentMeal[category] = { name, calories, icon };
}

function highlightSelectedItems() {
    document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('selected'));

    document.querySelectorAll('.menu-item').forEach(item => {
        const name = item.querySelector('.item-name').textContent;

        if (currentMeal.protein && name === currentMeal.protein.name) {
            item.classList.add('selected');
        }
        if (currentMeal.side1 && name === currentMeal.side1.name) {
            item.classList.add('selected');
        }
        if (currentMeal.side2 && name === currentMeal.side2.name) {
            item.classList.add('selected');
        }
    });
}

async function saveMealFromDashboard() {
    if (!currentMeal.protein || !currentMeal.side1 || !currentMeal.side2) {
        showNotification('Please select all items for your meal!', 'error');
        return;
    }

    meals[currentEditingDay] = { ...currentMeal };
    closeCustomizer();

    // Save to backend
    try {
        const response = await fetch('http://localhost:3001/api/mealPlanner/save', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ meals: meals })
        });

        const data = await response.json();

        if (data.success) {
            showNotification('Meal updated successfully!', 'success');
            await loadMeals(); // Reload meals to update display
        } else {
            showNotification(data.message || 'Error saving meal', 'error');
        }
    } catch (error) {
        console.error('Error saving meal:', error);
        showNotification('Error saving meal', 'error');
    }
}

// Open Edit Subscription Modal
function openEditSubscription() {
    if (!subscriptionData) {
        showNotification('No subscription data available', 'error');
        return;
    }

    document.getElementById('editFirstName').value = subscriptionData.fname || '';
    document.getElementById('editLastName').value = subscriptionData.lname || '';
    document.getElementById('editEmail').value = subscriptionData.email || '';
    document.getElementById('editNumber').value = subscriptionData.number || '';
    document.getElementById('editAddress').value = subscriptionData.address || '';
    document.getElementById('editDeliveryTime').value = subscriptionData.d_time || '1';

    document.getElementById('editSubscriptionModal').classList.add('active');
}

function closeEditSubscription() {
    document.getElementById('editSubscriptionModal').classList.remove('active');
}

async function saveSubscriptionChanges() {
    const firstName = document.getElementById('editFirstName').value;
    const lastName = document.getElementById('editLastName').value;
    const email = document.getElementById('editEmail').value;
    const number = document.getElementById('editNumber').value;
    const address = document.getElementById('editAddress').value;
    const deliveryTime = document.getElementById('editDeliveryTime').value;

    if (!firstName || !lastName || !email || !number || !address) {
        showNotification('Please fill in all fields', 'error');
        return;
    }

    try {
        const response = await fetch('http://localhost:3001/api/mealPlanner/update-subscription', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                firstName,
                lastName,
                email,
                number,
                address,
                deliveryTime
            })
        });

        const data = await response.json();

        if (data.success) {
            showNotification('Subscription updated successfully!', 'success');
            closeEditSubscription();
            await loadSubscriptionInfo();
        } else {
            showNotification(data.message || 'Error updating subscription', 'error');
        }
    } catch (error) {
        console.error('Error updating subscription:', error);
        showNotification('Error updating subscription', 'error');
    }
}

// Change Subscription Plan
function openChangeSubscription() {
    if (!subscriptionData) {
        showNotification('No subscription data available', 'error');
        return;
    }

    selectedPlan = subscriptionData.s_type;
    document.getElementById('changeSubscriptionModal').classList.add('active');

    // Highlight current plan
    document.querySelectorAll('.plan-option').forEach((option, index) => {
        option.classList.remove('selected');
        if ((index + 1).toString() === selectedPlan) {
            option.classList.add('selected');
        }
    });
}

function closeChangeSubscription() {
    document.getElementById('changeSubscriptionModal').classList.remove('active');
}

function selectPlan(planId) {
    selectedPlan = planId;
    document.querySelectorAll('.plan-option').forEach(option => {
        option.classList.remove('selected');
    });
    event.currentTarget.classList.add('selected');
}

async function confirmPlanChange() {
    if (!selectedPlan) {
        showNotification('Please select a plan', 'error');
        return;
    }

    if (selectedPlan === subscriptionData.s_type) {
        showNotification('You are already on this plan', 'info');
        return;
    }

    try {
        const response = await fetch('http://localhost:3001/api/mealPlanner/change-plan', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ subscriptionType: selectedPlan })
        });

        const data = await response.json();

        if (data.success) {
            showNotification('Subscription plan changed successfully!', 'success');
            closeChangeSubscription();
            await loadSubscriptionInfo();
        } else {
            showNotification(data.message || 'Error changing plan', 'error');
        }
    } catch (error) {
        console.error('Error changing plan:', error);
        showNotification('Error changing plan', 'error');
    }
}

// Pause Subscription
async function pauseSubscription() {
    if (!confirm('Are you sure you want to pause your subscription? You can resume it anytime.')) {
        return;
    }

    try {
        const response = await fetch('http://localhost:3001/api/mealPlanner/pause-subscription', {
            method: 'POST',
            headers: getAuthHeaders()
        });

        const data = await response.json();

        if (data.success) {
            showNotification('Subscription paused successfully!', 'success');
        } else {
            showNotification(data.message || 'Error pausing subscription', 'error');
        }
    } catch (error) {
        console.error('Error pausing subscription:', error);
        showNotification('Error pausing subscription', 'error');
    }
}

// Cancel Subscription
function confirmCancelSubscription() {
    if (confirm('Are you sure you want to cancel your subscription? This action cannot be undone.')) {
        if (confirm('Please confirm again. All your meal data will be deleted.')) {
            cancelSubscription();
        }
    }
}

async function cancelSubscription() {
    try {
        const response = await fetch('http://localhost:3001/api/mealPlanner/cancel-subscription', {
            method: 'POST',
            headers: getAuthHeaders()
        });

        const data = await response.json();

        if (data.success) {
            showNotification('Subscription cancelled successfully', 'success');
            setTimeout(() => {
                window.location.href = 'home.html';
            }, 2000);
        } else {
            showNotification(data.message || 'Error cancelling subscription', 'error');
        }
    } catch (error) {
        console.error('Error cancelling subscription:', error);
        showNotification('Error cancelling subscription', 'error');
    }
}