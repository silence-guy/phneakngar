import { getAllPosts } from "@/lib/blog/posts";

// Set NEXT_PUBLIC_SITE_URL in your environment to your canonical domain (e.g. https://yourdomain.com).
// Falls back to relative URLs so nothing breaks before you configure it.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "";

export async function GET() {
  const posts = await getAllPosts();
  const siteUrl = SITE_URL;

  const items = posts
    .map(
      (post) => `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${siteUrl}/blog/${post.slug}</link>
      <description>${escapeXml(post.excerpt)}</description>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <guid isPermaLink="true">${siteUrl}/blog/${post.slug}</guid>
      <dc:creator>${escapeXml(post.author)}</dc:creator>
    </item>`
    )
    .join("");

  const lastBuildDate = posts.length > 0
    ? new Date(posts[0].date).toUTCString()
    : new Date().toUTCString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>ភ្នាក់ងារ ប្លុក</title>
    <link>${siteUrl}/blog</link>
    <description>គំនិតអំពីការកសាងក្រុមហ៊ុន AI ការសហការភ្នាក់ងារ និងអនាគតនៃកម្មវិធីផ្ទាល់ខ្លួន។</description>
    <language>km-kh</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${siteUrl}/blog/feed.xml" rel="self" type="application/rss+xml" />${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml",
    },
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
