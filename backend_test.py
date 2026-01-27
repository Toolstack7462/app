#!/usr/bin/env python3
"""
ToolStack CRM Backend API Testing Suite - URL Change Resilience & Persistence Testing
Tests critical fixes: Dynamic CORS, MongoDB persistence, Admin bootstrap, Input normalization, Cookie settings
"""

import requests
import json
import os
import sys
from datetime import datetime
import uuid

class ToolStackCRMTester:
    def __init__(self):
        # Use preview URL for testing environment-agnostic configuration
        self.gateway_url = "https://auth-orchestrator.preview.emergentagent.com"
        self.crm_health_url = f"{self.gateway_url}/api/crm/health"
        self.api_base = f"{self.gateway_url}/api/crm"
        
        # Admin credentials from review request
        self.admin_email = "admin@toolstack.com"
        self.admin_password = "Admin123!Secure"
        
        # Test data
        self.admin_token = None
        self.test_blog_id = None
        self.test_contact_id = None
        self.test_tool_id = None
        self.extension_token = None
        self.client_id = None
        
        # Results tracking - Updated for new test categories
        self.results = {
            "health_connectivity": {"passed": 0, "failed": 0, "errors": []},
            "cors_validation": {"passed": 0, "failed": 0, "errors": []},
            "admin_bootstrap": {"passed": 0, "failed": 0, "errors": []},
            "input_normalization": {"passed": 0, "failed": 0, "errors": []},
            "tool_creation": {"passed": 0, "failed": 0, "errors": []},
            "admin_dashboard": {"passed": 0, "failed": 0, "errors": []},
            "mongodb_persistence": {"passed": 0, "failed": 0, "errors": []},
            "extension_endpoints": {"passed": 0, "failed": 0, "errors": []},
            "admin_tool_endpoints": {"passed": 0, "failed": 0, "errors": []}
        }
        
        print(f"🚀 ToolStack CRM API Tester - URL Change Resilience & Persistence")
        print(f"📡 Gateway URL: {self.gateway_url}")
        print(f"🔗 API Base: {self.api_base}")
        print(f"👤 Admin: {self.admin_email}")
        print("=" * 70)

    def log_result(self, category, test_name, success, error=None):
        """Log test result"""
        if success:
            self.results[category]["passed"] += 1
            print(f"✅ {test_name}")
        else:
            self.results[category]["failed"] += 1
            self.results[category]["errors"].append(f"{test_name}: {error}")
            print(f"❌ {test_name}: {error}")

    def make_request(self, method, endpoint, data=None, headers=None, auth_required=True, origin=None):
        """Make HTTP request with proper headers and CORS testing"""
        if endpoint.startswith("http"):
            url = endpoint  # Full URL provided
        else:
            url = f"{self.api_base}{endpoint}"
        
        request_headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        # Add origin header for CORS testing
        if origin:
            request_headers["Origin"] = origin
        
        if auth_required and self.admin_token:
            request_headers["Authorization"] = f"Bearer {self.admin_token}"
        
        if headers:
            request_headers.update(headers)
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=request_headers, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, json=data, headers=request_headers, timeout=30)
            elif method.upper() == "PUT":
                response = requests.put(url, json=data, headers=request_headers, timeout=30)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=request_headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            return response
        except requests.exceptions.RequestException as e:
            print(f"❌ Request failed: {e}")
            return None

    def test_health_checks_connectivity(self):
        """Test health checks and connectivity as per review request"""
        print("\n🏥 Testing Health Checks & Connectivity...")
        
        # Test FastAPI Gateway health
        response = self.make_request("GET", self.gateway_url + "/health", auth_required=False)
        if response and response.status_code == 200:
            try:
                data = response.json()
                if data.get("status") == "ok" and "cors_patterns" in data:
                    self.log_result("health_connectivity", "FastAPI Gateway health check", True)
                    print(f"   Gateway: {data.get('service', 'Unknown')}")
                    print(f"   CRM Backend: {data.get('crm_backend', 'Unknown')}")
                    print(f"   CORS Patterns: {len(data.get('cors_patterns', []))} patterns")
                else:
                    self.log_result("health_connectivity", "FastAPI Gateway health check", False, "Missing required fields")
            except json.JSONDecodeError:
                self.log_result("health_connectivity", "FastAPI Gateway health check", False, "Invalid JSON response")
        else:
            self.log_result("health_connectivity", "FastAPI Gateway health check", False, f"HTTP {response.status_code if response else 'No response'}")
        
        # Test CRM Backend health through gateway
        response = self.make_request("GET", "/health", auth_required=False)
        if response and response.status_code == 200:
            try:
                data = response.json()
                backend_data = data.get("backend", {})
                if backend_data.get("status") == "ok":
                    self.log_result("health_connectivity", "CRM Backend health via gateway", True)
                    
                    # Check MongoDB connection details
                    mongodb_info = backend_data.get("mongodb", {})
                    if mongodb_info:
                        print(f"   MongoDB Host: {mongodb_info.get('host', 'N/A')}")
                        print(f"   MongoDB Database: {mongodb_info.get('database', 'N/A')}")
                        print(f"   MongoDB State: {mongodb_info.get('state', 'N/A')}")
                        
                        if mongodb_info.get("state") == "connected":
                            self.log_result("mongodb_persistence", "MongoDB connection verified", True)
                        else:
                            self.log_result("mongodb_persistence", "MongoDB connection verified", False, f"State: {mongodb_info.get('state')}")
                    else:
                        self.log_result("mongodb_persistence", "MongoDB connection info", False, "No MongoDB info in response")
                else:
                    self.log_result("health_connectivity", "CRM Backend health via gateway", False, "Backend not OK")
            except json.JSONDecodeError:
                self.log_result("health_connectivity", "CRM Backend health via gateway", False, "Invalid JSON response")
        else:
            self.log_result("health_connectivity", "CRM Backend health via gateway", False, f"HTTP {response.status_code if response else 'No response'}")

    def test_cors_validation(self):
        """Test CORS validation with different origins"""
        print("\n🌐 Testing CORS Validation...")
        
        # Test with allowed preview subdomain
        test_origins = [
            "https://auth-orchestrator.preview.emergentagent.com",
            "https://auth-orchestrator.preview.emergentagent.com", 
            "https://main.emergentagent.com",
            "http://localhost:3000"
        ]
        
        for origin in test_origins:
            response = self.make_request("GET", "/health", auth_required=False, origin=origin)
            if response and response.status_code == 200:
                # Check if CORS headers are present
                cors_origin = response.headers.get("Access-Control-Allow-Origin")
                cors_credentials = response.headers.get("Access-Control-Allow-Credentials")
                
                if cors_origin == origin and cors_credentials == "true":
                    self.log_result("cors_validation", f"CORS allowed for {origin}", True)
                else:
                    self.log_result("cors_validation", f"CORS headers for {origin}", False, f"Origin: {cors_origin}, Credentials: {cors_credentials}")
            else:
                self.log_result("cors_validation", f"CORS test for {origin}", False, f"HTTP {response.status_code if response else 'No response'}")

    def test_admin_bootstrap_verification(self):
        """Test admin bootstrap verification"""
        print("\n👤 Testing Admin Bootstrap Verification...")
        
        # This test verifies that admin was auto-created as mentioned in review request
        # We'll test by attempting login with the bootstrap credentials
        login_data = {
            "email": self.admin_email,
            "password": self.admin_password
        }
        
        response = self.make_request("POST", "/auth/admin/login", login_data, auth_required=False)
        
        if response and response.status_code == 200:
            try:
                data = response.json()
                if data.get("success") and data.get("accessToken"):
                    self.admin_token = data["accessToken"]
                    user_data = data.get("user", {})
                    
                    self.log_result("admin_bootstrap", "Admin bootstrap verification", True)
                    print(f"   Admin ID: {user_data.get('_id', 'N/A')}")
                    print(f"   Admin Email: {user_data.get('email', 'N/A')}")
                    print(f"   Admin Role: {user_data.get('role', 'N/A')}")
                    print(f"   Admin Status: {user_data.get('status', 'N/A')}")
                    
                    # Verify admin exists in database (implied by successful login)
                    self.log_result("admin_bootstrap", "Admin exists in database", True)
                else:
                    self.log_result("admin_bootstrap", "Admin bootstrap verification", False, "Missing success or accessToken in response")
            except json.JSONDecodeError:
                self.log_result("admin_bootstrap", "Admin bootstrap verification", False, "Invalid JSON response")
        else:
            self.log_result("admin_bootstrap", "Admin bootstrap verification", False, f"HTTP {response.status_code if response else 'No response'}")

    def test_input_normalization_auth(self):
        """Test input normalization in authentication - CRITICAL FIX RE-TEST"""
        print("\n🔧 Testing Input Normalization Fix - 5 Critical Test Cases...")
        
        # Test scenarios exactly as specified in review request
        test_scenarios = [
            {
                "name": "1. Email with Leading/Trailing Spaces (CRITICAL FIX)",
                "email": "  admin@toolstack.com  ",
                "password": "Admin123!Secure",
                "expected": "✅ Login successful (spaces trimmed before validation)"
            },
            {
                "name": "2. Password with Leading/Trailing Spaces",
                "email": "admin@toolstack.com",
                "password": "  Admin123!Secure  ",
                "expected": "✅ Login successful (spaces trimmed)"
            },
            {
                "name": "3. Both with Spaces",
                "email": "  admin@toolstack.com  ",
                "password": "  Admin123!Secure  ",
                "expected": "✅ Login successful"
            },
            {
                "name": "4. Mixed Case Email (Re-verify still works)",
                "email": "ADMIN@TOOLSTACK.COM",
                "password": "Admin123!Secure",
                "expected": "✅ Login successful (lowercased before validation)"
            },
            {
                "name": "5. Normal Login (Baseline)",
                "email": "admin@toolstack.com",
                "password": "Admin123!Secure",
                "expected": "✅ Login successful"
            }
        ]
        
        print(f"   Testing normalization middleware: authLimiter → normalizeAuthInputs → validate → handler")
        print(f"   Expected: ALL 5 test cases must pass with successful login")
        print(f"   Success Criteria: accessToken and user object in response")
        
        for i, scenario in enumerate(test_scenarios, 1):
            print(f"\n   Test {i}/5: {scenario['name']}")
            print(f"   Email: '{scenario['email']}'")
            print(f"   Password: '{scenario['password']}'")
            print(f"   Expected: {scenario['expected']}")
            
            login_data = {
                "email": scenario["email"],
                "password": scenario["password"]
            }
            
            response = self.make_request("POST", "/auth/admin/login", login_data, auth_required=False)
            
            if response and response.status_code == 200:
                try:
                    data = response.json()
                    if data.get("success") and data.get("accessToken") and data.get("user"):
                        self.log_result("input_normalization", f"Test {i}: {scenario['name']}", True)
                        print(f"   ✅ SUCCESS: Login successful, accessToken received")
                        print(f"   User ID: {data.get('user', {}).get('_id', 'N/A')}")
                        
                        # Store token from first successful login for later tests
                        if not self.admin_token:
                            self.admin_token = data["accessToken"]
                    else:
                        self.log_result("input_normalization", f"Test {i}: {scenario['name']}", False, "Missing success, accessToken, or user in response")
                        print(f"   ❌ FAILED: Response missing required fields")
                        print(f"   Response: {json.dumps(data, indent=2)}")
                except json.JSONDecodeError as e:
                    self.log_result("input_normalization", f"Test {i}: {scenario['name']}", False, f"Invalid JSON response: {e}")
                    print(f"   ❌ FAILED: Invalid JSON response")
            else:
                error_msg = f"HTTP {response.status_code if response else 'No response'}"
                if response:
                    try:
                        error_data = response.json()
                        error_msg += f" - {error_data.get('error', 'Unknown error')}"
                    except:
                        error_msg += f" - {response.text[:100]}"
                
                self.log_result("input_normalization", f"Test {i}: {scenario['name']}", False, error_msg)
                print(f"   ❌ FAILED: {error_msg}")
        
        print(f"\n   🔍 Testing error handling with invalid credentials...")
        # Test invalid credentials to ensure proper error handling
        invalid_login = {
            "email": "admin@toolstack.com",
            "password": "WrongPassword123"
        }
        
        response = self.make_request("POST", "/auth/admin/login", invalid_login, auth_required=False)
        
        if response and response.status_code == 401:
            try:
                data = response.json()
                if "error" in data:
                    self.log_result("input_normalization", "Invalid credentials error handling", True)
                    print(f"   ✅ Error handling works: {data.get('error')}")
                else:
                    self.log_result("input_normalization", "Invalid credentials error handling", False, "No error message in response")
                    print(f"   ❌ No error message in 401 response")
            except json.JSONDecodeError:
                self.log_result("input_normalization", "Invalid credentials error handling", False, "Invalid JSON response")
                print(f"   ❌ Invalid JSON in error response")
        else:
            self.log_result("input_normalization", "Invalid credentials error handling", False, f"Expected 401, got {response.status_code if response else 'No response'}")
            print(f"   ❌ Expected 401 for invalid credentials, got {response.status_code if response else 'No response'}")

