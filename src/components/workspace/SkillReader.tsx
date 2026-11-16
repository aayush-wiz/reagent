import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge, Box, Button, Center, Group, Loader, Text } from "@mantine/core";
import { ArrowLeft } from "lucide-react";
import { api, type CatalogSkill } from "../../lib/api";

interface Props {
  name: string;
  backLabel: string;
  backToSection: () => void;
}

/** Renders a skill's SKILL.md (the openscience skill definition) as a document. */
export default function SkillReader({ name, backLabel, backToSection }: Props) {
  const [doc, setDoc] = useState<{ skill: CatalogSkill; markdown: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(false);
    api
      .skillDoc(name)
      .then((d) => alive && setDoc(d))
      .catch(() => alive && setError(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [name]);

  return (
    <Box style={{ flex: 1, minHeight: 0, overflowY: "auto", background: "#ffffff" }}>
      <Group px="lg" py="sm" justify="space-between" style={{ borderBottom: "1px solid #e2e0da", position: "sticky", top: 0, background: "#fff", zIndex: 5 }}>
        <Button variant="subtle" color="gray" size="compact-sm" leftSection={<ArrowLeft size={15} />} onClick={backToSection}>
          {backLabel}
        </Button>
        {doc && (
          <Badge variant="light" color="terracotta" tt="none">
            {doc.skill.category}
          </Badge>
        )}
      </Group>

      <Box maw={820} mx="auto" px="lg" py="xl">
        {loading ? (
          <Center py={80}>
            <Loader color="terracotta" />
          </Center>
        ) : error || !doc ? (
          <Text c="dimmed" ta="center" py={80}>
            Couldn't load this skill.
          </Text>
        ) : (
          <div className="agent-md">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.markdown.replace(/^---[\s\S]*?---\n/, "")}</ReactMarkdown>
          </div>
        )}
      </Box>
    </Box>
  );
}
