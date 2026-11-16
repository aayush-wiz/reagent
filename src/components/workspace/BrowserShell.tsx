import type { ReactNode } from "react";
import { ActionIcon, Group, Paper, ScrollArea, Text } from "@mantine/core";
import { ChevronLeft } from "lucide-react";

interface Props {
  title: ReactNode;
  /** When set, a back button is shown before the title. */
  onBack?: () => void;
  /** Right-aligned meta shown in the header (row count, figure label, file size…). */
  right?: ReactNode;
  /** When true the card grows to fill its column and scrolls internally; otherwise it sizes to content. */
  fill?: boolean;
  /** Cap the body height and scroll when the content can be long (open README / table). */
  scroll?: boolean;
  children: ReactNode;
}

/** One consistent Mantine card used for every Outputs section (Charts, Findings, Tables, Logs, Files). */
export default function BrowserShell({ title, onBack, right, fill, scroll, children }: Props) {
  const body = scroll ? (
    <ScrollArea.Autosize mah={fill ? undefined : 380} style={fill ? { flex: 1, minHeight: 0 } : undefined} type="auto">
      {children}
    </ScrollArea.Autosize>
  ) : (
    <div style={fill ? { flex: 1, minHeight: 0, overflowY: "auto" } : undefined}>{children}</div>
  );

  return (
    <Paper
      withBorder
      radius="md"
      style={{
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        ...(fill ? { flex: 1, minHeight: 0 } : {}),
      }}
    >
      <Group
        justify="space-between"
        px="sm"
        py="xs"
        wrap="nowrap"
        style={{ background: "#faf9f6", borderBottom: "1px solid #edece7", flexShrink: 0 }}
      >
        <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
          {onBack && (
            <ActionIcon variant="default" size="sm" onClick={onBack} aria-label="Back">
              <ChevronLeft size={15} />
            </ActionIcon>
          )}
          <Text fw={600} size="sm" truncate>
            {title}
          </Text>
        </Group>
        {right && (
          <Text c="dimmed" size="xs" style={{ flexShrink: 0 }}>
            {right}
          </Text>
        )}
      </Group>
      {body}
    </Paper>
  );
}
