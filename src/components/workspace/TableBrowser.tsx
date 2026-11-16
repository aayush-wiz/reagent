import { useMemo, useState } from "react";
import { Center, NavLink, Table, Text, UnstyledButton } from "@mantine/core";
import { ChevronDown, ChevronUp, Table2 } from "lucide-react";
import BrowserShell from "./BrowserShell";
import type { TableRowVal } from "./types";

type TableName = "Subgroup estimates";

const TABLES: { name: TableName; meta: string }[] = [{ name: "Subgroup estimates", meta: "4 rows" }];

type ColKey = keyof TableRowVal;
const COLUMNS: { key: ColKey; label: string; align: "left" | "right" }[] = [
  { key: "name", label: "Subgroup", align: "left" },
  { key: "k", label: "k", align: "right" },
  { key: "g", label: "g", align: "right" },
  { key: "ci", label: "95% CI", align: "right" },
];

interface Props {
  tableRows: TableRowVal[];
  fill?: boolean;
}

export default function TableBrowser({ tableRows, fill }: Props) {
  const [openName, setOpenName] = useState<TableName | null>(null);
  const [sortKey, setSortKey] = useState<ColKey | null>(null);
  const [asc, setAsc] = useState(true);

  const rows = useMemo(() => {
    if (!sortKey) return tableRows;
    const numeric = sortKey !== "name" && sortKey !== "ci";
    return [...tableRows].sort((a, b) => {
      const cmp = numeric ? Number(a[sortKey]) - Number(b[sortKey]) : String(a[sortKey]).localeCompare(String(b[sortKey]));
      return asc ? cmp : -cmp;
    });
  }, [tableRows, sortKey, asc]);

  const toggleSort = (key: ColKey) => {
    if (sortKey === key) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(true);
    }
  };

  if (openName) {
    return (
      <BrowserShell title={openName} onBack={() => setOpenName(null)} fill={fill} scroll>
        <Table stickyHeader highlightOnHover verticalSpacing="xs" horizontalSpacing="md" fz="sm">
          <Table.Thead>
            <Table.Tr>
              {COLUMNS.map((c) => (
                <Table.Th key={c.key} style={{ textAlign: c.align }}>
                  <UnstyledButton onClick={() => toggleSort(c.key)} fz="sm" fw={600} style={{ width: "100%" }}>
                    <Center inline style={{ justifyContent: c.align === "right" ? "flex-end" : "flex-start", width: "100%", gap: 4 }}>
                      {c.label}
                      {sortKey === c.key ? asc ? <ChevronUp size={12} /> : <ChevronDown size={12} /> : null}
                    </Center>
                  </UnstyledButton>
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((r) => (
              <Table.Tr key={r.name}>
                {COLUMNS.map((c) => (
                  <Table.Td key={c.key} ff={c.key === "name" ? undefined : "monospace"} style={{ textAlign: c.align }}>
                    {r[c.key]}
                  </Table.Td>
                ))}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </BrowserShell>
    );
  }

  return (
    <BrowserShell title="Tables" fill={fill}>
      {TABLES.map((t) => (
        <NavLink
          key={t.name}
          label={t.name}
          leftSection={<Table2 size={15} />}
          rightSection={
            <Text size="xs" c="dimmed">
              {t.meta}
            </Text>
          }
          onClick={() => setOpenName(t.name)}
        />
      ))}
    </BrowserShell>
  );
}
