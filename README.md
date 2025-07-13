# ZenFast

A simple, privacy-focused intermittent fasting tracker built as a hobby project.

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


## Structure

```
zenfast/
├── backend/          # Backend API (Go or TypeScript)
├── specs/            # API and infrastructure specifications
│   ├── api.md        # REST API specification
│   ├── infra-cloudflare.md  # Cloudflare stack details
│   └── infra-gcp.md  # Google Cloud stack details
├── docs.local/       # Research and documentation
└── README.md
```
