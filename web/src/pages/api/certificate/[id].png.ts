import type {APIRoute} from 'astro'
import type {CertificateData} from '../../../components/Certificate.astro'
import {renderCertificatePng} from '../../../lib/certificate-image'
import {CERTIFICATE_PROJECTION, content} from '../../../lib/ministry'

export const prerender = false

// The certificate as a PNG. `id` is the certificate document id or its number.
export const GET: APIRoute = async ({params}) => {
  const id = params.id ?? ''
  const certificate = await content.fetch<CertificateData | null>(
    `*[_type == "certificate" && (_id == $id || number == $id)][0]${CERTIFICATE_PROJECTION}`,
    {id},
  )
  if (!certificate) return new Response('No such certificate. The Archive may have it.', {status: 404})
  try {
    const png = await renderCertificatePng(certificate)
    return new Response(png, {
      headers: {
        'content-type': 'image/png',
        'cache-control': 'public, max-age=300, s-maxage=3600',
        'content-disposition': `inline; filename="${certificate.number}.png"`,
      },
    })
  } catch (error) {
    return new Response(`The printer jammed: ${error instanceof Error ? error.message : String(error)}`, {status: 500})
  }
}
