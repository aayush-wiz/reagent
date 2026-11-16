import { Box, Group, Modal, Select, Text, Textarea, UnstyledButton } from "@mantine/core";
import { ArrowUp, FlaskConical } from "lucide-react";

interface Props {
  opened: boolean;
  onClose: () => void;
  value: string;
  onChange: (v: string) => void;
  researches: { id: string; title: string }[];
  research: string | null;
  onResearch: (v: string | null) => void;
  onRun: () => void;
}

/** "New task" composer — a chat-style prompt box with an optional research
 *  dropdown to scope the task to one of your existing researches. */
export default function TaskModal({ opened, onClose, value, onChange, researches, research, onResearch, onRun }: Props) {
  const canRun = value.trim().length > 0;
  const submit = () => {
    if (canRun) onRun();
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      size="lg"
      radius="lg"
      title={
        <Text fw={600} size="md">
          New task
        </Text>
      }
      styles={{ body: { paddingTop: 6 } }}
    >
      <Text size="xs" c="dimmed" mb="sm">
        Describe what you want done. Optionally scope it to one of your researches.
      </Text>

      {/* Composer box */}
      <Box
        style={{
          border: "1px solid #e2e0da",
          borderRadius: 14,
          background: "#faf9f6",
          padding: "12px 12px 10px",
          boxShadow: "0 1px 2px rgba(28,27,25,0.03)",
        }}
      >
        <Textarea
          value={value}
          onChange={(e) => onChange(e.currentTarget.value)}
          onKeyDown={onKeyDown}
          placeholder="Assign a task to Reagent…"
          autosize
          minRows={3}
          maxRows={12}
          variant="unstyled"
          autoFocus
          styles={{ input: { fontSize: 14, lineHeight: 1.55, padding: "0 4px" } }}
        />

        {/* Bottom toolbar: optional research selector + send */}
        <Group justify="space-between" align="center" mt={8}>
          <Select
            value={research}
            onChange={onResearch}
            data={researches.map((r) => ({ value: r.id, label: r.title }))}
            placeholder="No research (optional)"
            clearable
            searchable
            nothingFoundMessage="No researches"
            leftSection={<FlaskConical size={14} />}
            size="xs"
            maxDropdownHeight={240}
            styles={{
              input: { background: "#fff", border: "1px solid #e6e4de", fontSize: 12.5, minWidth: 210 },
            }}
            comboboxProps={{ withinPortal: true }}
          />

          <UnstyledButton
            onClick={submit}
            disabled={!canRun}
            aria-label="Run task"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: canRun ? "#1c1b19" : "#d2cfc8",
              color: "#faf9f6",
              cursor: canRun ? "pointer" : "not-allowed",
              transition: "background 0.12s",
            }}
          >
            <ArrowUp size={17} />
          </UnstyledButton>
        </Group>
      </Box>

      <Text size="10.5px" c="dimmed" mt={8} ta="right">
        ⌘↵ to run
      </Text>
    </Modal>
  );
}
