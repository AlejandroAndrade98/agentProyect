const REQUIRED_AUTH_MESSAGE =
  'Authenticated smoke checks require SMOKE_ACCESS_TOKEN or SMOKE_EMAIL and SMOKE_PASSWORD.';

const config = {
  apiUrl: normalizeApiUrl(process.env.SMOKE_API_URL),
  email: process.env.SMOKE_EMAIL,
  password: process.env.SMOKE_PASSWORD,
  accessToken: process.env.SMOKE_ACCESS_TOKEN,
  runMutations: parseBoolean(process.env.SMOKE_RUN_MUTATIONS, false),
  runAi: parseBoolean(process.env.SMOKE_RUN_AI, false),
  runExternalSync: parseBoolean(process.env.SMOKE_RUN_EXTERNAL_SYNC, false),
  verbose: parseBoolean(process.env.SMOKE_VERBOSE, false),
};

const state = {
  failures: [],
  warnings: [],
  skipped: [],
  passed: [],
  requestCounter: 0,
};

async function main() {
  if (!config.apiUrl) {
    fail(
      'SMOKE_API_URL is required. Example: SMOKE_API_URL=http://localhost:4000/api',
    );
    finish();
  }

  logInfo(`Runtime smoke target: ${config.apiUrl}`);
  logInfo('Default mode is read-only. Optional mutations/sync/AI are disabled unless explicitly enabled.');

  await checkHealth();

  const token = await getAccessToken();

  if (!token) {
    fail(REQUIRED_AUTH_MESSAGE);
    finish();
  }

  await checkAuthenticatedReadEndpoints(token);

  if (config.runMutations) {
    await checkSafeCompanyMutation(token);
  } else {
    skip('Mutation smoke skipped. Set SMOKE_RUN_MUTATIONS=true to enable.');
  }

  if (config.runAi) {
    await checkAiSmoke(token);
  } else {
    skip('AI smoke skipped. Set SMOKE_RUN_AI=true to enable.');
  }

  if (config.runExternalSync) {
    await checkExternalSyncSmoke(token);
  } else {
    skip('External sync smoke skipped. Set SMOKE_RUN_EXTERNAL_SYNC=true to enable.');
  }

  finish();
}

async function checkHealth() {
  const response = await request('GET', '/health', {
    description: 'Health endpoint',
  });

  assertObject(response.body, 'Health response should be a JSON object');
  pass('Health endpoint responded successfully.');
}

async function getAccessToken() {
  if (config.accessToken) {
    logInfo('Using SMOKE_ACCESS_TOKEN for authenticated smoke checks.');
    return config.accessToken;
  }

  if (!config.email || !config.password) {
    return null;
  }

  const response = await request('POST', '/auth/login', {
    description: 'Login',
    body: {
      email: config.email,
      password: config.password,
    },
    checkRequestId: true,
  });

  const accessToken = response.body?.accessToken;

  if (typeof accessToken !== 'string' || !accessToken) {
    fail('Login response did not include accessToken.');
    return null;
  }

  pass('Login succeeded and returned an access token.');
  return accessToken;
}

async function checkAuthenticatedReadEndpoints(token) {
  const currentUser = await request('GET', '/users/me', {
    token,
    description: 'Current user',
  });

  assertObject(currentUser.body, 'Current user response should be an object');
  assertString(currentUser.body?.id, 'Current user response should include id');
  pass('Current user endpoint responded successfully.');

  const dashboard = await request('GET', '/dashboard/summary', {
    token,
    description: 'Dashboard summary',
  });
  assertObject(dashboard.body, 'Dashboard summary response should be an object');
  pass('Dashboard summary responded successfully.');

  const readEndpoints = [
    ['/companies?page=1&pageSize=1', 'Companies read'],
    ['/contacts?page=1&pageSize=1', 'Contacts read'],
    ['/leads?page=1&pageSize=1', 'Leads read'],
    ['/tasks?page=1&pageSize=1', 'Tasks read'],
    ['/notes?page=1&pageSize=1', 'Notes read'],
    ['/products?page=1&pageSize=1', 'Products read'],
    ['/ai-suggestions?page=1&pageSize=1', 'AI suggestions read'],
  ];

  for (const [path, description] of readEndpoints) {
    const response = await request('GET', path, { token, description });
    assertListLikeResponse(response.body, `${description} response`);
    pass(`${description} endpoint responded successfully.`);
  }
}

