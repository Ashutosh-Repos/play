#!/usr/bin/env node
/**
 * Environment Variable Validator
 * Checks if all required environment variables are set
 * Run before deployment or in CI/CD pipeline
 */

import { serverEnv } from "../packages/config/src/server.js";

const REQUIRED_PROD_VARS = [
  'DATABASE_URL',
  'REDIS_URL',
  'RABBITMQ_URL',
  'MINIO_ENDPOINT',
  'MINIO_ACCESS_KEY',
  'MINIO_SECRET_KEY',
  'MINIO_BUCKET',
  'MEILISEARCH_URL',
  'MEILISEARCH_KEY',
  'JWT_SECRET',
  'AUTH_SECRET',
  'NEXTAUTH_SECRET',
];

// Service-specific URLs (for client)
const SERVICE_URLS = [
  'USER_SERVICE_URL',
  'VIDEO_SERVICE_URL',
  'ENGAGEMENT_SERVICE_URL',
  'SEARCH_SERVICE_URL',
  'FEED_SERVICE_URL',
  'NOTIFICATION_SERVICE_URL',
];

console.log('🔍 Validating Environment Variables...\n');

let hasErrors = false;

// Check required variables
console.log('📋 Required Variables:');
REQUIRED_PROD_VARS.forEach((key) => {
  const value = process.env[key];
  if (!value || value === '<placeholder>' || value.includes('<')) {
    console.log(`  ❌ ${key} - MISSING or invalid`);
    hasErrors = true;
  } else {
    // Mask sensitive values
    const masked = key.includes('SECRET') || key.includes('PASSWORD') || key.includes('KEY')
      ? '***' + value.slice(-4)
      : value.substring(0, 50);
    console.log(`  ✅ ${key} - ${masked}`);
  }
});

console.log('\n🔗 Service URLs (for client):');
SERVICE_URLS.forEach((key) => {
  const value = process.env[key];
  if (value) {
    console.log(`  ✅ ${key} - ${value}`);
  } else {
    console.log(`  ⚠️  ${key} - using default (localhost)`);
  }
});

console.log('\n🌍 Environment:');
console.log(`  NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`  PORT: ${process.env.PORT || 'not set (will use service default)'}`);

// Validate serverEnv loading
console.log('\n📦 Testing @repo/config loading...');
try {
  console.log('  ✅ serverEnv loaded successfully');
  console.log(`  ✅ NODE_ENV: ${serverEnv.NODE_ENV}`);
  console.log(`  ✅ MINIO_USE_SSL: ${serverEnv.MINIO_USE_SSL}`);
} catch (error) {
  console.log('  ❌ Failed to load serverEnv:', error.message);
  hasErrors = true;
}

console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.log('❌ VALIDATION FAILED - Fix errors above');
  process.exit(1);
} else {
  console.log('✅ ALL CHECKS PASSED');
  console.log('✨ Environment is ready for deployment');
  process.exit(0);
}
