import { useState } from "react";
import { ActionIcon, Button, Checkbox, Group, Menu, ScrollArea, Text, TextInput } from "@mantine/core";
import { Filter, Search } from "lucide-react";

/** Excel-style per-column filter state, shared across the section tables. */
export function useColumnFilters() {
  const [sel, setSel] = useState<Record<string, Set<string>>>({});
  const toggle = (key: string, value: string) =>
    setSel((p) => {
      const next = new Set(p[key] ?? []);
      next.has(value) ? next.delete(value) : next.add(value);
      return { ...p, [key]: next };
    });
  const clear = (key: string) => setSel((p) => ({ ...p, [key]: new Set() }));
  const selectAll = (key: string, values: string[]) =>
    setSel((p) => {
      const next = new Set(p[key] ?? []);
      values.forEach((v) => next.add(v));
      return { ...p, [key]: next };
    });
  const active = (key: string) => (sel[key]?.size ?? 0) > 0;
  /** True if `value` passes the filter for `key` (no filter ⇒ passes). */
  const pass = (key: string, value: string) => {
    const s = sel[key];
    return !s || s.size === 0 || s.has(value);
  };
  return { sel, toggle, clear, selectAll, active, pass };
}

interface Props {
  label: string;
  columnKey: string;
  values: string[]; // distinct values for this column
  selected: Set<string> | undefined;
  active: boolean;
  onToggle: (value: string) => void;
  onSelectAll: (values: string[]) => void;
  onClear: () => void;
}

/** A filter icon + dropdown (search, select-all, per-value checkboxes) for one
 *  table column. Mirrors the HomeView header filter so every section is consistent. */
export default function ColumnFilter({ label, values, selected, active, onToggle, onSelectAll, onClear }: Props) {
  const [text, setText] = useState("");
  const q = text.toLowerCase();
  const shown = q ? values.filter((v) => v.toLowerCase().includes(q)) : values;
  const selCount = selected?.size ?? 0;

  return (
    <Menu shadow="md" width={250} position="bottom-start" closeOnItemClick={false} withinPortal>
      <Menu.Target>
        <ActionIcon
          variant={active ? "light" : "subtle"}
          color={active ? "terracotta" : "gray"}
          size="xs"
          aria-label={`Filter ${label}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Filter size={11} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
        <TextInput
          size="xs"
          placeholder={`Search ${label}…`}
          leftSection={<Search size={12} />}
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          mb={6}
        />
        <Group justify="space-between" mb={4}>
          <Button size="compact-xs" variant="subtle" color="terracotta" onClick={() => onSelectAll(shown)}>
            Select {q ? "matching" : "all"}
          </Button>
          <Button size="compact-xs" variant="subtle" color="gray" disabled={!selCount} onClick={onClear}>
            Clear
          </Button>
        </Group>
        <ScrollArea.Autosize mah={240} type="auto">
          {shown.map((v) => (
            <Checkbox
              key={v}
              size="xs"
              color="terracotta"
              label={v}
              checked={selected?.has(v) ?? false}
              onChange={() => onToggle(v)}
              py={3}
              styles={{ label: { fontSize: 12, lineHeight: 1.3 }, labelWrapper: { maxWidth: 200 } }}
            />
          ))}
          {shown.length === 0 && (
            <Text size="xs" c="dimmed" py="xs" ta="center">
              No matches
            </Text>
          )}
        </ScrollArea.Autosize>
        <Text size="10px" c="dimmed" mt={6}>
          {selCount} of {values.length} selected
        </Text>
      </Menu.Dropdown>
    </Menu>
  );
}
