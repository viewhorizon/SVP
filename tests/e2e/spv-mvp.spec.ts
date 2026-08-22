import { expect, test } from '@playwright/test';

test.describe('SVP MVP', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('renders the dashboard and core metrics', async ({ page }) => {
    await expect(page.getByText('Sistema de Votos y Puntos')).toBeVisible();
    await expect(page.getByText('Votos de hoy')).toBeVisible();
    await expect(page.getByText('Puntos disponibles')).toBeVisible();
    await expect(page.getByText('Actividades Disponibles')).toBeVisible();
  });

  test('switches across the primary tabs', async ({ page }) => {
    await page.getByRole('button', { name: /Puntos/ }).click();
    await expect(page.getByText('Transferir Puntos')).toBeVisible();

    await page.getByRole('button', { name: /Historial/ }).click();
    await expect(page.getByText('Historial de Transacciones')).toBeVisible();

    await page.getByRole('button', { name: /Operaciones/ }).click();
    await expect(page.getByText('Centro de Operaciones')).toBeVisible();
  });

  test('loads the history tab without crashing when backend is unavailable', async ({ page }) => {
    await page.getByRole('button', { name: /Historial/ }).click();
    await expect(page.getByText('Historial de Transacciones')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error');
  });
});
