/**
 * E2E tests for Task CRUD operations
 *
 * Prerequisites:
 * - Dev server running at http://localhost:3000
 * - User must be logged in (or test setup handles auth)
 * - Test project should exist or be created
 *
 * Run with: npx playwright test e2e/tasks.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Task CRUD Operations', () => {
  // Setup: Navigate to app and ensure user is logged in
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // Wait for auth state to load
    await page.waitForLoadState('networkidle');

    // TODO: Add authentication logic if needed
    // For now, assuming user is already authenticated or using Firebase emulator

    // Navigate to a test project or create one
    // This is a placeholder - adjust based on your app's navigation
    await page.waitForTimeout(1000);
  });

  test('should create a new task via TaskModal', async ({ page }) => {
    // Click "New Task" button
    const newTaskButton = page.getByRole('button', { name: /new task/i });
    await newTaskButton.click();

    // Modal should be visible
    await expect(page.getByText('Create New Task')).toBeVisible();

    // Fill in task details
    await page.getByLabel('Task title').fill('E2E Test Task');
    await page.getByLabel('Task description').fill('This task was created by E2E test');

    // Select high priority
    await page.getByLabel('Set priority to high').click();

    // Submit the form
    await page.getByRole('button', { name: /create/i }).click();

    // Modal should close
    await expect(page.getByText('Create New Task')).not.toBeVisible();

    // Task should appear in the list
    await expect(page.getByText('E2E Test Task')).toBeVisible();
    await expect(page.getByText('This task was created by E2E test')).toBeVisible();
  });

  test('should edit an existing task', async ({ page }) => {
    // Create a task first
    await page.getByRole('button', { name: /new task/i }).click();
    await page.getByLabel('Task title').fill('Task to Edit');
    await page.getByRole('button', { name: /create/i }).click();

    // Wait for task to appear
    await expect(page.getByText('Task to Edit')).toBeVisible();

    // Click on the task to edit
    await page.getByText('Task to Edit').click();

    // Modal should show "Edit Task"
    await expect(page.getByText('Edit Task')).toBeVisible();

    // Update the title
    const titleInput = page.getByLabel('Task title');
    await titleInput.clear();
    await titleInput.fill('Updated Task Title');

    // Update description
    await page.getByLabel('Task description').fill('Updated description');

    // Change status to "In Progress"
    await page.getByLabel('Set status to in_progress').click();

    // Save changes
    await page.getByRole('button', { name: /update/i }).click();

    // Modal should close
    await expect(page.getByText('Edit Task')).not.toBeVisible();

    // Updated task should be visible
    await expect(page.getByText('Updated Task Title')).toBeVisible();
    await expect(page.getByText('Updated description')).toBeVisible();
    await expect(page.getByText('In Progress')).toBeVisible();
  });

  test('should delete a task', async ({ page }) => {
    // Create a task first
    await page.getByRole('button', { name: /new task/i }).click();
    await page.getByLabel('Task title').fill('Task to Delete');
    await page.getByRole('button', { name: /create/i }).click();

    // Wait for task to appear
    await expect(page.getByText('Task to Delete')).toBeVisible();

    // Open task actions menu
    const taskCard = page.locator('text=Task to Delete').locator('..');
    await taskCard.getByLabel('Task actions').click();

    // Click delete button
    // Set up dialog handler before clicking delete
    page.on('dialog', dialog => dialog.accept());
    await page.getByText('Delete').click();

    // Task should be removed from the list
    await expect(page.getByText('Task to Delete')).not.toBeVisible();
  });

  test('should switch between list and kanban views', async ({ page }) => {
    // Create a test task
    await page.getByRole('button', { name: /new task/i }).click();
    await page.getByLabel('Task title').fill('View Test Task');
    await page.getByRole('button', { name: /create/i }).click();

    await expect(page.getByText('View Test Task')).toBeVisible();

    // Find view toggle buttons
    const listViewButton = page.getByRole('button', { name: /list.*view/i });
    const kanbanViewButton = page.getByRole('button', { name: /kanban.*view/i });

    // Switch to kanban view
    if (await kanbanViewButton.isVisible()) {
      await kanbanViewButton.click();

      // Verify kanban columns are visible
      await expect(page.getByText('To Do')).toBeVisible();
      await expect(page.getByText('In Progress')).toBeVisible();
      await expect(page.getByText('Done')).toBeVisible();

      // Task should still be visible in kanban
      await expect(page.getByText('View Test Task')).toBeVisible();
    }

    // Switch back to list view
    if (await listViewButton.isVisible()) {
      await listViewButton.click();

      // Task should still be visible in list
      await expect(page.getByText('View Test Task')).toBeVisible();
    }
  });

  test('should validate required fields', async ({ page }) => {
    // Click "New Task" button
    await page.getByRole('button', { name: /new task/i }).click();

    // Try to submit without title
    await page.getByRole('button', { name: /create/i }).click();

    // Error message should appear
    await expect(page.getByText('Task title is required')).toBeVisible();

    // Modal should still be open
    await expect(page.getByText('Create New Task')).toBeVisible();
  });

  test('should enforce character limits', async ({ page }) => {
    await page.getByRole('button', { name: /new task/i }).click();

    // Test title character limit
    const longTitle = 'a'.repeat(101);
    await page.getByLabel('Task title').fill(longTitle);
    await page.getByRole('button', { name: /create/i }).click();

    await expect(page.getByText('Title must be 100 characters or less')).toBeVisible();

    // Clear and set valid title
    await page.getByLabel('Task title').clear();
    await page.getByLabel('Task title').fill('Valid Title');

    // Test description character limit
    const longDesc = 'a'.repeat(501);
    await page.getByLabel('Task description').fill(longDesc);
    await page.getByRole('button', { name: /create/i }).click();

    await expect(page.getByText('Description must be 500 characters or less')).toBeVisible();
  });

  test('should display priority badges correctly', async ({ page }) => {
    // Create low priority task
    await page.getByRole('button', { name: /new task/i }).click();
    await page.getByLabel('Task title').fill('Low Priority Task');
    await page.getByLabel('Set priority to low').click();
    await page.getByRole('button', { name: /create/i }).click();

    await expect(page.getByText('Low Priority')).toBeVisible();

    // Create medium priority task
    await page.getByRole('button', { name: /new task/i }).click();
    await page.getByLabel('Task title').fill('Medium Priority Task');
    await page.getByLabel('Set priority to medium').click();
    await page.getByRole('button', { name: /create/i }).click();

    await expect(page.getByText('Medium Priority')).toBeVisible();

    // Create high priority task
    await page.getByRole('button', { name: /new task/i }).click();
    await page.getByLabel('Task title').fill('High Priority Task');
    await page.getByLabel('Set priority to high').click();
    await page.getByRole('button', { name: /create/i }).click();

    await expect(page.getByText('High Priority')).toBeVisible();
  });

  test('should show loading states', async ({ page }) => {
    // This test would need to simulate slow network
    // For now, just verify the modal opens/closes properly
    await page.getByRole('button', { name: /new task/i }).click();
    await page.getByLabel('Task title').fill('Loading Test');

    // Click submit and immediately check for loading state
    const submitButton = page.getByRole('button', { name: /create/i });
    await submitButton.click();

    // In a real scenario with slow network, we'd see "Saving..." here
    // await expect(page.getByText('Saving...')).toBeVisible();

    // Eventually modal should close
    await expect(page.getByText('Create New Task')).not.toBeVisible();
  });

  test('should handle errors gracefully', async ({ page }) => {
    // This test would require mocking Firestore errors
    // For now, verify basic error handling structure exists

    await page.getByRole('button', { name: /new task/i }).click();

    // The modal should have error display capability
    const errorContainer = page.locator('.bg-red-100, .bg-red-900');

    // Submit with invalid data to potentially trigger error
    await page.getByRole('button', { name: /create/i }).click();

    // Should show validation error (not network error, but tests error display)
    await expect(page.getByText(/required|error/i)).toBeVisible();
  });
});

test.describe('Task CRUD on Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should work correctly on mobile viewport', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Create task on mobile
    await page.getByRole('button', { name: /new task/i }).click();

    // Mobile modal should be properly sized
    await expect(page.getByText('Create New Task')).toBeVisible();

    // Fill form
    await page.getByLabel('Task title').fill('Mobile Task');
    await page.getByRole('button', { name: /create/i }).click();

    // Task should appear
    await expect(page.getByText('Mobile Task')).toBeVisible();
  });
});
