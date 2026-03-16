# Docker Deployment

## Quick Start
```bash
docker-compose up -d
```

## docker-compose.yml
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "5173:5173"
    env_file:
      - .env
    restart: unless-stopped
```

## Dockerfile
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 5173
CMD ["npm", "run", "preview"]
```

## Environment
Copy `.env.example` to `.env` and fill in your credentials before starting.
