#!/bin/bash

# Performance Test Runner
# Usage: ./run-tests.sh [test-type] [options]
#
# Test types:
#   baseline  - Normal load (10 VUs)
#   peak      - 2x load (20 VUs)
#   stress    - Find breaking point (up to 200 VUs)
#   spike     - Sudden traffic burst
#   soak      - Extended stability (30 min)
#   critical  - Critical endpoints focus
#   all       - Run baseline, peak, and critical

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPORT_DIR="${SCRIPT_DIR}/reports"
BASE_URL="${BASE_URL:-http://localhost:3000}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored message
print_msg() {
    local color=$1
    local msg=$2
    echo -e "${color}${msg}${NC}"
}

# Check if k6 is installed
check_k6() {
    if ! command -v k6 &> /dev/null; then
        print_msg $RED "Error: k6 is not installed."
        echo ""
        echo "Install k6:"
        echo "  macOS:   brew install k6"
        echo "  Ubuntu:  sudo gpg -k; sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69"
        echo "           echo \"deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main\" | sudo tee /etc/apt/sources.list.d/k6.list"
        echo "           sudo apt-get update && sudo apt-get install k6"
        echo "  Windows: choco install k6"
        echo "  Docker:  docker run -i grafana/k6 run - <script.js"
        echo ""
        exit 1
    fi
    print_msg $GREEN "✓ k6 is installed: $(k6 version)"
}

# Check if application is running
check_app() {
    print_msg $BLUE "Checking if application is running at ${BASE_URL}..."
    if curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/health" | grep -q "200"; then
        print_msg $GREEN "✓ Application is healthy"
    else
        print_msg $YELLOW "⚠ Application may not be running or healthy at ${BASE_URL}"
        echo "  Start the application first: pnpm dev"
        read -p "Continue anyway? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Create reports directory
setup_reports() {
    mkdir -p "${REPORT_DIR}"
    print_msg $GREEN "✓ Reports directory: ${REPORT_DIR}"
}

# Run a specific test
run_test() {
    local test_name=$1
    local test_file=$2
    local report_file="${REPORT_DIR}/${test_name}_${TIMESTAMP}"

    print_msg $BLUE "═══════════════════════════════════════════════════════════"
    print_msg $BLUE "Running ${test_name} test..."
    print_msg $BLUE "═══════════════════════════════════════════════════════════"

    k6 run \
        --out json="${report_file}.json" \
        --summary-export="${report_file}_summary.json" \
        -e BASE_URL="${BASE_URL}" \
        "${SCRIPT_DIR}/${test_file}"

    print_msg $GREEN "✓ ${test_name} test completed"
    print_msg $GREEN "  Results: ${report_file}.json"
    print_msg $GREEN "  Summary: ${report_file}_summary.json"
    echo ""
}

# Display usage
usage() {
    echo "Leave Management Performance Test Runner"
    echo ""
    echo "Usage: $0 [test-type] [options]"
    echo ""
    echo "Test types:"
    echo "  baseline   Run baseline load test (10 VUs, 3 min)"
    echo "  peak       Run peak load test (20 VUs, 4.5 min)"
    echo "  stress     Run stress test (up to 200 VUs, 6.5 min)"
    echo "  spike      Run spike test (5->100 VUs, 3.5 min)"
    echo "  soak       Run soak test (15 VUs, 30 min)"
    echo "  critical   Run critical endpoints test (20 VUs, 4.5 min)"
    echo "  all        Run baseline, peak, and critical tests"
    echo ""
    echo "Options:"
    echo "  -u, --url URL    Base URL (default: http://localhost:3000)"
    echo "  -h, --help       Show this help"
    echo ""
    echo "Environment variables:"
    echo "  BASE_URL                 Base URL of the application"
    echo "  TEST_AUTH_SECRET         Auth secret for test endpoints"
    echo "  TEST_EMPLOYEE_EMAIL      Test employee email"
    echo "  TEST_MANAGER_EMAIL       Test manager email"
    echo "  TEST_HR_EMAIL            Test HR email"
    echo ""
    echo "Examples:"
    echo "  $0 baseline"
    echo "  $0 stress -u http://staging.example.com:3000"
    echo "  BASE_URL=http://production.example.com $0 peak"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -u|--url)
            BASE_URL="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        baseline|peak|stress|spike|soak|critical|all)
            TEST_TYPE="$1"
            shift
            ;;
        *)
            print_msg $RED "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Default to baseline if no test specified
TEST_TYPE="${TEST_TYPE:-baseline}"

# Main execution
main() {
    echo ""
    print_msg $BLUE "╔═══════════════════════════════════════════════════════════╗"
    print_msg $BLUE "║     Leave Management Performance Testing Suite            ║"
    print_msg $BLUE "╚═══════════════════════════════════════════════════════════╝"
    echo ""

    check_k6
    check_app
    setup_reports

    echo ""
    print_msg $YELLOW "Target URL: ${BASE_URL}"
    print_msg $YELLOW "Test type: ${TEST_TYPE}"
    echo ""

    case $TEST_TYPE in
        baseline)
            run_test "baseline" "baseline-load-test.js"
            ;;
        peak)
            run_test "peak" "peak-load-test.js"
            ;;
        stress)
            run_test "stress" "stress-test.js"
            ;;
        spike)
            run_test "spike" "spike-test.js"
            ;;
        soak)
            print_msg $YELLOW "⚠ Soak test runs for 30 minutes. Press Ctrl+C to stop early."
            run_test "soak" "soak-test.js"
            ;;
        critical)
            run_test "critical" "critical-endpoints-test.js"
            ;;
        all)
            run_test "baseline" "baseline-load-test.js"
            run_test "peak" "peak-load-test.js"
            run_test "critical" "critical-endpoints-test.js"
            ;;
        *)
            print_msg $RED "Unknown test type: ${TEST_TYPE}"
            usage
            exit 1
            ;;
    esac

    print_msg $GREEN "═══════════════════════════════════════════════════════════"
    print_msg $GREEN "All tests completed!"
    print_msg $GREEN "Reports saved to: ${REPORT_DIR}"
    print_msg $GREEN "═══════════════════════════════════════════════════════════"
}

main
