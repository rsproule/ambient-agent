# Operation Whiskers

An AI agent that responds to iMessage conversations via LoopMessage API.

## Local Development Setup

### Prerequisites

- Node.js 20+ and pnpm
- PostgreSQL database (with pgvector extension)
- LoopMessage account (sandbox mode for local dev)
- Trigger.dev account

### Quick Start

1. **Clone and install dependencies:**
   ```bash
   pnpm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Fill in the required variables in `.env`:
   - `DATABASE_URL` - Your PostgreSQL connection string
   - `TRIGGER_SECRET_KEY` - From your Trigger.dev dashboard
   - `LOOP_AUTH_KEY`, `LOOP_SECRET_KEY`, `LOOP_SENDER_NAME`, `LOOP_WEBHOOK_SECRET_KEY` - From LoopMessage dashboard
   - `NEXTAUTH_SECRET` - Generate with: `openssl rand -base64 32`
   - `ECHO_API_KEY` or `ANTHROPIC_API_KEY` - For AI model access
   - `OPENAI_API_KEY` - Required for embeddings

3. **Set up database:**
   ```bash
   pnpm prisma migrate dev
   pnpm prisma generate
   ```

4. **Configure LoopMessage for local development:**
   
   **Important:** Use LoopMessage's sandbox mode for local development. This allows you to:
   - Receive webhooks locally without needing a full phone number
   - Test message flows without real iMessage delivery
   
   In your LoopMessage dashboard:
   - Enable sandbox mode
   - Configure webhook URL to point to your local server (use ngrok or similar for HTTPS)
   - Add test contacts/phone numbers in sandbox mode

5. **Run the development server:**
   ```bash
   pnpm dev
   ```

6. **Set up Trigger.dev (in a separate terminal):**
   ```bash
   npx trigger.dev@latest dev
   ```

### Optional: OAuth Integrations

To enable Gmail, Calendar, or GitHub integrations:
- Set up a Pipedream Connect project
- Add `PIPEDREAM_CLIENT_ID`, `PIPEDREAM_CLIENT_SECRET`, and `PIPEDREAM_PROJECT_ID` to `.env`
- Set `PIPEDREAM_PROJECT_ENVIRONMENT="development"` for local testing

### Environment Variables

See `.env.example` for all available configuration options.

### Notes

- The LoopMessage integration is the most complex part to run locally. Use sandbox mode to avoid needing a full phone number setup.
- Webhooks require HTTPS. Use ngrok or similar for local development: `ngrok http 3000`
- Trigger.dev runs separately and handles background job processing.
