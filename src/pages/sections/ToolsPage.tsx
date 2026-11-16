import { useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Menu,
  Modal,
  Select,
  Switch,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { Plug, Plus, Trash2, Wrench, Server, RefreshCw, AlertTriangle, MoreVertical } from "lucide-react";
import { api, type McpServerInfo } from "../../lib/api";
import Sidebar from "../../components/workspace/Sidebar";
import type { HomeChrome } from "./shared";

interface Props {
  sub?: string;
  chrome: HomeChrome;
}

export default function ToolsPage({ chrome }: Props) {
  const [query, setQuery] = useState("");
  const [servers, setServers] = useState<McpServerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectOpen, setConnectOpen] = useState(false);

  const refresh = () => {
    setLoading(true);
    api
      .listMcp()
      .then((m) => setServers(m.servers))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(refresh, []);

  const q = query.trim().toLowerCase();
  const filteredServers = useMemo(
    () => (q ? servers.filter((s) => `${s.name} ${s.url}`.toLowerCase().includes(q)) : servers),
    [servers, q],
  );

  const toggleServer = async (s: McpServerInfo) => {
    const next = await api.setMcpEnabled(s.id, !s.enabled);
    setServers((prev) => prev.map((x) => (x.id === s.id ? next.server : x)));
  };
  const removeServer = async (s: McpServerInfo) => {
    await api.disconnectMcp(s.id);
    setServers((prev) => prev.filter((x) => x.id !== s.id));
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
        {/* header */}
        <Group px="lg" py="sm" justify="space-between" style={{ borderBottom: "1px solid #f0efea" }}>
          <Group gap={8}>
            <Wrench size={16} color="#847f76" />
            <Box>
              <Text fw={600} size="md">{chrome.homeTitle}</Text>
              <Text size="xs" c="dimmed">{chrome.homeSub}</Text>
            </Box>
          </Group>
          <Group gap={6}>
            <Tooltip label="Refresh">
              <ActionIcon variant="default" onClick={refresh} aria-label="refresh">
                <RefreshCw size={14} />
              </ActionIcon>
            </Tooltip>
            <Button size="compact-sm" color="terracotta" leftSection={<Plus size={14} />} onClick={() => setConnectOpen(true)}>
              Connect external tool / MCP
            </Button>
          </Group>
        </Group>

        {loading ? (
          <Group justify="center" py={60}>
            <Loader color="terracotta" />
          </Group>
        ) : (
          <Box px="lg" py="md" style={{ display: "flex", flexDirection: "column", gap: 26 }}>
            {/* ============ CONNECTED MCP SERVERS ============ */}
            <Box>
              <Group gap={8} mb={4}>
                <Plug size={15} color="#847f76" />
                <Text fw={600} size="sm">External MCP servers</Text>
                <Badge variant="light" color="gray" size="sm">{servers.length}</Badge>
              </Group>
              <Text size="xs" c="dimmed" mb={12}>
                Connected servers' tools are merged into the live toolset of the research agent <b>and every subagent</b> — no restart needed.
              </Text>

              {filteredServers.length === 0 ? (
                <Box style={{ border: "1px dashed #e2e0da", borderRadius: 12, padding: "26px 20px", textAlign: "center" }}>
                  <Server size={22} color="#c4bfb2" />
                  <Text size="sm" c="dimmed" mt={8}>No external tools connected yet.</Text>
                  <Button variant="light" color="terracotta" size="compact-sm" mt={12} leftSection={<Plus size={13} />} onClick={() => setConnectOpen(true)}>
                    Connect your first MCP server
                  </Button>
                </Box>
              ) : (
                <Box style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {filteredServers.map((s) => (
                    <Box key={s.id} style={{ border: "1px solid #e6e4de", borderRadius: 12, padding: "13px 15px", background: s.enabled ? "#fff" : "#faf9f6" }}>
                      <Group justify="space-between" wrap="nowrap" align="flex-start">
                        <Box style={{ minWidth: 0 }}>
                          <Group gap={8} wrap="nowrap">
                            <Text fw={600} size="sm" truncate>{s.name}</Text>
                            <Badge variant="light" color={s.status === "connected" ? "green" : "red"} size="sm" tt="none">
                              {s.status === "connected" ? `${s.toolCount} tools` : "error"}
                            </Badge>
                            <Badge variant="outline" color="gray" size="sm" tt="none">{s.transport}</Badge>
                          </Group>
                          <Text size="xs" c="dimmed" truncate mt={2}>{s.url}</Text>
                          {s.lastError && (
                            <Group gap={5} mt={4}>
                              <AlertTriangle size={12} color="#c2416a" />
                              <Text size="xs" c="#c2416a">{s.lastError}</Text>
                            </Group>
                          )}
                          {s.tools.length > 0 && (
                            <Group gap={5} mt={8}>
                              {s.tools.slice(0, 8).map((t) => (
                                <Tooltip key={t.name} label={t.description || t.name} multiline w={260} withArrow>
                                  <Badge variant="light" color="gray" size="xs" tt="none" style={{ cursor: "default" }}>
                                    {s.slug}__{t.name}
                                  </Badge>
                                </Tooltip>
                              ))}
                              {s.tools.length > 8 && <Text size="xs" c="dimmed">+{s.tools.length - 8} more</Text>}
                            </Group>
                          )}
                        </Box>
                        <Group gap={6} wrap="nowrap">
                          <Tooltip label={s.enabled ? "Enabled — agent can use it" : "Disabled"}>
                            <Switch size="sm" color="teal" checked={s.enabled} onChange={() => toggleServer(s)} aria-label="toggle server" />
                          </Tooltip>
                          <Menu shadow="md" width={160} position="bottom-end">
                            <Menu.Target>
                              <ActionIcon variant="subtle" color="gray" aria-label="server options">
                                <MoreVertical size={15} />
                              </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Item color="red" leftSection={<Trash2 size={13} />} onClick={() => removeServer(s)}>
                                Disconnect
                              </Menu.Item>
                            </Menu.Dropdown>
                          </Menu>
                        </Group>
                      </Group>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </Box>
        )}
      </section>

      <ConnectMcpModal
        opened={connectOpen}
        onClose={() => setConnectOpen(false)}
        onConnected={(server) => {
          setServers((prev) => [server, ...prev]);
          setConnectOpen(false);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Connect-MCP modal
// ---------------------------------------------------------------------------
function ConnectMcpModal({
  opened,
  onClose,
  onConnected,
}: {
  opened: boolean;
  onClose: () => void;
  onConnected: (s: McpServerInfo) => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [transport, setTransport] = useState<"http" | "sse">("http");
  const [headers, setHeaders] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName(""); setUrl(""); setTransport("http"); setHeaders(""); setError(null);
  };
  const close = () => { reset(); onClose(); };

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const { server } = await api.connectMcp({ name: name.trim(), url: url.trim(), transport, headers: headers.trim() || undefined });
      reset();
      onConnected(server);
    } catch (e) {
      // The backend probes the server; a 400 means it couldn't reach it.
      setError(e instanceof Error ? e.message.replace(/^\d+\s+/, "") : "Couldn't connect to that server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal opened={opened} onClose={close} title="Connect external tool / MCP server" centered size="lg">
      <Text size="xs" c="dimmed" mb="md">
        Point Reagent at any Model Context Protocol server. On connect we probe it, list its tools, and wire them into the research agent and its subagents.
      </Text>
      <Box style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <TextInput label="Name" placeholder="e.g. GitHub, Exa, my-lab-tools" value={name} onChange={(e) => setName(e.currentTarget.value)} required />
        <TextInput label="Server URL" placeholder="https://server.example.com/mcp" value={url} onChange={(e) => setUrl(e.currentTarget.value)} required />
        <Select
          label="Transport"
          value={transport}
          onChange={(v) => setTransport((v as "http" | "sse") || "http")}
          data={[
            { value: "http", label: "Streamable HTTP (recommended)" },
            { value: "sse", label: "SSE (legacy)" },
          ]}
        />
        <Textarea
          label="Headers (optional JSON)"
          description='Auth / custom headers, e.g. {"Authorization": "Bearer sk-…"}'
          placeholder='{"Authorization": "Bearer …"}'
          value={headers}
          onChange={(e) => setHeaders(e.currentTarget.value)}
          autosize
          minRows={2}
        />
        {error && (
          <Group gap={6} align="flex-start" style={{ background: "#fdecef", border: "1px solid #f3c6d0", borderRadius: 8, padding: "8px 10px" }}>
            <AlertTriangle size={14} color="#c2416a" style={{ marginTop: 2 }} />
            <Text size="xs" c="#a8324f">{error}</Text>
          </Group>
        )}
      </Box>
      <Group justify="flex-end" mt="lg">
        <Button variant="default" onClick={close} disabled={busy}>Cancel</Button>
        <Button color="terracotta" onClick={connect} loading={busy} disabled={!name.trim() || !url.trim()} leftSection={<Plug size={14} />}>
          Connect
        </Button>
      </Group>
    </Modal>
  );
}
