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
        # Use localhost for testing as per review request
        self.gateway_url = "http://localhost:8001"
        self.crm_health_url = f"{self.gateway_url}/api/crm/health"
        self.api_base = f"{self.gateway_url}/api/crm"
        
        # Admin credentials from review request
        self.admin_email = "admin@toolstack.com"
        self.admin_password = "Admin123!Secure"
        
        # Test data
        self.admin_token = None
        self.test_blog_id = None
        self.test_contact_id = None
        
        # Results tracking - Updated for new test categories
        self.results = {
            "health_connectivity": {"passed": 0, "failed": 0, "errors": []},
            "cors_validation": {"passed": 0, "failed": 0, "errors": []},
            "admin_bootstrap": {"passed": 0, "failed": 0, "errors": []},
            "input_normalization": {"passed": 0, "failed": 0, "errors": []},
            "admin_dashboard": {"passed": 0, "failed": 0, "errors": []},
            "mongodb_persistence": {"passed": 0, "failed": 0, "errors": []}
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
            "https://test.preview.emergentagent.com",
            "https://another-app.preview.emergentagent.com", 
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
        """Run all test suites based on review request priorities"""
        print("🧪 Starting ToolStack CRM API Tests - URL Change Resilience & Persistence...")
        
        # HIGH PRIORITY TESTS as per review request
        print("\n" + "="*70)
        print("HIGH PRIORITY TESTS - Critical Fixes")
        print("="*70)
        
        # 1. Health Checks & Connectivity
        self.test_health_checks_connectivity()
        
        # 2. Admin Authentication with Input Normalization  
        self.test_input_normalization_auth()
        
        # 3. Admin Bootstrap Verification
        self.test_admin_bootstrap_verification()
        
        # 4. Admin Dashboard Access
        self.test_admin_dashboard_access()
        
        # 5. CORS Validation
        self.test_cors_validation()
        
        # Print summary
        self.print_summary()

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