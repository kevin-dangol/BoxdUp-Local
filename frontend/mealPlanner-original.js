let meals = {
    sunday: null,
    monday: null,
    tuesday: null,
    wednesday: null,
    thursday: null,
    friday: null
};

let currentEditingDay = '';
let currentMeal = {
    protein: null,
    side1: null,
    side2: null
};

//Load saved meals
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        showNotification('Please login to access meal planner', 'error');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
        return;
    }

    await loadSavedMeals();
});

//Get auth headers
function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

//Load saved meals from backend
async function loadSavedMeals() {
    try {
        const response = await fetch('http://localhost:3001/api/mealPlanner/get', {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (response.status === 401) {
            showNotification('Session expired. Please login again.', 'error');
            localStorage.removeItem('token');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            return;
        }

        const data = await response.json();

        if (data.success && data.meals) {
            meals = data.meals;

            Object.keys(meals).forEach(day => {
                if (meals[day]) {
                    updateDayCard(day);
                    updateSummaryCard(day);
                }
            });

            updateProgress();
        }
    } catch (error) {
        console.error('Error loading meals:', error);
        showNotification('Error loading saved meals', 'error');
    }
}

//Save meals to backend
async function saveMealsToBackend() {
    try {
        const response = await fetch('http://localhost:3001/api/mealPlanner/save', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ meals: meals })
        });

        if (response.status === 401) {
            showNotification('Session expired. Please login again.', 'error');
            localStorage.removeItem('token');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            return false;
        }

        const data = await response.json();

        if (data.success) {
            showNotification('Meals saved successfully!', 'success');
            return true;
        } else {
            showNotification(data.message || 'Error saving meals', 'error');
            return false;
        }
    } catch (error) {
        console.error('Error saving meals:', error);
        showNotification('Error saving meals', 'error');
        return false;
    }
}

function openCustomizer(day) {
    currentEditingDay = day;
    document.getElementById('currentDay').textContent = day.charAt(0).toUpperCase() + day.slice(1);
    document.getElementById('customizerModal').classList.add('active');

    // Load existing meal if available
    if (meals[day]) {
        currentMeal = { ...meals[day] };
        highlightSelectedItems();
    } else {
        currentMeal = { protein: null, side1: null, side2: null };
    }
}

function highlightSelectedItems() {
    // Clear all selections first
    document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('selected'));

    // Highlight currently selected items
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

async function saveMeal() {
    if (!currentMeal.protein || !currentMeal.side1 || !currentMeal.side2) {
        showNotification('Please select all items for your meal!', 'error');
        return;
    }

    meals[currentEditingDay] = { ...currentMeal };
    updateDayCard(currentEditingDay);
    updateSummaryCard(currentEditingDay);
    updateProgress();
    closeCustomizer();

    //save to backend
    await saveMealsToBackend();
}

function updateDayCard(day) {
    const card = document.getElementById(day);
    const meal = meals[day];

    if (meal) {
        card.classList.add('completed');
        const preview = card.querySelector('.meal-preview');
        preview.classList.add('filled');

        const totalCals = meal.protein.calories + meal.side1.calories + meal.side2.calories;

        preview.innerHTML = `
            <div class="meal-items">
                <span>${meal.protein.icon}</span>
                <span>${meal.side1.icon}</span>
                <span>${meal.side2.icon}</span>
            </div>
            <div class="meal-details">
                <div class="meal-name">${meal.protein.name}, ${meal.side1.name}, ${meal.side2.name}</div>
                <div class="filled-meal-calories">${totalCals} calories total</div>
            </div>
        `;

        card.querySelector('.day-status').textContent = '✅';
    }
}

function updateSummaryCard(day) {
    const card = document.getElementById(day + "Summary");
    const meal = meals[day];

    if (meal) {
        const preview = card.querySelector('.day-info');
        const totalCals = meal.protein.calories + meal.side1.calories + meal.side2.calories;
        preview.innerHTML = `
            <div class="day-name">${day}</div>
            <div class="meal-items">
                <span>${meal.protein.icon}</span>
                <span>${meal.side1.icon}</span>
                <span>${meal.side2.icon}</span>
            </div>
            <div class="meal-description">${meal.protein.name}, ${meal.side1.name}, ${meal.side2.name}</div>
            <div class="filled-meal-calories">${totalCals} calories total</div>
        `;
    }
}

function updateProgress() {
    const completed = Object.values(meals).filter(meal => meal !== null).length;
    document.getElementById('completedCount').textContent = completed;
    document.getElementById('progressBar').style.width = (completed / 6 * 100) + '%';
}

