#!/usr/bin/env bash
# ==============================================================================
#  🐙 OctopusPanel Installer - Master Control Plane for Cloud & Game Infrastructure
#  Specification: Concept/PANEL_INSTALLER.md
# ==============================================================================

set -eo pipefail
export LC_ALL=C.UTF-8

# ------------------------------------------------------------------------------
# Version & Defaults
# ------------------------------------------------------------------------------
INSTALLER_VERSION="v1.0.0-beta"
DEFAULT_PANEL_PORT=3000
DEFAULT_INSTALL_DIR="/var/www/octopus/panel"
DEFAULT_CONFIG_DIR="/etc/octopus"
DEFAULT_LOG_DIR="/var/log/octopus"
LOG_DIR="${DEFAULT_LOG_DIR}"
LOG_FILE="${LOG_DIR}/panel-install.log"
SYSTEMD_SERVICE_FILE="/etc/systemd/system/octopus-panel.service"
CADDYFILE_PATH="/etc/caddy/Caddyfile"
GITHUB_REPO="OctopusPanel/panel"

# ------------------------------------------------------------------------------
# CLI State & Options
# ------------------------------------------------------------------------------
PANEL_DOMAIN=""
ADMIN_EMAIL=""
ADMIN_USERNAME="admin"
ADMIN_PASSWORD=""
DATABASE_URL=""
INSTALL_POSTGRES=false
PANEL_PORT="${DEFAULT_PANEL_PORT}"
UNATTENDED=false
LOCAL_SOURCE=""
SKIP_CADDY=false
SKIP_SYSTEMD=false
IS_EXTERNAL_DB=false
GENERATED_ADMIN_PASS=false

# Detection State
OS_FAMILY=""
DISTRO_ID=""
DISTRO_NAME=""
PKG_MANAGER=""
ARCH=""

# ------------------------------------------------------------------------------
# Color Palette & Typography
# ------------------------------------------------------------------------------
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
    CLR_RESET=$'\033[0m'
    CLR_BOLD=$'\033[1m'
    CLR_DIM=$'\033[2m'
    CLR_CYAN=$'\033[38;2;0;240;255m'      # #00F0FF / ANSI 14
    CLR_PURPLE=$'\033[38;2;189;147;249m'  # #BD93F9 / ANSI 13
    CLR_GREEN=$'\033[38;2;80;250;123m'    # #50FA7B / ANSI 10
    CLR_YELLOW=$'\033[38;2;241;250;140m'  # #F1FA8C / ANSI 11
    CLR_RED=$'\033[38;2;255;85;85m'       # #FF5555 / ANSI 9
    CLR_GRAY=$'\033[38;2;98;114;164m'     # #6272A4 / ANSI 8
else
    CLR_RESET=""
    CLR_BOLD=""
    CLR_DIM=""
    CLR_CYAN=""
    CLR_PURPLE=""
    CLR_GREEN=""
    CLR_YELLOW=""
    CLR_RED=""
    CLR_GRAY=""
fi

GLYPH_SUCCESS="${CLR_GREEN}✔${CLR_RESET}"
GLYPH_FAIL="${CLR_RED}✖${CLR_RESET}"
GLYPH_INFO="${CLR_CYAN}ℹ${CLR_RESET}"
GLYPH_WARN="${CLR_YELLOW}⚠${CLR_RESET}"
GLYPH_PROMPT="${CLR_PURPLE}➜${CLR_RESET}"

# ------------------------------------------------------------------------------
# Cleanup & Signal Handling
# ------------------------------------------------------------------------------
cleanup_terminal() {
    printf "\033[?25h" 2>/dev/null || true
}
trap cleanup_terminal EXIT INT TERM

# ------------------------------------------------------------------------------
# Visual Formatting Helpers
# ------------------------------------------------------------------------------
pad_box_line() {
    local text="$1"
    local target_len="${2:-60}"
    local char_len="${#text}"
    local pad=$(( target_len - char_len ))
    if [ "$pad" -gt 0 ]; then
        local spaces
        spaces=$(printf "%*s" "$pad" "")
        printf "%s%s" "${text}" "${spaces}"
    else
        printf "%s" "${text:0:$target_len}"
    fi
}

render_header() {
    local version="${1:-$INSTALLER_VERSION}"
    local v_line="      Version: ${version} | Zero-Noise Experience"
    local padded_v
    padded_v="$(pad_box_line "${v_line}" 60)"

    printf "\n"
    printf "    ${CLR_CYAN}╭────────────────────────────────────────────────────────────╮${CLR_RESET}\n"
    printf "    ${CLR_CYAN}│${CLR_PURPLE}  🐙  O C T O P U S   P A N E L   I N S T A L L E R         ${CLR_CYAN}│${CLR_RESET}\n"
    printf "    ${CLR_CYAN}│${CLR_RESET}      Master Control Plane for Cloud & Game Infrastructure  ${CLR_CYAN}│${CLR_RESET}\n"
    printf "    ${CLR_CYAN}│${CLR_GRAY}%s${CLR_CYAN}│${CLR_RESET}\n" "${padded_v}"
    printf "    ${CLR_CYAN}╰────────────────────────────────────────────────────────────╯${CLR_RESET}\n\n"
}

