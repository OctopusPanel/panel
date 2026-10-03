#!/usr/bin/env bash
# ==============================================================================
#  Tests for OctopusPanel Installation Script (install.sh)
# ==============================================================================

set -eo pipefail
export LC_ALL=C.UTF-8

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALLER="${SCRIPT_DIR}/../install.sh"
WRAPPER="${SCRIPT_DIR}/../scripts/install.sh"
PASS=0
FAIL=0

assert_eq() {
    local expected="$1"
    local actual="$2"
    local test_name="$3"
    if [ "$expected" = "$actual" ]; then
        printf "  \033[32m✔\033[0m %s\n" "$test_name"
        PASS=$((PASS + 1))
    else
        printf "  \033[31m✖\033[0m %s (Expected: '%s', Got: '%s')\n" "$test_name" "$expected" "$actual"
        FAIL=$((FAIL + 1))
    fi
}

assert_contains() {
    local needle="$1"
    local haystack="$2"
    local test_name="$3"
    if [[ "$haystack" == *"$needle"* ]]; then
        printf "  \033[32m✔\033[0m %s\n" "$test_name"
        PASS=$((PASS + 1))
    else
        printf "  \033[31m✖\033[0m %s (Did not contain '%s')\n" "$test_name" "$needle"
        FAIL=$((FAIL + 1))
    fi
}

echo "Running OctopusPanel Installer Test Suite..."

# ------------------------------------------------------------------------------
# Test 1: Bash syntax validation
# ------------------------------------------------------------------------------
if bash -n "$INSTALLER"; then
    printf "  \033[32m✔\033[0m Syntax validation: install.sh (bash -n)\n"
    PASS=$((PASS + 1))
else
    printf "  \033[31m✖\033[0m Syntax validation failed on install.sh\n"
    FAIL=$((FAIL + 1))
fi

if bash -n "$WRAPPER"; then
    printf "  \033[32m✔\033[0m Syntax validation: scripts/install.sh (bash -n)\n"
    PASS=$((PASS + 1))
else
    printf "  \033[31m✖\033[0m Syntax validation failed on scripts/install.sh\n"
    FAIL=$((FAIL + 1))
fi

# ------------------------------------------------------------------------------
# Test 2: Help flag output & documentation
# ------------------------------------------------------------------------------
HELP_OUTPUT="$("$INSTALLER" --help 2>&1 || true)"
assert_contains "O C T O P U S   P A N E L   I N S T A L L E R" "$HELP_OUTPUT" "Help renders ASCII header"
assert_contains "--domain" "$HELP_OUTPUT" "Help documents --domain"
assert_contains "--admin-email" "$HELP_OUTPUT" "Help documents --admin-email"
assert_contains "--admin-username" "$HELP_OUTPUT" "Help documents --admin-username"
assert_contains "--admin-password" "$HELP_OUTPUT" "Help documents --admin-password"
assert_contains "--db-url" "$HELP_OUTPUT" "Help documents --db-url"
assert_contains "--install-postgres" "$HELP_OUTPUT" "Help documents --install-postgres"
assert_contains "--port" "$HELP_OUTPUT" "Help documents --port"
assert_contains "--unattended" "$HELP_OUTPUT" "Help documents --unattended"
assert_contains "--skip-caddy" "$HELP_OUTPUT" "Help documents --skip-caddy"

# ------------------------------------------------------------------------------
# Test 3: Wrapper script delegation
# ------------------------------------------------------------------------------
WRAPPER_OUTPUT="$("$WRAPPER" --help 2>&1 || true)"
assert_contains "O C T O P U S   P A N E L   I N S T A L L E R" "$WRAPPER_OUTPUT" "Wrapper script scripts/install.sh delegates properly"

# ------------------------------------------------------------------------------
# Test 4: Root privilege rejection and error box
# ------------------------------------------------------------------------------
RUN_OUTPUT="$("$INSTALLER" 2>&1 || true)"
assert_contains "INSTALLATION FAILED AT STEP [1/7]" "$RUN_OUTPUT" "Error box displayed on unprivileged run"
assert_contains "Root privileges required" "$RUN_OUTPUT" "Error reason mentions root privileges"

# ------------------------------------------------------------------------------
# Test 5: CLI argument parsing
# ------------------------------------------------------------------------------
PARSE_TEST_OUTPUT="$(bash -c "
    source <(sed -e '/main \"\$@\"/d' -e '/trap cleanup_terminal/d' '$INSTALLER')
    parse_args --domain 'panel.custom.io' \
               --admin-email 'root@custom.io' \
               --admin-username 'superadmin' \
               --admin-password 'SecretPass999!' \
               --db-url 'postgres://usr:pwd@db.custom.io:5432/octodb' \
               --port 3333 \
               --unattended \
               --skip-caddy \
               --skip-systemd
    echo \"DOM:\$PANEL_DOMAIN|EML:\$ADMIN_EMAIL|USR:\$ADMIN_USERNAME|PWD:\$ADMIN_PASSWORD|DB:\$DATABASE_URL|PORT:\$PANEL_PORT|UNAT:\$UNATTENDED|CAD:\$SKIP_CADDY|SYS:\$SKIP_SYSTEMD|EXT:\$IS_EXTERNAL_DB\"
