// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const BASIC_AUTH_USER = process.env.BASIC_AUTH_USER
const BASIC_AUTH_PASS = process.env.BASIC_AUTH_PASS

export function middleware(req: NextRequest) {
  const auth = req.headers.get('authorization')

  if (auth) {
    const [scheme, encoded] = auth.split(' ')
    if (scheme === 'Basic') {
      const decoded = Buffer.from(encoded, 'base64').toString()
      const [user, pass] = decoded.split(':')

      if (user === BASIC_AUTH_USER && pass === BASIC_AUTH_PASS) {
        // 認証成功
        return NextResponse.next()
      }
    }
  }

  // 認証失敗 → Basic 認証プロンプトを表示
  return new NextResponse('Auth required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure Area"',
    },
  })
}

// 認証をかけたいパスを指定（例：全ページ）
export const config = {
  matcher: ['/:path*'],
}