show_error_box() {
    local step="$1"
    local reason="$2"
    local details="${3:-}"

    printf "\n"
    local title_text="  ✖  INSTALLATION FAILED AT STEP ${step}"
    local padded_title
    padded_title="$(pad_box_line "${title_text}" 60)"

    printf "    ${CLR_RED}╭────────────────────────────────────────────────────────────╮${CLR_RESET}\n"
    printf "    ${CLR_RED}│${CLR_BOLD}%s${CLR_RESET}${CLR_RED}│${CLR_RESET}\n" "${padded_title}"
    printf "    ${CLR_RED}╰────────────────────────────────────────────────────────────╯${CLR_RESET}\n\n"

    printf "  ${CLR_BOLD}Reason:${CLR_RESET}  %s\n" "${reason}"
    if [ -n "${details}" ]; then
        printf "  ${CLR_BOLD}Details:${CLR_RESET} %s\n" "${details}"
    fi
    printf "\n"

    printf "  ${CLR_GRAY}┌── Diagnostic Log Snippet (Last 15 lines) ────────────────────┐${CLR_RESET}\n"
    if [ -f "${LOG_FILE}" ]; then
        local log_lines=()
        mapfile -t log_lines < <(tail -n 15 "${LOG_FILE}" 2>/dev/null || true)
        if [ ${#log_lines[@]} -eq 0 ]; then
            printf "  ${CLR_GRAY}│${CLR_RESET} %-60s ${CLR_GRAY}│${CLR_RESET}\n" "(No logs recorded yet)"
        else
            for line in "${log_lines[@]}"; do
                local clean_line
                clean_line=$(echo "${line}" | tr -d '\r' | cut -c 1-60)
                printf "  ${CLR_GRAY}│${CLR_RESET} %-60s ${CLR_GRAY}│${CLR_RESET}\n" "${clean_line}"
            done
        fi
    else
        printf "  ${CLR_GRAY}│${CLR_RESET} %-60s ${CLR_GRAY}│${CLR_RESET}\n" "(Log file not found: ${LOG_FILE})"
    fi
    printf "  ${CLR_GRAY}└──────────────────────────────────────────────────────────────┘${CLR_RESET}\n\n"

    printf "  ${CLR_BOLD}Full installation log available at:${CLR_RESET}\n"
    printf "  %s\n\n" "${LOG_FILE}"
    printf "  ${CLR_YELLOW}Tip:${CLR_RESET} Ensure your domain's DNS A/AAAA record points to this server IP.\n"
    printf "  Need help? Open an issue at ${CLR_CYAN}https://github.com/${GITHUB_REPO}${CLR_RESET}\n\n"
}

show_success_box() {
    printf "\n"
    local title_text="  ✔  OCTOPUS PANEL INSTALLED & RUNNING!"
    local padded_title
    padded_title="$(pad_box_line "${title_text}" 60)"

    local db_display
    if [ "$IS_EXTERNAL_DB" = true ]; then
        db_display="PostgreSQL (External)"
    else
        db_display="PostgreSQL (Local / octopus_panel)"
    fi

    local web_server_display="Caddy (Automatic HTTPS active)"
    if [ "$SKIP_CADDY" = true ]; then
        web_server_display="Skipped (--skip-caddy)"
    fi

    local service_status_display="Active (running)"
    if [ "$SKIP_SYSTEMD" = true ]; then
        service_status_display="Skipped (--skip-systemd)"
    fi

    local panel_url_display
    if [ -n "$PANEL_DOMAIN" ]; then
        if [ "$SKIP_CADDY" = true ]; then
            panel_url_display="http://${PANEL_DOMAIN}:${PANEL_PORT}"
        else
            panel_url_display="https://${PANEL_DOMAIN}"
        fi
    else
        panel_url_display="http://127.0.0.1:${PANEL_PORT}"
    fi

    printf "    ${CLR_GREEN}╭────────────────────────────────────────────────────────────╮${CLR_RESET}\n"
    printf "    ${CLR_GREEN}│${CLR_BOLD}%s${CLR_RESET}${CLR_GREEN}│${CLR_RESET}\n" "${padded_title}"
    printf "    ${CLR_GREEN}╰────────────────────────────────────────────────────────────╯${CLR_RESET}\n\n"

    printf "  • ${CLR_BOLD}Panel URL:${CLR_RESET}         ${CLR_CYAN}%s${CLR_RESET}\n" "${panel_url_display}"
    printf "  • ${CLR_BOLD}Admin Email:${CLR_RESET}       %s\n" "${ADMIN_EMAIL}"
    printf "  • ${CLR_BOLD}Admin Username:${CLR_RESET}    %s\n" "${ADMIN_USERNAME}"
    if [ -n "${ADMIN_PASSWORD}" ]; then
        printf "  • ${CLR_BOLD}Admin Password:${CLR_RESET}    %s\n" "${ADMIN_PASSWORD}"
    fi
    printf "  • ${CLR_BOLD}Web Server:${CLR_RESET}        %s\n" "${web_server_display}"
    printf "  • ${CLR_BOLD}Database:${CLR_RESET}          %s\n" "${db_display}"
    printf "  • ${CLR_BOLD}Service Status:${CLR_RESET}    ${CLR_GREEN}%s${CLR_RESET}\n" "${service_status_display}"
    printf "  • ${CLR_BOLD}Service Logs:${CLR_RESET}      ${CLR_PURPLE}journalctl -u octopus-panel -f${CLR_RESET}\n\n"

    printf "  Next step: Deploy your first host node using the Tentacle installer:\n"
    printf "  ${CLR_CYAN}curl -sSL https://get.octopuspanel.com/tentacle/install.sh | sudo bash${CLR_RESET}\n\n"
}

# ------------------------------------------------------------------------------
# Progress Spinner & Step Execution
# ------------------------------------------------------------------------------
run_step() {
    local step_label="$1"
    shift
    local cmd=("$@")

    # Ensure log directory and file exist
    mkdir -p "${LOG_DIR}" 2>/dev/null || true
    touch "${LOG_FILE}" 2>/dev/null || true
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting: ${step_label}" >> "${LOG_FILE}"

    if [ ! -t 1 ]; then
        # Headless / Non-interactive CI output
        printf "  %s  %s ...\n" "${GLYPH_INFO}" "${step_label}"
        if "${cmd[@]}" >> "${LOG_FILE}" 2>&1; then
            printf "  %s  %s\n" "${GLYPH_SUCCESS}" "${step_label}"
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] Completed: ${step_label}" >> "${LOG_FILE}"
            return 0
        else
            local exit_code=$?
            printf "  %s  %s (failed)\n" "${GLYPH_FAIL}" "${step_label}"
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] Failed (exit code ${exit_code}): ${step_label}" >> "${LOG_FILE}"
            return "${exit_code}"
        fi
    fi

    # Animated interactive spinner
    local spinstr=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
    local delay=0.08
    local pid

    # Run command in background redirected to log
    "${cmd[@]}" >> "${LOG_FILE}" 2>&1 &
    pid=$!

    # Hide cursor
    printf "\033[?25l"

    local i=0
    while kill -0 "${pid}" 2>/dev/null; do
        printf "\r  ${CLR_CYAN}%s${CLR_RESET}  %s" "${spinstr[i]}" "${step_label}"
        i=$(( (i + 1) % ${#spinstr[@]} ))
        sleep "${delay}"
    done

    wait "${pid}"
    local exit_code=$?

    # Restore cursor
    printf "\033[?25h"

    if [ "${exit_code}" -eq 0 ]; then
        printf "\r  %s  %s\033[K\n" "${GLYPH_SUCCESS}" "${step_label}"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Completed: ${step_label}" >> "${LOG_FILE}"
        return 0
    else
        printf "\r  %s  %s\033[K\n" "${GLYPH_FAIL}" "${step_label}"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Failed (exit code ${exit_code}): ${step_label}" >> "${LOG_FILE}"
        return "${exit_code}"
    fi
}

# ------------------------------------------------------------------------------
# Helper Utilities
# ------------------------------------------------------------------------------
generate_random_password() {
    local len="${1:-24}"
    if command -v openssl &>/dev/null; then
        openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c "$len"
    else
        head -c 64 /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c "$len"
    fi
}

generate_db_password() {
    local len="${1:-32}"
    if command -v openssl &>/dev/null; then
        openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c "$len"
    else
        head -c 64 /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c "$len"
    fi
}

is_port_in_use() {
    local port="$1"
    if command -v ss &>/dev/null; then
        ss -tuln | grep -qE "(:|\])${port}\b" && return 0
    elif command -v netstat &>/dev/null; then
        netstat -tuln | grep -qE "(:|\])${port}\b" && return 0
    elif command -v lsof &>/dev/null; then
        lsof -i ":${port}" &>/dev/null && return 0
    fi
    return 1
}

# ------------------------------------------------------------------------------
# CLI Flag Parsing & Help
# ------------------------------------------------------------------------------
show_help() {
    render_header "${INSTALLER_VERSION}"
    printf "Usage: %s [OPTIONS]\n\n" "$0"
    printf "Options:\n"
    printf "  --domain <fqdn>          Fully qualified domain name pointing to this server\n"
    printf "  --admin-email <email>    Initial superadmin email address\n"
    printf "  --admin-username <name>  Initial superadmin username (Default: admin)\n"
    printf "  --admin-password <pass>  Superadmin password (auto-generated if omitted)\n"
    printf "  --db-url <postgres_url>  Optional external PostgreSQL connection string\n"
    printf "  --install-postgres       Automatically install and configure local PostgreSQL\n"
    printf "  --port <port>            Internal backend port (Default: %s)\n" "${DEFAULT_PANEL_PORT}"
    printf "  --unattended, -y         Run non-interactively without user prompts\n"
    printf "  --local-source <path>    Deploy panel from local directory instead of git clone\n"
    printf "  --skip-caddy             Skip Caddy reverse proxy installation\n"
    printf "  --skip-systemd           Skip systemd service creation\n"
    printf "  --help, -h               Show this help message and exit\n\n"
    exit 0
}

parse_args() {
    while [ $# -gt 0 ]; do
        case "$1" in
            --domain)
                PANEL_DOMAIN="$2"
                shift 2
                ;;
            --admin-email)
                ADMIN_EMAIL="$2"
                shift 2
                ;;
            --admin-username)
                ADMIN_USERNAME="$2"
                shift 2
                ;;
            --admin-password)
                ADMIN_PASSWORD="$2"
                shift 2
                ;;
            --db-url)
                DATABASE_URL="$2"
                IS_EXTERNAL_DB=true
                shift 2
                ;;
            --install-postgres)
                INSTALL_POSTGRES=true
                shift
                ;;
            --port)
                PANEL_PORT="$2"
                shift 2
                ;;
            --unattended|-y)
                UNATTENDED=true
                shift
                ;;
            --local-source)
                LOCAL_SOURCE="$2"
                shift 2
                ;;
            --skip-caddy)
                SKIP_CADDY=true
                shift
                ;;
            --skip-systemd)
                SKIP_SYSTEMD=true
                shift
                ;;
            --help|-h)
                show_help
                ;;
            *)
                echo "Unknown option: $1"
                echo "Run '$0 --help' for usage."
                exit 1
                ;;
        esac
    done
}

