# Tasks Feature Testing Guide

Comprehensive testing documentation for the Tasks Management feature.

## Overview

This test suite provides comprehensive coverage for the Tasks feature, including:
- **Unit Tests**: Testing hooks and business logic (Jest)
- **Component Tests**: Testing React components in isolation (Jest + React Testing Library)
- **E2E Tests**: Testing user workflows and integration (Playwright)

## Test Files

### Unit Tests

#### `src/hooks/useTasks.test.ts`
Tests the `useTasks` hook which manages task CRUD operations and real-time updates.

**Coverage:**
- Real-time snapshot listener setup and cleanup
- Task creation with default and custom values
- Task ordering calculation
- Task updates with partial data
- Task deletion
- Error handling for all operations
- Authentication state handling

**Key Test Cases:**
- ✅ Sets up real-time listener with correct Firestore queries
- ✅ Creates tasks with default priority (medium) and status (todo)
- ✅ Calculates correct order for new tasks
- ✅ Filters out undefined values in updates
- ✅ Handles user not authenticated errors
- ✅ Shows toast notifications on success/failure

### Component Tests

#### `src/components/tasks/TaskCard.test.tsx`
Tests the TaskCard component which displays individual tasks.

**Coverage:**
- Task data rendering (title, description, dates)
- Priority colors (low: gray, medium: yellow, high: red)
- Status badges (To Do, In Progress, Done)
- User interactions (click to edit, menu actions)
- Accessibility (ARIA labels, keyboard navigation)
- Text truncation for long content

**Key Test Cases:**
- ✅ Renders task title, description, and formatted date
- ✅ Displays correct priority colors and badges
- ✅ Shows status badges with appropriate icons
- ✅ Calls onEdit when card is clicked
- ✅ Opens action menu and handles Edit/Delete actions
- ✅ Confirms before deleting tasks
- ✅ Applies opacity when dragging

#### `src/components/tasks/TaskModal.test.tsx`
Tests the TaskModal component for creating and editing tasks.

**Coverage:**
- Create mode vs. Edit mode rendering
- Form validation (required fields, character limits)
- Priority and status selection
- Form submission and error handling
- Character count display
- Mobile optimization (font size to prevent zoom)

**Key Test Cases:**
- ✅ Shows "Create New Task" in create mode
- ✅ Shows "Edit Task" with pre-filled data in edit mode
- ✅ Validates required title field
- ✅ Enforces 100 character limit on title
- ✅ Enforces 500 character limit on description
- ✅ Trims whitespace from inputs
- ✅ Shows loading state during submission
- ✅ Prevents double submission
- ✅ Handles save errors gracefully

### E2E Tests

#### `e2e/tasks.spec.ts`
End-to-end tests for task CRUD operations.

**Coverage:**
- Creating tasks via modal
- Editing existing tasks
- Deleting tasks with confirmation
- View switching (list ↔ kanban)
- Form validation in real browser
- Priority badges display
- Mobile responsive behavior

**Key Test Cases:**
- ✅ Creates new task with title, description, and priority
- ✅ Edits task title, description, status, and priority
- ✅ Deletes task after confirmation
- ✅ Switches between list and kanban views
- ✅ Validates required fields in browser
- ✅ Enforces character limits
- ✅ Works correctly on mobile viewport

#### `e2e/tasks-kanban.spec.ts`
End-to-end tests for Kanban drag-and-drop functionality.

**Coverage:**
- Kanban column display
- Drag-and-drop between columns
- Status updates on drag
- Visual drop indicators
- Multiple tasks handling
- Mobile fallback (status selector)
- Error handling

**Key Test Cases:**
- ✅ Displays three kanban columns (To Do, In Progress, Done)
- ✅ Drags task from To Do to In Progress
- ✅ Drags task from In Progress to Done
- ✅ Shows visual drop indicators during drag
- ✅ Handles multiple tasks in columns
- ✅ Preserves task order within columns
- ✅ Uses status selector on mobile (no drag)
- ✅ Handles failed status updates gracefully

## Running Tests

### Install Dependencies

