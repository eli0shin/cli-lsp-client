#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 <bump_type>"
    echo ""
    echo "bump_type: major, minor, or patch"
    echo ""
    echo "Example:"
    echo "  $0 patch   # 1.0.0 -> 1.0.1"
    echo "  $0 minor   # 1.0.0 -> 1.1.0"
    echo "  $0 major   # 1.0.0 -> 2.0.0"
}

# Check if bump type is provided
if [ $# -eq 0 ]; then
    print_error "No bump type specified"
    show_usage
    exit 1
fi

BUMP_TYPE=$1

# Validate bump type
if [[ ! "$BUMP_TYPE" =~ ^(major|minor|patch)$ ]]; then
    print_error "Invalid bump type: $BUMP_TYPE"
    show_usage
    exit 1
fi

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "Not in a git repository"
    exit 1
fi

# Check if working directory is clean
if ! git diff-index --quiet HEAD --; then
    print_error "Working directory is not clean. Please commit or stash your changes."
    exit 1
fi

# Check if we're on main/master branch
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "main" && "$CURRENT_BRANCH" != "master" ]]; then
    print_warning "You are on branch '$CURRENT_BRANCH', not main/master"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Release cancelled"
        exit 1
    fi
fi

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    print_error "GitHub CLI (gh) is not installed. Please install it first."
    exit 1
fi

# Check if gh is authenticated
if ! gh auth status &> /dev/null; then
    print_error "GitHub CLI is not authenticated. Please run 'gh auth login' first."
    exit 1
fi

# Check if npm is authenticated
if ! npm whoami &> /dev/null; then
    print_error "npm is not authenticated. Please run 'npm login' first."
    exit 1
fi

echo "Starting release process with bump type: $BUMP_TYPE"
echo

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
print_success "Current version: $CURRENT_VERSION"

# Use npm version to bump, test, build, commit and tag
# This will run the prepublish script which handles test + build
print_success "Running npm version $BUMP_TYPE (this will test, build, bump, commit and tag)..."
NEW_VERSION=$(npm version "$BUMP_TYPE")
NEW_VERSION=${NEW_VERSION#v} # Remove 'v' prefix if present

print_success "New version: $NEW_VERSION"

# Push changes and tags
print_success "Pushing changes and tags..."
git push origin "$CURRENT_BRANCH" --follow-tags

# Publish to npm
print_success "Publishing to npm..."
if ! npm publish; then
    print_error "npm publish failed. Tag and commit have been pushed but package was not published."
    exit 1
fi

# Create GitHub release with auto-generated notes
print_success "Creating GitHub release..."
if ! gh release create "v$NEW_VERSION" --generate-notes; then
    print_error "Failed to create GitHub release. Package has been published and tagged."
    exit 1
fi

print_success "Release completed successfully!"
echo
echo "Summary:"
echo "  • Version bumped: $CURRENT_VERSION → $NEW_VERSION"
echo "  • Git tag created: v$NEW_VERSION"
echo "  • Changes pushed to GitHub"
echo "  • Package published to npm"
echo "  • GitHub release created with auto-generated notes"
echo
echo "View the release: https://github.com/$(gh repo view --json owner,name -q '.owner.login + "/" + .name')/releases/tag/v$NEW_VERSION"