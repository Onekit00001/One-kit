// -----------------------------------------------------------
//  /api/lock  – server‑less PDF lock endpoint
// -----------------------------------------------------------
// Import pdf‑lib from a CDN – no npm install needed
import { PDFDocument } from 'https://cdn.skypack.dev/pdf-lib@1.20.0';

/**
 * Main handler – works for Vercel/Netlify (req,res) **and**
 * for Cloudflare Workers (returns a Response).
 */
async function handler(request) {
  // Only POST is allowed
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ message: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Retrieve multipart/form‑data fields
  const form = await request.formData();
  const file = form.get('file');
  const password = form.get('password');

  if (!file || typeof password !== 'string') {
    return new Response(
      JSON.stringify({ message: 'Missing file or password' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Read PDF bytes
  const arrayBuffer = await file.arrayBuffer();

  try {
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    // **Encrypt** – userPassword only (ownerPassword omitted)
    pdfDoc.encrypt({
      userPassword: password,
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

    // Return the encrypted PDF as a file download
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
    console.error('PDF lock error:', e);
    const msg = e.message?.includes('password')
      ? 'The uploaded PDF is already password-protected.'
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
// Vercel / Netlify (they give you (req, res) )
export default async (req, res) => {
  const response = await handler(req);
  // If the runtime gave us a Node‑style `res` object, copy everything in.
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

/* For pure Workers you could also export:
// export { handler as onRequest };
*/
