# User Service API Documentation

## Base URL
```
http://localhost:4001/api/v1
```

## Rate Limits

| Routes | Limit |
|--------|-------|
| `/users`, `/channels`, `/subscriptions`, `/settings` | 100 req / 15 min |
| `/account`, `/admin` | 20 req / 15 min |

Response when limited:
```json
{
  "success": false,
  "error": { "code": "RATE_LIMITED", "message": "Too many requests" }
}
```

---

## Required Headers

### x-token-id

**Required for**: `DELETE /account/sessions/others`

This header should contain the current session's token ID to prevent revoking it.

```
x-token-id: <refresh-token-id>
```

The token ID is returned when listing sessions:
```json
{
  "data": [
    { "id": "cm5abc123", "current": true, ... }
  ]
}
```

---

## Endpoints

### Users
- `GET /users/me` - Current user profile
- `PATCH /users/me` - Update profile
- `GET /users/username/:username` - Get by username
- `GET /users/:id` - Get by ID

### Channels
- `POST /channels` - Create channel
- `GET /channels/:handle` - Get channel
- `PATCH /channels/:handle` - Update channel

### Subscriptions
- `GET /subscriptions` - List my subscriptions
- `POST /subscriptions/:channelId` - Subscribe
- `DELETE /subscriptions/:channelId` - Unsubscribe
- `GET /subscriptions/:channelId/status` - Check status
- `PATCH /subscriptions/:channelId` - Update notification level

### Account
- `GET /account/sessions` - List sessions
- `DELETE /account/sessions/others` - Revoke other sessions ⚠️ Requires `x-token-id`
- `DELETE /account/sessions/:id` - Revoke session
- `GET /account/connections` - List OAuth connections
- `DELETE /account/connections/:provider` - Unlink OAuth
- `POST /account/restore` - Cancel account deletion
- `DELETE /account` - Request deletion

### Settings
- `GET /settings/notifications` - Get notification settings
- `PATCH /settings/notifications` - Update notification settings

### Admin
- `GET /admin/users` - List users
- `PATCH /admin/users/:id/status` - Update user status
- `PATCH /admin/channels/:id/verify` - Verify channel
