#!/bin/bash
# Build script for Khi - Device Auto-Import Feature

set -e

echo "=========================================="
echo "Building Khi - Device Auto-Import Feature"
echo "=========================================="
echo ""

# Build frontend
echo "[1/3] Building frontend..."
npm run build

# Build Tauri app
echo ""
echo "[2/3] Building Tauri app (this may take a few minutes)..."
npm run tauri build

# Check if build succeeded
if [ -d "src-tauri/target/release/bundle" ]; then
    echo ""
    echo "=========================================="
    echo "✅ Build completed successfully!"
    echo "=========================================="
    echo ""
    echo "Output locations:"
    echo "  - App: src-tauri/target/release/bundle/macos/Khi.app"
    echo "  - DMG: src-tauri/target/release/bundle/dmg/Khi_0.1.0_aarch64.dmg"
    echo ""
    echo "To test:"
    echo "  open src-tauri/target/release/bundle/macos/Khi.app"
else
    echo ""
    echo "❌ Build failed - check error messages above"
    exit 1
fi