```bash
# Install Jest and testing utilities (if not already installed)
npm install --save-dev jest @testing-library/react @testing-library/jest-dom @testing-library/user-event

# Install Playwright browsers (if not already installed)
npx playwright install
```

### Run Unit and Component Tests

```bash
# Run all Jest tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Run E2E Tests

```bash
# Run all E2E tests (headless)
npm run test:e2e

# Run E2E tests with UI (interactive)
npm run test:e2e:ui

# Run E2E tests in headed mode (see browser)
npm run test:e2e:headed

# Run specific test file
npx playwright test e2e/tasks.spec.ts

# Run tests on specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

## Test Configuration

### Jest Configuration (`jest.config.js`)

```javascript
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{spec,test}.{js,jsx,ts,tsx}'
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/**/__tests__/**',
  ],
}

module.exports = createJestConfig(customJestConfig)
```

### Playwright Configuration (`playwright.config.ts`)

```typescript
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 12'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

## Firebase Testing

### Using Firebase Emulator

For more reliable E2E tests, you can use the Firebase Emulator:

```bash
# Install Firebase CLI (if not already installed)
npm install -g firebase-tools

# Start emulators
firebase emulators:start

# Run tests against emulators
FIREBASE_EMULATOR=true npm run test:e2e
```

### Test Data Cleanup

E2E tests should clean up after themselves:

```typescript
test.afterEach(async ({ page }) => {
  // Delete test tasks
  // Clean up test project
});
```

## Coverage Goals

- **Unit Tests**: >80% coverage for hooks and utilities
- **Component Tests**: >70% coverage for UI components
- **E2E Tests**: Cover all critical user workflows

## Current Test Coverage

### Unit Tests (useTasks Hook)
- ✅ Real-time listener: 100%
- ✅ createTask: 100%
- ✅ updateTask: 100%
- ✅ deleteTask: 100%
- ✅ Error handling: 100%

### Component Tests (TaskCard)
- ✅ Rendering: 100%
- ✅ Priority colors: 100%
- ✅ Status badges: 100%
- ✅ Interactions: 100%
- ✅ Accessibility: 100%

### Component Tests (TaskModal)
- ✅ Mode switching: 100%
- ✅ Form validation: 100%
- ✅ Character limits: 100%
- ✅ Submission: 100%
- ✅ Error handling: 100%

### E2E Tests
- ✅ Task CRUD: Complete
- ✅ Kanban drag-and-drop: Complete
- ✅ Mobile responsive: Complete
- ✅ Error handling: Complete

## Continuous Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
```

## Troubleshooting

### Common Issues

1. **Jest tests fail to find modules**
   - Ensure `moduleNameMapper` is correctly configured in `jest.config.js`
   - Check that `@/` alias points to `src/` directory

2. **Playwright tests timeout**
   - Increase timeout in `playwright.config.ts`
   - Ensure dev server is running (`npm run dev`)
   - Check if Firebase emulator is needed

3. **Firebase authentication in tests**
   - Use test user credentials
   - Configure Firebase emulator for isolated testing
   - Mock authentication in unit/component tests

4. **Flaky E2E tests**
   - Use `waitFor` instead of fixed timeouts
   - Add proper wait conditions for async operations
   - Increase retries in CI environment

## Best Practices

1. **Unit Tests**
   - Mock external dependencies (Firebase, auth)
   - Test one thing per test case
   - Use descriptive test names

2. **Component Tests**
   - Test user interactions, not implementation
   - Use accessible queries (getByRole, getByLabel)
   - Test error states and edge cases

3. **E2E Tests**
   - Test critical user workflows
   - Keep tests independent (don't rely on test order)
   - Clean up test data after each test
   - Use data-testid sparingly, prefer semantic queries

4. **General**
   - Keep tests fast and focused
   - Don't test implementation details
   - Test behavior, not code structure
   - Maintain tests like production code

## Contributing

When adding new features:

1. Write tests first (TDD approach)
2. Ensure all tests pass before committing
3. Maintain >80% coverage for new code
4. Update this guide if adding new test patterns

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite)
