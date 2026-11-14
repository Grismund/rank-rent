import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export interface OgImageInput {
  brand: string
  h1: string
  accent: string
}

/**
 * Generate a 1200×630 OG image as PNG.
 * Uses satori (HTML/CSS → SVG) + resvg (SVG → PNG).
 */
export async function generateOgImage(input: OgImageInput): Promise<Uint8Array> {
  const { brand, h1, accent } = input

  // Load Inter font for rendering
  const fontPath = resolve(
    import.meta.dirname,
    '..',
    '..',
    'node_modules',
    '@fontsource-variable',
    'inter',
    'files',
    'inter-latin-wght-normal.woff2'
  )

  let fontData: ArrayBuffer
  try {
    const buf = readFileSync(fontPath)
    fontData = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  } catch {
    // Fallback: use a minimal system font approach
    // satori requires at least one font; create a minimal buffer
    throw new Error(`Font file not found: ${fontPath}`)
  }

  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          backgroundColor: '#111111',
          padding: '60px',
          justifyContent: 'space-between',
        },
        children: [
          {
            type: 'div',
            props: {
              style: {
                fontSize: '28px',
                color: '#999999',
                fontWeight: 600,
              },
              children: brand,
            },
          },
          {
            type: 'div',
            props: {
              style: {
                fontSize: '56px',
                color: '#FFFFFF',
                fontWeight: 700,
                lineHeight: 1.2,
                maxWidth: '900px',
              },
              children: h1,
            },
          },
          {
            type: 'div',
            props: {
              style: {
                width: '100%',
                height: '6px',
                backgroundColor: accent,
                borderRadius: '3px',
              },
              children: [],
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: 'Inter',
          data: fontData,
          weight: 400,
          style: 'normal' as const,
        },
      ],
    }
  )

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width' as const, value: 1200 },
  })
  const png = resvg.render()
  return png.asPng()
}
