# ZenFast API Specification

## Overview

The ZenFast API provides endpoints for managing intermittent fasting sessions. Users can start, end, and track their fasting periods with the ability to make retroactive adjustments.

## Base URL

```
https://<domain>/api/v1
```

For local development:
```
http://localhost:8080/api/v1
```

## Authentication

The API uses JWT (JSON Web Token) authentication. Include the token in the Authorization header for all protected endpoints:

```
Authorization: Bearer <your-jwt-token>
```

Tokens are obtained through the `/auth/register` or `/auth/login` endpoints.

## Response Format

All responses follow a consistent JSON structure:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

### Error Response
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `UNAUTHORIZED` | Missing or invalid authentication token |
| `FORBIDDEN` | User doesn't have permission to access resource |
| `NOT_FOUND` | Resource not found |
| `VALIDATION_ERROR` | Request validation failed |
| `CONFLICT` | Resource conflict (e.g., email already exists, multiple fasts per day) |
| `INTERNAL_ERROR` | Server error |

## Endpoints

### Authentication

#### Register User

Creates a new user account.

```
POST /api/v1/auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "name": "John Doe",
      "created_at": "2024-01-15T08:00:00Z"
    }
  },
  "error": null
}
```

**Status Codes:**
- `201` - User created successfully
- `400` - Validation error
- `409` - Email already exists

#### Login

Authenticates a user and returns a JWT token.

```
POST /api/v1/auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "name": "John Doe",
      "created_at": "2024-01-15T08:00:00Z"
    }
  },
  "error": null
}
```

**Status Codes:**
- `200` - Login successful
- `401` - Invalid credentials

### Fasting Management

All fasting endpoints require authentication.

#### Start a Fast

Creates a new fasting session.

```
POST /api/v1/fasts
```

**Request Body:**
```json
{
  "started_at": "2024-01-15T08:00:00Z"  // Optional, defaults to current time
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "started_at": "2024-01-15T08:00:00Z",
    "ended_at": null,
    "duration_hours": null,
    "created_at": "2024-01-15T08:00:00Z",
    "updated_at": "2024-01-15T08:00:00Z"
  },
  "error": null
}
```

**Status Codes:**
- `201` - Fast created
- `400` - Validation error (e.g., started_at in future, multiple fasts starting on same day)
- `409` - User already has an active fast (must end previous fast before starting new one)

#### List Fasts

Retrieves a paginated list of user's fasting sessions.

```
GET /api/v1/fasts?limit=20&offset=0&from=2024-01-01&to=2024-01-31
```

**Query Parameters:**
- `limit` (optional, default: 20, max: 100) - Number of results per page
- `offset` (optional, default: 0) - Number of results to skip
- `from` (optional) - Filter fasts starting from this date (ISO 8601)
- `to` (optional) - Filter fasts ending before this date (ISO 8601)

**Response:**
```json
{
  "success": true,
  "data": {
    "fasts": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "user_id": "123e4567-e89b-12d3-a456-426614174000",
        "started_at": "2024-01-15T08:00:00Z",
        "ended_at": "2024-01-15T20:00:00Z",
        "duration_hours": 12.0,
        "created_at": "2024-01-15T08:00:00Z",
        "updated_at": "2024-01-15T20:00:00Z"
      }
    ],
    "pagination": {
      "limit": 20,
      "offset": 0,
      "total": 45
    }
  },
  "error": null
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid query parameters

#### Get Current Fast

Retrieves the user's currently active fast (if any).

```
GET /api/v1/fasts/current
```

**Response (Active Fast):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "started_at": "2024-01-15T08:00:00Z",
    "ended_at": null,
    "duration_hours": null,
    "created_at": "2024-01-15T08:00:00Z",
    "updated_at": "2024-01-15T08:00:00Z"
  },
  "error": null
}
```

**Response (No Active Fast):**
```json
{
  "success": true,
  "data": null,
  "error": null
}
```

**Status Codes:**
- `200` - Success

#### Get Fast by ID

Retrieves a specific fasting session.

```
GET /api/v1/fasts/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "started_at": "2024-01-15T08:00:00Z",
    "ended_at": "2024-01-15T20:00:00Z",
    "duration_hours": 12.0,
    "created_at": "2024-01-15T08:00:00Z",
    "updated_at": "2024-01-15T20:00:00Z"
  },
  "error": null
}
```

**Status Codes:**
- `200` - Success
- `404` - Fast not found or doesn't belong to user

#### Update Fast

Updates a fasting session (e.g., end it or modify times retroactively).

```
PATCH /api/v1/fasts/:id
```

**Request Body:**
```json
{
  "started_at": "2024-01-15T07:30:00Z",  // Optional
  "ended_at": "2024-01-15T19:30:00Z"     // Optional, null to reopen
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "started_at": "2024-01-15T07:30:00Z",
    "ended_at": "2024-01-15T19:30:00Z",
    "duration_hours": 12.0,
    "created_at": "2024-01-15T08:00:00Z",
    "updated_at": "2024-01-15T21:00:00Z"
  },
  "error": null
}
```

**Status Codes:**
- `200` - Fast updated
- `400` - Validation error (e.g., ended_at before started_at, multiple fasts ending on same day)
- `404` - Fast not found or doesn't belong to user

#### Delete Fast

Deletes a fasting session.

```
DELETE /api/v1/fasts/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Fast deleted successfully"
  },
  "error": null
}
```

**Status Codes:**
- `200` - Fast deleted
- `404` - Fast not found or doesn't belong to user

## Validation Rules

### Fasting Constraints

1. **One fast start per day**: Only one fast can be started during any single calendar day (based on user's timezone or UTC).
2. **One fast end per day**: Only one fast can end during any single calendar day.
3. **Sequential fasts**: A new fast cannot be started until the previous fast has been ended. Attempting to start a new fast while one is active will result in a validation error.

## Data Models

### User
```json
{
  "id": "string (UUID)",
  "email": "string",
  "name": "string",
  "created_at": "string (ISO 8601)"
}
```

### Fast
```json
{
  "id": "string (UUID)",
  "user_id": "string (UUID)",
  "started_at": "string (ISO 8601)",
  "ended_at": "string (ISO 8601) | null",
  "duration_hours": "number | null",
  "created_at": "string (ISO 8601)",
  "updated_at": "string (ISO 8601)"
}
```

## Examples

### Complete User Flow

1. **Register a new user:**
```bash
curl -X POST https://<domain>/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword123",
    "name": "John Doe"
  }'
```

2. **Start a fast:**
```bash
curl -X POST https://<domain>/api/v1/fasts \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

3. **Check current fast:**
```bash
curl -X GET https://<domain>/api/v1/fasts/current \
  -H "Authorization: Bearer <token>"
```

4. **End the fast:**
```bash
curl -X PATCH https://<domain>/api/v1/fasts/<fast-id> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "ended_at": "2024-01-15T20:00:00Z"
  }'
```

5. **View fasting history:**
```bash
curl -X GET https://<domain>/api/v1/fasts?limit=10 \
  -H "Authorization: Bearer <token>"
```

## Versioning

The API version is included in the URL path (e.g., `/v1/`). Breaking changes will result in a new version.

## HTTP Status Codes

| Status Code | Description |
|-------------|-------------|
| 200 | OK - Request succeeded |
| 201 | Created - Resource created |
| 400 | Bad Request - Invalid request data |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Access denied |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Resource conflict |
