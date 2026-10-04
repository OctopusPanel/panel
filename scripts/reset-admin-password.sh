#!/usr/bin/env bash
# ==============================================================================
#  🐙 OctopusPanel Admin Password Reset Utility
# ==============================================================================
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PANEL_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [ "$#" -lt 1 ]; then
    echo "Usage: $0 <new_password> [email_or_username]"
    echo "   or: $0 <email_or_username> <new_password>"
    echo ""
    echo "Examples:"
    echo "  $0 MySecurePassword123!"
    echo "  $0 admin@lambdalounge.cc MySecurePassword123!"
    exit 1
fi

ARG1="$1"
ARG2="${2:-}"

cd "${PANEL_DIR}"

if [ -n "$ARG2" ]; then
    pnpm run reset-admin "${ARG1}" "${ARG2}"
else
    # Single argument passed: treated as new password for admin
    pnpm run reset-admin "admin" "${ARG1}"
fi
