// -----------------------------------------------------------
//  /api/lock  – PDF‑locking endpoint
// -----------------------------------------------------------

// Import pdf‑lib from a CDN – no npm install required
import { PDFDocument } from 'https://cdn.skypack.dev/pdf-lib@1.20.0';

/**
 * Main request handler.
 * Works for Vercel, Netlify, and Cloudflare Workers (the export at the bottom
 * adapts to each runtime).
 */
async function handler(request) {
  // We only accept POST
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ message: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Parse multipart/form‑data
  const form = await request.formData();
  const file = form.get('file');
  const password = form.get('password');

  if (!file || typeof password !== 'string') {
    return new Response(
      JSON.stringify({ message: 'Missing file or password' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Read the PDF bytes
  const arrayBuffer = await file.arrayBuffer();

  try {
    // Load, encrypt and re‑save the PDF
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    pdfDoc.encrypt({
      userPassword: password,          // **only userPassword** → viewer must ask
      permissions: {
        printing: 'notAllowed',
        modifying: false,
        copying: false,
        annotating: false,
        fillingForms: false,
        contentAccessibility: false,
        documentAssembly: false,
      },
    });
    const lockedBytes = await pdfDoc.save();

    // Return the encrypted PDF as a download
    return new Response(lockedBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        // Hint a filename – the front‑end will rename it again
        'Content-Disposition': `attachment; filename="${file.name
          .replace(/\.pdf$/i, '')}-locked.pdf"`,
      },
    });
  } catch (e) {
    console.error('PDF lock error →', e);
    const msg = e.message?.includes('password')
      ? 'The uploaded PDF is already password‑protected.'
      : 'Failed to lock PDF (maybe the file is corrupted).';
    return new Response(JSON.stringify({ message: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/* -----------------------------------------------------------
   EXPORT FOR THE THREE MAIN RUNTIMES
   ----------------------------------------------------------- */
// Vercel / Netlify (receive (req, res) arguments)
export default async (req, res) => {
  const response = await handler(req);
  // If the runtime passes a Node‑style `res` object, copy everything over
  if (res && typeof res.setHeader === 'function') {
    response.headers.forEach((v, k) => res.setHeader(k, v));
    res.writeHead(response.status);
    const body = await response.arrayBuffer();
    res.end(Buffer.from(body));
    return;
  }
  // Cloudflare Workers – just return the Response
  return response;
};

/* If you ever use a pure Workers project you could also export:
export { handler as onRequest };
*/
