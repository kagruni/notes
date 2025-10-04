# Testing Quick Start

## 🚀 Quick Setup

```bash
# 1. Install Jest dependencies (if needed)
npm install --save-dev jest @testing-library/react @testing-library/jest-dom @testing-library/user-event

# 2. Install Playwright browsers
npx playwright install

# 3. Start dev server (for E2E tests)
npm run dev
```

## 🧪 Run Tests

### Unit & Component Tests
```bash
npm test                 # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # With coverage
```

### E2E Tests
```bash
npm run test:e2e           # Headless (CI mode)
npm run test:e2e:ui        # Interactive UI
npm run test:e2e:headed    # See browser
```

### Specific Tests
```bash
# Run specific test file
npm test -- src/hooks/useTasks.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="should create task"

# Run E2E for specific browser
npx playwright test --project=chromium
```

## 📊 Test Coverage

### Current Coverage
- ✅ **useTasks Hook:** 100%
- ✅ **TaskCard Component:** 100%
- ✅ **TaskModal Component:** 100%
- ✅ **E2E Workflows:** Complete

### View Coverage Report
```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

## 🔍 Test Files

| File | Type | Purpose |
|------|------|---------|
| `src/hooks/useTasks.test.ts` | Unit | Task CRUD logic |
| `src/components/tasks/TaskCard.test.tsx` | Component | Task card UI |
| `src/components/tasks/TaskModal.test.tsx` | Component | Modal form |
| `e2e/tasks.spec.ts` | E2E | CRUD workflows |
| `e2e/tasks-kanban.spec.ts` | E2E | Drag-and-drop |

## 🐛 Troubleshooting

### Jest not found
```bash
npm install --save-dev jest
```

### Playwright fails
```bash
npx playwright install --with-deps
```

### E2E timeouts
```bash
# Make sure dev server is running
npm run dev

# Increase timeout in playwright.config.ts
```

### Firebase errors in E2E
```bash
# Use Firebase Emulator
firebase emulators:start
```

## 📚 Full Documentation

- **Comprehensive Guide:** [TESTING_GUIDE.md](../TESTING_GUIDE.md)
- **Test Summary:** [TEST_SUMMARY.md](../TEST_SUMMARY.md)
- **Feature Spec:** [TASKS_FEATURE_SPEC.md](../TASKS_FEATURE_SPEC.md)

## ✅ Pre-Commit Checklist

- [ ] All tests pass: `npm test`
- [ ] No TypeScript errors: `npm run lint`
- [ ] E2E tests pass: `npm run test:e2e`
- [ ] Coverage >80%: `npm run test:coverage`

---

**Need Help?** See [TESTING_GUIDE.md](../TESTING_GUIDE.md) for detailed instructions.
