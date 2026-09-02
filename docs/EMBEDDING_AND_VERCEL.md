# Embedding and Vercel deployment

## Embed the widget

Replace `YOUR-PROJECT.vercel.app` with the Vercel domain. Paste this into the destination page's HTML or custom-code block:

```html
<iframe
  id="money-health-quote"
  src="https://YOUR-PROJECT.vercel.app/health-insurance/quote"
  title="Compare health insurance"
  loading="lazy"
  referrerpolicy="strict-origin-when-cross-origin"
  style="display:block;width:100%;height:720px;border:0;background:#fff"
></iframe>

<script>
  (() => {
    const frame = document.getElementById("money-health-quote");
    const widgetOrigin = new URL(frame.src).origin;
    const thankYouUrl = "https://www.money.com.au/health-insurance/health-thank-you";

    window.addEventListener("message", (event) => {
      if (event.origin !== widgetOrigin || event.source !== frame.contentWindow) return;

      if (event.data?.type === "money-health-quote:complete" && event.data.url === thankYouUrl) {
        window.location.assign(thankYouUrl);
        return;
      }

      if (event.data?.type !== "money-health-quote:resize") return;

      const height = Number(event.data.height);
      if (Number.isFinite(height)) {
        frame.style.height = `${Math.max(560, Math.min(1400, height))}px`;
      }
    });
  })();
</script>
```

The parent validates both the iframe origin and source window. Height messages resize the iframe; a completion message with the exact approved URL redirects the entire parent page after a successful production submission.

## Push to GitHub

Run these commands from the `money-lead-api` directory. The GitHub repository is empty, so this local project becomes its root:

```bash
cd "/Users/ian/Library/CloudStorage/GoogleDrive-ianlarbalestier67@gmail.com/My Drive/Projects/Money.com.au/money-lead-api"
git init
git branch -M main
git remote add origin https://github.com/ianmoney/money-lead-api.git
git add .
git status
git commit -m "Add Money health insurance quote widget"
git push -u origin main
```

If `origin` already exists, replace the `git remote add` command with `git remote set-url origin https://github.com/ianmoney/money-lead-api.git`.

## Deploy with Vercel

1. In Vercel, choose **Add New → Project** and import the GitHub repository.
2. Select **Next.js** and leave Root Directory as `.`.
3. Add the environment variables from `.env.example` in Project Settings → Environment Variables.
4. Set `EMBED_ALLOWED_ORIGINS` to the exact HTTPS origins of the pages that will contain the iframe, separated by spaces. Do not include paths or trailing slashes.
5. Deploy. Every push to the production branch will create a new Vercel deployment.

Use the generated Vercel hostname in the iframe `src`, then redeploy after adding that hostname to the Turnstile configuration and the embedding-page origins to `EMBED_ALLOWED_ORIGINS`.

The widget page will render without its own title, brand header or footer. Production SMS verification and lead submission remain unavailable until the first-party API, Turnstile and consent-version settings are supplied. The privacy/terms links and thank-you destination are fixed in source.
