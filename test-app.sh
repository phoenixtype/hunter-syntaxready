#!/bin/bash

# Hunter Application - Comprehensive Test Script
# This script tests all major functionality

echo "🧪 Hunter Application - Comprehensive Test Suite"
echo "================================================"
echo ""

BASE_URL="http://localhost:8080"
PASSED=0
FAILED=0

# Function to test endpoint
test_endpoint() {
    local name=$1
    local url=$2
    local expected_code=$3
    
    echo -n "Testing $name... "
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    
    if [ "$response" = "$expected_code" ]; then
        echo "✅ PASSED (HTTP $response)"
        ((PASSED++))
    else
        echo "❌ FAILED (Expected $expected_code, got $response)"
        ((FAILED++))
    fi
}

# Test landing page
test_endpoint "Landing Page" "$BASE_URL/" "200"

# Test signup page
test_endpoint "Signup Page" "$BASE_URL/signup" "200"

# Test login page
test_endpoint "Login Page" "$BASE_URL/login" "200"

# Test 404 handling
test_endpoint "404 Page" "$BASE_URL/nonexistent-page-12345" "200"

# Test static assets
test_endpoint "Favicon" "$BASE_URL/favicon.ico" "200"

echo ""
echo "================================================"
echo "Test Results:"
echo "✅ Passed: $PASSED"
echo "❌ Failed: $FAILED"
echo "================================================"

if [ $FAILED -eq 0 ]; then
    echo "🎉 All tests passed!"
    exit 0
else
    echo "⚠️  Some tests failed"
    exit 1
fi
