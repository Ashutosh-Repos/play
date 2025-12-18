#!/usr/bin/env node

/**
 * E2E Integration Test for Play Video Platform
 * 
 * Tests the complete user journey:
 * 1. Service Health Checks
 * 2. Video Search
 * 3. Feed Retrieval
 * 4. Notifications Check
 */

const http = require('http');

// Configuration
const BASE_URLS = {
    user: 'http://localhost:4002',
    video: 'http://localhost:4003',
    engagement: 'http://localhost:4006',
    search: 'http://localhost:4009',
    feed: 'http://localhost:4010',
    notification: 'http://localhost:4011'
};

// Helper: HTTP Request
function request(method, url, data = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = body ? JSON.parse(body) : {};
                    resolve({ status: res.statusCode, body: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, body });
                }
            });
        });

        req.on('error', reject);
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function log(step, message, data = null) {
    console.log(`\n[${step}] ${message}`);
    if (data) {
        console.log(JSON.stringify(data, null, 2));
    }
}

// Test: Health Checks
async function testHealthChecks() {
    log('HEALTH', 'Checking all services...');
    
    const services = Object.entries(BASE_URLS);
    let allHealthy = true;
    
    for (const [name, url] of services) {
        try {
            const res = await request('GET', `${url}/health`);
            if (res.status === 200) {
                console.log(`  ✅ ${name}-service: ${res.body.status || 'OK'}`);
            } else {
                console.log(`  ❌ ${name}-service: HTTP ${res.status}`);
                allHealthy = false;
            }
        } catch (err) {
            console.log(`  ❌ ${name}-service: ${err.message}`);
            allHealthy = false;
        }
    }
    
    return allHealthy;
}

// Test: Search
async function testSearch() {
    log('SEARCH', 'Testing search functionality...');
    
    try {
        const res = await request('GET', `${BASE_URLS.search}/api/search?q=test&limit=5`);
        
        if (res.status === 200) {
            log('SEARCH', `✅ Found ${res.body.hits?.length || 0} results`, {
                totalHits: res.body.estimatedTotalHits
            });
            return true;
        } else {
            log('SEARCH', `❌ Search failed: HTTP ${res.status}`);
            return false;
        }
    } catch (err) {
        log('SEARCH', `❌ Error: ${err.message}`);
        return false;
    }
}

// Test: Feed
async function testFeed() {
    log('FEED', 'Testing trending feed...');
    
    try {
        const res = await request('GET', `${BASE_URLS.feed}/api/feed/trending?limit=10`);
        
        if (res.status === 200) {
            log('FEED', `✅ Trending feed returned ${res.body.videos?.length || 0} videos`);
            return true;
        } else {
            log('FEED', `❌ Feed failed: HTTP ${res.status}`);
            return false;
        }
    } catch (err) {
        log('FEED', `❌ Error: ${err.message}`);
        return false;
    }
}

// Test: Notifications
async function testNotifications() {
    log('NOTIFICATIONS', 'Checking notification service...');
    
    const testUserId = 'test-user-001';
    
    try {
        const res = await request('GET', `${BASE_URLS.notification}/api/notifications`, null, {
            'x-user-id': testUserId
        });
        
        if (res.status === 200) {
            log('NOTIFICATIONS', `✅ User has ${res.body.unreadCount || 0} unread notifications`);
            return true;
        } else {
            log('NOTIFICATIONS', `❌ Notifications failed: HTTP ${res.status}`);
            return false;
        }
    } catch (err) {
        log('NOTIFICATIONS', `❌ Error: ${err.message}`);
        return false;
    }
}

// Main E2E Test Runner
async function runE2ETests() {
    console.log('========================================');
    console.log('  Play Platform - E2E Integration Test');
    console.log('========================================');
    
    const results = {
        health: false,
        search: false,
        feed: false,
        notifications: false
    };
    
    try {
        results.health = await testHealthChecks();
        await wait(1000);
        
        if (results.health) {
            results.search = await testSearch();
            await wait(500);
            
            results.feed = await testFeed();
            await wait(500);
            
            results.notifications = await testNotifications();
        }
        
        console.log('\n========================================');
        console.log('  E2E Test Results');
        console.log('========================================');
        console.log(`Health Checks:  ${results.health ? '✅' : '❌'}`);
        console.log(`Search:         ${results.search ? '✅' : '❌'}`);
        console.log(`Feed:           ${results.feed ? '✅' : '❌'}`);
        console.log(`Notifications:  ${results.notifications ? '✅' : '❌'}`);
        console.log('========================================\n');
        
        const allPassed = Object.values(results).every(r => r);
        
        if (!allPassed) {
            console.error('Some tests failed. Please start all services with: pnpm dev:services');
            process.exit(1);
        }
        
    } catch (err) {
        console.error('\n❌ E2E Test Failed:', err);
        process.exit(1);
    }
}

// Run tests
runE2ETests();
