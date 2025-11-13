#!/bin/bash

# Quick fix script - Update Supabase Auth redirect URL via API

PROJECT_REF="riizybdrtikrcnrztcme"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpaXp5YmRydGlrcmNucnp0Y21lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjkzNjEzNCwiZXhwIjoyMDc4NTEyMTM0fQ.vfzCvU-qH_kSwz4SolIzBPlXSMeOVHbzCLY4vZpKkC0"

# Update auth config
curl -X PATCH \
  "https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "SITE_URL": "https://elite-j55i24glt-adiljibranes-projects.vercel.app",
    "REDIRECT_URLS": ["https://elite-j55i24glt-adiljibranes-projects.vercel.app/**"]
  }'

echo ""
echo "✅ Auth redirect URL updated!"
echo "Now request a NEW magic link to login."
