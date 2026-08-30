"use client";

/**
 * Root catch-all. Must never paint Next's builtin DefaultGlobalError
 * ("This page couldn't load" / Reload / Back).
 *
 * Inline script runs before React hydration so recovery still works when
 * Attack Challenge briefly blocks JS chunks.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  if (typeof console !== "undefined") {
    console.error("[global] silent recover:", error?.message, error?.digest);
  }

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Clauxen</title>
      </head>
      <body
        style={{
          margin: 0,
          background: "Canvas",
          color: "CanvasText",
          colorScheme: "light dark",
          minHeight: "100dvh",
        }}
      >
        {/* Constant recovery script — must run before hydration, so it cannot
            be an external chunk. Static string, no user input. */}
        <script
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k='clx_gerr_n';var n=Number(sessionStorage.getItem(k)||'0');if(n<2){sessionStorage.setItem(k,String(n+1));location.reload();return;}sessionStorage.removeItem(k);location.replace('/');}catch(e){location.replace('/');}})();`,
          }}
        />
      </body>
    </html>
  );
}