async function applyPresetToAll(preset) {
    const presets = {
        balanced: {
            protein: { name: 'Teriyaki Chicken', calories: 280, icon: '🍗' },
            side1: { name: 'Edamame', calories: 120, icon: '🫘' },
            side2: { name: 'Steamed Rice', calories: 150, icon: '🍚' }
        },
        protein: {
            protein: { name: 'Beef Bulgogi', calories: 350, icon: '🥩' },
            side1: { name: 'Seaweed Salad', calories: 90, icon: '🥬' },
            side2: { name: 'Steamed Rice', calories: 150, icon: '🍚' }
        },
        veggie: {
            protein: { name: 'Tofu Katsu', calories: 240, icon: '🧈' },
            side1: { name: 'Spring Rolls', calories: 180, icon: '🥟' },
            side2: { name: 'Seaweed Salad', calories: 90, icon: '🥬' }
        }
    };

    const selectedPreset = presets[preset];
    Object.keys(meals).forEach(day => {
        meals[day] = { ...selectedPreset };
        updateDayCard(day);
        updateSummaryCard(day);
    });
    updateProgress();

    //Save to backend
    await saveMealsToBackend();
}

async function randomizeWeek() {
    const proteins = [
        { name: 'Teriyaki Chicken', calories: 280, icon: '🍗' },
        { name: 'Salmon Fillet', calories: 320, icon: '🐟' },
        { name: 'Beef Bulgogi', calories: 350, icon: '🥩' },
        { name: 'Tofu Katsu', calories: 240, icon: '🧈' },
        { name: 'Grilled Shrimp', calories: 180, icon: '🦐' }
    ];

    const sides1 = [
        { name: 'Edamame', calories: 120, icon: '🫘' },
        { name: 'Spring Rolls', calories: 180, icon: '🥟' },
        { name: 'Seaweed Salad', calories: 90, icon: '🥬' },
        { name: 'Gyoza', calories: 200, icon: '🥟' }
    ];

    const sides2 = [
        { name: 'Steamed Rice', calories: 150, icon: '🍚' },
        { name: 'Fried Rice', calories: 220, icon: '🍛' },
        { name: 'Pickled Veggies', calories: 40, icon: '🥒' },
        { name: 'Miso Soup', calories: 60, icon: '🍵' }
    ];

    Object.keys(meals).forEach(day => {
        meals[day] = {
            protein: proteins[Math.floor(Math.random() * proteins.length)],
            side1: sides1[Math.floor(Math.random() * sides1.length)],
            side2: sides2[Math.floor(Math.random() * sides2.length)]
        };
        updateDayCard(day);
        updateSummaryCard(day);
    });
    updateProgress();

    //Save to backend
    await saveMealsToBackend();
}

//Navigation functions
let mealplanner1, mealplanner2, mealplanner3;

document.addEventListener('DOMContentLoaded', () => {
    mealplanner1 = document.querySelector('.meal-planner-1');
    mealplanner2 = document.querySelector('.meal-planner-2');
    mealplanner3 = document.querySelector('.meal-planner-3');
});


function proccedto1() {
    mealplanner1.style.display = 'block';
    mealplanner2.style.display = 'none';
    mealplanner3.style.display = 'none';
}

async function proccedto2() {
    const completed = Object.values(meals).filter(meal => meal !== null).length;
    if (completed < 6) {
        showNotification('Please complete all 6 days before proceeding.', 'error');
        return;
    }

    // Save meals before proceeding
    const saved = await saveMealsToBackend();
    if (!saved) return;

    mealplanner1.style.display = 'none';
    mealplanner2.style.display = 'block';
    mealplanner3.style.display = 'none';
}

function backTo2() {
    mealplanner1.style.display = 'none';
    mealplanner2.style.display = 'block';
    mealplanner3.style.display = 'none';
}

function proccedto3() {
    // Validate form
    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;
    const email = document.getElementById('email').value;
    const number = document.getElementById('number').value;
    const address = document.getElementById('address').value;
    const cardNumber = document.getElementById('cardNumber').value;
    const cardExpiry = document.getElementById('cardExpiry').value;
    const cardCvv = document.getElementById('cardCvv').value;
    const cardHolder = document.getElementById('cardHolder').value;

    if (!firstName || !lastName || !email || !number || !address) {
        showNotification('Please fill in all personal information', 'error');
        return;
    }

    if (!cardNumber || !cardExpiry || !cardCvv || !cardHolder) {
        showNotification('Please fill in all payment information', 'error');
        return;
    }

    mealplanner1.style.display = 'none';
    mealplanner2.style.display = 'none';
    mealplanner3.style.display = 'block';
}

// Place order function
async function placeOrder() {
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

    try {
        const response = await fetch('http://localhost:3001/api/mealPlanner/checkout', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                firstName,
                lastName,
                email,
                number,
                address,
                cardNumber,
                cardExpiry,
                cardCvv,
                cardHolder,
                subscriptionType,
                deliveryTime
            })
        });

        if (response.status === 401) {
            showNotification('Session expired. Please login again.', 'error');
            localStorage.removeItem('token');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            return;
        }

        const data = await response.json();

        if (data.success) {
            showNotification('🎉 Order placed successfully! Thank you for choosing Box\'d Up!', 'success');
            setTimeout(() => {
                window.location.href = 'home.html';
            }, 3000);
        } else {
            showNotification(data.message || 'Error placing order', 'error');
        }
    } catch (error) {
        console.error('Error placing order:', error);
        showNotification('Error placing order. Please try again.', 'error');
    }
}