# ------------------------------------------------------------------------------
# Interactive Configuration Wizard
# ------------------------------------------------------------------------------
prompt_interactive_config() {
    if [ "$UNATTENDED" = true ]; then
        if [ -z "$PANEL_DOMAIN" ]; then
            PANEL_DOMAIN="127.0.0.1"
        fi
        if [ -z "$ADMIN_EMAIL" ]; then
            ADMIN_EMAIL="admin@${PANEL_DOMAIN}"
        fi
        if [ -z "$ADMIN_USERNAME" ]; then
            ADMIN_USERNAME="admin"
        fi
        if [ -z "$ADMIN_PASSWORD" ]; then
            ADMIN_PASSWORD="$(generate_random_password 24)"
            GENERATED_ADMIN_PASS=true
        fi
        if [ -z "$DATABASE_URL" ]; then
            INSTALL_POSTGRES=true
            local gen_db_pass
            gen_db_pass="$(generate_db_password 32)"
            DATABASE_URL="postgres://octopus_user:${gen_db_pass}@127.0.0.1:5432/octopus_panel"
            export DATABASE_URL
        fi
        return 0
    fi

    printf "\n  ${CLR_BOLD}${CLR_CYAN}OctopusPanel Setup Wizard${CLR_RESET}\n"
    printf "  ${CLR_GRAY}Please answer the following prompts to configure your control plane:${CLR_RESET}\n\n"

    # 1. Domain
    if [ -z "$PANEL_DOMAIN" ]; then
        local detected_host=""
        if command -v hostname &>/dev/null; then
            detected_host="$(hostname -f 2>/dev/null || hostname 2>/dev/null || true)"
        fi
        [ -z "$detected_host" ] && detected_host="panel.example.com"

        printf "  %s ${CLR_BOLD}Enter Panel Domain (FQDN)${CLR_RESET} [${CLR_CYAN}%s${CLR_RESET}]: " "${GLYPH_PROMPT}" "${detected_host}"
        local input_domain
        read -r input_domain
        PANEL_DOMAIN="${input_domain:-$detected_host}"
    fi

    # 2. Database choice
    if [ -z "$DATABASE_URL" ] && [ "$INSTALL_POSTGRES" = false ]; then
        printf "\n  %s ${CLR_BOLD}PostgreSQL Database Selection:${CLR_RESET}\n" "${GLYPH_PROMPT}"
        printf "     1) Install and configure local PostgreSQL automatically (${CLR_GREEN}Recommended${CLR_RESET})\n"
        printf "     2) Use an existing external PostgreSQL database\n"
        printf "     Select option [1]: "
        local db_choice
        read -r db_choice
        db_choice="${db_choice:-1}"

        if [ "$db_choice" = "2" ]; then
            IS_EXTERNAL_DB=true
            printf "\n  %s ${CLR_BOLD}Enter PostgreSQL Connection URL${CLR_RESET}\n" "${GLYPH_PROMPT}"
            printf "     (e.g. postgres://user:pass@host:5432/octopus_panel): "
            read -r DATABASE_URL
            while [ -z "$DATABASE_URL" ]; do
                printf "     ${CLR_RED}Database URL cannot be empty:${CLR_RESET} "
                read -r DATABASE_URL
            done
        else
            INSTALL_POSTGRES=true
        fi
    fi

    # Ensure local database connection string is configured in parent shell environment
    if [ "$INSTALL_POSTGRES" = true ] && [ -z "$DATABASE_URL" ]; then
        local existing_db_url=""
        if [ -f "${DEFAULT_INSTALL_DIR}/.env" ]; then
            existing_db_url="$(grep -E '^DATABASE_URL=' "${DEFAULT_INSTALL_DIR}/.env" 2>/dev/null | cut -d= -f2- | tr -d '"'\''')"
        fi
        if [ -n "$existing_db_url" ] && [[ "$existing_db_url" =~ ^postgres(ql)?:// ]]; then
            DATABASE_URL="$existing_db_url"
        else
            local gen_db_pass
            gen_db_pass="$(generate_db_password 32)"
            DATABASE_URL="postgres://octopus_user:${gen_db_pass}@127.0.0.1:5432/octopus_panel"
        fi
        export DATABASE_URL
    fi

    # 3. Admin Account Setup
    printf "\n  ${CLR_BOLD}${CLR_PURPLE}Initial Administrator Account Configuration:${CLR_RESET}\n"

    if [ -z "$ADMIN_EMAIL" ]; then
        local default_email="admin@${PANEL_DOMAIN}"
        printf "  %s ${CLR_BOLD}Admin Email Address${CLR_RESET} [${CLR_CYAN}%s${CLR_RESET}]: " "${GLYPH_PROMPT}" "${default_email}"
        local input_email
        read -r input_email
        ADMIN_EMAIL="${input_email:-$default_email}"
    fi

    if [ -z "$ADMIN_USERNAME" ]; then
        printf "  %s ${CLR_BOLD}Admin Username${CLR_RESET} [${CLR_CYAN}admin${CLR_RESET}]: " "${GLYPH_PROMPT}"
        local input_user
        read -r input_user
        ADMIN_USERNAME="${input_user:-admin}"
    fi

    if [ -z "$ADMIN_PASSWORD" ]; then
        printf "  %s ${CLR_BOLD}Admin Password${CLR_RESET} (leave blank to auto-generate secure password): " "${GLYPH_PROMPT}"
        local input_pass
        read -r -s input_pass
        printf "\n"
        if [ -z "$input_pass" ]; then
            ADMIN_PASSWORD="$(generate_random_password 24)"
            GENERATED_ADMIN_PASS=true
            printf "  %s Auto-generated secure admin password: ${CLR_YELLOW}%s${CLR_RESET}\n" "${GLYPH_INFO}" "${ADMIN_PASSWORD}"
        else
            ADMIN_PASSWORD="$input_pass"
        fi
    fi

    printf "\n"
}

# ==============================================================================
# Pipeline Stages
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Pre-flight & System Check ([1/7])
# ------------------------------------------------------------------------------
stage_preflight() {
    # 1. Root Check
    if [ "$(id -u)" -ne 0 ]; then
        show_error_box "[1/7]" "Root privileges required" "This installer must be run as root (UID 0) or via sudo."
        exit 1
    fi

    # Ensure log directory
    mkdir -p "${LOG_DIR}"
    touch "${LOG_FILE}"
    chmod 0755 "${LOG_DIR}"

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting Pre-flight System Detection" >> "${LOG_FILE}"

    # 2. OS Detection
    if [ ! -f /etc/os-release ]; then
        show_error_box "[1/7]" "Missing /etc/os-release" "Unable to identify Linux distribution. /etc/os-release is required."
        exit 1
    fi

    # shellcheck disable=SC1091
    . /etc/os-release
    DISTRO_ID="${ID:-unknown}"
    local distro_like="${ID_LIKE:-}"
    DISTRO_NAME="${PRETTY_NAME:-$DISTRO_ID}"

    if [[ "$DISTRO_ID" =~ ^(debian|ubuntu|pop|linuxmint|kali|raspbian)$ ]] || [[ "$distro_like" =~ (debian|ubuntu) ]]; then
        OS_FAMILY="debian"
        PKG_MANAGER="apt-get"
    elif [[ "$DISTRO_ID" =~ ^(rhel|centos|rocky|almalinux|fedora|ol|amzn)$ ]] || [[ "$distro_like" =~ (rhel|fedora|centos) ]]; then
        OS_FAMILY="rhel"
        if command -v dnf &>/dev/null; then
            PKG_MANAGER="dnf"
        else
            PKG_MANAGER="yum"
        fi
    else
        show_error_box "[1/7]" "Unsupported Linux distribution" "Detected '${DISTRO_NAME}'. OctopusPanel supports Debian/Ubuntu and RHEL/Rocky/Alma/Fedora."
        exit 1
    fi

    # 3. CPU Architecture Check
    local raw_arch
    raw_arch="$(uname -m)"
    case "$raw_arch" in
        x86_64|amd64)
            ARCH="x86_64"
            ;;
        aarch64|arm64)
            ARCH="aarch64"
            ;;
        *)
            show_error_box "[1/7]" "Unsupported CPU architecture" "Detected '${raw_arch}'. OctopusPanel requires an x86_64 or aarch64 processor."
            exit 1
            ;;
    esac

    # 4. RAM Check
    if [ -f /proc/meminfo ]; then
        local mem_kb
        mem_kb=$(grep MemTotal /proc/meminfo | awk '{print $2}')
        if [ -n "$mem_kb" ] && [ "$mem_kb" -lt 1000000 ]; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] Warning: System RAM is under 1 GB (${mem_kb} kB)" >> "${LOG_FILE}"
            printf "  %s  ${CLR_YELLOW}Warning: System has less than 1 GB RAM. Recommended is at least 2 GB.${CLR_RESET}\n" "${GLYPH_WARN}"
        fi
    fi

    # 5. Disk Space Check
    local free_kb
    free_kb=$(df -k /var 2>/dev/null | tail -1 | awk '{print $4}' || df -k / 2>/dev/null | tail -1 | awk '{print $4}' || echo "")
    if [ -n "$free_kb" ] && [ "$free_kb" -lt 3000000 ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Warning: Free disk space is under 3 GB (${free_kb} kB)" >> "${LOG_FILE}"
        printf "  %s  ${CLR_YELLOW}Warning: Available disk space on /var is low (< 3 GB free).${CLR_RESET}\n" "${GLYPH_WARN}"
    fi

    # 6. Port Check for Caddy
    if [ "$SKIP_CADDY" = false ]; then
        if is_port_in_use 80; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] Warning: Port 80 is currently in use" >> "${LOG_FILE}"
            printf "  %s  ${CLR_YELLOW}Warning: Port 80 appears to be bound by an existing service.${CLR_RESET}\n" "${GLYPH_WARN}"
        fi
        if is_port_in_use 443; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] Warning: Port 443 is currently in use" >> "${LOG_FILE}"
            printf "  %s  ${CLR_YELLOW}Warning: Port 443 appears to be bound by an existing service.${CLR_RESET}\n" "${GLYPH_WARN}"
        fi
    fi

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Pre-flight check successful: ${DISTRO_NAME} (${ARCH})" >> "${LOG_FILE}"
}

