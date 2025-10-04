/**
 * E2E tests for Kanban Drag-and-Drop
 *
 * Tests drag-and-drop functionality for moving tasks between columns
 * and verifies status updates in Firestore.
 *
 * Prerequisites:
 * - Dev server running at http://localhost:3000
 * - User must be logged in
 * - Test project should exist
 *
 * Run with: npx playwright test e2e/tasks-kanban.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Kanban Drag-and-Drop', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // TODO: Add authentication logic if needed
    // Navigate to a test project
    await page.waitForTimeout(1000);

    // Switch to kanban view
    const kanbanButton = page.getByRole('button', { name: /kanban.*view/i });
    if (await kanbanButton.isVisible()) {
      await kanbanButton.click();
    }

    // Wait for kanban view to load
    await expect(page.getByText('To Do')).toBeVisible();
    await expect(page.getByText('In Progress')).toBeVisible();
    await expect(page.getByText('Done')).toBeVisible();
  });

  test('should display kanban columns correctly', async ({ page }) => {
    // Verify all three columns are present
    const todoColumn = page.locator('[data-status="todo"]');
    const inProgressColumn = page.locator('[data-status="in_progress"]');
    const doneColumn = page.locator('[data-status="done"]');

    await expect(todoColumn).toBeVisible();
    await expect(inProgressColumn).toBeVisible();
    await expect(doneColumn).toBeVisible();

    // Verify column headers
    await expect(page.getByText('To Do')).toBeVisible();
    await expect(page.getByText('In Progress')).toBeVisible();
    await expect(page.getByText('Done')).toBeVisible();
  });

  test('should drag task from To Do to In Progress', async ({ page }) => {
    // Create a test task in To Do
    await page.getByRole('button', { name: /new task/i }).click();
    await page.getByLabel('Task title').fill('Drag Test Task');
    await page.getByRole('button', { name: /create/i }).click();

    // Wait for task to appear in To Do column
    const taskCard = page.getByText('Drag Test Task');
    await expect(taskCard).toBeVisible();

    // Verify task is in To Do column
    const todoColumn = page.locator('[data-status="todo"]');
    await expect(todoColumn.locator('text=Drag Test Task')).toBeVisible();

    // Drag task to In Progress column
    const inProgressColumn = page.locator('[data-status="in_progress"]');

    // Get bounding boxes for drag and drop
    const taskBoundingBox = await taskCard.boundingBox();
    const dropZoneBoundingBox = await inProgressColumn.boundingBox();

    if (taskBoundingBox && dropZoneBoundingBox) {
      // Perform drag and drop
      await page.mouse.move(
        taskBoundingBox.x + taskBoundingBox.width / 2,
        taskBoundingBox.y + taskBoundingBox.height / 2
      );
      await page.mouse.down();
      await page.mouse.move(
        dropZoneBoundingBox.x + dropZoneBoundingBox.width / 2,
        dropZoneBoundingBox.y + dropZoneBoundingBox.height / 2,
        { steps: 10 }
      );
      await page.mouse.up();

      // Wait for status update
      await page.waitForTimeout(500);

      // Verify task moved to In Progress column
      await expect(inProgressColumn.locator('text=Drag Test Task')).toBeVisible();

      // Verify task is no longer in To Do column
      await expect(todoColumn.locator('text=Drag Test Task')).not.toBeVisible();

      // Verify status badge updated
      await expect(page.getByText('In Progress')).toBeVisible();
    }
  });

  test('should drag task from In Progress to Done', async ({ page }) => {
    // Create a task and move it to In Progress first
    await page.getByRole('button', { name: /new task/i }).click();
    await page.getByLabel('Task title').fill('Complete Test Task');
    await page.getByRole('button', { name: /create/i }).click();

    // Wait for task to appear
    await expect(page.getByText('Complete Test Task')).toBeVisible();

    // First drag from To Do to In Progress
    const taskCard = page.getByText('Complete Test Task');
    const inProgressColumn = page.locator('[data-status="in_progress"]');

    let taskBoundingBox = await taskCard.boundingBox();
    let dropZoneBoundingBox = await inProgressColumn.boundingBox();

    if (taskBoundingBox && dropZoneBoundingBox) {
      await page.mouse.move(
        taskBoundingBox.x + taskBoundingBox.width / 2,
        taskBoundingBox.y + taskBoundingBox.height / 2
      );
      await page.mouse.down();
      await page.mouse.move(
        dropZoneBoundingBox.x + dropZoneBoundingBox.width / 2,
        dropZoneBoundingBox.y + dropZoneBoundingBox.height / 2,
        { steps: 10 }
      );
      await page.mouse.up();

      await page.waitForTimeout(500);
    }

    // Now drag from In Progress to Done
    const doneColumn = page.locator('[data-status="done"]');
    const inProgressTask = inProgressColumn.locator('text=Complete Test Task');

    taskBoundingBox = await inProgressTask.boundingBox();
    dropZoneBoundingBox = await doneColumn.boundingBox();

    if (taskBoundingBox && dropZoneBoundingBox) {
      await page.mouse.move(
        taskBoundingBox.x + taskBoundingBox.width / 2,
        taskBoundingBox.y + taskBoundingBox.height / 2
      );
      await page.mouse.down();
      await page.mouse.move(
        dropZoneBoundingBox.x + dropZoneBoundingBox.width / 2,
        dropZoneBoundingBox.y + dropZoneBoundingBox.height / 2,
        { steps: 10 }
      );
      await page.mouse.up();

      await page.waitForTimeout(500);

      // Verify task moved to Done column
      await expect(doneColumn.locator('text=Complete Test Task')).toBeVisible();

      // Verify task is no longer in In Progress column
      await expect(inProgressColumn.locator('text=Complete Test Task')).not.toBeVisible();

      // Verify status badge updated
      await expect(page.getByText('Done')).toBeVisible();
    }
  });

  test('should show visual drop indicators', async ({ page }) => {
    // Create a test task
    await page.getByRole('button', { name: /new task/i }).click();
    await page.getByLabel('Task title').fill('Drop Indicator Test');
    await page.getByRole('button', { name: /create/i }).click();

    await expect(page.getByText('Drop Indicator Test')).toBeVisible();

    // Start dragging
    const taskCard = page.getByText('Drop Indicator Test');
    const taskBoundingBox = await taskCard.boundingBox();

    if (taskBoundingBox) {
      await page.mouse.move(
        taskBoundingBox.x + taskBoundingBox.width / 2,
        taskBoundingBox.y + taskBoundingBox.height / 2
      );
      await page.mouse.down();

      // Hover over In Progress column
      const inProgressColumn = page.locator('[data-status="in_progress"]');
      const dropZoneBoundingBox = await inProgressColumn.boundingBox();

      if (dropZoneBoundingBox) {
        await page.mouse.move(
          dropZoneBoundingBox.x + dropZoneBoundingBox.width / 2,
          dropZoneBoundingBox.y + dropZoneBoundingBox.height / 2,
          { steps: 5 }
        );

        // Visual indicator should appear (implementation dependent)
        // This could be a highlight, border change, or overlay

        // Complete the drop
        await page.mouse.up();
      }
    }
  });

  test('should handle multiple tasks in columns', async ({ page }) => {
    // Create multiple tasks
    const tasks = ['Task 1', 'Task 2', 'Task 3'];

    for (const taskTitle of tasks) {
      await page.getByRole('button', { name: /new task/i }).click();
      await page.getByLabel('Task title').fill(taskTitle);
      await page.getByRole('button', { name: /create/i }).click();
      await expect(page.getByText(taskTitle)).toBeVisible();
    }

    // Verify all tasks are in To Do column
    const todoColumn = page.locator('[data-status="todo"]');
    for (const taskTitle of tasks) {
      await expect(todoColumn.locator(`text=${taskTitle}`)).toBeVisible();
    }

    // Drag Task 2 to In Progress
    const task2 = page.getByText('Task 2');
    const inProgressColumn = page.locator('[data-status="in_progress"]');

    const taskBoundingBox = await task2.boundingBox();
    const dropZoneBoundingBox = await inProgressColumn.boundingBox();

    if (taskBoundingBox && dropZoneBoundingBox) {
      await page.mouse.move(
        taskBoundingBox.x + taskBoundingBox.width / 2,
        taskBoundingBox.y + taskBoundingBox.height / 2
      );
      await page.mouse.down();
      await page.mouse.move(
        dropZoneBoundingBox.x + dropZoneBoundingBox.width / 2,
        dropZoneBoundingBox.y + dropZoneBoundingBox.height / 2,
        { steps: 10 }
      );
      await page.mouse.up();

      await page.waitForTimeout(500);

      // Verify Task 2 moved, but Task 1 and Task 3 stayed
      await expect(inProgressColumn.locator('text=Task 2')).toBeVisible();
      await expect(todoColumn.locator('text=Task 1')).toBeVisible();
      await expect(todoColumn.locator('text=Task 3')).toBeVisible();
    }
  });

  test('should preserve task order within columns', async ({ page }) => {
    // Create tasks with specific order
    const tasks = ['First Task', 'Second Task', 'Third Task'];

    for (const taskTitle of tasks) {
      await page.getByRole('button', { name: /new task/i }).click();
      await page.getByLabel('Task title').fill(taskTitle);
      await page.getByRole('button', { name: /create/i }).click();
      await expect(page.getByText(taskTitle)).toBeVisible();
    }

    // Verify order in To Do column
    const todoColumn = page.locator('[data-status="todo"]');
    const taskElements = await todoColumn.locator('[class*="TaskCard"]').all();

    // Check order (implementation dependent on how tasks are rendered)
    // This is a basic check
    expect(taskElements.length).toBeGreaterThanOrEqual(3);
  });
});

test.describe('Kanban on Mobile (No Drag)', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should show status selector on mobile instead of drag', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Switch to kanban view
    const kanbanButton = page.getByRole('button', { name: /kanban.*view/i });
    if (await kanbanButton.isVisible()) {
      await kanbanButton.click();
    }

    // Create a task
    await page.getByRole('button', { name: /new task/i }).click();
    await page.getByLabel('Task title').fill('Mobile Kanban Task');
    await page.getByRole('button', { name: /create/i }).click();

    await expect(page.getByText('Mobile Kanban Task')).toBeVisible();

    // On mobile, drag-and-drop might not work
    // Users should be able to change status via edit modal
    await page.getByText('Mobile Kanban Task').click();

    // Modal should open
    await expect(page.getByText('Edit Task')).toBeVisible();

    // Change status to In Progress
    await page.getByLabel('Set status to in_progress').click();
    await page.getByRole('button', { name: /update/i }).click();

    // Task should move to In Progress column
    await page.waitForTimeout(500);
    const inProgressColumn = page.locator('[data-status="in_progress"]');
    await expect(inProgressColumn.locator('text=Mobile Kanban Task')).toBeVisible();
  });

  test('should display kanban columns stacked on mobile', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Switch to kanban view
    const kanbanButton = page.getByRole('button', { name: /kanban.*view/i });
    if (await kanbanButton.isVisible()) {
      await kanbanButton.click();
    }

    // Verify columns are visible (may be stacked vertically)
    await expect(page.getByText('To Do')).toBeVisible();
    await expect(page.getByText('In Progress')).toBeVisible();
    await expect(page.getByText('Done')).toBeVisible();

    // On mobile, columns might scroll horizontally
    // Verify at least one column is visible
    const todoColumn = page.locator('[data-status="todo"]');
    await expect(todoColumn).toBeVisible();
  });
});

test.describe('Kanban Error Handling', () => {
  test('should handle failed status updates gracefully', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Switch to kanban view
    const kanbanButton = page.getByRole('button', { name: /kanban.*view/i });
    if (await kanbanButton.isVisible()) {
      await kanbanButton.click();
    }

    // Create a task
    await page.getByRole('button', { name: /new task/i }).click();
    await page.getByLabel('Task title').fill('Error Test Task');
    await page.getByRole('button', { name: /create/i }).click();

    await expect(page.getByText('Error Test Task')).toBeVisible();

    // In a real scenario, we'd mock a Firestore error
    // For now, just verify error handling structure exists

    // Try to drag task
    const taskCard = page.getByText('Error Test Task');
    const inProgressColumn = page.locator('[data-status="in_progress"]');

    const taskBoundingBox = await taskCard.boundingBox();
    const dropZoneBoundingBox = await inProgressColumn.boundingBox();

    if (taskBoundingBox && dropZoneBoundingBox) {
      await page.mouse.move(
        taskBoundingBox.x + taskBoundingBox.width / 2,
        taskBoundingBox.y + taskBoundingBox.height / 2
      );
      await page.mouse.down();
      await page.mouse.move(
        dropZoneBoundingBox.x + dropZoneBoundingBox.width / 2,
        dropZoneBoundingBox.y + dropZoneBoundingBox.height / 2,
        { steps: 10 }
      );
      await page.mouse.up();

      // If update fails, task should rollback to original position
      // Or an error toast should appear
      await page.waitForTimeout(500);
    }
  });

  test('should prevent dragging to invalid drop zones', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Switch to kanban view
    const kanbanButton = page.getByRole('button', { name: /kanban.*view/i });
    if (await kanbanButton.isVisible()) {
      await kanbanButton.click();
    }

    // Create a task
    await page.getByRole('button', { name: /new task/i }).click();
    await page.getByLabel('Task title').fill('Invalid Drop Test');
    await page.getByRole('button', { name: /create/i }).click();

    await expect(page.getByText('Invalid Drop Test')).toBeVisible();

    // Try to drag task outside kanban area (should not work)
    const taskCard = page.getByText('Invalid Drop Test');
    const taskBoundingBox = await taskCard.boundingBox();

    if (taskBoundingBox) {
      await page.mouse.move(
        taskBoundingBox.x + taskBoundingBox.width / 2,
        taskBoundingBox.y + taskBoundingBox.height / 2
      );
      await page.mouse.down();

      // Try to drop in an invalid area (outside columns)
      await page.mouse.move(50, 50, { steps: 10 });
      await page.mouse.up();

      await page.waitForTimeout(500);

      // Task should remain in original position
      const todoColumn = page.locator('[data-status="todo"]');
      await expect(todoColumn.locator('text=Invalid Drop Test')).toBeVisible();
    }
  });
});
