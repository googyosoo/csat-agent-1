import type { VercelRequest, VercelResponse } from '@vercel/node';

let appInstance: any;

try {
  const serverModule = require('../dist/server.cjs');
  appInstance = serverModule.default || serverModule;
} catch (e) {
  try {
    const tsModule = require('../server');
    appInstance = tsModule.default || tsModule;
  } catch (err) {
    console.error('Failed to load server module:', err);
  }
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (appInstance && typeof appInstance === 'function') {
    return appInstance(req, res);
  }
  return res.status(200).json({ success: true, message: '2027 CSAT Agent API Engine Online' });
}