# ------------------------------------------------------------------------------
# Stage 2: Node.js LTS & Toolchain Setup ([2/7])
# ------------------------------------------------------------------------------
install_base_tools() {
    if [ "$OS_FAMILY" = "debian" ]; then
        export DEBIAN_FRONTEND=noninteractive
        apt-get update -y
        apt-get install -y curl wget git tar openssl ca-certificates gnupg sudo psmisc
    elif [ "$OS_FAMILY" = "rhel" ]; then
        $PKG_MANAGER install -y curl wget git tar openssl ca-certificates gnupg2 sudo psmisc
    fi
}

setup_nodejs_toolchain() {
    local node_needs_install=true
    if command -v node &>/dev/null; then
        local major_version
        major_version=$(node -v | sed 's/^v//' | cut -d. -f1)
        if [ "$major_version" -ge 20 ]; then
            node_needs_install=false
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] Existing Node.js v$(node -v) satisfies LTS requirement" >> "${LOG_FILE}"
        fi
    fi

    if [ "$node_needs_install" = true ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Installing Node.js LTS v22 from NodeSource" >> "${LOG_FILE}"
        if [ "$OS_FAMILY" = "debian" ]; then
            export DEBIAN_FRONTEND=noninteractive
            curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
            apt-get install -y nodejs
        elif [ "$OS_FAMILY" = "rhel" ]; then
            curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
            $PKG_MANAGER install -y nodejs
        fi
    fi

    # Setup pnpm
    if ! command -v pnpm &>/dev/null; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Enabling pnpm via Corepack" >> "${LOG_FILE}"
        if command -v corepack &>/dev/null; then
            corepack enable || true
            corepack prepare pnpm@latest --activate || npm install -g pnpm
        else
            npm install -g pnpm
        fi
    fi

    # Verify binaries
    command -v node &>/dev/null || { echo "Node.js installation verification failed"; return 1; }
    command -v pnpm &>/dev/null || { echo "pnpm installation verification failed"; return 1; }
}

