#!/bin/bash

# Play Platform - Full Cleanup Script
# Resets all services to a clean state

set -e

echo "🧹 Play Platform Cleanup"
echo "========================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Reset PostgreSQL Database
echo -e "\n${YELLOW}[1/5] Resetting PostgreSQL database...${NC}"
# Drop all tables and recreate with db push (since no migrations exist)
docker exec play-postgres psql -U play -d play -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" > /dev/null 2>&1 || true
npx prisma db push --schema=packages/database/prisma/schema.prisma --force-reset --accept-data-loss
echo -e "${GREEN}✓ PostgreSQL reset complete${NC}"

# 2. Create GIN indexes (post-migration step)
echo -e "\n${YELLOW}[2/5] Creating GIN indexes for tag searches...${NC}"
docker exec play-postgres psql -U play -d play -c "
CREATE INDEX IF NOT EXISTS idx_videos_tags ON videos USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_live_streams_tags ON live_streams USING GIN(tags);
" > /dev/null 2>&1 || echo -e "${RED}⚠ GIN index creation failed${NC}"
echo -e "${GREEN}✓ GIN indexes created${NC}"

# 3. Flush Redis
echo -e "\n${YELLOW}[3/5] Flushing Redis...${NC}"
docker exec play-redis redis-cli FLUSHALL > /dev/null 2>&1 || echo -e "${RED}⚠ Redis flush failed (container may not be running)${NC}"
echo -e "${GREEN}✓ Redis flushed${NC}"

# 4. Clear MinIO
echo -e "\n${YELLOW}[4/5] Clearing MinIO storage...${NC}"
mc alias set playlocal http://localhost:9000 playadmin playadmin123 > /dev/null 2>&1 || true
mc rm --recursive --force playlocal/play-videos > /dev/null 2>&1 || echo -e "${YELLOW}⚠ MinIO bucket empty or not found${NC}"
echo -e "${GREEN}✓ MinIO cleared${NC}"

# 5. Clear Meilisearch indexes
echo -e "\n${YELLOW}[5/5] Clearing Meilisearch indexes...${NC}"
curl -s -X DELETE 'http://localhost:7700/indexes/videos' -H 'Authorization: Bearer play-search-key' > /dev/null 2>&1 || true
curl -s -X DELETE 'http://localhost:7700/indexes/channels' -H 'Authorization: Bearer play-search-key' > /dev/null 2>&1 || true
echo -e "${GREEN}✓ Meilisearch indexes cleared${NC}"

echo -e "\n${GREEN}========================${NC}"
echo -e "${GREEN}✅ All services cleaned up!${NC}"
echo -e "${GREEN}========================${NC}"

