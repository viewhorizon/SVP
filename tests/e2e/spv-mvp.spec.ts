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

  test('opens centered information dialog and closes it with the X control', async ({ page }) => {
    await page.getByRole('button', { name: 'Información sobre el cálculo de puntos' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Información sobre el cálculo de puntos' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Cerrar información' }).click();
    await expect(dialog).toHaveCount(0);
  });

  test('shows disconnected inventory and runs a simulation without external sync', async ({ page }) => {
    await page.route('**/api/points/balance/*', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ available: 42, historical: 1240 }),
    }));
    await page.route('**/api/svp/votes/count', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ votesToday: 0 }),
    }));
    await page.route('**/api/svp/votes/limits', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ dailyLimit: 5, usedVotes: 0, remainingVotes: 5 }),
    }));
    await page.route('**/api/svp/votes', (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ pointsGranted: 2, limits: { remainingVotes: 4 }, impact: null }),
      });
    });

    await page.reload();
    await page.getByRole('button', { name: /Inventario/ }).click();
    await expect(page.getByRole('heading', { name: 'Plataforma de inventario externa' })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Sin conexión');
    await expect(page.getByText(/no consulta ni modifica sus artículos/)).toBeVisible();

    await page.getByRole('button', { name: 'Abrir simulación de contrato SVP' }).click();
    await expect(page.getByText('Simulación de contrato SVP')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Información sobre la simulación' })).toHaveCount(1);
    const activitySelect = page.getByRole('combobox', { name: /Actividad vinculada a Inventario externo/ });
    await expect.poll(() => activitySelect.locator('option').count()).toBeGreaterThan(1);
    await activitySelect.selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Simular evento' }).click();
    await expect(page.getByText(/Simulación aceptada por SVP:/)).toBeVisible();
    await expect(page.getByText(/No se sincroniza inventario externo/)).toBeVisible();
  });

  test('switches across the primary tabs', async ({ page }) => {
    await page.getByRole('button', { name: /Puntos/ }).click();
    await expect(page.getByText('Transferir Puntos')).toBeVisible();

    await page.getByRole('button', { name: /Historial/ }).click();
    await expect(page.getByText('Historial de Transacciones')).toBeVisible();

    await page.getByRole('button', { name: /Operaciones/ }).click();
    await expect(page.getByText('Centro de Operaciones')).toBeVisible();
  });

  test('does not show more than five votes when the backend rejects the next vote', async ({ page }) => {
    await page.route('**/api/points/balance/*', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ available: 42, historical: 1240 }),
    }));
    await page.route('**/api/svp/votes/count', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ votesToday: 4 }),
    }));
    await page.route('**/api/svp/votes/limits', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ dailyLimit: 5, usedVotes: 4, remainingVotes: 1 }),
    }));
    await page.route('**/api/svp/votes', (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      return route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Límite diario de votos alcanzado', limits: { dailyLimit: 5, usedVotes: 5, remainingVotes: 0 } }),
      });
    });

    await page.reload();
    await expect(page.getByTestId('today-votes-count')).toHaveText('4');
    await page.getByRole('button', { name: 'Votar' }).first().click();
    await expect(page.getByTestId('today-votes-count')).toHaveText('5');
    await expect(page.getByTestId('today-votes-count')).not.toHaveText('6');
  });

  test('loads the history tab without crashing when backend is unavailable', async ({ page }) => {
    await page.getByRole('button', { name: /Historial/ }).click();
    await expect(page.getByText('Historial de Transacciones')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error');
  });
});
