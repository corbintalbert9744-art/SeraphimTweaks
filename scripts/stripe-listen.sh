#!/usr/bin/env bash
set -euo pipefail
cd /workspace
set -a
# shellcheck disable=SC1091
source .env
set +a
exec stripe listen \
  --forward-to http://127.0.0.1:5000/api/stripe/webhook \
  --events checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.payment_failed \
  --api-key "$STRIPE_SECRET_KEY"
