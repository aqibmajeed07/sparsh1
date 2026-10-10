import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { to, subject, html, pdfBase64, studentName } = await req.json();

    if (!to || !pdfBase64) {
      return NextResponse.json({ error: 'Missing recipient email or PDF data' }, { status: 400 });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      return NextResponse.json({ error: 'Email service unconfigured: RESEND_API_KEY environment variable missing' }, { status: 503 });
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Sparsh <noreply@sparsh.edu>',
        to: [to],
        subject: subject || `Sparsh Report Card for ${studentName}`,
        html: html || `<p>Dear Parent,</p><p>Please find attached the latest Sparsh Report Card for ${studentName}.</p><p>Best,<br/>The Sparsh Team</p>`,
        attachments: [
          {
            filename: `${studentName.replace(/\s+/g, '_')}_Report.pdf`,
            content: pdfBase64,
          },
        ],
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({ success: true, data });
    } else {
      const errorText = await res.text();
      return NextResponse.json({ error: 'Failed to send email', details: errorText }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