# ------------------------------------------------------------------------------
# Stage 3: PostgreSQL Database Provisioning ([3/7])
# ------------------------------------------------------------------------------
provision_local_postgres() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Provisioning local PostgreSQL server" >> "${LOG_FILE}"

    if [ "$OS_FAMILY" = "debian" ]; then
        export DEBIAN_FRONTEND=noninteractive
        if ! command -v psql &>/dev/null; then
            apt-get update -y
            apt-get install -y postgresql postgresql-contrib
        fi
        systemctl enable --now postgresql || service postgresql start || true
    elif [ "$OS_FAMILY" = "rhel" ]; then
        if ! command -v psql &>/dev/null; then
            $PKG_MANAGER install -y postgresql-server postgresql-contrib
            if [ -x /usr/bin/postgresql-setup ]; then
                /usr/bin/postgresql-setup --initdb || true
            fi
        fi
        systemctl enable --now postgresql || service postgresql start || true
    fi

    local db_name="octopus_panel"
    local db_user="octopus_user"
    local db_pass=""

    if [[ "$DATABASE_URL" =~ postgres(ql)?://([^:]+):([^@]+)@[^/]+/([^?]+) ]]; then
        db_user="${BASH_REMATCH[2]}"
        db_pass="${BASH_REMATCH[3]}"
        db_name="${BASH_REMATCH[4]}"
    fi

    if [ -z "$db_pass" ]; then
        db_pass="$(generate_db_password 32)"
        DATABASE_URL="postgres://${db_user}:${db_pass}@127.0.0.1:5432/${db_name}"
        export DATABASE_URL
    fi

    # Cache DATABASE_URL to persistent temp file for multi-step subshell reliability
    echo "${DATABASE_URL}" > /tmp/.octopus_panel_db_url 2>/dev/null || true
    chmod 600 /tmp/.octopus_panel_db_url 2>/dev/null || true

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Configuring database '${db_name}' and user '${db_user}'" >> "${LOG_FILE}"

    exec_pg_sql() {
        local sql="$1"
        local db="${2:-postgres}"
        if command -v sudo &>/dev/null; then
            sudo -u postgres psql -d "${db}" -c "${sql}"
        elif command -v runuser &>/dev/null; then
            runuser -u postgres -- psql -d "${db}" -c "${sql}"
        else
            su - postgres -c "psql -d '${db}' -c \"${sql}\""
        fi
    }

    query_pg_sql() {
        local sql="$1"
        local db="${2:-postgres}"
        if command -v sudo &>/dev/null; then
            sudo -u postgres psql -d "${db}" -t -A -c "${sql}"
        elif command -v runuser &>/dev/null; then
            runuser -u postgres -- psql -d "${db}" -t -A -c "${sql}"
        else
            su - postgres -c "psql -d '${db}' -t -A -c \"${sql}\""
        fi
    }

    # Create user if not exists
    if ! query_pg_sql "SELECT 1 FROM pg_roles WHERE rolname = '${db_user}'" | grep -q 1; then
        exec_pg_sql "CREATE USER ${db_user} WITH ENCRYPTED PASSWORD '${db_pass}';"
    fi

    # Always ensure password is synchronized
    exec_pg_sql "ALTER USER ${db_user} WITH ENCRYPTED PASSWORD '${db_pass}';"

    # Create database if not exists
    if ! query_pg_sql "SELECT 1 FROM pg_database WHERE datname = '${db_name}'" | grep -q 1; then
        exec_pg_sql "CREATE DATABASE ${db_name} OWNER ${db_user};"
    fi

    exec_pg_sql "GRANT ALL PRIVILEGES ON DATABASE ${db_name} TO ${db_user};"
    exec_pg_sql "ALTER DATABASE ${db_name} OWNER TO ${db_user};"

    # PostgreSQL 15+ revokes CREATE on schema public by default; explicitly grant to db_user
    exec_pg_sql "GRANT ALL ON SCHEMA public TO ${db_user};" "${db_name}" 2>/dev/null || true
    exec_pg_sql "ALTER SCHEMA public OWNER TO ${db_user};" "${db_name}" 2>/dev/null || true

    # Immediately verify connectivity and authentication via local TCP
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Verifying database authentication for user '${db_user}'" >> "${LOG_FILE}"
    PGPASSWORD="${db_pass}" psql -h 127.0.0.1 -p 5432 -U "${db_user}" -d "${db_name}" -c "SELECT 1;" >> "${LOG_FILE}" 2>&1 || {
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: PostgreSQL authentication failed for user '${db_user}'" >> "${LOG_FILE}"
        return 1
    }

    IS_EXTERNAL_DB=false
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Local PostgreSQL setup complete" >> "${LOG_FILE}"
}

verify_db_connectivity() {
    if [ -n "$DATABASE_URL" ] && [ "$IS_EXTERNAL_DB" = true ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Validating external database connection" >> "${LOG_FILE}"
        if command -v psql &>/dev/null; then
            psql "$DATABASE_URL" -c '\q' || {
                echo "Failed to connect to external PostgreSQL database using provided URL"
                return 1
            }
        fi
    fi
    return 0
}

# ------------------------------------------------------------------------------
# Stage 4: Panel Deployment & DB Migrations ([4/7])
# ------------------------------------------------------------------------------
deploy_panel_files() {
    local target_dir="${DEFAULT_INSTALL_DIR}"
    local script_dir="${INSTALLER_SOURCE_DIR:-}"
    if [ -z "$script_dir" ]; then
        if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
            script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
        else
            script_dir="$(pwd)"
        fi
    fi

    mkdir -p "${target_dir}" "${DEFAULT_CONFIG_DIR}" "${DEFAULT_LOG_DIR}"

    # Ensure DATABASE_URL is available
    if [ -z "$DATABASE_URL" ]; then
        if [ -f /tmp/.octopus_panel_db_url ]; then
            DATABASE_URL="$(cat /tmp/.octopus_panel_db_url 2>/dev/null)"
        elif [ -f "${target_dir}/.env" ]; then
            DATABASE_URL="$(grep -E '^DATABASE_URL=' "${target_dir}/.env" 2>/dev/null | cut -d= -f2- | tr -d '"'\''')"
        fi
        export DATABASE_URL
    fi

    if [ -n "$LOCAL_SOURCE" ] && [ -d "$LOCAL_SOURCE" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Deploying panel from local source: ${LOCAL_SOURCE}" >> "${LOG_FILE}"
        if [ "$(cd "${target_dir}" 2>/dev/null && pwd)" != "$(cd "${LOCAL_SOURCE}" 2>/dev/null && pwd)" ]; then
            tar --exclude='./node_modules' \
                --exclude='./.git' \
                --exclude='./.turbo' \
                --exclude='./dist' \
                -cf - -C "${LOCAL_SOURCE}" . | tar -xf - -C "${target_dir}"
        fi
    elif [ -f "${script_dir}/package.json" ] && grep -q "octopuspanel-monorepo" "${script_dir}/package.json"; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Deploying panel from current working repository: ${script_dir}" >> "${LOG_FILE}"
        if [ "$(cd "${target_dir}" 2>/dev/null && pwd)" != "$(cd "${script_dir}" && pwd)" ]; then
            # Copy excluding bulky dev caches
            tar --exclude='./node_modules' \
                --exclude='./.git' \
                --exclude='./.turbo' \
                --exclude='./dist' \
                -cf - -C "${script_dir}" . | tar -xf - -C "${target_dir}"
        fi
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cloning latest release from GitHub: ${GITHUB_REPO}" >> "${LOG_FILE}"
        if [ -d "${target_dir}/.git" ]; then
            git -C "${target_dir}" pull --rebase
        else
            git clone --depth 1 "https://github.com/${GITHUB_REPO}.git" "${target_dir}"
        fi
    fi

    # Generate production .env
    local jwt_secret
    if command -v openssl &>/dev/null; then
        jwt_secret="$(openssl rand -hex 32)"
    else
        jwt_secret="$(head -c 32 /dev/urandom | tr -dc 'a-zA-Z0-9')"
    fi

    cat > "${target_dir}/.env" <<EOF
PORT=${PANEL_PORT}
HOST=127.0.0.1
NODE_ENV=production
PANEL_URL=https://${PANEL_DOMAIN}
JWT_SECRET=${jwt_secret}
JWT_EXPIRES_IN=7d
DATABASE_URL=${DATABASE_URL}
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_USERNAME=${ADMIN_USERNAME}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
EOF

    chmod 600 "${target_dir}/.env"
}

build_and_migrate_panel() {
    local target_dir="${DEFAULT_INSTALL_DIR}"
    cd "${target_dir}"

    # Ensure DATABASE_URL is available
    if [ -z "$DATABASE_URL" ]; then
        if [ -f /tmp/.octopus_panel_db_url ]; then
            DATABASE_URL="$(cat /tmp/.octopus_panel_db_url 2>/dev/null)"
        elif [ -f "${target_dir}/.env" ]; then
            DATABASE_URL="$(grep -E '^DATABASE_URL=' "${target_dir}/.env" 2>/dev/null | cut -d= -f2- | tr -d '"'\''')"
        fi
        export DATABASE_URL
    fi

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Installing project dependencies with pnpm" >> "${LOG_FILE}"
    pnpm install --frozen-lockfile --prod=false || pnpm install --prod=false

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Building monorepo assets" >> "${LOG_FILE}"
    pnpm run build

    local sanitized_db_url
    sanitized_db_url="$(echo "${DATABASE_URL}" | sed -E 's/:([^@:]+)@/:****@/')"
    if [ ! -d "${target_dir}/packages/database/drizzle" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Drizzle migrations folder missing, generating SQL migrations..." >> "${LOG_FILE}"
        pnpm --filter @octopus/database db:generate >> "${LOG_FILE}" 2>&1 || true
    fi
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Executing Drizzle ORM database migrations with ${sanitized_db_url}" >> "${LOG_FILE}"
    DATABASE_URL="${DATABASE_URL}" pnpm run db:migrate

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Seeding initial blueprints and data" >> "${LOG_FILE}"
    DATABASE_URL="${DATABASE_URL}" \
    ADMIN_EMAIL="${ADMIN_EMAIL}" \
    ADMIN_USERNAME="${ADMIN_USERNAME}" \
    ADMIN_PASSWORD="${ADMIN_PASSWORD}" \
    pnpm run db:seed
}

# ------------------------------------------------------------------------------
# Stage 5: Administrator Account Initialization ([5/7])
# ------------------------------------------------------------------------------
init_admin_account() {
    local target_dir="${DEFAULT_INSTALL_DIR}"
    cd "${target_dir}"

    # Ensure .env contains the final administrator credentials
    if [ -f "${target_dir}/.env" ]; then
        sed -i -e "s|^ADMIN_EMAIL=.*|ADMIN_EMAIL=${ADMIN_EMAIL}|" "${target_dir}/.env"
        sed -i -e "s|^ADMIN_USERNAME=.*|ADMIN_USERNAME=${ADMIN_USERNAME}|" "${target_dir}/.env"
        sed -i -e "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=${ADMIN_PASSWORD}|" "${target_dir}/.env"
    fi

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Initializing superadmin: ${ADMIN_EMAIL} (${ADMIN_USERNAME})" >> "${LOG_FILE}"

    ADMIN_EMAIL="${ADMIN_EMAIL}" \
    ADMIN_USERNAME="${ADMIN_USERNAME}" \
    ADMIN_PASSWORD="${ADMIN_PASSWORD}" \
    pnpm run db:seed
}

# ------------------------------------------------------------------------------
# Stage 6: Reverse Proxy & Auto-SSL (Caddy) ([6/7])
# ------------------------------------------------------------------------------
install_caddy() {
    if [ "$SKIP_CADDY" = true ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Skipping Caddy installation (--skip-caddy)" >> "${LOG_FILE}"
        return 0
    fi

    if command -v caddy &>/dev/null; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Caddy already installed" >> "${LOG_FILE}"
        return 0
    fi

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Installing official Caddy binary" >> "${LOG_FILE}"
    if [ "$OS_FAMILY" = "debian" ]; then
        export DEBIAN_FRONTEND=noninteractive
        apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
        curl -1sLF 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg --yes
        curl -1sLF 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
        apt-get update -y
        apt-get install -y caddy
    elif [ "$OS_FAMILY" = "rhel" ]; then
        $PKG_MANAGER install -y 'dnf-command(copr)' 2>/dev/null || $PKG_MANAGER install -y yum-plugin-copr 2>/dev/null || true
        $PKG_MANAGER copr enable -y @caddy/caddy || true
        $PKG_MANAGER install -y caddy
    fi
}

configure_caddy() {
    if [ "$SKIP_CADDY" = true ]; then
        return 0
    fi

    mkdir -p "$(dirname "${CADDYFILE_PATH}")" /var/log/caddy 2>/dev/null || true
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Generating ${CADDYFILE_PATH} for domain: ${PANEL_DOMAIN}" >> "${LOG_FILE}"

    cat > "${CADDYFILE_PATH}" <<EOF
${PANEL_DOMAIN} {
    encode zstd gzip

    # Frontend SPA static files fallback & Backend API reverse proxy
    reverse_proxy 127.0.0.1:${PANEL_PORT} {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }

    log {
        output file /var/log/caddy/octopus-access.log {
            roll_size 10MB
            roll_keep 5
        }
    }
}
EOF

    if command -v systemctl &>/dev/null; then
        systemctl enable --now caddy || systemctl restart caddy || true
    fi
}

# ------------------------------------------------------------------------------
# Stage 7: Systemd Service & Health Verification ([7/7])
# ------------------------------------------------------------------------------
setup_systemd_service() {
    if [ "$SKIP_SYSTEMD" = true ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Skipping systemd setup (--skip-systemd)" >> "${LOG_FILE}"
        return 0
    fi

    mkdir -p "$(dirname "${SYSTEMD_SERVICE_FILE}")" 2>/dev/null || true

    local pnpm_bin
    pnpm_bin="$(command -v pnpm || echo "/usr/bin/pnpm")"

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Writing ${SYSTEMD_SERVICE_FILE}" >> "${LOG_FILE}"

    cat > "${SYSTEMD_SERVICE_FILE}" <<EOF
[Unit]
Description=OctopusPanel Master Control Plane
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=${DEFAULT_INSTALL_DIR}
ExecStart=${pnpm_bin} run start
Restart=always
RestartSec=5
Environment=NODE_ENV=production
EnvironmentFile=${DEFAULT_INSTALL_DIR}/.env
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

    if command -v systemctl &>/dev/null; then
        systemctl daemon-reload
        systemctl enable octopus-panel
        # Stop any stale instance from a previous test/install
        systemctl stop octopus-panel 2>/dev/null || true
        # Clean up any lingering process holding the panel port
        if command -v fuser &>/dev/null; then
            fuser -k -9 "${PANEL_PORT}/tcp" 2>/dev/null || true
        fi
        systemctl restart octopus-panel || systemctl start octopus-panel
    fi
}

verify_backend_health() {
    if [ "$SKIP_SYSTEMD" = true ]; then
        return 0
    fi

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Polling backend health endpoint on port ${PANEL_PORT}" >> "${LOG_FILE}"

    local max_retries=30
    local retries=0
    local health_url="http://127.0.0.1:${PANEL_PORT}/api/system/health"
    local health_url_v1="http://127.0.0.1:${PANEL_PORT}/api/v1/system/health"

    while [ "$retries" -lt "$max_retries" ]; do
        if curl -s -f -m 3 "${health_url}" >/dev/null 2>&1 || \
           curl -s -f -m 3 "${health_url_v1}" >/dev/null 2>&1; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] Health check successful" >> "${LOG_FILE}"
            return 0
        fi
        sleep 1
        retries=$((retries + 1))
    done

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Health check timed out after ${max_retries}s" >> "${LOG_FILE}"
    if command -v systemctl &>/dev/null; then
        systemctl status octopus-panel >> "${LOG_FILE}" 2>&1 || true
    fi
    if command -v journalctl &>/dev/null; then
        journalctl -u octopus-panel -n 40 --no-pager >> "${LOG_FILE}" 2>&1 || true
    fi
    return 1
}

# ==============================================================================
# Main Orchestration Pipeline
# ==============================================================================
main() {
    parse_args "$@"

    render_header "${INSTALLER_VERSION}"

    # Stage 1: Pre-flight & System Check
    stage_preflight

    # Prompt interactive configuration
    prompt_interactive_config

    # Stage 2: Node.js LTS & Toolchain Setup
    if ! run_step "[2/7] Installing base system tools" install_base_tools; then
        show_error_box "[2/7]" "Failed to install required system utilities" "Please inspect the log file for package manager errors."
        exit 1
    fi

    if ! run_step "[2/7] Configuring Node.js LTS and pnpm toolchain" setup_nodejs_toolchain; then
        show_error_box "[2/7]" "Failed to configure Node.js LTS engine" "NodeSource repository or pnpm activation encountered an error."
        exit 1
    fi

    # Stage 3: PostgreSQL Database Provisioning
    if [ "$INSTALL_POSTGRES" = true ]; then
        if ! run_step "[3/7] Provisioning local PostgreSQL database" provision_local_postgres; then
            show_error_box "[3/7]" "PostgreSQL database provisioning failed" "Could not start postgresql.service or create database 'octopus_panel'."
            exit 1
        fi
    else
        if ! run_step "[3/7] Verifying PostgreSQL connection" verify_db_connectivity; then
            show_error_box "[3/7]" "Database connectivity test failed" "Unable to authenticate with the provided database URL."
            exit 1
        fi
    fi

    # Stage 4: Panel Deployment & DB Migrations
    if ! run_step "[4/7] Deploying OctopusPanel application files" deploy_panel_files; then
        show_error_box "[4/7]" "Application deployment failed" "Could not clone repository or write production environment file."
        exit 1
    fi

    if ! run_step "[4/7] Compiling assets and running migrations" build_and_migrate_panel; then
        show_error_box "[4/7]" "Build or database migration failed" "pnpm run build or db:migrate exited with an error."
        exit 1
    fi

    # Stage 5: Administrator Account Initialization
    if ! run_step "[5/7] Initializing superadmin account" init_admin_account; then
        show_error_box "[5/7]" "Administrator account initialization failed" "Could not insert superadmin user into the database."
        exit 1
    fi

    # Stage 6: Reverse Proxy & Auto-SSL (Caddy)
    if [ "$SKIP_CADDY" = false ]; then
        if ! run_step "[6/7] Installing Caddy web server" install_caddy; then
            show_error_box "[6/7]" "Caddy installation failed" "Could not install Caddy from official repository."
            exit 1
        fi

        if ! run_step "[6/7] Configuring Caddy reverse proxy and auto-SSL" configure_caddy; then
            show_error_box "[6/7]" "Caddy reverse proxy configuration failed" "Failed to generate /etc/caddy/Caddyfile or start caddy service."
            exit 1
        fi
    fi

    # Stage 7: Systemd Service & Health Verification
    if [ "$SKIP_SYSTEMD" = false ]; then
        if ! run_step "[7/7] Setting up systemd service unit" setup_systemd_service; then
            show_error_box "[7/7]" "Failed to configure octopus-panel systemd unit" "Unable to write service unit file or run daemon-reload."
            exit 1
        fi

        if ! run_step "[7/7] Verifying panel health endpoint" verify_backend_health; then
            show_error_box "[7/7]" "Panel health check failed" "The OctopusPanel service did not respond on http://127.0.0.1:${PANEL_PORT}/api/system/health within 15 seconds."
            exit 1
        fi
    fi

    # Cleanup temporary credentials cache
    rm -f /tmp/.octopus_panel_db_url 2>/dev/null || true

    # Success Banner
    show_success_box
}

main "$@"
