#!/usr/bin/env node

const readline = require('readline');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

console.log(`${RED}⚠️  WARNING: Database Reset${RESET}`);
console.log(`${YELLOW}This will PERMANENTLY DELETE all data in the database!${RESET}`);
console.log('');
console.log('This includes:');
console.log('  • All user accounts');
console.log('  • All leave requests');
console.log('  • All approvals and documents');
console.log('  • All settings and configurations');
console.log('');

// Check if in production
const isProd = process.env.NODE_ENV === 'production' || 
               process.env.DATABASE_URL?.includes('prod') ||
               process.env.DATABASE_URL?.includes('production');

if (isProd) {
  console.log(`${RED}🚨 PRODUCTION ENVIRONMENT DETECTED!${RESET}`);
  console.log(`${RED}Are you ABSOLUTELY SURE you want to reset the PRODUCTION database?${RESET}`);
  console.log('');
}

rl.question(`Type "${RED}DELETE ALL DATA${RESET}" to confirm: `, async (answer) => {
  if (answer !== 'DELETE ALL DATA') {
    console.log(`${GREEN}✅ Database reset cancelled. No data was deleted.${RESET}`);
    rl.close();
    process.exit(0);
  }

  // Additional confirmation for production
  if (isProd) {
    rl.question(`${RED}FINAL WARNING:${RESET} Type the database name to confirm: `, async (dbName) => {
      // Extract database name from DATABASE_URL if available
      const dbNameFromUrl = process.env.DATABASE_URL?.match(/\/([^?]+)(\?|$)/)?.[1];
      
      if (dbNameFromUrl && dbName !== dbNameFromUrl) {
        console.log(`${GREEN}✅ Database name doesn't match. Reset cancelled.${RESET}`);
        rl.close();
        process.exit(0);
      }
      
      await performReset();
    });
  } else {
    await performReset();
  }
});

async function performReset() {
  try {
    console.log(`${YELLOW}Resetting database...${RESET}`);
    
    // Create backup first
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    console.log(`Creating backup: backup-${timestamp}.sql`);
    
    // Try to create a backup (this assumes docker-compose with postgres)
    try {
      await execAsync(`docker-compose exec -T db pg_dump -U postgres leave_management > ./backups/backup-${timestamp}.sql`);
      console.log(`${GREEN}✅ Backup created successfully${RESET}`);
    } catch (backupError) {
      console.log(`${YELLOW}⚠️  Could not create backup (this is normal if not using Docker)${RESET}`);
    }
    
    // Perform the actual reset
    console.log('Stopping database containers...');
    await execAsync('docker-compose down -v');
    
    console.log('Starting fresh database containers...');
    await execAsync('docker-compose up -d');
    
    console.log('Waiting for database to be ready...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('Running migrations...');
    await execAsync('npx prisma migrate dev');
    
    console.log('Seeding database...');
    await execAsync('tsx prisma/seed.ts');
    
    console.log(`${GREEN}✅ Database has been reset successfully!${RESET}`);
    console.log('');
    console.log('Next steps:');
    console.log('  1. Navigate to /setup to configure Azure AD');
    console.log('  2. Import users from Microsoft 365');
    console.log('  3. Configure leave settings');
    
  } catch (error) {
    console.error(`${RED}❌ Error resetting database:${RESET}`, error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}