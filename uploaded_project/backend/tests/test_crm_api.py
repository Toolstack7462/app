"""
CRM API Backend Tests
Tests for ToolStack CRM system including:
- Admin authentication
- Tools CRUD operations
- Clients CRUD operations
- Bulk assignments
- Activity logs
- Client portal access
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
CRM_API = f"{BASE_URL}/api/crm"

# Test credentials
ADMIN_EMAIL = "admin@toolstack.com"
ADMIN_PASSWORD = "admin123"

# Test data prefixes for cleanup
TEST_PREFIX = "TEST_"


class TestCRMHealth:
    """Health check tests - run first"""
    
    def test_crm_health_endpoint(self):
        """Test CRM health endpoint is accessible"""
        response = requests.get(f"{CRM_API}/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get('status') == 'ok'
        assert data.get('service') == 'ToolStack CRM'
        assert data.get('mongodb') == 'connected'
        print(f"✓ CRM Health: {data}")


class TestAdminAuth:
    """Admin authentication tests"""
    
    def test_admin_login_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(f"{CRM_API}/auth/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get('success') == True
        assert 'token' in data
        assert 'user' in data
        assert data['user']['email'] == ADMIN_EMAIL
        assert data['user']['role'] == 'ADMIN'
        print(f"✓ Admin login successful, token received")
    
    def test_admin_login_invalid_credentials(self):
        """Test admin login with invalid credentials"""
        response = requests.post(f"{CRM_API}/auth/admin/login", json={
            "email": "wrong@email.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        data = response.json()
        assert 'error' in data
        print(f"✓ Invalid credentials rejected: {data['error']}")
    
    def test_admin_login_missing_fields(self):
        """Test admin login with missing fields"""
        response = requests.post(f"{CRM_API}/auth/admin/login", json={
            "email": ADMIN_EMAIL
        })
        # Should fail with 401 since password is missing
        assert response.status_code == 401
        print(f"✓ Missing password rejected")


@pytest.fixture(scope="class")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{CRM_API}/auth/admin/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get('token')
    pytest.skip("Admin authentication failed")


@pytest.fixture(scope="class")
def admin_headers(admin_token):
    """Get headers with admin auth token"""
    return {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }


class TestAdminTools:
    """Admin tools CRUD tests"""
    
    def test_get_tools_list(self, admin_headers):
        """Test getting list of tools"""
        response = requests.get(f"{CRM_API}/admin/tools", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert 'tools' in data
        assert isinstance(data['tools'], list)
        print(f"✓ Got {len(data['tools'])} tools")
    
    def test_create_tool(self, admin_headers):
        """Test creating a new tool"""
        tool_data = {
            "name": f"{TEST_PREFIX}Test Tool",
            "description": "A test tool for automated testing",
            "targetUrl": "https://example.com/test-tool",
            "category": "SEO",
            "status": "active"
        }
        response = requests.post(f"{CRM_API}/admin/tools", headers=admin_headers, json=tool_data)
        assert response.status_code == 201
        data = response.json()
        assert data.get('success') == True
        assert 'tool' in data
        assert data['tool']['name'] == tool_data['name']
        assert data['tool']['targetUrl'] == tool_data['targetUrl']
        print(f"✓ Created tool: {data['tool']['name']}")
        return data['tool']
    
    def test_get_single_tool(self, admin_headers):
        """Test getting a single tool by ID"""
        # First create a tool
        tool_data = {
            "name": f"{TEST_PREFIX}Single Tool Test",
            "targetUrl": "https://example.com/single-test",
            "category": "Marketing"
        }
        create_response = requests.post(f"{CRM_API}/admin/tools", headers=admin_headers, json=tool_data)
        assert create_response.status_code == 201
        tool_id = create_response.json()['tool']['_id']
        
        # Get the tool
        response = requests.get(f"{CRM_API}/admin/tools/{tool_id}", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert 'tool' in data
        assert data['tool']['_id'] == tool_id
        print(f"✓ Retrieved tool: {data['tool']['name']}")
    
    def test_update_tool(self, admin_headers):
        """Test updating a tool"""
        # Create a tool first
        tool_data = {
            "name": f"{TEST_PREFIX}Update Tool Test",
            "targetUrl": "https://example.com/update-test",
            "category": "Design"
        }
        create_response = requests.post(f"{CRM_API}/admin/tools", headers=admin_headers, json=tool_data)
        assert create_response.status_code == 201
        tool_id = create_response.json()['tool']['_id']
        
        # Update the tool
        update_data = {
            "name": f"{TEST_PREFIX}Updated Tool Name",
            "description": "Updated description"
        }
        response = requests.put(f"{CRM_API}/admin/tools/{tool_id}", headers=admin_headers, json=update_data)
        assert response.status_code == 200
        data = response.json()
        assert data.get('success') == True
        assert data['tool']['name'] == update_data['name']
        print(f"✓ Updated tool: {data['tool']['name']}")
    
    def test_toggle_tool_status(self, admin_headers):
        """Test toggling tool status"""
        # Create a tool first
        tool_data = {
            "name": f"{TEST_PREFIX}Toggle Status Test",
            "targetUrl": "https://example.com/toggle-test",
            "status": "active"
        }
        create_response = requests.post(f"{CRM_API}/admin/tools", headers=admin_headers, json=tool_data)
        assert create_response.status_code == 201
        tool_id = create_response.json()['tool']['_id']
        
        # Toggle status
        response = requests.patch(f"{CRM_API}/admin/tools/{tool_id}/status", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get('success') == True
        assert data['tool']['status'] == 'inactive'
        print(f"✓ Toggled tool status to: {data['tool']['status']}")
    
    def test_delete_tool(self, admin_headers):
        """Test deleting a tool"""
        # Create a tool first
        tool_data = {
            "name": f"{TEST_PREFIX}Delete Tool Test",
            "targetUrl": "https://example.com/delete-test"
        }
        create_response = requests.post(f"{CRM_API}/admin/tools", headers=admin_headers, json=tool_data)
        assert create_response.status_code == 201
        tool_id = create_response.json()['tool']['_id']
        
        # Delete the tool
        response = requests.delete(f"{CRM_API}/admin/tools/{tool_id}", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get('success') == True
        
        # Verify deletion
        get_response = requests.get(f"{CRM_API}/admin/tools/{tool_id}", headers=admin_headers)
        assert get_response.status_code == 404
        print(f"✓ Deleted tool and verified removal")
    
    def test_search_tools(self, admin_headers):
        """Test searching tools"""
        response = requests.get(f"{CRM_API}/admin/tools?search=test", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert 'tools' in data
        print(f"✓ Search returned {len(data['tools'])} tools")


class TestAdminClients:
    """Admin clients CRUD tests"""
    
    def test_get_clients_list(self, admin_headers):
        """Test getting list of clients"""
        response = requests.get(f"{CRM_API}/admin/clients", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert 'clients' in data
        assert isinstance(data['clients'], list)
        print(f"✓ Got {len(data['clients'])} clients")
    
    def test_create_client(self, admin_headers):
        """Test creating a new client"""
        timestamp = int(time.time())
        client_data = {
            "fullName": f"{TEST_PREFIX}Test Client",
            "email": f"test_client_{timestamp}@example.com",
            "password": "testpassword123",
            "status": "active",
            "devicePolicyEnabled": True
        }
        response = requests.post(f"{CRM_API}/admin/clients", headers=admin_headers, json=client_data)
        assert response.status_code == 201
        data = response.json()
        assert data.get('success') == True
        assert 'client' in data
        assert data['client']['fullName'] == client_data['fullName']
        assert data['client']['email'] == client_data['email']
        assert data['client']['role'] == 'CLIENT'
        print(f"✓ Created client: {data['client']['email']}")
        return data['client']
    
    def test_create_client_duplicate_email(self, admin_headers):
        """Test creating client with duplicate email fails"""
        timestamp = int(time.time())
        client_data = {
            "fullName": f"{TEST_PREFIX}Duplicate Test",
            "email": f"duplicate_{timestamp}@example.com",
            "password": "testpassword123"
        }
        # Create first client
        response1 = requests.post(f"{CRM_API}/admin/clients", headers=admin_headers, json=client_data)
        assert response1.status_code == 201
        
        # Try to create duplicate
        response2 = requests.post(f"{CRM_API}/admin/clients", headers=admin_headers, json=client_data)
        assert response2.status_code == 400
        assert 'error' in response2.json()
        print(f"✓ Duplicate email rejected")
    
    def test_get_single_client(self, admin_headers):
        """Test getting a single client by ID"""
        timestamp = int(time.time())
        client_data = {
            "fullName": f"{TEST_PREFIX}Single Client Test",
            "email": f"single_client_{timestamp}@example.com",
            "password": "testpassword123"
        }
        create_response = requests.post(f"{CRM_API}/admin/clients", headers=admin_headers, json=client_data)
        assert create_response.status_code == 201
        client_id = create_response.json()['client']['_id']
        
        # Get the client
        response = requests.get(f"{CRM_API}/admin/clients/{client_id}", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert 'client' in data
        assert data['client']['_id'] == client_id
        print(f"✓ Retrieved client: {data['client']['email']}")
    
    def test_update_client(self, admin_headers):
        """Test updating a client"""
        timestamp = int(time.time())
        client_data = {
            "fullName": f"{TEST_PREFIX}Update Client Test",
            "email": f"update_client_{timestamp}@example.com",
            "password": "testpassword123"
        }
        create_response = requests.post(f"{CRM_API}/admin/clients", headers=admin_headers, json=client_data)
        assert create_response.status_code == 201
        client_id = create_response.json()['client']['_id']
        
        # Update the client
        update_data = {
            "fullName": f"{TEST_PREFIX}Updated Client Name",
            "notes": "Updated notes"
        }
        response = requests.put(f"{CRM_API}/admin/clients/{client_id}", headers=admin_headers, json=update_data)
        assert response.status_code == 200
        data = response.json()
        assert data.get('success') == True
        assert data['client']['fullName'] == update_data['fullName']
        print(f"✓ Updated client: {data['client']['fullName']}")
    
    def test_device_reset(self, admin_headers):
        """Test resetting client device binding"""
        timestamp = int(time.time())
        client_data = {
            "fullName": f"{TEST_PREFIX}Device Reset Test",
            "email": f"device_reset_{timestamp}@example.com",
            "password": "testpassword123"
        }
        create_response = requests.post(f"{CRM_API}/admin/clients", headers=admin_headers, json=client_data)
        assert create_response.status_code == 201
        client_id = create_response.json()['client']['_id']
        
        # Reset device
        response = requests.post(f"{CRM_API}/admin/clients/{client_id}/device-reset", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get('success') == True
        print(f"✓ Device reset successful")
    
    def test_delete_client(self, admin_headers):
        """Test deleting a client"""
        timestamp = int(time.time())
        client_data = {
            "fullName": f"{TEST_PREFIX}Delete Client Test",
            "email": f"delete_client_{timestamp}@example.com",
            "password": "testpassword123"
        }
        create_response = requests.post(f"{CRM_API}/admin/clients", headers=admin_headers, json=client_data)
        assert create_response.status_code == 201
        client_id = create_response.json()['client']['_id']
        
        # Delete the client
        response = requests.delete(f"{CRM_API}/admin/clients/{client_id}", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get('success') == True
        
        # Verify deletion
        get_response = requests.get(f"{CRM_API}/admin/clients/{client_id}", headers=admin_headers)
        assert get_response.status_code == 404
        print(f"✓ Deleted client and verified removal")


class TestAdminAssignments:
    """Admin tool assignments tests"""
    
    @pytest.fixture(scope="class")
    def test_tool_and_client(self, admin_headers):
        """Create test tool and client for assignment tests"""
        timestamp = int(time.time())
        
        # Create tool
        tool_data = {
            "name": f"{TEST_PREFIX}Assignment Tool",
            "targetUrl": "https://example.com/assignment-test",
            "category": "SEO"
        }
        tool_response = requests.post(f"{CRM_API}/admin/tools", headers=admin_headers, json=tool_data)
        tool = tool_response.json()['tool']
        
        # Create client
        client_data = {
            "fullName": f"{TEST_PREFIX}Assignment Client",
            "email": f"assignment_client_{timestamp}@example.com",
            "password": "testpassword123"
        }
        client_response = requests.post(f"{CRM_API}/admin/clients", headers=admin_headers, json=client_data)
        client = client_response.json()['client']
        
        return {"tool": tool, "client": client}
    
    def test_assign_tool_to_client(self, admin_headers, test_tool_and_client):
        """Test assigning a tool to a client"""
        tool = test_tool_and_client['tool']
        client = test_tool_and_client['client']
        
        assignment_data = {
            "toolId": tool['_id'],
            "durationDays": 30,
            "notes": "Test assignment"
        }
        response = requests.post(
            f"{CRM_API}/admin/assignments/{client['_id']}", 
            headers=admin_headers, 
            json=assignment_data
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get('success') == True
        assert 'assignment' in data
        print(f"✓ Assigned tool to client")
    
    def test_get_client_assignments(self, admin_headers, test_tool_and_client):
        """Test getting client assignments"""
        client = test_tool_and_client['client']
        
        response = requests.get(f"{CRM_API}/admin/assignments/{client['_id']}", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert 'assignments' in data
        print(f"✓ Got {len(data['assignments'])} assignments for client")
    
    def test_bulk_assign(self, admin_headers):
        """Test bulk assigning a tool to multiple clients"""
        timestamp = int(time.time())
        
        # Create tool
        tool_data = {
            "name": f"{TEST_PREFIX}Bulk Assign Tool",
            "targetUrl": "https://example.com/bulk-test"
        }
        tool_response = requests.post(f"{CRM_API}/admin/tools", headers=admin_headers, json=tool_data)
        tool = tool_response.json()['tool']
        
        # Create multiple clients
        client_ids = []
        for i in range(3):
            client_data = {
                "fullName": f"{TEST_PREFIX}Bulk Client {i}",
                "email": f"bulk_client_{timestamp}_{i}@example.com",
                "password": "testpassword123"
            }
            client_response = requests.post(f"{CRM_API}/admin/clients", headers=admin_headers, json=client_data)
            client_ids.append(client_response.json()['client']['_id'])
        
        # Bulk assign
        bulk_data = {
            "toolId": tool['_id'],
            "clientIds": client_ids,
            "durationDays": 30
        }
        response = requests.post(f"{CRM_API}/admin/assignments/bulk", headers=admin_headers, json=bulk_data)
        assert response.status_code == 200
        data = response.json()
        assert data.get('success') == True
        assert 'results' in data
        assert data['results']['created'] == 3
        print(f"✓ Bulk assigned tool to {data['results']['created']} clients")


class TestAdminActivity:
    """Admin activity log tests"""
    
    def test_get_activity_logs(self, admin_headers):
        """Test getting activity logs"""
        response = requests.get(f"{CRM_API}/admin/activity", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert 'activities' in data
        assert 'total' in data
        print(f"✓ Got {len(data['activities'])} activity logs (total: {data['total']})")
    
    def test_get_activity_logs_with_limit(self, admin_headers):
        """Test getting activity logs with limit"""
        response = requests.get(f"{CRM_API}/admin/activity?limit=5", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert 'activities' in data
        assert len(data['activities']) <= 5
        print(f"✓ Got {len(data['activities'])} activity logs with limit=5")
    
    def test_get_activity_logs_with_filter(self, admin_headers):
        """Test getting activity logs with action filter"""
        response = requests.get(f"{CRM_API}/admin/activity?action=ADMIN_LOGIN", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert 'activities' in data
        # All activities should be ADMIN_LOGIN
        for activity in data['activities']:
            assert activity['action'] == 'ADMIN_LOGIN'
        print(f"✓ Filtered activity logs by action")


class TestClientAuth:
    """Client authentication tests"""
    
    @pytest.fixture(scope="class")
    def test_client(self, admin_headers):
        """Create a test client for auth tests"""
        timestamp = int(time.time())
        client_data = {
            "fullName": f"{TEST_PREFIX}Auth Test Client",
            "email": f"auth_test_{timestamp}@example.com",
            "password": "clientpassword123",
            "devicePolicyEnabled": False  # Disable device policy for testing
        }
        response = requests.post(f"{CRM_API}/admin/clients", headers=admin_headers, json=client_data)
        return {
            "email": client_data['email'],
            "password": client_data['password'],
            "id": response.json()['client']['_id']
        }
    
    def test_client_login_success(self, test_client):
        """Test client login with valid credentials"""
        response = requests.post(f"{CRM_API}/auth/client/login", json={
            "email": test_client['email'],
            "password": test_client['password'],
            "deviceId": "test_device_123"
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get('success') == True
        assert 'token' in data
        assert 'user' in data
        assert data['user']['role'] == 'CLIENT'
        print(f"✓ Client login successful")
    
    def test_client_login_invalid_credentials(self):
        """Test client login with invalid credentials"""
        response = requests.post(f"{CRM_API}/auth/client/login", json={
            "email": "nonexistent@example.com",
            "password": "wrongpassword",
            "deviceId": "test_device_123"
        })
        assert response.status_code == 401
        print(f"✓ Invalid client credentials rejected")
    
    def test_client_login_missing_device_id(self, test_client):
        """Test client login without device ID"""
        response = requests.post(f"{CRM_API}/auth/client/login", json={
            "email": test_client['email'],
            "password": test_client['password']
        })
        assert response.status_code == 400
        assert 'error' in response.json()
        print(f"✓ Missing device ID rejected")


class TestUnauthorizedAccess:
    """Test unauthorized access to protected endpoints"""
    
    def test_admin_tools_without_auth(self):
        """Test accessing admin tools without authentication"""
        response = requests.get(f"{CRM_API}/admin/tools")
        assert response.status_code == 401
        print(f"✓ Admin tools endpoint requires auth")
    
    def test_admin_clients_without_auth(self):
        """Test accessing admin clients without authentication"""
        response = requests.get(f"{CRM_API}/admin/clients")
        assert response.status_code == 401
        print(f"✓ Admin clients endpoint requires auth")
    
    def test_admin_activity_without_auth(self):
        """Test accessing admin activity without authentication"""
        response = requests.get(f"{CRM_API}/admin/activity")
        assert response.status_code == 401
        print(f"✓ Admin activity endpoint requires auth")


# Cleanup fixture to remove test data
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_data():
    """Cleanup test data after all tests complete"""
    yield
    # Get admin token
    response = requests.post(f"{CRM_API}/auth/admin/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code != 200:
        return
    
    token = response.json().get('token')
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    # Delete test tools
    tools_response = requests.get(f"{CRM_API}/admin/tools?search={TEST_PREFIX}", headers=headers)
    if tools_response.status_code == 200:
        for tool in tools_response.json().get('tools', []):
            if tool['name'].startswith(TEST_PREFIX):
                requests.delete(f"{CRM_API}/admin/tools/{tool['_id']}", headers=headers)
    
    # Delete test clients
    clients_response = requests.get(f"{CRM_API}/admin/clients?search={TEST_PREFIX}", headers=headers)
    if clients_response.status_code == 200:
        for client in clients_response.json().get('clients', []):
            if client['fullName'].startswith(TEST_PREFIX):
                requests.delete(f"{CRM_API}/admin/clients/{client['_id']}", headers=headers)
    
    print("\n✓ Test data cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
