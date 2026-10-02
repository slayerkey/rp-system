import assert from 'node:assert/strict';
import { sanitizeToken, fetchChatGptUsage } from '../src/providers/openai-shared.ts';
import { perplexityProvider } from '../src/providers/perplexity.ts';
import { fetchUsageOAuth } from '../src/usage/client.ts';

assert.equal(sanitizeToken('Cookie: other=secret; __Secure-next-auth.session-token=session.value; theme=dark'), 'session.value');
assert.equal(sanitizeToken('__Secure-next-auth.session-token=session.value'), 'session.value');
assert.equal(sanitizeToken('Cookie: other=secret; theme=dark'), '');
assert.equal(sanitizeToken(JSON.stringify({accessToken:'a.b.c'})), 'a.b.c');
assert.equal(sanitizeToken('Bearer a.b.c'), 'a.b.c');
const prior=globalThis.fetch;
let cookie;
try {
  globalThis.fetch=async (url, opts)=> {
    cookie=opts?.headers?.Cookie;
    return new Response(JSON.stringify({remaining_pro:190,remaining_research:16,remaining_agentic_research:4,remaining_labs:24}),{
      status:200,headers:{'content-type':'application/json'}
    });
  };
  const result=await perplexityProvider.fetchUsage('Cookie: unrelated=discard; __Secure-authjs.session-token=session-test; theme=dark');
  assert.equal(result.ok,true);
  assert.equal(cookie,'__Secure-authjs.session-token=session-test');
  assert.equal(result.usage.windows[0].utilization,5);
  globalThis.fetch=async ()=>new Response('<html>Just a moment</html>',{status:403,headers:{'content-type':'text/html'}});
  const challenge=await perplexityProvider.fetchUsage('session-test');
  assert.equal(challenge.ok,false);
  assert.equal(challenge.reason,'blocked');
  const oauth=await fetchUsageOAuth('test-oauth-token');
  assert.equal(oauth.ok,false);
  assert.equal(oauth.reason,'blocked');
  globalThis.fetch=async ()=>new Response('{}',{status:401,headers:{'content-type':'application/json'}});
  assert.equal((await perplexityProvider.fetchUsage('session-test')).reason,'auth');
  globalThis.fetch=async ()=>new Response('{}',{status:200,headers:{'content-type':'application/json'}});
  const unknown=await perplexityProvider.fetchUsage('session-test');
  assert.equal(unknown.ok,false);
  assert.equal(unknown.reason,'error');
  // No token means no attempt to call a real account.
  const empty=await fetchChatGptUsage('');
  assert.equal(empty.ok,false);
  assert.equal(empty.reason,'auth');
} finally {globalThis.fetch=prior;}
console.log('PASS: token paste formats, secure cookie isolation, Cloudflare classification and unknown payload');
