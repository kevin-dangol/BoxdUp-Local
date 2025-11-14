// Meal Planner State
let preferences = {
    dietType: 'any',
    proteinLevel: 'normal',
    allergies: [],
    spiceLevel: 'medium'
};

let selectedFoods = {
    mainDishes: [],
    side1Dishes: [],
    side2Dishes: []
};

let userInfo = {};
let requestStatus = 'none'; // none, pending, approved, rejected
let hasActiveSubscription = false;

// Load data on page load
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        showNotification('Please login to access meal planner', 'error');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
        return;
    }

    await checkUserStatus();
});

// Get auth headers
function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

// Check user's complete status (request + subscription)
async function checkUserStatus() {
    try {
        const response = await fetch('http://localhost:3001/api/mealPlanner/user-status', {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                requestStatus = data.requestStatus;
                hasActiveSubscription = data.hasActiveSubscription;

                // Route user based on their status
                if (hasActiveSubscription) {
                    // User has active subscription - redirect to dashboard
                    showNotification('You already have an active subscription!', 'info');
                    setTimeout(() => {
                        window.location.href = 'dashboard.html';
                    }, 1500);
                } else if (requestStatus === 'pending') {
                    // User has pending request
                    showStep(4);
                    displayPendingMessage();
                } else if (requestStatus === 'approved') {
                    // Request approved, go to checkout
                    showStep(5);
                    await loadApprovedMeals();
                } else {
                    // New user - start from step 1
                    showStep(1);
                }
            }
        }
    } catch (error) {
        console.error('Error checking user status:', error);
        showStep(1); // Default to step 1 on error
    }
}

// Check if user has pending/approved request
async function checkRequestStatus() {
    try {
        const response = await fetch('http://localhost:3001/api/mealPlanner/request-status', {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success && data.request) {
                requestStatus = data.request.status;

                if (requestStatus === 'pending') {
                    showStep(4);
                    displayPendingMessage();
                } else if (requestStatus === 'approved') {
                    showStep(5);
                    await loadApprovedMeals();
                }
            }
        }
    } catch (error) {
        console.error('Error checking request status:', error);
    }
}

// Step 1: Preferences
function savePreferences() {
    const dietType = document.querySelector('input[name="dietType"]:checked')?.value;
    const proteinLevel = document.getElementById('proteinLevel').value;
    const spiceLevel = document.getElementById('spiceLevel').value;

    // Get checked allergies
    const allergies = [];
    document.querySelectorAll('input[name="allergies"]:checked').forEach(checkbox => {
        allergies.push(checkbox.value);
    });

    if (!dietType) {
        showNotification('Please select a diet preference', 'error');
        return;
    }

    preferences = {
        dietType,
        proteinLevel,
        allergies,
        spiceLevel
    };

    showNotification('Preferences saved!', 'success');
    showStep(2);
}

// Step 2: User Info
function saveUserInfo() {
    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;
    const email = document.getElementById('email').value;
    const number = document.getElementById('number').value;
    const address = document.getElementById('address').value;
    const cardNumber = document.getElementById('cardNumber').value;
    const cardExpiry = document.getElementById('cardExpiry').value;
    const cardCvv = document.getElementById('cardCvv').value;
    const cardHolder = document.getElementById('cardHolder').value;
    const subscriptionType = document.getElementById('subscriptionType').value;
    const deliveryTime = document.getElementById('deliveryTime').value;

    // Validation
    if (!firstName || !lastName || !email || !number || !address) {
        showNotification('Please fill in all personal information', 'error');
        return;
    }

    if (!cardNumber || !cardExpiry || !cardCvv || !cardHolder) {
        showNotification('Please fill in all payment information', 'error');
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showNotification('Please enter a valid email address', 'error');
        return;
    }

    userInfo = {
        firstName, lastName, email, number, address,
        cardNumber, cardExpiry, cardCvv, cardHolder,
        subscriptionType, deliveryTime
    };

    showNotification('Information saved!', 'success');
    showStep(3);
    loadFoodOptions();
}

// Step 3: Food Selection
async function loadFoodOptions() {
    try {
        const response = await fetch('http://localhost:3001/api/mealPlanner/food-options', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ preferences })
        });

        const data = await response.json();

        if (data.success) {
            displayFoodOptions(data.foods);
        }
    } catch (error) {
        console.error('Error loading food options:', error);
        showNotification('Error loading food options', 'error');
    }
}

function displayFoodOptions(foods) {
    displayFoodCategory('mainDishes', foods.mainDishes, 'Main Dishes');
    displayFoodCategory('side1Dishes', foods.side1Dishes, 'Side Dishes (Set 1)');
    displayFoodCategory('side2Dishes', foods.side2Dishes, 'Side Dishes (Set 2)');
}

