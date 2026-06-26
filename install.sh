#!/usr/bin/env bash

# PortaDrive One-Click Installer
# Installs the precompiled standalone binary and system dependencies.

set -euo pipefail

# Text colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${CYAN}${BOLD}====================================================${NC}"
echo -e "${CYAN}${BOLD}     🍀  PortaDrive Installer (One-Click)  🍀     ${NC}"
echo -e "${CYAN}${BOLD}====================================================${NC}"
echo ""

# 1. Detect OS and CPU Architecture
OS="$(uname -s)"
ARCH="$(uname -m)"

echo -e "Detecting system environment..."
echo -e "  - OS: ${BLUE}${OS}${NC}"
echo -e "  - Architecture: ${BLUE}${ARCH}${NC}"

BINARY_NAME="porta-drive"
REPO="sodikinnaa/porta-drive"

# Determine appropriate precompiled binary name on GitHub release
# Since we release targets, let's map them
PLATFORM=""
if [ "$OS" = "Linux" ]; then
    if [ "$ARCH" = "x86_64" ]; then
        PLATFORM="linux-x64"
    elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
        PLATFORM="linux-arm64"
    fi
elif [ "$OS" = "Darwin" ]; then
    if [ "$ARCH" = "x86_64" ]; then
        PLATFORM="macos-x64"
    elif [ "$ARCH" = "arm64" ]; then
        PLATFORM="macos-arm64"
    fi
fi

if [ -z "$PLATFORM" ]; then
    echo -e "${RED}Error: Unsupported operating system or architecture (${OS}-${ARCH}).${NC}"
    echo -e "Please compile from source: bun install && bun build --compile src/index.ts"
    exit 1
fi

DOWNLOAD_URL="https://github.com/${REPO}/releases/latest/download/porta-drive-${PLATFORM}"

# 2. Check for system dependencies (like pdftotext / poppler-utils)
echo -e "\nChecking PDF parsing dependency (${BOLD}pdftotext${NC})..."
if command -v pdftotext &> /dev/null; then
    echo -e "  - pdftotext: ${GREEN}Detected (${$(pdftotext -v 2>&1 | head -n 1)})${NC}"
else
    echo -e "  - pdftotext: ${YELLOW}Not found${NC}"
    echo -e "              To scan PDFs, we recommend installing poppler-utils after this install."
    echo -e "              Ubuntu/Debian: ${CYAN}sudo apt install -y poppler-utils${NC}"
    echo -e "              macOS:         ${CYAN}brew install poppler${NC}"
fi

# 3. Choose installation path
INSTALL_DIR="/usr/local/bin"
USE_SUDO=true

if [ ! -w "$INSTALL_DIR" ]; then
    # If not writable, check if we can sudo or if we should use ~/.local/bin
    if [ "$EUID" -ne 0 ]; then
        echo -e "\n${YELLOW}Note: /usr/local/bin requires root access.${NC}"
        echo -e "Do you want to install globally using sudo? (y/n) "
        read -r use_global
        if [ "$use_global" != "y" ] && [ "$use_global" != "Y" ]; then
            INSTALL_DIR="${HOME}/.local/bin"
            USE_SUDO=false
            mkdir -p "$INSTALL_DIR"
            # Ensure path is in PATH
            if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
                echo -e "${YELLOW}Warning: $INSTALL_DIR is not in your PATH.${NC}"
                echo -e "You might need to add: ${CYAN}export PATH=\"\$PATH:\$HOME/.local/bin\"${NC} to your shell config."
            fi
        fi
    else
        USE_SUDO=false
    fi
else
    USE_SUDO=false
fi

DEST_FILE="${INSTALL_DIR}/${BINARY_NAME}"
TEMP_FILE="/tmp/${BINARY_NAME}-${PLATFORM}"

# 4. Download binary
echo -e "\nDownloading latest PortaDrive release for ${CYAN}${PLATFORM}${NC}..."
echo -e "Source: ${BLUE}${DOWNLOAD_URL}${NC}"

# Check if curl or wget is installed
if command -v curl &> /dev/null; then
    if ! curl -L --fail -o "$TEMP_FILE" "$DOWNLOAD_URL"; then
        echo -e "${RED}Error: Failed to download binary.${NC}"
        echo -e "The release binary might not be published yet on GitHub."
        echo -e "You can compile it locally: ${CYAN}bun build --compile src/index.ts --outfile porta-drive${NC}"
        exit 1
    fi
elif command -v wget &> /dev/null; then
    if ! wget -O "$TEMP_FILE" "$DOWNLOAD_URL"; then
        echo -e "${RED}Error: Failed to download binary.${NC}"
        exit 1
    fi
else
    echo -e "${RED}Error: curl or wget is required to download the binary.${NC}"
    exit 1
fi

# Make binary executable
chmod +x "$TEMP_FILE"

# 5. Move binary to destination folder
echo -e "\nInstalling binary to ${GREEN}${DEST_FILE}${NC}..."
if [ "$USE_SUDO" = true ]; then
    sudo mv "$TEMP_FILE" "$DEST_FILE"
else
    mv "$TEMP_FILE" "$DEST_FILE"
fi

echo -e "\n${GREEN}${BOLD}✓ PortaDrive installed successfully!${NC}"
echo -e "You can run it from your terminal using: ${CYAN}${BOLD}${BINARY_NAME}${NC}"
echo -e "Note: Keep the frontend ${BOLD}public/${NC} folder in the directory where you run the binary."
echo -e "${CYAN}${BOLD}====================================================${NC}"
