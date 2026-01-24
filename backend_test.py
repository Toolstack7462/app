#!/usr/bin/env python3
"""
ToolStack CRM Backend API Testing Suite
Tests all backend APIs including authentication, blog management, and contact management.
"""

import requests
import json
import os
import sys
from datetime import datetime
import uuid

class ToolStackCRMTester:
    def __init__(self):
        # Get backend URL from frontend .env
        self.base_url = "https://crm-complete-4.preview.emergentagent.com"
        self.api_base = f"{self.base_url}/api/crm"
        
        # Admin credentials
        self.admin_email = "admin@toolstack.com"
        self.admin_password = "Admin123!Secure"
        
        # Test data
        self.admin_token = None
        self.test_blog_id = None
        self.test_contact_id = None
        
        # Results tracking
        self.results = {
            "authentication": {"passed": 0, "failed": 0, "errors": []},
            "blog_api": {"passed": 0, "failed": 0, "errors": []},
            "contact_api": {"passed": 0, "failed": 0, "errors": []},
            "public_api": {"passed": 0, "failed": 0, "errors": []}
        }
        
        print(f"🚀 ToolStack CRM API Tester")
        print(f"📡 Backend URL: {self.base_url}")
        print(f"🔗 API Base: {self.api_base}")
        print("=" * 60)

    def log_result(self, category, test_name, success, error=None):
        """Log test result"""
        if success:
            self.results[category]["passed"] += 1
            print(f"✅ {test_name}")
        else:
            self.results[category]["failed"] += 1
            self.results[category]["errors"].append(f"{test_name}: {error}")
            print(f"❌ {test_name}: {error}")

    def make_request(self, method, endpoint, data=None, headers=None, auth_required=True):
        """Make HTTP request with proper headers"""
        url = f"{self.api_base}{endpoint}"
        
        request_headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
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

    def test_authentication(self):
        """Test authentication endpoints"""
        print("\n🔐 Testing Authentication...")
        
        # Test admin login
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
                    self.log_result("authentication", "Admin login successful", True)
                    
                    # Test getting current user
                    me_response = self.make_request("GET", "/auth/me")
                    if me_response and me_response.status_code == 200:
                        me_data = me_response.json()
                        if me_data.get("success") and me_data.get("user"):
                            self.log_result("authentication", "Get current user", True)
                        else:
                            self.log_result("authentication", "Get current user", False, "Invalid response format")
                    else:
                        self.log_result("authentication", "Get current user", False, f"HTTP {me_response.status_code if me_response else 'No response'}")
                else:
                    self.log_result("authentication", "Admin login", False, "Missing success or accessToken in response")
            except json.JSONDecodeError:
                self.log_result("authentication", "Admin login", False, "Invalid JSON response")
        else:
            self.log_result("authentication", "Admin login", False, f"HTTP {response.status_code if response else 'No response'}")

    def test_blog_api(self):
        """Test blog CRUD operations"""
        print("\n📝 Testing Blog API...")
        
        if not self.admin_token:
            self.log_result("blog_api", "Blog API tests", False, "No admin token available")
            return
        
        # Test get blog posts (empty list is OK)
        response = self.make_request("GET", "/admin/blog")
        if response and response.status_code == 200:
            try:
                data = response.json()
                if data.get("success") is not None:
                    self.log_result("blog_api", "List blog posts", True)
                else:
                    self.log_result("blog_api", "List blog posts", False, "Invalid response format")
            except json.JSONDecodeError:
                self.log_result("blog_api", "List blog posts", False, "Invalid JSON response")
        else:
            self.log_result("blog_api", "List blog posts", False, f"HTTP {response.status_code if response else 'No response'}")
        
        # Test get blog stats
        response = self.make_request("GET", "/admin/blog/stats")
        if response and response.status_code == 200:
            try:
                data = response.json()
                if data.get("success") and "stats" in data:
                    self.log_result("blog_api", "Get blog statistics", True)
                else:
                    self.log_result("blog_api", "Get blog statistics", False, "Invalid response format")
            except json.JSONDecodeError:
                self.log_result("blog_api", "Get blog statistics", False, "Invalid JSON response")
        else:
            self.log_result("blog_api", "Get blog statistics", False, f"HTTP {response.status_code if response else 'No response'}")
        
        # Test create blog post
        blog_data = {
            "title": f"Test Blog Post {datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "content": "This is a comprehensive test blog post content for the ToolStack CRM system. It includes detailed information about our testing procedures and methodologies.",
            "excerpt": "A test blog post for API validation",
            "category": "Technology",
            "tags": ["testing", "api", "crm"],
            "status": "published",
            "featured": False
        }
        
        response = self.make_request("POST", "/admin/blog", blog_data)
        if response and response.status_code == 201:
            try:
                data = response.json()
                if data.get("success") and data.get("post"):
                    self.test_blog_id = data["post"]["_id"]
                    self.log_result("blog_api", "Create blog post", True)
                else:
                    self.log_result("blog_api", "Create blog post", False, "Invalid response format")
            except json.JSONDecodeError:
                self.log_result("blog_api", "Create blog post", False, "Invalid JSON response")
        else:
            self.log_result("blog_api", "Create blog post", False, f"HTTP {response.status_code if response else 'No response'}")
        
        # Test get single blog post
        if self.test_blog_id:
            response = self.make_request("GET", f"/admin/blog/{self.test_blog_id}")
            if response and response.status_code == 200:
                try:
                    data = response.json()
                    if data.get("success") and data.get("post"):
                        self.log_result("blog_api", "Get single blog post", True)
                    else:
                        self.log_result("blog_api", "Get single blog post", False, "Invalid response format")
                except json.JSONDecodeError:
                    self.log_result("blog_api", "Get single blog post", False, "Invalid JSON response")
            else:
                self.log_result("blog_api", "Get single blog post", False, f"HTTP {response.status_code if response else 'No response'}")
            
            # Test update blog post
            update_data = {
                "title": f"Updated Test Blog Post {datetime.now().strftime('%Y%m%d_%H%M%S')}",
                "content": "This is updated content for the test blog post.",
                "category": "Updates"
            }
            
            response = self.make_request("PUT", f"/admin/blog/{self.test_blog_id}", update_data)
            if response and response.status_code == 200:
                try:
                    data = response.json()
                    if data.get("success"):
                        self.log_result("blog_api", "Update blog post", True)
                    else:
                        self.log_result("blog_api", "Update blog post", False, "Invalid response format")
                except json.JSONDecodeError:
                    self.log_result("blog_api", "Update blog post", False, "Invalid JSON response")
            else:
                self.log_result("blog_api", "Update blog post", False, f"HTTP {response.status_code if response else 'No response'}")

    def test_contact_api(self):
        """Test contact management API"""
        print("\n📞 Testing Contact API...")
        
        if not self.admin_token:
            self.log_result("contact_api", "Contact API tests", False, "No admin token available")
            return
        
        # Test get contacts (empty list is OK)
        response = self.make_request("GET", "/admin/contacts")
        if response and response.status_code == 200:
            try:
                data = response.json()
                if data.get("success") is not None:
                    self.log_result("contact_api", "List contacts", True)
                    
                    # If there are contacts, test getting the first one
                    if data.get("contacts") and len(data["contacts"]) > 0:
                        first_contact_id = data["contacts"][0]["_id"]
                        contact_response = self.make_request("GET", f"/admin/contacts/{first_contact_id}")
                        if contact_response and contact_response.status_code == 200:
                            contact_data = contact_response.json()
                            if contact_data.get("success"):
                                self.log_result("contact_api", "Get single contact", True)
                            else:
                                self.log_result("contact_api", "Get single contact", False, "Invalid response format")
                        else:
                            self.log_result("contact_api", "Get single contact", False, f"HTTP {contact_response.status_code if contact_response else 'No response'}")
                else:
                    self.log_result("contact_api", "List contacts", False, "Invalid response format")
            except json.JSONDecodeError:
                self.log_result("contact_api", "List contacts", False, "Invalid JSON response")
        else:
            self.log_result("contact_api", "List contacts", False, f"HTTP {response.status_code if response else 'No response'}")
        
        # Test get contact stats
        response = self.make_request("GET", "/admin/contacts/stats")
        if response and response.status_code == 200:
            try:
                data = response.json()
                if data.get("success") and "stats" in data:
                    self.log_result("contact_api", "Get contact statistics", True)
                else:
                    self.log_result("contact_api", "Get contact statistics", False, "Invalid response format")
            except json.JSONDecodeError:
                self.log_result("contact_api", "Get contact statistics", False, "Invalid JSON response")
        else:
            self.log_result("contact_api", "Get contact statistics", False, f"HTTP {response.status_code if response else 'No response'}")

    def test_public_api(self):
        """Test public APIs (no authentication required)"""
        print("\n🌐 Testing Public API...")
        
        # Test get public blog posts
        response = self.make_request("GET", "/public/blog", auth_required=False)
        if response and response.status_code == 200:
            try:
                data = response.json()
                if data.get("success") is not None:
                    self.log_result("public_api", "Get public blog posts", True)
                else:
                    self.log_result("public_api", "Get public blog posts", False, "Invalid response format")
            except json.JSONDecodeError:
                self.log_result("public_api", "Get public blog posts", False, "Invalid JSON response")
        else:
            self.log_result("public_api", "Get public blog posts", False, f"HTTP {response.status_code if response else 'No response'}")
        
        # Test submit contact form
        contact_data = {
            "name": "John Smith",
            "email": "john.smith@example.com",
            "phone": "+1-555-0123",
            "subject": "API Testing Inquiry",
            "message": "This is a test contact form submission to validate the public contact API endpoint functionality."
        }
        
        response = self.make_request("POST", "/public/contact", contact_data, auth_required=False)
        if response and response.status_code == 201:
            try:
                data = response.json()
                if data.get("success") and data.get("contactId"):
                    self.test_contact_id = data["contactId"]
                    self.log_result("public_api", "Submit contact form", True)
                else:
                    self.log_result("public_api", "Submit contact form", False, "Invalid response format")
            except json.JSONDecodeError:
                self.log_result("public_api", "Submit contact form", False, "Invalid JSON response")
        else:
            self.log_result("public_api", "Submit contact form", False, f"HTTP {response.status_code if response else 'No response'}")

    def cleanup_test_data(self):
        """Clean up test data"""
        print("\n🧹 Cleaning up test data...")
        
        if not self.admin_token:
            print("⚠️  No admin token available for cleanup")
            return
        
        # Delete test blog post
        if self.test_blog_id:
            response = self.make_request("DELETE", f"/admin/blog/{self.test_blog_id}")
            if response and response.status_code == 200:
                print("✅ Test blog post deleted")
            else:
                print(f"⚠️  Failed to delete test blog post: HTTP {response.status_code if response else 'No response'}")
        
        # Note: We don't delete the test contact as it's useful for admin testing

    def run_all_tests(self):
        """Run all test suites"""
        print("🧪 Starting ToolStack CRM API Tests...")
        
        # Test authentication first
        self.test_authentication()
        
        # Test blog API
        self.test_blog_api()
        
        # Test contact API
        self.test_contact_api()
        
        # Test public API
        self.test_public_api()
        
        # Cleanup
        self.cleanup_test_data()
        
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