#!/bin/bash
# Allure Report Server
# Run with: ./scripts/allure-server.sh
# Or in tmux: tmux new -d -s allure './scripts/allure-server.sh'

cd /opt/leave-management/leave

echo "🚀 Starting Allure Report Server..."
echo "📊 Dashboard: http://localhost:4040"
echo ""
echo "To run tests and update reports:"
echo "  PLAYWRIGHT_BASE_URL=http://localhost:8082 npm run test:allure"
echo ""

# Generate initial report if results exist
if [ -d "allure-results" ] && [ "$(ls -A allure-results 2>/dev/null)" ]; then
    echo "📈 Generating report from existing results..."
    npx allure generate allure-results --clean -o allure-report
fi

# Serve reports (auto-regenerates when results change)
npx allure serve allure-results -p 4040 --host 0.0.0.0
