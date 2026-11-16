import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type CatalogSkill } from "../../lib/api";
import HomeView from "../../components/workspace/HomeView";
import DatabaseDetailView from "../../components/workspace/DatabaseDetailView";
import { GR, iconStyleFor, statusStyleFor, type HomeChrome } from "./shared";
import type { ResearchCardVal } from "../../components/workspace/types";

interface Props {
  sub?: string;
  chrome: HomeChrome;
}

export default function DataPage({ sub, chrome }: Props) {
  const navigate = useNavigate();
  const [catDatabases, setCatDatabases] = useState<CatalogSkill[]>([]);

  useEffect(() => {
    api.catalogDatabases().then((d) => setCatDatabases(d.databases)).catch(() => {});
  }, []);

  const isDetail = sub !== undefined;
  const itemId = isDetail ? decodeURIComponent(sub) : "";
  const backToSection = () => navigate("/data");

  const cards: ResearchCardVal[] = catDatabases.map((s) => {
    const c = GR;
    return { title: s.name.replace(/-database$/, ""), meta: s.description, status: "database", updated: "connected", icon: "▦", open: () => navigate(`/data/${encodeURIComponent(s.name)}`), iconStyle: iconStyleFor(c), statusStyle: statusStyleFor(c) };
  });

  if (isDetail) {
    return <DatabaseDetailView name={itemId} backToSection={backToSection} />;
  }

  return (
    <HomeView
      nav={chrome.nav}
      homeTitle={chrome.homeTitle}
      homeSub={chrome.homeSub}
      researches={cards}
      openTask={chrome.openTask}
      newAction={chrome.openTask}
      menuOpen={chrome.menuOpen}
      toggleMenu={chrome.toggleMenu}
      menuItems={chrome.menuItems}
    />
  );
}
