#!/bin/bash

# Railway Deployment Helper Script
# This script helps validate environment and prepare for Railway deployment

set -e

echo "🚂 Railway Deployment Validation"
echo "=================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Railway CLI is installed
echo "📦 Checking Railway CLI..."
if ! command -v railway &> /dev/null; then
    echo -e "${RED}❌ Railway CLI not found${NC}"
    echo "Install with: npm install -g @railway/cli"
    exit 1
fi
echo -e "${GREEN}✅ Railway CLI installed${NC}"
echo ""

# Check if logged in to Railway
echo "🔐 Checking Railway authentication..."
if ! railway whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Railway${NC}"
    echo "Run: railway login"
    exit 1
fi
echo -e "${GREEN}✅ Authenticated with Railway${NC}"
echo ""

# Check Docker
echo "🐳 Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not found${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker installed${NC}"
echo ""

# Test build Dockerfile.transcoder
echo "🎥 Testing transcoder Dockerfile build..."
if docker build -f Dockerfile.transcoder -t play-transcoder-test . --quiet > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Transcoder Dockerfile builds successfully${NC}"
    docker rmi play-transcoder-test > /dev/null 2>&1 || true
else
    echo -e "${RED}❌ Transcoder Dockerfile build failed${NC}"
    echo "Run: docker build -f Dockerfile.transcoder -t play-transcoder-test ."
    exit 1
fi
echo ""

# Check required environment variables in .env.railway
echo "🔑 Checking .env.railway template..."
if [ ! -f ".env.railway" ]; then
    echo -e "${YELLOW}⚠️  .env.railway not found${NC}"
    echo "A template has been created. Please fill in the values."
else
    echo -e "${GREEN}✅ .env.railway exists${NC}"
fi
echo ""

# Check Dockerfiles exist
echo "📄 Checking Dockerfiles..."
files=("Dockerfile.service" "Dockerfile.transcoder")
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $file exists${NC}"
    else
        echo -e "${RED}❌ $file not found${NC}"
        exit 1
    fi
done
echo ""

# Check FFmpeg is in Dockerfile.transcoder
echo "🎬 Verifying FFmpeg in transcoder Dockerfile..."
if grep -q "ffmpeg" Dockerfile.transcoder; then
    echo -e "${GREEN}✅ FFmpeg found in Dockerfile.transcoder${NC}"
else
    echo -e "${RED}❌ FFmpeg not found in Dockerfile.transcoder${NC}"
    exit 1
fi
echo ""

# Summary
echo "=================================="
echo -e "${GREEN}✅ Pre-deployment checks passed!${NC}"
echo ""
echo "📋 Next Steps:"
echo "1. Fill in .env.railway with your production values"
echo "2. Setup infrastructure services:"
echo "   - PostgreSQL (Railway Plugin)"
echo "   - Redis (Railway Plugin)"
echo "   - CloudAMQP (external)"
echo "   - Cloudflare R2 or AWS S3"
echo "   - Meilisearch (Railway or Cloud)"
echo "3. Create Railway services for each microservice"
echo "4. Configure environment variables in Railway"
echo "5. Deploy services in order:"
echo "   railway up --service user-service"
echo "   railway up --service video-service"
echo "   railway up --service transcoder-service --dockerfile Dockerfile.transcoder"
echo "   railway up --service engagement-service"
echo "   railway up --service search-service"
echo "   railway up --service feed-service"
echo "   railway up --service notification-service"
echo "   railway up --service client"
echo "6. Run migrations: railway run pnpm db:migrate"
echo "7. Seed database: railway run pnpm tsx packages/database/src/seed-admin.ts"
echo ""
echo "📖 Full guide: See railway_deployment_plan.md"
