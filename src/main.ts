// load handlebars from deno.land/x
import * as mustache from "https://deno.land/x/mustache@v0.3.0/mod.ts";
import { Router } from "https://unpkg.com/service-worker-router@1.7.5/dist/router.browser.mjs";

declare global {
  interface FetchEvent extends Event {
    respondWith(response: Promise<Response>): void;
    request: Request;
  }

  interface WindowEventMap {
    fetch: FetchEvent;
  }
}

const layout = /*html*/ `
<!DOCTYPE html>
<html lang="en-US">

<head>
  <meta charset="UTF-8">
  <title>Service Worker Test Page</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>

<body>
  <div class="app">{{{app}}}</div>
  <script src="https://unpkg.com/htmx.org@1.8.4"
    integrity="sha384-wg5Y/JwF7VxGk4zLsJEcAojRtlVp1FKKdGy1qN+OMtdq72WRvX/EdRdqg/LOhYeV"
    crossorigin="anonymous"></script>
  <script>
    window.addEventListener('load', () => {
      // register service worker
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
          .then(function (registration) {
            console.log('ServiceWorker registration successful with scope: ', registration.scope);
          })
          .catch(function (err) {
            console.log('ServiceWorker registration failed: ', err);
          });
      }
    });
  </script>
</body>

</html>
`;

const router = new Router();

router.get("/dest/test.html", (req: { request: Request }) => {
  console.log(
    req.request.url,
    Object.fromEntries(req.request.headers.entries()),
  );
  const result = mustache.render(
    `<h1>{{title}}</h1>
    <button type="button" hx-target=".app" hx-get="{{url}}" hx-replace-url="{{pushUrl}}" hx-swap="innerHTML">
      {{linkText}}
    </button>`,
    {
      title: "Service Worker Page",
      url: "back.html",
      pushUrl: "index.html",
      linkText: "Zurück zur Startseite",
    },
  );

  if (req.request.headers.get("hx-request") === "true") {
    // load the template into the response body
    return new Response(result, {
      headers: {
        "content-type": "text/html; charset=UTF-8",
      },
    });
  }

  const page = mustache.render(layout, { app: result });
  return new Response(page, {
    headers: {
      "content-type": "text/html; charset=UTF-8",
    },
  });
});

router.get("/dest/back.html", (req: { request: Request }) => {
  console.log(
    req.request.url,
    Object.fromEntries(req.request.headers.entries()),
  );
  const result = mustache.render(
    `<h1>{{title}}</h1>
    <button type="button" hx-target=".app" hx-get="{{url}}" hx-push-url="true" hx-swap="innerHTML">
      {{linkText}}
    </button>`,
    {
      title: "Startseite",
      url: "test.html",
      linkText: "Zur Testseite",
    },
  );

  // load the template into the response body
  const response = new Response(result, {
    headers: {
      "content-type": "text/html; charset=UTF-8",
    },
  });

  // return the response
  return response;
});

// fake a fetch request based on a service worker environment
addEventListener("fetch", (event) => {
  const result = router.handleRequest(event.request);
  if (result) {
    event.respondWith(result.handlerPromise);
  } else {
    console.log("No route matched.");
  }
});
