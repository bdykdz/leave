# ReportPortal Test Dashboard Setup

## What is ReportPortal?

ReportPortal is a full-featured test management platform with:
- 📊 Dashboard with test analytics
- 📈 Test run history and trends
- 🔄 Compare runs across iterations
- 📸 Screenshots, logs, and video attachments
- 🐛 Flaky test detection
- 🏷️ Test categorization and filtering
- 🚀 Launch tests from UI (with CI integration)

## Quick Start

### 1. Start ReportPortal

```bash
docker-compose -f docker-compose.reportportal.yml up -d
```

Wait ~2 minutes for all services to start. Check status:
```bash
docker-compose -f docker-compose.reportportal.yml ps
```

### 2. Access ReportPortal

Open: http://localhost:9090

**Default credentials:**
- Username: `superadmin`
- Password: `erebus`

### 3. Create Project & Get API Key

1. Login to ReportPortal
2. Go to **Administration** → **Projects** → **Add Project**
3. Name it `leave-management`
4. Go to your profile (top right) → **API Keys** → **Generate**
5. Copy the API key

### 4. Configure API Key

Edit `reportportal.config.json`:
```json
{
  "apiKey": "YOUR_API_KEY_HERE",
  ...
}
```

### 5. Run Tests with ReportPortal

```bash
# Run security tests
PLAYWRIGHT_BASE_URL=http://localhost:8082 npx playwright test tests/security --config=playwright.reportportal.config.ts

# Run all tests
PLAYWRIGHT_BASE_URL=http://localhost:8082 npx playwright test --config=playwright.reportportal.config.ts

# Run smoke tests
PLAYWRIGHT_BASE_URL=http://localhost:8082 npx playwright test tests/smoke --config=playwright.reportportal.config.ts
```

### 6. View Results

Go to http://localhost:9090 → **Launches** to see your test results

## Features

### Dashboard
- Overall pass/fail metrics
- Execution trends over time
- Flaky test identification

### Launches (Test Runs)
- Each test run is a "Launch"
- Compare multiple launches
- Filter by status, tags, etc.

### Test Items
- Drill down into individual tests
- View screenshots, logs, videos
- Mark tests as investigated

### Widgets
- Customize dashboard with widgets
- Create team-specific views

## Stopping ReportPortal

```bash
docker-compose -f docker-compose.reportportal.yml down
```

To remove all data:
```bash
docker-compose -f docker-compose.reportportal.yml down -v
```

## Troubleshooting

### Services won't start
```bash
# Check logs
docker-compose -f docker-compose.reportportal.yml logs -f

# Restart
docker-compose -f docker-compose.reportportal.yml restart
```

### Can't connect
- Ensure port 9090 is not in use
- Wait 2-3 minutes for all services to initialize
- Check: `curl http://localhost:9090/health`

### API Key issues
- Regenerate API key in ReportPortal UI
- Ensure project name matches in config

## CI Integration

For GitHub Actions, add these secrets:
- `RP_ENDPOINT`: http://your-reportportal-host:9090/api/v1
- `RP_API_KEY`: Your API key
- `RP_PROJECT`: leave-management

Then in your workflow:
```yaml
- name: Run Tests
  env:
    RP_ENDPOINT: ${{ secrets.RP_ENDPOINT }}
    RP_API_KEY: ${{ secrets.RP_API_KEY }}
  run: npx playwright test --config=playwright.reportportal.config.ts
```