function displayFoodCategory(category, items, title) {
    const container = document.getElementById(category);
    container.innerHTML = `<h3>${title} - Select 5</h3><div class="food-grid" id="${category}Grid"></div>`;

    const grid = document.getElementById(`${category}Grid`);

    items.forEach(item => {
        const foodCard = document.createElement('div');
        foodCard.className = 'food-item';
        foodCard.innerHTML = `
            <div class="food-icon">${item.icon}</div>
            <div class="food-name">${item.name}</div>
            <div class="food-calories">${item.calories} cal</div>
            <div class="food-tags">${item.tags.join(', ')}</div>
        `;

        foodCard.onclick = () => toggleFoodSelection(category, item, foodCard);
        grid.appendChild(foodCard);
    });
}

function toggleFoodSelection(category, item, element) {
    const index = selectedFoods[category].findIndex(f => f.id === item.id);

    if (index > -1) {
        selectedFoods[category].splice(index, 1);
        element.classList.remove('selected');
    } else {
        if (selectedFoods[category].length >= 5) {
            showNotification(`You can only select 5 ${category}`, 'error');
            return;
        }
        selectedFoods[category].push(item);
        element.classList.add('selected');
    }

    updateSelectionCount(category);
}

function updateSelectionCount(category) {
    const count = selectedFoods[category].length;
    const categoryTitle = document.querySelector(`#${category} h3`);
    categoryTitle.textContent = categoryTitle.textContent.split(' - ')[0] + ` - ${count}/5 Selected`;
}

async function submitFoodSelection() {
    // Validate all categories have 5 selections
    if (selectedFoods.mainDishes.length !== 5 ||
        selectedFoods.side1Dishes.length !== 5 ||
        selectedFoods.side2Dishes.length !== 5) {
        showNotification('Please select exactly 5 items from each category', 'error');
        return;
    }

    try {
        const response = await fetch('http://localhost:3001/api/mealPlanner/submit-request', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                preferences,
                userInfo,
                selectedFoods
            })
        });

        const data = await response.json();

        if (data.success) {
            showNotification('Request submitted successfully! Waiting for admin approval.', 'success');
            requestStatus = 'pending';
            showStep(4);
            displayPendingMessage();
        } else {
            showNotification(data.message || 'Error submitting request', 'error');
        }
    } catch (error) {
        console.error('Error submitting request:', error);
        showNotification('Error submitting request', 'error');
    }
}

// Step 4: Pending/Approved Status
function displayPendingMessage() {
    const container = document.getElementById('statusContainer');
    container.innerHTML = `
        <div class="status-card pending">
            <div>
                <div class="status-icon">⏳</div>
                <h3>Request Pending</h3>
            </div>
            <p>Your meal plan request is being reviewed by our team. You'll be notified once it's approved.</p>
            <div class="action-footer">
                <button type="button" class="footer-btn btn-secondary next-button" onclick="checkRequestStatus()">Check Status</button>
            </div>
        </div>
    `;
}

async function loadApprovedMeals() {
    try {
        const response = await fetch('http://localhost:3001/api/mealPlanner/approved-meals', {
            method: 'GET',
            headers: getAuthHeaders()
        });

        const data = await response.json();

        if (data.success) {
            displayApprovedMeals(data.meals);
            // Load user info from the approved request to populate checkout
            await loadRequestInfo();
        }
    } catch (error) {
        console.error('Error loading approved meals:', error);
    }
}

// Load request info for checkout display
async function loadRequestInfo() {
    try {
        const response = await fetch('http://localhost:3001/api/mealPlanner/request-info', {
            method: 'GET',
            headers: getAuthHeaders()
        });

        const data = await response.json();

        if (data.success && data.request) {
            userInfo = {
                firstName: data.request.first_name,
                lastName: data.request.last_name,
                email: data.request.email,
                number: data.request.phone,
                address: data.request.address,
                subscriptionType: data.request.subscription_type,
                deliveryTime: data.request.delivery_time
            };
            // Update the checkout display with loaded info
            displayCheckoutSummary();
        }
    } catch (error) {
        console.error('Error loading request info:', error);
    }
}

function displayApprovedMeals(meals) {
    const container = document.getElementById('approvedMealsContainer');
    container.innerHTML = '<h2>Your Weekly Meal Plan</h2>';

    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

    days.forEach(day => {
        if (meals[day]) {
            const dayCard = document.createElement('div');
            dayCard.className = 'day-summary';
            dayCard.innerHTML = `
                <div class="day-info">
                    <div class="day-name">${day.charAt(0).toUpperCase() + day.slice(1)}</div>
                    <div class="meal-items">
                        <span>${meals[day].main.icon}</span>
                        <span>${meals[day].side1.icon}</span>
                        <span>${meals[day].side2.icon}</span>
                    </div>
                    <div class="meal-description">${meals[day].main.name}, ${meals[day].side1.name}, ${meals[day].side2.name}</div>
                </div>
            `;
            container.appendChild(dayCard);
        }
    });
}

