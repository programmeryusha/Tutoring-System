import { test, expect } from '@playwright/test';

test('End-to-end: Register, Login, Book Session, Read Session', async ({ page }) => {
  // Register a new user
  await page.goto('http://localhost:3000/register');
  await page.fill('input[placeholder="Username"]', 'testuser');
  await page.fill('input[placeholder="Email"]', 'testuser@example.com');
  await page.fill('input[placeholder="Password"]', 'testpassword');
  await page.click('button[type="submit"]');
  await page.waitForSelector('text=Registered successfully');
  await expect(page.locator('main')).toContainText('Registered successfully');

  // Login as the new user
  await page.goto('http://localhost:3000/login');
  await page.fill('input[placeholder="Email or Username"]', 'testuser');
  await page.fill('input[placeholder="Password"]', 'testpassword');
  await page.click('button[type="submit"]');
  await expect(page.locator('main')).toContainText('Login successful');

  // Book a session
  await page.goto('http://localhost:3000/sessions');
  await page.fill('input[placeholder="Skill ID"]', '1');
  await page.fill('input[type="datetime-local"]', '2026-02-24T10:00');
  await page.fill('input[placeholder="Duration (minutes)"]', '60');
  await page.click('button[type="submit"]');
  await expect(page.locator('main')).toContainText('Book Session');

  // Read sessions back
  await expect(page.locator('main')).toContainText('Your Sessions');
  await expect(page.locator('main')).toContainText('testuser');
});
