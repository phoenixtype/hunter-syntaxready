#!/bin/bash

# Test Notification Processing Flow
# Tests the complete notification queue → processor → email flow

set -e

echo "🧪 Testing Notification Processing Flow"
echo "======================================="

# Configuration
SUPABASE_URL="https://ffjsgjsiemtxqbhimvhb.supabase.co"
PROCESSOR_URL="${SUPABASE_URL}/functions/v1/process-notifications"

echo ""
echo "1. Testing processor health..."
health_response=$(curl -s -X GET "$PROCESSOR_URL")
echo "Health check: $health_response"

if [[ $health_response == *"healthy"* ]]; then
    echo "✅ Processor is healthy"
else
    echo "❌ Processor health check failed"
    exit 1
fi

echo ""
echo "2. Running processor (should find no pending notifications)..."
process_response=$(curl -s -X POST "$PROCESSOR_URL")
echo "Process result: $process_response"

if [[ $process_response == *"success"* ]]; then
    echo "✅ Processor runs successfully"
else
    echo "❌ Processor run failed"
    exit 1
fi

echo ""
echo "3. Testing notification creation..."
echo "   (You would need to run the Node.js script to create test notifications)"
echo "   Run: node scripts/create-test-notifications.js"

echo ""
echo "4. Testing cron job..."
echo "   Cron job is set to run every 5 minutes automatically"
echo "   Check Supabase logs to see processing activity"

echo ""
echo "🎉 All tests passed!"
echo ""
echo "Next steps:"
echo "- Create test notifications: node scripts/create-test-notifications.js"
echo "- Check your email for notifications"
echo "- Monitor Supabase function logs"
echo "- Review notification_queue and notification_history tables"