<<<<<<< HEAD
    def test_admin_dashboard_access(self):
        """Test admin dashboard access after login"""
        print("\n📊 Testing Admin Dashboard Access...")
        
        if not self.admin_token:
            self.log_result("admin_dashboard", "Admin dashboard tests", False, "No admin token available")
            return
        
        # Test admin tools endpoint
        response = self.make_request("GET", "/admin/tools")
        if response and response.status_code == 200:
            try:
                data = response.json()
                if data.get("success") is not None:
                    self.log_result("admin_dashboard", "Admin tools access", True)
                else:
                    self.log_result("admin_dashboard", "Admin tools access", False, "Invalid response format")
            except json.JSONDecodeError:
                self.log_result("admin_dashboard", "Admin tools access", False, "Invalid JSON response")
        else:
            self.log_result("admin_dashboard", "Admin tools access", False, f"HTTP {response.status_code if response else 'No response'}")
        
=======
    def test_tool_creation_critical(self):
        """Test tool creation with input normalization - CRITICAL PRIORITY"""
        print("\n🔧 Testing Tool Creation with Input Normalization - CRITICAL TEST...")
        
        if not self.admin_token:
            self.log_result("tool_creation", "Tool creation tests", False, "No admin token available")
            return
        
        # Test scenarios as per review request
        test_tools = [
            {
                "name": "1. Normal Tool Creation",
                "data": {
                    "name": "Test Analytics Tool",
                    "description": "A comprehensive analytics dashboard for tracking user behavior",
                    "targetUrl": "https://analytics.example.com",
                    "category": "AI",
                    "status": "active"
                },
                "expected": "✅ Tool created successfully"
            },
            {
                "name": "2. Tool with Spaces in Fields (CRITICAL FIX TEST)",
                "data": {
                    "name": "  Marketing Automation Tool  ",
                    "description": "  Advanced marketing automation platform  ",
                    "targetUrl": "  https://marketing.example.com  ",
                    "category": "  Productivity  ",
                    "status": "active"
                },
                "expected": "✅ Tool created with spaces trimmed"
            },
            {
                "name": "3. Tool with Special Characters in URL",
                "data": {
                    "name": "CRM Integration Tool",
                    "description": "Customer relationship management integration",
                    "targetUrl": "https://crm-tool.example.com/dashboard?utm_source=test&utm_medium=api",
                    "category": "Miscellaneous",
                    "status": "active"
                },
                "expected": "✅ Tool created with special characters in URL"
            },
            {
                "name": "4. Tool with Mixed Case Category",
                "data": {
                    "name": "Project Management Suite",
                    "description": "Complete project management solution",
                    "targetUrl": "https://projects.example.com",
                    "category": "Career-Oriented",
                    "status": "active"
                },
                "expected": "✅ Tool created with mixed case category"
            }
        ]
        
        created_tool_ids = []
        
        print(f"   Testing normalizeStringInputs middleware in tool creation")
        print(f"   Expected: ALL 4 test cases must pass with successful tool creation")
        print(f"   Success Criteria: HTTP 201, success=true, tool object with ID in response")
        
        for i, test_tool in enumerate(test_tools, 1):
            print(f"\n   Test {i}/4: {test_tool['name']}")
            print(f"   Name: '{test_tool['data']['name']}'")
            print(f"   Description: '{test_tool['data']['description'][:50]}...'")
            print(f"   URL: '{test_tool['data']['targetUrl']}'")
            print(f"   Category: '{test_tool['data']['category']}'")
            print(f"   Expected: {test_tool['expected']}")
            
            response = self.make_request("POST", "/admin/tools", test_tool['data'])
            
            if response and response.status_code == 201:
                try:
                    data = response.json()
                    if data.get("success") and data.get("tool") and data.get("tool", {}).get("_id"):
                        tool_id = data["tool"]["_id"]
                        created_tool_ids.append(tool_id)
                        
                        self.log_result("tool_creation", f"Test {i}: {test_tool['name']}", True)
                        print(f"   ✅ SUCCESS: Tool created with ID {tool_id}")
                        print(f"   Tool Name: {data['tool'].get('name', 'N/A')}")
                        print(f"   Tool Category: {data['tool'].get('category', 'N/A')}")
                        print(f"   Tool Status: {data['tool'].get('status', 'N/A')}")
                        
                        # Verify normalization worked (spaces trimmed)
                        if test_tool['data']['name'].strip() == data['tool'].get('name'):
                            print(f"   ✅ Input normalization working: spaces trimmed correctly")
                        else:
                            print(f"   ⚠️  Input normalization issue: expected '{test_tool['data']['name'].strip()}', got '{data['tool'].get('name')}'")
                    else:
                        self.log_result("tool_creation", f"Test {i}: {test_tool['name']}", False, "Missing success, tool, or tool._id in response")
                        print(f"   ❌ FAILED: Response missing required fields")
                        print(f"   Response: {json.dumps(data, indent=2)}")
                except json.JSONDecodeError as e:
                    self.log_result("tool_creation", f"Test {i}: {test_tool['name']}", False, f"Invalid JSON response: {e}")
                    print(f"   ❌ FAILED: Invalid JSON response")
            else:
                error_msg = f"HTTP {response.status_code if response else 'No response'}"
                if response:
                    try:
                        error_data = response.json()
                        error_msg += f" - {error_data.get('error', 'Unknown error')}"
                        if 'details' in error_data:
                            error_msg += f" - Details: {error_data['details']}"
                    except:
                        error_msg += f" - {response.text[:200]}"
                
                self.log_result("tool_creation", f"Test {i}: {test_tool['name']}", False, error_msg)
                print(f"   ❌ FAILED: {error_msg}")
        
        # Test validation error handling
        print(f"\n   🔍 Testing validation error handling...")
        invalid_tool = {
            "name": "",  # Empty name should fail validation
            "description": "Test description",
            "targetUrl": "invalid-url",  # Invalid URL should fail
            "category": "Test",
            "status": "active"
        }
        
        response = self.make_request("POST", "/admin/tools", invalid_tool)
        
        if response and response.status_code == 400:
            try:
                data = response.json()
                if "error" in data and ("validation" in data["error"].lower() or "details" in data):
                    self.log_result("tool_creation", "Validation error handling", True)
                    print(f"   ✅ Validation error handling works: {data.get('error')}")
                    if 'details' in data:
                        print(f"   Details: {data['details']}")
                else:
                    self.log_result("tool_creation", "Validation error handling", False, "No proper error message in response")
                    print(f"   ❌ No proper error message in 400 response")
            except json.JSONDecodeError:
                self.log_result("tool_creation", "Validation error handling", False, "Invalid JSON response")
                print(f"   ❌ Invalid JSON in error response")
        else:
            self.log_result("tool_creation", "Validation error handling", False, f"Expected 400, got {response.status_code if response else 'No response'}")
            print(f"   ❌ Expected 400 for invalid data, got {response.status_code if response else 'No response'}")
        
        # Verify tools exist in database by fetching them
        print(f"\n   🔍 Verifying tools exist in database...")
        response = self.make_request("GET", "/admin/tools")
        
        if response and response.status_code == 200:
            try:
                data = response.json()
                if data.get("success") and "tools" in data:
                    tools_in_db = data["tools"]
                    found_tools = [tool for tool in tools_in_db if tool.get("_id") in created_tool_ids]
                    
                    if len(found_tools) == len(created_tool_ids):
                        self.log_result("tool_creation", "Database persistence verification", True)
                        print(f"   ✅ All {len(found_tools)} created tools found in database")
                        for tool in found_tools:
                            print(f"   - {tool.get('name')} (ID: {tool.get('_id')})")
                    else:
                        self.log_result("tool_creation", "Database persistence verification", False, f"Expected {len(created_tool_ids)} tools, found {len(found_tools)}")
                        print(f"   ❌ Expected {len(created_tool_ids)} tools in DB, found {len(found_tools)}")
                else:
                    self.log_result("tool_creation", "Database persistence verification", False, "Invalid response format")
                    print(f"   ❌ Invalid response format when fetching tools")
            except json.JSONDecodeError:
                self.log_result("tool_creation", "Database persistence verification", False, "Invalid JSON response")
                print(f"   ❌ Invalid JSON when fetching tools")
        else:
            self.log_result("tool_creation", "Database persistence verification", False, f"HTTP {response.status_code if response else 'No response'}")
            print(f"   ❌ Failed to fetch tools for verification: HTTP {response.status_code if response else 'No response'}")

    def test_chrome_extension_endpoints(self):
        """Test Chrome Extension auto-login improvement endpoints"""
        print("\n🔌 Testing Chrome Extension Auto-Login Endpoints...")
        
        if not self.admin_token:
            self.log_result("extension_endpoints", "Extension endpoint tests", False, "No admin token available")
            return
        
        # First, get a tool ID to test with
        response = self.make_request("GET", "/admin/tools")
        if not response or response.status_code != 200:
            self.log_result("extension_endpoints", "Get tools for testing", False, "Failed to get tools list")
            return
        
        try:
            data = response.json()
            if not data.get("success") or not data.get("tools") or len(data["tools"]) == 0:
                self.log_result("extension_endpoints", "Get tools for testing", False, "No tools available for testing")
                return
            
            self.test_tool_id = data["tools"][0]["_id"]
            print(f"   Using tool ID: {self.test_tool_id}")
            self.log_result("extension_endpoints", "Get test tool ID", True)
        except json.JSONDecodeError:
            self.log_result("extension_endpoints", "Get test tool ID", False, "Invalid JSON response")
            return
        
        # Test 1: Extension Login Attempt Logging (requires extension token - will test endpoint structure)
        print(f"\n   Testing Extension Login Attempt Logging...")
        login_attempt_data = {
            "success": True,
            "method": "form",
            "duration": 2500,
            "attempts": 1,
            "finalUrl": "https://example.com/dashboard"
        }
        
        # This will fail with 401 since we don't have extension token, but we can verify endpoint exists
        response = self.make_request("POST", f"/extension/tools/{self.test_tool_id}/login-attempt", 
                                   login_attempt_data, auth_required=False)
        
        if response and response.status_code == 401:
            try:
                data = response.json()
                if "Extension token required" in data.get("error", ""):
                    self.log_result("extension_endpoints", "Extension login attempt endpoint structure", True)
                    print(f"   ✅ Endpoint exists and requires extension token (expected)")
                else:
                    self.log_result("extension_endpoints", "Extension login attempt endpoint structure", False, f"Unexpected error: {data.get('error')}")
            except json.JSONDecodeError:
                self.log_result("extension_endpoints", "Extension login attempt endpoint structure", False, "Invalid JSON response")
        else:
            self.log_result("extension_endpoints", "Extension login attempt endpoint structure", False, 
                          f"Expected 401, got {response.status_code if response else 'No response'}")

    def test_admin_tool_endpoints(self):
        """Test Admin Tool Management endpoints for Chrome Extension improvements"""
        print("\n🛠️  Testing Admin Tool Management Endpoints...")
        
        if not self.admin_token:
            self.log_result("admin_tool_endpoints", "Admin tool endpoint tests", False, "No admin token available")
            return
        
        if not self.test_tool_id:
            self.log_result("admin_tool_endpoints", "Admin tool endpoint tests", False, "No test tool ID available")
            return
        
        # Test 1: Admin Credential Validation
        print(f"\n   Testing Admin Credential Validation...")
        print(f"   Tool ID: {self.test_tool_id}")
        
        response = self.make_request("POST", f"/admin/tools/{self.test_tool_id}/test-credentials")
        
        if response and response.status_code == 200:
            try:
                data = response.json()
                if data.get("success") and "validation" in data:
                    validation = data["validation"]
                    self.log_result("admin_tool_endpoints", "Admin credential validation", True)
                    print(f"   ✅ Credential validation successful")
                    print(f"   Valid: {validation.get('valid', 'N/A')}")
                    print(f"   Checks: {len(validation.get('checks', []))} performed")
                    print(f"   Warnings: {len(validation.get('warnings', []))} found")
                    
                    # Log some check details
                    for check in validation.get('checks', [])[:3]:  # Show first 3 checks
                        print(f"   - {check.get('name', 'Unknown')}: {check.get('status', 'N/A')} - {check.get('message', 'No message')}")
                else:
                    self.log_result("admin_tool_endpoints", "Admin credential validation", False, "Missing validation data in response")
                    print(f"   ❌ Response missing validation data")
            except json.JSONDecodeError:
                self.log_result("admin_tool_endpoints", "Admin credential validation", False, "Invalid JSON response")
                print(f"   ❌ Invalid JSON response")
        else:
            error_msg = f"HTTP {response.status_code if response else 'No response'}"
            if response:
                try:
                    error_data = response.json()
                    error_msg += f" - {error_data.get('error', 'Unknown error')}"
                except:
                    error_msg += f" - {response.text[:100]}"
            
            self.log_result("admin_tool_endpoints", "Admin credential validation", False, error_msg)
            print(f"   ❌ Failed: {error_msg}")
        
        # Test 2: Admin Login Stats
        print(f"\n   Testing Admin Login Stats...")
        
        response = self.make_request("GET", f"/admin/tools/{self.test_tool_id}/login-stats")
        
        if response and response.status_code == 200:
            try:
                data = response.json()
                if data.get("success") and "stats" in data:
                    stats = data["stats"]
                    self.log_result("admin_tool_endpoints", "Admin login stats", True)
                    print(f"   ✅ Login stats retrieved successfully")
                    print(f"   Tool: {data.get('tool', {}).get('name', 'N/A')}")
                    print(f"   Period: {data.get('period', 'N/A')}")
                    print(f"   Total Attempts: {stats.get('totalAttempts', 0)}")
                    print(f"   Success Rate: {stats.get('successRate', 0)}%")
                    print(f"   Recent Attempts: {len(data.get('recentAttempts', []))}")
                    
                    # Check if we have recent attempts data
                    recent_attempts = data.get('recentAttempts', [])
                    if recent_attempts:
                        print(f"   Latest Attempt: {recent_attempts[0].get('action', 'N/A')} at {recent_attempts[0].get('createdAt', 'N/A')}")
                    else:
                        print(f"   No recent login attempts found")
                else:
                    self.log_result("admin_tool_endpoints", "Admin login stats", False, "Missing stats data in response")
                    print(f"   ❌ Response missing stats data")
            except json.JSONDecodeError:
                self.log_result("admin_tool_endpoints", "Admin login stats", False, "Invalid JSON response")
                print(f"   ❌ Invalid JSON response")
        else:
            error_msg = f"HTTP {response.status_code if response else 'No response'}"
            if response:
                try:
                    error_data = response.json()
                    error_msg += f" - {error_data.get('error', 'Unknown error')}"
                except:
                    error_msg += f" - {response.text[:100]}"
            
            self.log_result("admin_tool_endpoints", "Admin login stats", False, error_msg)
            print(f"   ❌ Failed: {error_msg}")
        
        # Test 3: Verify endpoint paths are correct
        print(f"\n   Testing endpoint path verification...")
        
        # Test with invalid tool ID to verify endpoint structure
        invalid_tool_id = "507f1f77bcf86cd799439011"  # Valid ObjectId format but non-existent
        
        response = self.make_request("POST", f"/admin/tools/{invalid_tool_id}/test-credentials")
        if response and response.status_code == 404:
            try:
                data = response.json()
                if "Tool not found" in data.get("error", ""):
                    self.log_result("admin_tool_endpoints", "Endpoint path verification", True)
                    print(f"   ✅ Endpoint paths correctly structured (404 for non-existent tool)")
                else:
                    self.log_result("admin_tool_endpoints", "Endpoint path verification", False, f"Unexpected 404 error: {data.get('error')}")
            except json.JSONDecodeError:
                self.log_result("admin_tool_endpoints", "Endpoint path verification", False, "Invalid JSON in 404 response")
        else:
            self.log_result("admin_tool_endpoints", "Endpoint path verification", False, 
                          f"Expected 404 for invalid tool ID, got {response.status_code if response else 'No response'}")

    def test_admin_dashboard_access(self):
        """Test admin dashboard access after login"""
        print("\n📊 Testing Admin Dashboard Access...")
        
        if not self.admin_token:
            self.log_result("admin_dashboard", "Admin dashboard tests", False, "No admin token available")
            return
        
        # Test admin tools endpoint
        response = self.make_request("GET", "/admin/tools")
        if response and response.status_code == 200:
            try:
                data = response.json()
                if data.get("success") is not None:
                    self.log_result("admin_dashboard", "Admin tools access", True)
                else:
                    self.log_result("admin_dashboard", "Admin tools access", False, "Invalid response format")
            except json.JSONDecodeError:
                self.log_result("admin_dashboard", "Admin tools access", False, "Invalid JSON response")
        else:
            self.log_result("admin_dashboard", "Admin tools access", False, f"HTTP {response.status_code if response else 'No response'}")
        
