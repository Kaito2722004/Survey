# Survey Form

A web application for creating surveys, managing questions, and collecting responses from students. Administrators can manage semesters, teachers, students, surveys, and response data from a role-based dashboard.

## Features

- Email/password authentication with Supabase
- Separate administrator and student experiences
- Create, edit, publish, and delete surveys
- Add and reorder survey questions
- Collect and review survey responses
- Manage semesters, students, and teachers
- Responsive interface built with React and Tailwind CSS

## Tech stack

- React 18
- TypeScript
- Vite
- React Router
- Tailwind CSS
- shadcn/ui and Radix UI
- Supabase Authentication and Database
- Vitest

## Getting started

### Prerequisites

- Node.js 18 or newer
- npm
- A Supabase project

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/Kaito2722004/Survey.git
   cd survey-form
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the project root:

   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your_supabase_publishable_key
   ```

   Do not commit `.env` or any private credentials to GitHub.

4. Start the development server:

   ```bash
   npm run dev
   ```

   Open the local URL shown in the terminal, usually `http://localhost:5173`.

## Available scripts

```bash
npm run dev       # Start the development server
npm run build     # Create a production build
npm run preview   # Preview the production build locally
npm run lint      # Run ESLint
npm test          # Run the test suite
```

## Supabase setup

The database migration files are in [`supabase/migrations`](./supabase/migrations). Apply the migration to your Supabase project, then add the project URL and publishable key to `.env`.

The application uses Supabase for authentication and survey data. Configure the required authentication settings and database policies in the Supabase dashboard before deploying.

## Project structure

```text
src/
├── components/       Reusable UI and survey components
├── contexts/         Authentication and survey state
├── integrations/     Supabase client and generated types
├── pages/             Admin, student, login, and signup pages
├── services/          Database service functions
└── types/             Shared TypeScript types
supabase/
└── migrations/        Database schema migrations
public/                 Static assets
```

## Deployment

Build the application with:

```bash
npm run build
```

The generated files are placed in `dist/` and can be deployed to Vercel, Netlify, GitHub Pages, or another static hosting provider. Add the same Supabase environment variables to the hosting provider's environment settings.

## Contributing

1. Create a feature branch.
2. Make your changes.
3. Run `npm run lint`, `npm test`, and `npm run build`.
4. Open a pull request with a clear description of the changes.

## License

This project is released under the [MIT License](./LICENSE).
