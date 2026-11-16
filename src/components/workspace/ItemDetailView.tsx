import { parseStyleString } from "../../lib/parseStyleString";

interface Props {
  section: string;
  sectionLabel: string;
  title: string;
  meta: string;
  status: string;
  updated: string;
  icon: string;
  iconStyle: string;
  statusStyle: string;
  backToSection: () => void;
}

export default function ItemDetailView({
  section,
  sectionLabel,
  title,
  meta,
  status,
  updated,
  icon,
  iconStyle,
  statusStyle,
  backToSection,
}: Props) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: "#faf9f6" }}>
      <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", background: "#fff", borderBottom: "1px solid #e2e0da" }}>
        <button
          onClick={backToSection}
          title={`All ${sectionLabel.toLowerCase()}`}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 7, border: "1px solid #e2e0da", background: "#f4f3ef", color: "#57534d", fontSize: 15, cursor: "pointer" }}
        >
          ←
        </button>
        <span style={{ fontFamily: "'Google Sans Flex',sans-serif", fontWeight: 600, fontSize: 15 }}>{title}</span>
        <span style={{ fontSize: 11, color: "#8a8680" }}>{sectionLabel}</span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "40px 40px 48px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 28 }}>
          <div style={parseStyleString(iconStyle)}>{icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontFamily: "'Google Sans Flex',sans-serif", fontWeight: 600, fontSize: 22, marginBottom: 6 }}>{title}</h1>
            <div style={{ fontSize: 13.5, color: "#8a8680" }}>{meta}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <span style={parseStyleString(statusStyle)}>{status}</span>
            <span style={{ fontSize: 11, color: "#b0aca4" }}>{updated}</span>
          </div>
        </div>

        <div style={{ border: "1px solid #e6e4de", borderRadius: 14, background: "#fff", padding: "22px 24px" }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 10 }}>Overview</div>
          <p style={{ fontSize: 13.5, lineHeight: 1.65, color: "#3a3733" }}>
            This is a detail view for <strong>{title}</strong> — wired to its own address (
            <code style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, background: "#f4f3ef", padding: "1px 6px", borderRadius: 4 }}>
              /{section}/{encodeURIComponent(title)}
            </code>
            ) so it can be linked to, bookmarked, or shared directly.
          </p>
        </div>
      </div>
    </div>
  );
}
