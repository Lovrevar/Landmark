# Authentication Guide

This guide explains how to register users and log in to the application using Supabase Auth.

## Overview

The application uses Supabase's built-in authentication system with email/password credentials. After successful authentication, user data is fetched from the `public.users` table based on the `auth_user_id` column.

## Database Schema

The `public.users` table has the following structure:

- `id`: UUID (primary key)
- `auth_user_id`: UUID (references `auth.users.id`)
- `username`: Text
- `email`: Text
- `role`: Text (one of: Director, Accounting, Sales, Supervision, Investment)
- `created_at`: Timestamp

## User Registration

### Step 1: Create Auth User

Use Supabase's signup method to create an authenticated user:

```typescript
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'securepassword123'
})
```

### Step 2: Create User Record

After successful signup, a database trigger automatically creates a corresponding record in the `public.users` table with:

- `auth_user_id` set to the new auth user's ID
- `username` extracted from the email (part before @)
- `email` set to the provided email
- `role` defaults to a specified role (e.g., 'Sales')

The trigger is defined in the migration: `20251020164200_migrate_to_supabase_auth.sql`

## User Login

### Using the Application

The application provides a login form where users enter their email and password:

```typescript
import { supabase } from './lib/supabase'

const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'securepassword123'
})

if (error) {
  console.error('Login failed:', error.message)
} else {
  console.log('Login successful:', data.user)
}
```

### What Happens After Login

1. Supabase validates credentials and creates a session
2. The `AuthContext` automatically detects the sign-in event
3. User data is fetched from `public.users` where `auth_user_id = auth.uid()`
4. The user object with `id`, `username`, `email`, and `role` is stored in context
5. The application updates to show authenticated content

## Using AuthContext

The `AuthContext` provides the following:

```typescript
import { useAuth } from './contexts/AuthContext'

function MyComponent() {
  const { user, isAuthenticated, loading, logout } = useAuth()

  if (loading) {
    return <div>Loading...</div>
  }

  if (!isAuthenticated) {
    return <div>Please log in</div>
  }

  return (
    <div>
      <p>Welcome, {user.username}!</p>
      <p>Email: {user.email}</p>
      <p>Role: {user.role}</p>
      <button onClick={logout}>Logout</button>
    </div>
  )
}
```

## Session Management

The `AuthContext` automatically:

- Loads the session on app initialization
- Listens for auth state changes (login, logout, token refresh)
- Syncs user data with the database
- Handles cleanup on logout

## Logout

To log out a user:

```typescript
const { logout } = useAuth()

await logout()
```

This will:
1. Sign the user out of Supabase Auth
2. Clear local state
3. Redirect to the home page (`/`)

## Row Level Security (RLS)

All tables in the database have RLS policies that check `auth.uid()` to ensure users can only access their authorized data. The policies verify:

- User is authenticated
- User has proper permissions based on their role
- User owns the data they're trying to access (where applicable)

## Testing Authentication

### Test User Creation

You can create a test user via the Supabase Dashboard:

1. Go to Authentication > Users
2. Click "Add user"
3. Enter email and password
4. Verify the corresponding record appears in `public.users`

### Programmatic User Creation

```typescript
const { data: authData, error: authError } = await supabase.auth.signUp({
  email: 'testuser@example.com',
  password: 'TestPassword123!'
})

if (authError) {
  console.error('Signup error:', authError)
} else {
  console.log('User created:', authData.user?.id)
}
```

## Security Best Practices

1. Always use HTTPS in production
2. Use strong passwords (min 8 characters with complexity)
3. Never expose Supabase service role key in client code
4. Verify authentication state before sensitive operations
5. Implement proper RLS policies for all tables
6. Handle auth errors gracefully in the UI

## Troubleshooting

### User exists in auth.users but not in public.users

Check that the database trigger is working correctly:

```sql
SELECT * FROM auth.users WHERE email = 'user@example.com';
SELECT * FROM public.users WHERE email = 'user@example.com';
```

### Cannot fetch user data after login

Verify RLS policies allow the user to read their own data:

```sql
SELECT * FROM public.users WHERE auth_user_id = auth.uid();
```

### Session not persisting

Check that localStorage is enabled and not blocked by browser settings.
