
import jwt from "jsonwebtoken";

// Use the secret from .env (AUTH_SECRET or JWT_SECRET)
// Copied from .env for standalone execution
const AUTH_SECRET = "VbyFelqTxFcsNxBWSyvptR6Sf2RPKtxl9eLVHex1lIk="; // matches .env

// Mock token payload
interface TokenPayload {
  sub: string;
  email: string;
  username: string;
  role: string;
  status: string;
  channelId?: string | null;
}

function createTestToken() {
  const payload: TokenPayload = {
    sub: "test-user-id",
    email: "testuser@example.com",
    username: "testuser",
    role: "USER",
    status: "ACTIVE", // Key: ACTIVE status
    channelId: "test-channel",
  };
  
  // Sign JWT
  return jwt.sign(payload, AUTH_SECRET, { expiresIn: '1h' });
}

async function verifyFix() {
  const token = createTestToken();
  const url = "http://localhost:4006/api/videos/test-video-id/reaction";

  console.log("Testing Engagement Service with ACTIVE user token...");
  console.log("Target:", url);
  // console.log("Token:", token);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ type: "LIKE" })
    });

    console.log(`Response Status: ${res.status} ${res.statusText}`);
    
    // We expect 200/201 (Success) OR 404 (Video not found)
    // We do NOT want 401 (Unauthorized) or 403 (Forbidden) or 500
    
    if (res.status === 404) {
        // Video not found is good - it means Auth passed!
        console.log("✅ Auth Successful! (Service returns 404 because video doesn't exist, which is expected)");
        const data = await res.json();
        console.log("Data:", data);
    } else if (res.ok) {
        console.log("✅ Success! Reaction toggled.");
    } else {
        console.error("❌ Failed:", await res.text());
        process.exit(1);
    }

  } catch (error) {
    console.error("❌ Network Error:", error);
    process.exit(1);
  }
}

verifyFix();
