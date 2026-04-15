import { useEffect } from "react";

type SeoProps = {
  title: string;
  description: string;
  image?: string;
  path?: string;
  type?: "website" | "article";
  robots?: string;
  publishedTime?: string;
  modifiedTime?: string;
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
};

const DEFAULT_OG_IMAGE = "/og-cover.svg";

function getSiteOrigin() {
  const configuredOrigin = import.meta.env.VITE_SITE_URL;
  if (configuredOrigin) {
    return configuredOrigin.replace(/\/+$/, "");
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "";
}

function toAbsoluteUrl(value?: string) {
  if (!value) return undefined;
  if (/^https?:\/\//.test(value)) return value;
  const origin = getSiteOrigin();
  if (!origin) return value;
  return `${origin}${value.startsWith("/") ? value : `/${value}`}`;
}

function upsertMeta(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }

  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, value);
  }
}

function upsertLink(rel: string, href: string) {
  let element = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!element) {
    element = document.createElement("link");
    element.rel = rel;
    document.head.appendChild(element);
  }
  element.href = href;
}

function upsertJsonLd(payload?: SeoProps["jsonLd"]) {
  const scriptId = "seo-json-ld";
  const existing = document.getElementById(scriptId);
  if (!payload) {
    existing?.remove();
    return;
  }

  const script = existing ?? document.createElement("script");
  script.id = scriptId;
  script.setAttribute("type", "application/ld+json");
  script.textContent = JSON.stringify(payload);

  if (!existing) {
    document.head.appendChild(script);
  }
}

export function Seo({
  title,
  description,
  image,
  path,
  type = "website",
  robots = "index,follow",
  publishedTime,
  modifiedTime,
  jsonLd,
}: SeoProps) {
  useEffect(() => {
    const canonicalUrl = toAbsoluteUrl(path ?? (typeof window !== "undefined" ? window.location.pathname : "/"));
    const imageUrl = toAbsoluteUrl(image ?? DEFAULT_OG_IMAGE);

    document.title = title;
    upsertMeta('meta[name="description"]', { name: "description", content: description });
    upsertMeta('meta[name="robots"]', { name: "robots", content: robots });
    upsertMeta('meta[property="og:title"]', { property: "og:title", content: title });
    upsertMeta('meta[property="og:description"]', { property: "og:description", content: description });
    upsertMeta('meta[property="og:type"]', { property: "og:type", content: type });
    upsertMeta('meta[property="og:site_name"]', { property: "og:site_name", content: "Vincent Hsia" });
    upsertMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
    upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: title });
    upsertMeta('meta[name="twitter:description"]', { name: "twitter:description", content: description });

    if (canonicalUrl) {
      upsertMeta('meta[property="og:url"]', { property: "og:url", content: canonicalUrl });
      upsertLink("canonical", canonicalUrl);
    }

    if (imageUrl) {
      upsertMeta('meta[property="og:image"]', { property: "og:image", content: imageUrl });
      upsertMeta('meta[name="twitter:image"]', { name: "twitter:image", content: imageUrl });
    }

    if (publishedTime) {
      upsertMeta('meta[property="article:published_time"]', {
        property: "article:published_time",
        content: publishedTime,
      });
    }

    if (modifiedTime) {
      upsertMeta('meta[property="article:modified_time"]', {
        property: "article:modified_time",
        content: modifiedTime,
      });
    }

    upsertJsonLd(jsonLd);
  }, [description, image, jsonLd, modifiedTime, path, publishedTime, robots, title, type]);

  return null;
}
