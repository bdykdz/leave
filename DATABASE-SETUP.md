# Database Setup Instructions

## Option 1: Docker (Recommended)

### Prerequisites
1. **Install Docker Desktop**:
   - Mac: Download from [docker.com](https://www.docker.com/products/docker-desktop/)
   - Windows: Download Docker Desktop for Windows
   - Linux: Install Docker Engine

2. **Start Docker Desktop** (the whale icon should be running in your menu bar)

### Start the Database
```bash
# Start PostgreSQL and Redis
npm run db:up

# This runs: docker-compose up -d
# Creates:
# - PostgreSQL on port 5432
# - Redis on port 6379  
# - Adminer on port 8080 (database UI)
```

### Verify it's running
```bash
docker ps
# Should show: leave-management-db, leave-management-redis, leave-management-adminer
```

## Option 2: Local PostgreSQL

If you prefer to install PostgreSQL locally:

### Mac
```bash
brew install postgresql@15
brew services start postgresql@15
createdb leavemanagement
```

### Windows
1. Download PostgreSQL installer from postgresql.org
2. Run installer, remember the password
3. Create database using pgAdmin or command line

### Linux
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo -u postgres createdb leavemanagement
```

## Option 3: Cloud Database (Free Tiers)

### Supabase (Recommended for testing)
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Copy the connection string
4. Update `.env` and `.env.local`:
   ```
   DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT].supabase.co:5432/postgres"
   ```

### Neon
1. Go to [neon.tech](https://neon.tech)
2. Create a database
3. Copy connection string to `.env` files

## Next Steps

Once your database is running:

```bash
# 1. Run migrations to create tables
npm run db:migrate

# 2. Generate Prisma Client
npm run db:generate

# 3. (Optional) Open Prisma Studio to view database
npm run db:studio

# 4. Seed the database with test data
npm run db:seed
```

## Connection Details

If using Docker, your connection details are:
- Host: localhost
- Port: 5432
- Database: leavemanagement
- Username: postgres
- Password: password

## Troubleshooting

### Docker not running
- Make sure Docker Desktop is started
- Check the whale icon in your menu bar
- Run `docker --version` to verify installation

### Port already in use
```bash
# Check what's using port 5432
lsof -i :5432

# Use different port in docker-compose.yml:
# ports:
#   - "5433:5432"  # Use 5433 instead
```

### Can't connect to database
1. Check Docker is running: `docker ps`
2. Check logs: `docker-compose logs postgres`
3. Try connecting with psql: `psql -h localhost -U postgres -d leavemanagement`