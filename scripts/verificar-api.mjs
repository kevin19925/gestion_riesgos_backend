#!/usr/bin/env node
/**
 * Verificación rápida del API (health + login).
 * Uso: node scripts/verificar-api.mjs [BASE_URL]
 * Ejemplo: node scripts/verificar-api.mjs http://localhost:8080/api
 * Sin argumentos usa http://localhost:8080/api
 */

const BASE = process.argv[2] || process.env.API_BASE_URL || 'http://localhost:8080/api';
const TIMEOUT_MS = 8000;

async function fetchWithTimeout(url, options = {}, ms = TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    clearTimeout(t);
    return res;
  } catch (e) {
    clearTimeout(t);
    throw e;
  }
}

async function main() {
  let ok = 0;
  let fail = 0;

  console.log('Verificando API en', BASE, '\n');

  // 1. Health (sin auth)
  try {
    const res = await fetchWithTimeout(`${BASE}/health`);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.status === 'ok') {
      console.log('  GET /health: OK');
      ok++;
    } else {
      console.log('  GET /health: FAIL (status', res.status, ')');
      fail++;
    }
  } catch (e) {
    console.log('  GET /health: ERROR', e.message || e);
    fail++;
  }

  // 2. Login (respuesta 200 con success o 401 sin token es válida)
  try {
    const res = await fetchWithTimeout(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'verificar-api', password: 'no-existe' }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && data.success === false) {
      console.log('  POST /auth/login: OK (rechaza credenciales inválidas)');
      ok++;
    } else if (res.ok && data.success === true) {
      console.log('  POST /auth/login: OK (login válido en este entorno)');
      ok++;
    } else {
      console.log('  POST /auth/login: FAIL (status', res.status, ')');
      fail++;
    }
  } catch (e) {
    console.log('  POST /auth/login: ERROR', e.message || e);
    fail++;
  }

  console.log('');
  if (fail === 0) {
    console.log('Resultado: OK -', ok, 'pruebas pasaron. API lista.');
    process.exit(0);
  } else {
    console.log('Resultado: FALLOS -', ok, 'ok,', fail, 'fallos.');
    process.exit(1);
  }
}

main();
