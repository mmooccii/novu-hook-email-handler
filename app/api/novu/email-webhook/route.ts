import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase } from '@/lib/supabase';

const NOVU_WEBHOOK_SECRET = process.env.NOVU_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    // === ヘッダー取得 ===
    const signature = request.headers.get('x-novu-signature') || '';
    const contentType = request.headers.get('content-type') || '';
    const userAgent = request.headers.get('user-agent') || '';

    console.log('📬 Webhook headers:', { signature, contentType, userAgent });

    // === 生ボディ取得 ===
    const rawBody = await request.text();

    // === HMAC 署名検証 ===
    // timestamp がない場合、Novu は通常 "HMAC-SHA256(body)" 形式
    const computedHmac = crypto
      .createHmac('sha256', NOVU_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(computedHmac),
    );

    if (!isValid) {
      console.warn('❌ Invalid signature');
      return NextResponse.json(
        { ok: false, error: 'invalid signature' },
        { status: 401 },
      );
    }

    // === 署名がOKなら JSON パース ===
    const body = JSON.parse(rawBody);
    console.log('✅ Verified Webhook Body:', body);

    // --- 任意: Supabaseに保存する場合 ---
    const { error } = await supabase.from('NovuWebhookLogs').insert({
      received_at: new Date().toISOString(),
      headers: { signature, contentType, userAgent },
      data: body,
    });

    if (error) {
      console.error('Failed to persist Novu webhook payload', error);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
