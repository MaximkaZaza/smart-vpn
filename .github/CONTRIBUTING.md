# Contributing to Smart VPN

Thank you for your interest in contributing to Smart VPN! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

1. **Fork** the repository
2. **Clone** your fork: `git clone https://github.com/your-username/smart-vpn.git`
3. **Create a branch**: `git checkout -b feature/your-feature-name`
4. **Make changes** and commit: `git commit -m 'Add some feature'`
5. **Push** to your fork: `git push origin feature/your-feature-name`
6. **Open a Pull Request**

## How to Contribute

### Reporting Bugs

- Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md)
- Include steps to reproduce
- Add logs and screenshots if applicable

### Suggesting Features

- Use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.md)
- Explain the use case
- Describe expected behavior

### Code Contributions

- Fix bugs
- Add new features
- Improve documentation
- Add tests
- Optimize performance

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- PostgreSQL >= 15
- Redis >= 7
- Docker (optional)

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Run in development mode
npm run dev
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run ci:test

# Run E2E tests
npm run test:e2e
```

## Pull Request Guidelines

### Before Submitting

- [ ] Code follows project style guidelines
- [ ] Tests are added/updated
- [ ] All tests pass
- [ ] Documentation is updated
- [ ] Linting passes (`npm run lint`)

### PR Title Format

Use conventional commits:
- `feat: add new feature`
- `fix: resolve bug in auth`
- `docs: update README`
- `test: add unit tests`
- `refactor: improve code structure`

### PR Description

Use the [pull request template](.github/PULL_REQUEST_TEMPLATE.md) and include:
- Description of changes
- Related issues
- Testing steps
- Screenshots (if applicable)

## Coding Standards

### JavaScript Style Guide

- Use ES6+ features where appropriate
- Prefer `const` and `let` over `var`
- Use async/await for asynchronous code
- Follow existing code formatting

### File Naming

- Use lowercase with hyphens for files: `user-service.js`
- Use PascalCase for classes: `class UserService`
- Use camelCase for functions and variables: `getUserData`

### Comments

- Use JSDoc for function documentation
- Explain _why_, not _what_
- Keep comments up to date

Example:
```javascript
/**
 * Get user by ID
 * @param {string} id - User ID
 * @returns {Promise<User>} User object
 */
async function getUserById(id) {
  // Implementation
}
```

## Testing

### Test Structure

```javascript
describe('UserService', () => {
  describe('getUserById', () => {
    it('should return user for valid ID', async () => {
      // Test implementation
    });

    it('should throw error for invalid ID', async () => {
      // Test implementation
    });
  });
});
```

### Coverage Requirements

- Aim for >80% code coverage
- Test critical paths
- Include edge cases
- Test error handling

## Documentation

### README Updates

Update README.md when:
- Adding new features
- Changing API endpoints
- Modifying configuration
- Adding dependencies

### Code Documentation

- Document all public functions
- Add inline comments for complex logic
- Keep documentation in sync with code

## Questions?

Feel free to open an issue with the `question` label or contact us at support@vpn.example.com.

---

**Thank you for contributing to Smart VPN!** 🎉
