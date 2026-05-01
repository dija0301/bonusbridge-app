import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DOCUSIGN_BASE_URL = 'https://demo.docusign.net/restapi' // switch for production
const DOCUSIGN_AUTH_URL = 'https://account-d.docusign.com'    // switch for production

async function getDocuSignToken(): Promise<string> {
  const integrationKey = Deno.env.get('DOCUSIGN_INTEGRATION_KEY')!
  const rsaPrivateKey   = Deno.env.get('DOCUSIGN_RSA_PRIVATE_KEY')!
  // sub = API User GUID (the user we impersonate via JWT Grant), NOT the account ID.
  // The account ID goes in the REST URL path, not the JWT claim.
  const userId          = Deno.env.get('DOCUSIGN_USER_ID')!

  const now = Math.floor(Date.now() / 1000)
  const claim = {
    iss: integrationKey,
    sub: userId,
    aud: 'account-d.docusign.com',
    iat: now,
    exp: now + 3600,
    scope: 'signature impersonation',
  }

  const header  = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const payload = btoa(JSON.stringify(claim)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const signingInput = `${header}.${payload}`

  let pemKey = rsaPrivateKey.trim()
  if (!pemKey.includes('\n')) {
    pemKey = pemKey
      .replace('-----BEGIN RSA PRIVATE KEY-----', '-----BEGIN RSA PRIVATE KEY-----\n')
      .replace('-----END RSA PRIVATE KEY-----', '\n-----END RSA PRIVATE KEY-----')
      .replace(/-----BEGIN RSA PRIVATE KEY-----\n(.+)\n-----END RSA PRIVATE KEY-----/, (_m, b) => {
        const chunks = b.match(/.{1,64}/g) || []
        return `-----BEGIN RSA PRIVATE KEY-----\n${chunks.join('\n')}\n-----END RSA PRIVATE KEY-----`
      })
  }

  const pemContents = pemKey
    .replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----/g, '')
    .replace(/-----END (?:RSA )?PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '')

  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0))

  let privateKey: CryptoKey
  try {
    privateKey = await crypto.subtle.importKey(
      'pkcs8', binaryDer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false, ['sign']
    )
  } catch {
    const pkcs8Header = new Uint8Array([
      0x30, 0x82, 0x00, 0x00,
      0x02, 0x01, 0x00,
      0x30, 0x0d,
        0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01,
        0x05, 0x00,
      0x04, 0x82, 0x00, 0x00,
    ])
    const totalLen = pkcs8Header.length - 4 + binaryDer.length
    pkcs8Header[2] = (totalLen >> 8) & 0xff
    pkcs8Header[3] = totalLen & 0xff
    pkcs8Header[pkcs8Header.length - 2] = (binaryDer.length >> 8) & 0xff
    pkcs8Header[pkcs8Header.length - 1] = binaryDer.length & 0xff
    const pkcs8 = new Uint8Array(pkcs8Header.length + binaryDer.length)
    pkcs8.set(pkcs8Header)
    pkcs8.set(binaryDer, pkcs8Header.length)
    privateKey = await crypto.subtle.importKey(
      'pkcs8', pkcs8,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false, ['sign']
    )
  }

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', privateKey,
    new TextEncoder().encode(signingInput)
  )

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const jwt = `${signingInput}.${sigB64}`

  const tokenRes = await fetch(`${DOCUSIGN_AUTH_URL}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })

  if (!tokenRes.ok) {
    const err = await tokenRes.text()
    throw new Error(`DocuSign token error: ${err}`)
  }

  const tokenData = await tokenRes.json()
  return tokenData.access_token
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()

    // DocuSign sends XML or JSON webhook payloads
    // Extract envelope status and ID
    const envelopeId = body?.envelopeId || body?.data?.envelopeId
    const status     = body?.status     || body?.data?.status

    if (!envelopeId) {
      return new Response('No envelope ID', { status: 200 }) // Return 200 to stop DocuSign retries
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Find agreement by envelope ID
    const { data: ag, error: agErr } = await supabase
      .from('agreements')
      .select('*, recipients(*), issuers(*)')
      .eq('docusign_envelope_id', envelopeId)
      .single()

    if (agErr || !ag) {
      console.log(`No agreement found for envelope ${envelopeId}`)
      return new Response('OK', { status: 200 })
    }

    // Update agreement DocuSign status
    const updateData: Record<string, string> = {
      docusign_status: status?.toLowerCase() ?? 'unknown',
    }

    if (status === 'completed') {
      // Download signed document from DocuSign
      try {
        const accessToken = await getDocuSignToken()
        const accountId   = Deno.env.get('DOCUSIGN_ACCOUNT_ID')!

        const docRes = await fetch(
          `${DOCUSIGN_BASE_URL}/v2.1/accounts/${accountId}/envelopes/${envelopeId}/documents/combined`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          }
        )

        if (docRes.ok) {
          const pdfBytes = await docRes.arrayBuffer()

          // Upload to Supabase Storage
          const filename  = `${ag.issuer_id}/${ag.id}/signed-agreement.pdf`
          const { error: uploadErr } = await supabase.storage
            .from('documents')
            .upload(filename, pdfBytes, {
              contentType: 'application/pdf',
              upsert: true,
            })

          if (!uploadErr) {
            // Save the storage path (not a public URL). The frontend generates
            // a short-lived signed URL when the user clicks the View button so
            // RLS on storage.objects can gate access per-recipient/per-issuer.
            updateData.signed_document_url = filename
          }
        }
      } catch (docErr) {
        console.error('Document download error:', docErr)
        // Don't fail the webhook — status update is more important
      }

      // Move agreement to onboarding status so recipient can be invited
      updateData.status = ag.status === 'pending_signature' ? 'onboarding' : ag.status

      // Log completion event
      await supabase.from('recipient_events').insert({
        recipient_id: ag.recipients?.id,
        issuer_id:    ag.issuer_id,
        event_type:   'agreement_acknowledged',
        new_value:    `DocuSign envelope completed. Envelope ID: ${envelopeId}`,
      })

    } else if (status === 'declined') {
      updateData.status = 'draft' // Reset to draft so issuer can review
    } else if (status === 'voided') {
      updateData.status = 'cancelled'
    }

    await supabase.from('agreements').update(updateData).eq('id', ag.id)

    return new Response(JSON.stringify({ success: true, envelope_id: envelopeId, status }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (e) {
    console.error('Webhook error:', e)
    return new Response('OK', { status: 200 }) // Always return 200 to stop DocuSign retries
  }
})
