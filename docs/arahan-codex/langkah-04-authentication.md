# Langkah 04: Authentication

## Status

Phase 4 implements register/login, password hashing, JWT authentication, role permission helpers, and protected frontend route basics.

## Added Backend

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `GET /api/v1/auth/admin-check`
- Password hashing with Passlib bcrypt.
- JWT creation and validation.
- `get_current_user` dependency.
- `require_admin` dependency.

## Added Frontend

- Login/register screen.
- Token storage for browser session continuation.
- Session check using `/auth/me`.
- Protected route wrapper.
- Logout button.

## Security Notes

- `JWT_SECRET_KEY` must be changed in `.env` and Render environment variables.
- Passwords are never stored as plain text.
- Backend enforces admin permission through `require_admin`.

## Not Implemented Yet

- CRUD modules.
- Crop monitoring screens.
- Rule-based recommendation endpoint.
- Market price module.
- Dashboard and charts.