import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const country = req.headers['x-vercel-ip-country'] as string || '';

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ country_code: country.toUpperCase() || 'US' });
}
