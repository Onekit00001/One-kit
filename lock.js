// -----------------------------------------------------------
//  /api/lock  – PDF lock endpoint (no external keys needed)
// -----------------------------------------------------------

// pdf‑lib is imported from a CDN – no npm install required
import { PDFDocument } from 'https://cdn.skypack.dev/pdf-lib@1.20.0';

/**
 * Main request handler – works for Vercel/Netlify (req,res) **and**
 * for Cloudflare Workers (returns a Response).
 */
async function handler(request) {
  // ---------------------------------------------------------
  //  1️⃣  Accept only POST
  // ---------------------------------------------------------
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ message: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ---------------------------------------------------------
  //  2️⃣  Get multipart/form‑data (file + password)
  // ---------------------------------------------------------
  const form = await request.formData();
  const file = form.get('file');
  const password = form.get('password');

  if (!file || typeof password !== 'string') {
    return new Response(
      JSON.stringify({ message: 'Missing file or password' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ---------------------------------------------------------
  //  3️⃣  Read the PDF bytes
  // ---------------------------------------------------------
  const arrayBuffer = await file.arrayBuffer();

  // ---------------------------------------------------------
  //  4️⃣  Encrypt the PDF (userPassword only → viewer must ask)
  // ---------------------------------------------------------
  try {
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    pdfDoc.encrypt({
      userPassword: password,               // ← this forces the password prompt
      // **NO ownerPassword** – otherwise many viewers skip the prompt
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

    // ---------------------------------------------------------
    //  5️⃣  Return the locked PDF as a downloadable file
    // ---------------------------------------------------------
    return new Response(lockedBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        // Hint a filename (the front‑end will rename again)
        'Content-Disposition':
          `attachment; filename="${file.name.replace(/\.pdf$/i, '')}-locked.pdf"`,
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
// Vercel / Netlify (they give you (req, res) )
export default async (req, res) => {
  const response = await handler(req);
  // If the runtime gave us a Node‑style `res`, copy everything over
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

// (If you ever use a pure Workers project, you could also do:
// export { handler as onRequest };
