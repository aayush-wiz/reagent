import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ActionIcon, Badge, Box, Button, Group, Loader, Table, Tabs, Text, Tooltip } from "@mantine/core";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ListChecks, RefreshCw, ArrowLeft, Square, FlaskConical, Play, FileText, FileType, CircleCheck, AlertTriangle, Image as ImageIcon, MessageSquare, File as FileIcon, Download } from "lucide-react";
import { api, type TaskInfo, type TaskArtifacts, type WorkspaceFile } from "../../lib/api";
import { downloadText, downloadUrl } from "../../lib/download";
import { useRuns } from "../../lib/RunProvider";
import Sidebar from "../../components/workspace/Sidebar";
import { AgentMessage, type ChatMsg } from "../../components/workspace/AgentMessage";
import type { HomeChrome } from "./shared";

interface Props {
  sub?: string;
  chrome: HomeChrome;
}

const STATUS_COLOR: Record<string, string> = {
  queued: "gray",
  running: "blue",
  done: "green",
  failed: "red",
  canceled: "orange",
};

function relTime(ms: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function TasksPage({ sub, chrome }: Props) {
  const isDetail = sub !== undefined;
  return isDetail ? <TaskDetail id={decodeURIComponent(sub!)} chrome={chrome} /> : <TaskList chrome={chrome} />;
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------
function TaskList({ chrome }: { chrome: HomeChrome }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = () => api.listTasks().then((d) => setTasks(d.tasks)).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => {
    refresh();
    // Poll while any task is active so the list's status pills stay live.
    const t = setInterval(refresh, 2500);
    return () => clearInterval(t);
  }, []);

  const q = query.trim().toLowerCase();
  const rows = useMemo(() => (q ? tasks.filter((t) => `${t.title} ${t.prompt}`.toLowerCase().includes(q)) : tasks), [tasks, q]);

  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0, background: "#ffffff" }}>
      <Sidebar nav={chrome.nav} query={query} onQuery={setQuery} openTask={chrome.openTask} menuOpen={chrome.menuOpen} toggleMenu={chrome.toggleMenu} menuItems={chrome.menuItems} />
      <section style={{ flex: 1, overflowY: "auto", minHeight: 0, background: "#fff", display: "flex", flexDirection: "column" }}>
        <Group px="lg" py="sm" justify="space-between" style={{ borderBottom: "1px solid #f0efea" }}>
          <Group gap={8}>
            <ListChecks size={16} color="#847f76" />
            <Box>
              <Text fw={600} size="md">{chrome.homeTitle}</Text>
              <Text size="xs" c="dimmed">{chrome.homeSub}</Text>
            </Box>
          </Group>
          <Tooltip label="Refresh">
            <ActionIcon variant="default" onClick={refresh} aria-label="refresh"><RefreshCw size={14} /></ActionIcon>
          </Tooltip>
        </Group>

        {loading ? (
          <Group justify="center" py={60}><Loader color="terracotta" /></Group>
        ) : rows.length === 0 ? (
          <Box style={{ textAlign: "center", padding: "60px 20px" }}>
            <ListChecks size={24} color="#c4bfb2" />
            <Text size="sm" c="dimmed" mt={8}>No tasks yet. Hit “New task” in the sidebar to run one in the background.</Text>
          </Box>
        ) : (
          <Table.ScrollContainer minWidth={640}>
            <Table className="crm-table" verticalSpacing={8} horizontalSpacing="md" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ paddingLeft: 20 }}>Task</Table.Th>
                  <Table.Th w={120}>Status</Table.Th>
                  <Table.Th w={110} ta="right">Created</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((t) => (
                  <Table.Tr key={t.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/tasks/${encodeURIComponent(t.id)}`)}>
                    <Table.Td style={{ paddingLeft: 20, maxWidth: 560 }}>
                      <Text size="sm" fw={600} lineClamp={1}>{t.title}</Text>
                      {t.result && <Text size="xs" c="dimmed" lineClamp={1}>{t.result}</Text>}
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={STATUS_COLOR[t.status] ?? "gray"} size="sm" radius="sm" tt="none" fw={500}>
                        {t.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td ta="right"><Text size="xs" c="dimmed">{relTime(t.createdAt)}</Text></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail — live view of one run
// ---------------------------------------------------------------------------
function TaskDetail({ id, chrome }: { id: string; chrome: HomeChrome }) {
  const navigate = useNavigate();
  const { attach, cancel, runs } = useRuns();
  const [task, setTask] = useState<TaskInfo | null>(null);
  const [artifacts, setArtifacts] = useState<TaskArtifacts | null>(null);
  const [tab, setTab] = useState("run");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Attach to the live run (opens/reuses the socket; replays then streams).
  useEffect(() => {
    attach(id);
    api.getTask(id).then((d) => setTask(d.task)).catch(() => {});
  }, [id, attach]);

  const run = runs[id];
  const status = run?.status && run.status !== "unknown" ? run.status : task?.status ?? "queued";
  const streaming = status === "queued" || status === "running";
  const parts = run?.parts ?? [];

  // Load this task's OWN artifacts once it's finished.
  useEffect(() => {
    if (status === "done") api.taskArtifacts(id).then(setArtifacts).catch(() => {});
  }, [status, id]);

  // Auto-scroll while streaming.
  useEffect(() => {
    if (streaming && tab === "run" && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [parts, streaming, tab]);

  const aiMsg: ChatMsg = { role: "ai", parts };
  const docs = artifacts?.documents ?? [];
  const finds = artifacts?.findings ?? [];
  const files = artifacts?.files ?? [];
  const plots = files.filter((f) => f.category === "chart");
  const dataFiles = files.filter((f) => f.category !== "chart");
  const hasArtifacts = docs.length + finds.length + files.length > 0;

  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0, background: "#ffffff" }}>
      <Sidebar nav={chrome.nav} query="" onQuery={() => {}} openTask={chrome.openTask} menuOpen={chrome.menuOpen} toggleMenu={chrome.toggleMenu} menuItems={chrome.menuItems} />
      <section style={{ flex: 1, minHeight: 0, background: "#fff", display: "flex", flexDirection: "column" }}>
        <Group px="lg" py="sm" justify="space-between" style={{ borderBottom: "1px solid #f0efea" }}>
          <Button variant="subtle" color="gray" size="compact-sm" leftSection={<ArrowLeft size={15} />} onClick={() => navigate("/tasks")}>
            Tasks
          </Button>
          <Group gap={8}>
            <Badge variant="light" color={STATUS_COLOR[status] ?? "gray"} size="sm" radius="sm" tt="none">{status}</Badge>
            {streaming && (
              <Button size="compact-sm" variant="light" color="red" leftSection={<Square size={12} />} onClick={() => cancel(id)}>
                Cancel
              </Button>
            )}
          </Group>
        </Group>

        {/* Task prompt */}
        <Box px="xl" pt="md">
          <Box maw={860} mx="auto">
            <Group gap={8} mb={6}>
              <Play size={14} color="#847f76" />
              <Text fw={600} size="sm">Task</Text>
              {task?.researchId && (
                <Badge variant="light" color="gray" size="xs" tt="none" leftSection={<FlaskConical size={10} />} style={{ cursor: "pointer" }} onClick={() => navigate(`/researches/${task.researchId}`)}>
                  research
                </Badge>
              )}
            </Group>
            <Box style={{ background: "#ffffff", border: "1px solid #eceae4", borderRadius: 10, padding: "10px 13px" }}>
              <Text size="sm">{task?.prompt || "…"}</Text>
            </Box>
          </Box>
        </Box>

        <Tabs value={tab} onChange={(v) => v && setTab(v)} px="xl" pt="sm" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <Box maw={860} mx="auto" w="100%">
            <Tabs.List>
              <Tabs.Tab value="run" leftSection={<MessageSquare size={14} />}>Run</Tabs.Tab>
              {docs.length > 0 && <Tabs.Tab value="report" leftSection={<FileText size={14} />}>Report ({docs.length})</Tabs.Tab>}
              {finds.length > 0 && <Tabs.Tab value="findings" leftSection={<CircleCheck size={14} />}>Findings ({finds.length})</Tabs.Tab>}
              {files.length > 0 && <Tabs.Tab value="files" leftSection={<ImageIcon size={14} />}>Files ({files.length})</Tabs.Tab>}
            </Tabs.List>
          </Box>

          <Box ref={scrollRef} style={{ flex: 1, overflowY: "auto", paddingTop: 16, paddingBottom: 24 }}>
            <Box maw={860} mx="auto">
              {/* RUN — the streamed transcript */}
              <Tabs.Panel value="run">
                {parts.length === 0 && streaming ? (
                  <Group gap={8} c="dimmed">
                    <Loader size="xs" color="terracotta" />
                    <Text size="sm">Working… this keeps running in the background even if you leave.</Text>
                  </Group>
                ) : (
                  <AgentMessage message={aiMsg} streaming={streaming} />
                )}
                {run?.error && <Text size="sm" c="red" mt="md">{run.error}</Text>}
                {!streaming && !hasArtifacts && status === "done" && (
                  <Text size="xs" c="dimmed" mt="lg">This task produced no separate documents, findings, or files.</Text>
                )}
              </Tabs.Panel>

              {/* REPORT — .md documents this task wrote (list → reader, downloadable) */}
              <Tabs.Panel value="report">
                <TaskDocs docs={docs} />
              </Tabs.Panel>

              {/* FINDINGS this task recorded */}
              <Tabs.Panel value="findings">
                <Box style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {finds.map((f) => (
                    <Group key={f.id} gap={8} align="flex-start" wrap="nowrap" style={{ border: "1px solid #eceae4", borderRadius: 9, padding: "10px 12px" }}>
                      {f.kind === "warn" ? <AlertTriangle size={14} color="#b07419" style={{ marginTop: 2, flexShrink: 0 }} /> : <CircleCheck size={14} color="#3a7d44" style={{ marginTop: 2, flexShrink: 0 }} />}
                      <Text size="sm">{f.text}</Text>
                    </Group>
                  ))}
                </Box>
              </Tabs.Panel>

              {/* FILES — plots + data/code files this task produced */}
              <Tabs.Panel value="files">
                {artifacts?.researchId && plots.length > 0 && (
                  <Box mb="xl">
                    <Text fw={600} size="sm" mb={8}>Plots</Text>
                    <Box style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                      {plots.map((f) => <PlotFile key={f.path} researchId={artifacts.researchId!} file={f} />)}
                    </Box>
                  </Box>
                )}
                {artifacts?.researchId && dataFiles.length > 0 && (
                  <Box>
                    <Text fw={600} size="sm" mb={8}>Files</Text>
                    <Box style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {dataFiles.map((f) => <DataFile key={f.path} researchId={artifacts.researchId!} file={f} />)}
                    </Box>
                  </Box>
                )}
              </Tabs.Panel>
            </Box>
          </Box>
        </Tabs>
      </section>
    </div>
  );
}

// The task's report documents — a DocsBrowser-style list → reader, downloadable.
function TaskDocs({ docs }: { docs: { name: string; title: string; content: string }[] }) {
  const [open, setOpen] = useState<{ name: string; title: string; content: string } | null>(null);

  if (open) {
    return (
      <Box style={{ border: "1px solid #e2e0da", borderRadius: 10, overflow: "hidden" }}>
        <Group px="md" py={9} justify="space-between" style={{ borderBottom: "1px solid #eceae4" }}>
          <Group gap={7}>
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => setOpen(null)} aria-label="Back">
              <ArrowLeft size={15} />
            </ActionIcon>
            <FileText size={14} color="#2b5fd1" />
            <Text fw={600} size="sm">{open.title || open.name}</Text>
            <Badge variant="light" color="gray" size="xs" tt="none">{open.name}.md</Badge>
          </Group>
          <Button size="compact-sm" variant="light" leftSection={<Download size={13} />} onClick={() => downloadText(`${open.name}.md`, open.content)}>
            Download
          </Button>
        </Group>
        <Box className="agent-md" p="lg" style={{ maxHeight: "62vh", overflowY: "auto" }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{open.content || "_Empty document._"}</ReactMarkdown>
        </Box>
      </Box>
    );
  }

  return (
    <Box style={{ border: "1px solid #e2e0da", borderRadius: 10, overflow: "hidden" }}>
      <Group px="md" py={9} style={{ borderBottom: "1px solid #eceae4" }}>
        <Text fw={600} size="sm">Documents this task wrote</Text>
      </Group>
      {docs.map((d) => (
        <Group key={d.name} px="md" py={11} justify="space-between" wrap="nowrap" style={{ borderBottom: "1px solid #f2f1ec", cursor: "pointer" }} onClick={() => setOpen(d)}>
          <Group gap={9} wrap="nowrap" style={{ minWidth: 0 }}>
            <FileText size={15} color="#2b5fd1" style={{ flex: "0 0 auto" }} />
            <Box style={{ minWidth: 0 }}>
              <Text size="sm" fw={520} truncate>{d.title || d.name}</Text>
              <Text size="xs" c="dimmed">{d.name}.md · {d.content.length.toLocaleString()} chars</Text>
            </Box>
          </Group>
          <Tooltip label="Download .md" withArrow>
            <ActionIcon variant="subtle" color="gray" onClick={(e) => { e.stopPropagation(); downloadText(`${d.name}.md`, d.content); }} aria-label="Download">
              <Download size={15} />
            </ActionIcon>
          </Tooltip>
        </Group>
      ))}
    </Box>
  );
}

// A produced plot — fetch + render the image.
function PlotFile({ researchId, file }: { researchId: string; file: WorkspaceFile }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    api.readFile(researchId, file.path).then((r) => setSrc(r.file.content)).catch(() => {});
  }, [researchId, file.path]);
  const base = file.path.split("/").pop() || file.path;
  return (
    <Box style={{ border: "1px solid #eceae4", borderRadius: 10, overflow: "hidden" }}>
      {src ? <img src={src} alt={file.path} style={{ width: "100%", display: "block" }} /> : <Box style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center" }}><Loader size="xs" color="terracotta" /></Box>}
      <Group px={10} py={6} justify="space-between" wrap="nowrap">
        <Text size="xs" c="dimmed" ff="monospace" truncate>{file.path}</Text>
        {src && (
          <Tooltip label="Download" withArrow>
            <ActionIcon variant="subtle" color="gray" size="sm" component="a" href={src} download={base} aria-label="Download plot">
              <Download size={14} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
    </Box>
  );
}

// A produced data/code/PDF file — expandable preview (inline PDF viewer for reports).
function DataFile({ researchId, file }: { researchId: string; file: WorkspaceFile }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const base = file.path.split("/").pop() || "file";
  const isPdf = file.ext === ".pdf";
  const isBinary = [".pdf", ".zip", ".parquet", ".xlsx", ".xls", ".docx"].includes(file.ext);

  const download = (e: React.MouseEvent) => {
    e.stopPropagation();
    void downloadUrl(api.fileRawUrl(researchId, file.path), base); // binary-safe (PDF etc.)
  };

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next) return;
    if (isPdf) {
      if (!pdfUrl) {
        try {
          const res = await fetch(api.fileRawUrl(researchId, file.path));
          setPdfUrl(URL.createObjectURL(await res.blob()));
        } catch { /* ignore */ }
      }
      return;
    }
    if (isBinary) return;
    if (content === null) {
      const r = await api.readFile(researchId, file.path).catch(() => ({ file: { content: "Couldn't read file." } }));
      setContent(r.file.content);
    }
  };

  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  return (
    <Box style={{ border: "1px solid #eceae4", borderRadius: 9 }}>
      <Group gap={8} px={12} py={9} style={{ cursor: "pointer" }} onClick={toggle} wrap="nowrap">
        {isPdf ? <FileType size={14} color="#b3402e" /> : <FileIcon size={14} color="#847f76" />}
        <Text ff="monospace" size="xs" style={{ flex: 1 }}>{file.path}</Text>
        {isPdf ? <Badge size="xs" variant="light" color="red" tt="none">PDF</Badge> : <Text size="xs" c="dimmed">{file.ext.replace(".", "") || "file"}</Text>}
        <Tooltip label="Download" withArrow>
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={download} aria-label="Download file">
            <Download size={14} />
          </ActionIcon>
        </Tooltip>
      </Group>
      {open && (isPdf ? (
        pdfUrl ? (
          <iframe src={pdfUrl} title={file.path} style={{ width: "100%", height: 520, border: "none", borderTop: "1px solid #f0efea" }} />
        ) : (
          <Box style={{ borderTop: "1px solid #f0efea", padding: 16 }}><Loader size="xs" color="terracotta" /></Box>
        )
      ) : isBinary ? (
        <Box style={{ borderTop: "1px solid #f0efea", padding: "10px 12px" }}><Text size="xs" c="dimmed">Binary file — use Download to view.</Text></Box>
      ) : (
        <Box style={{ borderTop: "1px solid #f0efea", maxHeight: 360, overflow: "auto" }}>
          <pre style={{ margin: 0, padding: "10px 12px", fontSize: 11.5, lineHeight: 1.5, fontFamily: "ui-monospace, Menlo, monospace", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{content ?? "…"}</pre>
        </Box>
      ))}
    </Box>
  );
}