async function proceedToCheckout() {
    showStep(5);
    displayCheckoutSummary();
}

function displayCheckoutSummary() {
    // Populate checkout details
    updateCheckoutDeliveryInfo();
    updateOrderSummary();
}

function updateCheckoutDeliveryInfo() {
    const timeMap = {
        '1': '6:00 AM - 8:00 AM',
        '2': '12:00 PM - 2:00 PM',
        '3': '7:00 PM - 9:00 PM'
    };

    const deliveryInfoSection = document.querySelector('.delivery-info');
    if (deliveryInfoSection) {
        deliveryInfoSection.innerHTML = `
            <div class="info-row">
                <span class="info-icon">👤</span>
                <span><strong>Full Name:</strong> ${userInfo.firstName} ${userInfo.lastName}</span>
            </div>
            <div class="info-row">
                <span class="info-icon">📅</span>
                <span><strong>Start Date:</strong> Next Monday</span>
            </div>
            <div class="info-row">
                <span class="info-icon">🚚</span>
                <span><strong>Delivery:</strong> ${timeMap[userInfo.deliveryTime]}</span>
            </div>
            <div class="info-row">
                <span class="info-icon">📍</span>
                <span><strong>Location:</strong> ${userInfo.address}</span>
            </div>
            <div class="info-row">
                <span class="info-icon">📞</span>
                <span><strong>Number:</strong> ${userInfo.number}</span>
            </div>
        `;
    }
}

function updateOrderSummary() {
    const plans = {
        '1': { name: 'Weekly Subscription', meals: 5, price: 999 },
        '2': { name: 'Monthly Subscription', meals: 20, price: 9999 },
        '3': { name: 'Yearly Subscription', meals: 240, price: 99999 }
    };

    const selectedPlan = plans[userInfo.subscriptionType];

    if (!selectedPlan) {
        console.error('Invalid subscription type:', userInfo.subscriptionType);
        return;
    }

    const summaryRows = document.querySelectorAll('.order-summary .summary-row');
    const totalLabel = document.querySelector('.total-row .summary-label');
    const totalValue = document.querySelector('.total-row .summary-value');

    if (summaryRows.length >= 2) {
        // First row: Subscription type
        summaryRows[0].querySelector('.summary-label').textContent = selectedPlan.name;
        summaryRows[0].querySelector('.summary-value').textContent = `Rs. ${selectedPlan.price.toLocaleString()}.00`;

        // Second row: Total lunches
        summaryRows[1].querySelector('.summary-label').textContent = `${selectedPlan.meals} Lunches`;
        summaryRows[1].querySelector('.summary-value').textContent = 'Included';
    }

    // Total row: Remove subscription name, just show price
    if (totalLabel) {
        totalLabel.textContent = 'Total Due:';
    }
    if (totalValue) {
        totalValue.textContent = `Rs ${selectedPlan.price.toLocaleString()}.00`;
    }
}

async function placeOrder() {
    try {
        const response = await fetch('http://localhost:3001/api/mealPlanner/finalize-order', {
            method: 'POST',
            headers: getAuthHeaders()
        });

        const data = await response.json();

        if (data.success) {
            showNotification('🎉 Order placed successfully! Thank you for choosing Box\'d Up!', 'success');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 3000);
        } else {
            showNotification(data.message || 'Error placing order', 'error');
        }
    } catch (error) {
        console.error('Error placing order:', error);
        showNotification('Error placing order', 'error');
    }
}

// Navigation
function showStep(step) {
    document.querySelectorAll('.meal-planner-step').forEach(el => {
        el.style.display = 'none';
    });

    const stepElement = document.getElementById(`step-${step}`);
    if (stepElement) {
        stepElement.style.display = 'block';
    }

    updateProgressBar(step);
}

function updateProgressBar(activeStep) {
    document.querySelectorAll('.step-circle').forEach((circle, index) => {
        if (index + 1 <= activeStep) {
            circle.classList.add('active');
        } else {
            circle.classList.remove('active');
        }
    });
    const title = document.querySelector('.title');
    if (title) {
        if(activeStep === 1) {
            title.innerHTML = `<h1>Your Meal Preferences</h1>`;
        } else if(activeStep === 2) {
            title.innerHTML = `<h1>Enter Your Details</h1>`;
        } else if(activeStep === 3) {
            title.innerHTML = `<h1>Create Your Meal Plan</h1>`;
        } else if(activeStep === 4) {
            title.innerHTML = `<h1>Pending Request</h1>`;
        } else{
            title.innerHTML = `<h1>Checkout</h1>`;
        }
    }
}

function goBack(currentStep) {
    if (currentStep > 1) {
        showStep(currentStep - 1);
    }
}