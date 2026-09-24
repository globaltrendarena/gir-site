/**
 * Cloudflare Worker — GitHub OAuth bridge for Decap CMS
 * -------------------------------------------------------------
 * This is what lets the /admin dashboard on your static
 * (GitHub Pages) site log an editor in with their GitHub account
 * and commit content straight to your repository.
 *
 * Deploy steps are in cloudflare-worker/README.md.
 *
 * Required environment variables / secrets (set with `wrangler secret put`):
 *   GITHUB_CLIENT_ID
 *   GITHUB_CLIENT_SECRET
 *
 * Optional:
 *   ALLOWED_ORIGIN   — your site's origin, e.g. https://you.github.io
 *                       (defaults to "*" if not set — fine to start, tighten later)
 */

function randomState() {
  return crypto.randomUUID();
}

function html(body) {
  return new Response(body, {
    headers: { "content-type": "text/html;charset=UTF-8" },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "") {
      return new Response("GIR CMS auth worker is running.", { status: 200 });
    }

    // Step 1: Decap CMS opens this in a popup to kick off the GitHub OAuth flow.
    if (url.pathname === "/auth") {
      const state = randomState();
      const redirectUri = `${url.origin}/callback`;
      const githubAuthUrl = new URL("https://github.com/login/oauth/authorize");
      githubAuthUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
      githubAuthUrl.searchParams.set("redirect_uri", redirectUri);
      githubAuthUrl.searchParams.set("scope", "repo,user");
      githubAuthUrl.searchParams.set("state", state);

      const response = Response.redirect(githubAuthUrl.toString(), 302);
      const headers = new Headers(response.headers);
      headers.append(
        "Set-Cookie",
        `gir_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
      );
      return new Response(null, { status: 302, headers });
    }

    // Step 2: GitHub redirects back here with a ?code=...
    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      if (!code) {
        return html(renderPostMessage("error", "Missing OAuth code from GitHub."));
      }

      const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });

      const tokenData = await tokenResponse.json();

      if (tokenData.error || !tokenData.access_token) {
        return html(
          renderPostMessage(
            "error",
            tokenData.error_description || "GitHub did not return an access token."
          )
        );
      }

      return html(renderPostMessage("success", tokenData.access_token));
    }

    return new Response("Not found", { status: 404 });
  },
};

// Decap CMS expects the popup to postMessage a specific string format
// back to the window that opened it, then it closes itself.
function renderPostMessage(status, payload) {
  const message =
    status === "success"
      ? `authorization:github:success:${JSON.stringify({ token: payload, provider: "github" })}`
      : `authorization:github:error:${JSON.stringify({ message: payload })}`;

  return `<!doctype html>
<html><body>
<script>
  (function () {
    function receiveMessage() {
      window.opener.postMessage(
        ${JSON.stringify(message)},
        "*"
      );
      window.removeEventListener("message", receiveMessage, false);
    }
    window.addEventListener("message", receiveMessage, false);
    // Some browsers need the opener to be told we're ready immediately too.
    window.opener.postMessage("authorizing:github", "*");
  })();
</script>
<p>${status === "success" ? "Signed in. You can close this window." : "Sign-in failed. You can close this window and try again."}</p>
</body></html>`;
}