")"
EXPECTED_PARSE="DOM:panel.custom.io|EML:root@custom.io|USR:superadmin|PWD:SecretPass999!|DB:postgres://usr:pwd@db.custom.io:5432/octodb|PORT:3333|UNAT:true|CAD:true|SYS:true|EXT:true"
assert_eq "$EXPECTED_PARSE" "$PARSE_TEST_OUTPUT" "CLI argument parsing sets all variables properly"

# ------------------------------------------------------------------------------
# Test 6: Unattended mode defaults and password generation
# ------------------------------------------------------------------------------
UNATTENDED_TEST_OUTPUT="$(bash -c "
    source <(sed -e '/main \"\$@\"/d' -e '/trap cleanup_terminal/d' '$INSTALLER')
    UNATTENDED=true
    prompt_interactive_config
    if [ -n \"\$ADMIN_PASSWORD\" ] && [ \"\${#ADMIN_PASSWORD}\" -eq 24 ]; then
        PASS_VALID=\"yes\"
    else
        PASS_VALID=\"no\"
    fi
    echo \"DOM:\$PANEL_DOMAIN|EML:\$ADMIN_EMAIL|USR:\$ADMIN_USERNAME|PASSLEN:\$PASS_VALID|PG:\$INSTALL_POSTGRES\"
")"
EXPECTED_UNATTENDED="DOM:127.0.0.1|EML:admin@127.0.0.1|USR:admin|PASSLEN:yes|PG:true"
assert_eq "$EXPECTED_UNATTENDED" "$UNATTENDED_TEST_OUTPUT" "Unattended wizard provides expected defaults"

# ------------------------------------------------------------------------------
# Test 7: Production .env generation
# ------------------------------------------------------------------------------
TMP_APP_DIR="$(mktemp -d /tmp/panel-test-app.XXXXXX)"
TMP_SRC_DIR="$(mktemp -d /tmp/panel-test-src.XXXXXX)"
echo '{"name": "octopuspanel-monorepo"}' > "${TMP_SRC_DIR}/package.json"

bash -c "
    source <(sed -e '/main \"\$@\"/d' -e '/trap cleanup_terminal/d' '$INSTALLER')
    DEFAULT_INSTALL_DIR='${TMP_APP_DIR}'
    DEFAULT_CONFIG_DIR='${TMP_APP_DIR}/config'
    DEFAULT_LOG_DIR='${TMP_APP_DIR}/log'
    LOG_DIR='${TMP_APP_DIR}/log'
    LOG_FILE='${TMP_APP_DIR}/log/install.log'
    PANEL_PORT=3000
    PANEL_DOMAIN='panel.myhoster.com'
    DATABASE_URL='postgres://octopus_user:secpass@127.0.0.1:5432/octopus_panel'
    ADMIN_EMAIL='admin@myhoster.com'
    ADMIN_USERNAME='admin'
    ADMIN_PASSWORD='GeneratedPassword123!'
    LOCAL_SOURCE='${TMP_SRC_DIR}'
    deploy_panel_files >/dev/null 2>&1
"

if [ -f "${TMP_APP_DIR}/.env" ]; then
    ENV_CONTENT="$(cat "${TMP_APP_DIR}/.env")"
    assert_contains "PORT=3000" "$ENV_CONTENT" ".env contains correct PORT"
    assert_contains "HOST=127.0.0.1" "$ENV_CONTENT" ".env contains 127.0.0.1 HOST"
    assert_contains "NODE_ENV=production" "$ENV_CONTENT" ".env contains production NODE_ENV"
    assert_contains "PANEL_URL=https://panel.myhoster.com" "$ENV_CONTENT" ".env contains configured PANEL_URL"
    assert_contains "DATABASE_URL=postgres://octopus_user:secpass@127.0.0.1:5432/octopus_panel" "$ENV_CONTENT" ".env contains DATABASE_URL"
    assert_contains "ADMIN_EMAIL=admin@myhoster.com" "$ENV_CONTENT" ".env contains ADMIN_EMAIL"
    assert_contains "ADMIN_USERNAME=admin" "$ENV_CONTENT" ".env contains ADMIN_USERNAME"
    assert_contains "ADMIN_PASSWORD=GeneratedPassword123!" "$ENV_CONTENT" ".env contains ADMIN_PASSWORD"
    rm -rf "$TMP_APP_DIR" "$TMP_SRC_DIR"
else
    printf "  \033[31m✖\033[0m .env file was not generated\n"
    FAIL=$((FAIL + 1))
fi

# ------------------------------------------------------------------------------
# Test 8: Caddyfile reverse proxy template generation
# ------------------------------------------------------------------------------
TMP_CADDY_DIR="$(mktemp -d /tmp/panel-test-caddy.XXXXXX)"
TMP_CADDYFILE="${TMP_CADDY_DIR}/Caddyfile"

bash -c "
    source <(sed -e '/main \"\$@\"/d' -e '/trap cleanup_terminal/d' '$INSTALLER')
    LOG_DIR='${TMP_CADDY_DIR}'
    LOG_FILE='${TMP_CADDY_DIR}/install.log'
    CADDYFILE_PATH='${TMP_CADDYFILE}'
    PANEL_DOMAIN='panel.cloudcorp.net'
    PANEL_PORT=3000
    SKIP_CADDY=false
    systemctl() { return 0; }
    configure_caddy >/dev/null 2>&1
"

if [ -f "$TMP_CADDYFILE" ]; then
    CADDY_CONTENT="$(cat "$TMP_CADDYFILE")"
    assert_contains "panel.cloudcorp.net {" "$CADDY_CONTENT" "Caddyfile blocks with configured domain"
    assert_contains "reverse_proxy 127.0.0.1:3000" "$CADDY_CONTENT" "Caddyfile proxies to 127.0.0.1:3000"
    assert_contains "encode zstd gzip" "$CADDY_CONTENT" "Caddyfile enables gzip/zstd compression"
    assert_contains "output file /var/log/caddy/octopus-access.log" "$CADDY_CONTENT" "Caddyfile sets up access logging"
    rm -rf "$TMP_CADDY_DIR"
else
    printf "  \033[31m✖\033[0m Caddyfile was not generated\n"
    FAIL=$((FAIL + 1))
fi

# ------------------------------------------------------------------------------
# Test 9: Systemd service unit template generation
# ------------------------------------------------------------------------------
TMP_SYS_DIR="$(mktemp -d /tmp/panel-test-systemd.XXXXXX)"
TMP_SERVICE="${TMP_SYS_DIR}/octopus-panel.service"

bash -c "
    source <(sed -e '/main \"\$@\"/d' -e '/trap cleanup_terminal/d' '$INSTALLER')
    LOG_DIR='${TMP_SYS_DIR}'
    LOG_FILE='${TMP_SYS_DIR}/install.log'
    SYSTEMD_SERVICE_FILE='${TMP_SERVICE}'
    DEFAULT_INSTALL_DIR='/var/www/octopus/panel'
    SKIP_SYSTEMD=false
    command() {
        if [ \"\$1\" = \"-v\" ] && [ \"\$2\" = \"pnpm\" ]; then
            echo \"/usr/bin/pnpm\"
            return 0
        fi
        return 1
    }
    systemctl() { return 0; }
    setup_systemd_service >/dev/null 2>&1
"

if [ -f "$TMP_SERVICE" ]; then
    SYS_CONTENT="$(cat "$TMP_SERVICE")"
    assert_contains "Description=OctopusPanel Master Control Plane" "$SYS_CONTENT" "Service unit description set"
    assert_contains "ExecStart=/usr/bin/pnpm run start" "$SYS_CONTENT" "Service unit ExecStart points to pnpm run start"
    assert_contains "WorkingDirectory=/var/www/octopus/panel" "$SYS_CONTENT" "Service unit WorkingDirectory set"
    assert_contains "EnvironmentFile=/var/www/octopus/panel/.env" "$SYS_CONTENT" "Service unit EnvironmentFile set"
    assert_contains "LimitNOFILE=65535" "$SYS_CONTENT" "Service unit LimitNOFILE=65535 set"
    rm -rf "$TMP_SYS_DIR"
else
    printf "  \033[31m✖\033[0m Systemd service unit file was not generated\n"
    FAIL=$((FAIL + 1))
fi

# ------------------------------------------------------------------------------
# Test 10: Helper functions (password generation & error box)
# ------------------------------------------------------------------------------
PASS_TEST="$(bash -c "
    source <(sed -e '/main \"\$@\"/d' -e '/trap cleanup_terminal/d' '$INSTALLER')
    P1=\"\$(generate_random_password 24)\"
    P2=\"\$(generate_db_password 32)\"
    echo \"\${#P1}|\${#P2}\"
")"
assert_eq "24|32" "$PASS_TEST" "Password generators produce correct lengths"

ERR_BOX_OUTPUT="$(bash -c "
    source <(sed -e '/main \"\$@\"/d' -e '/trap cleanup_terminal/d' '$INSTALLER')
    LOG_FILE='/dev/null'
    show_error_box '[6/7]' 'Caddy failed to bind' 'Port 80 occupied'
")"
assert_contains "INSTALLATION FAILED AT STEP [6/7]" "$ERR_BOX_OUTPUT" "Error box renders stage correctly"
assert_contains "Reason:  Caddy failed to bind" "$ERR_BOX_OUTPUT" "Error box renders reason"
assert_contains "Details: Port 80 occupied" "$ERR_BOX_OUTPUT" "Error box renders details"

# ------------------------------------------------------------------------------
# Summary
# ------------------------------------------------------------------------------
echo ""
echo "Test Results: ${PASS} Passed, ${FAIL} Failed."
if [ "$FAIL" -gt 0 ]; then
    exit 1
fi
exit 0
