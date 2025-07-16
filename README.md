# ZenFast

A simple, privacy-focused intermittent fasting tracker built as a hobby project.

## Project Status

🚧 **In Development** - Backend API is being implemented. Not yet ready for production use.

## Project Overview

ZenFast helps users track their intermittent fasting windows with a focus on simplicity and privacy. The backend is built on Cloudflare's platform using Workers, D1, and R2 for a serverless, cost-effective solution.

### Current Features
- ✅ Infrastructure provisioned via Terraform
- ✅ TypeScript project setup with Hono framework
- ✅ Local development environment with mock resources
- 🚧 Basic authentication system (JWT + bcrypt)
- 🚧 Database schema for users and fasts
- 📋 API endpoints (planned)

## Quick Start

### Prerequisites
- Node.js 18+
- Terraform
- Cloudflare account
- `.env.terraform` file with Cloudflare credentials

### Backend Development

```bash
# Navigate to backend
cd backend

# Install dependencies
npm install

# Set up environment
cp .env.development.template .env.development
# Add JWT_SECRET to .env.development

# Generate wrangler config
npm run setup

# Initialize local database
npm run db:reset:local

# Start development
npm run dev
```

See [backend/README.md](backend/README.md) for detailed instructions.

## Project Structure

```
zenfast/
├── backend/           # Cloudflare Workers API
├── terraform/         # Infrastructure as Code
├── specs/            # API and infrastructure specifications
├── tasks/            # Development plans and documentation
└── README.md         # This file
```

## Tech Stack

- **Backend**: Cloudflare Workers (TypeScript, Hono)
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare KV (sessions), R2 (files)
- **Infrastructure**: Terraform
- **Authentication**: JWT + bcrypt (temporary, Apple Sign-In planned)

## Project Principles

This project is guided by the following core principles:

- **Simplicity**: Choose boring technology, build for 10 users not 10,000, collect minimal data
- **Cost-Effectiveness**: Target $0-10/month by using free tiers, serverless, and scaling to zero
- **Low Maintenance**: Prefer managed services and serverless to minimize operational burden

## Key Assumptions

These assumptions inform our technical decisions:

- **Scale**: Personal use + friends & family (<10 users initially)
- **Development**: Single developer, part-time maintenance
- **Features**: Core fasting tracking first, fancy features later
- **Clients**: Start with simple clients (Telegram bot, basic web app)
- **Operations**: Must be maintainable in <1 hour/week

## Contributing

This is a personal project, but if you're interested in contributing:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Ensure tests pass and code is formatted
5. Submit a pull request

## License

[License details to be added]

