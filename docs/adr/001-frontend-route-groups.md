# ADR 001: Frontend Route Groups vs Single Dashboard Layout

## Status
Accepted

## Context
In Next.js 14 (App Router), we need a dashboard UI for authenticated users. The system has four distinct roles: Superadmin, Admin, Faculty, and Student. Each role has completely different navigation items, permissions, and default pages.

We considered two approaches:
1. **Single Dashboard Layout (`(dashboard)/layout.tsx`)**: A single layout file that reads the user's role from context and conditionally renders the sidebar, navigation, and sub-pages.
2. **Role-based Route Groups (`(superadmin)`, `(admin)`, `(faculty)`, `(student)`)**: Separate route groups, each with their own dedicated layout and nested pages.

## Decision
We will use **Role-based Route Groups** (`(superadmin)`, `(admin)`, `(faculty)`, `(student)`). 

## Rationale
- **Separation of Concerns**: A single layout would become a monolith full of `if (role === 'admin')` statements, making it hard to maintain. Route groups allow us to isolate the UI and logic for each role.
- **Code Splitting**: Next.js can better optimize bundles when routes are cleanly separated.
- **Security & Middleware**: It is easier to write middleware rules that match specific URL paths (e.g., `/superadmin/*` requires Superadmin role) than to manually enforce it inside every page component under a generic `/dashboard` route.

## Consequences
- We need to create four separate layouts and page structures.
- URLs will have the role embedded (e.g., `/superadmin/dashboard` instead of `/dashboard`), which is an acceptable and explicit URL design for this system.