async function checkSafeCompanyMutation(token) {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
  const name = `SMOKE_TEST_DO_NOT_USE_${timestamp}`;
  let createdCompanyId = null;

  try {
    const createResponse = await request('POST', '/companies', {
      token,
      description: 'Create temporary company',
      body: {
        name,
        notes:
          'Temporary runtime smoke test company. Safe to delete if cleanup failed.',
      },
    });

    createdCompanyId = createResponse.body?.id;

    if (typeof createdCompanyId !== 'string' || !createdCompanyId) {
      fail('Company mutation response did not include id.');
      return;
    }

    pass(`Temporary company created: ${createdCompanyId}`);
  } finally {
    if (createdCompanyId) {
      try {
        await request('DELETE', `/companies/${createdCompanyId}`, {
          token,
          description: 'Delete temporary company',
          expectedStatuses: [200, 204],
          checkJson: false,
        });
        pass(`Temporary company cleaned up: ${createdCompanyId}`);
      } catch (error) {
        warn(
          `Cleanup failed for temporary company ${createdCompanyId}. Manual cleanup may be required.`,
        );
        if (config.verbose) {
          warn(error instanceof Error ? error.message : String(error));
        }
      }
    }
  }
}

async function checkAiSmoke(token) {
  const leadsResponse = await request('GET', '/leads?page=1&pageSize=1', {
    token,
    description: 'Find lead for AI smoke',
  });

  const lead = getFirstDataItem(leadsResponse.body);

  if (!lead?.id) {
    skip('AI smoke skipped because no lead exists. Create a staging lead or run a manual AI smoke.');
    return;
  }

  const response = await request('POST', `/ai-suggestions/leads/${lead.id}/next-steps`, {
    token,
    description: 'Generate mock AI next steps suggestion',
    extraHeaders: {
      'X-App-Locale': 'en',
    },
  });

  assertString(response.body?.id, 'AI suggestion response should include id');

  if (
    response.body?.status &&
    !['PENDING_REVIEW', 'ACCEPTED', 'REJECTED'].includes(response.body.status)
  ) {
    fail(`Unexpected AI suggestion status: ${response.body.status}`);
  }

  const metadata = response.body?.metadataJson;

  if (metadata && typeof metadata === 'object') {
    if (metadata.canApplyAutomatically !== false) {
      fail('AI suggestion metadata should keep canApplyAutomatically=false.');
    }

    if (metadata.canSendEmailAutomatically !== false) {
      fail('AI suggestion metadata should keep canSendEmailAutomatically=false.');
    }

    if (!metadata.outputLocale) {
      warn('AI suggestion metadata did not include outputLocale.');
    }
  }

  pass('AI smoke generated a suggestion without accepting/applying it.');
}

async function checkExternalSyncSmoke(token) {
  const accountsResponse = await request('GET', '/connected-accounts?page=1&pageSize=50', {
    token,
    description: 'Connected accounts read',
  });

  const accounts = getDataArray(accountsResponse.body);

  if (accounts.length === 0) {
    skip('External sync smoke skipped because no connected accounts exist.');
    return;
  }

  const connectedEmailAccount = accounts.find(
    (account) =>
      account?.status === 'CONNECTED' &&
      Array.isArray(account.capabilities) &&
      account.capabilities.includes('EMAIL'),
  );
  const connectedCalendarAccount = accounts.find(
    (account) =>
      account?.status === 'CONNECTED' &&
      Array.isArray(account.capabilities) &&
      account.capabilities.includes('CALENDAR'),
  );

  if (connectedEmailAccount) {
    const gmailSync = await request('POST', '/external-sync/email-messages/sync', {
      token,
      description: 'Manual Gmail sync',
    });

    logCounts('Gmail sync counts', gmailSync.body, [
      'messagesFetched',
      'messagesStored',
      'messagesDeletedAsStale',
    ]);
    pass('Manual Gmail sync completed.');
  } else {
    skip('Manual Gmail sync skipped because no connected EMAIL account exists.');
  }

  if (connectedCalendarAccount) {
    const calendarSync = await request('POST', '/external-sync/calendar-events/sync', {
      token,
      description: 'Manual Calendar sync',
    });

    logCounts('Calendar sync counts', calendarSync.body, [
      'eventsFetched',
      'eventsStored',
      'eventsDeletedAsStale',
    ]);
    pass('Manual Calendar sync completed.');
  } else {
    skip('Manual Calendar sync skipped because no connected CALENDAR account exists.');
  }
}