>>>>>>> 50524b5 (Squashed after rollback: b35d0b22-fd0c-49a4-9da4-89095b06d1d6)
        # Test admin clients endpoint
        response = self.make_request("GET", "/admin/clients")
        if response and response.status_code == 200:
            try:
                data = response.json()
                if data.get("success") is not None:
                    self.log_result("admin_dashboard", "Admin clients access", True)
                else:
                    self.log_result("admin_dashboard", "Admin clients access", False, "Invalid response format")
            except json.JSONDecodeError:
                self.log_result("admin_dashboard", "Admin clients access", False, "Invalid JSON response")
        else:
            self.log_result("admin_dashboard", "Admin clients access", False, f"HTTP {response.status_code if response else 'No response'}")
        
        # Test getting current user (auth verification)
        response = self.make_request("GET", "/auth/me")
        if response and response.status_code == 200:
            try:
                data = response.json()
                if data.get("success") and data.get("user"):
                    self.log_result("admin_dashboard", "Get current user", True)
                else:
                    self.log_result("admin_dashboard", "Get current user", False, "Invalid response format")
            except json.JSONDecodeError:
                self.log_result("admin_dashboard", "Get current user", False, "Invalid JSON response")
        else:
            self.log_result("admin_dashboard", "Get current user", False, f"HTTP {response.status_code if response else 'No response'}")

    def run_all_tests(self):
