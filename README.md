# Marketplace Listing Quality Reviewer

## Architecture
This application is built with a React (Vite) frontend, a Node.js/Express backend, and a PostgreSQL database. It evaluates product listings against marketplace policies. 

## Setup Instructions
1. Clone the repository.
2. Navigate to `/backend`, run `npm install`, and configure your `.env` based on `.env.example`.
3. Start the backend with `npm start` (or `npx nodemon server.js` for dev).
4. Navigate to `/frontend`, run `npm install`, and start the dev server with `npm run dev`.

## Completed Scope
* Full-stack application with database persistence for listings and review status.
* Deterministic validation (required fields, lengths, categories, price, duplicates).
* AI Agent workflow identifying policy violations, severity, and providing suggested wording.
* Human-in-the-loop review interface to approve or reject AI suggestions.
* Structured state handling (loading, empty, error states).

## Excluded Scope
* Publishing to a real marketplace.
* Image moderation, payments, and seller verification.
* Advanced user authentication (out of scope for this focused effort).

## Limitations & Known Issues
* During development, the OpenAI API integration was built and tested, but due to credit limitations on the provided API key, the final deployed version utilizes a simulated AI response to demonstrate the data flow and UI state handling without failing on 429 errors.
* Duplicate detection is currently a basic match on `title` and `seller`.

## Deployment Details
* **Frontend:** Hosted on [Insert Vercel/Netlify Link]
* **Backend:** Hosted on [Insert Render/Heroku Link]
* **Database:** Hosted PostgreSQL instance.