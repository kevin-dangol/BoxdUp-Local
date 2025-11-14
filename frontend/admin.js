let pendingRequests = [];
let foodItems = { main: {}, side1: {}, side2: {} };

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    await loadFoodItems();
    await loadPendingRequests();
});

function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

async function loadFoodItems() {
    try {
        const response = await fetch('http://localhost:3001/api/admin/food-items', {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (data.success) {
            foodItems = data.items;
        }
    } catch (error) {
        console.error('Error loading food items:', error);
    }
}

async function loadPendingRequests() {
    try {
        const response = await fetch('http://localhost:3001/api/admin/pending-requests', {
            headers: getAuthHeaders()
        });

        const data = await response.json();

        if (data.success) {
            pendingRequests = data.requests;
            displayRequests();
        }
    } catch (error) {
        console.error('Error loading requests:', error);
        showNotification('Error loading requests', 'error');
    }
}

function displayRequests() {
    const container = document.getElementById('requestsContainer');

    if (pendingRequests.length === 0) {
        container.innerHTML = '<div class="no-meal">No pending requests</div>';
        return;
    }

    container.innerHTML = '';

    pendingRequests.forEach(request => {
        const card = createRequestCard(request);
        container.appendChild(card);
    });
}

function createRequestCard(request) {
    const card = document.createElement('div');
    card.className = 'request-card pending';

    const mainDishes = JSON.parse(request.main_dishes);
    const side1Dishes = JSON.parse(request.side1_dishes);
    const side2Dishes = JSON.parse(request.side2_dishes);
    const allergies = JSON.parse(request.allergies);

    card.innerHTML = `
                <div class="request-header">
                    <div>
                        <h2>${request.first_name} ${request.last_name}</h2>
                        <p style="color: #a8a095;">Request #${request.request_id} • ${new Date(request.created_at).toLocaleDateString()}</p>
                    </div>
                    <div style="background: rgba(255, 152, 0, 0.2); padding: 8px 20px; border-radius: 20px; color: #ff9800;">
                        ⏳ Pending
                    </div>
                </div>

                <div class="user-info">
                    <div class="info-box">
                        <div class="info-label">Email</div>
                        <div class="info-value">${request.email}</div>
                    </div>
                    <div class="info-box">
                        <div class="info-label">Phone</div>
                        <div class="info-value">${request.phone}</div>
                    </div>
                    <div class="info-box">
                        <div class="info-label">Address</div>
                        <div class="info-value">${request.address}</div>
                    </div>
                    <div class="info-box">
                        <div class="info-label">Diet Type</div>
                        <div class="info-value">${request.diet_type}</div>
                    </div>
                    <div class="info-box">
                        <div class="info-label">Protein Level</div>
                        <div class="info-value">${request.protein_level}</div>
                    </div>
                    <div class="info-box">
                        <div class="info-label">Allergies</div>
                        <div class="info-value">${allergies.length > 0 ? allergies.join(', ') : 'None'}</div>
                    </div>
                </div>

                <div class="foods-section">
                    <h3>Selected Main Dishes</h3>
                    <div class="foods-grid">
                        ${mainDishes.map(d => `<div class="food-chip">${d.icon} ${d.name}</div>`).join('')}
                    </div>
                </div>

                <div class="foods-section">
                    <h3>Selected Side Dishes (Set 1)</h3>
                    <div class="foods-grid">
                        ${side1Dishes.map(d => `<div class="food-chip">${d.icon} ${d.name}</div>`).join('')}
                    </div>
                </div>

                <div class="foods-section">
                    <h3>Selected Side Dishes (Set 2)</h3>
                    <div class="foods-grid">
                        ${side2Dishes.map(d => `<div class="food-chip">${d.icon} ${d.name}</div>`).join('')}
                    </div>
                </div>

                <div class="assignment-section">
                    <h3>📅 Assign Meals to Days</h3>
                    ${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day, i) => `
                        <div class="day-assignment">
                            <div class="day-assignment-header">${day}</div>
                            <div class="assignment-selects">
                                <select class="assignment-select" id="main-${request.request_id}-${i}">
                                    <option value="">Select Main Dish</option>
                                    ${mainDishes.map(d => `<option value="${d.id}">${d.icon} ${d.name}</option>`).join('')}
                                </select>
                                <select class="assignment-select" id="side1-${request.request_id}-${i}">
                                    <option value="">Select Side 1</option>
                                    ${side1Dishes.map(d => `<option value="${d.id}">${d.icon} ${d.name}</option>`).join('')}
                                </select>
                                <select class="assignment-select" id="side2-${request.request_id}-${i}">
                                    <option value="">Select Side 2</option>
                                    ${side2Dishes.map(d => `<option value="${d.id}">${d.icon} ${d.name}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <div class="action-footer">
                    <button class="control-btn btn-primary accept-button" onclick="approveRequest(${request.request_id}, ${request.user_id})">Approve</button>
                    <button class="control-btn btn-cancel reject-button" onclick="rejectRequest(${request.request_id})">Reject</button>
                </div>
            `;

    return card;
}

async function approveRequest(requestId, userId) {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const assignments = [];

    // Collect all assignments
    for (let i = 0; i < 5; i++) {
        const mainId = document.getElementById(`main-${requestId}-${i}`).value;
        const side1Id = document.getElementById(`side1-${requestId}-${i}`).value;
        const side2Id = document.getElementById(`side2-${requestId}-${i}`).value;

        if (!mainId || !side1Id || !side2Id) {
            showNotification(`Please assign all meals for ${days[i]}`, 'error');
            return;
        }

        assignments.push({
            day: days[i],
            mainId: parseInt(mainId),
            side1Id: parseInt(side1Id),
            side2Id: parseInt(side2Id)
        });
    }

    try {
        const response = await fetch('http://localhost:3001/api/admin/approve-request', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ requestId, userId, assignments })
        });

        const data = await response.json();

        if (data.success) {
            showNotification('Request approved successfully!', 'success');
            await loadPendingRequests();
        } else {
            showNotification(data.message || 'Error approving request', 'error');
        }
    } catch (error) {
        console.error('Error approving request:', error);
        showNotification('Error approving request', 'error');
    }
}

async function rejectRequest(requestId) {
    if (!confirm('Are you sure you want to reject this request?')) return;

    try {
        const response = await fetch('http://localhost:3001/api/admin/reject-request', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ requestId })
        });

        const data = await response.json();

        if (data.success) {
            showNotification('Request rejected', 'info');
            await loadPendingRequests();
        } else {
            showNotification(data.message || 'Error rejecting request', 'error');
        }
    } catch (error) {
        console.error('Error rejecting request:', error);
        showNotification('Error rejecting request', 'error');
    }
}