<<<<<<< HEAD
        """Run focused input normalization tests as per review request"""
        print("🧪 RE-TESTING INPUT NORMALIZATION FIX...")
        print("Context: Fixed critical input normalization issue by adding middleware BEFORE validation")
        print("Fix: normalizeAuthInputs middleware runs before Joi validation to trim spaces")
        
        # FOCUSED TEST as per review request
        print("\n" + "="*70)
        print("🎯 FOCUSED TEST: Input Normalization Fix Verification")
        print("="*70)
        
        # 1. Quick connectivity check
        print("\n📡 Quick Connectivity Check...")
        response = self.make_request("GET", self.gateway_url + "/health", auth_required=False)
        if response and response.status_code == 200:
            print("✅ Gateway connectivity OK")
        else:
            print("❌ Gateway connectivity failed - aborting tests")
            return
        
        # 2. MAIN TEST: Input Normalization with all 5 scenarios
        self.test_input_normalization_auth()
=======
        """Run comprehensive backend tests as per review request"""
        print("🧪 TOOLSTACK CRM BACKEND TESTING - COMPREHENSIVE SUITE...")
        print("Context: Testing recently fixed tool creation issue and overall system stability")
        print("Priority: Tool Creation (CRITICAL), Admin Login, Client Login, Database Persistence, CORS")
        
        # COMPREHENSIVE TEST as per review request
        print("\n" + "="*70)
        print("🎯 COMPREHENSIVE BACKEND TESTING SUITE")
        print("="*70)
        
        # 1. Health and connectivity check
        self.test_health_checks_connectivity()
        
        # 2. CORS validation
        self.test_cors_validation()
        
        # 3. Admin bootstrap verification
        self.test_admin_bootstrap_verification()
        
        # 4. Input normalization (verify still working)
        self.test_input_normalization_auth()
        
        # 5. CRITICAL: Tool Creation with Input Normalization
        self.test_tool_creation_critical()
        
        # 6. Admin dashboard access
        self.test_admin_dashboard_access()
>>>>>>> 50524b5 (Squashed after rollback: b35d0b22-fd0c-49a4-9da4-89095b06d1d6)
        
        # Print summary
        success = self.print_summary()
        return success

    def print_summary(self):
        """Print test results summary"""
        print("\n" + "=" * 60)
        print("📊 TEST RESULTS SUMMARY")
        print("=" * 60)
        
        total_passed = 0
        total_failed = 0
        
        for category, results in self.results.items():
            passed = results["passed"]
            failed = results["failed"]
            total_passed += passed
            total_failed += failed
            
            status = "✅ PASS" if failed == 0 else "❌ FAIL"
            print(f"{category.upper().replace('_', ' ')}: {status} ({passed} passed, {failed} failed)")
            
            if results["errors"]:
                for error in results["errors"]:
                    print(f"  ❌ {error}")
        
        print("-" * 60)
        print(f"TOTAL: {total_passed} passed, {total_failed} failed")
        
        if total_failed == 0:
            print("🎉 ALL TESTS PASSED!")
            return True
        else:
            print("⚠️  SOME TESTS FAILED!")
            return False

def main():
    """Main function"""
    tester = ToolStackCRMTester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()