async function request(method, path, options = {}) {
  const requestId = `smoke-${Date.now()}-${++state.requestCounter}`;
  const headers = new Headers();

  headers.set('Accept', 'application/json');
  headers.set('X-Request-Id', requestId);

  if (options.extraHeaders) {
    for (const [key, value] of Object.entries(options.extraHeaders)) {
      headers.set(key, value);
    }
  }

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }

  const url = buildUrl(path);
  const response = await fetch(url, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const expectedStatuses = options.expectedStatuses ?? [200];
  const responseRequestId = response.headers.get('x-request-id');

  if (options.checkRequestId !== false && !responseRequestId) {
    fail(`${options.description ?? method} did not return X-Request-Id.`);
  }

  if (config.verbose) {
    logInfo(
      `${method} ${path} -> ${response.status} requestId=${responseRequestId ?? 'missing'}`,
    );
  }

  const body = await readResponseBody(response, options.checkJson !== false);

  if (!expectedStatuses.includes(response.status)) {
    throw new Error(
      `${options.description ?? method} failed: ${method} ${path} returned ${response.status}. ${summarizeBody(
        body,
      )}`,
    );
  }

  return {
    status: response.status,
    headers: response.headers,
    requestId: responseRequestId,
    body,
  };
}

async function readResponseBody(response, checkJson) {
  if (response.status === 204) {
    return null;
  }

  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    if (checkJson) {
      fail(`Expected JSON response from ${response.url}.`);
    }

    return text;
  }
}

function buildUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${config.apiUrl}${normalizedPath}`;
}

function normalizeApiUrl(value) {
  if (!value) {
    return null;
  }

  return value.replace(/\/$/, '');
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function assertObject(value, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(message);
  }
}

function assertString(value, message) {
  if (typeof value !== 'string' || value.length === 0) {
    fail(message);
  }
}

function assertListLikeResponse(value, label) {
  if (Array.isArray(value)) {
    return;
  }

  assertObject(value, `${label} should be a JSON object`);

  if (Array.isArray(value?.data)) {
    return;
  }

  warn(`${label} did not include a data array; response shape may have changed.`);
}

function getDataArray(value) {
  if (Array.isArray(value?.data)) {
    return value.data;
  }

  if (Array.isArray(value)) {
    return value;
  }

  return [];
}

function getFirstDataItem(value) {
  return getDataArray(value)[0] ?? null;
}

function logCounts(label, value, keys) {
  const counts = {};

  for (const key of keys) {
    counts[key] = typeof value?.[key] === 'number' ? value[key] : null;
  }

  logInfo(`${label}: ${JSON.stringify(counts)}`);
}

function summarizeBody(body) {
  if (!body) {
    return '';
  }

  if (typeof body === 'string') {
    return body.slice(0, 300);
  }

  const safeBody = {
    statusCode: body.statusCode,
    error: body.error,
    message: body.message,
  };

  for (const key of Object.keys(safeBody)) {
    if (safeBody[key] === undefined) {
      delete safeBody[key];
    }
  }

  return JSON.stringify(safeBody).slice(0, 500);
}

function pass(message) {
  state.passed.push(message);
  logInfo(`PASS ${message}`);
}

function skip(message) {
  state.skipped.push(message);
  logInfo(`SKIP ${message}`);
}

function warn(message) {
  state.warnings.push(message);
  console.warn(`WARN ${message}`);
}

function fail(message) {
  state.failures.push(message);
  console.error(`FAIL ${message}`);
}

function logInfo(message) {
  console.log(message);
}

function finish() {
  console.log('');
  console.log('Runtime smoke summary');
  console.log(`Passed: ${state.passed.length}`);
  console.log(`Skipped: ${state.skipped.length}`);
  console.log(`Warnings: ${state.warnings.length}`);
  console.log(`Failures: ${state.failures.length}`);

  if (state.failures.length > 0) {
    console.log('');
    console.log('Failures:');
    for (const failure of state.failures) {
      console.log(`- ${failure}`);
    }
    process.exit(1);
  }

  process.exit(0);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
  finish();
});
