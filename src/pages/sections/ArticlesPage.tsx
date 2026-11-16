/**
 * src/pages/sections/ArticlesPage.tsx — "My Articles" (the user's article collection).
 *
 *   Lists every article the user owns (draft + public), generated from any of
 *   their researches. Each is a DRAFT when the agent creates it; the user reviews
 *   it here and clicks Publish to make it live at /article/:id.
 */
import { useEffect, useState } from "react";
import { ActionIcon, Badge, Box, Button, Group, Loader, Menu, Text, Tooltip } from "@mantine/core";
import { PenLine, ExternalLink, Link2, Trash2, Globe, EyeOff, MoreVertical } from "lucide-react";
import { api, type ArticleMeta } from "../../lib/api";
import Sidebar from "../../components/workspace/Sidebar";
import type { HomeChrome } from "./shared";

interface Props {
  sub?: string;
  chrome: HomeChrome;
}

function fmtDate(ms: number | null): string {
  if (!ms) return "";
  try {
    return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

export default function ArticlesPage({ chrome }: Props) {
  const [articles, setArticles] = useState<ArticleMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const refresh = () => {
    setLoading(true);
    api
      .listArticles()
      .then((r) => setArticles(r.articles))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(refresh, []);

  const q = query.trim().toLowerCase();
  const shown = q ? articles.filter((a) => `${a.title} ${a.subtitle}`.toLowerCase().includes(q)) : articles;

  const publish = async (a: ArticleMeta) => {
    await api.publishArticle(a.id).catch(() => {});
    setArticles((prev) => prev.map((x) => (x.id === a.id ? { ...x, status: "public", publishedAt: x.publishedAt ?? Date.now() } : x)));
  };
  const unpublish = async (a: ArticleMeta) => {
    await api.unpublishArticle(a.id).catch(() => {});
    setArticles((prev) => prev.map((x) => (x.id === a.id ? { ...x, status: "draft" } : x)));
  };
  const remove = async (a: ArticleMeta) => {
    await api.deleteArticle(a.id).catch(() => {});
    setArticles((prev) => prev.filter((x) => x.id !== a.id));
  };
  const copyLink = (a: ArticleMeta) => {
    void navigator.clipboard?.writeText(a.url);
  };

  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0, background: "#ffffff" }}>
      <Sidebar
        nav={chrome.nav}
        query={query}
        onQuery={setQuery}
        openTask={chrome.openTask}
        menuOpen={chrome.menuOpen}
        toggleMenu={chrome.toggleMenu}
        menuItems={chrome.menuItems}
      />

      <section style={{ flex: 1, overflowY: "auto", minHeight: 0, background: "#ffffff", display: "flex", flexDirection: "column" }}>
        <Group px="lg" py="sm" justify="space-between" style={{ borderBottom: "1px solid #f0efea" }}>
          <Group gap={8}>
            <PenLine size={16} color="#847f76" />
            <Box>
              <Text fw={600} size="md">{chrome.homeTitle}</Text>
              <Text size="xs" c="dimmed">{chrome.homeSub}</Text>
            </Box>
          </Group>
        </Group>

        {loading ? (
          <Group justify="center" py={60}>
            <Loader color="terracotta" />
          </Group>
        ) : shown.length === 0 ? (
          <Box style={{ margin: "48px auto", maxWidth: 480, textAlign: "center", padding: "0 20px" }}>
            <Globe size={24} color="#c4bfb2" />
            <Text size="sm" c="dimmed" mt={10}>
              No articles yet. Open a research and ask the agent to <b>write an article</b> from it — it appears here as a draft
              for you to review, then Publish to make it live.
            </Text>
          </Box>
        ) : (
          <Box px="lg" py="md" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {shown.map((a) => (
              <Box key={a.id} style={{ border: "1px solid #e6e4de", borderRadius: 12, padding: "14px 16px", background: "#fff" }}>
                <Group justify="space-between" wrap="nowrap" align="flex-start">
                  <Box style={{ minWidth: 0 }}>
                    <Group gap={8} wrap="nowrap">
                      <Text fw={600} size="sm" truncate>{a.title}</Text>
                      <Badge variant="light" color={a.status === "public" ? "green" : "gray"} size="sm" tt="none">
                        {a.status === "public" ? "Published" : "Draft"}
                      </Badge>
                    </Group>
                    {a.subtitle && <Text size="xs" c="dimmed" truncate mt={2}>{a.subtitle}</Text>}
                    <Text size="xs" c="#a8a49d" mt={4}>
                      {a.status === "public" && a.publishedAt ? `Published ${fmtDate(a.publishedAt)}` : `Created ${fmtDate(a.createdAt)}`}
                    </Text>
                  </Box>
                  <Group gap={6} wrap="nowrap">
                    {a.status === "public" ? (
                      <Button size="compact-sm" variant="light" color="gray" leftSection={<EyeOff size={13} />} onClick={() => unpublish(a)}>
                        Unpublish
                      </Button>
                    ) : (
                      <Button size="compact-sm" color="terracotta" leftSection={<Globe size={13} />} onClick={() => publish(a)}>
                        Publish
                      </Button>
                    )}
                    <Tooltip label={a.status === "public" ? "Open article" : "Preview draft"}>
                      <ActionIcon variant="default" component="a" href={`/article/${a.id}`} target="_blank" aria-label="open">
                        <ExternalLink size={14} />
                      </ActionIcon>
                    </Tooltip>
                    <Menu shadow="md" width={170} position="bottom-end">
                      <Menu.Target>
                        <ActionIcon variant="subtle" color="gray" aria-label="options">
                          <MoreVertical size={15} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item leftSection={<Link2 size={13} />} onClick={() => copyLink(a)} disabled={a.status !== "public"}>
                          Copy link
                        </Menu.Item>
                        <Menu.Item color="red" leftSection={<Trash2 size={13} />} onClick={() => remove(a)}>
                          Delete
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Group>
                </Group>
              </Box>
            ))}
          </Box>
        )}
      </section>
    </div>
  );
}
